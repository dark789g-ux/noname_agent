import OpenAI, {
	APIError,
	APIConnectionError,
	APIConnectionTimeoutError,
} from "openai";
import type {
	ChatCompletionCreateParamsNonStreaming,
	ChatCompletionMessageParam,
	ChatCompletionTool,
} from "openai/resources/chat/completions.js";
import type { LLMConfig } from "./index.js";
import type { StreamPhase, StreamUsage } from "./logger-types.js";
import { assertLLMURL } from "./config.js";
import { parseToolCallResult, type ToolCallResult } from "./tool-call-parser.js";

export { parseToolCallResult, type ToolCallResult };

export interface StreamProgressUpdate {
	thought: string;
	text: string;
	phase: StreamPhase;
	usage?: StreamUsage;
}

export interface StreamCallbacks {
	onChunk?: (partialArgs: string) => void;
	onStreamProgress?: (progress: StreamProgressUpdate) => void;
	onUsage?: (usage: StreamUsage) => void;
	onFirstChunk?: () => void;
	onFirstToken?: () => void;
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
	callbacks?: Pick<StreamCallbacks, "onUsage">,
): Promise<ToolCallResult> {
	assertLLMURL(config.url);
	const client = new OpenAI({
		baseURL: config.url,
		apiKey: config.apikey,
		timeout: config.timeoutSec * 1000,
		maxRetries: config.maxRetries,
		dangerouslyAllowBrowser: true,
	});

	let httpStatus: number | undefined;

	try {
		const body: ChatCompletionCreateParamsNonStreaming = {
			model: config.model,
			messages,
			tools,
			tool_choice: "auto",
		};
		if (config.thinkingEffort !== "none") {
			body.reasoning_effort = config.thinkingEffort;
		}

		const resp = await client.chat.completions.create(body);
		const usage = extractOpenAIUsage((resp as any)?.usage);
		if (usage) {
			try {
				callbacks?.onUsage?.(usage);
			} catch {}
		}
		const msg = resp.choices?.[0]?.message;
		if (!msg) {
			throwErr("parse", "No message in LLM response");
		}

		const calls = msg.tool_calls || [];
		if (calls.length !== 1) {
			throwErr("parse", calls.length ? "LLM returned multiple tool_calls" : "No tool_calls in LLM response");
		}
		const tc = calls[0];
		if (!tc?.id || tc.type !== "function" || !tc.function?.name) {
			throwErr("parse", "Malformed tool_call without id or function name");
		}

		const rawArgs = tc.function.arguments ?? "";
		return parseToolCallResult(tc.id, tc.function.name, rawArgs, extractReasoningText(msg));
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
 * - 成功：返回完整 ToolCallResult（{ id, name, reason, arguments }）；arguments 为已解析且不含 reason 的对象，与 callLLMWithTimeout 一致
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
	assertLLMURL(config.url);
	const client = new OpenAI({
		baseURL: config.url,
		apiKey: config.apikey,
		timeout: config.timeoutSec * 1000,
		maxRetries: config.maxRetries,
		dangerouslyAllowBrowser: true,
	});

	let httpStatus: number | undefined;
	let errorReported = false;

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

		// openai SDK 的 stream 请求需要通过 stream_options 启用 usage 与流式信息
		body.stream_options = { include_usage: true };

		// as any: openai SDK 的 create() 根据 body 参数重载推断返回类型，
		// Record<string, any> 导致推断为 non-streaming 的 ChatCompletion 类型。
		// body 和返回值都强转 any，避免与已知 baseline TS 错误类似的类型冲突
		const stream = (await client.chat.completions.create(
			body as any,
			{ signal } as any,
		)) as any;

		let functionName = "";
		let toolCallId = "";
		let argumentsBuffer = "";
		let reasoningBuffer = "";
		let latestUsage: StreamUsage | undefined;
		let firstChunkReported = false;
		let firstTokenReported = false;

		for await (const chunk of stream) {
			if (!firstChunkReported) {
				firstChunkReported = true;
				notify("onFirstChunk");
			}
			const chunkUsage = extractOpenAIUsage(chunk?.usage);
			if (chunkUsage) {
				latestUsage = chunkUsage;
				notifyUsage(chunkUsage);
			}
			const deltaMessage = chunk.choices?.[0]?.delta;
			const calls = deltaMessage?.tool_calls;
			if (!firstTokenReported && hasTokenDelta(deltaMessage)) {
				firstTokenReported = true;
				notify("onFirstToken");
			}
			const reasoningDelta = extractReasoningText(deltaMessage);
			let streamUpdated = false;
			if (reasoningDelta) {
				reasoningBuffer += reasoningDelta;
				streamUpdated = true;
			}
			if (calls?.length > 1 || calls?.some((call: any) => (call.index ?? 0) !== 0)) {
				throwErr("parse", "LLM stream returned multiple tool_calls");
			}
			const delta = calls?.[0];
			if (delta?.id) {
				toolCallId = delta.id;
			}
			if (delta?.function?.name) {
				functionName = delta.function.name;
			}
			if (delta?.function?.arguments) {
				argumentsBuffer += delta.function.arguments;
				streamUpdated = true;
			}
			if (streamUpdated) {
				notify("onChunk", argumentsBuffer);
				notifyProgress({
					thought: reasoningBuffer,
					text: argumentsBuffer,
					phase: argumentsBuffer ? "tool_calling" : "thinking",
					usage: latestUsage,
				});
			}
		}

		if (!functionName || !toolCallId) {
			throwErr("parse", "LLM stream ended without a complete tool_call");
		}

		return parseToolCallResult(toolCallId, functionName, argumentsBuffer, reasoningBuffer);
	} catch (e: any) {
		// 内部已带 stage 的错误透传（parse 错误）
		if (e?.stage) {
			notifyError(e.stage, e.message, e.httpStatus);
			throw e;
		}

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
		notifyError(stage, err.message, httpStatus);
		throw err;
	}

	function notifyError(stage: string, message: string, status?: number): void {
		if (errorReported) return;
		errorReported = true;
		try {
			callbacks.onError?.(stage, message, status);
		} catch {
			// 遥测回调不能影响 provider 请求或错误分类。
		}
	}

	function notify(name: "onFirstChunk" | "onFirstToken"): void;
	function notify(name: "onChunk", partialArgs: string): void;
	function notify(name: keyof StreamCallbacks, partialArgs?: string): void {
		try {
			if (name === "onChunk") callbacks.onChunk?.(partialArgs || "");
			else if (name === "onFirstChunk") callbacks.onFirstChunk?.();
			else if (name === "onFirstToken") callbacks.onFirstToken?.();
		} catch {
			// 遥测回调不能影响 provider 请求。
		}
	}

	function notifyProgress(progress: StreamProgressUpdate): void {
		try {
			callbacks.onStreamProgress?.(progress);
		} catch {
			// 遥测回调不能影响 provider 请求。
		}
	}

	function notifyUsage(usage: StreamUsage): void {
		try {
			callbacks.onUsage?.(usage);
		} catch {
			// 遥测回调不能影响 provider 请求。
		}
	}
}

function extractOpenAIUsage(raw: any): StreamUsage | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const inputTokens = typeof raw.prompt_tokens === "number" ? raw.prompt_tokens : undefined;
	const outputTokens = typeof raw.completion_tokens === "number" ? raw.completion_tokens : undefined;
	const thoughtTokens = typeof raw.completion_tokens_details?.reasoning_tokens === "number" ? raw.completion_tokens_details.reasoning_tokens : undefined;
	const total = typeof raw.total_tokens === "number" ? raw.total_tokens : undefined;
	const contextUsed = total ?? (inputTokens !== undefined && outputTokens !== undefined ? inputTokens + outputTokens : inputTokens);
	if (inputTokens === undefined && outputTokens === undefined && thoughtTokens === undefined && contextUsed === undefined) {
		return undefined;
	}
	return { inputTokens, outputTokens, thoughtTokens, contextUsed };
}

function extractReasoningText(message: any): string {
	if (typeof message?.reasoning_content === "string" && message.reasoning_content.length > 0) return message.reasoning_content;
	if (typeof message?.reasoning === "string" && message.reasoning.length > 0) return message.reasoning;
	return "";
}

function formatStreamPreview(reasoningBuffer: string, argumentsBuffer: string): string {
	if (!reasoningBuffer) return argumentsBuffer;
	if (!argumentsBuffer) return reasoningBuffer;
	return `${reasoningBuffer}\n\n[tool_call]\n${argumentsBuffer}`;
}

function hasTokenDelta(delta: any): boolean {
	if (extractReasoningText(delta).length > 0) return true;
	if (typeof delta?.content === "string" && delta.content.length > 0) return true;
	if (typeof delta?.function_call?.arguments === "string" && delta.function_call.arguments.length > 0) return true;
	return delta?.tool_calls?.some((call: any) => typeof call?.function?.arguments === "string" && call.function.arguments.length > 0) || false;
}
