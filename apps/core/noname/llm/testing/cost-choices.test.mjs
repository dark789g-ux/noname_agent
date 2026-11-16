import assert from "node:assert/strict";
import test from "node:test";
import { createDeciderRuntime, choiceEvent, stageTool } from "./decider-runtime.mjs";

test("guicai cost uses the actual player and card mods without get.player UI state", async () => {
	const f = await createDeciderRuntime();
	const owner = f.player("simayi", [
		{ name: "blocked", suit: "club" },
		{ name: "shan", suit: "heart" },
	]);
	const judged = f.player("judged");
	judged.judging = [{ name: "sha", suit: "spade" }];
	f.get.prompt = name => name;
	f.get.player = () => {
		throw new Error("UI player must not be consulted");
	};
	f.game.checkMod = (card, player, unchanged, kind) => {
		assert.equal(player, owner);
		return card.name === "blocked" && kind === "cardEnabled2" ? false : unchanged;
	};
	owner.chooseCard = properties => choiceEvent(owner, "chooseCard", { ...properties, selectCard: 1 }, f.decide);
	f.queue.push(stageTool("card", ["c0"]));
	const event = choiceEvent(owner, "guicai_cost", { skill: "guicai" }, f.decide);
	await f.lib.skill.guicai.cost(event, { player: judged }, owner);
	assert.equal(event.result.bool, true);
	assert.equal(event.result.cards[0], owner.cards[1]);
	assert.equal(
		f.logs.some(log => log[0] === "endFallback"),
		false
	);
});

test("liuli cost uses its event for discard mods and excludes the original attacker", async () => {
	const f = await createDeciderRuntime();
	const owner = f.player("daqiao", [{ name: "shan", suit: "diamond" }]);
	const attacker = f.player("attacker");
	const redirected = f.player("redirected");
	f.get.prompt = name => name;
	f.lib.filter.targetEnabled = (_card, source, target) => source !== target;
	const inspected = [];
	f.lib.filter.cardDiscardable = (_card, player, event) => {
		assert.equal(player, owner);
		assert.equal(event.name, "chooseCardTarget");
		inspected.push(event);
		return true;
	};
	owner.chooseCardTarget = properties => choiceEvent(owner, "chooseCardTarget", { ...properties, selectCard: 1, selectTarget: 1 }, f.decide);
	f.queue.push(stageTool("card", ["c0"]), stageTool("target", ["p2"]));
	const event = choiceEvent(owner, "liuli_cost", { skill: "liuli" }, f.decide);
	await f.lib.skill.liuli.cost(event, { player: attacker, card: { name: "sha" } }, owner);
	assert.equal(event.result.cards[0], owner.cards[0]);
	assert.equal(event.result.targets[0], redirected);
	assert.ok(inspected.length > 0);
	assert.equal(
		f.logs.some(log => log[0] === "endFallback"),
		false
	);
});

test("judgement and source context include the visible card's suit and number", async () => {
	const f = await createDeciderRuntime();
	const { buildDecisionSnapshot } = await f.moduleRuntime.import("noname/llm/prompt-format.ts");
	const text = buildDecisionSnapshot("chooseCard", { judging: { name: "sha", suit: "heart", number: 7 }, source: { name: "attacker" } }, { cards: [], skills: [] }, [], { decisionDescriptions: {}, getSkillName: id => id, getSkillDescription: () => "" });
	assert.ok(text.includes("sha heart 7"));
	assert.ok(text.includes("attacker"));
});

test("non-forced chooseCard with no legal cards auto-cancels without LLM request or fallback error", async () => {
	const f = await createDeciderRuntime();
	const owner = f.player("jushou", [{ name: "shan", suit: "heart", number: 2 }]);
	const outcome = await f.decide({
		name: "chooseCard",
		player: owner,
		forced: false,
		selectCard: 1,
		filterCard: card => card.name === "sha",
	});
	assert.equal(outcome.handled, true);
	assert.equal(outcome.result.bool, false);
	assert.equal(f.requests.length, 0);
	assert.ok(f.logs.some(log => log[0] === "logAutomaticResponse"));
	assert.equal(
		f.logs.some(log => log[0] === "endFallback"),
		false
	);
});

test("forced chooseCard with no legal cards falls back with direct:* stage id instead of skill:undefined", async () => {
	const f = await createDeciderRuntime();
	const owner = f.player("jushou", [{ name: "shan", suit: "heart", number: 2 }]);
	const outcome = await f.decide({
		name: "chooseCard",
		player: owner,
		forced: true,
		selectCard: 1,
		filterCard: card => card.name === "sha",
	});
	assert.equal(outcome.handled, false);
	assert.equal(f.requests.length, 0);
	const fallbackLog = f.logs.find(log => log[0] === "endFallback");
	assert.ok(fallbackLog);
	assert.match(String(fallbackLog[2]), /^selection direct:chooseCard:card:0 has no legal continuation$/);
});

test("chooseCard aligns filterCard(card, player, event) and object filters across collection, stage, and validation", async () => {
	const f = await createDeciderRuntime();
	const owner = f.player("owner", [
		{ name: "sha", suit: "spade", number: 1 },
		{ name: "shan", suit: "heart", number: 2 },
	]);
	f.get.filter = filter => card => Object.entries(filter).every(([key, value]) => card[key] === value);
	f.queue.push(stageTool("card", ["c0"]));
	const ev1 = {
		name: "chooseCard",
		player: owner,
		selectCard: 1,
		requiredSuit: "heart",
		filterCard: (card, player, event) => player === owner && card.suit === event.requiredSuit,
	};
	const res1 = await f.decide(ev1);
	assert.equal(res1.handled, true);
	assert.equal(res1.result.cards[0], owner.cards[1]);

	f.queue.push(stageTool("card", ["c0"]));
	const res2 = await f.decide({
		name: "chooseCard",
		player: owner,
		selectCard: 1,
		filterCard: { suit: "spade" },
	});
	assert.equal(res2.handled, true);
	assert.equal(res2.result.cards[0], owner.cards[0]);
});

test("chooseCardTarget pre-filters dead-end cards and auto-cancels if no card has a legal target", async () => {
	const f = await createDeciderRuntime();
	const owner = f.player("owner", [
		{ name: "dead_end", suit: "club", number: 3 },
		{ name: "playable", suit: "heart", number: 4 },
	]);
	const enemy = f.player("enemy");
	f.queue.push(stageTool("card", ["c1"]), stageTool("target", ["p1"]));
	const res1 = await f.decide({
		name: "chooseCardTarget",
		player: owner,
		selectCard: 1,
		selectTarget: 1,
		filterCard: () => true,
		filterTarget: (card, _player, target) => card?.name === "playable" && target === enemy,
	});
	assert.equal(res1.handled, true);
	assert.equal(res1.result.cards[0], owner.cards[1]);
	assert.equal(res1.result.targets[0], enemy);

	const res2 = await f.decide({
		name: "chooseCardTarget",
		player: owner,
		forced: false,
		selectCard: 1,
		selectTarget: 1,
		filterCard: () => true,
		filterTarget: () => false,
	});
	assert.equal(res2.handled, true);
	assert.equal(res2.result.bool, false);
	assert.equal(f.requests.length, 2);
});
