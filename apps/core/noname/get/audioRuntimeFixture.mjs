import assert from "node:assert/strict";
import console from "node:console";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";

const lib = { translate: {}, characterSubstitute: {} };
const get = { character: () => ({ sex: "male", isNull: true }), convertedCharacter: value => ({ dieAudios: value[4].dieAudios }) };
const context = createContext({ console });
const globals = new SyntheticModule(
	["lib", "get"],
	function () {
		this.setExport("lib", lib);
		this.setExport("get", get);
	},
	{ context }
);
const path = fileURLToPath(new URL("./audio.ts", import.meta.url));
const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
const entry = new SourceTextModule(code, { context, identifier: path });
await entry.link(specifier => {
	assert.equal(specifier, "noname", "type-only contracts must not become runtime imports");
	return globals;
});
await entry.evaluate();
const Audio = entry.namespace.Audio;
const formatted = Audio.formatPlayer({});
assert.equal(Object.hasOwn(formatted, "name"), true);
assert.equal(formatted.name, undefined);
assert.deepEqual(Array.from(formatted.tempname), []);
const unnamed = Audio.die({ player: {}, info: true });
assert.equal(Object.getPrototypeOf(unnamed), Audio.prototype);
assert.equal(unnamed.name, undefined);
assert.deepEqual(Array.from(unnamed.fileList), ["die/undefined.mp3"]);
assert.deepEqual(Array.from(Audio.die({ player: {}, info: 2 }).fileList), ["die/NaN.mp3", "die/NaN.mp3"]);
assert.deepEqual(Array.from(Audio.die({ player: "hero", info: 2 }).fileList), ["die/hero1.mp3", "die/hero2.mp3"]);
lib.characterSubstitute.undefined = [["skin", { dieAudios: true }]];
const skinned = Audio.die({ player: { skin: { name: "skin" } } });
assert.equal(skinned.name, "skin");
assert.deepEqual(Array.from(skinned.fileList), ["die/skin.mp3"]);
const copiedList = unnamed.audioList;
copiedList[0].file = "changed";
assert.deepEqual(Array.from(unnamed.fileList), ["die/undefined.mp3"]);
assert.throws(() => Audio.prototype.initAudioList.call({}), /private|brand|class/i);
console.log("real audio module: original class, private state, undefined names, NaN indices, skin and list copies verified");
