import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { playerTestSource } from "./testSource.js";

const source = playerTestSource();
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Player");

function loadTracking(methodName) {
	const method = declaration.members.find(node => node.name?.getText(source) === methodName);
	let loop;
	function visit(node) {
		if (ts.isForOfStatement(node) && node.expression.getText(source) === "keys" && node.getText(source).includes("next.modSkill[key]")) loop = node;
		ts.forEachChild(node, visit);
	}
	visit(method);
	assert.ok(loop);
	return new Function("keys", "skills", "card", "next", "get", "game", loop.getText(source));
}

function loadMethod(path, className, methodName, bindings) {
	const file = ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	const owner = file.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === className);
	const method = owner.members.find(node => node.name?.getText(file) === methodName);
	return new Function(...Object.keys(bindings), `return ({${method.getText(file)}}).${methodName}`)(...Object.values(bindings));
}

for (const method of ["useCard", "respond"]) {
	test(`${method} matches the production suit query and checkMod protocol`, () => {
		const run = loadTracking(method);
		for (const initial of ["heart", undefined, null]) {
			const game = {};
			const player = { getModableSkills: () => ["a", "b"] };
			const card = { suit: initial };
			const calls = [];
			const info = {
				a: { mod: { suit(...args) { calls.push(["a.suit", this, ...args]); return "diamond"; }, cardsuit(...args) { calls.push(["a.cardsuit", this, ...args]); return undefined; } } },
				b: { mod: { suit(...args) { calls.push(["b.suit", this, ...args]); return undefined; }, cardsuit(...args) { calls.push(["b.cardsuit", this, ...args]); return "spade"; } } },
			};
			const get = { info: name => info[name] };
			game.checkMod = loadMethod("../../../game/index.js", "Game", "checkMod", { get, lib: {} });
			get.suit = loadMethod("../../../get/index.js", "Get", "suit", { get, game, lib: {} });
			const expected = get.suit(card, player);
			const standardCalls = calls.splice(0);
			const next = { modSkill: {} };
			run.call(player, ["cardsuit"], ["a", "b"], card, next, get, game);
			assert.deepEqual(calls, standardCalls);
			assert.equal(expected, initial === null ? null : "spade");
			assert.deepEqual(next.modSkill, initial === null ? {} : { cardsuit: "b" });
		}
	});
	test(`${method} tracks Mod callbacks with the existing receiver and argument order`, () => {
		const run = loadTracking(method);
		const game = {};
		const player = {};
		const card = { suit: "heart" };
		const next = { modSkill: {} };
		const calls = [];
		const info = { mod: { cardname(...args) { calls.push([this, ...args]); return "new-name"; } } };
		run.call(player, ["cardname"], ["skill"], card, next, { info: () => info, name: () => "old-name" }, game);
		assert.deepEqual(calls, [[game, card, player, "old-name", "unchanged"]]);
		assert.equal(next.modSkill.cardname, "skill");
	});

	test(`${method} rereads the suit Mod after a callback replaces its registry entry`, () => {
		const run = loadTracking(method);
		const game = {};
		const player = {};
		const card = { suit: "heart" };
		const calls = [];
		const replacement = { cardsuit(...args) { calls.push(["second", this, ...args]); return "final"; } };
		const info = { mod: { suit(...args) { calls.push(["first", this, ...args]); info.mod = replacement; return "intermediate"; } } };
		const next = { modSkill: {} };
		run.call(player, ["cardsuit"], ["skill"], card, next, { info: () => info, suit: () => "heart" }, game);
		assert.deepEqual(calls, [["first", game, card, "heart"], ["second", game, card, player, "intermediate"]]);
		assert.equal(next.modSkill.cardsuit, "skill");
	});

	test(`${method} supports cardsuit-only skills and ignores undefined or unchanged results`, () => {
		const run = loadTracking(method);
		const game = {}, player = {}, card = { suit: "heart" };
		const info = {
			first: { mod: { cardsuit(...args) { assert.deepEqual(args, [card, player, "heart"]); assert.equal(this, game); return "spade"; } } },
			unchanged: { mod: { cardsuit: () => "spade" } },
			missing: { mod: { cardsuit: () => undefined } },
		};
		const next = { modSkill: {} };
		run.call(player, ["cardsuit"], Object.keys(info), card, next, { info: name => info[name], suit: () => "heart" }, game);
		assert.equal(next.modSkill.cardsuit, "first");
	});

	test(`${method} runs the full suit stage before the cardsuit stage`, () => {
		const run = loadTracking(method);
		const calls = [];
		const info = {
			a: { mod: { suit(card, suit) { calls.push(["a.suit", suit]); return "diamond"; }, cardsuit(card, player, suit) { calls.push(["a.cardsuit", suit]); return "club"; } } },
			b: { mod: { suit(card, suit) { calls.push(["b.suit", suit]); return "spade"; }, cardsuit(card, player, suit) { calls.push(["b.cardsuit", suit]); } } },
		};
		const next = { modSkill: {} };
		run.call({}, ["cardsuit"], ["a", "b"], { suit: "heart" }, next, { info: name => info[name], suit: () => "heart" }, {});
		assert.deepEqual(calls, [["a.suit", "heart"], ["b.suit", "diamond"], ["a.cardsuit", "spade"], ["b.cardsuit", "club"]]);
		assert.equal(next.modSkill.cardsuit, "a");
	});

	test(`${method} follows checkMod nullish results and passes the raw suit`, () => {
		const run = loadTracking(method);
		for (const rawSuit of [undefined, null, "custom", "heart"]) {
			const seen = [];
			const info = { mod: { suit(card, suit) { seen.push(suit); return null; }, cardsuit(card, player, suit) { seen.push(suit); return undefined; } } };
			const next = { modSkill: {} };
			run.call({}, ["cardsuit"], ["skill"], { suit: rawSuit }, next, { info: () => info, suit: () => "none" }, {});
			assert.deepEqual(seen, [rawSuit, rawSuit]);
			assert.deepEqual(next.modSkill, {});
		}
	});

	test(`${method} still fails on absent or callback-deleted Mod containers`, () => {
		const run = loadTracking(method);
		const game = {};
		const card = {};
		const next = { modSkill: {} };
		const info = {};
		const get = { info: () => info, suit: () => "heart" };
		assert.throws(() => run.call({}, ["cardsuit"], ["skill"], card, next, get, game), TypeError);
		info.mod = { suit() { delete info.mod; } };
		assert.throws(() => run.call({}, ["cardsuit"], ["skill"], card, next, get, game), TypeError);
		assert.deepEqual(next.modSkill, {});
	});
}
