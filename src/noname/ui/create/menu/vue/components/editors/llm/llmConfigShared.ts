import { lib } from "noname";
import { readBackendsFromRawConfig, resolveBackendDisplayName, type ExternalBackendKind } from "@/llm/backends.js";
import { normalizeLLMText } from "@/llm/config.js";

export interface BackendLabelsMap {
	openai: string;
	agy: string;
	codex: string;
}

export const CLI_BACKEND_TABS: ReadonlyArray<{ key: ExternalBackendKind; label: string }> = [
	{ key: "openai", label: "OpenAI 兼容 API" },
	{ key: "agy", label: "agy CLI" },
	{ key: "codex", label: "codex CLI" },
];

export const THINKING_EFFORT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
	{ value: "none", label: "无" },
	{ value: "low", label: "低" },
	{ value: "medium", label: "中" },
	{ value: "high", label: "高" },
];

export function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
	const n = Number(raw);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, Math.floor(n)));
}

export function readBackendLabels(): BackendLabelsMap {
	const extra = readBackendsFromRawConfig(lib.config, document);
	const model = normalizeLLMText(lib.config.llm_model, document);
	const url = normalizeLLMText(lib.config.llm_url, document);
	return {
		openai: resolveBackendDisplayName("openai", { openaiDisplayName: extra.openaiDisplayName, model, url }),
		agy: resolveBackendDisplayName("agy", { agy: extra.agy }),
		codex: resolveBackendDisplayName("codex", { codex: extra.codex }),
	};
}
