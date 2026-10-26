import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let callback;
function visit(node) {
	if (ts.isCallExpression(node) && node.expression.getText(source) === "game.loadModeAsync" && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === "boss" && node.arguments[1]?.getText(source).includes("mode_boss")) {
		assert.equal(callback, undefined, "Boss import callback must be unique");
		callback = node.arguments[1];
	}
	ts.forEachChild(node, visit);
}
visit(source);
assert.ok(callback);

function setup() {
	const storage = { boss: {}, versus: {}, translate: {} };
	let continued = 0;
	const run = new Function("storage", "loadversus", `return ${callback.getText(source)}`)(storage, () => continued++);
	return { storage, run, continued: () => continued };
}

test("Boss import preserves raw object identity, tuple exclusion and inherited truthy flags", () => {
	const { storage, run, continued } = setup();
	const raw = { sex: "male", group: "qun", hp: 25, skills: [], isBossAllowed: true };
	const tuple = ["male", "qun", 4, []];
	const inherited = Object.create({ isBossAllowed: "enabled" });
	const disabled = { isBossAllowed: false };
	run({ translate: { boss: "挑战" }, characterPack: { mode_boss: { raw, tuple, inherited, disabled } } });
	assert.deepEqual(Object.keys(storage.boss), ["raw", "inherited"]);
	assert.equal(storage.boss.raw, raw);
	assert.equal(storage.boss.inherited, inherited);
	assert.equal(storage.translate.boss, "挑战");
	assert.equal(continued(), 1);
});

test("Boss import retains missing-pack failure after translation and before continuation", () => {
	const { storage, run, continued } = setup();
	assert.throws(() => run({ translate: { boss: "挑战" } }), TypeError);
	assert.equal(storage.translate.boss, "挑战");
	assert.equal(continued(), 0);
});

test("Boss import keeps absent mode_boss as an empty enumeration", () => {
	const { storage, run, continued } = setup();
	run({ characterPack: {} });
	assert.deepEqual(storage.boss, {});
	assert.equal(continued(), 1);
});
