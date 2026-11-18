import { readBackendsFromRawConfig, resolvePlayerSeatIndex, resolveSeatBackendKind, resolveBackendDisplayName } from "./backends.js";
const activeLogs = /* @__PURE__ */ new Map();
function gameIdOf(value) {
  return value.gameId || "game_unknown";
}
function matches(entry, target) {
  if (gameIdOf(entry) !== gameIdOf(target)) return false;
  if (target.playerSeatNum !== void 0 && entry.playerSeatNum !== void 0) return entry.playerSeatNum === target.playerSeatNum;
  return entry.playerName === target.playerName;
}
function reset() {
  activeLogs.clear();
}
function start(entry) {
  activeLogs.set(entry.id, entry);
}
function end(entry) {
  activeLogs.delete(typeof entry === "string" ? entry : entry.id);
}
function isActive(target) {
  for (const entry of activeLogs.values()) {
    if (matches(entry, target)) return true;
  }
  return false;
}
function derive(target, options) {
  const active = isActive(target);
  return {
    active,
    visible: active || options.enabled && (!options.isUnderControl || !!options.controlSelf),
    highlighted: active
  };
}
function toBackendInput(status, config, enabled, controlSelf) {
  if (status.llmConfigAtGameStart) {
    return { ...status.llmConfigAtGameStart, enabled, controlSelf };
  }
  const extra = readBackendsFromRawConfig(config);
  return {
    enabled,
    controlSelf,
    url: typeof config.llm_url === "string" ? config.llm_url : "",
    apikey: typeof config.llm_apikey === "string" ? config.llm_apikey : "",
    model: typeof config.llm_model === "string" ? config.llm_model : "",
    ...extra
  };
}
function resolvePlayerButtonState(player, status, config) {
  const enabled = status.llmEnabledAtGameStart ?? status.llmConfigAtGameStart?.enabled ?? !!config.llm_enabled;
  const controlSelf = status.llmSelfControlledAtGameStart ?? (enabled && (status.llmConfigAtGameStart?.controlSelf ?? !!config.llm_control_self));
  const effectiveConfig = toBackendInput(status, config, enabled, controlSelf);
  const seatIndex = resolvePlayerSeatIndex(player, status);
  const kind = resolveSeatBackendKind(seatIndex, effectiveConfig);
  const isExternal = kind === "openai" || kind === "agy" || kind === "codex";
  const isUnderControl = status.llmInitialHumanPlayer !== void 0 ? player === status.llmInitialHumanPlayer : player.isUnderControl(true);
  const base = derive(
    {
      gameId: status.llmGameId,
      playerName: player.getName(),
      playerSeatNum: seatIndex
    },
    {
      enabled: enabled && isExternal,
      isUnderControl,
      controlSelf
    }
  );
  const label = isExternal ? resolveBackendDisplayName(kind, effectiveConfig) : base.active ? "AI" : "";
  return {
    ...base,
    label,
    ...isExternal ? { backend: kind } : {}
  };
}
export {
  derive,
  end,
  isActive,
  reset,
  resolvePlayerButtonState,
  start
};
