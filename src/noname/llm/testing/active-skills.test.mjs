import assert from "node:assert/strict";
import test from "node:test";
import { createSkillRuntime, driveStages, tool } from "./skill-runtime.mjs";

const f = await createSkillRuntime();
const { standardActiveSkills, refreshActiveSkills } = await f.moduleRuntime.import("noname/llm/support-scope.ts");

for (const id of new Set([...standardActiveSkills, ...refreshActiveSkills])) {
	test(`reviewed real skill ${id} produces a validated action without native AI`, () => {
		f.game.players.length = 0;
		const cards = [
			{ name: "sha", suit: "heart", number: 7 },
			{ name: "shan", suit: "diamond", number: 8 },
			{ name: "tao", suit: "spade", number: 9 },
			{ name: "shan", suit: "club", number: 10 },
		];
		const owner = f.player("owner", cards);
		f.player("target", [{ name: "sha", suit: "heart", number: 2 }]);
		f.player("other");
		const event = { name: "chooseToUse", type: "phase", player: owner, skills: [id], filterCard: card => Array.isArray(card.cards), filterTarget: (_card, player, target) => player !== target, _backup: { filterCard: () => true } };
		const { decision, snapshot } = f.session(event);
		assert.ok(
			snapshot.actions.some(action => action.skillName === id),
			`${id} must enter the executable snapshot`
		);
		const result = driveStages(decision, tool("use_skill", { skill_name: id }));
		assert.equal(result.bool, true);
		assert.equal(result.skill, id);
		assert.ok(Array.isArray(result.cards));
		assert.ok(Array.isArray(result.targets));
	});
}

test("lijian replays ordered prefixes and rejects a reversed illegal pair", () => {
	f.game.players.length = 0;
	const owner = f.player("diaochan", [{ name: "sha", suit: "heart", number: 1 }]);
	const a = f.player("first");
	const b = f.player("second");
	a.canUse = () => false;
	b.canUse = (_card, target) => target === a;
	const event = { name: "chooseToUse", player: owner, skills: ["lijian"], filterCard: () => false };
	const valid = f.session(event).decision;
	const result = driveStages(valid, tool("use_skill", { skill_name: "lijian", card_refs: ["c0"], target_refs: ["p1", "p2"] }));
	assert.equal(result.targets[0], a);
	assert.equal(result.targets[1], b);
	const invalid = f.session(event).decision;
	assert.throws(() => invalid.accept(tool("use_skill", { skill_name: "lijian", card_refs: ["c0"], target_refs: ["p2", "p1"] })), /selection/);
});

test("late target candidates follow selected material and never touch UI selection", () => {
	f.game.players.length = 0;
	const equipment = { name: "equip", suit: "heart", position: "e" };
	const owner = f.player("owner", [equipment]);
	owner.sex = "female";
	const a = f.player("blocked");
	const b = f.player("allowed");
	a.canEquip = () => false;
	const { decision } = f.session({ name: "chooseToUse", player: owner, skills: ["rejieyin"], filterCard: () => false });
	const result = driveStages(decision, tool("use_skill", { skill_name: "rejieyin" }));
	assert.equal(result.targets[0], b);
});

test("expired material, ineligible skill and optional cancellation stay uncommitted", () => {
	f.game.players.length = 0;
	const owner = f.player("owner", [{ name: "sha", suit: "heart" }]);
	const event = { name: "chooseToUse", player: owner, skills: ["zhiheng"], filterCard: () => false };
	const { decision } = f.session(event);
	const pending = decision.accept(tool("use_skill", { skill_name: "zhiheng" }));
	assert.ok(pending.pending);
	assert.equal(decision.accept(tool("pass")).result.bool, false);
	owner.cards[0].owner = undefined;
	owner.cards.length = 0;
	assert.throws(() => decision.revalidate(), /ownership/);
});
