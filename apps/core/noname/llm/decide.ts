import { get } from "noname";
import { llmLogger } from "./logger.js";
import { llmEnabled, llmConfigured, getLLMConfig } from "./index.js";
import { buildContext } from "./context.js";
import { buildTools } from "./tools.js";
import { getCandidateCards, getCandidateSkills } from "./candidates.js";
import { callLLMWithTimeout } from "./client.js";
import { translateResult } from "./apply.js";

/**
 * LLM 决策核心调度。
 * 尝试用 LLM 做出决策，失败时返回 handled: false 让引擎回退到原生 AI。
 */
export async function tryLLMDecide(event: any): Promise<{ handled: boolean; result?: any }> {
	const decisionPoint = event.name;
	const player = event.player;
	const playerName = player ? get.translation(player) : "unknown";
	const config = getLLMConfig();

	const logId = llmLogger.start(decisionPoint, playerName, {
		enabled: config.enabled,
		configured: !!(config.url && config.apikey && config.model),
		model: config.model,
	});

	try {
		if (!llmEnabled()) {
			llmLogger.endFallback(logId, "disabled");
			return { handled: false };
		}
		if (!llmConfigured()) {
			llmLogger.endFallback(logId, "no_config");
			return { handled: false };
		}

		// 收集候选
		const cards = getCandidateCards(event, player);
		const skills = getCandidateSkills(event, player);

		// 构造 prompt 和 tools
		const { messages } = buildContext(event, { cards, skills });
		const tools = buildTools(decisionPoint, { cards, skills });
		llmLogger.logRequest(logId, messages, tools);

		// 调 LLM
		const toolCall = await callLLMWithTimeout(messages, tools, config);

		// 翻译结果
		const result = translateResult(event, toolCall, { cards, skills });
		llmLogger.logResponse(logId, toolCall, result);
		llmLogger.end(logId, "success");

		return { handled: true, result };
	} catch (e: any) {
		const stage = e?.stage || "fetch";
		const httpStatus = e?.httpStatus;
		const message = e?.message || String(e);
		llmLogger.logError(logId, stage, message, httpStatus);
		// 超时归 timeout，其它归 error/fallback
		const fallbackReason = stage === "fetch" && message.includes("timed out") ? "timeout" : message;
		llmLogger.endFallback(logId, fallbackReason);
		return { handled: false };
	}
}
