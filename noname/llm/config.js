const LLM_TEXT_KEYS = ["llm_url", "llm_apikey", "llm_model"];
function isLLMTextKey(key) {
  return LLM_TEXT_KEYS.includes(key);
}
function normalizeLLMText(value, document) {
  const text = String(value ?? "");
  if (!document || !/<\/?[a-z][^>]*>/i.test(text)) return text.trim();
  const template = document.createElement("template");
  template.innerHTML = text;
  template.content.querySelectorAll("script, style").forEach((node) => node.remove());
  return (template.content.textContent ?? "").trim();
}
function llmURLProblem(value) {
  try {
    const url = new URL(value);
    if (["http:", "https:"].includes(url.protocol) && url.hostname && !/\s/.test(value) && /^https?:\/\//i.test(value)) return;
  } catch {
  }
  return "API 地址必须是完整的 http:// 或 https:// 地址";
}
function assertLLMURL(value) {
  const problem = llmURLProblem(value);
  if (problem) throw Object.assign(new Error(problem), { stage: "config" });
}
function migrateLLMTextConfig(config, save, document) {
  for (const key of LLM_TEXT_KEYS) {
    if (typeof config[key] !== "string") continue;
    const value = normalizeLLMText(config[key], document);
    if (value !== config[key]) save(key, value);
  }
}
export {
  LLM_TEXT_KEYS,
  assertLLMURL,
  isLLMTextKey,
  llmURLProblem,
  migrateLLMTextConfig,
  normalizeLLMText
};
