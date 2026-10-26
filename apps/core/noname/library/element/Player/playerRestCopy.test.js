import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const sourceText = readFileSync(new URL("../player.js", import.meta.url), "utf8");
const sourceFile = ts.createSourceFile("player.js", sourceText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);

function getPlayerMethod(name) {
	for (const statement of sourceFile.statements) {
		if (!ts.isClassDeclaration(statement) || statement.name?.text !== "Player") {
			continue;
		}
		const method = statement.members.find(member => ts.isMethodDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === name);
		assert.ok(method, `Player.${name} should exist`);
		return method;
	}
	assert.fail("Player should exist");
}

function loadPlayerMethod(name, dependencies) {
	const method = getPlayerMethod(name);
	const parameters = method.parameters.map(parameter => parameter.getText(sourceFile)).join(", ");
	const javascript = ts.transpileModule(`function ${name}(${parameters}) ${method.body.getText(sourceFile)}`, {
		compilerOptions: { target: ts.ScriptTarget.ESNext },
	}).outputText;
	return Function(...Object.keys(dependencies), `${javascript}; return ${name};`)(...Object.values(dependencies));
}

test("isRest keeps short-circuits, cache failures, records, and the undefined playerid key", () => {
	const inaccessibleCache = {};
	Object.defineProperty(inaccessibleCache, "_rest_return", {
		get() {
			throw new Error("cache should not be read");
		},
	});
	const isRestWithoutCacheRead = loadPlayerMethod("isRest", { _status: inaccessibleCache });
	assert.equal(isRestWithoutCacheRead.call({ isAlive: () => false, isOut: () => assert.fail("isOut should not run") }), false);
	assert.equal(isRestWithoutCacheRead.call({ isAlive: () => true, isOut: () => false }), false);

	const isRestWithMissingCache = loadPlayerMethod("isRest", { _status: {} });
	assert.throws(() => isRestWithMissingCache.call({ isAlive: () => true, isOut: () => true }), TypeError);

	const record = { type: "phase", count: 2 };
	const isRest = loadPlayerMethod("isRest", { _status: { _rest_return: { player: record, undefined: record } } });
	assert.equal(isRest.call({ playerid: "player", isAlive: () => true, isOut: () => true }), record);
	assert.equal(isRest.call({ playerid: undefined, isAlive: () => true, isOut: () => true }), record);
	assert.equal(isRest.call({ playerid: "missing", isAlive: () => true, isOut: () => true }), undefined);
});

test("chooseCardOL copies all card-choice parameters except list without mutating the input", () => {
	const created = [];
	const chooseCardOL = loadPlayerMethod("chooseCardOL", {
		game: {
			createEvent(name) {
				const event = {
					name,
					setContent(content) {
						this.content = content;
					},
				};
				created.push(event);
				return event;
			},
		},
		get: { is: { object: () => true }, itemtype: () => null },
	});
	const list = [{ playerid: "a" }];
	const params = { list, prompt: "choose", forced: true, custom: "kept" };
	const next = chooseCardOL.call({}, params);

	assert.equal(created.length, 1);
	assert.equal(next.name, "chooseCardOL");
	assert.equal(next.content, "chooseCardOL");
	assert.equal(next.list, list);
	assert.deepEqual(next._args, [{ prompt: "choose", forced: true, custom: "kept", glow_result: true }]);
	assert.deepEqual(params, { list, prompt: "choose", forced: true, custom: "kept" });
	assert.equal(Object.hasOwn(next._args[0], "list"), false);
});
