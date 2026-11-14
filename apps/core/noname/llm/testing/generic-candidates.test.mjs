import assert from "node:assert/strict";
import test from "node:test";
import { createModuleRuntime } from "./module-runtime.mjs";

test("candidates.ts accepts generic skills without selectionSpec, excludes selectionSpec: false, and isolates throwing generic filterCard", async () => {
	const sha = { name: "sha", cardid: "c_sha" };
	const cards = [sha];
	const ui = {};
	const _status = { event: { outer: true } };
	const skills = {
		genericOk: {
			filterCard: () => {
				return !!_status.event?._backup?.filterTarget && Array.isArray(ui.selected?.cards);
			},
		},
		genericBrokenCard: {
			filterCard: () => {
				throw new Error("bad card filter");
			},
		},
		genericBrokenEnable: {
			filterCard: true,
		},
		disabledSkill: {
			selectionSpec: false,
			filterCard: true,
		},
	};
	const player = {
		getCards: () => cards,
		getSkills: () => Object.keys(skills),
	};
	const runtime = await createModuleRuntime({
		ui,
		_status,
		game: { expandSkills: list => list },
		lib: {
			skill: { ...skills, global: [] },
			filter: {
				filterEnable: (_event, _player, skill) => {
					if (skill === "genericBrokenEnable") throw new Error("enable boom");
					return true;
				},
			},
		},
		get: {
			translation: value => value.name,
			filter: filter => card => Object.entries(filter).every(([key, value]) => card[key] === value),
		},
	});
	const { getCandidateSkills, getCandidateCards, isSkillEligible } = await runtime.import("noname/llm/candidates.ts");
	const event = { filterCard: () => false, filterTarget: () => true };

	assert.equal(isSkillEligible(event, player, "genericOk"), true);
	assert.equal(isSkillEligible(event, player, "genericBrokenEnable"), false);
	assert.equal(isSkillEligible(event, player, "disabledSkill"), false);

	const enabled = getCandidateSkills(event, player);
	assert.deepEqual(Array.from(enabled), ["genericOk", "genericBrokenCard"]);

	const candidateCards = getCandidateCards(event, player, enabled);
	assert.equal(candidateCards.length, 1);
	assert.deepEqual(Array.from(candidateCards[0].skills), ["genericOk"]);
	assert.deepEqual(_status.event, { outer: true });
	assert.equal("selected" in ui, false);
});
