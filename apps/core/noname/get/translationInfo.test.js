import { getTestText } from "./testing/testSource.ts";
import { loadGet } from "./testing/runtimeFixture.ts";
import { gameTestSource } from "../game/testSource.js";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("index.js", getTestText(), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
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
	const gameSource = gameTestSource();
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

test("card intro rereads translated info after dialog update hooks", async () => {
	const lib = { config: {}, card: { sample: {} }, translate: { sample_info: "before update" } };
	const { module } = await loadGet({ lib, ui: { arena: { classList: { contains: () => false } } } });
	module.get.translation = () => "sample";
	module.get.position = () => "h";
	const rendered = [];
	const dialog = {
		nosub: true,
		setAttribute() {},
		add(html) {
			if (html.startsWith('<div class="text"')) {
				rendered.push(html);
				lib.translate.sample_info = undefined;
			}
			return {};
		},
	};
	const card = { name: "sample", classList: { contains: name => name === "card" }, parentNode: {} };
	assert.throws(
		() => module.get.nodeintro(card, false, undefined, dialog),
		error => error.name === "TypeError" && error.message.includes("card info translation is missing")
	);
	assert.deepEqual(rendered, ['<div class="text" style="display:inline">before update</div>']);
	assert.equal(Object.hasOwn(dialog, "_place_text"), false);
});
