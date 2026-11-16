import type { CliProvider } from "./cli-runner.js";
import { AcpSessionAdapter } from "./acp-adapter.js";
import { CodexAppSessionAdapter } from "./codex-app-adapter.js";
import {
	sessionLostError,
	type PersistentSessionAdapter,
	type SessionTurnCallbacks,
	type SessionTurnRequest,
	type SessionTurnResult,
} from "./session-types.js";

const DEFAULT_IDLE_TTL_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

export type AdapterFactory = (req: SessionTurnRequest) => PersistentSessionAdapter;

interface SessionRecord {
	key: string;
	gameId: string;
	adapter: PersistentSessionAdapter;
	lastUsedAt: number;
	queue: Promise<void>;
}

function defaultAdapterFactory(req: SessionTurnRequest): PersistentSessionAdapter {
	if (req.provider === "agy") return new AcpSessionAdapter(req);
	if (req.provider === "codex") return new CodexAppSessionAdapter(req);
	throw Object.assign(new Error(`暂不支持该 provider 的常驻会话: ${req.provider}`), {
		stage: "config" as const,
	});
}

export interface LlmSessionHostOptions {
	idleTtlMs?: number;
	createAdapter?: AdapterFactory;
}

export class LlmSessionHost {
	private readonly sessions = new Map<string, SessionRecord>();
	private readonly idleTtlMs: number;
	private readonly createAdapter: AdapterFactory;
	private cleanupTimer: ReturnType<typeof setInterval> | null = null;

	constructor(options: LlmSessionHostOptions = {}) {
		this.idleTtlMs = options.idleTtlMs ?? DEFAULT_IDLE_TTL_MS;
		this.createAdapter = options.createAdapter ?? defaultAdapterFactory;
		this.cleanupTimer = setInterval(() => this.pruneExpired(), CLEANUP_INTERVAL_MS);
		this.cleanupTimer.unref?.();
	}

	async runTurn(req: SessionTurnRequest, callbacks: SessionTurnCallbacks): Promise<SessionTurnResult> {
		let record = this.sessions.get(req.sessionKey);

		if (record && !record.adapter.matchesConfig(req)) {
			if (!req.reset) {
				this.deleteSession(req.sessionKey);
				throw sessionLostError("会话后端配置已变更，需重建全量上下文");
			}
			this.deleteSession(req.sessionKey);
			record = undefined;
		}

		if (record && !record.adapter.isAlive() && !req.reset) {
			this.deleteSession(req.sessionKey);
			throw sessionLostError("常驻会话进程已退出，需重建全量上下文");
		}

		if (!record) {
			if (!req.reset) {
				throw sessionLostError("未找到对应的常驻会话，需重建全量上下文");
			}
			record = {
				key: req.sessionKey,
				gameId: req.gameId || "",
				adapter: this.createAdapter(req),
				lastUsedAt: Date.now(),
				queue: Promise.resolve(),
			};
			this.sessions.set(req.sessionKey, record);
		}

		record.lastUsedAt = Date.now();
		if (req.gameId) record.gameId = req.gameId;

		const run = async (): Promise<SessionTurnResult> => {
			if (this.sessions.get(req.sessionKey) !== record) {
				throw sessionLostError("会话已被重置或清理");
			}
			if (req.reset && !record.adapter.isAlive()) {
				// 允许首次尚未启动的 adapter 执行 reset=true 初始化
			}
			try {
				return await record.adapter.runTurn(req, callbacks);
			} catch (err) {
				if (!record.adapter.isAlive()) {
					this.deleteSession(req.sessionKey);
				}
				throw err;
			} finally {
				record.lastUsedAt = Date.now();
			}
		};

		const resultPromise = record.queue.then(run, run);
		record.queue = resultPromise.then(
			() => undefined,
			() => undefined
		);
		return await resultPromise;
	}

	deleteSession(sessionKey: string): boolean {
		const record = this.sessions.get(sessionKey);
		if (!record) return false;
		this.sessions.delete(sessionKey);
		record.adapter.dispose();
		return true;
	}

	resetGame(gameId?: string): number {
		let removed = 0;
		for (const [key, record] of Array.from(this.sessions.entries())) {
			if (!gameId || record.gameId === gameId || key.startsWith(`${gameId}:`)) {
				this.sessions.delete(key);
				record.adapter.dispose();
				removed++;
			}
		}
		return removed;
	}

	listSessionKeys(): string[] {
		return Array.from(this.sessions.keys());
	}

	dispose(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}
		this.resetGame();
	}

	private pruneExpired(): void {
		const cutoff = Date.now() - this.idleTtlMs;
		for (const [key, record] of Array.from(this.sessions.entries())) {
			if (record.lastUsedAt < cutoff || !record.adapter.isAlive()) {
				this.sessions.delete(key);
				record.adapter.dispose();
			}
		}
	}
}

export function isSupportedSessionProvider(provider: CliProvider): boolean {
	return provider === "agy" || provider === "codex";
}
