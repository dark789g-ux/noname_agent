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

export interface StreamCallbacks {
	onChunk?: (partialArgs: string) => void;
	onError?: (stage: string, message: string, httpStatus?: number) => void;
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

/**
 * callLLMStream —— 流式调用 LLM（SSE）。
 * - 成功：返回 ToolCallResult（{ name, arguments }），arguments 为已解析的对象，与 callLLMWithTimeout 一致
 * - 失败：抛出与 callLLMWithTimeout 相同结构的异常（stage/httpStatus）
 * - 流式期间：每个 chunk 通过 callbacks.onChunk 回调通知调用方
 *
 * 服务端不支持 stream 时会抛出异常；调用方应回退到 callLLMWithTimeout。
 */
export async function callLLMStream(
	messages: ChatCompletionMessageParam[],
	tools: ChatCompletionTool[],
	config: LLMConfig,
	callbacks: StreamCallbacks = {},
	signal?: AbortSignal,
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
			stream: true,
		};
		if (config.thinkingEffort !== "none") {
			body.reasoning_effort = config.thinkingEffort;
		}

		// openai SDK 的 stream 请求需要通过 stream_options 启用 function arguments 流式
		body.stream_options = { include_usage: false };

		// as any: openai SDK 的 create() 根据 body 参数重载推断返回类型，
		// Record<string, any> 导致推断为 non-streaming 的 ChatCompletion 类型。
		// body 和返回值都强转 any，避免与已知 baseline TS 错误类似的类型冲突
		const stream = (await client.chat.completions.create(
			body as any,
			{ signal } as any,
		)) as any;

		let functionName = "";
		let argumentsBuffer = "";

		for await (const chunk of stream) {
			const delta = chunk.choices?.[0]?.delta?.tool_calls?.[0];
			if (delta?.function?.name) {
				functionName = delta.function.name;
			}
			if (delta?.function?.arguments) {
				argumentsBuffer += delta.function.arguments;
				callbacks.onChunk?.(argumentsBuffer);
			}
		}

		if (!functionName) {
				throwErr("parse", "LLM stream ended without function name");
			}

			// 把累积的 arguments 字符串 parse 为对象，与 callLLMWithTimeout 保持一致
			let args: Record<string, any>;
			try {
				args = JSON.parse(argumentsBuffer);
			} catch {
				throwErr("parse", `Bad tool_call arguments JSON: ${argumentsBuffer}`);
			}

			return { name: functionName, arguments: args };
	} catch (e: any) {
		// 内部已带 stage 的错误透传（parse 错误）
		if (e?.stage) throw e;

		// AbortError（来自 AbortSignal）
		if (e instanceof DOMException && e.name === "AbortError") {
			throwErr("fetch", "LLM stream request was aborted");
		}

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
		// 流式调用额外通知 callbacks.onError
		callbacks.onError?.(stage, err.message, httpStatus);
		throw err;
	}
}
