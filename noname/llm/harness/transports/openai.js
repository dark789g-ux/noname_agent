import { callLLMStream, callLLMWithTimeout } from "../../client.js";
import { remainingTimeoutSec } from "../../protocol.js";
import { assertNotAborted } from "../../character-selection/abort.js";
function toLLMConfig(input) {
  const b = input.backend;
  return {
    enabled: true,
    controlSelf: false,
    url: b.url || "",
    apikey: b.apikey || "",
    model: b.model || "",
    thinkingEffort: b.thinkingEffort || "medium",
    maxRetries: b.maxRetries || 0,
    timeoutSec: remainingTimeoutSec(b.timeoutSec || 30, input.deadline),
    multiTurn: true,
    maxTurns: 4,
    decisionTimeoutSec: 60,
    defaultBackend: "openai",
    openaiDisplayName: b.label || "",
    openaiContextSize: b.contextSize ?? 128e3,
    agy: { displayName: "agy", command: "agy", model: "", thinkingEffort: "default", timeoutSec: 60, extraArgs: "" },
    codex: { displayName: "codex", command: "codex", model: "", thinkingEffort: "default", timeoutSec: 60, extraArgs: "" },
    seatBackends: {}
  };
}
class OpenAITransport {
  stateful = false;
  async sendTurn(input, callbacks) {
    assertNotAborted(input.signal);
    let latestUsage;
    const forwardCallbacks = {
      onFirstChunk: () => callbacks?.onFirstChunk?.(),
      onFirstToken: () => callbacks?.onFirstToken?.(),
      onChunk: (partial) => callbacks?.onChunk?.(partial),
      onStreamProgress: (progress) => {
        if (progress.usage) latestUsage = progress.usage;
        callbacks?.onStreamProgress?.(progress);
      },
      onUsage: (usage) => {
        latestUsage = usage;
        callbacks?.onUsage?.(usage);
      }
    };
    let attemptIndex = 0;
    const cfg = toLLMConfig(input);
    if (input.allowStream) {
      callbacks?.onAttemptStart?.(attemptIndex, "stream");
      try {
        const toolCall = await callLLMStream(input.fullTranscript, input.tools, cfg, forwardCallbacks, input.signal);
        callbacks?.onAttemptFinish?.(attemptIndex, "success");
        return { toolCall, usage: latestUsage, transport: "stream", syncedRemote: false };
      } catch (streamError) {
        callbacks?.onAttemptFinish?.(attemptIndex, "error", streamError?.stage);
        assertNotAborted(input.signal);
        if (["parse", "config"].includes(streamError?.stage)) throw streamError;
        attemptIndex++;
      }
    }
    callbacks?.onAttemptStart?.(attemptIndex, "nonstream");
    try {
      const nonstreamCfg = toLLMConfig(input);
      const toolCall = await callLLMWithTimeout(input.fullTranscript, input.tools, nonstreamCfg, {
        onUsage: (usage) => {
          latestUsage = usage;
          callbacks?.onUsage?.(usage);
        }
      }, input.signal);
      callbacks?.onAttemptFinish?.(attemptIndex, "success");
      return { toolCall, usage: latestUsage, transport: "nonstream", syncedRemote: false };
    } catch (error) {
      callbacks?.onAttemptFinish?.(attemptIndex, "error", error?.stage);
      throw error;
    }
  }
}
export {
  OpenAITransport
};
