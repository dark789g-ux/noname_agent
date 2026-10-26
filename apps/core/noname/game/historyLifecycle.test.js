import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { readHistoryEvents } from "./historyTypes.js";

const source = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Game");
const names = ["getGlobalHistory", "hasGlobalHistory", "checkGlobalHistory", "hasAllGlobalHistory", "checkAllGlobalHistory", "getAllGlobalHistory", "getRoundHistory"];

function harness(history) {
	const game = {};
	for (const name of names) {
		const method = declaration.members.find(node => node.name?.getText(source) === name);
		assert.ok(method, name);
		game[name] = new Function("game", "_status", "lib", "readHistoryEvents", `return ({${method.getText(source)}})[${JSON.stringify(name)}];`)(game, { globalHistory: history }, { filter: { all: () => true } }, readHistoryEvents);
	}
	return game;
}

test("history queries retain references, inclusive boundaries and callback order", () => {
	const first = { num: 1 };
	const draw = { num: player => player.count };
	const last = { num: 3 };
	const events = [first, draw, last];
	const segment = { everything: events, cardMove: [first], isRound: true };
	const game = harness([segment]);
	assert.equal(game.getGlobalHistory(), segment);
	assert.equal(game.getGlobalHistory("everything"), events);
	const calls = [];
	assert.deepEqual(game.getGlobalHistory("everything", event => { calls.push(event); return true; }, draw), [first, draw]);
	assert.deepEqual(calls, [first, draw]);
	assert.equal(game.hasGlobalHistory("everything", event => event === draw, draw), true);
	assert.equal(game.hasGlobalHistory("everything", event => event === last, draw), false);
	calls.length = 0;
	game.checkGlobalHistory("everything", event => calls.push(event), draw);
	assert.deepEqual(calls, [first, draw]);
	assert.equal(game.hasAllGlobalHistory("everything", event => event === draw), true);
	assert.deepEqual(game.getAllGlobalHistory("everything"), events);
	assert.deepEqual(game.getAllGlobalHistory(), [segment]);
});

test("keyed history reads remain uncached across accessors and callback replacement", () => {
	const event = {};
	const list = [event];
	let reads = 0;
	const segment = { get everything() { reads++; return list; } };
	const game = harness([segment]);
	assert.equal(game.hasAllGlobalHistory("everything", () => true, event), true);
	assert.equal(reads, 4);
	reads = 0;
	game.checkAllGlobalHistory("everything", () => {}, event);
	assert.equal(reads, 4);
	reads = 0;
	assert.deepEqual(game.getAllGlobalHistory("everything"), list);
	assert.equal(reads, 2);
	const replacement = [];
	let current = list;
	let observed;
	const dynamic = { get everything() { return current; } };
	const dynamicGame = harness([dynamic, dynamic]);
	dynamicGame.checkAllGlobalHistory("everything", value => {
		observed = value;
		current = replacement;
	});
	assert.equal(observed, event);
});

test("round histories retain reverse collection, selected rounds and last cutoff", () => {
	const old = { id: "old" };
	const a = { id: "a" };
	const b = { id: "b" };
	const recent = { id: "recent" };
	const game = harness([{ everything: [old], isRound: true }, { everything: [a, b], isRound: true }, { everything: [recent] }]);
	const previous = Object.getOwnPropertyDescriptor(Array.prototype, "addArray");
	Object.defineProperty(Array.prototype, "addArray", { configurable: true, value(items) {
		for (const item of items) if (!this.includes(item)) this.push(item);
		return this;
	} });
	try {
		assert.deepEqual(game.getRoundHistory("everything"), [a, b, recent]);
		assert.deepEqual(game.getRoundHistory("everything", undefined, b), [a, b]);
		assert.deepEqual(game.getRoundHistory("everything", undefined, undefined, 1), [old]);
		assert.deepEqual(game.getRoundHistory("everything", undefined, undefined, 1, true), [old, a, b, recent]);
	} finally {
		if (previous) Object.defineProperty(Array.prototype, "addArray", previous);
		else delete Array.prototype.addArray;
	}
});
