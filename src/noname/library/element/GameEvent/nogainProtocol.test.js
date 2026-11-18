import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { playerTestSource } from "../Player/testSource.js";

const playerSource = playerTestSource();
const playerClass = playerSource.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Player");
const skills = ts.createSourceFile("rest.js", readFileSync(new URL("../../../../mode/guozhan/src/skill/character/rest.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const registry = skills.statements.find(node => ts.isExportAssignment(node) && ts.isObjectLiteralExpression(node.expression));
const object = registry.expression;
const zhuwei = object.properties.find(node => node.name?.getText(skills) === "zhuwei").initializer;
const filter = zhuwei.properties.find(node => node.name?.getText(skills) === "filter");
const get = { owner: () => undefined, itemtype: () => null, is: { object: value => typeof value === "object" && value !== null && !Array.isArray(value) }, translation: () => "test" };
const zhuweiFilter = new Function("get", `return ({${filter.getText(skills)}}).filter;`)(get);

function producer(name) {
	const method = playerClass.members.find(node => node.name?.getText(playerSource) === name);
	const game = {
		createEvent(eventName) {
			return {
				name: eventName,
				setContent(content) {
					this.boundContent = content;
				},
			};
		},
	};
	const lib = { inpile: [] };
	const ui = { discardPile: {} };
	const status = { event: { name: "test_parent" } };
	return new Function("game", "get", "lib", "ui", "_status", `return ({${method.getText(playerSource)}})[${JSON.stringify(name)}];`)(game, get, lib, ui, status);
}

test("discoverCard's actual legacy and config paths produce boolean nogain", () => {
	const discover = producer("discoverCard");
	const list = ["sha"];
	const legacy = discover.call({}, list, "nogain");
	const configured = discover.call({}, list, { nogain: true });
	assert.equal(legacy.nogain, true);
	assert.equal(configured.nogain, true);
	assert.equal(legacy.list, list);
	assert.equal(configured.list, list);
	assert.equal(legacy.boundContent, "discoverCard");
});

test("a normal judge producer does not establish a nogain predicate", () => {
	const event = producer("judge").call({});
	assert.equal(Object.hasOwn(event, "nogain"), false);
	const card = {};
	event.result = { card };
	assert.equal(zhuweiFilter(event), true);
});

test("zhuwei preserves its predicate protocol and the existing truthy non-callable failure", () => {
	const card = {};
	const calls = [];
	const event = {
		result: { card },
		nogain(value) {
			calls.push([this, value]);
			return true;
		},
	};
	assert.equal(zhuweiFilter(event), false);
	assert.equal(calls.length, 1);
	assert.equal(calls[0][0], event);
	assert.equal(calls[0][1], card);
	event.nogain = () => false;
	assert.equal(zhuweiFilter(event), true);
	event.nogain = true;
	assert.throws(() => zhuweiFilter(event), TypeError);
});
