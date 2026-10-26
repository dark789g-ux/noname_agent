import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function loadAudio() {
	const source = ts.createSourceFile("audio.ts", readFileSync(new URL("./audio.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
	const text = source.statements
		.filter(node => !ts.isImportDeclaration(node))
		.map(node => node.getText(source))
		.join("\n")
		.replace("export class Audio", "class Audio");
	const javascript = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
	const lib = { translate: {}, characterSubstitute: {} };
	const get = { character: () => ({ sex: "male", isNull: true }), convertedCharacter: value => ({ dieAudios: value[4].dieAudios }) };
	return { Audio: new Function("lib", "get", `${javascript}; return Audio;`)(lib, get), lib };
}

test("audio formatting retains an own undefined name after player cleanup", () => {
	const { Audio } = loadAudio();
	const formatted = Audio.formatPlayer({});
	assert.equal(Object.hasOwn(formatted, "name"), true);
	assert.equal(formatted.name, undefined);
	assert.deepEqual(formatted.tempname, []);
	assert.deepEqual(formatted.skin, {});
});

test("death audio preserves undefined concatenation and indexed NaN filenames", () => {
	const { Audio } = loadAudio();
	const unnamed = Audio.die({ player: {}, info: true });
	assert.equal(unnamed.name, undefined);
	assert.deepEqual(unnamed.fileList, ["die/undefined.mp3"]);
	assert.deepEqual(Audio.die({ player: {}, info: 2 }).fileList, ["die/NaN.mp3", "die/NaN.mp3"]);
	assert.deepEqual(Audio.die({ player: "hero", info: 2 }).fileList, ["die/hero1.mp3", "die/hero2.mp3"]);
});

test("death audio skin lookup retains the undefined property key", () => {
	const { Audio, lib } = loadAudio();
	lib.characterSubstitute.undefined = [["skin", { dieAudios: true }]];
	const audio = Audio.die({ player: { skin: { name: "skin" } } });
	assert.equal(audio.name, "skin");
	assert.deepEqual(audio.fileList, ["die/skin.mp3"]);
});
