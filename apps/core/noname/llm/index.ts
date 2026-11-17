import { game, lib, _status, ui } from "noname";
import {
	computeSeatIndexFromMonarch,
	hasAnyConfiguredBackend,
	readBackendsFromRawConfig,
	resolveBackendDisplayName,
	resolvePlayerBackend,
	type BackendsConfigFields,
	type CLIBackendSettings,
	type ExternalBackendKind,
	type LLMBackendKind,
	type ResolvedBackend,
	type SeatBackendChoice,
} from "./backends.js";
import { llmLogger } from "./logger.js";
import { end, reset, start, type PlayerButtonLogEntry } from "./player-button-state.js";
import { normalizeLLMText } from "./config.js";
import { resetAllHarnessSessions } from "./harness/harness.js";
import { initRoundHistoryHooks, resetRoundHistory } from "./round-history.js";
import { resetOpeningSummaries } from "./character-selection/summary.js";

export interface LLMConfig extends BackendsConfigFields {
	enabled: boolean;
	controlSelf: boolean;
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
	llmSelfControlledAtGameStart?: boolean;
	llmInitialHumanPlayer?: unknown;
	llmInitialSeatIndices?: WeakMap<object, number>;
	llmGameId?: string;
	llmMultiTurnUnsupported?: boolean;
	llmMultiTurnUnsupportedByBackend?: Record<string, boolean>;
	llmOpeningPrepared?: boolean;
};

export function getLLMConfig(): Readonly<LLMConfig> {
	return (_status as LLMGameStatus).llmConfigAtGameStart ?? readLLMConfig();
}

function readLLMConfig(): LLMConfig {
	const enabled = !!lib.config.llm_enabled;
	const extra: BackendsConfigFields =
		typeof readBackendsFromRawConfig === "function"
			? readBackendsFromRawConfig(lib.config, globalThis.document)
			: {
					defaultBackend: "openai",
					openaiDisplayName: "",
					openaiContextSize: 128_000,
					agy: { displayName: "agy", command: "agy", model: "", thinkingEffort: "default", timeoutSec: 60, extraArgs: "" },
					codex: { displayName: "codex", command: "codex", model: "", thinkingEffort: "default", timeoutSec: 60, extraArgs: "" },
					seatBackends: {},
				};
	return {
		enabled,
		controlSelf: enabled && !!lib.config.llm_control_self,
		url: normalizeLLMText(lib.config.llm_url, globalThis.document),
		apikey: normalizeLLMText(lib.config.llm_apikey, globalThis.document),
		model: normalizeLLMText(lib.config.llm_model, globalThis.document),
		thinkingEffort: (lib.config.llm_thinking_effort as LLMConfig["thinkingEffort"]) || "medium",
		maxRetries: Number(lib.config.llm_max_retries) || 0,
		timeoutSec: Number(lib.config.llm_timeout) || 30,
		multiTurn: enabled,
		maxTurns: clampNumber(lib.config.llm_max_turns, 4, 1, 8),
		decisionTimeoutSec: clampNumber(lib.config.llm_decision_timeout, 60, 10, 300),
		...extra,
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

export function llmSelfControlled(): boolean {
	const config = getLLMConfig();
	return config.enabled && config.controlSelf;
}

export function llmConfigured(): boolean {
	const c = getLLMConfig();
	return hasAnyConfiguredBackend(c);
}

export { tryLLMDecide } from "./decide.js";
export { llmLogger } from "./logger.js";
export { resolveBackendDisplayName, resolvePlayerBackend, type CLIBackendSettings, type ExternalBackendKind, type LLMBackendKind, type ResolvedBackend, type SeatBackendChoice };

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

	initRoundHistoryHooks();
	if (typeof lib !== "undefined" && lib.announce?.subscribe) {
		lib.announce.subscribe("gameStart", onGameStart);
		lib.announce.subscribe("llm_log_start", onLLMLogStart);
		lib.announce.subscribe("llm_log_end", onLLMLogEnd);
	}
}

function activateLLMSelfControl(): void {
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

function clearLLMSelfControlLock(): void {
	ui?.auto?.classList?.remove?.("forcehide");
	ui?.wuxie?.classList?.remove?.("forcehide");
	ui?.shortcut?.autobutton?.classList?.remove?.("forcehide");
}

/** 普通身份选将前准备本局，但不提前启用真人全局托管锁。 */
export function prepareLLMGame(reusePrepared = false, retainOpeningResults = false): void {
	const status = _status as LLMGameStatus;
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
		seatBackends: Object.freeze({ ...raw.seatBackends }),
	});
	status.llmConfigAtGameStart = snapshot;
	if (!reuse) status.llmGameId = `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
	// 专用选将入口直接读取快照；普通牌局决策要等 gameStart 才启用。
	delete status.llmEnabledAtGameStart;
	// isMine 等引擎入口以此标记锁定真人；选将期间不能提前置 true。
	delete status.llmSelfControlledAtGameStart;
	status.llmInitialHumanPlayer = game?.me;
	const allPlayers = [...(game?.players || []), ...(game?.dead || [])];
	const monarch = (game as any)?.zhong || game?.zhu;
	const monarchAnchor = monarch && allPlayers.includes(monarch) ? monarch : undefined;
	const seatMap = new WeakMap<object, number>();
	for (const p of allPlayers) {
		if (p && typeof p === "object") {
			const settled = typeof p.getSeatNum === "function" ? Number(p.getSeatNum()) : 0;
			if (Number.isFinite(settled) && settled > 0) {
				seatMap.set(p, Math.floor(settled));
			} else {
				const byMonarch = monarchAnchor ? computeSeatIndexFromMonarch(p, monarchAnchor, allPlayers.length) : undefined;
				if (byMonarch !== undefined) {
					seatMap.set(p, byMonarch);
				} else {
					const rawPos = p.dataset?.position;
					if (rawPos !== undefined && rawPos !== "") {
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

/** 新选将流程不再使用预备状态时，正式开局重新读取本局配置。 */
export function discardLLMOpeningPreparation(): void {
	delete (_status as LLMGameStatus).llmOpeningPrepared;
}

function onGameStart(): void {
	const status = _status as LLMGameStatus;
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

function onLLMLogStart(entry: PlayerButtonLogEntry): void {
	start(entry);
	ui.updateLLMLogButtons();
}

function onLLMLogEnd(entry: PlayerButtonLogEntry): void {
	end(entry);
	ui.updateLLMLogButtons();
}

// migrateIfNeeded 需要 game.getDB，可能在引擎完全初始化后才可用。
// 导出供主入口在合适时机调用，同时尝试延迟执行。
export async function ensureLLMMigrated(): Promise<void> {
	await llmLogger.init();
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
