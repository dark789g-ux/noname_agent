import assert from "node:assert/strict";
import test from "node:test";
import { decideOpening } from "./decision.js";
import { candidates, deferred, loggerFixture, response } from "./fixtures.js";
import type { SeatTransport, TransportTurnInput, TransportTurnResult } from "../harness/types.js";

function setup(transport: SeatTransport) {
	const { logger, entries } = loggerFixture();
	const controller = new AbortController();
	return {
		entries,
		controller,
		params: {
			gameId: "game1",
			round: 7,
			playerName: "3号位",
			backend: {
				kind: "codex" as const,
				configured: true,
				label: "codex",
				model: "",
				thinkingEffort: "default",
				timeoutSec: 30,
				maxRetries: 0,
			},
			snapshot: candidates(),
			facts: { seat: 3, identity: "忠臣", playerCount: 8 },
			budgetSec: 30,
			maxTurns: 2,
			logger,
			transport,
			signal: controller.signal,
		},
	};
}

test("专用选将会话传递工具、座位和取消信号，结束后删除远端会话", async () => {
	const requests: TransportTurnInput[] = [];
	const resets: string[] = [];
	const { params } = setup({
		stateful: true,
		sendTurn: async input => {
			requests.push(input);
			return response();
		},
		resetSession: async key => {
			resets.push(key);
		},
	});
	const result = await decideOpening(params);
	assert.deepEqual(result.selection, { characters: ["a1"], sources: ["a"], group: "wei" });
	assert.equal(requests[0].sessionKey, "game1:opening_7:seat_3");
	assert.notEqual(requests[0].sessionKey, "game1:seat_3");
	assert.deepEqual(
		requests[0].tools.map(tool => tool.type === "function" && tool.function.name),
		["select_character"]
	);
	assert.equal(requests[0].resetRemoteSession, true);
	assert.deepEqual(resets, ["game1:opening_7:seat_3"]);
});

test("非法输出重选使用同一截止时间和冻结候选，不追加思考内容", async () => {
	const requests: TransportTurnInput[] = [];
	const { params } = setup({
		stateful: true,
		sendTurn: async input => {
			requests.push(input);
			return requests.length === 1 ? { ...response("c0", "outside"), toolCall: { ...response("c0", "outside").toolCall, reasoningContent: "不继承思考" } } : response();
		},
	});
	const result = await decideOpening(params);
	assert.equal(result.selection?.characters[0], "a1");
	assert.equal(requests.length, 2);
	assert.equal(requests[0].deadline, requests[1].deadline);
	assert.equal(requests[1].resetRemoteSession, false);
	assert.doesNotMatch(JSON.stringify(requests[1].fullTranscript), /不继承思考/);
});

test("未配置、错误及持续非法输出均返回本地回退，不抛出阻塞开局", async () => {
	let requests = 0;
	const { params } = setup({
		stateful: false,
		sendTurn: async () => {
			requests++;
			return response("c9");
		},
	});
	assert.match((await decideOpening(params)).fallbackReason!, /invalid_selection/);
	assert.equal(requests, 2);
	params.backend.configured = false;
	assert.equal((await decideOpening(params)).fallbackReason, "no_config");
	assert.equal(requests, 2);
	params.backend.configured = true;
	params.transport.sendTurn = async () => {
		throw new Error("provider offline");
	};
	assert.equal((await decideOpening(params)).fallbackReason, "provider offline");
});

test("跳过立即结束忽略信号的请求，迟到响应不能变成选将结果", async () => {
	const late = deferred<TransportTurnResult>();
	const { params, controller } = setup({ stateful: false, sendTurn: () => late.promise });
	const pending = decideOpening(params);
	controller.abort();
	const result = await pending;
	assert.equal(result.fallbackReason, "user_skip");
	assert.equal(result.selection, undefined);
	late.resolve(response());
	assert.equal(result.selection, undefined);
});

test("选将总预算到期会取消请求并回退，不重置预算", async () => {
	const { params } = setup({ stateful: false, sendTurn: () => new Promise(() => {}) });
	params.budgetSec = 0.01;
	assert.equal((await decideOpening(params)).fallbackReason, "timeout");
});
