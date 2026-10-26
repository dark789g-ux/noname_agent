import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("promises.js", readFileSync(new URL("./promises.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "GamePromises");
assert.ok(declaration);

function loadMethod(name, game) {
	const method = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === name);
	assert.ok(method);
	const params = method.parameters.map(node => node.getText(source)).join(",");
	return new Function("game", `return function(${params}) ${method.body.getText(source)}`)(game);
}

test("removeFile preserves callback error rejection and void success", async () => {
	let callback;
	const game = {
		removeFile(filename, done) {
			assert.equal(this, game);
			assert.equal(filename, "sample.dat");
			callback = done;
		},
	};
	const removeFile = loadMethod("removeFile", game);
	const success = removeFile("sample.dat");
	callback();
	assert.equal(await success, undefined);
	const failure = removeFile("sample.dat");
	const error = new Error("file failure");
	callback(error);
	await assert.rejects(failure, value => value === error);
	delete game.removeFile;
	await assert.rejects(removeFile("sample.dat"), TypeError);
});

test("removeDir keeps the platform resolve and reject callbacks", async () => {
	let complete, fail;
	const game = {
		removeDir(directory, resolve, reject) {
			assert.equal(this, game);
			assert.equal(directory, "sample");
			complete = resolve;
			fail = reject;
		},
	};
	const removeDir = loadMethod("removeDir", game);
	const success = removeDir("sample");
	complete();
	assert.equal(await success, undefined);
	const failure = removeDir("sample");
	const error = new Error("directory failure");
	fail(error);
	await assert.rejects(failure, value => value === error);
	delete game.removeDir;
	await assert.rejects(removeDir("sample"), TypeError);
});
