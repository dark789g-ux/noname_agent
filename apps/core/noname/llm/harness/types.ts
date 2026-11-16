import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions.js";
import type { ResolvedBackend } from "../backends.js";
import type { StreamProgressUpdate, ToolCallResult } from "../client.js";
import type { LogSessionMeta, StreamUsage } from "../logger-types.js";
import type { PromptFacts } from "../prompt-facts.js";
import type { EventWindow } from "../prompt-history.js";

export interface PlannerState {
	initialized: boolean;
	profileHashes: Record<number, string>;
}

export interface PromptPlanResult {
	mode: "full" | "incremental";
	rebuilt: boolean;
	rebuildReason?: string;
	systemMessage?: string;
	userMessage: string;
	addedEventsCount: number;
	nextEventSeq: number;
	profileHashes: Record<number, string>;
	changedProfileSeats: number[];
}

export interface PlanPromptOptions {
	eventWindow: EventWindow;
	rebuildReason?: string;
	stageInstruction?: string;
	allowedToolNames?: readonly string[];
}

export interface TransportCallbacks {
	onAttemptStart?: (attemptIndex: number, transport: "stream" | "nonstream") => void;
	onAttemptFinish?: (attemptIndex: number, outcome: "success" | "error", errorStage?: string) => void;
	onFirstChunk?: () => void;
	onFirstToken?: () => void;
	onStreamProgress?: (progress: StreamProgressUpdate) => void;
	onChunk?: (partialArgs: string) => void;
	onUsage?: (usage: StreamUsage) => void;
}

export interface TransportTurnInput {
	sessionKey: string;
	gameId: string;
	seatNum: number;
	backend: ResolvedBackend;
	tools: ChatCompletionTool[];
	/** 完整对话历史（供无状态通道或远端重建时使用）。 */
	fullTranscript: ChatCompletionMessageParam[];
	/** 本次未同步给有状态远端的新增消息切片。 */
	deltaMessages: ChatCompletionMessageParam[];
	/** 是否要求有状态远端重置/新建会话。 */
	resetRemoteSession: boolean;
	/** true 表示允许流式请求。 */
	allowStream: boolean;
	deadline: number;
}

export interface TransportTurnResult {
	toolCall: ToolCallResult;
	usage?: StreamUsage;
	transport: "stream" | "nonstream";
	degraded?: boolean;
	degradeReason?: string;
	remoteSessionLost?: boolean;
	/** true 表示已将 deltaMessages 同步到有状态远端。 */
	syncedRemote: boolean;
}

export interface SeatTransport {
	readonly stateful: boolean;
	sendTurn(input: TransportTurnInput, callbacks?: TransportCallbacks): Promise<TransportTurnResult>;
	resetSession?(sessionKey: string): Promise<void>;
}

export type SessionDecisionMeta = LogSessionMeta;

export type { PromptFacts };
