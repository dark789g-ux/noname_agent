import { lib } from "noname";

export interface LLMConfig {
	enabled: boolean;
	url: string;
	apikey: string;
	model: string;
	thinkingEffort: "none" | "low" | "medium" | "high";
	maxRetries: number;
	timeoutSec: number;
}

export function getLLMConfig(): LLMConfig {
	return {
		enabled: !!lib.config.llm_enabled,
		url: String(lib.config.llm_url || ""),
		apikey: String(lib.config.llm_apikey || ""),
		model: String(lib.config.llm_model || ""),
		thinkingEffort: (lib.config.llm_thinking_effort as LLMConfig["thinkingEffort"]) || "medium",
		maxRetries: Number(lib.config.llm_max_retries) || 0,
		timeoutSec: Number(lib.config.llm_timeout) || 30,
	};
}

export function llmEnabled(): boolean {
	return getLLMConfig().enabled;
}

export function llmConfigured(): boolean {
	const c = getLLMConfig();
	return !!(c.url && c.apikey && c.model);
}

export { tryLLMDecide } from "./decide.js";
export { llmLogger } from "./logger.js";
