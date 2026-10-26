import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { copyValue } from "./copy.js";

const source = ts.createSourceFile("get.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Get");
const method = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === "result");

function loadResult(entries, log = []) {
	const get = {
		info(item) { log.push(["info", item]); return entries.get(item); },
		copy(value) { log.push(["copy", value]); return copyValue(value, false, new WeakMap()); },
	};
	return new Function("get", `"use strict"; return ({${method.getText(source)}}).result;`)(get);
}

test("result copies a configuration before applying the skill's enumerable fields in order", () => {
	const item = { name: "sha" };
	const original = { player: 1, target: 2, extra: { value: 1 } };
	const order = [];
	const inherited = { target_use: 4 };
	const override = Object.create(inherited);
	Object.defineProperty(override, "player", { enumerable: true, get() { order.push("player"); return 3; } });
	Object.defineProperty(override, "target", { enumerable: true, get() { order.push("target"); return 5; } });
	const evaluate = loadResult(new Map([[item, { ai: { result: original } }], ["skill", { ai: { result: override } }]]));
	const result = evaluate(item, "skill");
	assert.notEqual(result, original);
	assert.notEqual(result.extra, original.extra);
	assert.deepEqual(original, { player: 1, target: 2, extra: { value: 1 } });
	assert.deepEqual(result, { player: 3, target: 5, extra: { value: 1 }, target_use: 4 });
	assert.deepEqual(order, ["player", "target"]);
});

test("result callbacks receive the evaluated item once with the original bare-call context", () => {
	const item = { name: "sha" };
	const log = [];
	const produced = { player: 2 };
	function callback(value) {
		assert.equal(this, undefined);
		assert.equal(value, item);
		log.push(["callback", value]);
		return produced;
	}
	const evaluate = loadResult(new Map([[item, { ai: { result: callback } }], ["skill", { ai: { result: { target: 3 } } }]]), log);
	assert.equal(evaluate(item, "skill"), produced);
	assert.deepEqual(produced, { player: 2, target: 3 });
	assert.deepEqual(log.map(entry => entry[0]), ["info", "copy", "callback", "info"]);
});

test("numeric results remain numbers and falsey callback results retain the empty-object fallback", () => {
	for (const value of [2, -3, Infinity]) {
		const evaluate = loadResult(new Map([["item", { ai: { result: value } }]]));
		assert.equal(evaluate("item"), value);
	}
	for (const value of [0, NaN, null, undefined]) {
		const evaluate = loadResult(new Map([["item", { ai: { result: () => value } }]]));
		assert.deepEqual(evaluate("item"), {});
	}
});

test("writing a skill override onto a truthy number still fails at the first actual write", () => {
	const seen = [];
	const override = { get player() { seen.push("read"); return 3; } };
	const evaluate = loadResult(new Map([["item", { ai: { result: () => 2 } }], ["skill", { ai: { result: override } }]]));
	assert.throws(() => evaluate("item", "skill"), TypeError);
	assert.deepEqual(seen, ["read"]);
	const noOverride = loadResult(new Map([["item", { ai: { result: 2 } }], ["skill", { ai: { result: {} } }]]));
	assert.equal(noOverride("item", "skill"), 2);
});

test("a skill's result callback is not invoked when used as a field-override source", () => {
	let calls = 0;
	function skillResult() { calls++; return { target: 100 }; }
	skillResult.target = 4;
	const evaluate = loadResult(new Map([["item", { ai: { result: { player: 1 } } }], ["skill", { ai: { result: skillResult } }]]));
	assert.deepEqual(evaluate("item", "skill"), { player: 1, target: 4 });
	assert.equal(calls, 0);
});

test("numeric or absent skill overlays do not manufacture result fields", () => {
	for (const overlay of [undefined, 0, 2, NaN]) {
		const evaluate = loadResult(new Map([["item", { ai: { result: 2 } }], ["skill", { ai: { result: overlay } }]]));
		assert.equal(evaluate("item", "skill"), 2);
	}
});

test("symbol skill entries remain valid evaluated items", () => {
	const item = Symbol("skill");
	const evaluate = loadResult(new Map([[item, { ai: { result: value => { assert.equal(value, item); return 2; } } }]]));
	assert.equal(evaluate(item), 2);
});

test("missing item information still fails after the original lookup", () => {
	const log = [];
	const evaluate = loadResult(new Map(), log);
	assert.throws(() => evaluate(undefined), TypeError);
	assert.deepEqual(log, [["info", undefined]]);
});

test("equipment initialization retains configuration and callback fields, and rejects numeric writes", () => {
	const gameSource = ts.createSourceFile("game.js", readFileSync(new URL("../game/index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
	const gameClass = gameSource.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Game");
	const finishCard = gameClass.members.find(node => node.name?.getText(gameSource) === "finishCard");
	const card = { type: "equip", ai: {} };
	const lib = { translate: {}, card: { sample: card }, element: { content: { equipCard() {} } } };
	const get = { mode: () => "identity" };
	const finish = new Function("lib", "get", `"use strict"; return ({${finishCard.getText(gameSource)}}).finishCard;`)(lib, get);
	let calls = 0;
	function resolver() { calls++; return { target: 3 }; }
	for (const result of [{ target: 3 }, resolver]) {
		card.ai.result = result;
		finish("sample");
		assert.equal(card.ai.result, result);
		assert.equal(typeof result.target, "function");
	}
	assert.equal(calls, 0);
	const kept = { keepAI: true, target: 7 };
	card.ai.result = kept;
	finish("sample");
	assert.equal(card.ai.result, kept);
	assert.equal(kept.target, 7);
	card.ai.result = 2;
	assert.throws(() => finish("sample"), TypeError);
	assert.equal(card.ai.result, 2);
});
