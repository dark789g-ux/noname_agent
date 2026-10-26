import { builtinSkillTestSource } from "./builtinSkills/testSource.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function find(path, name, predicate) {
	const source = path === "./skill.js" ? builtinSkillTestSource() : ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	let found;
	const visit = node => {
		if (predicate(node) && node.name?.getText(source) === name) found = node;
		ts.forEachChild(node, visit);
	};
	visit(source);
	assert.ok(found);
	return { source, found };
}

test("recast source preserves nullish fallback and explicit player forwarding", () => {
	const entry = find("./element/player.js", "canRecast", ts.isMethodDeclaration);
	const filter = find("./index.js", "cardRecastable", ts.isMethodDeclaration);
	const calls = [];
	const game = { checkMod: (...args) => { calls.push(args); return "unchanged"; } };
	const lib = { filter: {} };
	const player = {};
	const card = {};
	const get = { owner: () => player, position: () => "h", info: () => ({ recastable: true }) };
	lib.filter.cardRecastable = new Function("game", "get", `"use strict"; return function(card, player, source, strict) ${filter.found.body.getText(filter.source)}`)(game, get);
	const canRecast = new Function("lib", `return function(card, source, strict) ${entry.found.body.getText(entry.source)}`)(lib);
	const source = {};
	for (const supplied of [undefined, null, source]) {
		assert.equal(canRecast.call(player, card, supplied, true), true);
		assert.deepEqual(calls.at(-1), [card, player, supplied ?? player, "unchanged", "cardRecastable", player]);
	}
});

test("recast filter keeps lazy invocation, argument identity and invalid-callback failure", () => {
	const entry = find("./skill.js", "_recasting", ts.isPropertyAssignment);
	const filter = entry.found.initializer.properties.find(node => node.name?.getText(entry.source) === "filter").initializer;
	const definition = { position: "he" };
	const run = new Function("lib", "requireRegisteredSkill", `return (${filter.getText(entry.source)});`)({ skill: {} }, () => definition);
	const card = {};
	let cards = [];
	const player = { hasCard: (check, position) => { assert.equal(position, "he"); return cards.some(check); } };
	definition.filterCard = true;
	assert.equal(run({}, player), false);
	cards = [card];
	assert.throws(() => run({}, player), TypeError);
	definition.filterCard = (received, owner) => {
		assert.equal(received, card);
		assert.equal(owner, player);
		return true;
	};
	assert.equal(run({}, player), true);
});
