import { _status, game, get, lib } from "noname";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import { llmLogger } from "./logger.js";
import { llmEnabled, llmConfigured, getLLMConfig } from "./index.js";
import { buildContext } from "./context.js";
import { buildTools } from "./tools.js";
import { assertExecutableSnapshot, buildCandidateSnapshot } from "./action-candidates.js";
import { getCandidateCards, getCandidateSkills, isSkillEligible } from "./candidates.js";
import { callLLMWithTimeout, callLLMStream, type ToolCallResult } from "./client.js";
import { DecisionSession } from "./apply.js";
import { assistantToolMessage, isExplicitMultiTurnRejection, remainingTimeoutSec } from "./protocol.js";
import { appendPendingHistory, describeDecisionStage } from "./backup-protocol.js";

/**
 * LLM 决策核心调度。任何 provider、协议或规则校验失败都会返回
 * handled:false，使 content.ts 自然回退到本地 AI。
 */
export async function tryLLMDecide(event: any): Promise<{ handled: boolean; result?: any }> {
	if (!(_status as { llmEnabledAtGameStart?: boolean }).llmEnabledAtGameStart) return { handled: false };

	const decisionPoint = event.name;
	const player = event.player;
	const config = getLLMConfig();
	const deadline = Date.now() + config.decisionTimeoutSec * 1000;
	const logId = llmLogger.start(decisionPoint, player ? player.getName() : "unknown", {
		enabled: config.enabled,
		configured: !!(config.url && config.apikey && config.model),
		model: config.model,
	}, player?.getSeatNum(), deadline);

	try {
		if (!llmEnabled()) return fallback(logId, "disabled");
		if (!llmConfigured()) return fallback(logId, "no_config");
		if (!event || !player) throw staged("translate", "LLM decision requires an event player");

		const runtime = createDecisionRuntime();
		const snapshot = buildCandidateSnapshot(event, player, runtime);
		assertExecutableSnapshot(event, snapshot);
		const decision = new DecisionSession(event, snapshot, runtime);
		const { messages } = buildContext(event, snapshot);
		const history = messages.slice() as ChatCompletionMessageParam[];
		if (decision.stage) history.push({ role: "user", content: describeDecisionStage(decision.stage) });
		const providerMultiTurnUnsupported = (_status as { llmMultiTurnUnsupported?: boolean }).llmMultiTurnUnsupported;
		const maxTurns = config.multiTurn && !providerMultiTurnUnsupported ? config.maxTurns : 1;
		for (let index = 0; index < maxTurns; index++) {
			if (Date.now() >= deadline) throw staged("fetch", "LLM decision timed out");
			decision.revalidate();
			const stage = decision.stage;
			const tools = buildTools(decisionPoint, snapshot, stage, !!event.forced);
			if (!tools.length) throw staged("translate", `unsupported decision point: ${decisionPoint}`);
			llmLogger.logRequest(logId, history, tools);
			let toolCall: ToolCallResult;
			try {
				toolCall = await requestToolCall(history, tools, config, deadline, logId, index === 0);
			} catch (error: any) {
				if (index > 0 && isExplicitMultiTurnRejection(error)) (_status as { llmMultiTurnUnsupported?: boolean }).llmMultiTurnUnsupported = true;
				throw error;
			}
			let accepted;
			try {
				accepted = decision.accept(toolCall);
				llmLogger.logTurn(logId, { index, stage: stage?.id, request: { messages: history.slice(), tools }, toolCall, result: accepted.result ? decision.toLogResult(accepted.result) : accepted.pending });
			} catch (error: any) {
				llmLogger.logTurn(logId, { index, stage: stage?.id, request: { messages: history.slice(), tools }, toolCall, error: error?.message || String(error) });
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
		autoViewAs: (definition: any, cards: any[]) => get.autoViewAs(definition, cards),
		checkSelectTarget: (card: any, player: any, range: [number, number]) => game.checkMod(card, player, range, "selectTarget", player),
		getOwner: (card: any) => get.owner(card),
		alivePlayers: () => Array.from(game.players || []),
		deadPlayers: () => Array.from(game.dead || []),
		translate: (value: any) => get.translation(value) || value?.name || String(value),
		isSkillEligible,
	};
}

async function requestToolCall(
	messages: ChatCompletionMessageParam[],
	tools: any[],
	config: any,
	deadline: number,
	logId: string,
	allowStream: boolean,
): Promise<ToolCallResult> {
	try {
		if (!allowStream) return await callLLMWithTimeout(messages, tools, withRemainingTimeout(config, deadline));
		return await callLLMStream(messages, tools, withRemainingTimeout(config, deadline), { onChunk: partialArgs => llmLogger.logStreamChunk(logId, partialArgs) });
	} catch (streamError: any) {
		if (!allowStream || streamError?.stage === "parse") throw streamError;
		return callLLMWithTimeout(messages, tools, withRemainingTimeout(config, deadline));
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
