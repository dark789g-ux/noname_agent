import { lib, game, _status } from "noname";

export type LogStatus = "success" | "fallback" | "error" | "timeout";
export type ErrorStage = "fetch" | "parse" | "translate";

export interface LogEntry {
	id: string;
	gameId: string;
	timestamp: number;
	decisionPoint: string; // "chooseToUse" | "chooseToRespond" | "chooseToDiscard" | "chooseBool"
		playerName: string;
		playerSeatNum?: number;
		durationMs: number;
	status: LogStatus;
	fallbackReason?: string;
	meta: {
		enabled: boolean;
		configured: boolean;
		model?: string;
	};
	request?: {
		messages: any[];
		tools: any[];
	};
	response?: {
		toolCall?: { name: string; arguments: any };
		translatedResult?: any;
	};
	error?: {
		stage: ErrorStage;
		message: string;
		httpStatus?: number;
	};
}

export interface GameSession {
	gameId: string;
	createdAt: number;
	logCount: number;
	successCount: number;
	lastPlayerName: string;
}

const STORAGE_KEY = "llm_logs";
const BUFFER_LIMIT = 50;

class LLMLogger {
	private buffer: LogEntry[] = [];
	private activeLogs = new Map<string, { startTime: number; entry: LogEntry }>();

	start(decisionPoint: string, playerName: string, meta: LogEntry["meta"], seatNum?: number): string {
			const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
			const gameId = (_status as { llmGameId?: string }).llmGameId || "game_unknown";
			const entry: LogEntry = {
				id,
				gameId,
				timestamp: Date.now(),
				decisionPoint,
				playerName,
				playerSeatNum: seatNum,
				durationMs: 0,
				status: "success",
				meta,
			};
			this.activeLogs.set(id, { startTime: Date.now(), entry });
			// 通知订阅者新的 LLM 调用开始（用于 UI 实时面板）
			try {
				if (typeof lib !== "undefined" && lib.announce) {
					lib.announce.publish("llm_log_start", entry);
				}
			} catch (_e) {
				// publish 失败不影响主流程
			}
			return id;
		}

	private getActive(id: string): LogEntry | undefined {
		return this.activeLogs.get(id)?.entry;
	}

	logRequest(id: string, messages: any[], tools: any[]): void {
		const entry = this.getActive(id);
		if (entry) entry.request = { messages, tools };
	}

	logResponse(id: string, toolCall: { name: string; arguments: any }, translatedResult?: any): void {
		const entry = this.getActive(id);
		if (entry) entry.response = { toolCall, translatedResult };
	}

	logError(id: string, stage: ErrorStage, message: string, httpStatus?: number): void {
		const entry = this.getActive(id);
		if (entry) entry.error = { stage, message, httpStatus };
	}

	end(id: string, status: LogStatus): void {
		const active = this.activeLogs.get(id);
		if (!active) return;
		const entry = active.entry;
		entry.durationMs = Date.now() - active.startTime;
		entry.status = status;
		this.buffer.push(entry);
		this.activeLogs.delete(id);
		if (lib.config.dev) {
			// @ts-expect-error console 在引擎上下文可用
			console.log(`[LLM] ${entry.decisionPoint} ${entry.status} ${entry.durationMs}ms`, entry);
		}
		if (this.buffer.length >= BUFFER_LIMIT) {
			this.flush().catch(() => {});
		}
		// 通知订阅者 LLM 调用结束（用于 UI 实时面板把"进行中"折叠到历史）
		try {
			if (typeof lib !== "undefined" && lib.announce) {
				lib.announce.publish("llm_log_end", entry);
			}
		} catch (_e) {
			// publish 失败不影响主流程
		}
	}

	endFallback(id: string, reason: string): void {
		const entry = this.getActive(id);
		if (entry) entry.fallbackReason = reason;
		this.end(id, "fallback");
	}

	/**
	 * 推送流式 chunk 事件。供 client.ts 在 SSE 流式调用时逐 chunk 调用，
	 * UI 面板订阅 "llm_log_chunk" 事件实现"逐字出现"的视觉效果。
	 *
	 * 注意：本方法不写 IndexedDB，仅发布事件。完整 entry 仍由 end() 写入。
	 */
	logStreamChunk(logId: string, partialArgs: string): void {
		try {
			if (typeof lib !== "undefined" && lib.announce) {
				lib.announce.publish("llm_log_chunk", { logId, partialArgs, ts: Date.now() });
			}
		} catch (_e) {
			// publish 失败不影响主流程
		}
	}

	async flush(): Promise<void> {
		if (this.buffer.length === 0) return;
		const toFlush = this.buffer;
		this.buffer = [];
		try {
			const existing = (await game.getDB("data", STORAGE_KEY)) || [];
			const merged = [...existing, ...toFlush];
			const trimmed = merged.slice(-500);
			await game.putDB("data", STORAGE_KEY, trimmed);
		} catch (e) {
			this.buffer.unshift(...toFlush);
			if (lib.config.dev) {
				// @ts-expect-error console
				console.warn("[LLM] flush failed:", e);
			}
		}
	}

	async getLogs(): Promise<LogEntry[]> {
		await this.flush();
		return ((await game.getDB("data", STORAGE_KEY)) || []) as LogEntry[];
	}

	async clearLogs(): Promise<void> {
		this.buffer = [];
		await game.deleteDB("data", STORAGE_KEY);
	}

	async getGameSessions(): Promise<GameSession[]> {
		await this.flush();
		const all = ((await game.getDB("data", STORAGE_KEY)) || []) as LogEntry[];
		const map = new Map<string, GameSession>();
		for (const e of all) {
			const g = e.gameId || "game_unknown";
			if (!map.has(g)) {
				map.set(g, {
					gameId: g,
					createdAt: e.timestamp,
					logCount: 1,
					successCount: e.status === "success" ? 1 : 0,
					lastPlayerName: e.playerName,
				});
			} else {
				const s = map.get(g)!;
				s.createdAt = Math.min(s.createdAt, e.timestamp);
				s.logCount++;
				if (e.status === "success") s.successCount++;
				s.lastPlayerName = e.playerName;
			}
		}
		return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
	}

	async getLogsByGame(gameId: string): Promise<LogEntry[]> {
			await this.flush();
			const all = ((await game.getDB("data", STORAGE_KEY)) || []) as LogEntry[];
			return all
				.filter(e => (e.gameId || "game_unknown") === gameId)
				.sort((a, b) => b.timestamp - a.timestamp);
		}

	/**
	 * 按 gameId + 玩家过滤日志。
	 * - seatNum 优先：传入时按 seatNum 严格过滤（彻底解决双关羽局同名冲突）
	 * - seatNum 缺省：降级按 playerName 过滤（向后兼容旧日志，可能误匹配同名武将）
	 */
	async getLogsByGameAndPlayer(gameId: string, playerName: string, seatNum?: number): Promise<LogEntry[]> {
		const logs = await this.getLogsByGame(gameId);
		if (seatNum !== undefined) {
			return logs.filter(e => e.playerSeatNum === seatNum);
		}
		return logs.filter(e => e.playerName === playerName);
	}

	/**
	 * 旧数据迁移：如果检测到无 gameId 字段的日志，清空所有旧日志。
	 * 幂等——已迁移/无数据时不操作。由 LLM 模块初始化时调用一次。
	 */
	async migrateIfNeeded(): Promise<void> {
		const all = ((await game.getDB("data", STORAGE_KEY)) || []) as LogEntry[];
		if (all.length === 0) return;
		const hasOld = all.some(e => typeof e.gameId !== "string");
		if (hasOld) {
			await this.clearLogs();
		}
	}
}

export const llmLogger = new LLMLogger();
