import { normalizeLLMText } from "./config.js";
const SEAT_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const DEFAULT_OPENAI_CONTEXT_SIZE = 128e3;
const AGY_MODEL_OPTIONS = [
  "gemini-4-carbon-medium",
  "gemini-4-carbon-high",
  "gemini-4-carbon-low",
  "gemini-4-argon-medium",
  "gemini-4-argon-high",
  "gemini-4-argon-low",
  "gemini-4-hydrogen-high",
  "gemini-4-hydrogen-xhigh",
  "gemini-4-hydrogen-medium",
  "gemini-4-hydrogen-low",
  "gemini-pro-orchestrator",
  "gemini-pro-orchestrator-argon",
  "gemini-3.8-flash-high",
  "gemini-3.8-flash-medium",
  "gemini-3.8-flash-low",
  "claude-opus-5-5-low",
  "claude-opus-5-5-medium",
  "claude-opus-5-5-high",
  "claude-sonnet-5-5-low",
  "claude-sonnet-5-5-medium",
  "claude-sonnet-5-5-high",
  "gpt-oss-120b-medium"
];
const CODEX_MODEL_OPTIONS = [
  "gpt-6.1-sol",
  "gpt-6-astra",
  "gpt-6.1-terra",
  "gpt-6-sol",
  "gpt-6-luna",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna"
];
function getCLIModelOptions(provider) {
  return provider === "agy" ? AGY_MODEL_OPTIONS : CODEX_MODEL_OPTIONS;
}
const KNOWN_MODEL_FAMILIES = [
  [/^deepseek/i, "deepseek"],
  [/^(gpt|chatgpt)/i, "gpt"],
  [/^o[134]($|[-_.])/i, "openai"],
  [/^claude/i, "claude"],
  [/^gemini/i, "gemini"],
  [/^qwen/i, "qwen"],
  [/^glm/i, "glm"],
  [/^(kimi|moonshot)/i, "kimi"],
  [/^doubao/i, "doubao"],
  [/^grok/i, "grok"],
  [/^yi($|[-_.])/i, "yi"],
  [/^(mistral|codestral)/i, "mistral"],
  [/^llama/i, "llama"]
];
function defaultCLISettings(provider) {
  return {
    displayName: provider,
    command: provider,
    model: "",
    thinkingEffort: "default",
    timeoutSec: 60,
    extraArgs: ""
  };
}
function defaultSeatBackends() {
  const map = {};
  for (const seat of SEAT_NUMBERS) map[String(seat)] = "default";
  return map;
}
function defaultBackendsFields() {
  return {
    defaultBackend: "openai",
    openaiDisplayName: "",
    openaiContextSize: DEFAULT_OPENAI_CONTEXT_SIZE,
    agy: defaultCLISettings("agy"),
    codex: defaultCLISettings("codex"),
    seatBackends: defaultSeatBackends()
  };
}
function normalizeBackendKind(value, fallback = "openai") {
  if (value === "openai" || value === "agy" || value === "codex" || value === "local") return value;
  return fallback;
}
function normalizeSeatChoice(value) {
  if (value === "default" || value === "openai" || value === "agy" || value === "codex" || value === "local") return value;
  return "default";
}
function normalizeThinkingEffort(value) {
  if (value === "none" || value === "low" || value === "medium" || value === "high") return value;
  return "default";
}
function clampSeconds(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
function readCLISettings(raw, provider) {
  const defaults = defaultCLISettings(provider);
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    displayName: typeof source.displayName === "string" ? source.displayName.trim() : defaults.displayName,
    command: typeof source.command === "string" && source.command.trim() ? source.command.trim() : defaults.command,
    model: typeof source.model === "string" ? source.model.trim() : "",
    thinkingEffort: normalizeThinkingEffort(source.thinkingEffort),
    timeoutSec: clampSeconds(source.timeoutSec, defaults.timeoutSec, 5, 300),
    extraArgs: typeof source.extraArgs === "string" ? source.extraArgs.trim() : ""
  };
}
function readBackendsFromRawConfig(rawConfig = {}, doc) {
  const rawSeats = rawConfig.llm_seat_backends && typeof rawConfig.llm_seat_backends === "object" ? rawConfig.llm_seat_backends : {};
  const seatBackends = {};
  for (const seat of SEAT_NUMBERS) {
    const key = String(seat);
    seatBackends[key] = normalizeSeatChoice(rawSeats[key]);
  }
  return {
    defaultBackend: normalizeBackendKind(rawConfig.llm_default_backend, "openai"),
    openaiDisplayName: normalizeLLMText(rawConfig.llm_openai_display_name, doc),
    openaiContextSize: clampSeconds(rawConfig.llm_context_size, DEFAULT_OPENAI_CONTEXT_SIZE, 4096, 2e6),
    agy: readCLISettings(rawConfig.llm_agy_config, "agy"),
    codex: readCLISettings(rawConfig.llm_codex_config, "codex"),
    seatBackends
  };
}
function deriveOpenAIDisplayName(model, url) {
  const cleanModel = (model || "").trim();
  const modelBase = cleanModel.includes("/") ? cleanModel.slice(cleanModel.lastIndexOf("/") + 1) : cleanModel;
  for (const [pattern, label] of KNOWN_MODEL_FAMILIES) {
    if (pattern.test(modelBase)) return label;
  }
  const token = modelBase.split(/[-_:\s.]/)[0]?.trim() || "";
  if (token && /^[a-z0-9\u4e00-\u9fa5]+$/i.test(token)) return token.toLowerCase();
  const cleanUrl = (url || "").trim();
  if (cleanUrl) {
    try {
      const host = new URL(cleanUrl).hostname.toLowerCase();
      if (host && host !== "localhost" && !/^\d+(\.\d+){3}$/.test(host)) {
        const stripped = host.replace(/^(api|llm|ai|open|gateway)\./, "");
        const hostToken = stripped.split(".")[0]?.trim();
        if (hostToken) return hostToken;
      }
    } catch {
    }
  }
  return "openai";
}
function resolveBackendDisplayName(kind, config) {
  if (kind === "local") return "";
  if (kind === "agy") return (config.agy?.displayName || "").trim() || "agy";
  if (kind === "codex") return (config.codex?.displayName || "").trim() || "codex";
  const custom = (config.openaiDisplayName || "").trim();
  return custom || deriveOpenAIDisplayName(config.model, config.url);
}
function parseDatasetPosition(player) {
  const rawPos = player?.dataset?.position;
  if (rawPos === void 0 || rawPos === "") return void 0;
  const pos = Number(rawPos);
  return Number.isFinite(pos) && pos >= 0 ? Math.floor(pos) : void 0;
}
function computeSeatIndexFromMonarch(player, monarch, playerCount) {
  const count = Math.floor(Number(playerCount));
  if (!Number.isFinite(count) || count <= 0) return void 0;
  const playerPos = parseDatasetPosition(player);
  const monarchPos = parseDatasetPosition(monarch);
  if (playerPos === void 0 || monarchPos === void 0) return void 0;
  return ((playerPos - monarchPos) % count + count) % count + 1;
}
function resolvePlayerSeatIndex(player, status, anchor) {
  const settled = typeof player?.getSeatNum === "function" ? Number(player.getSeatNum()) : 0;
  if (Number.isFinite(settled) && settled > 0) return Math.floor(settled);
  if (player && typeof player === "object" && status?.llmInitialSeatIndices?.has(player)) {
    return status.llmInitialSeatIndices.get(player);
  }
  if (anchor?.monarch && anchor?.playerCount) {
    const byMonarch = computeSeatIndexFromMonarch(player, anchor.monarch, anchor.playerCount);
    if (byMonarch !== void 0) return byMonarch;
  }
  const pos = parseDatasetPosition(player);
  if (pos !== void 0) return pos + 1;
  return 1;
}
function resolveSeatBackendKind(seatIndex, config) {
  const defaultKind = normalizeBackendKind(config.defaultBackend, "openai");
  const choice = normalizeSeatChoice(config.seatBackends?.[String(seatIndex)]);
  return choice === "default" ? defaultKind : choice;
}
function buildResolvedBackend(kind, config) {
  const label = resolveBackendDisplayName(kind, config);
  if (kind === "local") {
    return { kind: "local", label: "", configured: false, model: "", timeoutSec: 0, maxRetries: 0, thinkingEffort: "none" };
  }
  if (kind === "agy" || kind === "codex") {
    const cli = readCLISettings(kind === "agy" ? config.agy : config.codex, kind);
    return {
      kind,
      label,
      configured: !!cli.command.trim(),
      model: cli.model,
      timeoutSec: cli.timeoutSec,
      maxRetries: 0,
      thinkingEffort: cli.thinkingEffort,
      command: cli.command,
      extraArgs: cli.extraArgs
    };
  }
  const url = (config.url || "").trim();
  const apikey = (config.apikey || "").trim();
  const model = (config.model || "").trim();
  return {
    kind: "openai",
    label,
    configured: !!(url && apikey && model),
    model,
    timeoutSec: clampSeconds(config.timeoutSec, 30, 1, 300),
    maxRetries: clampSeconds(config.maxRetries, 0, 0, 3),
    thinkingEffort: config.thinkingEffort || "medium",
    contextSize: clampSeconds(config.openaiContextSize, DEFAULT_OPENAI_CONTEXT_SIZE, 4096, 2e6),
    url,
    apikey
  };
}
function resolvePlayerBackend(player, config, status) {
  const enabled = !!config.enabled;
  const controlSelf = status?.llmSelfControlledAtGameStart ?? !!config.controlSelf;
  const isHuman = status?.llmInitialHumanPlayer !== void 0 ? player === status.llmInitialHumanPlayer : !!player?.isUnderControl?.(true);
  if (!enabled || isHuman && !controlSelf) {
    return buildResolvedBackend("local", config);
  }
  const seatIndex = resolvePlayerSeatIndex(player, status);
  const kind = resolveSeatBackendKind(seatIndex, config);
  return buildResolvedBackend(kind, config);
}
function resolveSummaryBackend(config, seatIndices = []) {
  if (!config.enabled) return void 0;
  const defaultKind = normalizeBackendKind(config.defaultBackend, "openai");
  if (defaultKind !== "local") {
    const primary = buildResolvedBackend(defaultKind, config);
    if (primary.configured) return primary;
  }
  const seats = seatIndices.length ? seatIndices : [...SEAT_NUMBERS];
  for (const seat of seats) {
    const resolved = buildResolvedBackend(resolveSeatBackendKind(seat, config), config);
    if (resolved.kind !== "local" && resolved.configured) return resolved;
  }
  return void 0;
}
function hasAnyConfiguredBackend(config) {
  const defaultKind = normalizeBackendKind(config.defaultBackend, "openai");
  if (defaultKind !== "local" && buildResolvedBackend(defaultKind, config).configured) return true;
  for (const seat of SEAT_NUMBERS) {
    const resolved = buildResolvedBackend(resolveSeatBackendKind(seat, config), config);
    if (resolved.kind !== "local" && resolved.configured) return true;
  }
  return false;
}
export {
  AGY_MODEL_OPTIONS,
  CODEX_MODEL_OPTIONS,
  DEFAULT_OPENAI_CONTEXT_SIZE,
  SEAT_NUMBERS,
  buildResolvedBackend,
  computeSeatIndexFromMonarch,
  defaultBackendsFields,
  defaultCLISettings,
  defaultSeatBackends,
  deriveOpenAIDisplayName,
  getCLIModelOptions,
  hasAnyConfiguredBackend,
  readBackendsFromRawConfig,
  resolveBackendDisplayName,
  resolvePlayerBackend,
  resolvePlayerSeatIndex,
  resolveSeatBackendKind,
  resolveSummaryBackend
};
