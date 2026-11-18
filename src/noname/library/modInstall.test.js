import { builtinSkillTestSource } from "./builtinSkills/testSource.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = builtinSkillTestSource();

function load(name, info) {
	let skill;
	const visit = node => {
		if (ts.isPropertyAssignment(node) && node.name.getText(source) === name) skill = node.initializer;
		ts.forEachChild(node, visit);
	};
	visit(source);
	assert.ok(skill && ts.isObjectLiteralExpression(skill));
	const broadcasts = [];
	const game = {
		broadcastAll(fn, ...args) {
			broadcasts.push(args);
			fn(...args);
		},
	};
	const lib = { requireSkill: () => info };
	const get = { info: () => info, name: card => card.name };
	return { skill: new Function("game", "lib", "get", `"use strict"; return (${skill.getText(source)});`)(game, lib, get), broadcasts };
}

test("warfare mod installation preserves existing objects, callback arguments and repeat initialization", () => {
	const player = {};
	const card = { name: "sha" };
	for (const [name, key, args] of [["zf_maxHandcard", "maxHandcard", [player, 4]], ["zf_cardUsable", "cardUsable", [card, player, 4]]]) {
		const calls = [];
		const mod = {};
		const info = { mod, modNum: (...received) => { calls.push(received); return 7; } };
		const { skill, broadcasts } = load(name, info);
		skill.init(player, name);
		assert.equal(info.mod, mod);
		const installed = mod[key];
		assert.equal(installed(...args), 7);
		assert.deepEqual(calls, [args]);
		skill.init(player, name);
		assert.equal(mod[key], installed);
		assert.deepEqual(broadcasts, [[player, name], [player, name]]);
	}
});

test("warfare mod installation retains numeric filtering and missing-container failure", () => {
	const player = {};
	const hand = { mod: {}, modNum: 2 };
	load("zf_maxHandcard", hand).skill.init(player, "hand");
	assert.equal(hand.mod.maxHandcard(player, 4), 6);
	const usable = { mod: {}, modNum: 2, cardFilter: "sha" };
	load("zf_cardUsable", usable).skill.init(player, "usable");
	assert.equal(usable.mod.cardUsable({ name: "sha" }, player, 1), 3);
	assert.equal(usable.mod.cardUsable({ name: "shan" }, player, 1), undefined);
	for (const name of ["zf_maxHandcard", "zf_cardUsable"]) {
		const info = { modNum: 1, cardFilter: "sha" };
		assert.throws(() => load(name, info).skill.init(player, name), TypeError);
		assert.equal(Object.hasOwn(info, "mod"), false);
	}
});
