import { assistantToolMessage } from "../protocol.js";
import { planPrompt } from "./prompt-planner.js";
const DEFAULT_REBUILD_CONTEXT_RATIO = 0.5;
const DEFAULT_REBUILD_MAX_TOKENS = 12e4;
const DEFAULT_CONTEXT_WINDOW_FALLBACK = 128e3;
function estimateTextTokens(text) {
  return text ? Math.ceil(text.length / 2.2) : 0;
}
function estimateMessagesTokens(messages) {
  let chars = 0;
  for (const msg of messages) {
    if (typeof msg.content === "string") chars += msg.content.length;
    else if (Array.isArray(msg.content)) chars += JSON.stringify(msg.content).length;
    const calls = msg.tool_calls;
    if (Array.isArray(calls)) chars += JSON.stringify(calls).length;
  }
  return Math.ceil(chars / 2.2);
}
function computeRebuildThreshold(contextSize) {
  const windowSize = contextSize && contextSize > 0 ? contextSize : DEFAULT_CONTEXT_WINDOW_FALLBACK;
  return Math.min(Math.floor(windowSize * DEFAULT_REBUILD_CONTEXT_RATIO), DEFAULT_REBUILD_MAX_TOKENS);
}
function stripAssistantReasoning(message) {
  if (message.role !== "assistant" || !("reasoning_content" in message)) return message;
  const copy = { ...message };
  delete copy.reasoning_content;
  return copy;
}
class SeatSession {
  sessionKey;
  backendFingerprint;
  initialized = false;
  transcript = [];
  sentCursor = 0;
  lastEventSeq = 0;
  profileHashes = {};
  lastUsage;
  configuredContextSize;
  consecutiveParseFailures = 0;
  needsRebuildReason;
  activeCheckpoint = null;
  activePlan = null;
  constructor(sessionKey, backendFingerprint) {
    this.sessionKey = sessionKey;
    this.backendFingerprint = backendFingerprint;
  }
  /** 后端或模型变更时标记需要重建会话。 */
  syncBackendFingerprint(fingerprint) {
    if (this.backendFingerprint !== fingerprint) {
      this.backendFingerprint = fingerprint;
      if (this.initialized) this.needsRebuildReason = "backend_changed";
    }
  }
  /** 评估是否需要因预算超限重建会话。 */
  evaluateRebuildReason() {
    if (!this.initialized) return void 0;
    if (this.needsRebuildReason) return this.needsRebuildReason;
    const threshold = computeRebuildThreshold(this.lastUsage?.contextSize ?? this.configuredContextSize);
    const used = this.lastUsage?.contextUsed && this.lastUsage.contextUsed > 0 ? this.lastUsage.contextUsed : estimateMessagesTokens(this.transcript);
    if (used >= threshold) return "context_budget_exceeded";
    return void 0;
  }
  /** 为一次新决策生成 Prompt 计划并建立回滚检查点。 */
  beginDecision(facts, eventWindow, options = {}) {
    const rebuildReason = this.evaluateRebuildReason();
    const plannerState = {
      initialized: this.initialized,
      profileHashes: { ...this.profileHashes }
    };
    const plan = planPrompt(facts, plannerState, {
      eventWindow,
      rebuildReason,
      stageInstruction: options.stageInstruction,
      allowedToolNames: options.allowedToolNames
    });
    this.activeCheckpoint = {
      transcriptLength: this.transcript.length,
      sentCursor: this.sentCursor,
      lastEventSeq: this.lastEventSeq,
      profileHashes: { ...this.profileHashes },
      initialized: this.initialized
    };
    this.activePlan = plan;
    const isFull = plan.mode === "full";
    if (isFull) {
      this.transcript = [
        { role: "system", content: plan.systemMessage || "" },
        { role: "user", content: plan.userMessage }
      ];
      this.sentCursor = 0;
    } else {
      this.transcript.push({ role: "user", content: plan.userMessage });
    }
    return {
      plan,
      deltaMessages: this.transcript.slice(this.sentCursor),
      resetRemoteSession: isFull
    };
  }
  /** 返回当前尚未同步到有状态远端的增量消息。 */
  getUnsentMessages() {
    return this.transcript.slice(this.sentCursor);
  }
  /** 在单次决策的多轮交互中追加 assistant tool_call 与后续 tool/user 消息。 */
  appendTurnMessages(messages) {
    this.transcript.push(...messages);
  }
  /** 记录远端已消费到当前 transcript 末尾（但仍允许决策失败时整段回滚）。 */
  markRemoteSynced() {
    this.sentCursor = this.transcript.length;
  }
  /** 决策成功收口：补全 final tool 结果以闭合 OpenAI tool_calls 协议，剥离历史 reasoning，推进游标。 */
  commitDecision(finalToolCall, options) {
    const closingAssistant = stripAssistantReasoning(assistantToolMessage(finalToolCall));
    const closingTool = {
      role: "tool",
      tool_call_id: finalToolCall.id,
      content: JSON.stringify({ accepted: true })
    };
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
      this.needsRebuildReason = void 0;
      if (options.syncedRemote) this.sentCursor = this.transcript.length;
    }
    this.activeCheckpoint = null;
    this.activePlan = null;
  }
  /** 决策失败或超时回滚：恢复到决策前检查点，避免半截对话污染后续上下文。 */
  rollbackDecision(errorStage, hadRemoteTurnStarted = false) {
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
export {
  DEFAULT_CONTEXT_WINDOW_FALLBACK,
  DEFAULT_REBUILD_CONTEXT_RATIO,
  DEFAULT_REBUILD_MAX_TOKENS,
  SeatSession,
  computeRebuildThreshold,
  estimateMessagesTokens,
  estimateTextTokens,
  stripAssistantReasoning
};
