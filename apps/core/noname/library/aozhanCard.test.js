import { builtinSkillTestSource } from "./builtinSkills/testSource.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = builtinSkillTestSource();
let aozhan;
function visit(node) {
	if (ts.isPropertyAssignment(node) && node.name.getText(source) === "aozhan") aozhan = node.initializer;
	ts.forEachChild(node, visit);
}
visit(source);
const mod = aozhan.properties.find(node => node.name?.getText(source) === "mod").initializer;
const method = mod.properties.find(node => node.name?.getText(source) === "cardname");
class Card { constructor() { this.name = "tao"; } }
class VCard { constructor(cards) { this.name = "tao"; this.cards = cards; } }
const legacyTag = Symbol("legacy-card");

function fixture(filter) {
	const calls = [];
	const event = { filterCard: filter };
	const get = {
		event: () => event,
		itemtype: value => value instanceof Card || value[legacyTag] ? "card" : "vcard",
		autoViewAs(data, cards) { calls.push({ data, cards }); return data; },
	};
	const run = new Function("get", `return ({ ${method.getText(source)} }).cardname;`)(get);
	return { run, calls, event };
}

test("aozhan uses real source cards rather than wrapping virtual/configuration cards", () => {
	const physical = new Card();
	for (const card of [physical, new VCard([physical]), { name: "tao", cards: [physical] }, { name: "tao" }]) {
		const player = {};
		const { run, calls, event } = fixture((view, owner, evt) => { assert.equal(owner, player); assert.equal(evt, event); return view.name === "shan"; });
		assert.equal(run(card, player), "shan");
		assert.deepEqual(calls.map(call => call.data.name), ["shan", "sha"]);
		for (const call of calls) {
			assert.deepEqual(call.cards, card === physical || card.cards ? [physical] : []);
			assert.deepEqual(call.data.cards, call.cards);
			if (card.cards) assert.equal(call.cards, card.cards);
		}
	}
});

test("aozhan keeps sha fallback and short circuit behavior", () => {
	const { run, calls } = fixture(() => false);
	assert.equal(run({ name: "tao" }, {}), "sha");
	assert.deepEqual(calls.map(call => call.data.name), ["shan"]);
	const noFilter = fixture(undefined);
	assert.equal(noFilter.run({ name: "tao" }, {}), "sha");
	assert.equal(noFilter.calls.length, 0);
	assert.equal(noFilter.run({ name: "sha" }, {}), undefined);
});

test("aozhan leaves the experimental card classification branch unchanged", () => {
	const card = { name: "tao", [legacyTag]: true };
	const { run, calls } = fixture(() => false);
	run(card, {});
	assert.deepEqual(calls[0].cards, [card]);
});
