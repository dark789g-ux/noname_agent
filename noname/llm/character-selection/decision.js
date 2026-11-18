import { assistantToolMessage } from "../protocol.js";
import { assertNotAborted, abortable } from "./abort.js";
import { buildSelectionPrompt, CHARACTER_SELECTION_TOOLS } from "./prompt.js";
import { validateCharacterSelection } from "./validation.js";
async function decideOpening(params) {
  const { backend, snapshot, facts, logger, transport } = params;
  const deadline = Date.now() + params.budgetSec * 1e3;
  const logId = logger.start(
    "chooseCharacter",
    params.playerName,
    {
      enabled: true,
      configured: backend.configured,
      backend: backend.kind,
      model: backend.model,
      providerLabel: backend.label
    },
    facts.seat,
    deadline
  );
  const sessionKey = `${params.gameId}:opening_${params.round}:seat_${facts.seat}`;
  logger.logSessionMeta(logId, { mode: "full", sessionKey });
  logger.logRefLabels(logId, Object.fromEntries(snapshot.candidates.flatMap((candidate) => [[candidate.ref, candidate.versions.map((version) => version.label).join(" / ")], ...candidate.versions.map((version) => [version.name, version.label])])));
  const messages = buildSelectionPrompt(snapshot, facts);
  const controller = new AbortController();
  const abort = () => controller.abort();
  params.signal.addEventListener("abort", abort, { once: true });
  if (params.signal.aborted) controller.abort();
  let timedOut = false;
  const timer = setTimeout(
    () => {
      timedOut = true;
      controller.abort();
    },
    Math.max(0, deadline - Date.now())
  );
  try {
    assertNotAborted(controller.signal);
    if (!backend.configured) return { logId, fallbackReason: "no_config" };
    for (let turn = 0; turn < Math.max(1, params.maxTurns); turn++) {
      assertNotAborted(controller.signal);
      if (Date.now() >= deadline) return { logId, fallbackReason: "timeout" };
      logger.logRequest(logId, messages, CHARACTER_SELECTION_TOOLS);
      let attempt = 0;
      const requestMessages = messages.slice();
      const response = await abortable(
        transport.sendTurn(
          {
            gameId: params.gameId,
            sessionKey,
            seatNum: facts.seat,
            backend,
            tools: CHARACTER_SELECTION_TOOLS,
            remoteSessionTools: CHARACTER_SELECTION_TOOLS,
            fullTranscript: requestMessages,
            deltaMessages: turn === 0 ? requestMessages : messages.slice(-3),
            resetRemoteSession: turn === 0,
            allowStream: true,
            deadline,
            signal: controller.signal
          },
          {
            onAttemptStart: (index, kind) => {
              attempt = index;
              logger.startRequestAttempt(logId, turn, index, kind);
            },
            onAttemptFinish: (index, outcome, stage) => logger.finishRequestAttempt(logId, turn, index, outcome, stage),
            onFirstChunk: () => logger.markRequestFirstChunk(logId, turn, attempt),
            onFirstToken: () => logger.markRequestTTFT(logId, turn, attempt),
            onChunk: (partial) => logger.logStreamChunk(logId, partial),
            onStreamProgress: (progress) => logger.logStreamProgress(logId, { ...progress, turnIndex: turn })
          }
        ),
        controller.signal
      );
      assertNotAborted(controller.signal);
      const toolCall = response.toolCall;
      try {
        if (toolCall.name !== "select_character") throw new Error("仅允许 select_character");
        const selection = validateCharacterSelection(snapshot, toolCall.arguments);
        logger.logTurn(logId, { index: turn, request: { messages: requestMessages, tools: CHARACTER_SELECTION_TOOLS }, toolCall, result: selection, usage: response.usage });
        return { logId, selection, toolCall };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.logTurn(logId, { index: turn, request: { messages: requestMessages, tools: CHARACTER_SELECTION_TOOLS }, toolCall, error: message });
        if (turn + 1 >= params.maxTurns) return { logId, fallbackReason: `invalid_selection: ${message}` };
        messages.push(assistantToolMessage({ ...toolCall, reasoningContent: void 0 }), { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ accepted: false, error: message }) }, { role: "user", content: "请重新从同一冻结候选中提交合法选择。本步允许工具：select_character" });
      }
    }
    return { logId, fallbackReason: "invalid_selection" };
  } catch (error) {
    const reason = timedOut ? "timeout" : params.signal.aborted ? "user_skip" : error?.message || String(error);
    if (!controller.signal.aborted) logger.logError(logId, error?.stage || "fetch", reason);
    return { logId, fallbackReason: reason };
  } finally {
    clearTimeout(timer);
    params.signal.removeEventListener("abort", abort);
    if (transport.stateful) void transport.resetSession?.(sessionKey);
  }
}
export {
  decideOpening
};
