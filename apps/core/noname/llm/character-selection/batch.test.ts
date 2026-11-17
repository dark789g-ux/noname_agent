import assert from "node:assert/strict";
import test from "node:test";
import { runSelectionBatches } from "./batch.js";
import { OpeningState } from "./state.js";
import { abortable } from "./abort.js";
import { deferred } from "./fixtures.js";

test("两人候选互斥、最多两个并发、固定顺序提交且整批才释放", async () => {
	const pool = ["a", "b", "c", "d", "e", "f"];
	const pending = new Map<number, ReturnType<typeof deferred<string>>>();
	const prepared: string[][] = [];
	const commits: number[] = [];
	const thirdPrepared = deferred<void>();
	let active = 0,
		maximum = 0;
	const running = runSelectionBatches([1, 2, 3], {
		eligible: () => true,
		local: () => {},
		canPair: () => pool.length >= 4,
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
			if (job.seat === 3) thirdPrepared.resolve();
			return next.promise.finally(() => {
				active--;
			});
		},
		commit: (job, result) => {
			assert.equal(job.choices[0], result);
			commits.push(job.seat);
		},
		release: job => {
			assert.deepEqual(commits.slice(0, 2), [1, 2]);
			pool.push(job.choices[1]);
		},
	});
	assert.deepEqual(prepared, [
		["a", "b"],
		["c", "d"],
	]);
	pending.get(2)!.resolve("c");
	await Promise.resolve();
	assert.deepEqual(commits, []);
	pending.get(1)!.resolve("a");
	// 第三座位 prepare 是第一个批次全部提交与回收后的事件。
	await thirdPrepared.promise;
	assert.deepEqual(prepared[2], ["e", "f"]);
	pending.get(3)!.resolve("e");
	await running;
	assert.equal(maximum, 2);
	assert.deepEqual(commits, [1, 2, 3]);
});

test("候选池不足时串行，本地座位不进入请求且保留原处理", async () => {
	const trace: string[] = [];
	await runSelectionBatches([1, 2, 3], {
		eligible: seat => seat !== 2,
		local: seat => {
			trace.push(`local${seat}`);
		},
		canPair: () => false,
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
