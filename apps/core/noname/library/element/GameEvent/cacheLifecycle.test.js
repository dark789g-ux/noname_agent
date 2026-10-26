import { gameEventTestSource } from "./testSource.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = gameEventTestSource();
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "GameEvent");
assert.ok(declaration);

function getMethod(name) {
	const method = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === name);
	assert.ok(method, `Missing GameEvent.${name}`);
	return method;
}

function compileMethod(name, dependencies = {}) {
	const method = getMethod(name);
	const parameters = method.parameters.map(parameter => parameter.getText(source)).join(", ");
	const javascript = ts.transpileModule(`function ${name}(${parameters}) ${method.body.getText(source)}`, {
		compilerOptions: { target: ts.ScriptTarget.ESNext },
	}).outputText;
	return new Function(...Object.keys(dependencies), `${javascript}; return ${name};`)(...Object.values(dependencies));
}

function createCacheEvent(status = { closeStepCache: false }) {
	const get = { paramToCacheKey: (...params) => JSON.stringify(params) };
	const event = {};
	event.putStepCache = compileMethod("putStepCache");
	event.getStepCache = compileMethod("getStepCache");
	event.clearStepCache = compileMethod("clearStepCache");
	event.callFuncUseStepCache = compileMethod("callFuncUseStepCache", { _status: status, get });
	event.putTempCache = compileMethod("putTempCache");
	event.getTempCache = compileMethod("getTempCache");
	return event;
}

test("step cache preserves falsy values and reuses only non-null results", () => {
	const event = createCacheEvent();
	assert.equal(event.getStepCache("missing"), undefined);
	event.putStepCache("zero", 0).putStepCache("false", false).putStepCache("empty", "");
	assert.equal(event.getStepCache("zero"), 0);
	assert.equal(event.getStepCache("false"), false);
	assert.equal(event.getStepCache("empty"), "");

	let calls = 0;
	const cached = () => ++calls;
	assert.equal(event.callFuncUseStepCache("value", cached, ["one"]), 1);
	assert.equal(event.callFuncUseStepCache("value", cached, ["one"]), 1);
	assert.equal(calls, 1);

	let nullCalls = 0;
	const returnsNull = () => {
		nullCalls++;
		return null;
	};
	event.callFuncUseStepCache("null", returnsNull, []);
	event.callFuncUseStepCache("null", returnsNull, []);
	assert.equal(nullCalls, 2);
});

test("step cache bypass and clearing keep the existing lifecycle failures", () => {
	const bypass = createCacheEvent({ closeStepCache: true });
	let calls = 0;
	const value = () => ++calls;
	assert.equal(bypass.callFuncUseStepCache("bypass", value, []), 1);
	assert.equal(bypass.callFuncUseStepCache("bypass", value, []), 2);
	assert.equal(bypass._stepCache, undefined);

	const event = createCacheEvent();
	assert.equal(event.clearStepCache(), event);
	assert.throws(() => event.clearStepCache("missing"), TypeError);
	event.putStepCache("remove", 1).putStepCache("keep", 2);
	event.clearStepCache("remove");
	assert.equal(event.getStepCache("remove"), undefined);
	assert.equal(event.getStepCache("keep"), undefined);
});

test("temporary cache keeps distinct string-keyed entries", () => {
	const event = createCacheEvent();
	const value = { score: 1 };
	assert.equal(event.putTempCache("ai", "first", value), value);
	event.putTempCache("ai", "second", false);
	event.putTempCache("other", "first", 0);
	assert.equal(event.getTempCache("ai", "first"), value);
	assert.equal(event.getTempCache("ai", "second"), false);
	assert.equal(event.getTempCache("other", "first"), 0);
	assert.equal(event.getTempCache("missing", "first"), undefined);
});

test("logvid and caches are type-only optional lifecycle fields", () => {
	for (const name of ["logvid", "_stepCache", "_tempCache"]) {
		const field = declaration.members.find(node => ts.isPropertyDeclaration(node) && node.name.getText(source) === name);
		assert.ok(field, `Missing GameEvent.${name}`);
		assert.ok(field.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DeclareKeyword));
		assert.equal(field.initializer, undefined);
	}
	const logvid = declaration.members.find(node => ts.isPropertyDeclaration(node) && node.name.getText(source) === "logvid");
	assert.match(logvid.type.getText(source), /string\s*\|\s*null/);
});
