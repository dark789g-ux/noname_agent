export type LogStatus = "success" | "fallback" | "error" | "timeout" | "interrupted";
export type ErrorStage = "fetch" | "parse" | "translate";

export interface LogTurn {
	index: number;
	stage?: string;
	request: { messages: any[]; tools: any[] };
	toolCall?: { id?: string; name: string; reason?: string; arguments: any };
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
	meta: { enabled: boolean; configured: boolean; model?: string };
	request?: { messages: any[]; tools: any[] };
	response?: { toolCall?: { name: string; reason?: string; arguments: any }; translatedResult?: any };
	error?: { stage: ErrorStage; message: string; httpStatus?: number };
	/** 多轮工具调用；缺省代表由旧版本写入的单轮日志。 */
	turns?: LogTurn[];
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
