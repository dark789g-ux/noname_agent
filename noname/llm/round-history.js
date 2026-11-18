import "../../noname.js";
import { resolvePlayerSeatIndex, resolveSummaryBackend } from "./backends.js";
import { assertLLMURL } from "./config.js";
import { llmEnabled, getLLMConfig } from "./index.js";
import { llmLogger } from "./logger.js";
import { remainingTimeoutSec } from "./protocol.js";
import { cleanBattleLogText, buildDiscardPileReport, sliceEventsSince, buildFallbackRoundSummary, formatBattleLogArgs, isRedundantTurnStartLog, buildRoundSummaryMessages, submitRoundSummaryTool, SUBMIT_ROUND_SUMMARY_TOOL, clampSummaryText } from "./prompt-history.js";
import { lib } from "../library/index.js";
import { game } from "../game/index.js";
import { _status } from "../status/index.js";
import { ui } from "../ui/index.js";
import { get } from "../get/binding.js";
const MAX_ROUND_SUMMARY_WAIT_MS = 12e3;
const ROUND_SUMMARY_TIMEOUT_CAP_SEC = 30;
const MAX_BUFFER_PER_ROUND = 240;
const MAX_SEQ_LOG_ENTRIES = 400;
let hooksInitialized = false;
let privateGiveDepth = 0;
let summaryTransport = null;
let state = createInitialState();
function registerRoundSummaryClient(transport) {
  summaryTransport = transport;
}
function createInitialState() {
  return {
    currentRound: 0,
    currentEntries: [],
    seqCounter: 0,
    seqLog: [],
    rollingSummary: "",
    summarizedThroughRound: 0,
    summaryChain: null
  };
}
function initRoundHistoryHooks() {
  if (!hooksInitialized) {
    hooksInitialized = true;
    if (typeof lib !== "undefined" && lib.announce?.subscribe) {
      lib.announce.subscribe("roundStart", onRoundStart);
    }
  }
  installRuntimeWrappers();
}
function resetRoundHistory() {
  state = createInitialState();
  privateGiveDepth = 0;
  installRuntimeWrappers();
}
function getCurrentRoundNumber() {
  const value = Number(game?.roundNumber ?? 0);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
function getDrawPileCount() {
  if (game?.online && typeof _status?.cardPileNum === "number") {
    return Math.max(0, _status.cardPileNum);
  }
  return ui?.cardPile?.childNodes?.length ?? 0;
}
function getDiscardPileCount() {
  return ui?.discardPile?.childNodes?.length ?? 0;
}
function getShuffleCount() {
  const value = Number(game?.shuffleNumber ?? 0);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
function readDiscardPileReport() {
  const rawNodes = Array.from(ui?.discardPile?.childNodes || []);
  const separator = lib?.natureSeparator || "|";
  const cards = rawNodes.map((card) => {
    const rawName = typeof card?.name === "string" ? card.name : "";
    const name = rawName ? cleanBattleLogText(get.translation?.(rawName) || rawName) : "未知卡牌";
    const rawNature = get.nature?.(card, false) ?? card?.nature;
    const natureText = Array.isArray(rawNature) ? rawNature.join("|") : typeof rawNature === "string" ? rawNature : "";
    const nature = natureText ? natureText.split(separator).filter(Boolean).map((seg) => lib?.translate?.[`nature_${seg}`] || lib?.translate?.[seg] || seg).join("|") : void 0;
    const rawSuit = get.suit?.(card, false) ?? card?.suit;
    return {
      name,
      rawName,
      nature,
      suit: typeof rawSuit === "string" ? rawSuit : void 0,
      number: get.number?.(card, false) ?? card?.number
    };
  });
  return buildDiscardPileReport(cards);
}
function getPromptHistorySnapshot() {
  const engineRound = getCurrentRoundNumber();
  syncRoundTransition(engineRound);
  const currentRound = state.currentRound > 0 ? state.currentRound : engineRound;
  const rollingSummary = state.pendingFallbackSummary ?? state.rollingSummary;
  const summarizedThroughRound = state.pendingThroughRound ?? state.summarizedThroughRound;
  return {
    rollingSummary: rollingSummary || void 0,
    summarizedThroughRound: summarizedThroughRound || void 0,
    currentRound,
    entries: state.currentEntries.slice()
  };
}
function getLatestEventSeq() {
  return state.seqCounter;
}
function getEventsSince(sinceSeq) {
  return sliceEventsSince(state.seqLog, state.seqCounter, sinceSeq);
}
async function ensureRoundSummaryReady(deadline) {
  const activeChain = state.summaryChain;
  if (!activeChain) return;
  const remainingMs = deadline - Date.now();
  const waitMs = Math.min(MAX_ROUND_SUMMARY_WAIT_MS, Math.max(0, Math.floor(remainingMs * 0.4)));
  if (waitMs <= 50) return;
  let timer;
  try {
    await Promise.race([
      activeChain,
      new Promise((resolve) => {
        timer = setTimeout(resolve, waitMs);
      })
    ]);
  } finally {
    if (timer !== void 0) clearTimeout(timer);
  }
}
function installRuntimeWrappers() {
  const playerProto = lib?.element?.Player?.prototype;
  if (playerProto && typeof playerProto.$giveAuto === "function" && !playerProto.$giveAuto.__llmWrapped) {
    const originalGiveAuto = playerProto.$giveAuto;
    const wrappedGiveAuto = function(...args) {
      privateGiveDepth++;
      try {
        return originalGiveAuto.apply(this, args);
      } finally {
        privateGiveDepth = Math.max(0, privateGiveDepth - 1);
      }
    };
    wrappedGiveAuto.__llmWrapped = true;
    playerProto.$giveAuto = wrappedGiveAuto;
  }
  if (typeof game !== "undefined" && typeof game.log === "function" && !game.log.__llmWrapped) {
    const originalLog = game.log;
    const wrappedLog = function(...args) {
      const result = originalLog.apply(this, args);
      try {
        captureGameLog(args);
      } catch {
      }
      return result;
    };
    wrappedLog.__llmWrapped = true;
    game.log = wrappedLog;
  }
}
function onRoundStart(payload) {
  const nextRound = typeof payload?.roundNumber === "number" && payload.roundNumber > 0 ? Math.floor(payload.roundNumber) : getCurrentRoundNumber();
  syncRoundTransition(nextRound);
}
function syncRoundTransition(nextRound) {
  if (nextRound <= 0) return;
  if (state.currentRound === 0 && nextRound === 1) {
    state.currentRound = 1;
    return;
  }
  if (nextRound === state.currentRound) return;
  const completedRound = state.currentRound > 0 ? state.currentRound : Math.max(1, nextRound - 1);
  const completedEntries = state.currentEntries.slice();
  state.currentRound = nextRound;
  state.currentEntries = [];
  if (!completedEntries.length) return;
  if (!_status?.llmEnabledAtGameStart) return;
  const baseSummary = state.pendingFallbackSummary ?? state.rollingSummary;
  state.pendingFallbackSummary = buildFallbackRoundSummary(baseSummary, completedRound, completedEntries);
  state.pendingThroughRound = completedRound;
  const gameId = _status?.llmGameId || "game_unknown";
  enqueueRoundSummary(gameId, completedRound, completedEntries);
}
function captureGameLog(args) {
  if (_status?.video) return;
  if (!_status?.llmEnabledAtGameStart && !lib?.config?.llm_enabled) return;
  if (!args.length) return;
  const engineRound = getCurrentRoundNumber();
  syncRoundTransition(engineRound);
  const text = formatBattleLogArgs(
    args,
    {
      getItemType: (value) => String(get.itemtype?.(value) || ""),
      translate: (value) => String(get.translation?.(value) ?? value ?? ""),
      isHistoryBarNode: (value) => Boolean(ui?.historybar && value?.parentNode === ui.historybar),
      cnNumber: (count) => String(get.cnNumber?.(count) ?? count)
    },
    privateGiveDepth > 0
  );
  if (!text) return;
  const effectiveRound = state.currentRound > 0 ? state.currentRound : engineRound;
  const { turnHeader, currentPhaseName } = resolveTurnContext(effectiveRound);
  if (isRedundantTurnStartLog(text, currentPhaseName)) return;
  state.currentEntries.push({ turnHeader, text });
  if (state.currentEntries.length > MAX_BUFFER_PER_ROUND) {
    state.currentEntries.splice(0, state.currentEntries.length - MAX_BUFFER_PER_ROUND);
  }
  state.seqLog.push({ seq: ++state.seqCounter, roundNumber: effectiveRound, turnHeader, text });
  if (state.seqLog.length > MAX_SEQ_LOG_ENTRIES) {
    state.seqLog.splice(0, state.seqLog.length - MAX_SEQ_LOG_ENTRIES);
  }
}
function resolveTurnContext(roundNumber) {
  const phasePlayer = _status?.currentPhase;
  if (phasePlayer && (get.itemtype?.(phasePlayer) === "player" || typeof phasePlayer.getSeatNum === "function" || phasePlayer.name)) {
    const rawSeat = typeof phasePlayer.getSeatNum === "function" ? Number(phasePlayer.getSeatNum()) : Number(phasePlayer.seat || 0);
    const name = cleanBattleLogText(get.translation?.(phasePlayer) || phasePlayer.name || "未知角色");
    const seatPrefix = Number.isInteger(rawSeat) && rawSeat > 0 ? `[${rawSeat}号位] ` : "";
    return {
      turnHeader: `${seatPrefix}${name}的回合`,
      currentPhaseName: name
    };
  }
  return { turnHeader: roundNumber <= 0 ? "开局阶段" : "回合外" };
}
function enqueueRoundSummary(gameId, completedRound, completedEntries) {
  const previous = state.summaryChain ?? Promise.resolve();
  const run = previous.then(async () => {
    if ((_status?.llmGameId || "game_unknown") !== gameId) return;
    const prevSummary = state.rollingSummary;
    const summary = await requestRoundSummary(prevSummary, completedRound, completedEntries);
    if ((_status?.llmGameId || "game_unknown") !== gameId) return;
    state.rollingSummary = summary;
    state.summarizedThroughRound = completedRound;
  });
  const tracked = run.finally(() => {
    if (state.summaryChain === tracked && (_status?.llmGameId || "game_unknown") === gameId) {
      state.pendingFallbackSummary = void 0;
      state.pendingThroughRound = void 0;
      state.summaryChain = null;
    }
  });
  state.summaryChain = tracked;
}
function collectRoundSeatIndices() {
  const players = Array.from(game?.players || []);
  return players.map((player) => resolvePlayerSeatIndex(player));
}
async function requestRoundSummary(prevSummary, completedRound, completedEntries) {
  const fallbackText = buildFallbackRoundSummary(prevSummary, completedRound, completedEntries);
  if (!summaryTransport || !llmEnabled()) return fallbackText;
  const config = getLLMConfig();
  const summaryBackend = typeof resolveSummaryBackend === "function" ? resolveSummaryBackend(config, collectRoundSeatIndices()) : {
    kind: "openai",
    label: config.model || "openai",
    configured: !!(config.url && config.apikey && config.model),
    model: config.model,
    timeoutSec: config.timeoutSec,
    maxRetries: config.maxRetries,
    thinkingEffort: config.thinkingEffort,
    url: config.url,
    apikey: config.apikey
  };
  if (!summaryBackend || !summaryBackend.configured) return fallbackText;
  const timeoutSec = Math.max(5, Math.min(summaryBackend.timeoutSec || 30, ROUND_SUMMARY_TIMEOUT_CAP_SEC));
  const deadline = Date.now() + timeoutSec * 1e3;
  const logId = llmLogger.start(
    "roundSummary",
    `[全局轮次总结·第${completedRound}轮]`,
    {
      enabled: config.enabled,
      configured: true,
      model: summaryBackend.model || summaryBackend.label,
      backend: summaryBackend.kind,
      providerLabel: summaryBackend.label
    },
    -1,
    deadline
  );
  try {
    if (summaryBackend.kind === "openai") assertLLMURL(summaryBackend.url || "");
    const messages = buildRoundSummaryMessages(prevSummary, completedRound, completedEntries);
    const tools = [submitRoundSummaryTool()];
    llmLogger.logRequest(logId, messages, tools);
    const toolCall = await callSummaryTool(messages, tools, summaryBackend, deadline, logId);
    const rawSummary = typeof toolCall.arguments?.summary === "string" ? toolCall.arguments.summary : "";
    if (toolCall.name !== SUBMIT_ROUND_SUMMARY_TOOL || !cleanBattleLogText(rawSummary)) {
      throw Object.assign(new Error(`Invalid summary tool response: ${toolCall.name}`), { stage: "parse" });
    }
    const normalized = clampSummaryText(rawSummary, 350);
    llmLogger.logResponse(logId, toolCall, normalized);
    llmLogger.end(logId, "success");
    return normalized;
  } catch (error) {
    const stage = error?.stage || "fetch";
    const message = error?.message || String(error);
    llmLogger.logError(logId, stage, message, error?.httpStatus);
    llmLogger.endFallback(logId, stage === "fetch" && message.includes("timed out") ? "timeout" : message);
    return fallbackText;
  }
}
async function callSummaryTool(messages, tools, backend, deadline, logId) {
  const transport = summaryTransport;
  let attemptIndex = 0;
  try {
    llmLogger.startRequestAttempt(logId, 0, attemptIndex, "stream");
    const result = await transport.callLLMStream(messages, tools, { ...backend, timeoutSec: remainingTimeoutSec(backend.timeoutSec, deadline) }, {
      onChunk: (partial) => llmLogger.logStreamChunk(logId, partial),
      onFirstChunk: () => llmLogger.markRequestFirstChunk(logId, 0, attemptIndex),
      onFirstToken: () => llmLogger.markRequestTTFT(logId, 0, attemptIndex)
    });
    llmLogger.finishRequestAttempt(logId, 0, attemptIndex, "success");
    return result;
  } catch (streamError) {
    llmLogger.finishRequestAttempt(logId, 0, attemptIndex, "error", streamError?.stage);
    if (["parse", "config"].includes(streamError?.stage)) throw streamError;
    attemptIndex++;
    llmLogger.startRequestAttempt(logId, 0, attemptIndex, "nonstream");
    try {
      const result = await transport.callLLMWithTimeout(messages, tools, { ...backend, timeoutSec: remainingTimeoutSec(backend.timeoutSec, deadline) });
      llmLogger.finishRequestAttempt(logId, 0, attemptIndex, "success");
      return result;
    } catch (error) {
      llmLogger.finishRequestAttempt(logId, 0, attemptIndex, "error", error?.stage);
      throw error;
    }
  }
}
export {
  ensureRoundSummaryReady,
  getCurrentRoundNumber,
  getDiscardPileCount,
  getDrawPileCount,
  getEventsSince,
  getLatestEventSeq,
  getPromptHistorySnapshot,
  getShuffleCount,
  initRoundHistoryHooks,
  readDiscardPileReport,
  registerRoundSummaryClient,
  resetRoundHistory
};
