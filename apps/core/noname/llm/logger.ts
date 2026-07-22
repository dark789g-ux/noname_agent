import { lib, _status } from "noname";
import { LLMLogLease } from "./logger-lease.js";
import { LLMLogPersistenceQueue, retryLLMLogPersistence, retryPendingActiveCheckpoints, shouldRetryPendingLogWrites } from "./logger-queue.js";
import { LLMLogStore, type ActiveCheckpointSnapshot, type ActiveLogRecord } from "./logger-store.js";
import { plainLogValue } from "./protocol.js";
import { buildGameSessions } from "./logger-sessions.js";
import type { ActiveLogSnapshot, ErrorStage, GameSession, LogEntry, LogStatus, LogTurn, RequestOutcome, RequestTiming, RequestTransport } from "./logger-types.js";
import { createRequestTiming, finishRequestTiming, markRequestTiming } from "./logger-timing.js";

export type { ActiveLogSnapshot, ErrorStage, GameSession, LogEntry, LogStatus, LogTurn, RequestOutcome, RequestTiming, RequestTransport } from "./logger-types.js";

type InternalActiveLog = ActiveLogSnapshot & { deadlineAt: number; ownerId: string; revision: number; startedAtMonotonic: number; attemptStartedAt: Map<string, number> };
type PersistedActive = ActiveLogRecord<LogEntry>;

const RECOVERY_INTERVAL = 60_000;
const RECOVERY_GRACE = 60_000;
const LEGACY_ACTIVE_TIMEOUT = 120_000;

function cloneEntry(entry: LogEntry): LogEntry {
	return plainLogValue(entry) as LogEntry;
}

function monotonicNow(): number {
	return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

function attemptKey(turnIndex: number, attemptIndex: number): string {
	return `${turnIndex}:${attemptIndex}`;
}

/**
 * Keeps game-facing APIs synchronous while serializing all IndexedDB work in
 * the background. Every persisted value is converted to plain JSON first.
 */
export class LLMLogger {
	private readonly store = new LLMLogStore({ getDatabase: () => lib?.db as IDBDatabase | undefined });
	private readonly persistence = new LLMLogPersistenceQueue({ reclaimQuota: () => this.store.reclaimQuota(), report: (operation, error) => this.announcePersistenceError(operation, error) });
	private lease?: LLMLogLease;
	private activeLogs = new Map<string, InternalActiveLog>();
	private pendingActives = new Map<string, PersistedActive>();
	private pendingFinals = new Map<string, { entry: LogEntry; generation: number; active: PersistedActive }>();
	private pendingRetryScheduled = false;
	private clearGeneration = 0;
	private initialized?: Promise<void>;
	private migrationComplete = false;
	private migrationRetryQueued = false;
	private recoveryTimer?: ReturnType<typeof setInterval>;
	private pagehideInstalled = false;

	/** Initializes migration, the tab lease and interrupted-decision recovery. Idempotent. */
	init(): Promise<void> {
		if (!this.initialized) {
			this.initialized = this.initialize().catch(error => {
				this.announcePersistenceError("initialize", error);
			});
		} else if (!this.migrationComplete && !this.migrationRetryQueued) {
			this.migrationRetryQueued = true;
			this.enqueue("migrate_retry", async () => {
				try {
					await this.store.migrateLegacy();
					this.migrationComplete = true;
				} finally {
					this.migrationRetryQueued = false;
				}
			});
		}
		return this.initialized;
	}

	private async initialize(): Promise<void> {
		this.lease = new LLMLogLease({ store: this.store, prefix: String(lib.configprefix || "noname") });
		try {
			await this.runWithRetry("migrate", () => this.store.migrateLegacy());
			this.migrationComplete = true;
		} catch (error) {
			// Migration failure must not prevent lease startup or later decision persistence.
			this.announcePersistenceError("migrate", error);
		}
		await this.lease.start();
		this.installPagehideHandler();
		void this.recoverInterrupted();
		if (!this.recoveryTimer) this.recoveryTimer = setInterval(() => void this.recoverInterrupted(), RECOVERY_INTERVAL);
	}

	start(decisionPoint: string, playerName: string, meta: LogEntry["meta"], seatNum?: number, deadlineAt = Date.now() + 120_000): string {
		const startedAt = Date.now();
		const id = `log_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;
		const gameId = (_status as { llmGameId?: string }).llmGameId || "game_unknown";
		const entry = cloneEntry({ id, gameId, timestamp: startedAt, decisionPoint, playerName, playerSeatNum: seatNum, durationMs: 0, status: "success", meta });
		const active: InternalActiveLog = { entry, partialArgs: "", startedAt, deadlineAt, ownerId: this.lease?.instanceId || "llm_uninitialized", revision: 1, startedAtMonotonic: monotonicNow(), attemptStartedAt: new Map() };
		this.activeLogs.set(id, active);
		this.enqueueActive(this.snapshotActive(active));
		this.publish("llm_log_start", entry);
		return id;
	}

	private snapshotActive(active: InternalActiveLog): PersistedActive {
		return {
			id: active.entry.id,
			ownerId: active.ownerId,
			revision: active.revision,
			gameId: active.entry.gameId,
			status: "active",
			timestamp: active.entry.timestamp,
			updatedAt: Date.now(),
			deadlineAt: active.deadlineAt,
			turns: active.entry.turns,
			entry: cloneEntry(active.entry),
		};
	}

	private enqueueActive(active: PersistedActive): void {
		if (this.initialized && !this.migrationComplete) void this.init();
		this.retryPendingFinals();
		this.pendingActives.set(active.id, active);
		this.enqueue("checkpoint", async () => {
			await this.store.putActive(active);
			if (this.pendingActives.get(active.id) === active) this.pendingActives.delete(active.id);
		});
	}

	private enqueue(name: string, operation: () => Promise<void>): void {
		this.persistence.enqueue(name, operation);
	}

	private enqueueCritical(name: string, operation: () => Promise<void>): Promise<void> {
		return this.persistence.enqueueCritical(name, operation);
	}

	private async runWithRetry(name: string, operation: () => Promise<void>): Promise<void> {
		await retryLLMLogPersistence(name, operation, () => this.store.reclaimQuota());
	}

	private publish(name: string, value: unknown): void {
		try {
			if (typeof lib !== "undefined" && lib.announce) lib.announce.publish(name, value);
		} catch (_error) {
			// Diagnostics must not affect an LLM decision.
		}
	}

	private announcePersistenceError(operation: string, error: unknown): void {
		this.publish("llm_log_persistence_error", { operation, error: error instanceof Error ? error.message : String(error), timestamp: Date.now() });
		if (lib.config?.dev) {
			console.warn(`[LLM] ${operation} persistence failed:`, error);
		}
	}

	private getActive(id: string): LogEntry | undefined {
		return this.activeLogs.get(id)?.entry;
	}

	private checkpoint(id: string): void {
		const active = this.activeLogs.get(id);
		if (!active) return;
		active.revision++;
		this.enqueueActive(this.snapshotActive(active));
	}

	private matchesGameAndPlayer(entry: LogEntry, gameId: string, playerName: string, seatNum?: number): boolean {
		if ((entry.gameId || "game_unknown") !== gameId) return false;
		if (seatNum === undefined) return entry.playerName === playerName;
		if (entry.playerSeatNum !== undefined) return entry.playerSeatNum === seatNum;
		return entry.playerName === playerName;
	}

	getActiveLogByGameAndPlayer(gameId: string, playerName: string, seatNum?: number): ActiveLogSnapshot | undefined {
		let latest: InternalActiveLog | undefined;
		for (const active of this.activeLogs.values()) {
			if (this.matchesGameAndPlayer(active.entry, gameId, playerName, seatNum) && (!latest || active.startedAt > latest.startedAt)) latest = active;
		}
		return latest && { entry: cloneEntry(latest.entry), partialArgs: latest.partialArgs, startedAt: latest.startedAt };
	}

	logRequest(id: string, messages: any[], tools: any[]): void {
		const entry = this.getActive(id);
		if (entry) entry.request = plainLogValue({ messages, tools });
	}

	logResponse(id: string, toolCall: { name: string; reason: string; arguments: any }, translatedResult?: any): void {
		const entry = this.getActive(id);
		if (entry) entry.response = plainLogValue({ toolCall, translatedResult });
	}

	logError(id: string, stage: ErrorStage, message: string, httpStatus?: number): void {
		const entry = this.getActive(id);
		if (entry) entry.error = { stage, message, httpStatus };
	}

	/** 开始一次独立的 provider 请求；SDK 内部重试仍归入同一个 attempt。 */
	startRequestAttempt(id: string, turnIndex: number, attemptIndex: number, transport: RequestTransport): void {
		const active = this.activeLogs.get(id);
		if (!active) return;
		const key = attemptKey(turnIndex, attemptIndex);
		if (active.attemptStartedAt.has(key)) return;
		const now = monotonicNow();
		(active.entry.requestTimings ||= []).push(createRequestTiming(turnIndex, attemptIndex, transport, now - active.startedAtMonotonic));
		active.attemptStartedAt.set(key, now);
		this.checkpoint(id);
		this.publishTiming(active);
	}

	markRequestFirstChunk(id: string, turnIndex: number, attemptIndex: number): void {
		this.markRequestTiming(id, turnIndex, attemptIndex, "firstChunkMs");
	}

	/** 首个有效文本或工具参数到达时只增加一次检查点，供中断恢复与实时 UI 使用。 */
	markRequestTTFT(id: string, turnIndex: number, attemptIndex: number): void {
		const marked = this.markRequestTiming(id, turnIndex, attemptIndex, "ttftMs");
		if (marked) this.checkpoint(id);
	}

	finishRequestAttempt(id: string, turnIndex: number, attemptIndex: number, outcome: Exclude<RequestOutcome, "pending">, errorStage?: ErrorStage): void {
		const active = this.activeLogs.get(id);
		if (!active) return;
		const timing = this.findRequestTiming(active.entry, turnIndex, attemptIndex);
		const startedAt = active.attemptStartedAt.get(attemptKey(turnIndex, attemptIndex));
		if (!timing || startedAt === undefined) return;
		finishRequestTiming(timing, outcome, monotonicNow() - startedAt, errorStage);
		this.publishTiming(active);
	}

	private markRequestTiming(id: string, turnIndex: number, attemptIndex: number, field: "firstChunkMs" | "ttftMs"): boolean {
		const active = this.activeLogs.get(id);
		if (!active) return false;
		const timing = this.findRequestTiming(active.entry, turnIndex, attemptIndex);
		const startedAt = active.attemptStartedAt.get(attemptKey(turnIndex, attemptIndex));
		if (!timing || startedAt === undefined) return false;
		const marked = markRequestTiming(timing, field, monotonicNow() - startedAt);
		if (!marked) return false;
		this.publishTiming(active);
		return true;
	}

	private findRequestTiming(entry: LogEntry, turnIndex: number, attemptIndex: number): RequestTiming | undefined {
		return entry.requestTimings?.find(timing => timing.turnIndex === turnIndex && timing.attemptIndex === attemptIndex);
	}

	private publishTiming(active: InternalActiveLog): void {
		this.publish("llm_log_timing", { logId: active.entry.id, entry: cloneEntry(active.entry) });
	}

	end(id: string, status: LogStatus): void {
		const active = this.activeLogs.get(id);
		if (!active) return;
		active.entry.durationMs = Date.now() - active.startedAt;
		active.entry.status = status;
		const entry = cloneEntry(active.entry);
		this.activeLogs.delete(id);
		this.pendingActives.delete(id);
		this.retryPendingFinals();
		const generation = this.clearGeneration;
		const persistedActive = this.snapshotActive(active);
		const pending = { entry, generation, active: persistedActive };
		this.pendingFinals.set(id, pending);
		this.enqueue("finalize", async () => {
			// A clear queued after this finalization must run after its active checkpoint
			// has been deleted; otherwise recovery could recreate a cleared log.
			await this.persistFinal(pending);
			if (this.pendingFinals.get(id) === pending) this.pendingFinals.delete(id);
		});
		if (lib.config?.dev) {
			console.log(`[LLM] ${entry.decisionPoint} ${entry.status} ${entry.durationMs}ms`, entry);
		}
		this.publish("llm_log_end", entry);
	}

	private async persistFinal(pending: { entry: LogEntry; generation: number; active: PersistedActive }): Promise<boolean> {
		const checkpoint: ActiveCheckpointSnapshot = { id: pending.active.id, ownerId: pending.active.ownerId, revision: pending.active.revision, updatedAt: pending.active.updatedAt };
		if (await this.store.finalize(checkpoint, pending.entry)) return true;
		// A checkpoint may have exhausted retries before a fast decision ends. CAS
		// permits recreation only when no completed or foreign/newer checkpoint exists.
		if (!(await this.store.putActive(pending.active))) return false;
		return this.store.finalize(checkpoint, pending.entry);
	}

	endFallback(id: string, reason: string): void {
		const entry = this.getActive(id);
		if (entry) entry.fallbackReason = reason;
		this.end(id, "fallback");
	}

	/** 流式内容仅用于实时 UI，不会产生 IndexedDB 写入。 */
	logStreamChunk(logId: string, partialArgs: string): void {
		const active = this.activeLogs.get(logId);
		if (active) active.partialArgs = partialArgs;
		this.publish("llm_log_chunk", { logId, partialArgs, ts: Date.now() });
	}

	logTurn(id: string, turn: LogTurn): void {
		const entry = this.getActive(id);
		if (!entry) return;
		(entry.turns ||= []).push(plainLogValue(turn));
		this.checkpoint(id);
	}

	private retryPendingFinals(): void {
		if (this.pendingRetryScheduled || !shouldRetryPendingLogWrites(this.pendingActives.size, this.pendingFinals.size)) return;
		this.pendingRetryScheduled = true;
		this.enqueue("checkpoint_pending", () => retryPendingActiveCheckpoints(this.pendingActives, id => this.activeLogs.has(id), active => this.store.putActive(active)));
		this.enqueue("finalize_pending", async () => {
			try {
				for (const [id, pending] of Array.from(this.pendingFinals)) {
					if (pending.generation !== this.clearGeneration) continue;
					await this.persistFinal(pending);
					if (this.pendingFinals.get(id) === pending) this.pendingFinals.delete(id);
				}
			} finally {
				this.pendingRetryScheduled = false;
			}
		});
	}

	async flush(): Promise<void> {
		this.retryPendingFinals();
		await this.persistence.drain();
	}

	private mergePending(entries: LogEntry[]): LogEntry[] {
		const merged = new Map<string, LogEntry>();
		for (const entry of entries) merged.set(entry.id, entry);
		for (const pending of this.pendingFinals.values()) {
			if (pending.generation === this.clearGeneration) merged.set(pending.entry.id, pending.entry);
		}
		return Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp);
	}

	async getLogs(): Promise<LogEntry[]> {
		await this.flush();
		try {
			return this.mergePending(await this.store.listEntries<LogEntry>());
		} catch (error) {
			this.announcePersistenceError("read", error);
			return this.mergePending([]);
		}
	}

	async clearLogs(): Promise<void> {
		this.clearGeneration++;
		const abandoned = Array.from(this.pendingFinals.values())
			.filter(pending => pending.generation < this.clearGeneration)
			.map(pending => ({ id: pending.active.id, ownerId: pending.active.ownerId, revision: pending.active.revision, updatedAt: pending.active.updatedAt }));
		for (const [id, pending] of this.pendingFinals) if (pending.generation < this.clearGeneration) this.pendingFinals.delete(id);
		const clearTask = this.enqueueCritical("clear", async () => {
			await this.store.discardActives(abandoned);
			await this.store.clearEntries();
		});
		await clearTask;
	}

	async getGameSessions(): Promise<GameSession[]> {
		return buildGameSessions(await this.getLogs());
	}

	async getLogsByGame(gameId: string): Promise<LogEntry[]> {
		const all = await this.getLogs();
		return all.filter(entry => (entry.gameId || "game_unknown") === gameId);
	}

	async getLogsByGameAndPlayer(gameId: string, playerName: string, seatNum?: number): Promise<LogEntry[]> {
		return (await this.getLogsByGame(gameId)).filter(entry => this.matchesGameAndPlayer(entry, gameId, playerName, seatNum));
	}

	/** Compatibility entry point retained for callers from the previous logger. */
	async migrateIfNeeded(): Promise<void> {
		await this.init();
	}

	private async recoverInterrupted(): Promise<void> {
		if (!this.lease) return;
		let active: PersistedActive[];
		try {
			active = await this.store.listActive<LogEntry>();
		} catch (error) {
			this.announcePersistenceError("scan_active", error);
			return;
		}
		const owners = active.map(record => record.ownerId).filter(ownerId => ownerId !== this.lease!.instanceId);
		const alive = await this.lease.confirmAlive(owners, 300);
		const now = Date.now();
		for (const record of active) {
			if (record.ownerId === this.lease.instanceId || alive.has(record.ownerId)) continue;
			let expired = false;
			try {
				expired = await this.store.isLeaseExpired(record.ownerId, now);
			} catch (error) {
				this.announcePersistenceError("check_lease", error);
				continue;
			}
			const deadline = typeof record.deadlineAt === "number" ? record.deadlineAt + RECOVERY_GRACE : record.updatedAt + LEGACY_ACTIVE_TIMEOUT;
			if (!expired || now <= deadline) continue;
			const entry = cloneEntry({ ...record.entry, id: record.id, turns: (record.turns || record.entry.turns) as LogTurn[], status: "interrupted", fallbackReason: "page_reload_or_crash" });
			entry.durationMs = Math.max(entry.durationMs || 0, now - entry.timestamp);
			this.enqueue("recover", async () => {
				await this.store.recover({ id: record.id, ownerId: record.ownerId, revision: record.revision, updatedAt: record.updatedAt }, entry);
			});
		}
	}

	private installPagehideHandler(): void {
		if (this.pagehideInstalled || typeof window === "undefined") return;
		this.pagehideInstalled = true;
		window.addEventListener("pagehide", event => {
			if (event.persisted) return;
			for (const active of Array.from(this.activeLogs.values())) {
				active.entry.fallbackReason = "page_reload_or_crash";
				this.end(active.entry.id, "interrupted");
			}
			void this.flush();
			void this.lease?.close();
		});
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden") void this.flush();
		});
	}
}

export const llmLogger = new LLMLogger();
