import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions.js";
import {
	buildCliDecisionJsonSchema,
	CLI_INCREMENTAL_JSON_REMINDER,
	formatCliSystemToolsManual,
	parseCliEnvelopeToToolCall,
	STATIC_CLI_DECISION_SCHEMA,
} from "../../cli-client.js";
import type { ToolCallResult } from "../../client.js";
import type { StreamUsage } from "../../logger-types.js";
import { remainingTimeoutSec } from "../../protocol.js";
import { STATIC_DECISION_TOOL_NAMES } from "../../tools.js";
import type { SeatTransport, TransportCallbacks, TransportTurnInput, TransportTurnResult } from "../types.js";
import { assertNotAborted } from "../../character-selection/abort.js";

function extractMessageText(content: ChatCompletionMessageParam["content"]): string {
	if (typeof content === "string") return content.trim();
	if (Array.isArray(content)) {
		return content
			.map(part => (typeof part === "string" ? part : typeof (part as any)?.text === "string" ? (part as any).text : JSON.stringify(part)))
			.join("\n")
			.trim();
	}
	return content ? JSON.stringify(content) : "";
}

function formatAssistantMessage(msg: ChatCompletionMessageParam): string {
	const calls = (msg as any).tool_calls;
	if (Array.isArray(calls) && calls.length) {
		const formatted = calls.map((c: any) => `${c?.function?.name || "unknown"}(${c?.function?.arguments || "{}"})`).join("; ");
		return `## 上一轮 AI 决策尝试\n${formatted}`;
	}
	const content = extractMessageText(msg.content);
	return content ? `## AI 回复\n${content}` : "";
}

export function formatRemoteSessionPrompt(messages: ChatCompletionMessageParam[], includeHeaderPrompt: boolean, tools?: ChatCompletionTool[]): string {
	const sections: string[] = [];
	if (includeHeaderPrompt) {
		const manual = formatCliSystemToolsManual(tools);
		for (const msg of messages) {
			const content = extractMessageText(msg.content);
			if (msg.role === "system") {
				sections.push(`## 系统指令\n${content}\n\n${manual}`);
			} else if (msg.role === "user" && content) {
				sections.push(`## 决策输入\n${content}`);
			} else if (msg.role === "assistant") {
				const formatted = formatAssistantMessage(msg);
				if (formatted) sections.push(formatted);
			} else if (msg.role === "tool" && content) {
				sections.push(`## 工具执行反馈\n${content}`);
			}
		}
		return sections.filter(Boolean).join("\n\n");
	}

	for (const msg of messages) {
		const content = extractMessageText(msg.content);
		if (msg.role === "user" && content) sections.push(content);
		else if (msg.role === "tool" && content) sections.push(`## 工具执行反馈\n${content}`);
		else if (msg.role === "assistant") {
			const formatted = formatAssistantMessage(msg);
			if (formatted) sections.push(formatted);
		}
	}
	sections.push(CLI_INCREMENTAL_JSON_REMINDER);
	return sections.filter(Boolean).join("\n\n");
}

function mergeUsage(prev: StreamUsage | undefined, next: Partial<StreamUsage> | undefined): StreamUsage | undefined {
	if (!next) return prev;
	return {
		inputTokens: next.inputTokens ?? prev?.inputTokens,
		outputTokens: next.outputTokens ?? prev?.outputTokens,
		thoughtTokens: next.thoughtTokens ?? prev?.thoughtTokens,
		contextUsed: next.contextUsed ?? prev?.contextUsed,
		contextSize: next.contextSize ?? prev?.contextSize,
	};
}

export class RemoteSessionTransport implements SeatTransport {
	readonly stateful = true;

	async sendTurn(input: TransportTurnInput, callbacks?: TransportCallbacks): Promise<TransportTurnResult> {
		assertNotAborted(input.signal);
		const cliSchema = input.remoteSessionTools ? buildCliDecisionJsonSchema(input.remoteSessionTools) : STATIC_CLI_DECISION_SCHEMA;
		const schema = cliSchema as unknown as Record<string, unknown>;
		const allowedTools = input.remoteSessionTools ? [...cliSchema.properties.tool.enum] : [...STATIC_DECISION_TOOL_NAMES];
		const promptMessages = input.resetRemoteSession ? input.fullTranscript : input.deltaMessages;
		const prompt = formatRemoteSessionPrompt(promptMessages, input.resetRemoteSession, input.remoteSessionTools);

		try {
			const turnResult = await this.executeSseTurn(input, prompt, schema, allowedTools, input.resetRemoteSession, callbacks);
			return { ...turnResult, syncedRemote: true };
		} catch (err: any) {
			assertNotAborted(input.signal);
			let activeErr: any = err;
			// 若是 ACP 无 schema 导致的单次 parse 错误，先在同会话内纠错一次
			if (activeErr?.stage === "parse" && activeErr?.code !== "session_lost") {
				try {
					const repairPrompt = [
						`上一次输出未能通过 JSON 决策解析（${activeErr.message}）。`,
						"请严格只输出 1 个符合 JSON Schema 的 JSON 对象，包含 tool、reason、arguments_json 字段；不要输出任何额外文字、解释或工具调用。",
					].join("\n");
					const repaired = await this.executeSseTurn(input, repairPrompt, schema, allowedTools, false, callbacks);
					return { ...repaired, syncedRemote: true };
				} catch (repairErr: any) {
					assertNotAborted(input.signal);
					activeErr = repairErr;
				}
			}

			// 增量轮次远端会话丢失/崩溃时，使用 fullTranscript 原地以 reset=true 重建常驻会话
			if (!input.resetRemoteSession) {
				const degradeReason = activeErr?.message || String(activeErr);
				const rebuildPrompt = formatRemoteSessionPrompt(input.fullTranscript, true, input.remoteSessionTools);
				const rebuilt = await this.executeSseTurn(input, rebuildPrompt, schema, allowedTools, true, callbacks);
				return {
					...rebuilt,
					degraded: true,
					degradeReason,
					syncedRemote: true,
				};
			}

			throw activeErr;
		}
	}

	async resetSession(sessionKey: string): Promise<void> {
		try {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), 1500);
			try {
				await fetch(`/_llm/session/${encodeURIComponent(sessionKey)}`, {
					method: "DELETE",
					signal: controller.signal,
				});
			} finally {
				clearTimeout(timer);
			}
		} catch {
			// fs 服务未启动或不可达时忽略
		}
	}

	private async executeSseTurn(
		input: TransportTurnInput,
		prompt: string,
		jsonSchema: Record<string, unknown>,
		allowedTools: string[],
		reset: boolean,
		callbacks?: TransportCallbacks
	): Promise<{ toolCall: ToolCallResult; usage?: StreamUsage; transport: "stream" }> {
		const timeoutSec = remainingTimeoutSec(input.backend.timeoutSec || 60, input.deadline);
		const controller = new AbortController();
		const abort = () => controller.abort();
		input.signal?.addEventListener("abort", abort, { once: true });
		if (input.signal?.aborted) controller.abort();
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			controller.abort();
		}, timeoutSec * 1000);

		let thoughtBuffer = "";
		let textBuffer = "";
		let usage: StreamUsage | undefined;

		try {
			const res = await fetch("/_llm/session/turn", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				signal: controller.signal,
				body: JSON.stringify({
					sessionKey: input.sessionKey,
					gameId: input.gameId,
					seatNum: input.seatNum,
					provider: input.backend.kind,
					command: input.backend.command || input.backend.kind,
					model: input.backend.model || "",
					thinkingEffort: input.backend.thinkingEffort || "default",
					extraArgs: input.backend.extraArgs || "",
					timeoutSec,
					reset,
					prompt,
					jsonSchema,
				}),
			});

			if (!res.ok || !res.body) {
				const errText = await res.text().catch(() => "");
				throw Object.assign(new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`), {
					stage: res.status >= 400 && res.status < 500 ? "config" : "fetch",
				});
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let sseBuffer = "";

			const handleFrame = (frame: string): ToolCallResult | null => {
				const dataLines = frame
					.split(/\r?\n/)
					.filter(line => line.startsWith("data:"))
					.map(line => line.slice(5).trim());
				if (!dataLines.length) return null;
				const evt = JSON.parse(dataLines.join("\n"));

				if (evt.type === "first_chunk") {
					callbacks?.onFirstChunk?.();
				} else if (evt.type === "first_token") {
					callbacks?.onFirstToken?.();
				} else if (evt.type === "thought_delta") {
					thoughtBuffer += String(evt.delta || "");
					callbacks?.onStreamProgress?.({ thought: thoughtBuffer, text: textBuffer, phase: "thinking", usage });
				} else if (evt.type === "thought_snapshot") {
					thoughtBuffer = String(evt.text || "");
					callbacks?.onStreamProgress?.({ thought: thoughtBuffer, text: textBuffer, phase: "thinking", usage });
				} else if (evt.type === "text_delta") {
					textBuffer += String(evt.delta || "");
					callbacks?.onStreamProgress?.({ thought: thoughtBuffer, text: textBuffer, phase: "tool_calling", usage });
				} else if (evt.type === "usage" && evt.usage) {
					usage = mergeUsage(usage, evt.usage);
					if (usage) callbacks?.onUsage?.(usage);
					callbacks?.onStreamProgress?.({
						thought: thoughtBuffer,
						text: textBuffer,
						phase: textBuffer ? "tool_calling" : thoughtBuffer ? "thinking" : "idle",
						usage,
					});
				} else if (evt.type === "error") {
					throw Object.assign(new Error(evt.message || "远端会话执行失败"), {
						stage: evt.stage || "fetch",
						code: evt.code,
					});
				} else if (evt.type === "result") {
					if (evt.usage) {
						usage = mergeUsage(usage, evt.usage);
						if (usage) callbacks?.onUsage?.(usage);
					}
					const reasoning = typeof evt.reasoningContent === "string" && evt.reasoningContent ? evt.reasoningContent : thoughtBuffer || undefined;
					return parseCliEnvelopeToToolCall(evt.rawOutput, reasoning, allowedTools);
				}
				return null;
			};

			while (true) {
				const { value, done } = await reader.read();
				if (value) sseBuffer += decoder.decode(value, { stream: !done });
				let idx = sseBuffer.indexOf("\n\n");
				while (idx !== -1) {
					const frame = sseBuffer.slice(0, idx);
					sseBuffer = sseBuffer.slice(idx + 2);
					const finalTool = handleFrame(frame);
					if (finalTool) return { toolCall: finalTool, usage, transport: "stream" };
					idx = sseBuffer.indexOf("\n\n");
				}
				if (done) break;
			}

			if (sseBuffer.trim()) {
				const finalTool = handleFrame(sseBuffer);
				if (finalTool) return { toolCall: finalTool, usage, transport: "stream" };
			}
			throw Object.assign(new Error("远端会话 SSE 流提前结束"), { stage: "fetch" });
		} catch (err: any) {
			if (err?.stage) throw err;
			const isAbort = err?.name === "AbortError" || (err instanceof DOMException && err.name === "AbortError");
			throw Object.assign(new Error(isAbort && timedOut ? "LLM request timed out" : err?.message || String(err)), {
				stage: "fetch",
			});
		} finally {
			clearTimeout(timer);
			input.signal?.removeEventListener("abort", abort);
		}
	}
}

export async function notifyRemoteResetGame(gameId?: string): Promise<void> {
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 1500);
		try {
			await fetch("/_llm/session/reset-game", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ gameId: gameId || "" }),
				signal: controller.signal,
			});
		} finally {
			clearTimeout(timer);
		}
	} catch {
		// fs 服务未启动或不可达时忽略
	}
}
