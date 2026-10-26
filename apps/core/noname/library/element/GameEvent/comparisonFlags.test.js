import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function source(path) {
	return ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
}
const playerSource = source("../player.js");
const playerClass = playerSource.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Player");
const contentSource = source("../content.ts");
const content = contentSource.statements.flatMap(node => (ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])).find(node => node.name.getText(contentSource) === "Content").initializer;

function javascript(code) {
	return ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
}
function playerMethod(name, game) {
	const method = playerClass.members.find(node => node.name?.getText(playerSource) === name);
	return new Function("game", `${javascript(`const method = {${method.getText(playerSource)}};`)} return method[${JSON.stringify(name)}];`)(game);
}
function stage(name, matches, game, lib) {
	const entry = content.properties.find(node => node.name?.getText(contentSource) === name);
	const callback = entry.initializer.elements.find(node => matches(node.getText(contentSource)));
	assert.ok(callback, name);
	const code = javascript(`const callback = ${callback.getText(contentSource)};`);
	return new Function("game", "lib", `${code}; return callback;`)(game, lib);
}

test("popup producers preserve absence, explicit false and binding-time state", () => {
	const bindings = [];
	const game = {
		createEvent(name) {
			return {
				name,
				setContent(content) {
					bindings.push([this, content, Object.hasOwn(this, "popup"), this.popup]);
				},
			};
		},
	};
	const player = { hp: 3 };
	const changeHp = playerMethod("changeHp", game);
	const absent = changeHp.call(player, -1);
	assert.equal(Object.hasOwn(absent, "popup"), false);
	assert.deepEqual(bindings[0], [absent, "changeHp", false, undefined]);
	const hidden = changeHp.call(player, 1, false);
	assert.deepEqual(bindings[1], [hidden, "changeHp", true, false]);
	assert.equal(hidden.player, player);
	assert.equal(hidden.originalHp, 3);
	const changeSkills = playerMethod("changeSkills", game);
	// These are the engine's unique-array operations; preserve the copied array receiver.
	const skills = [];
	skills.slice = function () {
		const copy = [];
		copy.unique = function () {
			return this;
		};
		return copy;
	};
	const defaultSkills = changeSkills.call(player, skills, skills);
	assert.deepEqual(bindings[2], [defaultSkills, "changeSkills", true, true]);
	const hiddenSkills = changeSkills.call(player, skills, skills, false);
	assert.deepEqual(bindings[3], [hiddenSkills, "changeSkills", true, false]);
	assert.notEqual(hiddenSkills.addSkill, skills);
	assert.notEqual(hiddenSkills.removeSkill, skills);
});

test("simultaneous comparison writes its flag only after participant validation and sorting", async () => {
	const sequence = [];
	const player = { countCards: () => 1 };
	const target = { countCards: () => 1 };
	const targets = [target, player];
	const game = {
		log() {
			sequence.push("log");
		},
	};
	const lib = {
		sort: {
			seat() {
				sequence.push("sort");
				return 0;
			},
		},
		filter: { all: () => true },
	};
	const callback = stage("chooseToCompareMeanwhile", code => code.includes("event.compareMeanwhile = true"), game, lib);
	const event = {
		getTargets: () => targets,
		finish() {
			sequence.push("finish");
		},
	};
	Object.defineProperty(event, "compareMeanwhile", {
		configurable: true,
		set(value) {
			sequence.push(["flag", value]);
		},
	});
	await callback(event, undefined, player);
	assert.deepEqual(sequence, ["sort", "log", ["flag", true]]);
	assert.equal(event.filterCard, lib.filter.all);
	sequence.length = 0;
	const cancelled = {
		getTargets: () => [target],
		finish() {
			sequence.push("finish");
		},
	};
	await callback(cancelled, undefined, { countCards: () => 0 });
	assert.equal(Object.hasOwn(cancelled, "compareMeanwhile"), false);
	assert.deepEqual(cancelled.result, { cancelled: true, bool: false });
	assert.deepEqual(sequence, ["finish"]);
});

test("multiple comparison reads a replaced callback and writes its flag after binding the same child", async () => {
	const sequence = [];
	const cards = [{ clone: { style: {} } }, { clone: { style: {} } }];
	const first = () => {};
	const replacement = () => {};
	let event;
	let child;
	let reads = 0;
	const game = {
		broadcastAll(callback, ...args) {
			callback(...args);
			event.callback = replacement;
			sequence.push("broadcast");
		},
		createEvent(name) {
			child = {
				name,
				setContent(callback) {
					sequence.push(["bind", callback, Object.hasOwn(event, "compareMultiple")]);
				},
			};
			return child;
		},
	};
	const callback = stage("chooseToCompareMultiple", code => code.includes("event.compareMultiple = true"), game, {});
	const player = {};
	event = { target: {}, card1: cards[0], card2: cards[1], num1: 8, num2: 2, winner: player };
	Object.defineProperty(event, "callback", {
		configurable: true,
		get() {
			reads++;
			return first;
		},
		set(value) {
			Object.defineProperty(this, "callback", { configurable: true, writable: true, value });
		},
	});
	await callback(event, undefined, player);
	assert.equal(reads, 1);
	assert.deepEqual(sequence, ["broadcast", ["bind", replacement, false]]);
	assert.equal(event.compareMultiple, true);
	assert.equal(child.player, player);
	assert.equal(child.target, event.target);
	assert.equal(child.card1, cards[0]);
	assert.equal(child.card2, cards[1]);
	assert.equal(cards[0].clone.style.opacity, 0.5);
	assert.equal(cards[1].clone.style.opacity, 0.5);
	const absent = {};
	await callback(absent, undefined, player);
	assert.equal(Object.hasOwn(absent, "compareMultiple"), false);
});
