import "../../../../../../../../noname.js";
import { readBackendsFromRawConfig, resolveBackendDisplayName } from "../../../../../../../llm/backends.js";
import { normalizeLLMText } from "../../../../../../../llm/config.js";
import { lib } from "../../../../../../../library/index.js";
const CLI_BACKEND_TABS = [
  { key: "openai", label: "OpenAI 兼容 API" },
  { key: "agy", label: "agy CLI" },
  { key: "codex", label: "codex CLI" }
];
const THINKING_EFFORT_OPTIONS = [
  { value: "none", label: "无" },
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" }
];
function clampInt(raw, fallback, min, max) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
function readBackendLabels() {
  const extra = readBackendsFromRawConfig(lib.config, document);
  const model = normalizeLLMText(lib.config.llm_model, document);
  const url = normalizeLLMText(lib.config.llm_url, document);
  return {
    openai: resolveBackendDisplayName("openai", { openaiDisplayName: extra.openaiDisplayName, model, url }),
    agy: resolveBackendDisplayName("agy", { agy: extra.agy }),
    codex: resolveBackendDisplayName("codex", { codex: extra.codex })
  };
}
export {
  CLI_BACKEND_TABS,
  THINKING_EFFORT_OPTIONS,
  clampInt,
  readBackendLabels
};
