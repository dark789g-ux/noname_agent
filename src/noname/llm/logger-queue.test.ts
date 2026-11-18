import assert from "node:assert/strict";
import test from "node:test";
import { LLMLogPersistenceQueue, retryPendingActiveCheckpoints, shouldRetryPendingLogWrites } from "./logger-queue.js";

test("persistence queue preserves write order and does not leak failures", async () => {
	const events: string[] = [];
	const queue = new LLMLogPersistenceQueue({ reclaimQuota: async () => {}, report: operation => events.push(`failed:${operation}`), sleep: async () => {} });
	queue.enqueue("first", async () => events.push("first"));
	queue.enqueue("failed", async () => { throw new Error("offline"); });
	queue.enqueue("last", async () => events.push("last"));
	await queue.drain();
	assert.deepEqual(events, ["first", "failed:failed", "last"]);
});

test("quota errors reclaim space then retry once before normal retry policy", async () => {
	let attempts = 0;
	let reclaimed = 0;
	const queue = new LLMLogPersistenceQueue({ reclaimQuota: async () => { reclaimed++; }, report: () => assert.fail("should recover"), sleep: async () => {} });
	queue.enqueue("finalize", async () => {
		attempts++;
		if (attempts === 1) throw Object.assign(new Error("full"), { name: "QuotaExceededError" });
	});
	await queue.drain();
	assert.equal(reclaimed, 1);
	assert.equal(attempts, 2);
});

test("flush retry includes a pending active checkpoint before any final log exists", () => {
	assert.equal(shouldRetryPendingLogWrites(1, 0), true);
	assert.equal(shouldRetryPendingLogWrites(0, 1), true);
	assert.equal(shouldRetryPendingLogWrites(0, 0), false);
});

test("a failed checkpoint remains pending until a later flush retry persists it", async () => {
	const pending = new Map([["log_1", { id: "log_1" }]]);
	await assert.rejects(retryPendingActiveCheckpoints(pending, () => true, async () => { throw new Error("offline"); }), /offline/);
	assert.equal(pending.size, 1);
	let attempts = 0;
	await retryPendingActiveCheckpoints(pending, () => true, async () => ++attempts === 1);
	assert.equal(attempts, 1);
	assert.equal(pending.size, 0);
});

test("critical clear rejects after retries while reporting its persistence error", async () => {
	const errors: string[] = [];
	const queue = new LLMLogPersistenceQueue({ reclaimQuota: async () => {}, report: operation => errors.push(operation), sleep: async () => {} });
	await assert.rejects(queue.enqueueCritical("clear", async () => { throw new Error("clear unavailable"); }), /clear unavailable/);
	assert.deepEqual(errors, ["clear"]);
});

test("critical clear resolves after a transient store failure", async () => {
	let attempts = 0;
	const queue = new LLMLogPersistenceQueue({ reclaimQuota: async () => {}, report: () => assert.fail("should recover"), sleep: async () => {} });
	await queue.enqueueCritical("clear", async () => {
		attempts++;
		if (attempts === 1) throw new Error("temporary");
	});
	assert.equal(attempts, 2);
});
