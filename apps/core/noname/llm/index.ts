import { lib, _status, ui } from "noname";
import { llmLogger } from "./logger.js";

export interface LLMConfig {
	enabled: boolean;
	url: string;
	apikey: string;
	model: string;
	thinkingEffort: "none" | "low" | "medium" | "high";
	maxRetries: number;
	timeoutSec: number;
	multiTurn: boolean;
	maxTurns: number;
	decisionTimeoutSec: number;
}

type LLMGameStatus = {
	llmConfigAtGameStart?: Readonly<LLMConfig>;
	llmEnabledAtGameStart?: boolean;
	llmGameId?: string;
	llmMultiTurnUnsupported?: boolean;
};

export function getLLMConfig(): Readonly<LLMConfig> {
	return (_status as LLMGameStatus).llmConfigAtGameStart ?? readLLMConfig();
}

function readLLMConfig(): LLMConfig {
	const multiTurn = !!lib.config.llm_multi_turn;
	return {
		enabled: !!lib.config.llm_enabled,
		url: String(lib.config.llm_url || ""),
		apikey: String(lib.config.llm_apikey || ""),
		model: String(lib.config.llm_model || ""),
		thinkingEffort: (lib.config.llm_thinking_effort as LLMConfig["thinkingEffort"]) || "medium",
		maxRetries: Number(lib.config.llm_max_retries) || 0,
		timeoutSec: Number(lib.config.llm_timeout) || 30,
		multiTurn,
		maxTurns: multiTurn ? clampNumber(lib.config.llm_max_turns, 4, 1, 8) : 1,
		decisionTimeoutSec: clampNumber(lib.config.llm_decision_timeout, 60, 10, 300),
	};
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
	const number = Number(value);
	if (!Number.isFinite(number)) return fallback;
	return Math.min(max, Math.max(min, Math.floor(number)));
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

// ---------------------------------------------------------------------------
// gameStart 钩子：开局快照 LLM 启用状态 + 生成 gameId
// ---------------------------------------------------------------------------

let gameHooksInitialized = false;

/**
 * 注册 gameStart 钩子：开局生成 gameId + 快照 llmEnabled 状态。
 * 幂等——重复调用不会重复注册。
 * 由模块加载时自动调用（见文件末尾）。
 */
export function initLLMGameHooks(): void {
	if (gameHooksInitialized) return;
	gameHooksInitialized = true;

	if (typeof lib !== "undefined" && lib.announce?.subscribe) {
		lib.announce.subscribe("gameStart", onGameStart);
	}
}

function onGameStart(): void {
	const status = _status as LLMGameStatus;
	delete status.llmConfigAtGameStart;
	const snapshot = Object.freeze({ ...readLLMConfig() });
	status.llmConfigAtGameStart = snapshot;
	status.llmGameId = `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
	status.llmEnabledAtGameStart = snapshot.enabled;
	delete status.llmMultiTurnUnsupported;
	ui.updateLLMLogButtons();
}

// migrateIfNeeded 需要 game.getDB，可能在引擎完全初始化后才可用。
// 导出供主入口在合适时机调用，同时尝试延迟执行。
export async function ensureLLMMigrated(): Promise<void> {
	await llmLogger.migrateIfNeeded();
}

// ---------------------------------------------------------------------------
// 本模块为「纯 API 模块」——顶层零副作用。
//
// 初始化由 init/index.ts 的 bootImpl() 通过动态 import 显式调用：
//     const { initLLMGameHooks } = await import("@/llm/index.js");
//     initLLMGameHooks();
//
// 【严禁】在本模块顶层调用 initLLMGameHooks() 或访问 lib.xxx / _status.xxx。
// 原因：content.ts:8 静态 import 本模块，而 content.ts 在 library 初始化链中：
//     noname.js → library/index.js → element/index.js → content.ts → 本模块 → noname.js
// 顶层执行本模块时 noname.js 中 `export let lib` 尚未赋值，会触发 TDZ。
// ---------------------------------------------------------------------------
