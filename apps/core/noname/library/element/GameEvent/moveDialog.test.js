import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import ts from "typescript";

const source = ts.createSourceFile("content.ts", readFileSync(new URL("../content.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
let declaration;
const visit = node => {
	if (ts.isFunctionDeclaration(node) && node.name?.text === "updateButtons") declaration = node;
	ts.forEachChild(node, visit);
};
visit(source);
assert.ok(declaration);

function updater(event, ui, dom) {
	const code = ts.transpileModule(declaration.getText(source), { compilerOptions: { target: ts.ScriptTarget.Latest } }).outputText;
	return new Function("event", "ui", "HTMLDivElement", `${code}; return updateButtons`)(event, ui, dom.window.HTMLDivElement);
}

test("move dialog reads link identity and order without pretending every child is a Card", () => {
	const dom = new JSDOM();
	const container = dom.window.document.createElement("div");
	const first = dom.window.document.createElement("div");
	const second = dom.window.document.createElement("span");
	const noLink = dom.window.document.createElement("div");
	const card = { name: "sha" };
	first.link = card;
	second.link = "custom-display-data";
	container.append(first, second, noLink);
	const confirmed = [];
	const event = { list: [["cards", [card]]], dialog: { itemContainers: [null, null, container] }, filterOk: () => true };
	const update = updater(event, { create: { confirm: value => confirmed.push(value) } }, dom);
	update();
	assert.deepEqual(event.moved, [[card, "custom-display-data", undefined]]);
	assert.equal(event.moved[0][0], card);
	assert.deepEqual(confirmed, ["o"]);
	dom.window.close();
});

test("move dialog keeps optional cancellation and required-container failure", () => {
	const dom = new JSDOM();
	const confirmed = [];
	let closed = 0;
	const container = dom.window.document.createElement("div");
	const event = { list: [["cards", []]], dialog: { itemContainers: [null, null, container] }, filterOk: () => false, forced: false };
	const update = updater(event, { create: { confirm: value => confirmed.push(value) }, confirm: { close: () => closed++ } }, dom);
	update();
	assert.deepEqual(confirmed, ["c"]);
	event.forced = true;
	update();
	assert.equal(closed, 1);
	event.dialog.itemContainers.length = 0;
	assert.throws(update, TypeError);
	dom.window.close();
});
