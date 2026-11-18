import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers";
import { identityFixture, selectionResponse } from "./identity-fixture.mjs";

for (const double of [false, true]) {
	test(`实际身份选将 ${double ? "双将" : "单将"}：主公先选、其余全量并发、无人工补选、每座位只初始化一次`, async t => {
		const fixture = await identityFixture({ double });
		t.after(() => fixture.close());
		await fixture.run();
		assert.equal(fixture.event.waitCalls, 3, "保留准备、结果和收尾阶段之间的子事件队列边界");
		assert.equal(fixture.requests.length, 6);
		assert.equal(fixture.requests[0].seatNum, 1);
		assert.equal(fixture.maximum(), 5);
		assert.equal(fixture.manual(), 0);
		assert.equal(fixture.game.zhu.group, "qun");
		assert.equal(fixture.game.zhu.maxHp, 5);
		assert.equal(fixture.status.auto, false);
		const sources = fixture.game.players.flatMap(player => [player.name1, player.name2].filter(Boolean));
		assert.equal(new Set(sources).size, sources.length);
		assert.ok(fixture.game.players.every(player => player.initCalls === 1 && !!player.name2 === double));
		assert.ok(fixture.roots.every(root => root.removed));
		const id = fixture.status.llmGameId;
		fixture.hooks.get("gameStart")();
		assert.equal(fixture.status.llmGameId, id);
		assert.equal(fixture.status.auto, true);
	});
}

test("AI 主公先选，受接管的非主公自身位与其余非主公座位同批全量并发", async t => {
	const fixture = await identityFixture({ controlSelf: true, humanIsMonarch: false });
	t.after(() => fixture.close());
	await fixture.run();
	assert.equal(fixture.event.waitCalls, 3, "保留准备、结果和收尾阶段之间的子事件队列边界");
	assert.equal(fixture.requests.length, 6);
	assert.equal(fixture.requests[0].seatNum, 1);
	assert.equal(fixture.maximum(), 5);
	assert.equal(fixture.manual(), 0);
	const sources = fixture.game.players.flatMap(player => [player.name1, player.name2].filter(Boolean));
	assert.equal(new Set(sources).size, sources.length);
	assert.ok(fixture.game.players.every(player => player.initCalls === 1));
});

test("AI 主公先于未接管真人；手动真人和本地 AI 座位保留原路径", async t => {
	const fixture = await identityFixture({ controlSelf: false, humanIsMonarch: false, seatBackends: { 4: "local" } });
	t.after(() => fixture.close());
	await fixture.run();
	assert.equal(fixture.manual(), 1);
	assert.equal(fixture.requests[0].seatNum, 1);
	assert.deepEqual(
		fixture.requests.map(request => request.seatNum),
		[1, 2, 3, 5]
	);
	assert.ok(fixture.game.players.every(player => player.initCalls === 1));
});

test("真人主公手动选定的势力在后续 LLM 提示中已公开生效", async t => {
	const fixture = await identityFixture({ controlSelf: false });
	t.after(() => fixture.close());
	await fixture.run();
	assert.equal(fixture.manual(), 2);
	assert.equal(fixture.game.me.group, "wu");
	const prompt = String(fixture.requests[0].fullTranscript[1].content);
	assert.match(prompt, /- 你的座位：2号位（共 6 人，主公为 1 号位）/);
	assert.match(prompt, /- 离主公的距离：初始距离 1（主公下家方向 1 步，主公上家方向 5 步；未计入技能与坐骑修正）/);
	assert.match(prompt, /- 已公开主公：hero0（势力：wu；体力：5）/);
	assert.match(prompt, /- 主公技能：\n {2}- test_skill：技能说明/);
});

test("真人选将阶段仅换座不重进 step 0，后续自动选将按最终桌位继续", async t => {
	const fixture = await identityFixture({ controlSelf: false, pauseManual: true });
	t.after(() => fixture.close());
	const pending = fixture.run();
	await fixture.waitForManual();
	const previous = fixture.event.llmOpening;
	fixture.game.players[1].dataset.position = "2";
	fixture.game.players[2].dataset.position = "1";
	fixture.resumeManual();
	await pending;
	assert.equal(previous.state.valid, false);
	assert.deepEqual(
		fixture.requests.map(input => input.seatNum),
		[3, 2, 4, 5, 6]
	);
	assert.ok(fixture.game.players.every(player => player.initCalls === 1));
});

test("跳过保留已完成主公，取消活动请求并停止后续请求，剩余自动回退", async t => {
	let fixture;
	fixture = await identityFixture({
		request: async (input, count) => {
			if (count === 1) return selectionResponse(input);
			fixture.event.llmOpening.state.skip();
			return await new Promise(() => {});
		},
	});
	t.after(() => fixture.close());
	await fixture.run();
	assert.equal(fixture.requests.length, 2);
	assert.ok(fixture.game.players.every(player => player.initCalls === 1));
	const ends = fixture.logs.filter(log => ["end", "endFallback"].includes(log.method));
	assert.equal(ends.filter(log => log.method === "end" && log.args[1] === "success").length, 1);
	assert.equal(ends.filter(log => log.method === "endFallback").length, 5);
});

test("provider 故障不会阻塞开局，全部在候选内完成本地回退", async t => {
	const fixture = await identityFixture({
		request: async () => {
			throw new Error("offline");
		},
	});
	t.after(() => fixture.close());
	await fixture.run();
	assert.equal(fixture.requests.length, 6);
	assert.ok(fixture.game.players.every(player => player.initCalls === 1));
	assert.equal(fixture.logs.filter(log => log.method === "endFallback").length, 6);
});

test("并发批次中跳过时保留已返回的合法选择，仅未完成请求及后续座位回退", async t => {
	let fixture;
	fixture = await identityFixture({
		request: async (input, count) => {
			if (count < 3) return selectionResponse(input);
			await new Promise(resolve => setImmediate(resolve));
			fixture.event.llmOpening.state.skip();
			return selectionResponse(input);
		},
	});
	t.after(() => fixture.close());
	await fixture.run();
	assert.equal(fixture.requests.length, 6);
	assert.equal(fixture.logs.filter(log => log.method === "end" && log.args[1] === "success").length, 2);
	assert.equal(fixture.logs.filter(log => log.method === "endFallback").length, 4);
	assert.ok(fixture.game.players.every(player => player.initCalls === 1));
});

test("具体武将版本、可选势力与三种后端混用，来源武将不能重复", async t => {
	const fixture = await identityFixture({ double: true, replace: true, seatBackends: { 2: "agy", 3: "openai", 4: "local" } });
	t.after(() => fixture.close());
	await fixture.run();
	assert.equal(fixture.requests.length, 5);
	assert.deepEqual(
		fixture.requests.slice(0, 3).map(request => request.backend.kind),
		["codex", "agy", "openai"]
	);
	const sources = fixture.game.players.flatMap(player => [player.name1, player.name2].filter(Boolean).map(name => Object.keys(fixture.lib.characterReplace).find(source => fixture.lib.characterReplace[source].includes(name)) || name));
	assert.equal(new Set(sources).size, sources.length);
	assert.ok(fixture.game.players.every(player => player.initCalls === 1));
});

test("同一选将事件重新进入时保留本局归档、废弃旧轮次并重建座位映射", async t => {
	const fixture = await identityFixture({ controlSelf: false, pauseManual: true });
	t.after(() => fixture.close());
	const pending = fixture.run();
	await fixture.waitForManual();
	const previous = fixture.event.llmOpening;
	const gameId = fixture.status.llmGameId;
	fixture.game.players[1].dataset.position = "2";
	fixture.game.players[2].dataset.position = "1";
	const api = await fixture.runtime.import("noname/llm/character-selection/identity.ts");
	const next = api.createIdentityOpening(fixture.event);
	t.after(() => next.close(true));
	assert.equal(previous.state.valid, false);
	assert.equal(fixture.status.llmGameId, gameId);
	assert.equal(fixture.status.llmInitialSeatIndices.get(fixture.game.players[1]), 3);
	assert.notEqual(next.round, previous.round);
	fixture.event.llmOpening = next;
	fixture.resumeManual();
	await pending;
});

test("换身份后旧轮次响应不会初始化任何武将", async t => {
	let started;
	const ready = new Promise(resolve => {
		started = resolve;
	});
	let fixture;
	fixture = await identityFixture({
		request: async () => {
			started();
			return await new Promise(() => {});
		},
	});
	t.after(() => fixture.close());
	const pending = fixture.run();
	await ready;
	fixture.game.me.identity = "nei";
	fixture.event.llmOpening.close(true);
	await assert.rejects(pending, /选将轮次已失效/);
	assert.ok(fixture.game.players.every(player => player.initCalls === 0));
});

for (const options of [{ connect: true }, { mode: "zhong" }, { mode: "stratagem" }, { brawl: {} }, { continueName: ["hero3"] }]) {
	test(`非目标流程不建立选将 controller：${JSON.stringify(options)}`, async t => {
		const fixture = await identityFixture(options);
		t.after(() => fixture.close());
		const api = await fixture.runtime.import("noname/llm/character-selection/identity.ts");
		fixture.event.chosen = options.continueName || [];
		assert.equal(api.createIdentityOpening(fixture.event), undefined);
		assert.equal(fixture.requests.length, 0);
	});
}
