import { gameEventTestSource } from "./testSource.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = gameEventTestSource();
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "GameEvent");
assert.ok(declaration);

for (const [methodName, field, value] of [
	["getPlayer", "player", { id: "player" }],
	["getTarget", "target", { id: "target" }],
	["getPlayers", "players", []],
	["getTargets", "targets", []],
]) {
	test(`${methodName} requires its actual field and rereads it without copying or defaults`, () => {
		const method = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === methodName);
		assert.ok(method);
		const javascript = ts.transpileModule(`class EventFields { ${method.getText(source)} }`, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
		const EventFields = new Function(`${javascript}; return EventFields;`)();
		const event = new EventFields();
		event.name = "test-event";
		assert.throws(() => event[methodName](), /test-event event requires/);
		event[field] = null;
		assert.throws(() => event[methodName](), /test-event event requires/);
		if (field === "target") {
			event.target = "cardPile";
			assert.throws(() => event.getTarget(), /test-event event requires/);
		}
		event[field] = value;
		assert.equal(event[methodName](), value);
		const replacement = Array.isArray(value) ? [{ id: "replacement" }] : { id: "replacement" };
		event[field] = replacement;
		assert.equal(event[methodName](), replacement);
		delete event[field];
		assert.throws(() => event[methodName](), /test-event event requires/);
	});
}
