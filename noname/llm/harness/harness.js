import { assistantToolMessage } from "../protocol.js";
import { DEFAULT_CONTEXT_WINDOW_FALLBACK, estimateMessagesTokens, estimateTextTokens } from "./seat-session.js";
import { seatSessionRegistry } from "./session-registry.js";
import { OpenAITransport } from "./transports/openai.js";
import { RemoteSessionTransport, notifyRemoteResetGame } from "./transports/remote-session.js";
const openaiTransport = new OpenAITransport();
const remoteSessionTransport = new RemoteSessionTransport();
function buildBackendFingerprint(backend) {
  return [
    backend.kind,
    backend.model || "",
    backend.url || "",
    backend.command || "",
    backend.thinkingEffort || ""
  ].join("|");
}
function selectTransport(backend) {
  if (backend.kind === "agy" || backend.kind === "codex") {
    return remoteSessionTransport;
  }
  return openaiTransport;
}
function createHarnessDecisionRunner(params) {
  const fingerprint = buildBackendFingerprint(params.backend);
  const session = seatSessionRegistry.getOrCreate(params.gameId, params.seatNum, fingerprint);
  const defaultContextSize = params.backend.contextSize ?? (params.backend.kind === "openai" ? DEFAULT_CONTEXT_WINDOW_FALLBACK : void 0);
  if (defaultContextSize !== void 0) {
    session.configuredContextSize = defaultContextSize;
  }
  const transport = selectTransport(params.backend);
  const { plan, deltaMessages, resetRemoteSession } = session.beginDecision(params.facts, params.eventWindow, {
    stageInstruction: params.stageInstruction,
    allowedToolNames: params.allowedToolNames
  });
  const withDefaultContextSize = (usage) => {
    if (!usage) return void 0;
    if (usage.contextSize !== void 0 || defaultContextSize === void 0) return usage;
    return { ...usage, contextSize: defaultContextSize };
  };
  const previousContextUsed = session.lastUsage?.contextUsed;
  const initialBaseContextUsed = plan.mode === "incremental" && previousContextUsed && previousContextUsed > 0 ? previousContextUsed + estimateMessagesTokens(deltaMessages) : estimateMessagesTokens(session.transcript);
  const initialContextSize = session.lastUsage?.contextSize ?? defaultContextSize;
  const isOpenAIBackend = params.backend.kind === "openai";
  let latestUsage = isOpenAIBackend ? {
    ...session.lastUsage || {},
    contextUsed: initialBaseContextUsed,
    contextSize: initialContextSize
  } : withDefaultContextSize(session.lastUsage);
  let extraTurnTokens = 0;
  let latestThought = "";
  let thinkingStartedAt;
  let thinkingMs;
  let degraded = false;
  let degradeReason;
  let remoteSessionLost = false;
  let syncedRemote = false;
  let remoteTurnStarted = false;
  let needRemoteResetForNextTurn = resetRemoteSession;
  const sessionMeta = {
    mode: plan.mode,
    ...plan.rebuilt ? { rebuilt: true, rebuildReason: plan.rebuildReason } : {},
    addedEventsCount: plan.addedEventsCount,
    contextUsed: latestUsage?.contextUsed,
    contextSize: latestUsage?.contextSize,
    sessionKey: session.sessionKey
  };
  params.logger.logRefLabels(params.logId, params.facts.refLabels);
  params.logger.logSessionMeta(params.logId, sessionMeta);
  const updateSessionMeta = () => {
    Object.assign(sessionMeta, {
      degraded: degraded || void 0,
      degradeReason: degradeReason || void 0,
      contextUsed: latestUsage?.contextUsed ?? sessionMeta.contextUsed,
      contextSize: latestUsage?.contextSize ?? sessionMeta.contextSize
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
        thinking: latestThought || void 0,
        thinkingMs,
        usage: latestUsage
      };
    },
    async sendTurn(tools, turnIndex, allowStream) {
      latestThought = "";
      thinkingStartedAt = void 0;
      thinkingMs = void 0;
      let hasTurnRealUsage = false;
      const turnBaseContextUsed = turnIndex === 0 ? initialBaseContextUsed : latestUsage?.contextUsed && latestUsage.contextUsed > 0 ? latestUsage.contextUsed + extraTurnTokens : estimateMessagesTokens(session.transcript);
      extraTurnTokens = 0;
      let lastEstimatedContextUsed = turnBaseContextUsed;
      let currentAttemptIndex = 0;
      let managedAttempts = false;
      params.logger.logRequest(params.logId, session.transcript.slice(), tools);
      const callbacks = {
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
        onUsage: (usage) => {
          hasTurnRealUsage = true;
          latestUsage = withDefaultContextSize(usage);
          updateSessionMeta();
        },
        onStreamProgress: (progress) => {
          const now = Date.now();
          if (progress.thought) {
            if (thinkingStartedAt === void 0) thinkingStartedAt = now;
            latestThought = progress.thought;
            if (progress.phase === "thinking") {
              thinkingMs = now - thinkingStartedAt;
            } else if (thinkingMs === void 0) {
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
              ...latestUsage || {},
              contextUsed: estimatedUsed,
              contextSize: latestUsage?.contextSize ?? defaultContextSize
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
            usage: latestUsage
          });
        }
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
          deadline: params.deadline
        };
        if (transport.stateful) {
          params.logger.startRequestAttempt(params.logId, turnIndex, 0, "stream");
        }
        const result = await transport.sendTurn(sendInput, callbacks);
        needRemoteResetForNextTurn = false;
        if (result.toolCall.reasoningContent && !latestThought) {
          latestThought = result.toolCall.reasoningContent;
        }
        if (thinkingStartedAt !== void 0 && thinkingMs === void 0) {
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
      } catch (error) {
        if (!managedAttempts) {
          params.logger.finishRequestAttempt(params.logId, turnIndex, currentAttemptIndex, "error", error?.stage);
        }
        throw error;
      }
    },
    appendInteraction(toolCall, toolResultPayload, followUpUserContent) {
      const addedMessages = [
        assistantToolMessage(toolCall),
        { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(toolResultPayload) },
        { role: "user", content: followUpUserContent }
      ];
      extraTurnTokens += estimateMessagesTokens(addedMessages);
      session.appendTurnMessages(addedMessages);
    },
    commit(finalToolCall) {
      session.commitDecision(finalToolCall, {
        usage: latestUsage,
        remoteSessionLost,
        syncedRemote
      });
    },
    rollback(errorStage) {
      session.rollbackDecision(errorStage, remoteTurnStarted && !degraded);
    }
  };
}
function resetAllHarnessSessions(gameId) {
  seatSessionRegistry.resetGame(gameId);
  void notifyRemoteResetGame(gameId);
}
export {
  buildBackendFingerprint,
  createHarnessDecisionRunner,
  resetAllHarnessSessions,
  selectTransport
};
