import type { GameSession, LogEntry, LogTurn } from "./logger-types.js";
import type { ActiveCheckpointSnapshot, LLMLogStore } from "./logger-store.js";
import type { LLMLogLease } from "./logger-lease.js";

const MAX_CACHED_GAMES = 4;
const MAX_CACHED_DETAILS = 40;

export function stripLogEntrySummary(entry: LogEntry): LogEntry {
	const { request: _request, detailLoaded: _detailLoaded, turns, ...rest } = entry;
	let strippedTurns: LogTurn[] | undefined;
	if (Array.isArray(turns)) {
		strippedTurns = turns.map(turn => {
			const { request: _turnReq, ...turnRest } = turn;
			return turnRest;
		});
	}
	return {
		...rest,
		...(strippedTurns !== undefined ? { turns: strippedTurns } : {}),
		detailLoaded: false,
	};
}

export function matchesGameAndPlayerEntry(entry: LogEntry, gameId: string, playerName: string, seatNum?: number): boolean {
	if ((entry.gameId || "game_unknown") !== gameId) return false;
	if (seatNum === undefined) return entry.playerName === playerName;
	if (entry.playerSeatNum !== undefined) return entry.playerSeatNum === seatNum;
	return entry.playerName === playerName;
}

export function mergeSummaryAndPending(
	summaries: LogEntry[],
	pendingFinals: Iterable<{ entry: LogEntry; generation: number }>,
	clearGeneration: number,
	filter?: (entry: LogEntry) => boolean
): LogEntry[] {
	const merged = new Map<string, LogEntry>();
	for (const entry of summaries) {
		if (!filter || filter(entry)) merged.set(entry.id, entry);
	}
	for (const pending of pendingFinals) {
		if (pending.generation !== clearGeneration) continue;
		const summary = stripLogEntrySummary(pending.entry);
		if (!filter || filter(summary)) merged.set(summary.id, summary);
	}
	return Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp);
}

export function mergeSessionsWithPending(
	sessions: GameSession[],
	pendingFinals: Iterable<{ entry: LogEntry; generation: number }>,
	clearGeneration: number
): GameSession[] {
	const map = new Map<string, GameSession & { _latestTs?: number }>();
	for (const session of sessions) {
		map.set(session.gameId, { ...session });
	}
	for (const pending of pendingFinals) {
		if (pending.generation !== clearGeneration) continue;
		const entry = pending.entry;
		const gameId = entry.gameId || "game_unknown";
		const existing = map.get(gameId);
		if (!existing) {
			map.set(gameId, {
				gameId,
				createdAt: entry.timestamp,
				logCount: 1,
				successCount: entry.status === "success" ? 1 : 0,
				lastPlayerName: entry.playerName,
				_latestTs: entry.timestamp,
			});
			continue;
		}
		existing.createdAt = Math.min(existing.createdAt, entry.timestamp);
		existing.logCount++;
		if (entry.status === "success") existing.successCount++;
		if (existing._latestTs === undefined || entry.timestamp >= existing._latestTs) {
			existing._latestTs = entry.timestamp;
			existing.lastPlayerName = entry.playerName;
		}
	}
	return Array.from(map.values())
		.map(({ _latestTs: _, ...session }) => session)
		.sort((a, b) => b.createdAt - a.createdAt);
}

export class LLMLogMemoryCache {
	private readonly summariesByGame = new Map<string, Map<string, LogEntry>>();
	private readonly detailsById = new Map<string, LogEntry>();

	recordCompleted(entry: LogEntry): void {
		const gameId = entry.gameId || "game_unknown";
		this.setDetail({ ...entry, detailLoaded: true });
		const gameMap = this.summariesByGame.get(gameId);
		if (gameMap) {
			this.touchGame(gameId, gameMap);
			gameMap.set(entry.id, stripLogEntrySummary(entry));
		}
	}

	getGameSummaries(gameId: string): LogEntry[] | undefined {
		const gameMap = this.summariesByGame.get(gameId);
		if (!gameMap) return undefined;
		this.touchGame(gameId, gameMap);
		return Array.from(gameMap.values()).sort((a, b) => b.timestamp - a.timestamp);
	}

	setGameSummaries(gameId: string, entries: LogEntry[]): void {
		const gameMap = new Map<string, LogEntry>();
		for (const entry of entries) {
			const summary = entry.detailLoaded === false && !("request" in entry) ? entry : stripLogEntrySummary(entry);
			gameMap.set(summary.id, summary);
		}
		this.touchGame(gameId, gameMap);
		while (this.summariesByGame.size > MAX_CACHED_GAMES) {
			const oldestKey = this.summariesByGame.keys().next().value;
			if (oldestKey === undefined) break;
			this.summariesByGame.delete(oldestKey);
		}
	}

	getDetail(id: string): LogEntry | undefined {
		const detail = this.detailsById.get(id);
		if (!detail) return undefined;
		this.detailsById.delete(id);
		this.detailsById.set(id, detail);
		return detail;
	}

	setDetail(entry: LogEntry): void {
		if (this.detailsById.has(entry.id)) this.detailsById.delete(entry.id);
		this.detailsById.set(entry.id, { ...entry, detailLoaded: true });
		while (this.detailsById.size > MAX_CACHED_DETAILS) {
			const oldestKey = this.detailsById.keys().next().value;
			if (oldestKey === undefined) break;
			this.detailsById.delete(oldestKey);
		}
	}

	clear(): void {
		this.summariesByGame.clear();
		this.detailsById.clear();
	}

	async readGameSummaries(
		gameId: string,
		load: () => Promise<LogEntry[]>,
		pendingFinals: Iterable<{ entry: LogEntry; generation: number }>,
		clearGeneration: number,
		onError: (error: unknown) => void
	): Promise<LogEntry[]> {
		const filter = (e: LogEntry) => (e.gameId || "game_unknown") === gameId;
		const cached = this.getGameSummaries(gameId);
		if (cached) return mergeSummaryAndPending(cached, pendingFinals, clearGeneration, filter);
		try {
			const summaries = await load();
			this.setGameSummaries(gameId, summaries);
			return mergeSummaryAndPending(summaries, pendingFinals, clearGeneration, filter);
		} catch (error) {
			onError(error);
			return mergeSummaryAndPending([], pendingFinals, clearGeneration, filter);
		}
	}

	async readDetail(id: string, load: () => Promise<LogEntry | undefined>, onError: (error: unknown) => void): Promise<LogEntry | undefined> {
		const cached = this.getDetail(id);
		if (cached) return cached;
		try {
			const detail = await load();
			if (detail) this.setDetail(detail);
			return detail;
		} catch (error) {
			onError(error);
			return undefined;
		}
	}

	private touchGame(gameId: string, gameMap: Map<string, LogEntry>): void {
		if (this.summariesByGame.has(gameId)) this.summariesByGame.delete(gameId);
		this.summariesByGame.set(gameId, gameMap);
	}
}

export async function recoverInterruptedLogs(options: {
	store: LLMLogStore;
	lease: LLMLogLease;
	graceMs: number;
	legacyTimeoutMs: number;
	cloneEntry: (entry: LogEntry) => LogEntry;
	onError: (stage: string, error: unknown) => void;
	enqueueRecover: (task: () => Promise<void>) => void;
}): Promise<void> {
	const { store, lease, graceMs, legacyTimeoutMs, cloneEntry, onError, enqueueRecover } = options;
	let active;
	try {
		active = await store.listActive<LogEntry>();
	} catch (error) {
		onError("scan_active", error);
		return;
	}
	const owners = active.map(record => record.ownerId).filter(ownerId => ownerId !== lease.instanceId);
	const alive = await lease.confirmAlive(owners, 300);
	const now = Date.now();
	for (const record of active) {
		if (record.ownerId === lease.instanceId || alive.has(record.ownerId)) continue;
		let expired = false;
		try {
			expired = await store.isLeaseExpired(record.ownerId, now);
		} catch (error) {
			onError("check_lease", error);
			continue;
		}
		const deadline = typeof record.deadlineAt === "number" ? record.deadlineAt + graceMs : record.updatedAt + legacyTimeoutMs;
		if (!expired || now <= deadline) continue;
		const entry = cloneEntry({ ...record.entry, id: record.id, turns: (record.turns || record.entry.turns) as LogTurn[], status: "interrupted", fallbackReason: "page_reload_or_crash" });
		entry.durationMs = Math.max(entry.durationMs || 0, now - entry.timestamp);
		const snapshot: ActiveCheckpointSnapshot = { id: record.id, ownerId: record.ownerId, revision: record.revision, updatedAt: record.updatedAt };
		enqueueRecover(async () => {
			await store.recover(snapshot, entry);
		});
	}
}
