import assert from "node:assert/strict";
import test from "node:test";
import { createSkillRuntime, tool } from "./skill-runtime.mjs";

const f = await createSkillRuntime();
const cards = [
	{ name: "sha", suit: "heart", number: 1 },
	{ name: "shan", suit: "spade", number: 2 },
	{ name: "tao", suit: "club", number: 3 },
	{ name: "jiu", suit: "diamond", number: 4 },
];

function session(mode, list, extra = {}) {
	return new f.MoveDecisionSession({ list, selectionSpec: { move: mode }, ...extra }, f.runtime);
}

test("guanxing preserves arbitrary top/bottom order and rejects missing, duplicate and stale refs", () => {
	const top = cards.slice();
	const event = { list: [["top", top], ["bottom"]], forced: true, selectionSpec: { move: "guanxing" } };
	const decision = new f.MoveDecisionSession(event, f.runtime);
	const result = decision.accept(
		tool("move_cards", {
			piles: [
				["m3", "m0"],
				["m2", "m1"],
			],
		})
	).result;
	assert.deepEqual(Array.from(result.moved[0]), [cards[3], cards[0]]);
	assert.deepEqual(Array.from(result.moved[1]), [cards[2], cards[1]]);
	for (const piles of [
		[["m0"], []],
		[
			["m0", "m0"],
			["m1", "m2"],
		],
		[
			["m0", "m1"],
			["m2", "unknown"],
		],
	])
		assert.throws(() => decision.accept(tool("move_cards", { piles })), /conserve/);
	assert.throws(() => decision.accept(tool("pass")), /expected/);
	top.reverse();
	assert.throws(() => decision.revalidate(), /changed/);
});

test("xunxun enforces the reviewed two-and-two partition", () => {
	const decision = session("xunxun", [["top", cards], ["bottom"]]);
	assert.equal(
		decision.accept(
			tool("move_cards", {
				piles: [
					["m1", "m0"],
					["m3", "m2"],
				],
			})
		).result.bool,
		true
	);
	assert.throws(() => decision.accept(tool("move_cards", { piles: [["m0"], ["m1", "m2", "m3"]] })), /two cards/);
});

test("gongxin accepts precisely one heart, conserves other hand cards and permits refusal", () => {
	const decision = session(
		"gongxin",
		[
			["hand", cards],
			[["discard"], ["top"]],
		],
		{ filterOk: moved => moved[1].length + moved[2].length === 1 }
	);
	const result = decision.accept(tool("move_cards", { piles: [["m1", "m2", "m3"], [], ["m0"]] })).result;
	assert.equal(result.moved[2][0], cards[0]);
	assert.equal(decision.accept(tool("pass")).result.bool, false);
	assert.throws(() => decision.accept(tool("move_cards", { piles: [["m0", "m2", "m3"], ["m1"], []] })), /one heart/);
});

test("the actual move event uses the model result once and falls back at its own boundary", async () => {
	const calls = [];
	let handled = true;
	const runtime = await createSkillRuntime({
		game: { uncheck() {}, broadcastAll() {} },
		modules: {
			"@/llm/index.js": {
				tryLLMDecide: async event => {
					calls.push(event);
					return handled ? { handled: true, result: { bool: true, moved: [[cards[1]], [cards[0]]] } } : { handled: false };
				},
			},
		},
	});
	const { Content } = await runtime.moduleRuntime.import("noname/library/element/content.ts");
	const event = {
		isMine: () => false,
		isOnline: () => false,
		list: [["top", cards.slice(0, 2)], ["bottom"]],
		processAI() {
			calls.push("native");
			return [cards.slice(0, 2), []];
		},
	};
	await Content.chooseToMove(event);
	assert.equal(calls.length, 1);
	assert.equal(event.result.moved[0][0], cards[1]);
	handled = false;
	await Content.chooseToMove(event);
	assert.equal(calls.at(-1), "native");
	assert.equal(calls.filter(call => call === "native").length, 1);
});
