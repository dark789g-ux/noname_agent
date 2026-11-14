import assert from "node:assert/strict";
import test from "node:test";
import { createDeciderRuntime } from "./decider-runtime.mjs";
import { tool } from "./skill-runtime.mjs";

test("inspect_discard_pile returns full discard report, removes itself after 1 call, and does not consume maxTurns", async () => {
	// maxTurns = 1 with multiTurn = true: if inspect_discard_pile consumed maxTurns, the subsequent use_card would fail!
	const f = await createDeciderRuntime({ multiTurn: true, maxTurns: 1 });
	const prevTranslate = f.get.translation;
	f.get.translation = value => (value === "tao" ? "桃" : value === "sha" ? "杀" : prevTranslate(value));
	f.moduleRuntime.engine.ui.discardPile = {
		childNodes: [
			{ name: "sha", suit: "spade", number: 7 },
			{ name: "sha", nature: "fire", suit: "heart", number: 13 },
			{ name: "tao", suit: "heart", number: 12 },
		],
	};

	const c0 = { name: "sha", suit: "club", number: 8, cardid: "c0" };
	const owner = f.player("owner", [c0]);
	const target = f.player("target", []);
	const event = {
		name: "chooseToUse",
		player: owner,
		filterCard: card => card.name === "sha",
		filterTarget: (_card, player, candidate) => candidate !== player && candidate === target,
	};

	f.queue.push(
		{
			id: "call_inspect",
			name: "inspect_discard_pile",
			reason: "核对弃牌堆中桃与属性杀数量",
			reasoningContent: "先查一下弃牌堆里出了多少张桃",
			arguments: {},
		},
		tool("use_card", { card_ref: "c0", target_refs: ["p1"] })
	);

	const outcome = await f.decide(event);
	assert.equal(outcome.handled, true, JSON.stringify(f.logs));
	assert.equal(f.requests.length, 2);

	const firstToolNames = f.requests[0].tools.map(item => item.function.name);
	const secondToolNames = f.requests[1].tools.map(item => item.function.name);
	assert.equal(firstToolNames.includes("inspect_discard_pile"), true);
	assert.equal(secondToolNames.includes("inspect_discard_pile"), false);

	const assistantMsg = f.requests[1].messages.find(item => item.role === "assistant");
	assert.equal(assistantMsg.reasoning_content, "先查一下弃牌堆里出了多少张桃");

	const toolMsg = f.requests[1].messages.find(item => item.role === "tool");
	const payload = JSON.parse(toolMsg.content);
	assert.equal(payload.accepted, true);
	assert.equal(payload.discard_pile.total, 3);
	assert.equal(payload.discard_pile.order, "oldest_to_newest");
	assert.deepEqual(payload.discard_pile.cards, ["杀【黑桃7】", "火杀【红桃K】", "桃【红桃Q】"]);
	assert.deepEqual(payload.discard_pile.bySuit, { 黑桃: 1, 红桃: 2, 梅花: 0, 方片: 0 });
});

test("inspect_discard_pile is omitted when discard pile is empty or multiTurn is disabled", async () => {
	const emptyDiscardRuntime = await createDeciderRuntime({ multiTurn: true, maxTurns: 2 });
	emptyDiscardRuntime.moduleRuntime.engine.ui.discardPile = { childNodes: [] };
	const owner1 = emptyDiscardRuntime.player("owner1", [{ name: "sha", suit: "spade", number: 1, cardid: "c0" }]);
	emptyDiscardRuntime.player("target1", []);
	emptyDiscardRuntime.queue.push(tool("pass"));
	await emptyDiscardRuntime.decide({
		name: "chooseToUse",
		player: owner1,
		filterCard: () => true,
		filterTarget: (_c, p, t) => p !== t,
	});
	assert.equal(
		emptyDiscardRuntime.requests[0].tools.some(item => item.function.name === "inspect_discard_pile"),
		false
	);

	const singleTurnRuntime = await createDeciderRuntime({ multiTurn: false, maxTurns: 2 });
	singleTurnRuntime.moduleRuntime.engine.ui.discardPile = { childNodes: [{ name: "tao", suit: "heart", number: 1 }] };
	const owner2 = singleTurnRuntime.player("owner2", [{ name: "sha", suit: "spade", number: 1, cardid: "c0" }]);
	singleTurnRuntime.player("target2", []);
	singleTurnRuntime.queue.push(tool("pass"));
	await singleTurnRuntime.decide({
		name: "chooseToUse",
		player: owner2,
		filterCard: () => true,
		filterTarget: (_c, p, t) => p !== t,
	});
	assert.equal(
		singleTurnRuntime.requests[0].tools.some(item => item.function.name === "inspect_discard_pile"),
		false
	);
});

test("round-history masks $giveAuto private cards and merges round summaries across roundStart transitions", async () => {
	const f = await createDeciderRuntime({ multiTurn: true, maxTurns: 2 });
	const subscribers = new Map();
	f.lib.announce = {
		subscribe(name, fn) {
			subscribers.set(name, fn);
		},
	};
	const sidebarLogs = [];
	f.game.roundNumber = 1;
	f.game.log = (...args) => {
		sidebarLogs.push(args);
	};
	f.get.itemtype = value => {
		if (Array.isArray(value)) return "cards";
		if (value?.playerid) return "player";
		if (value?.cardid) return "card";
		return "";
	};
	f.get.cnNumber = n => (n === 2 ? "两" : String(n));

	class MockPlayer {
		$giveAuto(cards, receiver) {
			// Simulate single-player mode where game.me is involved: passes raw Card[] to $give -> game.log
			f.game.log(receiver, "从", this, "获得了", cards);
		}
	}
	f.lib.element = { Player: MockPlayer };

	const roundHistory = await f.moduleRuntime.import("noname/llm/round-history.ts");
	f.moduleRuntime.engine._status.llmGameId = "game_round_test";
	roundHistory.initRoundHistoryHooks();
	roundHistory.resetRoundHistory();

	const p1 = Object.assign(new MockPlayer(), f.player("刘备", []));
	const p2 = Object.assign(new MockPlayer(), f.player("曹操", []));
	f.moduleRuntime.engine._status.currentPhase = p1;

	f.game.log(p1, "的回合开始");
	p2.$giveAuto(
		[
			{ name: "tao", cardid: "secret1" },
			{ name: "shan", cardid: "secret2" },
		],
		p1
	);
	f.game.log(p1, "对", p2, "造成了1点伤害");

	const round1Snap = JSON.parse(JSON.stringify(roundHistory.getPromptHistorySnapshot()));
	assert.equal(round1Snap.currentRound, 1);
	assert.deepEqual(round1Snap.entries, [
		{ turnHeader: "[1号位] 刘备的回合", text: "刘备从曹操获得了两张牌" },
		{ turnHeader: "[1号位] 刘备的回合", text: "刘备对曹操造成了1点伤害" },
	]);
	assert.equal(sidebarLogs.length, 3);

	// Transition to round 2 -> triggers background submit_round_summary call
	f.queue.push({
		id: "call_summary_r1",
		name: "submit_round_summary",
		reason: "提炼第1轮核心交锋",
		arguments: {
			summary: "第1轮1号位刘备顺走2号位曹操两张牌并对其造成1点伤害。",
		},
	});
	f.game.roundNumber = 2;
	f.moduleRuntime.engine._status.currentPhase = p2;
	subscribers.get("roundStart")({ roundNumber: 2 });

	await roundHistory.ensureRoundSummaryReady(Date.now() + 5000);
	f.game.log(p2, "发动了", "#g【奸雄】");

	const round2Snap = JSON.parse(JSON.stringify(roundHistory.getPromptHistorySnapshot()));
	assert.equal(round2Snap.currentRound, 2);
	assert.equal(round2Snap.summarizedThroughRound, 1);
	assert.equal(round2Snap.rollingSummary, "第1轮1号位刘备顺走2号位曹操两张牌并对其造成1点伤害。");
	assert.deepEqual(round2Snap.entries, [{ turnHeader: "[2号位] 曹操的回合", text: "曹操发动了【奸雄】" }]);

	const summaryStartLog = f.logs.find(entry => entry[0] === "start" && entry[1] === "roundSummary");
	assert.ok(summaryStartLog);
	assert.equal(summaryStartLog[4], -1);

	// Transition to round 3 with provider failure -> falls back deterministically without losing history
	f.queue.push(new Error("network down"), new Error("network down"));
	f.game.roundNumber = 3;
	subscribers.get("roundStart")({ roundNumber: 3 });
	await roundHistory.ensureRoundSummaryReady(Date.now() + 5000);

	const round3Snap = roundHistory.getPromptHistorySnapshot();
	assert.equal(round3Snap.currentRound, 3);
	assert.equal(round3Snap.summarizedThroughRound, 2);
	assert.match(round3Snap.rollingSummary, /第1轮1号位刘备/);
	assert.match(round3Snap.rollingSummary, /第2轮：曹操发动了【奸雄】/);
});
