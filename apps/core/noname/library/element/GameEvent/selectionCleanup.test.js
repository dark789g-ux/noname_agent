import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function sourceFile(relative) {
	return ts.createSourceFile(relative, readFileSync(new URL(relative, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
}

function findNode(source, predicate) {
	let found;
	function visit(node) {
		if (predicate(node)) found ??= node;
		ts.forEachChild(node, visit);
	}
	visit(source);
	assert.ok(found);
	return found;
}

test("choose-all cleanup closes the actual control and removes the event field", () => {
	const source = sourceFile("../../hooks/index.ts");
	const hook = findNode(source, node => ts.isFunctionExpression(node) && node.name?.text === "destroyChooseAll");
	const javascript = ts.transpileModule(hook.getText(source), { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
	let closed = 0;
	class Control { close() { closed++; } }
	const lib = { config: { choose_all_button: true }, element: { Control } };
	const cleanup = new Function("lib", `return (${javascript.replace(/;\s*$/, "")});`)(lib);
	const control = new Control();
	const event = { name: "chooseToUse", cardChooseAll: control };
	cleanup(event);
	assert.equal(closed, 1);
	assert.equal(Object.hasOwn(event, "cardChooseAll"), false);
	cleanup(event);
	assert.equal(closed, 1);
	for (const enabled of [false, true]) {
		lib.config.choose_all_button = enabled;
		const unrelated = { name: enabled ? "chooseCard" : "chooseToUse", cardChooseAll: control };
		cleanup(unrelated);
		assert.equal(unrelated.cardChooseAll, control);
		assert.equal(closed, 1);
	}
});

test("card transition cleanup preserves resume gating and removes the timestamp", () => {
	const source = sourceFile("../content.ts");
	const callback = findNode(source, node => ts.isArrowFunction(node) && ts.isCallExpression(node.parent) && node.parent.expression.getText(source).endsWith(".listenTransition") && node.body.getText(source).includes("delete event.waitingForTransition"));
	for (const [matches, paused] of [[true, true], [true, false], [false, true]]) {
		const event = { waitingForTransition: 123 };
		const status = { waitingForTransition: matches ? 123 : 456, paused };
		let resumed = 0;
		const cleanup = new Function("event", "_status", "game", "waitingForTransition", `return (${callback.getText(source)});`)(event, status, { resume() { resumed++; } }, 123);
		cleanup();
		assert.equal(resumed, matches && paused ? 1 : 0);
		assert.equal(Object.hasOwn(event, "waitingForTransition"), false);
	}
});

test("parent transition cleanup re-reads the parent after an asynchronous change", () => {
	const source = sourceFile("../content.ts");
	const branch = findNode(source, node => ts.isIfStatement(node) && node.expression.getText(source) === "parent?.discardTransition");
	for (const hasCurrentParent of [true, false]) {
		const oldParent = { discardTransition: true };
		const currentParent = hasCurrentParent ? { waitingForTransition: 123 } : undefined;
		let reads = 0;
		const event = { getParent(...args) { reads++; assert.deepEqual(args, [undefined, true]); return currentParent; } };
		let resumed = 0;
		let cleanup;
		const cards = [{ clone: { listenTransition(callback) { cleanup = callback; } } }];
		const prepare = new Function("parent", "evt", "cards", "get", "_status", "game", branch.thenStatement.getText(source));
		prepare(oldParent, event, cards, { time: () => 123 }, { waitingForTransition: 123, paused: true }, { resume() { resumed++; } });
		assert.equal(Object.hasOwn(oldParent, "discardTransition"), false);
		assert.equal(oldParent.waitingForTransition, 123);
		assert.equal(reads, 0);
		assert.equal(typeof cleanup, "function");
		cleanup();
		assert.equal(reads, 1);
		assert.equal(resumed, 1);
		assert.equal(oldParent.waitingForTransition, 123);
		if (currentParent) assert.equal(Object.hasOwn(currentParent, "waitingForTransition"), false);
	}
});
