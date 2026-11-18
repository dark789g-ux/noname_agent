import { config } from "./testing/fixtures.mjs";
import assert from "node:assert/strict";

import test from "node:test";
import { JSDOM } from "jsdom";

import { saveLLMTextInput } from "../llm/config-input.js";

function loadCallback(name, dependencies) {
	return config(name, dependencies).onblur;
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

test("LLM string menu blur callbacks save plain text without pasted markup", () => {
	const dom = new JSDOM();
	const saved = [];
	const game = { saveConfig: (...args) => saved.push(args) };
	for (const [name, value] of [
		["llm_url", "https://example.invalid/v1"],
		["llm_apikey", "samplevalue"],
		["llm_model", "samplevalue"],
	]) {
		const input = dom.window.document.createElement("div");
		input.innerHTML = `<span>${value}</span><br>`;
		input.onblur = loadCallback(name, { game, saveLLMTextInput });
		input.dispatchEvent(new dom.window.FocusEvent("blur"));
		assert.deepEqual(saved.at(-1), [name, value]);
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
