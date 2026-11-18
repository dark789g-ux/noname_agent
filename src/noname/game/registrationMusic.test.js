import { getTestText } from "../get/testing/testSource.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { requireRegisteredSkill } from "../library/skillRegistry.js";
import { gameTestSource } from "./testSource.js";

function methodBody(path, className, methodName) {
	const source = path === "./index.js" ? gameTestSource() : ts.createSourceFile(path, path === "../get/index.js" ? getTestText() : readFileSync(new URL(path, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === className);
	const method = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === methodName);
	assert.ok(method);
	return method.body.getText(source);
}

test("finishCards initializes cards then ordinary skills, excluding only registry metadata", () => {
	const lib = {
		card: { sha: {}, shan: {} },
		skill: { global: ["sample"], globalmap: {}, storage: {}, undist: {}, land_used: {}, sample: {} },
	};
	const status = {};
	const calls = [];
	const game = {
		finishCard(name) {
			calls.push(["card", name]);
		},
		finishSkill(name) {
			requireRegisteredSkill(lib.skill, name);
			calls.push(["skill", name]);
		},
	};
	const finish = new Function("lib", "game", "_status", `return function() ${methodBody("./index.js", "Game", "finishCards")}`)(lib, game, status);
	finish();
	assert.equal(status.cardsFinished, true);
	assert.deepEqual(calls, [
		["card", "sha"],
		["card", "shan"],
		["skill", "storage"],
		["skill", "undist"],
		["skill", "land_used"],
		["skill", "sample"],
	]);
});

test("extension character registration normalizes once and preserves the legacy pack tuple", () => {
	let constructions = 0;
	class Character {
		constructor(data) {
			constructions++;
			this.input = data;
		}
	}
	const lib = { element: { Character }, characterPack: {}, translate: {} };
	const get = {};
	get.convertedCharacter = new Function("lib", `return function(data) ${methodBody("../get/index.js", "Get", "convertedCharacter")}`)(lib);
	lib.character = new Proxy({}, { set: (target, key, value) => Reflect.set(target, key, get.convertedCharacter(value)) });
	const status = { extension: "sample", evaluatingExtension: false };
	const register = new Function("lib", "get", "_status", `return function(name, information) ${methodBody("./index.js", "Game", "addCharacter")}`)(lib, get, status);
	const skills = ["sample_skill"];
	register("hero", { extension: "fallback", sex: "male", group: "wei", hp: 4, skills, tags: ["zhu"], translate: "武将" });
	const tuple = lib.characterPack.sample.hero;
	assert.equal(constructions, 1);
	assert.ok(lib.character.hero instanceof Character);
	assert.equal(lib.character.hero.input, tuple);
	assert.equal(tuple[3], skills);
	assert.deepEqual(tuple[4], ["ext:sample/hero.jpg", "die:ext:sample/hero.mp3", "zhu"]);
	assert.equal(lib.translate.hero, "武将");
	assert.equal(lib.translate.sample_character_config, "sample");
	status.evaluatingExtension = true;
	register("second", { extension: "fallback", sex: "female", group: "shu", hp: 3, translate: "副将" });
	assert.equal(constructions, 2);
	assert.deepEqual(lib.characterPack.sample.second[3], []);
	assert.equal(lib.characterPack.sample.second[4][0], "db:extension-sample:second.jpg");
});

test("random aozhan music excludes the previous string without changing the first-play pool", () => {
	const original = Object.getOwnPropertyDescriptor(Array.prototype, "randomGet");
	const pools = [];
	Object.defineProperty(Array.prototype, "randomGet", {
		configurable: true,
		value(...excluded) {
			const pool = this.filter(value => !excluded.includes(value));
			pools.push(pool);
			return pool[0];
		},
	});
	try {
		const lib = { config: { background_music: "music_random", mode_config: { guozhan: { aozhan_bgm: "random" } } }, mode: { guozhan: { config: { aozhan_bgm: { item: { disabled: "", random: "", one: "", two: "" } } } } }, assetURL: "/" };
		const status = { _aozhan: true };
		const ui = { backgroundMusic: { src: "" } };
		const play = new Function("lib", "ui", "_status", `return function() ${methodBody("./index.js", "Game", "playBackgroundMusic")}`)(lib, ui, status);
		play();
		assert.deepEqual(pools[0], ["one", "two"]);
		assert.equal(status.currentAozhan, "one");
		assert.equal(ui.backgroundMusic.src, "/audio/background/aozhan_one.mp3");
		play();
		assert.deepEqual(pools[1], ["two"]);
		assert.equal(status.currentAozhan, "two");
		assert.equal(ui.backgroundMusic.src, "/audio/background/aozhan_two.mp3");
	} finally {
		if (original) Object.defineProperty(Array.prototype, "randomGet", original);
		else delete Array.prototype.randomGet;
	}
});
