export type LogStatus = "success" | "fallback" | "error" | "timeout" | "interrupted";
export type ErrorStage = "config" | "fetch" | "parse" | "translate" | "translate/action-resolution";
export type RequestTransport = "stream" | "nonstream";
export type RequestOutcome = "pending" | "success" | "error";
export type StreamPhase = "idle" | "thinking" | "responding" | "tool_calling";

export interface StreamUsage {
	inputTokens?: number;
	outputTokens?: number;
	thoughtTokens?: number;
	contextUsed?: number;
	contextSize?: number;
}

export interface LogSessionMeta {
	mode: "full" | "incremental";
	rebuilt?: boolean;
	rebuildReason?: string;
	degraded?: boolean;
	degradeReason?: string;
	contextUsed?: number;
	contextSize?: number;
	addedEventsCount?: number;
	sessionKey?: string;
}

export interface StreamProgressPayload {
	logId: string;
	turnIndex: number;
	thought: string;
	text: string;
	phase: StreamPhase;
	thinkingStartedAt?: number;
	thinkingMs?: number;
	usage?: StreamUsage;
	ts: number;
}

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
	request?: { messages: any[]; tools: any[] };
	toolCall?: { id?: string; name: string; reason?: string; reasoningContent?: string; arguments: any };
	result?: any;
	error?: string;
	thinking?: string;
	thinkingMs?: number;
	usage?: StreamUsage;
	refLabels?: Record<string, string>;
	session?: LogSessionMeta;
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
	session?: LogSessionMeta;
	refLabels?: Record<string, string>;
	request?: { messages: any[]; tools: any[] };
	response?: { toolCall?: { name: string; reason?: string; reasoningContent?: string; arguments: any }; translatedResult?: any; execution?: "automatic" };
	error?: { stage: ErrorStage; message: string; httpStatus?: number };
	/** 多轮工具调用；缺省代表由旧版本写入的单轮日志。 */
	turns?: LogTurn[];
	/** 每轮的 provider 请求尝试；缺省代表旧版本或非遥测日志。 */
	requestTimings?: RequestTiming[];
	/** 标记当前对象是否已包含完整请求上下文（摘要查询返回 false）。 */
	detailLoaded?: boolean;
}

export interface ActiveLogSnapshot {
	entry: LogEntry;
	partialArgs: string;
	startedAt: number;
	stream?: StreamProgressPayload;
}

export interface GameSession {
	gameId: string;
	createdAt: number;
	logCount: number;
	successCount: number;
	lastPlayerName: string;
}
