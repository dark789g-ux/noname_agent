import { get, _status } from "noname";
import { llmLogger } from "./logger.js";
import { llmEnabled, llmConfigured, getLLMConfig } from "./index.js";
import { buildContext } from "./context.js";
import { buildTools } from "./tools.js";
import { getCandidateCards, getCandidateSkills } from "./candidates.js";
import { callLLMWithTimeout, callLLMStream } from "./client.js";
import { translateResult } from "./apply.js";

/**
 * LLM 决策核心调度。
 * 尝试用 LLM 做出决策，失败时返回 handled: false 让引擎回退到原生 AI。
 */
export async function tryLLMDecide(event: any): Promise<{ handled: boolean; result?: any }> {
	// 需求 3：本局未以 AI 模式开局 → 完全不记录日志，直接回退本地 AI
	if (!(_status as { llmEnabledAtGameStart?: boolean }).llmEnabledAtGameStart) {
		return { handled: false };
	}

	const decisionPoint = event.name;
	const player = event.player;
	const playerName = player ? player.getName() : "unknown";
	const seatNum = player ? player.getSeatNum() : undefined;
	const config = getLLMConfig();

	const logId = llmLogger.start(decisionPoint, playerName, {
		enabled: config.enabled,
		configured: !!(config.url && config.apikey && config.model),
		model: config.model,
		}, seatNum);

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

		// 优先走流式调用，让 UI 实时看到 args 逐字出现
		// 服务端不支持 stream 时回退到非流式
		let toolCall;
		try {
			toolCall = await callLLMStream(messages, tools, config, {
				onChunk: partialArgs => {
					llmLogger.logStreamChunk(logId, partialArgs);
				},
			});
		} catch (streamErr) {
			// parse 类错误（空响应、JSON 解析失败）非流式也会失败，不重试直接抛
			if (streamErr && (streamErr as any).stage === "parse") throw streamErr;
			// 其它错误（网络、超时、SSE 不支持）：回退到非流式
			toolCall = await callLLMWithTimeout(messages, tools, config);
		}

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
