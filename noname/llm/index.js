import "../../noname.js";
import { readBackendsFromRawConfig, hasAnyConfiguredBackend, computeSeatIndexFromMonarch } from "./backends.js";
import { resolveBackendDisplayName, resolvePlayerBackend } from "./backends.js";
import { llmLogger } from "./logger.js";
import { reset, start, end } from "./player-button-state.js";
import { normalizeLLMText } from "./config.js";
import { resetAllHarnessSessions } from "./harness/harness.js";
import { initRoundHistoryHooks, resetRoundHistory } from "./round-history.js";
import { resetOpeningSummaries } from "./character-selection/summary.js";
import { tryLLMDecide } from "./decide.js";
import { _status } from "../status/index.js";
import { lib } from "../library/index.js";
import { ui } from "../ui/index.js";
import { game } from "../game/index.js";
function getLLMConfig() {
  return _status.llmConfigAtGameStart ?? readLLMConfig();
}
function readLLMConfig() {
  const enabled = !!lib.config.llm_enabled;
  const extra = typeof readBackendsFromRawConfig === "function" ? readBackendsFromRawConfig(lib.config, globalThis.document) : {
    defaultBackend: "openai",
    openaiDisplayName: "",
    openaiContextSize: 128e3,
    agy: { displayName: "agy", command: "agy", model: "", thinkingEffort: "default", timeoutSec: 60, extraArgs: "" },
    codex: { displayName: "codex", command: "codex", model: "", thinkingEffort: "default", timeoutSec: 60, extraArgs: "" },
    seatBackends: {}
  };
  return {
    enabled,
    controlSelf: enabled && !!lib.config.llm_control_self,
    url: normalizeLLMText(lib.config.llm_url, globalThis.document),
    apikey: normalizeLLMText(lib.config.llm_apikey, globalThis.document),
    model: normalizeLLMText(lib.config.llm_model, globalThis.document),
    thinkingEffort: lib.config.llm_thinking_effort || "medium",
    maxRetries: Number(lib.config.llm_max_retries) || 0,
    timeoutSec: Number(lib.config.llm_timeout) || 30,
    multiTurn: enabled,
    maxTurns: clampNumber(lib.config.llm_max_turns, 4, 1, 8),
    decisionTimeoutSec: clampNumber(lib.config.llm_decision_timeout, 60, 10, 300),
    ...extra
  };
}
function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(number)));
}
function llmEnabled() {
  return getLLMConfig().enabled;
}
function llmSelfControlled() {
  const config = getLLMConfig();
  return config.enabled && config.controlSelf;
}
function llmConfigured() {
  const c = getLLMConfig();
  return hasAnyConfiguredBackend(c);
}
let gameHooksInitialized = false;
function initLLMGameHooks() {
  if (gameHooksInitialized) return;
  gameHooksInitialized = true;
  initRoundHistoryHooks();
  if (typeof lib !== "undefined" && lib.announce?.subscribe) {
    lib.announce.subscribe("gameStart", onGameStart);
    lib.announce.subscribe("llm_log_start", onLLMLogStart);
    lib.announce.subscribe("llm_log_end", onLLMLogEnd);
  }
}
function activateLLMSelfControl() {
  if (!_status.auto && typeof ui?.click?.auto === "function") {
    ui.click.auto("forced");
  } else {
    _status.auto = true;
    ui?.auto?.classList?.add?.("glow");
    ui?.arena?.classList?.add?.("auto");
  }
  ui?.auto?.classList?.add?.("forcehide");
  ui?.wuxie?.classList?.add?.("forcehide");
  ui?.shortcut?.autobutton?.classList?.add?.("forcehide");
  ui?.auto?.hide?.();
  ui?.wuxie?.hide?.();
}
function clearLLMSelfControlLock() {
  ui?.auto?.classList?.remove?.("forcehide");
  ui?.wuxie?.classList?.remove?.("forcehide");
  ui?.shortcut?.autobutton?.classList?.remove?.("forcehide");
}
function prepareLLMGame(reusePrepared = false, retainOpeningResults = false) {
  const status = _status;
  const reuse = reusePrepared && !!status.llmOpeningPrepared;
  const prevGameId = status.llmGameId;
  reset();
  resetRoundHistory();
  if (!reuse || !retainOpeningResults) resetOpeningSummaries();
  if (!reuse && typeof resetAllHarnessSessions === "function") {
    resetAllHarnessSessions(prevGameId);
  }
  const raw = reuse && status.llmConfigAtGameStart ? status.llmConfigAtGameStart : readLLMConfig();
  const snapshot = Object.freeze({
    ...raw,
    agy: Object.freeze({ ...raw.agy }),
    codex: Object.freeze({ ...raw.codex }),
    seatBackends: Object.freeze({ ...raw.seatBackends })
  });
  status.llmConfigAtGameStart = snapshot;
  if (!reuse) status.llmGameId = `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  delete status.llmEnabledAtGameStart;
  delete status.llmSelfControlledAtGameStart;
  status.llmInitialHumanPlayer = game?.me;
  const allPlayers = [...game?.players || [], ...game?.dead || []];
  const monarch = game?.zhong || game?.zhu;
  const monarchAnchor = monarch && allPlayers.includes(monarch) ? monarch : void 0;
  const seatMap = /* @__PURE__ */ new WeakMap();
  for (const p of allPlayers) {
    if (p && typeof p === "object") {
      const settled = typeof p.getSeatNum === "function" ? Number(p.getSeatNum()) : 0;
      if (Number.isFinite(settled) && settled > 0) {
        seatMap.set(p, Math.floor(settled));
      } else {
        const byMonarch = monarchAnchor ? computeSeatIndexFromMonarch(p, monarchAnchor, allPlayers.length) : void 0;
        if (byMonarch !== void 0) {
          seatMap.set(p, byMonarch);
        } else {
          const rawPos = p.dataset?.position;
          if (rawPos !== void 0 && rawPos !== "") {
            const pos = Number(rawPos);
            if (Number.isFinite(pos) && pos >= 0) {
              seatMap.set(p, Math.floor(pos) + 1);
            }
          }
        }
      }
    }
  }
  status.llmInitialSeatIndices = seatMap;
  delete status.llmMultiTurnUnsupported;
  delete status.llmMultiTurnUnsupportedByBackend;
  status.llmOpeningPrepared = true;
  clearLLMSelfControlLock();
  ui.updateLLMLogButtons?.();
}
function discardLLMOpeningPreparation() {
  delete _status.llmOpeningPrepared;
}
function onGameStart() {
  const status = _status;
  if (!status.llmOpeningPrepared) prepareLLMGame();
  delete status.llmOpeningPrepared;
  resetRoundHistory();
  const selfControlled = !!status.llmConfigAtGameStart?.enabled && !!status.llmConfigAtGameStart?.controlSelf;
  status.llmEnabledAtGameStart = !!status.llmConfigAtGameStart?.enabled;
  status.llmSelfControlledAtGameStart = selfControlled;
  if (selfControlled) {
    activateLLMSelfControl();
  } else {
    clearLLMSelfControlLock();
  }
  ui.updateLLMLogButtons?.();
}
function onLLMLogStart(entry) {
  start(entry);
  ui.updateLLMLogButtons();
}
function onLLMLogEnd(entry) {
  end(entry);
  ui.updateLLMLogButtons();
}
async function ensureLLMMigrated() {
  await llmLogger.init();
}
export {
  discardLLMOpeningPreparation,
  ensureLLMMigrated,
  getLLMConfig,
  initLLMGameHooks,
  llmConfigured,
  llmEnabled,
  llmLogger,
  llmSelfControlled,
  prepareLLMGame,
  resolveBackendDisplayName,
  resolvePlayerBackend,
  tryLLMDecide
};
