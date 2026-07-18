import OpenAI, {
	APIError,
	APIConnectionError,
	APIConnectionTimeoutError,
} from "openai";
import type {
	ChatCompletionMessageParam,
	ChatCompletionTool,
} from "openai/resources/chat/completions.js";
import type { LLMConfig } from "./index.js";

export interface ToolCallResult {
	name: string;
	arguments: Record<string, any>;
}

/**
 * callLLMWithTimeout —— 用 openai SDK 调用 OpenAI 兼容接口。
 * 保持旧版错误分类（stage/httpStatus）语义以兼容 decide.ts/logger.ts。
 */
export async function callLLMWithTimeout(
	messages: ChatCompletionMessageParam[],
	tools: ChatCompletionTool[],
	config: LLMConfig,
): Promise<ToolCallResult> {
	const client = new OpenAI({
		baseURL: config.url,
		apiKey: config.apikey,
		timeout: config.timeoutSec * 1000,
		maxRetries: config.maxRetries,
		dangerouslyAllowBrowser: true,
	});

	let httpStatus: number | undefined;

	try {
		const body: Record<string, any> = {
			model: config.model,
			messages,
			tools,
			tool_choice: "auto",
		};
		if (config.thinkingEffort !== "none") {
			body.reasoning_effort = config.thinkingEffort;
		}

		const resp = await client.chat.completions.create(body);
		const msg = resp.choices?.[0]?.message;
		if (!msg) {
			throwErr("parse", "No message in LLM response");
		}

		const tc = msg.tool_calls?.[0];
		if (!tc) {
			throwErr("parse", "No tool_calls in LLM response");
		}

		const name = tc.function?.name || "";
		const rawArgs = tc.function?.arguments ?? "";
		let args: Record<string, any>;
		try {
			args = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
		} catch {
			throwErr("parse", `Bad tool_call arguments JSON: ${rawArgs}`);
		}

		return { name, arguments: args };
	} catch (e: any) {
		// 内部已带 stage 的错误透传（parse 错误）
		if (e?.stage) throw e;

		// 超时错误（APIConnectionTimeoutError 继承自 APIConnectionError，需先检查）
		if (e instanceof APIConnectionTimeoutError) {
			throwErr("fetch", "LLM request timed out");
		}

		// 网络连接错误
		if (e instanceof APIConnectionError) {
			throwErr("fetch", `LLM fetch error: ${e.message}`);
		}

		// HTTP 4xx/5xx 错误
		if (e instanceof APIError) {
			httpStatus = e.status;
			const bodyText = String(
				(e.error as any)?.message ?? e.message ?? "",
			).slice(0, 200);
			throwErr("fetch", `HTTP ${e.status}: ${bodyText}`);
		}

		// 其他未知错误
		throwErr("fetch", `LLM fetch error: ${e?.message ?? e}`);
	}

	// 工具函数：抛出带 stage/httpStatus 的错误（never 返回类型帮助 TS 收窄）
	function throwErr(stage: string, message: string): never {
		const err: any = new Error(message);
		err.stage = stage;
		err.httpStatus = httpStatus;
		throw err;
	}
}
