import assert from "node:assert/strict";
import test from "node:test";
import { createModuleRuntime } from "./module-runtime.mjs";
import { createSkillRuntime, driveStages, tool } from "./skill-runtime.mjs";

test("candidates.ts isolates _aiexclude sourceSkill, keeps filterEnable un-backed-up, enforces cardEnabled2/cardDiscardable, and opens two-phase pool for complexCard", async () => {
	const diamond = { name: "sha", suit: "diamond", position: "e" };
	const club = { name: "shan", suit: "club", position: "h" };
	const locked = { name: "tao", suit: "heart", position: "h", locked: true };
	const equip = { name: "renwang", suit: "spade", position: "e" };
	const ui = {};
	const _status = { event: { outer: true } };
	let sawUnbackedContext = false;
	const skills = {
		inherited_viewas: {
			viewAs: { name: "sha" },
			enable: "phaseUse",
		},
		mod_checked_viewas: {
			viewAs: "sha",
			filterCard: card => card.suit === "heart" || card.suit === "club",
			selectCard: 1,
		},
		mod_ignored_viewas: {
			viewAs: "sha",
			ignoreMod: true,
			filterCard: card => card.suit === "heart",
			selectCard: 1,
		},
		plain_discard: {
			filterCard: true,
			selectCard: 1,
		},
		hetero_combo: {
			complexCard: true,
			discard: false,
			selectCard: 2,
			filterCard: card => (!ui.selected.cards.length ? card.suit === "club" : card.suit === "diamond"),
			position: "he",
		},
		dead_starter_combo: {
			complexCard: true,
			selectCard: 2,
			filterCard: () => false,
		},
		excluded_sub: {
			sourceSkill: "excluded_root",
			filterCard: true,
		},
	};
	const player = {
		getCards: pos => [diamond, club, locked, equip].filter(card => pos.includes(card.position)),
		getSkills: () => Object.keys(skills),
	};
	const runtime = await createModuleRuntime({
		ui,
		_status,
		game: {
			expandSkills: list => list,
			checkMod(card, _player, result, name) {
				if (name === "cardEnabled2" && card.locked) return false;
				return result;
			},
		},
		lib: {
			skill: { ...skills, global: [] },
			filter: {
				cardDiscardable: card => card.suit !== "club",
				cardRespondable: () => true,
				filterEnable(event, _player, skill) {
					if (skill === "inherited_viewas") {
						sawUnbackedContext = event.skill === undefined && _status.event?.skill === undefined && !event._backup && !_status.event?._backup;
					}
					return true;
				},
			},
		},
		get: {
			info: card => (typeof card === "string" ? skills[card] : {}),
			autoViewAs: (def, cards) => ({ ...(typeof def === "string" ? { name: def } : def), cards }),
			translation: value => value.name,
			filter: filter => card => Object.entries(filter).every(([key, value]) => card[key] === value),
		},
	});
	const { getCandidateSkills, getCandidateCards } = await runtime.import("noname/llm/candidates.ts");
	const event = {
		name: "chooseToUse",
		player,
		position: "he",
		filterCard: card => card.suit === "diamond",
		_aiexclude: ["excluded_root"],
	};
	const enabled = getCandidateSkills(event, player);
	assert.equal(sawUnbackedContext, true);
	assert.equal(enabled.includes("excluded_sub"), false);

	const candidates = getCandidateCards(event, player, enabled);
	const skillsFor = card => candidates.find(entry => entry.card === card)?.skills || [];
	assert.deepEqual(skillsFor(diamond).includes("inherited_viewas"), true);
	assert.equal(skillsFor(club).includes("inherited_viewas"), false);
	assert.equal(skillsFor(locked).includes("mod_checked_viewas"), false);
	assert.equal(skillsFor(locked).includes("mod_ignored_viewas"), true);
	assert.equal(skillsFor(equip).includes("plain_discard"), false);
	assert.equal(skillsFor(club).includes("plain_discard"), false);
	assert.equal(skillsFor(locked).includes("plain_discard"), true);
	assert.equal(skillsFor(club).includes("hetero_combo"), true);
	assert.equal(skillsFor(diamond).includes("hetero_combo"), true);
	assert.equal(candidates.some(entry => entry.skills?.includes("dead_starter_combo")), false);
});

test("non-viewAs skills shield outer filterTarget/filterOk/complexTarget and viewAs without filterCard builds card step", async () => {
	const f = await createSkillRuntime();
	f.game.players.length = 0;
	const owner = f.player("owner", [
		{ name: "sha", suit: "diamond" },
		{ name: "shan", suit: "spade" },
	]);
	const enemy = f.player("enemy");
	f.lib.skill.plain_skill = {
		filterCard: true,
		selectCard: 1,
	};
	f.lib.skill.inherited_card_viewas = {
		viewAs: "sha",
	};
	const event = {
		name: "chooseToUse",
		player: owner,
		skills: ["plain_skill", "inherited_card_viewas"],
		position: "h",
		complexTarget: true,
		filterCard: card => card.name === "sha",
		filterTarget: (_card, p, t) => p !== t,
		filterOk: () => false,
	};
	const originalEligible = f.runtime.isSkillEligible;
	f.runtime.isSkillEligible = (evt, _player, skill) => !!evt.skills?.includes(skill);
	try {
		const { snapshot, decision } = f.session(event);
		const plainAction = snapshot.actions.find(action => action.skillName === "plain_skill");
		const viewAsAction = snapshot.actions.find(action => action.skillName === "inherited_card_viewas");
		assert.equal(plainAction.target.mode, "none");
		assert.deepEqual(Array.from(viewAsAction.materialCardRefs), ["c0"]);
		const plainResult = driveStages(decision, tool("use_skill", { skill_name: "plain_skill", card_refs: ["c0"] }));
		assert.equal(plainResult.bool, true);
		assert.equal(plainResult.targets.length, 0);

		const { decision: blockedViewAs } = f.session(event);
		assert.throws(() => driveStages(blockedViewAs, tool("use_skill", { skill_name: "inherited_card_viewas", card_refs: ["c0"] }), stage => stage.items.map(item => item.ref)), /filter_ok/);

		const { decision: allowedViewAs } = f.session({ ...event, filterOk: () => true });
		const viewAsResult = driveStages(allowedViewAs, tool("use_skill", { skill_name: "inherited_card_viewas", card_refs: ["c0"] }), stage => stage.items.map(item => item.ref));
		assert.equal(viewAsResult.bool, true);
		assert.equal(viewAsResult.card.name, "sha");
		assert.equal(viewAsResult.targets.length, 1);
		assert.equal(viewAsResult.targets[0], enemy);
	} finally {
		f.runtime.isSkillEligible = originalEligible;
	}
});

test("skill deadTarget enters targetPool and survives DecisionSession revalidate", async () => {
	const f = await createSkillRuntime();
	f.game.players.length = 0;
	const owner = f.player("owner", [{ name: "sha", suit: "heart" }]);
	const corpse = f.player("corpse");
	f.game.players.pop();
	corpse.isIn = () => false;
	f.game.dead.push(corpse);
	f.lib.skill.revive_skill = {
		selectionSpec: true,
		deadTarget: true,
		selectTarget: 1,
		filterTarget: (_card, _player, target) => target === corpse,
	};
	const event = {
		name: "chooseToUse",
		player: owner,
		skills: ["revive_skill"],
		filterCard: () => false,
		filterTarget: () => false,
	};
	const { snapshot, decision } = f.session(event);
	const action = snapshot.actions.find(item => item.skillName === "revive_skill");
	assert.deepEqual(Array.from(action.target.targetRefs), ["p1"]);
	decision.revalidate();
	const result = decision.accept(tool("use_skill", { skill_name: "revive_skill", target_refs: ["p1"] })).result;
	assert.equal(result.bool, true);
	assert.equal(result.targets.length, 1);
	assert.equal(result.targets[0], corpse);
});
