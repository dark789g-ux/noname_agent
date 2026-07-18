import { lib, game } from "noname";

export type LogStatus = "success" | "fallback" | "error" | "timeout";
export type ErrorStage = "fetch" | "parse" | "translate";

export interface LogEntry {
	id: string;
	timestamp: number;
	decisionPoint: string; // "chooseToUse" | "chooseToRespond" | "chooseToDiscard" | "chooseBool"
	playerName: string;
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

const STORAGE_KEY = "llm_logs";
const BUFFER_LIMIT = 50;

class LLMLogger {
	private buffer: LogEntry[] = [];
	private activeLogs = new Map<string, { startTime: number; entry: LogEntry }>();

	start(decisionPoint: string, playerName: string, meta: LogEntry["meta"]): string {
		const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		const entry: LogEntry = {
			id,
			timestamp: Date.now(),
			decisionPoint,
			playerName,
			durationMs: 0,
			status: "success",
			meta,
		};
		this.activeLogs.set(id, { startTime: Date.now(), entry });
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
	}

	endFallback(id: string, reason: string): void {
		const entry = this.getActive(id);
		if (entry) entry.fallbackReason = reason;
		this.end(id, "fallback");
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
}

export const llmLogger = new LLMLogger();
