function createRequestTiming(turnIndex, attemptIndex, transport, startedAtOffsetMs) {
  return { turnIndex, attemptIndex, transport, startedAtOffsetMs: Math.max(0, startedAtOffsetMs), outcome: "pending" };
}
function markRequestTiming(timing, field, elapsedMs) {
  if (timing[field] !== void 0) return false;
  timing[field] = Math.max(0, elapsedMs);
  return true;
}
function finishRequestTiming(timing, outcome, responseMs, errorStage) {
  timing.responseMs = Math.max(0, responseMs);
  timing.outcome = outcome;
  if (outcome === "error" && errorStage) timing.errorStage = errorStage;
}
export {
  createRequestTiming,
  finishRequestTiming,
  markRequestTiming
};
