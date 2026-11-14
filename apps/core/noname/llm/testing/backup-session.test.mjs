import assert from "node:assert/strict";
import test from "node:test";
import { createDeciderRuntime, stageTool } from "./decider-runtime.mjs";

test("reqice's all-hand backup with an automatic self target needs no additional model request", async () => {
	const f = await createDeciderRuntime();
	const owner = f.player("owner", [
		{ name: "sha", suit: "heart" },
		{ name: "shan", suit: "club" },
	]);
	f.lib.skill.reqice_backup = { selectionSpec: true, viewAs: { name: "wuzhong" }, selectCard: -1, filterCard: true };
	const event = { name: "chooseToUse", player: owner, skill: "reqice_backup", selectCard: -1, filterCard: () => true, filterTarget: (_card, player, target) => target === player, _backup: { filterCard: card => card.name === "wuzhong" } };
	const outcome = await f.decide(event);
	assert.equal(outcome.handled, true);
	assert.equal(outcome.result.card.name, "wuzhong");
	assert.equal(outcome.result.cards.length, 2);
	assert.equal(outcome.result.targets.length, 1);
	assert.equal(outcome.result.targets[0], owner);
	assert.equal(f.requests.length, 0);
	assert.ok(f.logs.some(log => log[0] === "logAutomaticResponse"));
});

test("a wuxie backup ignores default target callbacks and finishes after its material choice", async () => {
	const f = await createDeciderRuntime();
	const owner = f.player("owner", [{ name: "shan", suit: "heart" }]);
	f.lib.skill.xintaoluan_backup = { selectionSpec: true, viewAs: { name: "wuxie" }, selectCard: 1, filterCard: true };
	const event = {
		name: "chooseToUse",
		player: owner,
		skill: "xintaoluan_backup",
		selectCard: 1,
		filterCard: () => true,
		filterTarget() {
			throw new Error("A no-target card must not test targets");
		},
		_backup: { filterCard: card => card.name === "wuxie" },
	};
	f.queue.push(stageTool("card", ["c0"]));
	const outcome = await f.decide(event);
	assert.equal(outcome.handled, true);
	assert.equal(outcome.result.targets.length, 0);
	assert.equal(f.requests.length, 1);
});

test("dynamic backup viewAs and target ranges are never inspected before material selection", async () => {
	const f = await createDeciderRuntime();
	const owner = f.player("owner", [{ name: "shan", suit: "heart" }]);
	const target = f.player("target");
	f.lib.skill.dynamic_backup = {
		selectionSpec: true,
		selectCard: 1,
		filterCard: true,
		viewAs(cards) {
			assert.equal(cards.length, 1);
			return { name: "sha" };
		},
	};
	const event = { name: "chooseToUse", player: owner, skill: "dynamic_backup", selectCard: 1, filterCard: () => true, filterTarget: (card, _player, current) => card.name === "sha" && current === target, _backup: { filterCard: card => card.name === "sha" } };
	f.queue.push(stageTool("card", ["c0"]), stageTool("target", ["p1"]));
	const outcome = await f.decide(event);
	assert.equal(outcome.handled, true);
	assert.equal(outcome.result.card.name, "sha");
	assert.equal(outcome.result.targets[0], target);
	assert.equal(f.requests.length, 2);
});
