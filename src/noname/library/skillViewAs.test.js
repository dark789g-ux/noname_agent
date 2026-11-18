import { field } from "./testing/fixtures.mjs";
import assert from "node:assert/strict";

import test from "node:test";

function fixture(info) {
	const calls = [];
	const player = { getSkills: () => ["skill"], storage: {} };
	const event = {
		type: "phase",
		name: "chooseToUse",
		filterCard(card, actualPlayer, actualEvent) {
			calls.push(["filter", card, actualPlayer, actualEvent]);
			return true;
		},
	};
	const get = {
		info: () => info,
		autoViewAs(card, mode) {
			calls.push(["auto", card, mode]);
			return card;
		},
	};
	const game = { expandSkills: skills => skills };
	const lib = { skill: { global: [] } };
	const run = field("filter", { get, game, lib }).filterEnable;
	return { calls, player, event, run: () => run(event, player, "skill") };
}

test("a string skill viewAs is interpreted as a name only at the skill consumer", () => {
	const info = { enable: "phaseUse", viewAs: "sha" };
	const { run, calls, player, event } = fixture(info);
	assert.equal(run(), true);
	assert.deepEqual(calls, [
		["auto", { name: "sha" }, "unsure"],
		["filter", { name: "sha" }, player, event],
	]);
	assert.equal(info.viewAs, "sha");
});

test("object viewAs retains identity and the original getter read count", () => {
	const descriptor = { name: "shan", storage: { source: "skill" } };
	let reads = 0;
	const info = {
		enable: "phaseUse",
		get viewAs() {
			reads++;
			return descriptor;
		},
	};
	const { run, calls } = fixture(info);
	assert.equal(run(), true);
	assert.equal(calls[0][1], descriptor);
	assert.equal(calls[1][1], descriptor);
	assert.equal(reads, 3);
});

test("disabled viewAs and an absent card filter do not evaluate autoViewAs", () => {
	const disabled = fixture({ enable: "phaseUse", viewAs: "sha", viewAsFilter: () => false });
	assert.equal(disabled.run(), false);
	assert.deepEqual(disabled.calls, []);
	const noFilter = fixture({ enable: "phaseUse", viewAs: "sha" });
	delete noFilter.event.filterCard;
	assert.equal(noFilter.run(), true);
	assert.deepEqual(noFilter.calls, []);
});
