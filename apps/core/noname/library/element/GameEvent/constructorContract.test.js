import { gameEventTestSource } from "./testSource.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = gameEventTestSource();
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "GameEvent");
const constructor = declaration.members.find(ts.isConstructorDeclaration);
const triggered = declaration.members.find(node => ts.isPropertyDeclaration(node) && node.name.getText(source) === "_triggered");
assert.ok(constructor && triggered);
const flagNames = ["addCount", "direct", "visible", "nojudge", "updatePile", "waitingForTransition", "discardTransition", "cardChooseAll", "forceDirect", "_direct", "nodistance", "noai", "nowuxie", "prompt2", "centerprompt2", "chooseonly", "nouse", "norestore"];
const ownFlagNames = ["forceDie", "includeOut"];
const controlFlags = flagNames.map(name => {
	const field = declaration.members.find(node => ts.isPropertyDeclaration(node) && node.name.getText(source) === name);
	assert.ok(field?.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DeclareKeyword), name);
	return field.getText(source);
}).join("\n");
const ownFlags = ownFlagNames.map(name => {
	const field = declaration.members.find(node => ts.isPropertyDeclaration(node) && node.name.getText(source) === name);
	assert.ok(field?.questionToken, name);
	assert.equal(field.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DeclareKeyword) ?? false, false, name);
	return field.getText(source);
}).join("\n");

function harness(online) {
	const registered = [];
	const manager = {};
	const javascript = ts.transpileModule(`class GameEvent { ${controlFlags} ${ownFlags} ${triggered.getText(source)} ${constructor.getText(source)} }`, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
	const game = { online, globalEventHandlers: { addHandlerToEvent(event) { registered.push(event); } } };
	const GameEvent = new Function("game", "_status", `${javascript}; return GameEvent;`)(game, { eventManager: manager });
	return { GameEvent, registered, manager };
}

test("event constructor preserves defaults, explicit trigger state and registration", () => {
	for (const online of [false, true]) {
		const { GameEvent, registered, manager } = harness(online);
		assert.equal(GameEvent.name, "GameEvent");
		const defaultEvent = new GameEvent();
		assert.equal(defaultEvent.name, "");
		assert.equal(defaultEvent.manager, manager);
		assert.equal(defaultEvent._triggered, online ? null : 0);
		for (const name of flagNames) {
			assert.equal(Object.hasOwn(defaultEvent, name), false, name);
			assert.equal(defaultEvent[name], undefined, name);
		}
		for (const name of ownFlagNames) {
			assert.equal(Object.hasOwn(defaultEvent, name), true, name);
			assert.equal(defaultEvent[name], undefined, name);
		}
		const explicitManager = {};
		const inactive = new GameEvent("test", false, explicitManager);
		assert.equal(inactive.name, "test");
		assert.equal(inactive.manager, explicitManager);
		assert.equal(inactive._triggered, null);
		assert.deepEqual(registered, [defaultEvent, inactive]);
	}
});

test("event copy follows the source manager and null/zero/deleted trigger protocol", () => {
	for (const online of [false, true]) {
		for (const state of [null, 0, undefined]) {
			const { GameEvent, registered } = harness(online);
			const sourceManager = {};
			const original = new GameEvent("source", false, sourceManager);
			original.addCount = false;
			original.direct = true;
			original.visible = true;
			original.nojudge = true;
			original.updatePile = true;
			original.waitingForTransition = 123;
			original.discardTransition = true;
			original.cardChooseAll = { close() {} };
			original.forceDie = true;
			original.includeOut = true;
			original.forceDirect = true;
			original._direct = true;
			original.nodistance = true;
			original.noai = true;
			original.nowuxie = true;
			original.prompt2 = "secondary prompt";
			original.centerprompt2 = true;
			original.chooseonly = true;
			original.nouse = true;
			original.norestore = true;
			if (state === undefined) delete original._triggered;
			else original._triggered = state;
			const copied = new GameEvent(original, false, {});
			assert.equal(copied.name, "source");
			assert.equal(copied.manager, sourceManager);
			assert.equal(copied._triggered, !online && state !== null ? 0 : null);
			assert.equal(original._triggered, state);
			for (const name of flagNames) assert.equal(Object.hasOwn(copied, name), false, name);
			for (const name of ownFlagNames) {
				assert.equal(Object.hasOwn(copied, name), true, name);
				assert.equal(copied[name], undefined, name);
				assert.equal(original[name], true, name);
			}
			assert.deepEqual(registered, [original, copied]);
		}
	}
});

test("handler overloads retain zero-argument, default and named argument parsing", () => {
	const method = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === "pushHandler" && node.body);
	const javascript = ts.transpileModule(`function pushHandler(...args) ${method.body.getText(source)}`, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
	const push = new Function(`${javascript}; return pushHandler;`)();
	const handlers = {};
	const event = { getHandler(type) { return handlers[type] ??= []; }, getDefaultHandlerType: () => "onDefault" };
	const first = () => {};
	const second = () => {};
	assert.equal(push.call(event), 0);
	assert.equal(push.call(event, first, second), 2);
	assert.deepEqual(handlers.onDefault, [first, second]);
	assert.equal(push.call(event, "onNamed", second, first), 2);
	assert.deepEqual(handlers.onNamed, [second, first]);
	assert.equal(push.call(event, ...handlers.onNamed), 4);
	assert.deepEqual(handlers.onDefault, [first, second, second, first]);
});
