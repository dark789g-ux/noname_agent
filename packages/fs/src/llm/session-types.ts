import type { CliProvider, CliThinkingEffort } from "./cli-runner.js";

export interface SessionStreamUsage {
	inputTokens?: number;
	outputTokens?: number;
	thoughtTokens?: number;
	contextUsed?: number;
	contextSize?: number;
}

export interface SessionTurnRequest {
	sessionKey: string;
	gameId?: string;
	seatNum?: number;
	provider: CliProvider;
	command: string;
	model?: string;
	thinkingEffort?: CliThinkingEffort;
	extraArgs?: string;
	timeoutSec: number;
	reset: boolean;
	prompt: string;
	jsonSchema: Record<string, unknown>;
}

export interface SessionTurnCallbacks {
	signal?: AbortSignal;
	onFirstChunk?: () => void;
	onFirstToken?: () => void;
	onThoughtDelta?: (delta: string) => void;
	onThoughtSnapshot?: (text: string) => void;
	onTextDelta?: (delta: string) => void;
	onUsage?: (usage: SessionStreamUsage) => void;
	onSessionInfo?: (info: { sessionId?: string; rebuilt?: boolean }) => void;
}

export interface SessionTurnResult {
	rawOutput: unknown;
	reasoningContent?: string;
	usage?: SessionStreamUsage;
	sessionId?: string;
	rebuilt?: boolean;
}

export interface PersistentSessionAdapter {
	readonly provider: CliProvider;
	isAlive(): boolean;
	matchesConfig(req: SessionTurnRequest): boolean;
	runTurn(req: SessionTurnRequest, callbacks: SessionTurnCallbacks): Promise<SessionTurnResult>;
	dispose(): void;
}

export function sessionLostError(message = "常驻会话已丢失或进程已退出，需重建上下文"): Error {
	return Object.assign(new Error(message), {
		stage: "fetch" as const,
		code: "session_lost",
	});
}

export function mergeSessionUsage(
	prev: SessionStreamUsage | undefined,
	next: SessionStreamUsage | undefined
): SessionStreamUsage | undefined {
	if (!next) return prev;
	return {
		inputTokens: next.inputTokens ?? prev?.inputTokens,
		outputTokens: next.outputTokens ?? prev?.outputTokens,
		thoughtTokens: next.thoughtTokens ?? prev?.thoughtTokens,
		contextUsed: next.contextUsed ?? prev?.contextUsed,
		contextSize: next.contextSize ?? prev?.contextSize,
	};
}
