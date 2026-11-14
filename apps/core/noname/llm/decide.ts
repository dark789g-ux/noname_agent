import { _status, game, get, lib, ui } from "noname";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import { llmLogger } from "./logger.js";
import { llmEnabled, getLLMConfig } from "./index.js";
import { resolvePlayerBackend, type ResolvedBackend } from "./backends.js";
import { callCliStream, callCliWithTimeout } from "./cli-client.js";
import { buildContext } from "./context.js";
import { buildTools, INSPECT_DISCARD_PILE_TOOL } from "./tools.js";
import { assertExecutableSnapshot, buildCandidateSnapshot } from "./action-candidates.js";
import { getCandidateCards, getCandidateSkills, isSkillEligible } from "./candidates.js";
import { callLLMWithTimeout, callLLMStream, type StreamCallbacks, type ToolCallResult } from "./client.js";
import { DecisionSession } from "./apply.js";
import { MoveDecisionSession } from "./move-session.js";
import { decisionTrace } from "./decision-trace.js";
import { assistantToolMessage, isExplicitMultiTurnRejection, remainingTimeoutSec } from "./protocol.js";
import { appendInspectDiscardHistory, appendPendingHistory, appendRejectedHistory, describeDecisionStage } from "./backup-protocol.js";
import { assertLLMURL } from "./config.js";
import { ensureRoundSummaryReady, getDiscardPileCount, readDiscardPileReport, registerRoundSummaryClient } from "./round-history.js";

async function dispatchSummaryStream(messages: any[], tools: any[], configOrBackend: any, callbacks?: StreamCallbacks): Promise<ToolCallResult> {
	if (configOrBackend?.kind === "agy" || configOrBackend?.kind === "codex") {
		return callCliStream(messages, tools, configOrBackend, callbacks);
	}
	return callLLMStream(messages, tools, configOrBackend, callbacks);
}

async function dispatchSummaryWithTimeout(messages: any[], tools: any[], configOrBackend: any): Promise<ToolCallResult> {
	if (configOrBackend?.kind === "agy" || configOrBackend?.kind === "codex") {
		return callCliWithTimeout(messages, tools, configOrBackend);
	}
	return callLLMWithTimeout(messages, tools, configOrBackend);
}

registerRoundSummaryClient({ callLLMStream: dispatchSummaryStream, callLLMWithTimeout: dispatchSummaryWithTimeout });

/**
 * LLM 决策核心调度。任何 provider、协议或规则校验失败都会返回
 * handled:false，使 content.ts 自然回退到本地 AI。
 */
export async function tryLLMDecide(event: any): Promise<{ handled: boolean; result?: any }> {
	if (!(_status as { llmEnabledAtGameStart?: boolean }).llmEnabledAtGameStart) return { handled: false };

	const decisionPoint = event.name;
	const player = event.player;
	const config = getLLMConfig();
	const backend: ResolvedBackend =
		typeof resolvePlayerBackend === "function"
			? resolvePlayerBackend(player, config, _status as any)
			: {
					kind: "openai",
					label: config.model || "openai",
					configured: !!(config.url && config.apikey && config.model),
					model: config.model || "",
					timeoutSec: config.timeoutSec || 30,
					maxRetries: config.maxRetries || 0,
					thinkingEffort: config.thinkingEffort || "medium",
					url: config.url,
					apikey: config.apikey,
				};
	if (backend.kind === "local") return { handled: false };

	const deadline = Date.now() + config.decisionTimeoutSec * 1000;
	const logId = llmLogger.start(
		decisionPoint,
		player ? player.getName() : "unknown",
		{
			enabled: config.enabled,
			configured: backend.configured,
			model: backend.model || backend.label,
			backend: backend.kind,
			providerLabel: backend.label,
			...decisionTrace(event),
		},
		player?.getSeatNum?.(),
		deadline
	);

	try {
		if (!llmEnabled()) return fallback(logId, "disabled");
		if (!backend.configured) return fallback(logId, "no_config");
		if (backend.kind === "openai") assertLLMURL(backend.url || "");
		if (!event || !player) throw staged("translate", "LLM decision requires an event player");

		const runtime = createDecisionRuntime();
		const snapshot = buildCandidateSnapshot(event, player, runtime);
		assertExecutableSnapshot(event, snapshot);
		const decision = ["chooseToMove", "chooseToMove_new"].includes(event.name) ? new MoveDecisionSession(event, runtime) : new DecisionSession(event, snapshot, runtime);
		if (Date.now() >= deadline) throw staged("fetch", "LLM decision timed out");
		const automatic = decision instanceof DecisionSession ? decision.completeAutomatic() : undefined;
		if (automatic) {
			llmLogger.logAutomaticResponse(logId, decision.toLogResult(automatic.result));
			llmLogger.end(logId, "success");
			return { handled: true, result: automatic.result };
		}
		await ensureRoundSummaryReady(deadline);
		if (Date.now() >= deadline) throw staged("fetch", "LLM decision timed out");
		const statusObj = _status as { llmMultiTurnUnsupported?: boolean; llmMultiTurnUnsupportedByBackend?: Record<string, boolean> };
		const providerMultiTurnUnsupported = Boolean(statusObj.llmMultiTurnUnsupportedByBackend?.[backend.kind] ?? statusObj.llmMultiTurnUnsupported);
		const canMultiTurn = config.multiTurn && !providerMultiTurnUnsupported;
		let discardInspected = false;
		const { messages } = buildContext(event, snapshot, { canInspectDiscard: canMultiTurn && getDiscardPileCount() > 0 });
		const history = messages.slice() as ChatCompletionMessageParam[];
		if (decision.stage) history.push({ role: "user", content: describeDecisionStage(decision.stage) });
		const maxTurns = canMultiTurn ? config.maxTurns : 1;
		let turnIndex = 0;
		for (let actionTurn = 0; actionTurn < maxTurns; ) {
			if (Date.now() >= deadline) throw staged("fetch", "LLM decision timed out");
			decision.revalidate();
			const stage = decision.stage;
			const allowInspectDiscard = !discardInspected && canMultiTurn && getDiscardPileCount() > 0;
			const tools = buildTools(decisionPoint, snapshot, stage, !!event.forced, { allowInspectDiscard });
			if (!tools.length) throw staged("translate", `unsupported decision point: ${decisionPoint}`);
			llmLogger.logRequest(logId, history, tools);
			const currentTurnIndex = turnIndex++;
			let toolCall: ToolCallResult;
			try {
				toolCall = await requestToolCall(history, tools, backend, deadline, logId, currentTurnIndex, true);
			} catch (error: any) {
				if (currentTurnIndex > 0 && isExplicitMultiTurnRejection(error)) {
					statusObj.llmMultiTurnUnsupportedByBackend ??= {};
					statusObj.llmMultiTurnUnsupportedByBackend[backend.kind] = true;
				}
				throw error;
			}
			if (toolCall.name === INSPECT_DISCARD_PILE_TOOL && allowInspectDiscard) {
				discardInspected = true;
				const report = readDiscardPileReport();
				llmLogger.logTurn(logId, { index: currentTurnIndex, stage: stage?.id, request: { messages: history.slice(), tools }, toolCall, result: report });
				appendInspectDiscardHistory(history, toolCall, report, stage);
				continue;
			}
			actionTurn++;
			let accepted;
			const checkpoint = decision.checkpoint();
			try {
				if (Date.now() >= deadline) throw staged("fetch", "LLM decision timed out");
				decision.revalidate();
				accepted = decision.accept(toolCall);
				llmLogger.logTurn(logId, { index: currentTurnIndex, stage: stage?.id, request: { messages: history.slice(), tools }, toolCall, result: accepted.result ? decision.toLogResult(accepted.result) : accepted.pending });
			} catch (error: any) {
				llmLogger.logTurn(logId, { index: currentTurnIndex, stage: stage?.id, request: { messages: history.slice(), tools }, toolCall, error: error?.message || String(error) });
				if (actionTurn < maxTurns && Date.now() < deadline && isRecoverableDecisionError(error)) {
					decision.rollback(checkpoint);
					appendRejectedHistory(history, toolCall, error?.message || String(error), decision.stage);
					continue;
				}
				throw error;
			}
			if (accepted.result) {
				llmLogger.logResponse(logId, toolCall, decision.toLogResult(accepted.result));
				llmLogger.end(logId, "success");
				return { handled: true, result: accepted.result };
			}
			if (!config.multiTurn || !accepted.pending) throw staged("translate", "Action requires unsupported additional selection turn");
			appendPendingHistory(history, toolCall, accepted.pending);
		}
		throw staged("fetch", `LLM decision exceeded ${maxTurns} turns`);
	} catch (error: any) {
		const stage = error?.stage || "fetch";
		const message = error?.message || String(error);
		llmLogger.logError(logId, stage, message, error?.httpStatus);
		llmLogger.endFallback(logId, stage === "fetch" && message.includes("timed out") ? "timeout" : message);
		return { handled: false };
	}
}

function createDecisionRuntime(): any {
	return {
		getCandidateCards,
		getCandidateSkills,
		getPlayers: (event: any) => [...Array.from(game.players || []), ...(event.deadTarget ? Array.from(game.dead || []) : [])],
		getTargetId: (target: any, index: number) => target.playerid || String(index),
		getTargetName: (target: any) => get.translation(target) || target.name || "未知",
		getSkillInfo: (skill: string) => lib.skill[skill],
		getCardInfo: (card: any) => get.info(card),
		defaultSelectTarget: lib.filter.selectTarget,
		autoViewAs: (definition: any, cards: any[]) => get.autoViewAs(definition, cards),
		checkSelectTarget: (card: any, player: any, range: [number, number]) => game.checkMod(card, player, range, "selectTarget", player),
		getOwner: (card: any) => get.owner(card),
		alivePlayers: () => Array.from(game.players || []),
		deadPlayers: () => Array.from(game.dead || []),
		translate: (value: any) => get.translation(value) || value?.name || String(value),
		isSkillEligible,
		normalizeFilter: (filter: any) => get.filter(filter),
		getSuit: (card: any) => get.suit(card),
		cardLabel: (card: any) => `${get.translation(card)} ${get.suit(card)} ${get.number(card)}`,
		legacyBridgeHost: { ui, status: _status },
	};
}

async function requestToolCall(messages: ChatCompletionMessageParam[], tools: any[], config: any, deadline: number, logId: string, turnIndex: number, allowStream: boolean): Promise<ToolCallResult> {
	let attemptIndex = 0;
	try {
		if (!allowStream) return await requestNonstream(messages, tools, config, deadline, logId, turnIndex, attemptIndex);
		return await requestStream(messages, tools, config, deadline, logId, turnIndex, attemptIndex);
	} catch (streamError: any) {
		if (!allowStream || ["parse", "config"].includes(streamError?.stage)) throw streamError;
		attemptIndex++;
		return requestNonstream(messages, tools, config, deadline, logId, turnIndex, attemptIndex);
	}
}

async function requestStream(messages: ChatCompletionMessageParam[], tools: any[], config: any, deadline: number, logId: string, turnIndex: number, attemptIndex: number): Promise<ToolCallResult> {
	llmLogger.startRequestAttempt(logId, turnIndex, attemptIndex, "stream");
	try {
		const resolved = withRemainingTimeout(config, deadline);
		const callbacks: StreamCallbacks = {
			onChunk: partialArgs => llmLogger.logStreamChunk(logId, partialArgs),
			onFirstChunk: () => llmLogger.markRequestFirstChunk(logId, turnIndex, attemptIndex),
			onFirstToken: () => llmLogger.markRequestTTFT(logId, turnIndex, attemptIndex),
		};
		const isCli = resolved?.kind === "agy" || resolved?.kind === "codex";
		const result = isCli ? await callCliStream(messages, tools, resolved, callbacks) : await callLLMStream(messages, tools, resolved, callbacks);
		llmLogger.finishRequestAttempt(logId, turnIndex, attemptIndex, "success");
		return result;
	} catch (error: any) {
		llmLogger.finishRequestAttempt(logId, turnIndex, attemptIndex, "error", error?.stage);
		throw error;
	}
}

async function requestNonstream(messages: ChatCompletionMessageParam[], tools: any[], config: any, deadline: number, logId: string, turnIndex: number, attemptIndex: number): Promise<ToolCallResult> {
	llmLogger.startRequestAttempt(logId, turnIndex, attemptIndex, "nonstream");
	try {
		const resolved = withRemainingTimeout(config, deadline);
		const isCli = resolved?.kind === "agy" || resolved?.kind === "codex";
		const result = isCli ? await callCliWithTimeout(messages, tools, resolved) : await callLLMWithTimeout(messages, tools, resolved);
		llmLogger.finishRequestAttempt(logId, turnIndex, attemptIndex, "success");
		return result;
	} catch (error: any) {
		llmLogger.finishRequestAttempt(logId, turnIndex, attemptIndex, "error", error?.stage);
		throw error;
	}
}

function withRemainingTimeout(config: any, deadline: number): any {
	return { ...config, timeoutSec: remainingTimeoutSec(config.timeoutSec, deadline) };
}

function asAssistantToolMessage(call: ToolCallResult): ChatCompletionMessageParam {
	return assistantToolMessage(call) as ChatCompletionMessageParam;
}

function fallback(logId: string, reason: string): { handled: false } {
	llmLogger.endFallback(logId, reason);
	return { handled: false };
}

function staged(stage: string, message: string): Error {
	const error: any = new Error(message);
	error.stage = stage;
	return error;
}

const NON_RECOVERABLE_ERROR_RE = /has no headless selectionSpec|unknown skill|UI-dependent filterOk|disabled by selectionSpec|decision disabled|unsupported|requires an event player|ownership changed|state changed|eligibility changed|candidates changed|hand changed|no longer current|no longer owned|no longer eligible/i;

function isRecoverableDecisionError(error: any): boolean {
	const message = String(error?.message || "");
	if (NON_RECOVERABLE_ERROR_RE.test(message)) return false;
	if (error?.stage === "translate") return true;
	return error?.stage === "translate/action-resolution" && /has no legal continuation/.test(message);
}
