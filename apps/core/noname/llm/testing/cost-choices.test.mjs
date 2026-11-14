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
