import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

function loadThemeClick(game) {
	let callback;
	const visit = node => {
		if (ts.isPropertyAssignment(node) && node.name.getText(source) === "zhishixian" && ts.isObjectLiteralExpression(node.initializer)) {
			callback = node.initializer.properties.find(member => member.name?.getText(source) === "onclick");
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	assert.ok(callback && ts.isMethodDeclaration(callback));
	return new Function("game", `return function(items) ${callback.body.getText(source)}`)(game);
}

test("line theme changes preserve the initialized original function and theme identity", () => {
	const saved = [];
	const original = () => {};
	const theme = () => {};
	const game = { linexy: original, zsOriginLineXy: original, zsMohuaLineXy: theme, saveConfig: (...args) => saved.push(args) };
	const click = loadThemeClick(game);
	click("Mohua");
	assert.equal(game.linexy, theme);
	click("default");
	assert.equal(game.linexy, original);
	assert.deepEqual(saved, [
		["zhishixian", "Mohua"],
		["zhishixian", "default"],
	]);
});

test("default line theme requires initialization instead of replacing the renderer with undefined", () => {
	const original = () => {};
	const saved = [];
	const game = { linexy: original, saveConfig: (...args) => saved.push(args) };
	assert.throws(() => loadThemeClick(game)("default"), TypeError);
	assert.equal(game.linexy, original);
	assert.deepEqual(saved, [["zhishixian", "default"]]);
});
