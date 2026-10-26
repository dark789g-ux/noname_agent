import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let branch;
const visit = node => {
	if (ts.isIfStatement(node) && node.expression.getText(source).includes("cardPack.includes(cardName)")) branch = node;
	ts.forEachChild(node, visit);
};
visit(source);
assert.ok(branch);
const selectBackground = new Function("cardPack", "cardName", "bg", "get", branch.getText(source));

test("temporary card backgrounds preserve mode-pack and default resource paths", () => {
	const seen = [];
	const bg = { setBackground: value => seen.push(value) };
	const get = { mode: () => "chess" };
	selectBackground(["sha"], "sha", bg, get);
	selectBackground(["sha"], "shan", bg, get);
	selectBackground(undefined, "sha", bg, get);
	selectBackground(["sha"], undefined, bg, get);
	assert.deepEqual(seen, ["mode/chess/card/sha", "card/shan", "card/sha", "card/undefined"]);
});
