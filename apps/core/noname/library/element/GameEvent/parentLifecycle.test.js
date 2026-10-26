import { gameEventTestSource } from "./testSource.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = gameEventTestSource();
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "GameEvent");
assert.ok(declaration);
const javascript = ts.transpileModule(declaration.getText(source).replace(/^export\s+/, ""), { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;

function harness() {
	const history = [];
	const stack = [];
	const manager = { setStatusEvent: event => stack.push(event), popStatusEvent: () => stack.pop() };
	const game = { online: false, globalEventHandlers: { addHandlerToEvent() {} }, getGlobalHistory: () => history };
	const GameEvent = new Function("game", "_status", `${javascript}; return GameEvent;`)(game, { eventManager: manager });
	return { GameEvent, game, history, stack, manager };
}

test("each event initializes its own child list and start records queued children exactly once", async () => {
	const { GameEvent, history, stack, manager } = harness();
	const parent = new GameEvent("parent", false);
	const child = new GameEvent("child", false);
	assert.deepEqual(parent.childEvents, []);
	assert.deepEqual(child.childEvents, []);
	assert.notEqual(parent.childEvents, child.childEvents);
	assert.equal(parent.manager, manager);
	parent.next.push(child);
	assert.equal(child.parent, parent);
	child.loop = async () => {};
	await child.start();
	await child.start();
	assert.deepEqual(parent.childEvents, [child]);
	assert.deepEqual(history, [child]);
	assert.deepEqual(stack, []);
});

test("getParent preserves numeric, named, predicate and includeSelf search", () => {
	const { GameEvent } = harness();
	const root = new GameEvent("root");
	const middle = new GameEvent("middle");
	const leaf = new GameEvent("leaf");
	root.next.push(middle);
	middle.next.push(leaf);
	assert.equal(leaf.getParent(), middle);
	assert.equal(leaf.getParent(2), root);
	assert.equal(leaf.getParent("root"), root);
	assert.equal(leaf.getParent(event => event.name === "middle"), middle);
	assert.equal(leaf.getParent("leaf", false, true), leaf);
	assert.deepEqual(leaf.getParent("leaf"), {});
	assert.deepEqual(leaf.getParent(0), {});
	assert.equal(leaf.getParent("missing", true), undefined);
	const empty = leaf.getParent("missing");
	assert.deepEqual(empty, {});
	assert.equal(Object.getPrototypeOf(empty), Object.prototype);
	assert.notEqual(empty, leaf.getParent("missing"));
});

test("online mod-parent priority and cyclic parent termination retain the original fallback", () => {
	const { GameEvent, game } = harness();
	const parent = new GameEvent("parent");
	const remote = new GameEvent("remote");
	const child = new GameEvent("child");
	parent.next.push(child);
	child._modparent = remote;
	assert.equal(child.getParent(), parent);
	game.online = true;
	assert.equal(child.getParent(), remote);
	game.online = false;
	parent.parent = child;
	assert.deepEqual(child.getParent("missing"), {});
	assert.equal(child.getParent("missing", true), undefined);
	assert.equal(child.getParent(event => event === parent), parent);
});
