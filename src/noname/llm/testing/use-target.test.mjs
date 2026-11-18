import assert from "node:assert/strict";
import test from "node:test";
import { createSkillRuntime, driveStages, tool } from "./skill-runtime.mjs";

test("a child chooseTarget receives its actual _get_card and an explicit default target context", async () => {
	const f = await createSkillRuntime();
	const owner = f.player("owner");
	const a = f.player("a");
	const b = f.player("b");
	const card = { name: "sha" };
	f.lib.filter.selectTarget = (selected, player) => {
		assert.equal(selected, card);
		assert.equal(player, owner);
		return [1, 1];
	};
	f.lib.filter.targetInRange = (_card, _player, target) => target === b;
	f.lib.filter.targetEnabledx = () => true;
	const { useTargetSelectionSpec } = await f.moduleRuntime.import("noname/library/element/content/selectionResults.ts");
	const event = {
		name: "chooseTarget",
		player: owner,
		_get_card: card,
		getTargets: () => [a, b],
		selectTarget: f.lib.filter.selectTarget,
		selectionSpec: useTargetSelectionSpec,
		filterTarget() {
			throw new Error("Legacy global callback must not run");
		},
	};
	const { decision } = f.session(event);
	const stage = decision.stage;
	assert.equal(stage.items.length, 1);
	assert.equal(stage.items[0].ref, "p2");
	const result = driveStages(decision, tool("select_targets", { step_id: stage.id, target_refs: ["p2"] }));
	assert.equal(result.targets[0], b);
});
