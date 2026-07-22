import type { ErrorStage, RequestOutcome, RequestTiming, RequestTransport } from "./logger-types.js";

export function createRequestTiming(turnIndex: number, attemptIndex: number, transport: RequestTransport, startedAtOffsetMs: number): RequestTiming {
	return { turnIndex, attemptIndex, transport, startedAtOffsetMs: Math.max(0, startedAtOffsetMs), outcome: "pending" };
}

/** 返回是否首次写入；调用方据此决定是否写入首 TTFT 检查点。 */
export function markRequestTiming(timing: RequestTiming, field: "firstChunkMs" | "ttftMs", elapsedMs: number): boolean {
	if (timing[field] !== undefined) return false;
	timing[field] = Math.max(0, elapsedMs);
	return true;
}

export function finishRequestTiming(timing: RequestTiming, outcome: Exclude<RequestOutcome, "pending">, responseMs: number, errorStage?: ErrorStage): void {
	timing.responseMs = Math.max(0, responseMs);
	timing.outcome = outcome;
	if (outcome === "error" && errorStage) timing.errorStage = errorStage;
}
