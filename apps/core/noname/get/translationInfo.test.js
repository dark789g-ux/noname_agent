import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Get");
const method = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === "translation");
assert.ok(method);

function translation(lib) {
	const get = { itemtype: () => undefined };
	get.translation = new Function("get", "lib", "_status", `return function(str, arg) ${method.body.getText(source)}`)(get, lib, {});
	return get.translation;
}

test("info translation preserves a prompt function by identity without invoking it", () => {
	let calls = 0;
	const prompt = () => {
		calls++;
		return "dynamic";
	};
	const lib = { translate: {}, skill: { sample: { prompt } } };
	const translate = translation(lib);
	assert.equal(translate("sample", "info"), prompt);
	assert.equal(translate(["sample"], "info"), prompt);
	assert.equal(translate(["sample", "missing"], "info"), `${prompt}、missing`);
	assert.equal(calls, 0);
	assert.equal(translate("sample"), "sample");
	assert.equal(translate("sample", "skill"), "sample");
});

test("info translation retains existing translated text, fallback keys and text prompts", () => {
	const lib = { translate: { sample_info: "description", parent_info: "parent description" }, skill: { other: { prompt: "static prompt" } } };
	const translate = translation(lib);
	assert.equal(translate("sample", "info"), "description");
	assert.equal(translate("parent_child", "info"), "parent description");
	assert.equal(translate("other", "info"), "static prompt");
	assert.equal(translate("missing", "info"), "missing");
});

test("skill registration preserves explicit undefined translations and existing-entry short circuits", () => {
	const gameSource = ts.createSourceFile("index.js", readFileSync(new URL("../game/index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	const gameClass = gameSource.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Game");
	const addSkill = gameClass.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(gameSource) === "addSkill");
	assert.ok(addSkill);
	const lib = { skill: {}, translate: { sample: "old", sample_info: "old info" } };
	const register = new Function("lib", "_status", `"use strict"; return { ${addSkill.getText(gameSource)} }.addSkill;`)(lib, {});
	const info = {};
	assert.equal(register("sample", info), true);
	assert.equal(lib.skill.sample, info);
	for (const key of ["sample", "sample_info", "sample_append", "sample_ab"]) {
		assert.equal(Object.hasOwn(lib.translate, key), true);
		assert.equal(lib.translate[key], undefined);
	}
	assert.equal(translation(lib)("sample"), "sample");
	assert.equal(register("sample", {}, "new"), false);
	assert.equal(lib.translate.sample, undefined);
});

test("card intro rereads translated info after dialog update hooks", () => {
	const intro = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === "nodeintro");
	assert.ok(intro);
	const branches = [];
	function visit(node) {
		if (ts.isIfStatement(node) && node.expression.getText(source) === 'lib.translate[name + "_info"]' && ts.isBlock(node.thenStatement) && node.thenStatement.statements.some(statement => ts.isIfStatement(statement) && statement.expression.getText(source).includes(".startsWith("))) branches.push(node.thenStatement);
		ts.forEachChild(node, visit);
	}
	visit(intro);
	assert.equal(branches.length, 1);
	const render = new Function("lib", "uiintro", "name", `"use strict"; ${branches[0].getText(source)}`);
	const lib = { translate: { sample_info: "before update" } };
	const rendered = [];
	const dialog = {
		add(html) {
			rendered.push(html);
			lib.translate.sample_info = undefined;
			return {};
		},
	};
	assert.throws(() => render(lib, dialog, "sample"), TypeError);
	assert.deepEqual(rendered, ['<div class="text" style="display:inline">before update</div>']);
	assert.equal(Object.hasOwn(dialog, "_place_text"), false);
});
