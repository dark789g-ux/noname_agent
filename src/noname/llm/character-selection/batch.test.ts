import assert from "node:assert/strict";
import test from "node:test";
import { runSelectionBatches } from "./batch.js";
import { OpeningState } from "./state.js";
import { abortable } from "./abort.js";
import { deferred } from "./fixtures.js";

test("候选互斥、池充足时单批全量并发、池不足时贪心分批，固定顺序提交且整批才释放", async () => {
	const pool = ["a", "b", "c", "d", "e", "f"];
	const pending = new Map<number, ReturnType<typeof deferred<string>>>();
	const prepared: string[][] = [];
	const commits: number[] = [];
	const fourthPrepared = deferred<void>();
	let active = 0,
		maximum = 0;
	const running = runSelectionBatches([1, 2, 3, 4], {
		eligible: () => true,
		local: () => {},
		canBatch: batch => pool.length >= (batch.length + 1) * 2,
		prepare: seat => {
			const choices = pool.splice(0, 2);
			prepared.push(choices);
			return { seat, choices };
		},
		decide: job => {
			active++;
			maximum = Math.max(maximum, active);
			const next = deferred<string>();
			pending.set(job.seat, next);
			if (job.seat === 4) fourthPrepared.resolve();
			return next.promise.finally(() => {
				active--;
			});
		},
		commit: (job, result) => {
			assert.equal(job.choices[0], result);
			commits.push(job.seat);
		},
		release: job => {
			assert.deepEqual(commits.slice(0, 3), [1, 2, 3]);
			pool.push(job.choices[1]);
		},
	});
	assert.deepEqual(prepared, [
		["a", "b"],
		["c", "d"],
		["e", "f"],
	]);
	pending.get(3)!.resolve("e");
	pending.get(2)!.resolve("c");
	await Promise.resolve();
	assert.deepEqual(commits, []);
	pending.get(1)!.resolve("a");
	// 第四座位 prepare 是第一批全部提交与回收后的事件。
	await fourthPrepared.promise;
	assert.deepEqual(prepared[3], ["b", "d"]);
	pending.get(4)!.resolve("b");
	await running;
	assert.equal(maximum, 3);
	assert.deepEqual(commits, [1, 2, 3, 4]);
});

test("池充足时本地座位不拆散并发批次", async () => {
	const trace: string[] = [];
	let active = 0,
		maximum = 0;
	await runSelectionBatches([1, 2, 3, 4], {
		eligible: seat => seat !== 2,
		local: seat => {
			trace.push(`local${seat}`);
		},
		canBatch: () => true,
		prepare: seat => {
			trace.push(`prepare${seat}`);
			return seat;
		},
		decide: async seat => {
			active++;
			maximum = Math.max(maximum, active);
			trace.push(`request${seat}`);
			await Promise.resolve();
			active--;
			return seat;
		},
		commit: seat => {
			trace.push(`commit${seat}`);
		},
		release: seat => {
			trace.push(`release${seat}`);
		},
	});
	assert.equal(maximum, 3);
	assert.deepEqual(trace, ["prepare1", "prepare3", "prepare4", "request1", "request3", "request4", "commit1", "commit3", "commit4", "release1", "release3", "release4", "local2"]);
});

test("候选池不足时串行，本地座位不进入请求且保留原处理", async () => {
	const trace: string[] = [];
	await runSelectionBatches([1, 2, 3], {
		eligible: seat => seat !== 2,
		local: seat => {
			trace.push(`local${seat}`);
		},
		canBatch: () => false,
		prepare: seat => {
			trace.push(`prepare${seat}`);
			return seat;
		},
		decide: async seat => {
			trace.push(`request${seat}`);
			return seat;
		},
		commit: seat => {
			trace.push(`commit${seat}`);
		},
		release: seat => {
			trace.push(`release${seat}`);
		},
	});
	assert.deepEqual(trace, ["prepare1", "request1", "commit1", "release1", "local2", "prepare3", "request3", "commit3", "release3"]);
});

test("跳过保留已完成结果、取消活动请求并停止后续请求；失效标记单独阻止写回", async () => {
	const state = new OpeningState();
	assert.equal(await state.request(1, async () => "completed"), "completed");
	const late = deferred<string>();
	const pending = state.request(2, signal => abortable(late.promise, signal));
	state.skip();
	await assert.rejects(pending, { name: "AbortError" });
	assert.equal(
		await state.request(3, async () => {
			throw new Error("不应请求");
		}),
		undefined
	);
	assert.equal(state.valid, true);
	state.invalidate();
	assert.equal(state.valid, false);
	late.resolve("late");
});
