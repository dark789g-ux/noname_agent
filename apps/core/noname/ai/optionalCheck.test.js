import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const basicText = readFileSync(new URL("./basic.js", import.meta.url), "utf8");
const basicFile = ts.createSourceFile("basic.js", basicText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);

function getMethodBody(name) {
	for (const statement of basicFile.statements) {
		if (!ts.isClassDeclaration(statement) || statement.name?.text !== "Basic") continue;
		const method = statement.members.find(member => ts.isMethodDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === name);
		assert.ok(method?.body, `Basic.${name} should have a body`);
		return method.body.getText(basicFile);
	}
	assert.fail("Basic should exist");
}

function createSelected() {
	const selected = [];
	selected.add = value => selected.push(value);
	return selected;
}

function createChoice(name, event, candidates, steps = []) {
	const selected = {
		buttons: createSelected(),
		cards: createSelected(),
		targets: createSelected(),
	};
	const cacheEvents = [];
	class CacheContext {
		constructor(context) {
			cacheEvents.push(["context", context]);
		}
		static setCacheContext() {
			cacheEvents.push("set");
		}
		static setInCacheEnvironment(value) {
			cacheEvents.push(value);
		}
		static removeCacheContext() {
			cacheEvents.push("remove");
		}
	}
	const get = {
		select(value) {
			return value ?? [1, 1];
		},
		selectableButtons() {
			return candidates;
		},
		selectableCards() {
			return candidates;
		},
		selectableTargets() {
			return candidates;
		},
	};
	const ui = { selected, click: { skill() {} } };
	const game = {
		check() {
			steps.push("game.check");
		},
	};
	const source = ts.transpileModule(`function ${name}(check) ${getMethodBody(name)}`, {
		compilerOptions: { target: ts.ScriptTarget.ESNext },
	}).outputText;
	const choice = Function("CacheContext", "_status", "lib", "game", "get", "ui", `${source}; return ${name};`)(CacheContext, { event }, {}, game, get, ui);
	return { choice, cacheEvents, selected };
}

function selectable() {
	return { classList: { add() {} } };
}

test("空候选路径不求值可缺省 check", () => {
	const card = createChoice("chooseCard", { forced: false, selectCard: [1, 1], filterCard() {}, player: { _noSkill: true } }, []);
	const target = createChoice("chooseTarget", { forced: false, selectTarget: [1, 1], filterTarget() {} }, []);
	const button = createChoice("chooseButton", { forced: false, selectButton: [1, 1] }, []);
	assert.equal(card.choice(), false);
	assert.equal(target.choice(), false);
	assert.equal(button.choice(), false);
});

test("card scoring preserves undefined and NaN instead of treating them as zero", () => {
	for (const value of [undefined, NaN, 1, -1, 0, Infinity]) {
		let calls = 0;
		const direct = createChoice("chooseCard", { filterCard: undefined }, []);
		assert.equal(
			direct.choice(function () {
				assert.equal(arguments.length, 0);
				calls++;
				return value;
			}),
			value > 0
		);
		assert.equal(calls, 1);
		const card = selectable();
		const candidate = createChoice("chooseCard", { selectCard: [1, 1], filterCard() {}, player: { _noSkill: true } }, [card]);
		calls = 0;
		const chosen = candidate.choice(function (actualCard) {
			assert.equal(actualCard, card);
			assert.equal(this, undefined);
			calls++;
			return value;
		});
		assert.equal(chosen, !(value <= 0));
		assert.equal(calls, 2);
	}
});

test("card scoring retains undefined propagation through square roots and accumulation", () => {
	for (const values of [
		[1, 4],
		[1, undefined],
		[undefined, 4],
		[-1, 4],
		[0, 0],
	]) {
		const choice = createChoice("chooseCard", { selectCard: [0, -1], filterCard() {} }, []);
		const cards = [selectable(), selectable()];
		choice.selected.cards.push(...cards);
		let calls = 0;
		const actual = choice.choice(function (card) {
			assert.equal(arguments.length, 1);
			calls++;
			return values[cards.indexOf(card)];
		});
		const total = values.reduce((sum, value) => sum + (value < 0 ? -Math.sqrt(-value) : Math.sqrt(value)), 0);
		assert.equal(actual, total > 0);
		assert.equal(calls, 2);
	}
});

test("check 仅在实际评分时失败，并保留零参数调用", () => {
	const empty = createChoice("chooseCard", { forced: false, selectCard: [1, 1], filterCard() {}, player: { _noSkill: true } }, []);
	assert.doesNotThrow(() => empty.choice());
	const required = createChoice("chooseCard", { filterCard: undefined });
	assert.throws(() => required.choice(), /card selection requires a check callback/);

	let receivedThis;
	let argumentCount;
	const zero = createChoice("chooseTarget", { filterTarget: undefined });
	assert.equal(
		zero.choice(function () {
			"use strict";
			receivedThis = this;
			argumentCount = arguments.length;
			return 1;
		}),
		true
	);
	assert.equal(receivedThis, undefined);
	assert.equal(argumentCount, 0);
});

test("card、target 与 button 评分保留一参、两参、undefined this 和缓存时序", () => {
	for (const [name, event] of [
		["chooseCard", { forced: false, selectCard: [1, 1], filterCard() {}, player: { _noSkill: true } }],
		["chooseTarget", { forced: false, selectTarget: [1, 1], filterTarget() {} }],
		["chooseButton", { forced: false, selectButton: [1, 1] }],
	]) {
		const steps = [];
		const choice = createChoice(name, event, [selectable()], steps);
		const calls = [];
		assert.equal(
			choice.choice(function () {
				"use strict";
				calls.push([this, arguments.length]);
				steps.push(`score${arguments.length}`);
				return 1;
			}),
			true
		);
		assert.deepEqual(
			calls.map(call => call[0]),
			[undefined, undefined]
		);
		assert.deepEqual(
			calls.map(call => call[1]),
			[2, 1]
		);
		assert.deepEqual(steps, ["score2", "score1", "game.check"]);
		assert.deepEqual(
			choice.cacheEvents.map(event => (Array.isArray(event) ? event[0] : event)),
			["context", "set", true, false, "remove"]
		);
	}
});
