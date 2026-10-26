import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("index.ts", readFileSync(new URL("./index.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const clickDeclaration = source.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === "clickContainer");
assert.ok(clickDeclaration);

function createClickContainer(menuBridge: object, status: object, ui: object, game: object) {
	const compiled = ts.transpileModule(clickDeclaration.getText(source), {
		compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
	}).outputText;
	return new Function("menuBridge", "_status", "ui", "game", `${compiled}; return clickContainer;`)(menuBridge, status, ui, game);
}

function classList() {
	const calls: string[] = [];
	return {
		calls,
		add(name: string) {
			calls.push(`add:${name}`);
		},
		remove(name: string) {
			calls.push(`remove:${name}`);
		},
	};
}

function runtime() {
	const bridge = { clears: 0, clearOptionsMenuState() { this.clears++; } };
	const status = { enteringroom: true, creatingroom: true };
	const ui = {
		window: { classList: classList() },
		arena: { classList: classList() },
		historybar: { classList: classList() },
		config2: { classList: classList() },
	};
	const game = { resumed: 0, resume2() { this.resumed++; }, onresume2() { this.resumed += 10; } };
	const container = { classList: classList() };
	return { bridge, click: createClickContainer(bridge, status, ui, game), container, game, status, ui };
}

test("ordinary menu close clears import state without changing the existing resume path", () => {
	const value = runtime();
	value.click(value.container, false);
	assert.equal(value.bridge.clears, 1);
	assert.equal(value.game.resumed, 11);
	assert.deepEqual(value.container.classList.calls, ["add:hidden"]);
	assert.deepEqual(value.ui.window.classList.calls, ["remove:touchinfohidden"]);
});

test("online menu close clears import state and preserves room cleanup", () => {
	const value = runtime();
	value.click(value.container, true);
	assert.equal(value.bridge.clears, 1);
	assert.equal(value.status.enteringroom, false);
	assert.equal(value.status.creatingroom, false);
	assert.equal(value.game.resumed, 0);
	assert.deepEqual(value.ui.window.classList.calls, ["remove:shortcutpaused"]);
});
