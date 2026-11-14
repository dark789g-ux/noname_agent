import assert from "node:assert/strict";
import test from "node:test";
import { createDeciderRuntime } from "./decider-runtime.mjs";
import { tool } from "./skill-runtime.mjs";

test("tryLLMDecide rolls back and retries within maxTurns on recoverable mid-stage and initial failures", async () => {
	const f = await createDeciderRuntime({ maxTurns: 5 });
	const c0 = { name: "sha", suit: "spade", number: 1, cardid: "c0" };
	const c1 = { name: "shan", suit: "heart", number: 2, cardid: "c1" };
	const owner = f.player("owner", [c0, c1]);
	owner.skills = ["redimeng_test"];
	f.player("p1_target", []);
	f.player("p2_target", []);
	f.lib.skill.redimeng_test = {
		enable: "chooseToUse",
		filter: () => true,
		filterCard: true,
		selectCard: [1, 2],
		selectTarget: 2,
		complexTarget: true,
		filterTarget: (_card, player, target) => target !== player,
	};
	const event = {
		name: "chooseToUse",
		player: owner,
		filterCard: () => false,
		filterTarget: () => false,
	};
	// Turn 0: wrong card count [] -> recoverable rollback
	// Turn 1: valid use_skill("redimeng_test", ["c0"]) -> pending target stage
	// Turn 2: wrong target count ["p1"] -> recoverable rollback back to target stage
	// Turn 3: valid select_targets ["p1", "p2"] -> success!
	f.queue.push(
		tool("use_skill", { skill_name: "redimeng_test", card_refs: ["c0"], target_refs: ["p1"] }),
		tool("use_skill", { skill_name: "redimeng_test", card_refs: ["c0"] }),
		tool("select_targets", { step_id: "skill:redimeng_test:target:1", target_refs: ["p1"] }),
		tool("select_targets", { step_id: "skill:redimeng_test:target:1", target_refs: ["p1", "p2"] })
	);
	const outcome = await f.decide(event);
	assert.equal(outcome.handled, true, JSON.stringify(f.logs));
	assert.equal(outcome.result.skill, "redimeng_test");
	assert.deepEqual(
		Array.from(outcome.result.cards, card => card.cardid),
		["c0"]
	);
	assert.deepEqual(
		Array.from(outcome.result.targets, target => target.playerid),
		["p1_target", "p2_target"]
	);
	assert.equal(f.requests.length, 4);
	const feedbacks = f.requests[3].messages.filter(m => m.role === "tool").map(m => JSON.parse(m.content));
	assert.deepEqual(
		feedbacks.map(item => item.accepted),
		[false, true, false]
	);
});

test("tryLLMDecide does not exceed maxTurns and returns handled: false when retry exhausts budget", async () => {
	const f = await createDeciderRuntime({ maxTurns: 1 });
	const owner = f.player("owner", [{ name: "sha", suit: "spade", number: 1, cardid: "c0" }]);
	const p1 = f.player("target", []);
	const event = {
		name: "chooseToUse",
		player: owner,
		forced: true,
		filterCard: () => true,
		filterTarget: (_card, player, target) => target !== player && target === p1,
	};
	f.queue.push(tool("use_card", { card_ref: "nonexistent" }), tool("pass"));
	const outcome = await f.decide(event);
	assert.equal(outcome.handled, false);
	assert.equal(f.requests.length, 1);
});
