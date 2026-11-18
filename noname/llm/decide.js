import "../../noname.js";
import { llmLogger } from "./logger.js";
import { getLLMConfig, llmEnabled } from "./index.js";
import { resolvePlayerBackend, resolvePlayerSeatIndex } from "./backends.js";
import { callCliStream, callCliWithTimeout } from "./cli-client.js";
import { collectDecisionPromptFacts } from "./context.js";
import { createHarnessDecisionRunner } from "./harness/harness.js";
import { seatSessionRegistry } from "./harness/session-registry.js";
import { resolveAllowedToolNames, STATIC_DECISION_TOOLS, INSPECT_DISCARD_PILE_TOOL, formatAllowedToolsLine } from "./tools.js";
import { buildCandidateSnapshot, assertExecutableSnapshot } from "./action-candidates.js";
import { isSkillEligible, getCandidateSkills, getCandidateCards } from "./candidates.js";
import { callLLMStream, callLLMWithTimeout } from "./client.js";
import { DecisionSession } from "./apply.js";
import { MoveDecisionSession } from "./move-session.js";
import { decisionTrace } from "./decision-trace.js";
import { isExplicitMultiTurnRejection, remainingTimeoutSec, assistantToolMessage } from "./protocol.js";
import { describeDecisionStage } from "./backup-protocol.js";
import { assertLLMURL } from "./config.js";
import { registerRoundSummaryClient, ensureRoundSummaryReady, getEventsSince, getDiscardPileCount, readDiscardPileReport } from "./round-history.js";
import { _status } from "../status/index.js";
import { ui } from "../ui/index.js";
import { lib } from "../library/index.js";
import { get } from "../get/binding.js";
import { game } from "../game/index.js";
async function dispatchSummaryStream(messages, tools, configOrBackend, callbacks) {
  if (configOrBackend?.kind === "agy" || configOrBackend?.kind === "codex") {
    return callCliStream(messages, tools, configOrBackend, callbacks);
  }
  return callLLMStream(messages, tools, configOrBackend, callbacks);
}
async function dispatchSummaryWithTimeout(messages, tools, configOrBackend) {
  if (configOrBackend?.kind === "agy" || configOrBackend?.kind === "codex") {
    return callCliWithTimeout(messages, tools, configOrBackend);
  }
  return callLLMWithTimeout(messages, tools, configOrBackend);
}
registerRoundSummaryClient({ callLLMStream: dispatchSummaryStream, callLLMWithTimeout: dispatchSummaryWithTimeout });
async function tryLLMDecide(event) {
  if (!_status.llmEnabledAtGameStart) return { handled: false };
  const decisionPoint = event.name;
  const player = event.player;
  const config = getLLMConfig();
  const backend = typeof resolvePlayerBackend === "function" ? resolvePlayerBackend(player, config, _status) : {
    kind: "openai",
    label: config.model || "openai",
    configured: !!(config.url && config.apikey && config.model),
    model: config.model || "",
    timeoutSec: config.timeoutSec || 30,
    maxRetries: config.maxRetries || 0,
    thinkingEffort: config.thinkingEffort || "medium",
    contextSize: config.openaiContextSize ?? 128e3,
    url: config.url,
    apikey: config.apikey
  };
  if (backend.kind === "local") return { handled: false };
  const deadline = Date.now() + config.decisionTimeoutSec * 1e3;
  const logId = llmLogger.start(
    decisionPoint,
    player ? player.getName() : "unknown",
    {
      enabled: config.enabled,
      configured: backend.configured,
      model: backend.model || backend.label,
      backend: backend.kind,
      providerLabel: backend.label,
      ...decisionTrace(event)
    },
    resolvePlayerSeatIndex(player, _status),
    deadline
  );
  let runner;
  try {
    if (!llmEnabled()) return fallback(logId, "disabled");
    if (!backend.configured) return fallback(logId, "no_config");
    if (backend.kind === "openai") assertLLMURL(backend.url || "");
    if (!event || !player) throw staged("translate", "LLM decision requires an event player");
    const runtime = createDecisionRuntime();
    const snapshot = buildCandidateSnapshot(event, player, runtime);
    assertExecutableSnapshot(event, snapshot);
    const decision = ["chooseToMove", "chooseToMove_new"].includes(event.name) ? new MoveDecisionSession(event, runtime) : new DecisionSession(event, snapshot, runtime);
    if (Date.now() >= deadline) throw staged("fetch", "LLM decision timed out");
    const automatic = decision instanceof DecisionSession ? decision.completeAutomatic() : void 0;
    if (automatic) {
      llmLogger.logAutomaticResponse(logId, decision.toLogResult(automatic.result));
      llmLogger.end(logId, "success");
      return { handled: true, result: automatic.result };
    }
    await ensureRoundSummaryReady(deadline);
    if (Date.now() >= deadline) throw staged("fetch", "LLM decision timed out");
    const statusObj = _status;
    const providerMultiTurnUnsupported = Boolean(statusObj.llmMultiTurnUnsupportedByBackend?.[backend.kind] ?? statusObj.llmMultiTurnUnsupported);
    const canMultiTurn = config.multiTurn && !providerMultiTurnUnsupported;
    let discardInspected = false;
    const gameId = statusObj.llmGameId || "game_unknown";
    const seatNum = resolvePlayerSeatIndex(player, _status);
    const existingSession = seatSessionRegistry.get(`${gameId}:seat_${seatNum}`);
    const eventWindow = getEventsSince(existingSession ? existingSession.lastEventSeq : 0);
    const initialAllowedToolNames = resolveAllowedToolNames(decisionPoint, snapshot, decision.stage, !!event.forced, {
      allowInspectDiscard: canMultiTurn && getDiscardPileCount() > 0
    });
    if (!initialAllowedToolNames.length) throw staged("translate", `unsupported decision point: ${decisionPoint}`);
    const facts = collectDecisionPromptFacts(event, snapshot, { canInspectDiscard: canMultiTurn && getDiscardPileCount() > 0 });
    runner = createHarnessDecisionRunner({
      gameId,
      seatNum,
      logId,
      backend,
      facts,
      eventWindow,
      stageInstruction: decision.stage ? describeDecisionStage(decision.stage) : void 0,
      allowedToolNames: initialAllowedToolNames,
      deadline,
      logger: llmLogger
    });
    const staticTools = STATIC_DECISION_TOOLS;
    const maxTurns = canMultiTurn ? config.maxTurns : 1;
    let turnIndex = 0;
    for (let actionTurn = 0; actionTurn < maxTurns; ) {
      if (Date.now() >= deadline) throw staged("fetch", "LLM decision timed out");
      decision.revalidate();
      const stage = decision.stage;
      const allowInspectDiscard = !discardInspected && canMultiTurn && getDiscardPileCount() > 0;
      const allowedToolNames = resolveAllowedToolNames(decisionPoint, snapshot, stage, !!event.forced, { allowInspectDiscard });
      if (!allowedToolNames.length) throw staged("translate", `unsupported decision point: ${decisionPoint}`);
      const turnMessages = runner.getTurnRequestMessages();
      const currentTurnIndex = turnIndex++;
      let toolCall;
      try {
        const turnRes = await runner.sendTurn(staticTools, currentTurnIndex, true);
        toolCall = turnRes.toolCall;
      } catch (error) {
        if (currentTurnIndex > 0 && isExplicitMultiTurnRejection(error)) {
          statusObj.llmMultiTurnUnsupportedByBackend ??= {};
          statusObj.llmMultiTurnUnsupportedByBackend[backend.kind] = true;
        }
        throw error;
      }
      const stats = runner.getLastThinkingStats();
      const turnMeta = {
        thinking: stats.thinking || toolCall.reasoningContent,
        thinkingMs: stats.thinkingMs,
        usage: stats.usage,
        refLabels: facts.refLabels,
        session: { ...runner.sessionMeta }
      };
      if (toolCall.name === INSPECT_DISCARD_PILE_TOOL && allowInspectDiscard) {
        discardInspected = true;
        const report = readDiscardPileReport();
        llmLogger.logTurn(logId, { index: currentTurnIndex, stage: stage?.id, request: { messages: turnMessages, tools: staticTools }, toolCall, result: report, ...turnMeta });
        const nextAllowed2 = resolveAllowedToolNames(decisionPoint, snapshot, stage, !!event.forced, { allowInspectDiscard: false });
        const followUpBase = stage ? `已返回当前弃牌堆明细。请继续完成当前选择步骤：
${describeDecisionStage(stage)}` : "已返回当前弃牌堆明细。请结合牌面与弃牌信息继续选择当前最优动作。";
        const allowedLine = formatAllowedToolsLine(nextAllowed2);
        const followUp = allowedLine ? `${followUpBase}

${allowedLine}` : followUpBase;
        runner.appendInteraction(toolCall, { accepted: true, discard_pile: report }, followUp);
        continue;
      }
      actionTurn++;
      let accepted;
      const checkpoint = decision.checkpoint();
      try {
        if (Date.now() >= deadline) throw staged("fetch", "LLM decision timed out");
        if (!allowedToolNames.includes(toolCall.name)) {
          throw staged("translate", `当前步骤不允许调用工具 ${toolCall.name}，请仅从本步允许工具中选择：${allowedToolNames.join(", ")}`);
        }
        decision.revalidate();
        accepted = decision.accept(toolCall);
        llmLogger.logTurn(logId, { index: currentTurnIndex, stage: stage?.id, request: { messages: turnMessages, tools: staticTools }, toolCall, result: accepted.result ? decision.toLogResult(accepted.result) : accepted.pending, ...turnMeta });
      } catch (error) {
        llmLogger.logTurn(logId, { index: currentTurnIndex, stage: stage?.id, request: { messages: turnMessages, tools: staticTools }, toolCall, error: error?.message || String(error), ...turnMeta });
        if (actionTurn < maxTurns && Date.now() < deadline && isRecoverableDecisionError(error)) {
          decision.rollback(checkpoint);
          const currentStage = decision.stage;
          const errMsg = error?.message || String(error);
          const nextAllowed2 = resolveAllowedToolNames(decisionPoint, snapshot, currentStage, !!event.forced, {
            allowInspectDiscard: !discardInspected && canMultiTurn && getDiscardPileCount() > 0
          });
          const retryBase = currentStage ? `上一步选择未通过规则校验（${errMsg}）。请重新提交：
${describeDecisionStage(currentStage)}` : `上一步选择未通过规则校验（${errMsg}）。请重新选择合法动作或 pass。`;
          const allowedLine = formatAllowedToolsLine(nextAllowed2);
          const retryText = allowedLine ? `${retryBase}

${allowedLine}` : retryBase;
          runner.appendInteraction(toolCall, { accepted: false, error: errMsg, retry_stage: currentStage ?? null }, retryText);
          continue;
        }
        throw error;
      }
      if (accepted.result) {
        runner.commit(toolCall);
        llmLogger.logResponse(logId, toolCall, decision.toLogResult(accepted.result));
        llmLogger.end(logId, "success");
        return { handled: true, result: accepted.result };
      }
      if (!config.multiTurn || !accepted.pending) throw staged("translate", "Action requires unsupported additional selection turn");
      const nextAllowed = resolveAllowedToolNames(decisionPoint, snapshot, accepted.pending, !!event.forced, {
        allowInspectDiscard: !discardInspected && canMultiTurn && getDiscardPileCount() > 0
      });
      const nextAllowedLine = formatAllowedToolsLine(nextAllowed);
      const nextPrompt = nextAllowedLine ? `${describeDecisionStage(accepted.pending)}

${nextAllowedLine}` : describeDecisionStage(accepted.pending);
      runner.appendInteraction(toolCall, { accepted: true, next_step: accepted.pending }, nextPrompt);
    }
    throw staged("fetch", `LLM decision exceeded ${maxTurns} turns`);
  } catch (error) {
    const stage = error?.stage || "fetch";
    const message = error?.message || String(error);
    runner?.rollback(stage);
    llmLogger.logError(logId, stage, message, error?.httpStatus);
    llmLogger.endFallback(logId, stage === "fetch" && message.includes("timed out") ? "timeout" : message);
    return { handled: false };
  }
}
function createDecisionRuntime() {
  return {
    getCandidateCards,
    getCandidateSkills,
    getPlayers: (event) => [...Array.from(game.players || []), ...event.deadTarget ? Array.from(game.dead || []) : []],
    getTargetId: (target, index) => target.playerid || String(index),
    getTargetName: (target) => get.translation(target) || target.name || "未知",
    getSkillInfo: (skill) => lib.skill[skill],
    getCardInfo: (card) => get.info(card),
    defaultSelectTarget: lib.filter.selectTarget,
    autoViewAs: (definition, cards) => get.autoViewAs(definition, cards),
    checkSelectTarget: (card, player, range) => game.checkMod(card, player, range, "selectTarget", player),
    checkCardEnabled2: (card, player) => game.checkMod(card, player, "unchanged", "cardEnabled2", player),
    isCardDiscardable: (card, player) => lib.filter.cardDiscardable(card, player),
    isCardRespondable: (card, player) => lib.filter.cardRespondable(card, player),
    isTargetChessReachable: (_event, player, target, forceAll) => !game.chess || forceAll || !player || get.distance(player, target, "pure") <= 7,
    getOwner: (card) => get.owner(card),
    alivePlayers: () => Array.from(game.players || []),
    deadPlayers: () => Array.from(game.dead || []),
    translate: (value) => get.translation(value) || value?.name || String(value),
    isSkillEligible,
    normalizeFilter: (filter) => get.filter(filter),
    getSuit: (card) => get.suit(card),
    cardLabel: (card) => `${get.translation(card)} ${get.suit(card)} ${get.number(card)}`,
    legacyBridgeHost: { ui, status: _status }
  };
}
async function requestToolCall(messages, tools, config, deadline, logId, turnIndex, allowStream) {
  let attemptIndex = 0;
  try {
    if (!allowStream) return await requestNonstream(messages, tools, config, deadline, logId, turnIndex, attemptIndex);
    return await requestStream(messages, tools, config, deadline, logId, turnIndex, attemptIndex);
  } catch (streamError) {
    if (!allowStream || ["parse", "config"].includes(streamError?.stage)) throw streamError;
    attemptIndex++;
    return requestNonstream(messages, tools, config, deadline, logId, turnIndex, attemptIndex);
  }
}
async function requestStream(messages, tools, config, deadline, logId, turnIndex, attemptIndex) {
  llmLogger.startRequestAttempt(logId, turnIndex, attemptIndex, "stream");
  try {
    const resolved = withRemainingTimeout(config, deadline);
    const callbacks = {
      onChunk: (partialArgs) => llmLogger.logStreamChunk(logId, partialArgs),
      onFirstChunk: () => llmLogger.markRequestFirstChunk(logId, turnIndex, attemptIndex),
      onFirstToken: () => llmLogger.markRequestTTFT(logId, turnIndex, attemptIndex)
    };
    const isCli = resolved?.kind === "agy" || resolved?.kind === "codex";
    const result = isCli ? await callCliStream(messages, tools, resolved, callbacks) : await callLLMStream(messages, tools, resolved, callbacks);
    llmLogger.finishRequestAttempt(logId, turnIndex, attemptIndex, "success");
    return result;
  } catch (error) {
    llmLogger.finishRequestAttempt(logId, turnIndex, attemptIndex, "error", error?.stage);
    throw error;
  }
}
async function requestNonstream(messages, tools, config, deadline, logId, turnIndex, attemptIndex) {
  llmLogger.startRequestAttempt(logId, turnIndex, attemptIndex, "nonstream");
  try {
    const resolved = withRemainingTimeout(config, deadline);
    const isCli = resolved?.kind === "agy" || resolved?.kind === "codex";
    const result = isCli ? await callCliWithTimeout(messages, tools, resolved) : await callLLMWithTimeout(messages, tools, resolved);
    llmLogger.finishRequestAttempt(logId, turnIndex, attemptIndex, "success");
    return result;
  } catch (error) {
    llmLogger.finishRequestAttempt(logId, turnIndex, attemptIndex, "error", error?.stage);
    throw error;
  }
}
function withRemainingTimeout(config, deadline) {
  return { ...config, timeoutSec: remainingTimeoutSec(config.timeoutSec, deadline) };
}
function asAssistantToolMessage(call) {
  return assistantToolMessage(call);
}
function fallback(logId, reason) {
  llmLogger.endFallback(logId, reason);
  return { handled: false };
}
function staged(stage, message) {
  const error = new Error(message);
  error.stage = stage;
  return error;
}
const NON_RECOVERABLE_ERROR_RE = /has no headless selectionSpec|unknown skill|UI-dependent filterOk|disabled by selectionSpec|decision disabled|unsupported|requires an event player|ownership changed|state changed|eligibility changed|candidates changed|hand changed|no longer current|no longer owned|no longer eligible/i;
function isRecoverableDecisionError(error) {
  const message = String(error?.message || "");
  if (NON_RECOVERABLE_ERROR_RE.test(message)) return false;
  if (error?.stage === "translate") return true;
  return error?.stage === "translate/action-resolution" && /has no legal continuation/.test(message);
}
export {
  tryLLMDecide
};
