import { _status, game, get, lib, ui } from "noname";
import { resolvePlayerSeatIndex, resolveSummaryBackend, type ResolvedBackend } from "./backends.js";
import { assertLLMURL } from "./config.js";
import type { StreamCallbacks, ToolCallResult } from "./client.js";
import { getLLMConfig, llmEnabled } from "./index.js";
import { llmLogger } from "./logger.js";
import { remainingTimeoutSec } from "./protocol.js";
import {
	buildDiscardPileReport,
	buildFallbackRoundSummary,
	buildRoundSummaryMessages,
	clampSummaryText,
	cleanBattleLogText,
	formatBattleLogArgs,
	isRedundantTurnStartLog,
	SUBMIT_ROUND_SUMMARY_TOOL,
	submitRoundSummaryTool,
	type DiscardCardInput,
	type DiscardPileReport,
	type RoundHistoryInput,
	type RoundLogEntry,
} from "./prompt-history.js";

const MAX_ROUND_SUMMARY_WAIT_MS = 12_000;
const ROUND_SUMMARY_TIMEOUT_CAP_SEC = 30;
const MAX_BUFFER_PER_ROUND = 240;

interface RoundHistoryState {
	currentRound: number;
	currentEntries: RoundLogEntry[];
	rollingSummary: string;
	summarizedThroughRound: number;
	pendingFallbackSummary?: string;
	pendingThroughRound?: number;
	summaryChain: Promise<void> | null;
}

export interface RoundSummaryTransport {
	callLLMStream(messages: any[], tools: any[], config: any, callbacks?: StreamCallbacks): Promise<ToolCallResult>;
	callLLMWithTimeout(messages: any[], tools: any[], config: any): Promise<ToolCallResult>;
}

let hooksInitialized = false;
let privateGiveDepth = 0;
let summaryTransport: RoundSummaryTransport | null = null;
let state: RoundHistoryState = createInitialState();

/** 由 decide.ts 注入底层请求实现，避免 index.ts 在纯配置测试环境中静态拉入 openai SDK。 */
export function registerRoundSummaryClient(transport: RoundSummaryTransport): void {
	summaryTransport = transport;
}

function createInitialState(): RoundHistoryState {
	return {
		currentRound: 0,
		currentEntries: [],
		rollingSummary: "",
		summarizedThroughRound: 0,
		summaryChain: null,
	};
}

/** 注册轮次切换订阅与 game.log / $giveAuto 战报采集包装（幂等）。 */
export function initRoundHistoryHooks(): void {
	if (!hooksInitialized) {
		hooksInitialized = true;
		if (typeof lib !== "undefined" && lib.announce?.subscribe) {
			lib.announce.subscribe("roundStart", onRoundStart);
		}
	}
	installRuntimeWrappers();
}

/** 开局重置轮次历史缓存。 */
export function resetRoundHistory(): void {
	state = createInitialState();
	privateGiveDepth = 0;
	installRuntimeWrappers();
}

/** 读取当前轮次号（开局未进轮时为 0）。 */
export function getCurrentRoundNumber(): number {
	const value = Number((game as { roundNumber?: unknown })?.roundNumber ?? 0);
	return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** 读取当前摸牌堆剩余张数（兼容联机客户端 cardPileNum）。 */
export function getDrawPileCount(): number {
	if ((game as { online?: boolean })?.online && typeof (_status as { cardPileNum?: unknown })?.cardPileNum === "number") {
		return Math.max(0, (_status as { cardPileNum: number }).cardPileNum);
	}
	return ui?.cardPile?.childNodes?.length ?? 0;
}

/** 读取当前弃牌堆总张数。 */
export function getDiscardPileCount(): number {
	return ui?.discardPile?.childNodes?.length ?? 0;
}

/** 读取本局已洗牌次数。 */
export function getShuffleCount(): number {
	const value = Number((game as { shuffleNumber?: unknown })?.shuffleNumber ?? 0);
	return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** 读取当前弃牌堆全部卡牌明细与统计报告。 */
export function readDiscardPileReport(): DiscardPileReport {
	const rawNodes = Array.from((ui?.discardPile?.childNodes as ArrayLike<any>) || []);
	const separator = (lib as { natureSeparator?: string })?.natureSeparator || "|";
	const cards: DiscardCardInput[] = rawNodes.map(card => {
		const rawName = typeof card?.name === "string" ? card.name : "";
		const name = rawName ? cleanBattleLogText(get.translation?.(rawName) || rawName) : "未知卡牌";
		const rawNature = get.nature?.(card, false) ?? card?.nature;
		const natureText = Array.isArray(rawNature) ? rawNature.join("|") : typeof rawNature === "string" ? rawNature : "";
		const nature = natureText
			? natureText
					.split(separator)
					.filter(Boolean)
					.map(seg => lib?.translate?.[`nature_${seg}`] || lib?.translate?.[seg] || seg)
					.join("|")
			: undefined;
		const rawSuit = get.suit?.(card, false) ?? card?.suit;
		return {
			name,
			rawName,
			nature,
			suit: typeof rawSuit === "string" ? rawSuit : undefined,
			number: get.number?.(card, false) ?? card?.number,
		};
	});
	return buildDiscardPileReport(cards);
}

/** 获取供 Prompt 注入的前情摘要与当前轮次事件流水快照。 */
export function getPromptHistorySnapshot(): RoundHistoryInput {
	const engineRound = getCurrentRoundNumber();
	syncRoundTransition(engineRound);
	const currentRound = state.currentRound > 0 ? state.currentRound : engineRound;
	const rollingSummary = state.pendingFallbackSummary ?? state.rollingSummary;
	const summarizedThroughRound = state.pendingThroughRound ?? state.summarizedThroughRound;
	return {
		rollingSummary: rollingSummary || undefined,
		summarizedThroughRound: summarizedThroughRound || undefined,
		currentRound,
		entries: state.currentEntries.slice(),
	};
}

/** 若存在后台在途轮次总结，按剩余决策超时预算有限等待；超时立即放行并使用兜底摘要。 */
export async function ensureRoundSummaryReady(deadline: number): Promise<void> {
	const activeChain = state.summaryChain;
	if (!activeChain) return;
	const remainingMs = deadline - Date.now();
	const waitMs = Math.min(MAX_ROUND_SUMMARY_WAIT_MS, Math.max(0, Math.floor(remainingMs * 0.4)));
	if (waitMs <= 50) return;
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		await Promise.race([
			activeChain,
			new Promise<void>(resolve => {
				timer = setTimeout(resolve, waitMs);
			}),
		]);
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}

function installRuntimeWrappers(): void {
	const playerProto = (lib as any)?.element?.Player?.prototype;
	if (playerProto && typeof playerProto.$giveAuto === "function" && !playerProto.$giveAuto.__llmWrapped) {
		const originalGiveAuto = playerProto.$giveAuto;
		const wrappedGiveAuto = function (this: unknown, ...args: unknown[]) {
			privateGiveDepth++;
			try {
				return originalGiveAuto.apply(this, args);
			} finally {
				privateGiveDepth = Math.max(0, privateGiveDepth - 1);
			}
		};
		wrappedGiveAuto.__llmWrapped = true;
		playerProto.$giveAuto = wrappedGiveAuto;
	}

	if (typeof game !== "undefined" && typeof game.log === "function" && !(game.log as any).__llmWrapped) {
		const originalLog = game.log;
		const wrappedLog = function (this: unknown, ...args: unknown[]) {
			const result = originalLog.apply(this, args);
			try {
				captureGameLog(args);
			} catch {
				// 战报采集异常绝不影响游戏主流程
			}
			return result;
		};
		(wrappedLog as any).__llmWrapped = true;
		game.log = wrappedLog as typeof game.log;
	}
}

function onRoundStart(payload?: { roundNumber?: number }): void {
	const nextRound = typeof payload?.roundNumber === "number" && payload.roundNumber > 0 ? Math.floor(payload.roundNumber) : getCurrentRoundNumber();
	syncRoundTransition(nextRound);
}

function syncRoundTransition(nextRound: number): void {
	if (nextRound <= 0) return;
	if (state.currentRound === 0 && nextRound === 1) {
		state.currentRound = 1;
		return;
	}
	if (nextRound === state.currentRound) return;

	// 支持正常换轮（nextRound > currentRound）及 BOSS 多阶段重置（nextRound < currentRound）
	const completedRound = state.currentRound > 0 ? state.currentRound : Math.max(1, nextRound - 1);
	const completedEntries = state.currentEntries.slice();
	state.currentRound = nextRound;
	state.currentEntries = [];

	if (!completedEntries.length) return;
	if (!(_status as { llmEnabledAtGameStart?: boolean })?.llmEnabledAtGameStart) return;

	const baseSummary = state.pendingFallbackSummary ?? state.rollingSummary;
	state.pendingFallbackSummary = buildFallbackRoundSummary(baseSummary, completedRound, completedEntries);
	state.pendingThroughRound = completedRound;

	const gameId = (_status as { llmGameId?: string })?.llmGameId || "game_unknown";
	enqueueRoundSummary(gameId, completedRound, completedEntries);
}

function captureGameLog(args: unknown[]): void {
	if ((_status as { video?: boolean })?.video) return;
	if (!(_status as { llmEnabledAtGameStart?: boolean })?.llmEnabledAtGameStart && !lib?.config?.llm_enabled) return;
	if (!args.length) return;

	const engineRound = getCurrentRoundNumber();
	syncRoundTransition(engineRound);

	const text = formatBattleLogArgs(
		args,
		{
			getItemType: value => String(get.itemtype?.(value as any) || ""),
			translate: value => String(get.translation?.(value as any) ?? value ?? ""),
			isHistoryBarNode: value => Boolean(ui?.historybar && (value as { parentNode?: unknown })?.parentNode === ui.historybar),
			cnNumber: count => String(get.cnNumber?.(count) ?? count),
		},
		privateGiveDepth > 0
	);
	if (!text) return;

	const effectiveRound = state.currentRound > 0 ? state.currentRound : engineRound;
	const { turnHeader, currentPhaseName } = resolveTurnContext(effectiveRound);
	if (isRedundantTurnStartLog(text, currentPhaseName)) return;

	state.currentEntries.push({ turnHeader, text });
	if (state.currentEntries.length > MAX_BUFFER_PER_ROUND) {
		state.currentEntries.splice(0, state.currentEntries.length - MAX_BUFFER_PER_ROUND);
	}
}

function resolveTurnContext(roundNumber: number): { turnHeader: string; currentPhaseName?: string } {
	const phasePlayer = (_status as { currentPhase?: any })?.currentPhase;
	if (phasePlayer && (get.itemtype?.(phasePlayer) === "player" || typeof phasePlayer.getSeatNum === "function" || phasePlayer.name)) {
		const rawSeat = typeof phasePlayer.getSeatNum === "function" ? Number(phasePlayer.getSeatNum()) : Number(phasePlayer.seat || 0);
		const name = cleanBattleLogText(get.translation?.(phasePlayer) || phasePlayer.name || "未知角色");
		const seatPrefix = Number.isInteger(rawSeat) && rawSeat > 0 ? `[${rawSeat}号位] ` : "";
		return {
			turnHeader: `${seatPrefix}${name}的回合`,
			currentPhaseName: name,
		};
	}
	return { turnHeader: roundNumber <= 0 ? "开局阶段" : "回合外" };
}

function enqueueRoundSummary(gameId: string, completedRound: number, completedEntries: RoundLogEntry[]): void {
	const previous = state.summaryChain ?? Promise.resolve();
	const run = previous.then(async () => {
		if (((_status as { llmGameId?: string })?.llmGameId || "game_unknown") !== gameId) return;
		const prevSummary = state.rollingSummary;
		const summary = await requestRoundSummary(prevSummary, completedRound, completedEntries);
		if (((_status as { llmGameId?: string })?.llmGameId || "game_unknown") !== gameId) return;
		state.rollingSummary = summary;
		state.summarizedThroughRound = completedRound;
	});
	const tracked = run.finally(() => {
		if (state.summaryChain === tracked && ((_status as { llmGameId?: string })?.llmGameId || "game_unknown") === gameId) {
			state.pendingFallbackSummary = undefined;
			state.pendingThroughRound = undefined;
			state.summaryChain = null;
		}
	});
	state.summaryChain = tracked;
}

function collectRoundSeatIndices(): number[] {
	const players = Array.from((game as { players?: unknown[] })?.players || []);
	return players.map(player => resolvePlayerSeatIndex(player as any));
}

async function requestRoundSummary(prevSummary: string, completedRound: number, completedEntries: RoundLogEntry[]): Promise<string> {
	const fallbackText = buildFallbackRoundSummary(prevSummary, completedRound, completedEntries);
	if (!summaryTransport || !llmEnabled()) return fallbackText;

	const config = getLLMConfig();
	const summaryBackend =
		typeof resolveSummaryBackend === "function"
			? resolveSummaryBackend(config, collectRoundSeatIndices())
			: {
					kind: "openai" as const,
					label: config.model || "openai",
					configured: !!(config.url && config.apikey && config.model),
					model: config.model,
					timeoutSec: config.timeoutSec,
					maxRetries: config.maxRetries,
					thinkingEffort: config.thinkingEffort,
					url: config.url,
					apikey: config.apikey,
				};
	if (!summaryBackend || !summaryBackend.configured) return fallbackText;

	const timeoutSec = Math.max(5, Math.min(summaryBackend.timeoutSec || 30, ROUND_SUMMARY_TIMEOUT_CAP_SEC));
	const deadline = Date.now() + timeoutSec * 1000;
	const logId = llmLogger.start(
		"roundSummary",
		`[全局轮次总结·第${completedRound}轮]`,
		{
			enabled: config.enabled,
			configured: true,
			model: summaryBackend.model || summaryBackend.label,
			backend: summaryBackend.kind,
			providerLabel: summaryBackend.label,
		},
		-1,
		deadline
	);

	try {
		if (summaryBackend.kind === "openai") assertLLMURL(summaryBackend.url || "");
		const messages = buildRoundSummaryMessages(prevSummary, completedRound, completedEntries);
		const tools = [submitRoundSummaryTool()];
		llmLogger.logRequest(logId, messages, tools);
		const toolCall = await callSummaryTool(messages, tools, summaryBackend, deadline, logId);
		const rawSummary = typeof toolCall.arguments?.summary === "string" ? toolCall.arguments.summary : "";
		if (toolCall.name !== SUBMIT_ROUND_SUMMARY_TOOL || !cleanBattleLogText(rawSummary)) {
			throw Object.assign(new Error(`Invalid summary tool response: ${toolCall.name}`), { stage: "parse" });
		}
		const normalized = clampSummaryText(rawSummary, 350);
		llmLogger.logResponse(logId, toolCall, normalized);
		llmLogger.end(logId, "success");
		return normalized;
	} catch (error: any) {
		const stage = error?.stage || "fetch";
		const message = error?.message || String(error);
		llmLogger.logError(logId, stage, message, error?.httpStatus);
		llmLogger.endFallback(logId, stage === "fetch" && message.includes("timed out") ? "timeout" : message);
		return fallbackText;
	}
}

async function callSummaryTool(messages: any[], tools: any[], backend: ResolvedBackend, deadline: number, logId: string): Promise<ToolCallResult> {
	const transport = summaryTransport!;
	let attemptIndex = 0;
	try {
		llmLogger.startRequestAttempt(logId, 0, attemptIndex, "stream");
		const result = await transport.callLLMStream(messages, tools, { ...backend, timeoutSec: remainingTimeoutSec(backend.timeoutSec, deadline) }, {
			onChunk: partial => llmLogger.logStreamChunk(logId, partial),
			onFirstChunk: () => llmLogger.markRequestFirstChunk(logId, 0, attemptIndex),
			onFirstToken: () => llmLogger.markRequestTTFT(logId, 0, attemptIndex),
		});
		llmLogger.finishRequestAttempt(logId, 0, attemptIndex, "success");
		return result;
	} catch (streamError: any) {
		llmLogger.finishRequestAttempt(logId, 0, attemptIndex, "error", streamError?.stage);
		if (["parse", "config"].includes(streamError?.stage)) throw streamError;
		attemptIndex++;
		llmLogger.startRequestAttempt(logId, 0, attemptIndex, "nonstream");
		try {
			const result = await transport.callLLMWithTimeout(messages, tools, { ...backend, timeoutSec: remainingTimeoutSec(backend.timeoutSec, deadline) });
			llmLogger.finishRequestAttempt(logId, 0, attemptIndex, "success");
			return result;
		} catch (error: any) {
			llmLogger.finishRequestAttempt(logId, 0, attemptIndex, "error", error?.stage);
			throw error;
		}
	}
}
