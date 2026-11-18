import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import type { StreamUsage } from "../logger-types.js";
import type { PromptFacts } from "../prompt-facts.js";
import type { EventWindow } from "../prompt-history.js";
import { assistantToolMessage, type ToolCallLike } from "../protocol.js";
import { planPrompt } from "./prompt-planner.js";
import type { PlannerState, PromptPlanResult } from "./types.js";

export const DEFAULT_REBUILD_CONTEXT_RATIO = 0.5;
export const DEFAULT_REBUILD_MAX_TOKENS = 120_000;
export const DEFAULT_CONTEXT_WINDOW_FALLBACK = 128_000;

interface DecisionCheckpoint {
	transcriptLength: number;
	sentCursor: number;
	lastEventSeq: number;
	profileHashes: Record<number, string>;
	initialized: boolean;
}

/** 估算纯文本的粗略 token 占用（混合中英文按约 2.2 字符/token）。 */
export function estimateTextTokens(text: string): number {
	return text ? Math.ceil(text.length / 2.2) : 0;
}

/** 估算消息数组的粗略 token 占用（混合中英文按约 2.2 字符/token）。 */
export function estimateMessagesTokens(messages: readonly ChatCompletionMessageParam[]): number {
	let chars = 0;
	for (const msg of messages) {
		if (typeof msg.content === "string") chars += msg.content.length;
		else if (Array.isArray(msg.content)) chars += JSON.stringify(msg.content).length;
		const calls = (msg as any).tool_calls;
		if (Array.isArray(calls)) chars += JSON.stringify(calls).length;
	}
	return Math.ceil(chars / 2.2);
}

/** 计算给定上下文窗口下的重建阈值。 */
export function computeRebuildThreshold(contextSize?: number): number {
	const windowSize = contextSize && contextSize > 0 ? contextSize : DEFAULT_CONTEXT_WINDOW_FALLBACK;
	return Math.min(Math.floor(windowSize * DEFAULT_REBUILD_CONTEXT_RATIO), DEFAULT_REBUILD_MAX_TOKENS);
}

/** 剥离 assistant 消息中的 reasoning_content，防止跨决策回传被部分 OpenAI 兼容服务拒收。 */
export function stripAssistantReasoning(message: ChatCompletionMessageParam): ChatCompletionMessageParam {
	if (message.role !== "assistant" || !("reasoning_content" in (message as any))) return message;
	const copy: Record<string, any> = { ...message };
	delete copy.reasoning_content;
	return copy as ChatCompletionMessageParam;
}

/** 管理单个座位的长会话状态、transcript、已发送游标、预算评估与事务回滚。 */
export class SeatSession {
	readonly sessionKey: string;
	backendFingerprint: string;
	initialized = false;
	transcript: ChatCompletionMessageParam[] = [];
	sentCursor = 0;
	lastEventSeq = 0;
	profileHashes: Record<number, string> = {};
	lastUsage?: StreamUsage;
	configuredContextSize?: number;
	consecutiveParseFailures = 0;
	needsRebuildReason?: string;
	private activeCheckpoint: DecisionCheckpoint | null = null;
	private activePlan: PromptPlanResult | null = null;

	constructor(sessionKey: string, backendFingerprint: string) {
		this.sessionKey = sessionKey;
		this.backendFingerprint = backendFingerprint;
	}

	/** 后端或模型变更时标记需要重建会话。 */
	syncBackendFingerprint(fingerprint: string): void {
		if (this.backendFingerprint !== fingerprint) {
			this.backendFingerprint = fingerprint;
			if (this.initialized) this.needsRebuildReason = "backend_changed";
		}
	}

	/** 评估是否需要因预算超限重建会话。 */
	evaluateRebuildReason(): string | undefined {
		if (!this.initialized) return undefined;
		if (this.needsRebuildReason) return this.needsRebuildReason;
		const threshold = computeRebuildThreshold(this.lastUsage?.contextSize ?? this.configuredContextSize);
		const used =
			this.lastUsage?.contextUsed && this.lastUsage.contextUsed > 0
				? this.lastUsage.contextUsed
				: estimateMessagesTokens(this.transcript);
		if (used >= threshold) return "context_budget_exceeded";
		return undefined;
	}

	/** 为一次新决策生成 Prompt 计划并建立回滚检查点。 */
	beginDecision(
		facts: PromptFacts,
		eventWindow: EventWindow,
		options: { stageInstruction?: string; allowedToolNames?: readonly string[] } = {}
	): { plan: PromptPlanResult; deltaMessages: ChatCompletionMessageParam[]; resetRemoteSession: boolean } {
		const rebuildReason = this.evaluateRebuildReason();
		const plannerState: PlannerState = {
			initialized: this.initialized,
			profileHashes: { ...this.profileHashes },
		};
		const plan = planPrompt(facts, plannerState, {
			eventWindow,
			rebuildReason,
			stageInstruction: options.stageInstruction,
			allowedToolNames: options.allowedToolNames,
		});

		this.activeCheckpoint = {
			transcriptLength: this.transcript.length,
			sentCursor: this.sentCursor,
			lastEventSeq: this.lastEventSeq,
			profileHashes: { ...this.profileHashes },
			initialized: this.initialized,
		};
		this.activePlan = plan;

		const isFull = plan.mode === "full";
		if (isFull) {
			this.transcript = [
				{ role: "system", content: plan.systemMessage || "" },
				{ role: "user", content: plan.userMessage },
			];
			this.sentCursor = 0;
		} else {
			this.transcript.push({ role: "user", content: plan.userMessage });
		}

		return {
			plan,
			deltaMessages: this.transcript.slice(this.sentCursor),
			resetRemoteSession: isFull,
		};
	}

	/** 返回当前尚未同步到有状态远端的增量消息。 */
	getUnsentMessages(): ChatCompletionMessageParam[] {
		return this.transcript.slice(this.sentCursor);
	}

	/** 在单次决策的多轮交互中追加 assistant tool_call 与后续 tool/user 消息。 */
	appendTurnMessages(messages: ChatCompletionMessageParam[]): void {
		this.transcript.push(...messages);
	}

	/** 记录远端已消费到当前 transcript 末尾（但仍允许决策失败时整段回滚）。 */
	markRemoteSynced(): void {
		this.sentCursor = this.transcript.length;
	}

	/** 决策成功收口：补全 final tool 结果以闭合 OpenAI tool_calls 协议，剥离历史 reasoning，推进游标。 */
	commitDecision(
		finalToolCall: ToolCallLike,
		options: { usage?: StreamUsage; remoteSessionLost?: boolean; syncedRemote?: boolean }
	): void {
		const closingAssistant = stripAssistantReasoning(assistantToolMessage(finalToolCall) as ChatCompletionMessageParam);
		const closingTool: ChatCompletionMessageParam = {
			role: "tool",
			tool_call_id: finalToolCall.id,
			content: JSON.stringify({ accepted: true }),
		};

		// 将本次决策中间轮次的 assistant 消息一并剥离 reasoning_content
		const startIdx = this.activeCheckpoint?.transcriptLength ?? 0;
		for (let i = startIdx; i < this.transcript.length; i++) {
			this.transcript[i] = stripAssistantReasoning(this.transcript[i]);
		}
		this.transcript.push(closingAssistant, closingTool);

		if (this.activePlan) {
			this.lastEventSeq = this.activePlan.nextEventSeq;
			this.profileHashes = { ...this.activePlan.profileHashes };
		}
		this.initialized = true;
		this.consecutiveParseFailures = 0;
		if (options.usage) this.lastUsage = options.usage;

		if (options.remoteSessionLost) {
			this.needsRebuildReason = "remote_session_lost";
			this.sentCursor = 0;
		} else {
			this.needsRebuildReason = undefined;
			if (options.syncedRemote) this.sentCursor = this.transcript.length;
		}
		this.activeCheckpoint = null;
		this.activePlan = null;
	}

	/** 决策失败或超时回滚：恢复到决策前检查点，避免半截对话污染后续上下文。 */
	rollbackDecision(errorStage?: string, hadRemoteTurnStarted = false): void {
		const cp = this.activeCheckpoint;
		if (cp) {
			this.transcript = this.transcript.slice(0, cp.transcriptLength);
			this.sentCursor = cp.sentCursor;
			this.lastEventSeq = cp.lastEventSeq;
			this.profileHashes = { ...cp.profileHashes };
			this.initialized = cp.initialized;
		}
		this.activeCheckpoint = null;
		this.activePlan = null;

		if (errorStage === "parse") {
			this.consecutiveParseFailures++;
			if (this.consecutiveParseFailures >= 2 && this.initialized) {
				this.needsRebuildReason = "consecutive_parse_failures";
			}
		}
		if (hadRemoteTurnStarted && this.initialized) {
			this.needsRebuildReason = "interrupted_remote_turn";
		}
	}
}
