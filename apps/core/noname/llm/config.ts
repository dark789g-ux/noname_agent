export const LLM_TEXT_KEYS = ["llm_url", "llm_apikey", "llm_model"] as const;
export type LLMTextKey = (typeof LLM_TEXT_KEYS)[number];

export function isLLMTextKey(key: unknown): key is LLMTextKey {
	return LLM_TEXT_KEYS.includes(key as LLMTextKey);
}

/** 仅解析历史富文本；template 的内容不进入文档，也不执行脚本。 */
export function normalizeLLMText(value: unknown, document?: Document): string {
	const text = String(value ?? "");
	if (!document || !/<\/?[a-z][^>]*>/i.test(text)) return text.trim();
	const template = document.createElement("template");
	template.innerHTML = text;
	template.content.querySelectorAll("script, style").forEach(node => node.remove());
	return (template.content.textContent ?? "").trim();
}

export function llmURLProblem(value: string): string | undefined {
	try {
		const url = new URL(value);
		if (["http:", "https:"].includes(url.protocol) && url.hostname && !/\s/.test(value) && /^https?:\/\//i.test(value)) return;
	} catch {}
	return "API 地址必须是完整的 http:// 或 https:// 地址";
}

export function assertLLMURL(value: string): void {
	const problem = llmURLProblem(value);
	if (problem) throw Object.assign(new Error(problem), { stage: "config" });
}

/** 启动加载后、菜单和开局快照建立前修复历史输入。 */
export function migrateLLMTextConfig(config: Record<string, any>, save: (key: string, value: string) => unknown, document?: Document): void {
	for (const key of LLM_TEXT_KEYS) {
		if (typeof config[key] !== "string") continue;
		const value = normalizeLLMText(config[key], document);
		if (value !== config[key]) save(key, value);
	}
}
