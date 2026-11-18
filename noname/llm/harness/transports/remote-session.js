import { formatCliSystemToolsManual, CLI_INCREMENTAL_JSON_REMINDER, buildCliDecisionJsonSchema, STATIC_CLI_DECISION_SCHEMA, parseCliEnvelopeToToolCall } from "../../cli-client.js";
import { remainingTimeoutSec } from "../../protocol.js";
import { STATIC_DECISION_TOOL_NAMES } from "../../tools.js";
import { assertNotAborted } from "../../character-selection/abort.js";
function extractMessageText(content) {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content.map((part) => typeof part === "string" ? part : typeof part?.text === "string" ? part.text : JSON.stringify(part)).join("\n").trim();
  }
  return content ? JSON.stringify(content) : "";
}
function formatAssistantMessage(msg) {
  const calls = msg.tool_calls;
  if (Array.isArray(calls) && calls.length) {
    const formatted = calls.map((c) => `${c?.function?.name || "unknown"}(${c?.function?.arguments || "{}"})`).join("; ");
    return `## 上一轮 AI 决策尝试
${formatted}`;
  }
  const content = extractMessageText(msg.content);
  return content ? `## AI 回复
${content}` : "";
}
function formatRemoteSessionPrompt(messages, includeHeaderPrompt, tools) {
  const sections = [];
  if (includeHeaderPrompt) {
    const manual = formatCliSystemToolsManual(tools);
    for (const msg of messages) {
      const content = extractMessageText(msg.content);
      if (msg.role === "system") {
        sections.push(`## 系统指令
${content}

${manual}`);
      } else if (msg.role === "user" && content) {
        sections.push(`## 决策输入
${content}`);
      } else if (msg.role === "assistant") {
        const formatted = formatAssistantMessage(msg);
        if (formatted) sections.push(formatted);
      } else if (msg.role === "tool" && content) {
        sections.push(`## 工具执行反馈
${content}`);
      }
    }
    return sections.filter(Boolean).join("\n\n");
  }
  for (const msg of messages) {
    const content = extractMessageText(msg.content);
    if (msg.role === "user" && content) sections.push(content);
    else if (msg.role === "tool" && content) sections.push(`## 工具执行反馈
${content}`);
    else if (msg.role === "assistant") {
      const formatted = formatAssistantMessage(msg);
      if (formatted) sections.push(formatted);
    }
  }
  sections.push(CLI_INCREMENTAL_JSON_REMINDER);
  return sections.filter(Boolean).join("\n\n");
}
function mergeUsage(prev, next) {
  if (!next) return prev;
  return {
    inputTokens: next.inputTokens ?? prev?.inputTokens,
    outputTokens: next.outputTokens ?? prev?.outputTokens,
    thoughtTokens: next.thoughtTokens ?? prev?.thoughtTokens,
    contextUsed: next.contextUsed ?? prev?.contextUsed,
    contextSize: next.contextSize ?? prev?.contextSize
  };
}
class RemoteSessionTransport {
  stateful = true;
  async sendTurn(input, callbacks) {
    assertNotAborted(input.signal);
    const cliSchema = input.remoteSessionTools ? buildCliDecisionJsonSchema(input.remoteSessionTools) : STATIC_CLI_DECISION_SCHEMA;
    const schema = cliSchema;
    const allowedTools = input.remoteSessionTools ? [...cliSchema.properties.tool.enum] : [...STATIC_DECISION_TOOL_NAMES];
    const promptMessages = input.resetRemoteSession ? input.fullTranscript : input.deltaMessages;
    const prompt = formatRemoteSessionPrompt(promptMessages, input.resetRemoteSession, input.remoteSessionTools);
    try {
      const turnResult = await this.executeSseTurn(input, prompt, schema, allowedTools, input.resetRemoteSession, callbacks);
      return { ...turnResult, syncedRemote: true };
    } catch (err) {
      assertNotAborted(input.signal);
      let activeErr = err;
      if (activeErr?.stage === "parse" && activeErr?.code !== "session_lost") {
        try {
          const repairPrompt = [
            `上一次输出未能通过 JSON 决策解析（${activeErr.message}）。`,
            "请严格只输出 1 个符合 JSON Schema 的 JSON 对象，包含 tool、reason、arguments_json 字段；不要输出任何额外文字、解释或工具调用。"
          ].join("\n");
          const repaired = await this.executeSseTurn(input, repairPrompt, schema, allowedTools, false, callbacks);
          return { ...repaired, syncedRemote: true };
        } catch (repairErr) {
          assertNotAborted(input.signal);
          activeErr = repairErr;
        }
      }
      if (!input.resetRemoteSession) {
        const degradeReason = activeErr?.message || String(activeErr);
        const rebuildPrompt = formatRemoteSessionPrompt(input.fullTranscript, true, input.remoteSessionTools);
        const rebuilt = await this.executeSseTurn(input, rebuildPrompt, schema, allowedTools, true, callbacks);
        return {
          ...rebuilt,
          degraded: true,
          degradeReason,
          syncedRemote: true
        };
      }
      throw activeErr;
    }
  }
  async resetSession(sessionKey) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      try {
        await fetch(`/_llm/session/${encodeURIComponent(sessionKey)}`, {
          method: "DELETE",
          signal: controller.signal
        });
      } finally {
        clearTimeout(timer);
      }
    } catch {
    }
  }
  async executeSseTurn(input, prompt, jsonSchema, allowedTools, reset, callbacks) {
    const timeoutSec = remainingTimeoutSec(input.backend.timeoutSec || 60, input.deadline);
    const controller = new AbortController();
    const abort = () => controller.abort();
    input.signal?.addEventListener("abort", abort, { once: true });
    if (input.signal?.aborted) controller.abort();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutSec * 1e3);
    let thoughtBuffer = "";
    let textBuffer = "";
    let usage;
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
          jsonSchema
        })
      });
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        throw Object.assign(new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`), {
          stage: res.status >= 400 && res.status < 500 ? "config" : "fetch"
        });
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";
      const handleFrame = (frame) => {
        const dataLines = frame.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim());
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
            usage
          });
        } else if (evt.type === "error") {
          throw Object.assign(new Error(evt.message || "远端会话执行失败"), {
            stage: evt.stage || "fetch",
            code: evt.code
          });
        } else if (evt.type === "result") {
          if (evt.usage) {
            usage = mergeUsage(usage, evt.usage);
            if (usage) callbacks?.onUsage?.(usage);
          }
          const reasoning = typeof evt.reasoningContent === "string" && evt.reasoningContent ? evt.reasoningContent : thoughtBuffer || void 0;
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
    } catch (err) {
      if (err?.stage) throw err;
      const isAbort = err?.name === "AbortError" || err instanceof DOMException && err.name === "AbortError";
      throw Object.assign(new Error(isAbort && timedOut ? "LLM request timed out" : err?.message || String(err)), {
        stage: "fetch"
      });
    } finally {
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", abort);
    }
  }
}
async function notifyRemoteResetGame(gameId) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    try {
      await fetch("/_llm/session/reset-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: gameId || "" }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
  }
}
export {
  RemoteSessionTransport,
  formatRemoteSessionPrompt,
  notifyRemoteResetGame
};
