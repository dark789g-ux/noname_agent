import assert from "node:assert/strict";
import test from "node:test";
import { getCharacterRubyText, resolveCharacterRubyDisplay } from "./charactercard/rubyText.js";

test("缺少名称翻译时回退代码且不调用拼音库", () => {
	const result = getCharacterRubyText("missing_character", undefined, undefined, "showPinyin", () => {
		throw new Error("pinyin should not be called");
	});
	assert.deepEqual(result, { characterName: "missing_character", characterReading: "missing_character" });
});

test("实际调用链在翻译缺失时不把 rawName2 的空串当作名称", () => {
	const get = {
		rawName2() {
			throw new Error("missing translations must not call rawName2");
		},
		pinyin() {
			throw new Error("missing translations must not call pinyin");
		},
	};
	assert.deepEqual(resolveCharacterRubyDisplay({}, "missing_character", { translate: {} }, get, "showPinyin", getCharacterRubyText), {
		rawCharacterName: undefined,
		characterName: "missing_character",
		characterReading: "missing_character",
	});
});

test("实际调用链保留已定义空翻译的既有语义", () => {
	let rawName2Calls = 0;
	const get = {
		rawName2() {
			rawName2Calls++;
			return "";
		},
		pinyin(value) {
			assert.equal(value, "");
			return [];
		},
	};
	const result = resolveCharacterRubyDisplay({}, "empty_character", { translate: { empty_character: "" } }, get, "showPinyin", getCharacterRubyText);
	assert.equal(rawName2Calls, 1);
	assert.deepEqual(result, { rawCharacterName: "", characterName: "", characterReading: "" });
});

test("显式 _rt 在拼音模式优先于自动拼音", () => {
	const result = getCharacterRubyText("character", "角色", "jue se", "showPinyin", () => {
		throw new Error("pinyin should not be called");
	});
	assert.deepEqual(result, { characterName: "角色", characterReading: "jue se" });
});

test("缺少名称时仍可使用显式 _rt，空字符串名称保持原有拼音路径", () => {
	assert.deepEqual(
		getCharacterRubyText("missing_character", undefined, "missing", "showPinyin", () => {
			throw new Error("pinyin should not be called");
		}),
		{ characterName: "missing_character", characterReading: "missing" }
	);
	assert.deepEqual(
		getCharacterRubyText("character", "", undefined, "showPinyin", value => {
			assert.equal(value, "");
			return [];
		}),
		{ characterName: "", characterReading: "" }
	);
});

test("有效名称保留自动拼音，代码显示模式不调用拼音库", () => {
	let calls = 0;
	assert.deepEqual(
		getCharacterRubyText("character", "角色", undefined, "showPinyin", value => {
			calls++;
			assert.equal(value, "角色");
			return ["jue", "se"];
		}),
		{ characterName: "角色", characterReading: "jue se" }
	);
	assert.equal(calls, 1);
	assert.deepEqual(
		getCharacterRubyText("character", "角色", "jue se", "showCodeIdentifier", () => {
			throw new Error("pinyin should not be called");
		}),
		{ characterName: "角色", characterReading: "character" }
	);
});
