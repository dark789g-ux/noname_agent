import "../../node_modules/.pnpm/openai@6.48.0_ws@8.19.0/node_modules/openai/index.js";
import { assertLLMURL } from "./config.js";
import { parseToolCallResult } from "./tool-call-parser.js";
import { requestWithParallelToolFallback } from "./client-request.js";
import { OpenAI } from "../../node_modules/.pnpm/openai@6.48.0_ws@8.19.0/node_modules/openai/client.js";
import { APIConnectionTimeoutError, APIConnectionError, APIError } from "../../node_modules/.pnpm/openai@6.48.0_ws@8.19.0/node_modules/openai/core/error.js";
async function callLLMWithTimeout(messages, tools, config, callbacks, signal) {
  assertLLMURL(config.url);
  const client = new OpenAI({
    baseURL: config.url,
    apiKey: config.apikey,
    timeout: config.timeoutSec * 1e3,
    maxRetries: config.maxRetries,
    dangerouslyAllowBrowser: true
  });
  let httpStatus;
  try {
    const body = {
      model: config.model,
      messages,
      tools,
      tool_choice: "auto",
      parallel_tool_calls: false
    };
    if (config.thinkingEffort !== "none") {
      body.reasoning_effort = config.thinkingEffort;
    }
    const resp = await requestWithParallelToolFallback((includeParameter, timeout) => {
      const { parallel_tool_calls, ...withoutParallel } = body;
      return client.chat.completions.create(includeParameter ? body : withoutParallel, { timeout, signal });
    }, config.timeoutSec * 1e3, signal);
    const usage = extractOpenAIUsage(resp?.usage);
    if (usage) {
      try {
        callbacks?.onUsage?.(usage);
      } catch {
      }
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
  } catch (e) {
    if (e?.stage) throw e;
    if (e instanceof APIConnectionTimeoutError) {
      throwErr("fetch", "LLM request timed out");
    }
    if (e instanceof APIConnectionError) {
      throwErr("fetch", `LLM fetch error: ${e.message}`);
    }
    if (e instanceof APIError) {
      httpStatus = e.status;
      const bodyText = String(
        e.error?.message ?? e.message ?? ""
      ).slice(0, 200);
      throwErr("fetch", `HTTP ${e.status}: ${bodyText}`);
    }
    throwErr("fetch", `LLM fetch error: ${e?.message ?? e}`);
  }
  function throwErr(stage, message) {
    const err = new Error(message);
    err.stage = stage;
    err.httpStatus = httpStatus;
    throw err;
  }
}
async function callLLMStream(messages, tools, config, callbacks = {}, signal) {
  assertLLMURL(config.url);
  const client = new OpenAI({
    baseURL: config.url,
    apiKey: config.apikey,
    timeout: config.timeoutSec * 1e3,
    maxRetries: config.maxRetries,
    dangerouslyAllowBrowser: true
  });
  let httpStatus;
  let errorReported = false;
  try {
    const body = {
      model: config.model,
      messages,
      tools,
      tool_choice: "auto",
      parallel_tool_calls: false,
      stream: true
    };
    if (config.thinkingEffort !== "none") {
      body.reasoning_effort = config.thinkingEffort;
    }
    body.stream_options = { include_usage: true };
    const stream = await requestWithParallelToolFallback(async (includeParameter, timeout) => {
      const { parallel_tool_calls, ...withoutParallel } = body;
      return client.chat.completions.create(
        includeParameter ? body : withoutParallel,
        { signal, timeout }
      );
    }, config.timeoutSec * 1e3, signal);
    let functionName = "";
    let toolCallId = "";
    let argumentsBuffer = "";
    let reasoningBuffer = "";
    let latestUsage;
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
      if (calls?.length > 1 || calls?.some((call) => (call.index ?? 0) !== 0)) {
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
          usage: latestUsage
        });
      }
    }
    if (!functionName || !toolCallId) {
      throwErr("parse", "LLM stream ended without a complete tool_call");
    }
    return parseToolCallResult(toolCallId, functionName, argumentsBuffer, reasoningBuffer);
  } catch (e) {
    if (e?.stage) {
      notifyError(e.stage, e.message, e.httpStatus);
      throw e;
    }
    if (e instanceof DOMException && e.name === "AbortError") {
      throwErr("fetch", "LLM stream request was aborted");
    }
    if (e instanceof APIConnectionTimeoutError) {
      throwErr("fetch", "LLM request timed out");
    }
    if (e instanceof APIConnectionError) {
      throwErr("fetch", `LLM fetch error: ${e.message}`);
    }
    if (e instanceof APIError) {
      httpStatus = e.status;
      const bodyText = String(
        e.error?.message ?? e.message ?? ""
      ).slice(0, 200);
      throwErr("fetch", `HTTP ${e.status}: ${bodyText}`);
    }
    throwErr("fetch", `LLM fetch error: ${e?.message ?? e}`);
  }
  function throwErr(stage, message) {
    const err = new Error(message);
    err.stage = stage;
    err.httpStatus = httpStatus;
    notifyError(stage, err.message, httpStatus);
    throw err;
  }
  function notifyError(stage, message, status) {
    if (errorReported) return;
    errorReported = true;
    try {
      callbacks.onError?.(stage, message, status);
    } catch {
    }
  }
  function notify(name, partialArgs) {
    try {
      if (name === "onChunk") callbacks.onChunk?.(partialArgs || "");
      else if (name === "onFirstChunk") callbacks.onFirstChunk?.();
      else if (name === "onFirstToken") callbacks.onFirstToken?.();
    } catch {
    }
  }
  function notifyProgress(progress) {
    try {
      callbacks.onStreamProgress?.(progress);
    } catch {
    }
  }
  function notifyUsage(usage) {
    try {
      callbacks.onUsage?.(usage);
    } catch {
    }
  }
}
function extractOpenAIUsage(raw) {
  if (!raw || typeof raw !== "object") return void 0;
  const inputTokens = typeof raw.prompt_tokens === "number" ? raw.prompt_tokens : void 0;
  const outputTokens = typeof raw.completion_tokens === "number" ? raw.completion_tokens : void 0;
  const thoughtTokens = typeof raw.completion_tokens_details?.reasoning_tokens === "number" ? raw.completion_tokens_details.reasoning_tokens : void 0;
  const total = typeof raw.total_tokens === "number" ? raw.total_tokens : void 0;
  const contextUsed = total ?? (inputTokens !== void 0 && outputTokens !== void 0 ? inputTokens + outputTokens : inputTokens);
  if (inputTokens === void 0 && outputTokens === void 0 && thoughtTokens === void 0 && contextUsed === void 0) {
    return void 0;
  }
  return { inputTokens, outputTokens, thoughtTokens, contextUsed };
}
function extractReasoningText(message) {
  if (typeof message?.reasoning_content === "string" && message.reasoning_content.length > 0) return message.reasoning_content;
  if (typeof message?.reasoning === "string" && message.reasoning.length > 0) return message.reasoning;
  return "";
}
function formatStreamPreview(reasoningBuffer, argumentsBuffer) {
  if (!reasoningBuffer) return argumentsBuffer;
  if (!argumentsBuffer) return reasoningBuffer;
  return `${reasoningBuffer}

[tool_call]
${argumentsBuffer}`;
}
function hasTokenDelta(delta) {
  if (extractReasoningText(delta).length > 0) return true;
  if (typeof delta?.content === "string" && delta.content.length > 0) return true;
  if (typeof delta?.function_call?.arguments === "string" && delta.function_call.arguments.length > 0) return true;
  return delta?.tool_calls?.some((call) => typeof call?.function?.arguments === "string" && call.function.arguments.length > 0) || false;
}
export {
  callLLMStream,
  callLLMWithTimeout,
  parseToolCallResult
};
