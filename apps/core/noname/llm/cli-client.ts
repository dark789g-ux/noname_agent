import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions.js";
import type { ResolvedBackend } from "./backends.js";
import type { StreamCallbacks } from "./client.js";
import { parseToolCallResult, type ToolCallResult } from "./tool-call-parser.js";

const LEGACY_PARAM_KEYS = new Set(["card_id", "card_ids", "target_ids", "reason"]);

export interface CliDecisionSchema {
	type: "object";
	properties: {
		tool: { type: "string"; enum: string[] };
		reason: { type: "string" };
		arguments_json: { type: "string" };
	};
	required: ["tool", "reason", "arguments_json"];
	additionalProperties: false;
}

/** 构造同时兼容 agy 与 codex --output-schema 严格约束的统一 JSON Schema。 */
export function buildCliDecisionJsonSchema(tools: ChatCompletionTool[]): CliDecisionSchema {
	const toolNames = tools
		.map(tool => (tool.type === "function" ? tool.function?.name : undefined))
		.filter((name): name is string => typeof name === "string" && name.length > 0);
	return {
		type: "object",
		properties: {
			tool: { type: "string", enum: toolNames },
			reason: { type: "string" },
			arguments_json: { type: "string" },
		},
		required: ["tool", "reason", "arguments_json"],
		additionalProperties: false,
	};
}

/** 将多轮对话历史与工具定义组装为适合 CLI stdin 传入的单段完整 Prompt。 */
export function buildCliDecisionPrompt(messages: ChatCompletionMessageParam[], tools: ChatCompletionTool[]): string {
	const sections: string[] = [];
	for (const msg of messages) {
		sections.push(formatPromptMessage(msg));
	}
	sections.push(formatCliToolsSection(tools));
	sections.push(
		[
			"## 输出格式要求（务必严格遵守）",
			"只返回 1 个符合 JSON Schema 的 JSON 对象，不要输出任何额外解释文字或 Markdown 代码块：",
			'- `tool`：必须从上方「可用工具列表」的枚举名中选择 1 个。',
			'- `reason`：1~200 字的简体中文选择原因说明。',
			'- `arguments_json`：该工具所需参数序列化后的 JSON 对象字符串（无额外参数时填 `"{}"`；请使用 c0/p0 等短引用，不要填兼容旧协议字段）。',
		].join("\n")
	);
	return sections.filter(Boolean).join("\n\n");
}

function formatPromptMessage(msg: ChatCompletionMessageParam): string {
	if (msg.role === "system") {
		return `## 系统指令\n${extractTextContent(msg.content)}`;
	}
	if (msg.role === "user") {
		return `## 决策输入\n${extractTextContent(msg.content)}`;
	}
	if (msg.role === "assistant") {
		const calls = (msg as any).tool_calls;
		if (Array.isArray(calls) && calls.length) {
			const formatted = calls.map((call: any) => `${call?.function?.name || "unknown"}(${call?.function?.arguments || "{}"})`).join("; ");
			return `## 上一轮 AI 决策尝试\n${formatted}`;
		}
		return `## AI 回复\n${extractTextContent(msg.content)}`;
	}
	if (msg.role === "tool") {
		return `## 工具执行反馈\n${extractTextContent(msg.content)}`;
	}
	return extractTextContent((msg as any).content);
}

function extractTextContent(content: unknown): string {
	if (typeof content === "string") return content.trim();
	if (Array.isArray(content)) {
		return content
			.map(part => (typeof part === "string" ? part : typeof part?.text === "string" ? part.text : JSON.stringify(part)))
			.join("\n")
			.trim();
	}
	return content == null ? "" : JSON.stringify(content);
}

function formatCliToolsSection(tools: ChatCompletionTool[]): string {
	const lines = ["## 可用工具列表"];
	for (const tool of tools) {
		if (tool.type !== "function" || !tool.function) continue;
		const fn = tool.function;
		const schema = (fn.parameters || {}) as Record<string, any>;
		const props = (schema.properties || {}) as Record<string, any>;
		const required = new Set<string>(Array.isArray(schema.required) ? schema.required : []);
		const paramSpecs = Object.entries(props)
			.filter(([key]) => !LEGACY_PARAM_KEYS.has(key))
			.map(([key, prop]) => `${key}${required.has(key) ? "(必填)" : "(可选)"}: ${prop?.description || prop?.type || ""}`);
		lines.push(`- \`${fn.name}\`：${fn.description || ""} | arguments_json 参数：${paramSpecs.length ? paramSpecs.join("；") : "无（传 \"{}\"）"}`);
	}
	return lines.join("\n");
}

/** 将 agy / codex CLI 返回的 JSON 信封解析并复用到统一的 parseToolCallResult 校验链。 */
export function parseCliEnvelopeToToolCall(rawOutput: unknown, reasoningContent: string | undefined, allowedToolNames: string[]): ToolCallResult {
	let payload = unwrapEnvelope(rawOutput);
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		throwCliError("parse", "CLI 输出不是合法的 JSON 对象");
	}
	const record = payload as Record<string, any>;
	const toolName = typeof record.tool === "string" ? record.tool.trim() : typeof record.name === "string" ? record.name.trim() : "";
	if (!toolName || (allowedToolNames.length && !allowedToolNames.includes(toolName))) {
		throwCliError("parse", `CLI 返回了非法或未知工具名: ${toolName || "(empty)"}`);
	}

	let parsedArgs: Record<string, any> = {};
	const rawArgsSource = record.arguments_json !== undefined ? record.arguments_json : record.arguments;
	if (typeof rawArgsSource === "string") {
		const trimmed = rawArgsSource.trim();
		if (trimmed) {
			try {
				const obj = JSON.parse(trimmed);
				if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
					throwCliError("parse", "CLI arguments_json 必须为 JSON 对象");
				}
				parsedArgs = obj;
			} catch (err: any) {
				if (err?.stage === "parse") throw err;
				throwCliError("parse", `CLI arguments_json JSON 解析失败: ${trimmed}`);
			}
		}
	} else if (rawArgsSource && typeof rawArgsSource === "object" && !Array.isArray(rawArgsSource)) {
		parsedArgs = { ...rawArgsSource };
	}

	const combinedArgs = {
		...parsedArgs,
		...(typeof record.reason === "string" ? { reason: record.reason } : {}),
	};
	return parseToolCallResult(`cli_call_${Date.now()}`, toolName, combinedArgs, reasoningContent);
}

function unwrapEnvelope(rawOutput: unknown): unknown {
	let current = rawOutput;
	for (let depth = 0; depth < 3; depth++) {
		if (typeof current === "string") {
			const stripped = stripJsonFences(current);
			try {
				current = JSON.parse(stripped);
			} catch {
				throwCliError("parse", `CLI 返回文本不是合法 JSON: ${stripped.slice(0, 180)}`);
			}
			continue;
		}
		if (current && typeof current === "object" && !Array.isArray(current)) {
			const obj = current as Record<string, any>;
			if (obj.structured_output !== undefined && obj.tool === undefined) {
				current = obj.structured_output;
				continue;
			}
			if (obj.result !== undefined && obj.tool === undefined && obj.name === undefined) {
				current = obj.result;
				continue;
			}
		}
		break;
	}
	return current;
}

function stripJsonFences(text: string): string {
	const trimmed = text.trim();
	const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
	if (fenced) return fenced[1].trim();
	const firstBrace = trimmed.indexOf("{");
	const lastBrace = trimmed.lastIndexOf("}");
	if (firstBrace > 0 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1);
	return trimmed;
}

/** 通过本地 @noname/fs CLI 桥接以 SSE 流式执行 agy / codex 决策。 */
export async function callCliStream(
	messages: ChatCompletionMessageParam[],
	tools: ChatCompletionTool[],
	backend: ResolvedBackend,
	callbacks: StreamCallbacks = {},
	signal?: AbortSignal
): Promise<ToolCallResult> {
	const { body, allowedTools, timeoutController, didTimeout, cleanup } = prepareCliRequest(messages, tools, backend, true, signal);
	try {
		const res = await fetch("/_llm/cli", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			signal: timeoutController.signal,
		});
		if (!res.ok) {
			const text = await res.text().catch(() => "");
			throwCliError(res.status >= 400 && res.status < 500 ? "config" : "fetch", `HTTP ${res.status}: ${text.slice(0, 200)}`);
		}
		if (!res.body) throwCliError("fetch", "CLI SSE 响应缺少 body 流");

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		while (true) {
			const { value, done } = await reader.read();
			if (value) buffer += decoder.decode(value, { stream: !done });
			let idx = buffer.indexOf("\n\n");
			while (idx !== -1) {
				const frame = buffer.slice(0, idx);
				buffer = buffer.slice(idx + 2);
				const finalResult = processSseFrame(frame, allowedTools, callbacks);
				if (finalResult) return finalResult;
				idx = buffer.indexOf("\n\n");
			}
			if (done) break;
		}
		if (buffer.trim()) {
			const finalResult = processSseFrame(buffer, allowedTools, callbacks);
			if (finalResult) return finalResult;
		}
		throwCliError("parse", "CLI SSE 流在未收到最终结果时提前结束");
	} catch (err: any) {
		throw buildCliFetchError(err, didTimeout(), callbacks);
	} finally {
		cleanup();
	}
}

/** 通过本地 @noname/fs CLI 桥接以非流式方式执行 agy / codex 决策。 */
export async function callCliWithTimeout(
	messages: ChatCompletionMessageParam[],
	tools: ChatCompletionTool[],
	backend: ResolvedBackend,
	signal?: AbortSignal
): Promise<ToolCallResult> {
	const { body, allowedTools, timeoutController, didTimeout, cleanup } = prepareCliRequest(messages, tools, backend, false, signal);
	try {
		const res = await fetch("/_llm/cli", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			signal: timeoutController.signal,
		});
		if (!res.ok) {
			const text = await res.text().catch(() => "");
			throwCliError(res.status >= 400 && res.status < 500 ? "config" : "fetch", `HTTP ${res.status}: ${text.slice(0, 200)}`);
		}
		const payload = (await res.json()) as any;
		if (!payload?.ok) {
			throwCliError(payload?.stage || "fetch", payload?.message || "CLI 执行失败");
		}
		return parseCliEnvelopeToToolCall(payload.rawOutput, payload.reasoningContent, allowedTools);
	} catch (err: any) {
		throw buildCliFetchError(err, didTimeout());
	} finally {
		cleanup();
	}
}

function processSseFrame(frame: string, allowedTools: string[], callbacks: StreamCallbacks): ToolCallResult | null {
	const dataLines = frame
		.split(/\r?\n/)
		.filter(line => line.startsWith("data:"))
		.map(line => line.slice(5).trim());
	if (!dataLines.length) return null;
	const event = JSON.parse(dataLines.join("\n"));
	if (event.type === "first_chunk") safeCallback(() => callbacks.onFirstChunk?.());
	else if (event.type === "first_token") safeCallback(() => callbacks.onFirstToken?.());
	else if (event.type === "chunk") safeCallback(() => callbacks.onChunk?.(String(event.text || "")));
	else if (event.type === "error") throwCliError(event.stage || "fetch", event.message || "CLI 流式执行错误");
	else if (event.type === "result") return parseCliEnvelopeToToolCall(event.rawOutput, event.reasoningContent, allowedTools);
	return null;
}

function prepareCliRequest(messages: ChatCompletionMessageParam[], tools: ChatCompletionTool[], backend: ResolvedBackend, stream: boolean, externalSignal?: AbortSignal) {
	if (backend.kind !== "agy" && backend.kind !== "codex") {
		throwCliError("config", `非 CLI 后端无法走 CLI 通道: ${backend.kind}`);
	}
	const command = (backend.command || "").trim();
	if (!command) throwCliError("config", `${backend.kind} CLI 命令未配置`);

	const jsonSchema = buildCliDecisionJsonSchema(tools);
	const prompt = buildCliDecisionPrompt(messages, tools);
	const timeoutController = new AbortController();
	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		timeoutController.abort();
	}, Math.max(1, backend.timeoutSec) * 1000);
	const onExternalAbort = () => timeoutController.abort();
	if (externalSignal?.aborted) {
		timeoutController.abort();
	} else {
		externalSignal?.addEventListener("abort", onExternalAbort, { once: true });
	}

	return {
		allowedTools: jsonSchema.properties.tool.enum,
		timeoutController,
		didTimeout: () => timedOut,
		cleanup: () => {
			clearTimeout(timer);
			externalSignal?.removeEventListener("abort", onExternalAbort);
		},
		body: {
			provider: backend.kind,
			command,
			model: backend.model,
			thinkingEffort: backend.thinkingEffort,
			extraArgs: backend.extraArgs || "",
			timeoutSec: backend.timeoutSec,
			prompt,
			jsonSchema,
			stream,
		},
	};
}

function buildCliFetchError(err: any, timedOut: boolean, callbacks?: StreamCallbacks): Error {
	if (err?.stage) {
		safeCallback(() => callbacks?.onError?.(err.stage, err.message, err.httpStatus));
		return err;
	}
	const isAbort = err?.name === "AbortError" || (err instanceof DOMException && err.name === "AbortError");
	const message = isAbort ? (timedOut ? "LLM request timed out" : "LLM stream request was aborted") : `CLI 桥接请求失败: ${err?.message || err}`;
	const wrapped: any = new Error(message);
	wrapped.stage = "fetch";
	safeCallback(() => callbacks?.onError?.("fetch", message));
	return wrapped;
}

function throwCliError(stage: "config" | "fetch" | "parse" | string, message: string): never {
	const err: any = new Error(message);
	err.stage = stage;
	throw err;
}

function safeCallback(fn: () => void): void {
	try {
		fn();
	} catch {}
}
