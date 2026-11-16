import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions.js";
import type { ResolvedBackend } from "../backends.js";
import type { LogSessionMeta, StreamUsage } from "../logger-types.js";
import type { PromptFacts } from "../prompt-facts.js";
import type { EventWindow } from "../prompt-history.js";
import { assistantToolMessage, type ToolCallLike } from "../protocol.js";
import {
	DEFAULT_CONTEXT_WINDOW_FALLBACK,
	estimateMessagesTokens,
	estimateTextTokens,
	type SeatSession,
} from "./seat-session.js";
import { seatSessionRegistry } from "./session-registry.js";
import { OpenAITransport } from "./transports/openai.js";
import { notifyRemoteResetGame, RemoteSessionTransport } from "./transports/remote-session.js";
import type { PromptPlanResult, SeatTransport, TransportCallbacks, TransportTurnResult } from "./types.js";

const openaiTransport = new OpenAITransport();
const remoteSessionTransport = new RemoteSessionTransport();

export function buildBackendFingerprint(backend: ResolvedBackend): string {
	return [
		backend.kind,
		backend.model || "",
		backend.url || "",
		backend.command || "",
		backend.thinkingEffort || "",
	].join("|");
}

export function selectTransport(backend: ResolvedBackend): SeatTransport {
	if (backend.kind === "agy" || backend.kind === "codex") {
		return remoteSessionTransport;
	}
	return openaiTransport;
}

export interface HarnessLoggerAdapter {
	logSessionMeta(id: string, session: LogSessionMeta): void;
	logRefLabels(id: string, refLabels: Record<string, string>): void;
	logRequest(id: string, messages: any[], tools: any[]): void;
	startRequestAttempt(id: string, turnIndex: number, attemptIndex: number, transport: "stream" | "nonstream"): void;
	markRequestFirstChunk(id: string, turnIndex: number, attemptIndex: number): void;
	markRequestTTFT(id: string, turnIndex: number, attemptIndex: number): void;
	finishRequestAttempt(id: string, turnIndex: number, attemptIndex: number, outcome: "success" | "error", errorStage?: any): void;
	logStreamProgress(id: string, progress: { turnIndex: number; thought: string; text: string; phase: any; thinkingStartedAt?: number; thinkingMs?: number; usage?: StreamUsage }): void;
}

export interface HarnessTurnRunner {
	readonly session: SeatSession;
	readonly sessionMeta: LogSessionMeta;
	readonly plan: PromptPlanResult;
	sendTurn(tools: ChatCompletionTool[], turnIndex: number, allowStream: boolean): Promise<TransportTurnResult>;
	appendInteraction(toolCall: ToolCallLike, toolResultPayload: unknown, followUpUserContent: string): void;
	commit(finalToolCall: ToolCallLike): void;
	rollback(errorStage?: string): void;
	getLastThinkingStats(): { thinking?: string; thinkingMs?: number; usage?: StreamUsage };
	getTurnRequestMessages(): ChatCompletionMessageParam[];
}

export function createHarnessDecisionRunner(params: {
	gameId: string;
	seatNum: number;
	logId: string;
	backend: ResolvedBackend;
	facts: PromptFacts;
	eventWindow: EventWindow;
	stageInstruction?: string;
	allowedToolNames?: readonly string[];
	deadline: number;
	logger: HarnessLoggerAdapter;
}): HarnessTurnRunner {
	const fingerprint = buildBackendFingerprint(params.backend);
	const session = seatSessionRegistry.getOrCreate(params.gameId, params.seatNum, fingerprint);
	const defaultContextSize =
		params.backend.contextSize ??
		(params.backend.kind === "openai" ? DEFAULT_CONTEXT_WINDOW_FALLBACK : undefined);
	if (defaultContextSize !== undefined) {
		session.configuredContextSize = defaultContextSize;
	}
	const transport = selectTransport(params.backend);
	const { plan, deltaMessages, resetRemoteSession } = session.beginDecision(params.facts, params.eventWindow, {
		stageInstruction: params.stageInstruction,
		allowedToolNames: params.allowedToolNames,
	});

	const withDefaultContextSize = (usage: StreamUsage | undefined): StreamUsage | undefined => {
		if (!usage) return undefined;
		if (usage.contextSize !== undefined || defaultContextSize === undefined) return usage;
		return { ...usage, contextSize: defaultContextSize };
	};

	const previousContextUsed = session.lastUsage?.contextUsed;
	const initialBaseContextUsed =
		plan.mode === "incremental" && previousContextUsed && previousContextUsed > 0
			? previousContextUsed + estimateMessagesTokens(deltaMessages)
			: estimateMessagesTokens(session.transcript);
	const initialContextSize = session.lastUsage?.contextSize ?? defaultContextSize;
	const isOpenAIBackend = params.backend.kind === "openai";

	let latestUsage: StreamUsage | undefined = isOpenAIBackend
		? {
				...(session.lastUsage || {}),
				contextUsed: initialBaseContextUsed,
				contextSize: initialContextSize,
			}
		: withDefaultContextSize(session.lastUsage);
	let extraTurnTokens = 0;
	let latestThought = "";
	let thinkingStartedAt: number | undefined;
	let thinkingMs: number | undefined;
	let degraded = false;
	let degradeReason: string | undefined;
	let remoteSessionLost = false;
	let syncedRemote = false;
	let remoteTurnStarted = false;
	let needRemoteResetForNextTurn = resetRemoteSession;

	const sessionMeta: LogSessionMeta = {
		mode: plan.mode,
		...(plan.rebuilt ? { rebuilt: true, rebuildReason: plan.rebuildReason } : {}),
		addedEventsCount: plan.addedEventsCount,
		contextUsed: latestUsage?.contextUsed,
		contextSize: latestUsage?.contextSize,
		sessionKey: session.sessionKey,
	};

	params.logger.logRefLabels(params.logId, params.facts.refLabels);
	params.logger.logSessionMeta(params.logId, sessionMeta);

	const updateSessionMeta = () => {
		Object.assign(sessionMeta, {
			degraded: degraded || undefined,
			degradeReason: degradeReason || undefined,
			contextUsed: latestUsage?.contextUsed ?? sessionMeta.contextUsed,
			contextSize: latestUsage?.contextSize ?? sessionMeta.contextSize,
		});
		params.logger.logSessionMeta(params.logId, { ...sessionMeta });
	};

	return {
		session,
		sessionMeta,
		plan,
		getTurnRequestMessages() {
			return session.getUnsentMessages().slice();
		},
		getLastThinkingStats() {
			return {
				thinking: latestThought || undefined,
				thinkingMs,
				usage: latestUsage,
			};
		},
		async sendTurn(tools: ChatCompletionTool[], turnIndex: number, allowStream: boolean): Promise<TransportTurnResult> {
			latestThought = "";
			thinkingStartedAt = undefined;
			thinkingMs = undefined;
			let hasTurnRealUsage = false;
			const turnBaseContextUsed =
				turnIndex === 0
					? initialBaseContextUsed
					: latestUsage?.contextUsed && latestUsage.contextUsed > 0
						? latestUsage.contextUsed + extraTurnTokens
						: estimateMessagesTokens(session.transcript);
			extraTurnTokens = 0;
			let lastEstimatedContextUsed = turnBaseContextUsed;
			let currentAttemptIndex = 0;
			let managedAttempts = false;
			params.logger.logRequest(params.logId, session.transcript.slice(), tools);

			const callbacks: TransportCallbacks = {
				onAttemptStart: (attemptIndex, transportKind) => {
					managedAttempts = true;
					currentAttemptIndex = attemptIndex;
					params.logger.startRequestAttempt(params.logId, turnIndex, attemptIndex, transportKind);
				},
				onAttemptFinish: (attemptIndex, outcome, errorStage) => {
					params.logger.finishRequestAttempt(params.logId, turnIndex, attemptIndex, outcome, errorStage);
				},
				onFirstChunk: () => params.logger.markRequestFirstChunk(params.logId, turnIndex, currentAttemptIndex),
				onFirstToken: () => params.logger.markRequestTTFT(params.logId, turnIndex, currentAttemptIndex),
				onUsage: usage => {
					hasTurnRealUsage = true;
					latestUsage = withDefaultContextSize(usage);
					updateSessionMeta();
				},
				onStreamProgress: progress => {
					const now = Date.now();
					if (progress.thought) {
						if (thinkingStartedAt === undefined) thinkingStartedAt = now;
						latestThought = progress.thought;
						if (progress.phase === "thinking") {
							thinkingMs = now - thinkingStartedAt;
						} else if (thinkingMs === undefined) {
							thinkingMs = now - thinkingStartedAt;
						}
					}
					if (progress.usage) {
						hasTurnRealUsage = true;
						latestUsage = withDefaultContextSize(progress.usage);
						updateSessionMeta();
					} else if (!hasTurnRealUsage && isOpenAIBackend) {
						const estimatedUsed = turnBaseContextUsed + estimateTextTokens((progress.thought || "") + (progress.text || ""));
						latestUsage = {
							...(latestUsage || {}),
							contextUsed: estimatedUsed,
							contextSize: latestUsage?.contextSize ?? defaultContextSize,
						};
						if (estimatedUsed !== lastEstimatedContextUsed) {
							lastEstimatedContextUsed = estimatedUsed;
							updateSessionMeta();
						}
					}
					params.logger.logStreamProgress(params.logId, {
						turnIndex,
						thought: progress.thought,
						text: progress.text,
						phase: progress.phase,
						thinkingStartedAt,
						thinkingMs,
						usage: latestUsage,
					});
				},
			};

			if (transport.stateful) remoteTurnStarted = true;
			try {
				const sendInput = {
					sessionKey: session.sessionKey,
					gameId: params.gameId,
					seatNum: params.seatNum,
					backend: params.backend,
					tools,
					fullTranscript: session.transcript.slice(),
					deltaMessages: session.getUnsentMessages(),
					resetRemoteSession: needRemoteResetForNextTurn,
					allowStream,
					deadline: params.deadline,
				};
				if (transport.stateful) {
					params.logger.startRequestAttempt(params.logId, turnIndex, 0, "stream");
				}
				const result = await transport.sendTurn(sendInput, callbacks);
				needRemoteResetForNextTurn = false;
				if (result.toolCall.reasoningContent && !latestThought) {
					latestThought = result.toolCall.reasoningContent;
				}
				if (thinkingStartedAt !== undefined && thinkingMs === undefined) {
					thinkingMs = Date.now() - thinkingStartedAt;
				}
				if (result.usage) {
					hasTurnRealUsage = true;
					latestUsage = withDefaultContextSize(result.usage);
				}
				if (result.degraded) {
					degraded = true;
					degradeReason = result.degradeReason;
				}
				if (result.remoteSessionLost) remoteSessionLost = true;
				if (result.syncedRemote) {
					syncedRemote = true;
					session.markRemoteSynced();
				}
				updateSessionMeta();
				if (!managedAttempts) {
					params.logger.finishRequestAttempt(params.logId, turnIndex, currentAttemptIndex, "success");
				}
				return result;
			} catch (error: any) {
				if (!managedAttempts) {
					params.logger.finishRequestAttempt(params.logId, turnIndex, currentAttemptIndex, "error", error?.stage);
				}
				throw error;
			}
		},
		appendInteraction(toolCall: ToolCallLike, toolResultPayload: unknown, followUpUserContent: string): void {
			const addedMessages: ChatCompletionMessageParam[] = [
				assistantToolMessage(toolCall) as ChatCompletionMessageParam,
				{ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(toolResultPayload) },
				{ role: "user", content: followUpUserContent },
			];
			extraTurnTokens += estimateMessagesTokens(addedMessages);
			session.appendTurnMessages(addedMessages);
		},
		commit(finalToolCall: ToolCallLike): void {
			session.commitDecision(finalToolCall, {
				usage: latestUsage,
				remoteSessionLost,
				syncedRemote,
			});
		},
		rollback(errorStage?: string): void {
			session.rollbackDecision(errorStage, remoteTurnStarted && !degraded);
		},
	};
}

export function resetAllHarnessSessions(gameId?: string): void {
	seatSessionRegistry.resetGame(gameId);
	void notifyRemoteResetGame(gameId);
}
