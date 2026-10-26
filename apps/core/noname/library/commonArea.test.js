import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function readSource(path) {
	return ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}

const librarySource = readSource("./index.js");
const library = librarySource.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Library");
assert.ok(library);
const field = library.members.find(node => ts.isPropertyDeclaration(node) && node.name.getText(librarySource) === "commonArea");
assert.ok(field?.initializer);

test("common areas keep async handlers and register hidden poker piles without changing metadata", () => {
	const cards = [];
	const updates = [];
	const renku = {
		removeArray(value) {
			assert.equal(value, cards);
		},
	};
	const areas = new Function("_status", "game", `return ${field.initializer.getText(librarySource)}`)(
		{ renku },
		{
			updateRenku() {
				updates.push("renku");
			},
		}
	);
	const entry = areas.get("renku");
	assert.equal(entry.isUnseen, undefined);
	assert.equal(entry.areaStatusName, "renku");
	const removed = entry.removeHandeler({ cards });
	assert.equal(removed instanceof Promise, true);
	assert.deepEqual(updates, ["renku"]);
	const offline = readSource("../../character/offline/skill.js");
	let registration;
	const visit = node => {
		if (ts.isCallExpression(node) && node.expression.getText(offline) === "lib.commonArea.set" && node.arguments[0]?.getText(offline) === '"pokerPile"') registration = node;
		ts.forEachChild(node, visit);
	};
	visit(offline);
	assert.ok(registration);
	new Function("lib", registration.getText(offline))({ commonArea: areas });
	assert.equal(areas.get("pokerPile").isUnseen, true);
	assert.equal(areas.get("pokerPile").fromName, "fromPokerPile");
});

test("common area dialog shows visible cards but keeps hidden pile counts only", () => {
	const source = readSource("../ui/click/index.js");
	const click = source.statements.find(node => ts.isClassDeclaration(node));
	const method = click.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === "commonCardPileButton");
	assert.ok(method);
	const visible = [{}],
		hidden = [{}, {}];
	const entries = new Map([
		["renku", { areaStatusName: "renku", translate: "仁库" }],
		["pokerPile", { areaStatusName: "pokerPile", translate: "扑克牌堆", isUnseen: true }],
	]);
	const shown = [],
		titles = [];
	const dialog = {
		listen() {},
		add(value) {
			titles.push(value);
		},
		addSmall(value) {
			shown.push(value);
		},
	};
	const ui = { create: { dialog: () => dialog, div: () => "placeholder" } };
	const get = { cnNumber: String, itemtype: value => (Array.isArray(value) ? "cards" : undefined) };
	const render = new Function("lib", "_status", "ui", "get", `return function() ${method.body.getText(source)}`)({ commonArea: entries }, { renku: visible, pokerPile: hidden }, ui, get);
	assert.equal(render(), dialog);
	assert.deepEqual(shown, [[visible, "card"]]);
	assert.equal(
		titles.some(value => value.includes("扑克牌堆 (2张)")),
		true
	);
});
