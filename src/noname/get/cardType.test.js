import { getTestText } from "./testing/testSource.ts";
import { builtinSkillTestSource } from "../library/builtinSkills/testSource.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("get.js", getTestText(), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const getClass = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Get");
const method = getClass.members.find(node => node.name?.getText(source) === "type");

function loadType() {
	const lib = { card: { sha: { type: "basic" }, armor: { type: "equip" }, delayed: { type: "delay" } }, nature: new Set(["fire", "thunder"]) };
	const reads = [];
	const get = {
		name(card, player) {
			reads.push([card, player]);
			return card.name;
		},
	};
	const type = new Function("get", "lib", `return function(obj, method, player) ${method.body.getText(source)}`)(get, lib);
	return { type, reads };
}

test("card type accepts lightweight configurations and forwards the original object and owner", () => {
	const { type, reads } = loadType();
	const card = { name: "armor" };
	const owner = {};
	assert.equal(type(card, undefined, owner), "equip");
	assert.equal(reads[0][0], card);
	assert.equal(reads[0][1], owner);
	assert.equal(type("delayed", "trick", false), "trick");
	assert.equal(type("delayed"), "delay");
});

test("card type keeps the absent result and registered nature aliases", () => {
	const { type } = loadType();
	assert.equal(type({ name: "missing" }), undefined);
	assert.equal(type("sha_fire_thunder"), "basic");
	assert.equal(type(7), undefined);
});

test("card type does not repair the existing invalid nature-alias lookup", () => {
	assert.throws(() => loadType().type("sha_missing"), TypeError);
});

test("card property queries preserve their existing undefined early return", () => {
	const unexpected = new Proxy(
		{},
		{
			get() {
				throw new Error("undefined input must return before querying game state");
			},
		}
	);
	for (const name of ["type", "subtype", "suit", "color", "number"]) {
		const declaration = getClass.members.find(node => node.name?.getText(source) === name);
		assert.ok(declaration);
		const query = new Function("get", "lib", `return ({${declaration.getText(source)}})[${JSON.stringify(name)}];`)(unexpected, unexpected);
		assert.equal(query(undefined), undefined, name);
	}
});

test("card number recursively reads one configuration and leaves multiple configurations unresolved", () => {
	const declaration = getClass.members.find(node => node.name?.getText(source) === "number");
	const get = {};
	get.number = new Function("get", `return ({${declaration.getText(source)}}).number;`)(get);
	assert.equal(get.number([{ name: "sha", number: 7 }], false), 7);
	assert.equal(get.number([{ number: 7 }, { number: 8 }], false), null);
	assert.equal(get.number([], false), null);
});

test("selection range callbacks keep single evaluation and normalize numeric results", () => {
	const declaration = getClass.members.find(node => node.name?.getText(source) === "select");
	const get = { itemtype: value => (Array.isArray(value) && value.length === 2 ? "select" : undefined) };
	get.select = new Function("get", `return ({${declaration.getText(source)}}).select;`)(get);
	let calls = 0;
	assert.deepEqual(
		get.select(() => {
			calls++;
			return 2;
		}),
		[2, 2]
	);
	assert.equal(calls, 1);
	const range = [1, 3];
	assert.equal(
		get.select(() => range),
		range
	);
	assert.deepEqual(get.select(undefined), [1, 1]);
});

test("stone recast reads the type only after mode and player guards", () => {
	const skillSource = builtinSkillTestSource();
	let callback;
	function visit(node) {
		if (ts.isCallExpression(node) && node.expression.getText(skillSource) === "player.recast" && node.arguments[2]?.getText(skillSource).includes("numberOfCardsToDraw")) callback = node.arguments[2];
		ts.forEachChild(node, visit);
	}
	visit(skillSource);
	assert.ok(callback);
	let typeCalls = 0;
	const get = {
		type() {
			typeCalls++;
			return undefined;
		},
		subtype: () => undefined,
	};
	const lib = { config: { mode: "identity" } };
	const status = { mode: "deck" };
	const draws = [];
	const player = {
		isMin: () => false,
		draw(...args) {
			draws.push(args);
			return {};
		},
	};
	const run = new Function("get", "lib", "_status", `return ${callback.getText(skillSource)}`)(get, lib, status);
	run(player, [{}]);
	assert.equal(typeCalls, 0);
	assert.deepEqual(draws, [[1, "nodelay"]]);
	lib.config.mode = "stone";
	assert.throws(() => run(player, [{}]), TypeError);
	assert.equal(typeCalls, 1);
	assert.equal(draws.length, 1);
	get.type = () => "basic";
	run(player, [{}]);
	assert.equal(draws.length, 2);
});
