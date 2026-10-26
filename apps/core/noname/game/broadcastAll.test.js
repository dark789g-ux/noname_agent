import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const file = new URL("./GameBroadcast.ts", import.meta.url);
const source = readFileSync(file, "utf8");

function loadGameBroadcast(game, lib) {
	const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText;
	const exports = {};
	new Function("require", "exports", output)(specifier => {
		if (specifier === "noname") {
			return { game, lib };
		}
		throw new Error(`Unexpected import: ${specifier}`);
	}, exports);
	return exports.GameBroadcast;
}

function getTypeDiagnostics() {
	const fixturePath = fileURLToPath(new URL("../../broadcastAll.type-test.ts", import.meta.url));
	const fixture = [
		'import { Game } from "./dist-types/noname/game/index.js";',
		"declare const game: Game;",
		'game.broadcastAll("cancel", "event-id");',
		'game.broadcastAll("closeDialog", 7);',
		"game.broadcastAll((name: string, count: number) => {}, \"name\", 2);",
		'game.broadcastAll("cancel", 1);',
		"game.broadcastAll((name: string) => {}, 1);",
	].join("\n");
	const options = { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, noEmit: true, skipLibCheck: true, strict: true, target: ts.ScriptTarget.ESNext };
	const host = ts.createCompilerHost(options);
	const getSourceFile = host.getSourceFile.bind(host);
	const fileExists = host.fileExists.bind(host);
	host.fileExists = fileName => resolve(fileName) === fixturePath || fileExists(fileName);
	host.getSourceFile = (fileName, languageVersion) => resolve(fileName) === fixturePath ? ts.createSourceFile(fileName, fixture, languageVersion, true) : getSourceFile(fileName, languageVersion);
	const program = ts.createProgram([fixturePath], options, host);
	return ts.getPreEmitDiagnostics(program).filter(diagnostic => diagnostic.file && resolve(diagnostic.file.fileName) === fixturePath);
}

test("联机时不广播也不读取命名处理器", () => {
	let lookedUp = false;
	const client = {};
	Object.defineProperty(client, "cancel", { get: () => ((lookedUp = true), () => {}) });
	const game = { online: true, broadcast: () => assert.fail("online 分支不应广播") };
	const GameBroadcast = loadGameBroadcast(game, { message: { client } });

	new GameBroadcast().broadcastAll("cancel", "event-id");
	assert.equal(lookedUp, false);
});

test("命名调用先广播、再查找处理器，并保持未绑定 receiver", () => {
	const calls = [];
	let receiver = null;
	const handler = function (id) {
		"use strict";
		receiver = this;
		calls.push(["handler", id]);
	};
	const client = {};
	Object.defineProperty(client, "cancel", { get: () => (calls.push(["lookup"]), handler) });
	const game = { online: false, broadcast: (...args) => calls.push(["broadcast", ...args]) };
	const GameBroadcast = loadGameBroadcast(game, { message: { client } });

	new GameBroadcast().broadcastAll("cancel", "event-id");
	assert.deepEqual(calls, [["broadcast", "cancel", "event-id"], ["lookup"], ["handler", "event-id"]]);
	assert.equal(receiver, undefined);
});

test("函数回调和解构后的 broadcastAll 都保留参数及未绑定调用", () => {
	const calls = [];
	let receiver = null;
	const callback = function () {
		"use strict";
		receiver = this;
		calls.push(["callback", ...arguments]);
	};
	const game = { online: false, broadcast: (...args) => calls.push(["broadcast", ...args]) };
	const GameBroadcast = loadGameBroadcast(game, { message: { client: {} } });
	const { broadcastAll } = new GameBroadcast();

	broadcastAll(callback, "first", 2);
	assert.deepEqual(calls, [["broadcast", callback, "first", 2], ["callback", "first", 2]]);
	assert.equal(receiver, undefined);
});

test("生成声明拒绝错误的命名和回调参数", () => {
	assert.equal(getTypeDiagnostics().length, 2);
});
