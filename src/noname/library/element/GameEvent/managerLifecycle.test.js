import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("GameEventManager.ts", readFileSync(new URL("./GameEventManager.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "GameEventManager");
assert.ok(declaration);
const javascript = ts.transpileModule(declaration.getText(source).replace(/^export\s+default\s+/, ""), { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;

function harness() {
	const published = [];
	class GameEvent {}
	const lib = { announce: { publish(name, args) { published.push([name, args]); } } };
	const GameEventManager = new Function("lib", "GameEvent", `${javascript}; return GameEventManager;`)(lib, GameEvent);
	return { GameEvent, GameEventManager, published };
}

test("GameEventManager publishes an undefined old event for the first status event", () => {
	const { GameEvent, GameEventManager, published } = harness();
	const manager = new GameEventManager();
	const first = new GameEvent();

	manager.setStatusEvent(first);

	assert.deepEqual(published, [["Noname.Game.Event.Changed", [first, undefined]]]);
});

test("GameEventManager preserves the empty-stack Changed payload", () => {
	const { GameEventManager, published } = harness();
	const manager = new GameEventManager();

	manager.popStatusEvent();

	assert.deepEqual(published, [["Noname.Game.Event.Changed", [undefined, undefined]]]);
});
