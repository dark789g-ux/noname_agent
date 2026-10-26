import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import ts from "typescript";

const source = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

function loadCallback(name, dependencies) {
	let callback;
	const visit = node => {
		if (ts.isPropertyAssignment(node) && node.name.getText(source) === name && ts.isObjectLiteralExpression(node.initializer)) {
			callback = node.initializer.properties.find(member => member.name?.getText(source) === "onblur");
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	assert.ok(callback, name);
	const expression = ts.isMethodDeclaration(callback) ? `function() ${callback.body.getText(source)}` : callback.initializer.getText(source);
	return new Function(...Object.keys(dependencies), `return (${expression});`)(...Object.values(dependencies));
}

test("LLM menu blur callbacks receive their editable div and preserve numeric bounds", () => {
	const dom = new JSDOM();
	const saved = [];
	const game = { saveConfig: (...args) => saved.push(args) };
	for (const [name, initial, expected] of [
		["llm_decision_timeout", "4", "60"],
		["llm_decision_timeout", "900", "300"],
		["llm_timeout", "bad", "30"],
		["llm_timeout", "25", "25"],
	]) {
		const input = dom.window.document.createElement("div");
		input.innerHTML = initial;
		input.onblur = loadCallback(name, { game });
		input.dispatchEvent(new dom.window.FocusEvent("blur"));
		assert.equal(input.innerHTML, expected);
		assert.deepEqual(saved.at(-1), [name, Number(expected)]);
	}
	dom.window.close();
});

test("LLM string menu blur callbacks preserve saved text after br removal", () => {
	const dom = new JSDOM();
	const saved = [];
	const game = { saveConfig: (...args) => saved.push(args) };
	for (const name of ["llm_url", "llm_apikey", "llm_model"]) {
		const input = dom.window.document.createElement("div");
		input.innerHTML = "sample<br>value";
		input.onblur = loadCallback(name, { game });
		input.dispatchEvent(new dom.window.FocusEvent("blur"));
		assert.deepEqual(saved.at(-1), [name, "samplevalue"]);
	}
	dom.window.close();
});

test("avatar blur keeps DOM receiver and both local and connection configuration writes", () => {
	const dom = new JSDOM();
	const saved = [];
	const game = { saveConfig: (...args) => saved.push(args) };
	const lib = { character: { caocao: {} }, translate: { caocao: "曹操" }, config: {} };
	const input = dom.window.document.createElement("div");
	input.innerHTML = "曹";
	input.onblur = loadCallback("connect_avatar", { game, lib });
	input.dispatchEvent(new dom.window.FocusEvent("blur"));
	assert.equal(input.innerHTML, "曹操");
	assert.deepEqual(saved, [
		["connect_avatar", "caocao"],
		["connect_avatar", "caocao", "connect"],
	]);
	dom.window.close();
});
