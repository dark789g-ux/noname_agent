import { normalizeLLMText } from "./config.js";

export type ExternalBackendKind = "openai" | "agy" | "codex";
export type LLMBackendKind = ExternalBackendKind | "local";
export type SeatBackendChoice = "default" | LLMBackendKind;
export type CLITHinkingEffort = "default" | "none" | "low" | "medium" | "high";

export const SEAT_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export interface CLIBackendSettings {
	displayName: string;
	command: string;
	model: string;
	thinkingEffort: CLITHinkingEffort;
	timeoutSec: number;
	extraArgs: string;
}

export interface BackendsConfigFields {
	defaultBackend: LLMBackendKind;
	openaiDisplayName: string;
	agy: CLIBackendSettings;
	codex: CLIBackendSettings;
	seatBackends: Record<string, SeatBackendChoice>;
}

export interface BackendConfigInput {
	enabled?: boolean;
	controlSelf?: boolean;
	url?: string;
	apikey?: string;
	model?: string;
	thinkingEffort?: string;
	maxRetries?: number;
	timeoutSec?: number;
	defaultBackend?: LLMBackendKind;
	openaiDisplayName?: string;
	agy?: Partial<CLIBackendSettings>;
	codex?: Partial<CLIBackendSettings>;
	seatBackends?: Record<string, SeatBackendChoice>;
}

export interface ResolvedBackend {
	kind: LLMBackendKind;
	label: string;
	configured: boolean;
	model: string;
	timeoutSec: number;
	maxRetries: number;
	thinkingEffort: string;
	url?: string;
	apikey?: string;
	command?: string;
	extraArgs?: string;
}

export interface SeatSubjectLike {
	getSeatNum?: () => number;
	isUnderControl?: (self?: boolean) => boolean;
	dataset?: { position?: string };
}

const KNOWN_MODEL_FAMILIES: Array<[RegExp, string]> = [
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
	[/^llama/i, "llama"],
];

export function defaultCLISettings(provider: "agy" | "codex"): CLIBackendSettings {
	return {
		displayName: provider,
		command: provider,
		model: "",
		thinkingEffort: "default",
		timeoutSec: 60,
		extraArgs: "",
	};
}

export function defaultSeatBackends(): Record<string, SeatBackendChoice> {
	const map: Record<string, SeatBackendChoice> = {};
	for (const seat of SEAT_NUMBERS) map[String(seat)] = "default";
	return map;
}

export function defaultBackendsFields(): BackendsConfigFields {
	return {
		defaultBackend: "openai",
		openaiDisplayName: "",
		agy: defaultCLISettings("agy"),
		codex: defaultCLISettings("codex"),
		seatBackends: defaultSeatBackends(),
	};
}

function normalizeBackendKind(value: unknown, fallback: LLMBackendKind = "openai"): LLMBackendKind {
	if (value === "openai" || value === "agy" || value === "codex" || value === "local") return value;
	return fallback;
}

function normalizeSeatChoice(value: unknown): SeatBackendChoice {
	if (value === "default" || value === "openai" || value === "agy" || value === "codex" || value === "local") return value;
	return "default";
}

function normalizeThinkingEffort(value: unknown): CLITHinkingEffort {
	if (value === "none" || value === "low" || value === "medium" || value === "high") return value;
	return "default";
}

function clampSeconds(value: unknown, fallback: number, min: number, max: number): number {
	const n = Number(value);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, Math.floor(n)));
}

function readCLISettings(raw: unknown, provider: "agy" | "codex"): CLIBackendSettings {
	const defaults = defaultCLISettings(provider);
	const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
	return {
		displayName: typeof source.displayName === "string" ? source.displayName.trim() : defaults.displayName,
		command: typeof source.command === "string" && source.command.trim() ? source.command.trim() : defaults.command,
		model: typeof source.model === "string" ? source.model.trim() : "",
		thinkingEffort: normalizeThinkingEffort(source.thinkingEffort),
		timeoutSec: clampSeconds(source.timeoutSec, defaults.timeoutSec, 5, 300),
		extraArgs: typeof source.extraArgs === "string" ? source.extraArgs.trim() : "",
	};
}

/** 从 lib.config 读取多后端与按顺位分配配置，保持缺失键回退安全。 */
export function readBackendsFromRawConfig(rawConfig: Record<string, any> = {}, doc?: Document): BackendsConfigFields {
	const rawSeats = rawConfig.llm_seat_backends && typeof rawConfig.llm_seat_backends === "object" ? rawConfig.llm_seat_backends : {};
	const seatBackends: Record<string, SeatBackendChoice> = {};
	for (const seat of SEAT_NUMBERS) {
		const key = String(seat);
		seatBackends[key] = normalizeSeatChoice(rawSeats[key]);
	}
	return {
		defaultBackend: normalizeBackendKind(rawConfig.llm_default_backend, "openai"),
		openaiDisplayName: normalizeLLMText(rawConfig.llm_openai_display_name, doc),
		agy: readCLISettings(rawConfig.llm_agy_config, "agy"),
		codex: readCLISettings(rawConfig.llm_codex_config, "codex"),
		seatBackends,
	};
}

/** 从 OpenAI 模型名或接口地址提取简洁 AI 名称，例如 deepseek-flash -> deepseek。 */
export function deriveOpenAIDisplayName(model?: string, url?: string): string {
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
		} catch {}
	}
	return "openai";
}

export function resolveBackendDisplayName(kind: LLMBackendKind, config: BackendConfigInput): string {
	if (kind === "local") return "";
	if (kind === "agy") return (config.agy?.displayName || "").trim() || "agy";
	if (kind === "codex") return (config.codex?.displayName || "").trim() || "codex";
	const custom = (config.openaiDisplayName || "").trim();
	return custom || deriveOpenAIDisplayName(config.model, config.url);
}

/** 优先读取已结算行动顺位（1..N），未结算前按开局桌位 dataset.position + 1 推算。 */
export function resolvePlayerSeatIndex(player?: SeatSubjectLike | null): number {
	const settled = typeof player?.getSeatNum === "function" ? Number(player.getSeatNum()) : 0;
	if (Number.isFinite(settled) && settled > 0) return Math.floor(settled);
	const rawPos = player?.dataset?.position;
	if (rawPos !== undefined && rawPos !== "") {
		const pos = Number(rawPos);
		if (Number.isFinite(pos) && pos >= 0) return Math.floor(pos) + 1;
	}
	return 1;
}

export function resolveSeatBackendKind(seatIndex: number, config: BackendConfigInput): LLMBackendKind {
	const defaultKind = normalizeBackendKind(config.defaultBackend, "openai");
	const choice = normalizeSeatChoice(config.seatBackends?.[String(seatIndex)]);
	return choice === "default" ? defaultKind : choice;
}

export function buildResolvedBackend(kind: LLMBackendKind, config: BackendConfigInput): ResolvedBackend {
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
			extraArgs: cli.extraArgs,
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
		url,
		apikey,
	};
}

export function resolvePlayerBackend(
	player: SeatSubjectLike | null | undefined,
	config: BackendConfigInput,
	status?: { llmSelfControlledAtGameStart?: boolean }
): ResolvedBackend {
	const enabled = !!config.enabled;
	const controlSelf = status?.llmSelfControlledAtGameStart ?? !!config.controlSelf;
	const isHuman = !!player?.isUnderControl?.(true);
	if (!enabled || (isHuman && !controlSelf)) {
		return buildResolvedBackend("local", config);
	}
	const seatIndex = resolvePlayerSeatIndex(player);
	const kind = resolveSeatBackendKind(seatIndex, config);
	return buildResolvedBackend(kind, config);
}

/** 解析公共战报摘要使用的外部后端：优先默认后端，其次场上首个已配置的外部后端。 */
export function resolveSummaryBackend(config: BackendConfigInput, seatIndices: number[] = []): ResolvedBackend | undefined {
	if (!config.enabled) return undefined;
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
	return undefined;
}

export function hasAnyConfiguredBackend(config: BackendConfigInput): boolean {
	const defaultKind = normalizeBackendKind(config.defaultBackend, "openai");
	if (defaultKind !== "local" && buildResolvedBackend(defaultKind, config).configured) return true;
	for (const seat of SEAT_NUMBERS) {
		const resolved = buildResolvedBackend(resolveSeatBackendKind(seat, config), config);
		if (resolved.kind !== "local" && resolved.configured) return true;
	}
	return false;
}
