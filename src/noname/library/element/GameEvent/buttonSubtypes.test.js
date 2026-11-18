import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("./buttonSubtypes.ts", import.meta.url), "utf8");
const getSource = ts.createSourceFile("get.js", readFileSync(new URL("../../../get/index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const getClass = getSource.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Get");
const subtypesMethod = getClass.members.find(node => node.name?.getText(getSource) === "subtypes");

function loadBoundary(get) {
	const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText;
	const exports = {};
	new Function("require", "exports", output)(specifier => {
		assert.equal(specifier, "noname");
		return { get };
	}, exports);
	return exports.getButtonSubtypes;
}

function loadParser(card = {}) {
	const get = { copy: value => value.slice(), name: value => value.name };
	get.subtypes = new Function("get", "lib", `return function (obj, player) ${subtypesMethod.body.getText(getSource)}`)(get, { card });
	return get;
}

test("selection link parsing preserves strings, missing links and card configuration", () => {
	const get = loadParser({ horse: { subtypes: ["equip3", "equip4"] }, armor: { subtype: "equip2" } });
	const read = loadBoundary(get);
	assert.deepEqual(read(undefined), []);
	assert.deepEqual(read(null), []);
	assert.deepEqual(read(7), []);
	assert.deepEqual(read("horse"), ["equip3", "equip4"]);
	assert.deepEqual(read({ name: "armor" }), ["equip2"]);
});

test("selection subtype boundary keeps parser receiver, getter reads and copied array", () => {
	const get = loadParser();
	const parse = get.subtypes;
	const values = ["equip3", 4, undefined];
	let reads = 0;
	let calls = 0;
	const link = { get subtypes() { reads++; return values; } };
	get.subtypes = function (value, player) {
		calls++;
		assert.equal(this, get);
		assert.equal(value, link);
		assert.equal(player, false);
		return parse(value, player);
	};
	const result = loadBoundary(get)(link);
	assert.equal(calls, 1);
	assert.equal(reads, 2);
	assert.deepEqual(result, values);
	assert.notEqual(result, values);
});

test("selection subtype boundary validates the returned container without filtering values", () => {
	const values = ["equip4", null, {}];
	const get = { subtypes: () => values };
	assert.equal(loadBoundary(get)({}), values);
	get.subtypes = () => "equip4";
	assert.throws(() => loadBoundary(get)({}), TypeError);
});
