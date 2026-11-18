import assert from "node:assert/strict";
import test from "node:test";
import { createSkillRuntime, driveStages, tool } from "./skill-runtime.mjs";

const f = await createSkillRuntime({ game: { generateBeatmapTimeleap: () => [] }, get: { subtype: card => card.subtype } });
for (const [pack, id] of [
	["mobile", "mbzhaofu"],
	["yijiang", "xintaoluan"],
]) {
	f.lib.skill[id] = (await f.moduleRuntime.import(`character/${pack}/skill.js`)).default[id];
}

for (const id of ["rerende", "olqiangxi", "reshenxing", "rehuoji", "reqice", "xintaoluan", "mbzhaofu"]) {
	test(`existing reviewed ${id} remains executable through its actual declaration`, () => {
		f.game.players.length = 0;
		const owner = f.player("owner", [
			{ name: "sha", suit: "heart", subtype: "equip1" },
			{ name: "shan", suit: "club" },
		]);
		owner.countMark = () => 0;
		f.player("target");
		const event = { name: "chooseToUse", type: "phase", player: owner, skills: [id], filterCard: card => Array.isArray(card.cards), filterTarget: (_card, player, target) => player !== target };
		const { decision } = f.session(event);
		const result = driveStages(decision, tool("use_skill", { skill_name: id }));
		assert.equal(result.bool, true);
		assert.equal(result.skill, id);
		if (["reqice", "xintaoluan", "mbzhaofu"].includes(id)) {
			assert.equal(result.cards.length, 0);
			assert.equal(result.targets.length, 0);
		}
	});
}

test("extensions can change raw rules, invalidating only their old reviewed pure adapter", () => {
	const skill = f.lib.skill.lijian;
	const original = skill.filterTarget;
	const changed = () => false;
	try {
		skill.filterTarget = changed;
		assert.equal(skill.filterTarget(), false);
		assert.throws(() => skill.selectionSpec({}, {}), /invalidated/);
	} finally {
		skill.filterTarget = original;
	}
	assert.equal(skill.selectionSpec().orderedTargets, true);
});
