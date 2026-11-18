import { gameEventTestSource } from "./testSource.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = gameEventTestSource();
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "GameEvent");
const getHandler = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === "getHandler");
const hasHandler = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === "hasHandler");
assert.ok(getHandler && hasHandler);

function createGetHandler() {
	const javascript = ts.transpileModule(`function getHandler(type) ${getHandler.body.getText(source)}`, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
	return new Function(`${javascript}; return getHandler;`)();
}

function createHasHandler() {
	const javascript = ts.transpileModule(`function hasHandler(type) ${hasHandler.body.getText(source)}`, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
	return new Function("Reflect", `${javascript}; return hasHandler;`)(Reflect);
}

test("getHandler returns the final accessor value after normalization", () => {
	const get = createGetHandler();
	const original = () => {};
	const replacement = () => {};
	let stored = original;
	let reads = 0;
	const event = {
		name: "phaseUse",
		getDefaultHandlerType() {
			return "onPhaseUse";
		},
	};
	Object.defineProperty(event, "onPhaseUse", {
		configurable: true,
		get() {
			reads++;
			return stored;
		},
		set(value) {
			assert.deepEqual(value, [original]);
			stored = [replacement];
		},
	});

	const handlers = get.call(event);
	assert.equal(reads, 2);
	assert.deepEqual(handlers, [replacement]);
});

test("getHandler fails when a legacy handler slot rejects normalization", () => {
	const get = createGetHandler();
	const event = Object.preventExtensions({
		name: "phaseUse",
		getDefaultHandlerType() {
			return "onPhaseUse";
		},
	});
	assert.throws(() => get.call(event), TypeError);
});

test("hasHandler keeps missing and falsy slots observational", () => {
	const has = createHasHandler();
	const missing = {
		getDefaultHandlerType() {
			return "onMissing";
		},
		getHandler() {
			throw new Error("missing handler must not be normalized");
		},
	};
	assert.equal(has.call(missing), false);
	assert.equal(Object.hasOwn(missing, "onMissing"), false);

	let reads = 0;
	let writes = 0;
	const accessor = {
		getDefaultHandlerType() {
			return "onFalsy";
		},
		getHandler() {
			throw new Error("falsy handler must not be normalized");
		},
	};
	Object.defineProperty(accessor, "onFalsy", {
		get() {
			reads++;
			return undefined;
		},
		set() {
			writes++;
		},
	});
	assert.equal(has.call(accessor), false);
	assert.equal(reads, 1);
	assert.equal(writes, 0);
});

test("DOM transition listeners remain a separate event field", () => {
	const onEnd = declaration.members.find(node => ts.isPropertyDeclaration(node) && node.name.getText(source) === "onEnd01");
	assert.ok(onEnd);
	assert.match(onEnd.type.getText(source), /\(\)\s*=>\s*void/);
	assert.equal(source.text.includes("[key: `on${string}`]"), false);
});
