import assert from "node:assert/strict";
import test from "node:test";
import { LLMLogLease, type LLMLogBroadcastChannel } from "./logger-lease.js";
import { activeCheckpointMatches, canFinalizeActive, canPutActive, canRecoverActive, isRecoveryEntryForActive, migrationSourceMatches, selectLegacyEntries, shouldMigrateSource, type ActiveLogRecord, type LegacyMigrationSourceSnapshot, type LLMLogEntryRecord } from "./logger-store.js";
import { createRequestTiming, finishRequestTiming, markRequestTiming } from "./logger-timing.js";

const entry = (id: string, timestamp = 1): LLMLogEntryRecord => ({ id, gameId: "game_1", timestamp });
const active = (ownerId = "tab_1", updatedAt = 10): ActiveLogRecord => ({ id: "log_1", ownerId, gameId: "game_1", status: "active", timestamp: 1, updatedAt, deadlineAt: 20, entry: entry("log_1") });

test("legacy migration selection retains valid records beside malformed records", () => {
	const records = [entry("valid_old", 1), null, { random: "bad" }, entry("valid_new", 3)];
	const selected = selectLegacyEntries(records);
	assert.deepEqual(selected.entries.map(record => record.id), ["valid_old", "valid_new"]);
	assert.equal(selected.discardedLegacy, 0);
	assert.equal(selected.malformed, 2);
});

test("a structurally valid pre-gameId record clears the whole legacy migration batch", () => {
	const selected = selectLegacyEntries([entry("valid", 1), { id: "old_format", timestamp: 2 }]);
	assert.deepEqual(selected.entries, []);
	assert.equal(selected.discardedLegacy, 1);
});

test("legacy migration selection keeps only the latest 500 compatible records", () => {
	const selected = selectLegacyEntries(Array.from({ length: 501 }, (_, index) => entry(`log_${index}`, index)));
	assert.equal(selected.entries.length, 500);
	assert.equal(selected.entries[0].id, "log_1");
});

const migrationSource = (legacy: unknown[] = [], formerCompleted: unknown[] = []): LegacyMigrationSourceSnapshot => ({ legacy, formerCompleted, formerActive: [], formerLeases: [] });

test("source CAS detects an old-v4 writer append between copy and cleanup", () => {
	const copied = migrationSource([entry("old")]);
	const appended = migrationSource([entry("old"), entry("concurrent")]);
	assert.equal(migrationSourceMatches(copied, appended), false);
	assert.equal(shouldMigrateSource(false, appended), true);
	assert.equal(migrationSourceMatches(appended, migrationSource([entry("old"), entry("concurrent")])), true);
});

test("a marker skips cleared sources but not a legacy key recreated by an old writer", () => {
	const cleared = migrationSource();
	assert.equal(shouldMigrateSource(true, cleared), false);
	// Clearing the independent target and reloading cannot resurrect the old v5 source.
	assert.deepEqual(cleared.formerCompleted, []);
	const recreated = migrationSource([entry("written_after_marker")]);
	assert.equal(shouldMigrateSource(true, recreated), true);
});

test("failed source cleanup remains retryable after idempotent target copy", () => {
	const snapshot = migrationSource([], [entry("former_v5")]);
	const changedBeforeCleanup = migrationSource([], [entry("former_v5"), entry("late_v5")]);
	assert.equal(migrationSourceMatches(snapshot, changedBeforeCleanup), false);
	assert.equal(shouldMigrateSource(false, changedBeforeCleanup), true);
	assert.deepEqual(new Set(changedBeforeCleanup.formerCompleted.map(value => (value as LLMLogEntryRecord).id)), new Set(["former_v5", "late_v5"]));
});

test("two-phase migration state does not resurrect a cleared independent target", async () => {
	let marker = false;
	let source = migrationSource([], [entry("former_v5")]);
	const target = new Map<string, LLMLogEntryRecord>();
	const migrate = async (failCleanup: boolean) => {
		const snapshot = structuredClone(source);
		for (const value of snapshot.formerCompleted) {
			const record = value as LLMLogEntryRecord;
			target.set(record.id, record); // idempotent target upsert
		}
		if (failCleanup) throw new Error("source cleanup failed");
		if (!migrationSourceMatches(snapshot, source)) throw new Error("source changed");
		source = migrationSource();
		marker = true;
	};
	await assert.rejects(migrate(true), /cleanup failed/);
	assert.equal(marker, false);
	assert.equal(source.formerCompleted.length, 1);
	await migrate(false);
	assert.equal(marker, true);
	assert.equal(source.formerCompleted.length, 0);
	assert.equal(target.size, 1);
	target.clear();
	if (shouldMigrateSource(marker, source)) await migrate(false);
	assert.equal(target.size, 0);
});

test("recovery requires the exact active owner snapshot and an absent completed entry", () => {
	assert.equal(canRecoverActive(active(), active(), false), true);
	assert.equal(canRecoverActive(active(), active("tab_2"), false), false);
	assert.equal(canRecoverActive(active(), active("tab_1", 11), false), false);
	assert.equal(canRecoverActive(active(), active(), true), false);
	assert.equal(isRecoveryEntryForActive(active(), entry("log_1")), true);
	assert.equal(isRecoveryEntryForActive(active(), entry("another_log")), false);
});

test("a completed recovery blocks stale owner checkpoint writes and finalization", () => {
	const stale = active("tab_1", 10);
	assert.equal(canPutActive({ ...stale, updatedAt: 11 }, undefined, true), false);
	assert.equal(canFinalizeActive(stale, stale, true), false);
});

test("active checkpoint CAS accepts only monotonic same-owner updates", () => {
	const current = { ...active(), revision: 2 };
	assert.equal(canPutActive({ ...current, revision: 3 }, current, false), true);
	assert.equal(canPutActive({ ...current, revision: 2, updatedAt: 100 }, current, false), false);
	assert.equal(canPutActive({ ...current, ownerId: "tab_2", revision: 3 }, current, false), false);
	assert.equal(canPutActive(current, undefined, false), true);
});

test("discard/finalize checkpoint matching rejects a newer replacement", () => {
	const expected = { ...active(), revision: 2 };
	assert.equal(activeCheckpointMatches(expected, expected), true);
	assert.equal(canFinalizeActive(expected, { ...expected, revision: 3 }, false), false);
	assert.equal(canFinalizeActive(expected, { ...expected, ownerId: "tab_2" }, false), false);
});

test("request timing records stream fallback and later turns without mistaking zero for missing", () => {
	const stream = createRequestTiming(0, 0, "stream", 0);
	assert.equal(markRequestTiming(stream, "firstChunkMs", 0), true);
	assert.equal(markRequestTiming(stream, "ttftMs", 0), true);
	assert.equal(markRequestTiming(stream, "ttftMs", 3), false, "TTFT only checkpoints once");
	finishRequestTiming(stream, "error", 4, "fetch");
	const fallback = createRequestTiming(0, 1, "nonstream", 4);
	finishRequestTiming(fallback, "success", 5);
	const laterTurn = createRequestTiming(1, 0, "nonstream", 9);
	finishRequestTiming(laterTurn, "error", 2, "parse");
	assert.deepEqual([stream, fallback, laterTurn], [
		{ turnIndex: 0, attemptIndex: 0, transport: "stream", startedAtOffsetMs: 0, firstChunkMs: 0, ttftMs: 0, responseMs: 4, outcome: "error", errorStage: "fetch" },
		{ turnIndex: 0, attemptIndex: 1, transport: "nonstream", startedAtOffsetMs: 4, responseMs: 5, outcome: "success" },
		{ turnIndex: 1, attemptIndex: 0, transport: "nonstream", startedAtOffsetMs: 9, responseMs: 2, outcome: "error", errorStage: "parse" },
	]);
});

class FakeChannel implements LLMLogBroadcastChannel {
	static readonly channels = new Set<FakeChannel>();
	onmessage: ((event: MessageEvent<any>) => void) | null = null;

	constructor() {
		FakeChannel.channels.add(this);
	}

	postMessage(message: any): void {
		for (const channel of FakeChannel.channels) {
			if (channel !== this) queueMicrotask(() => channel.onmessage?.({ data: message } as MessageEvent<any>));
		}
	}

	close(): void {
		FakeChannel.channels.delete(this);
	}
}

test("concurrent liveness probes use independent pending entries", async () => {
	const store = { putLease: async () => {}, deleteLease: async () => {} };
	const makeChannel = () => new FakeChannel();
	const first = new LLMLogLease({ store, prefix: "test", instanceId: "tab_1", broadcastChannelFactory: makeChannel });
	const second = new LLMLogLease({ store, prefix: "test", instanceId: "tab_2", broadcastChannelFactory: makeChannel });
	const replies = await Promise.all([first.confirmAlive(["tab_2"], 25), first.confirmAlive(["tab_2"], 25)]);
	assert.deepEqual(replies.map(reply => Array.from(reply)), [["tab_2"], ["tab_2"]]);
	await first.close(false);
	await second.close(false);
});
