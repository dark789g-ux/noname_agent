export type LogStatus = "success" | "fallback" | "error" | "timeout" | "interrupted";
export type ErrorStage = "config" | "fetch" | "parse" | "translate" | "translate/action-resolution";
export type RequestTransport = "stream" | "nonstream";
export type RequestOutcome = "pending" | "success" | "error";

/** 单次 provider 请求的时序；startedAtOffsetMs 相对日志开始，其余时长相对本次请求开始。 */
export interface RequestTiming {
	turnIndex: number;
	attemptIndex: number;
	transport: RequestTransport;
	startedAtOffsetMs: number;
	firstChunkMs?: number;
	ttftMs?: number;
	responseMs?: number;
	outcome: RequestOutcome;
	errorStage?: ErrorStage;
}

export interface LogTurn {
	index: number;
	stage?: string;
	request: { messages: any[]; tools: any[] };
	toolCall?: { id?: string; name: string; reason?: string; reasoningContent?: string; arguments: any };
	result?: any;
	error?: string;
}

export interface LogEntry {
	[key: string]: unknown;
	id: string;
	gameId: string;
	timestamp: number;
	decisionPoint: string;
	playerName: string;
	playerSeatNum?: number;
	durationMs: number;
	status: LogStatus;
	fallbackReason?: string;
	meta: { enabled: boolean; configured: boolean; model?: string; backend?: string; providerLabel?: string; traceId?: string; skill?: string };
	request?: { messages: any[]; tools: any[] };
	response?: { toolCall?: { name: string; reason?: string; reasoningContent?: string; arguments: any }; translatedResult?: any; execution?: "automatic" };
	error?: { stage: ErrorStage; message: string; httpStatus?: number };
	/** 多轮工具调用；缺省代表由旧版本写入的单轮日志。 */
	turns?: LogTurn[];
	/** 每轮的 provider 请求尝试；缺省代表旧版本或非遥测日志。 */
	requestTimings?: RequestTiming[];
}

export interface ActiveLogSnapshot {
	entry: LogEntry;
	partialArgs: string;
	startedAt: number;
}

export interface GameSession {
	gameId: string;
	createdAt: number;
	logCount: number;
	successCount: number;
	lastPlayerName: string;
}
