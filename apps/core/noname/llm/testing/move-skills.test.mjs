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

test("swap mode enforces equal pile counts, allows single pile, and checks finalPredicate", () => {
	const swapSession = session(
		"swap",
		[
			["牌堆顶的牌", [cards[0], cards[1]]],
			["你的手牌", [cards[2], cards[3]]],
		],
		{
			prompt: "星魂：选择任意张手牌进行交换",
			filterMove: (_from, to) => typeof to != "number",
			selectionSpec: {
				move: "swap",
				finalPredicate: ({ moved }) => moved[0][0] !== cards[3],
			},
		}
	);
	assert.match(swapSession.stage.instruction, /堆0\(牌堆顶的牌\)保持 2 张/);
	assert.match(swapSession.stage.instruction, /堆1\(你的手牌\)保持 2 张/);
	const swapped = swapSession.accept(tool("move_cards", { piles: [["m2", "m0"], ["m1", "m3"]] })).result;
	assert.deepEqual(swapped.moved, [
		[cards[2], cards[0]],
		[cards[1], cards[3]],
	]);
	assert.throws(() => swapSession.accept(tool("move_cards", { piles: [["m0"], ["m1", "m2", "m3"]] })), /preserve its initial card count/);
	assert.throws(() => swapSession.accept(tool("move_cards", { piles: [["m3", "m0"], ["m1", "m2"]] })), /final predicate rejected proposal/);
	assert.equal(swapSession.accept(tool("pass")).result.bool, false);

	const singlePileSwap = session("swap", [["牌堆底", [cards[0], cards[1], cards[2]]]]);
	const reordered = singlePileSwap.accept(tool("move_cards", { piles: [["m2", "m0", "m1"]] })).result;
	assert.deepEqual(reordered.moved, [[cards[2], cards[0], cards[1]]]);
});

test("chooseToMove and chooseToMove_new preserve custom filters and tag default filterMove", async () => {
	const createdEvents = [];
	const runtime = await createSkillRuntime({
		game: {
			createEvent(name) {
				const ev = {
					name,
					set(key, value) {
						this[key] = value;
						return this;
					},
					setContent(content) {
						this.content = content;
						return this;
					},
				};
				createdEvents.push(ev);
				return ev;
			},
		},
	});
	const { moveAndMinigameMethods } = await runtime.moduleRuntime.import("noname/library/element/Player/choice/moveAndMinigame.ts");
	const player = { ...moveAndMinigameMethods };

	const defaultNewEvent = player.chooseToMove_new("通用移动");
	defaultNewEvent.list = [["top", [cards[0]]], ["bottom", [cards[1]]]];
	const defaultSession = new f.MoveDecisionSession(defaultNewEvent, f.runtime);
	assert.equal(defaultSession.stage.piles.length, 2);

	const customFilterMove = (_from, to) => typeof to != "number";
	const customFilterOk = moved => moved[0].length === 1;
	const objectParamEvent = player.chooseToMove({
		prompt: "澄策",
		forced: true,
		filterMove: customFilterMove,
		filterOk: customFilterOk,
		selectionSpec: { move: "swap" },
		list: [["牌堆顶", [cards[0]]], ["你的手牌", [cards[1]]]],
	});
	assert.equal(objectParamEvent.filterMove, customFilterMove);
	assert.equal(objectParamEvent.filterOk, customFilterOk);

	const mbxinghunEvent = player
		.chooseToMove_new("星魂：选择任意张手牌进行交换", true)
		.set("list", [
			["牌堆顶的牌", [cards[0], cards[1]]],
			["你的手牌", [cards[2]]],
		])
		.set("filterMove", (_from, to) => typeof to != "number")
		.set("selectionSpec", { move: "swap" });
	const mbxinghunSession = new f.MoveDecisionSession(mbxinghunEvent, f.runtime);
	const mbxinghunResult = mbxinghunSession.accept(tool("move_cards", { piles: [["m2", "m1"], ["m0"]] })).result;
	assert.equal(mbxinghunResult.bool, true);
	assert.equal(mbxinghunResult.moved.length, 2);
	assert.deepEqual([...mbxinghunResult.moved[0]], [cards[2], cards[1]]);
	assert.deepEqual([...mbxinghunResult.moved[1]], [cards[0]]);
	assert.equal(createdEvents.length, 3);
});
