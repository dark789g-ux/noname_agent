import { getTestText } from "./testing/testSource.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("get/index.js", getTestText(), ts.ScriptTarget.Latest, true);
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Get");
function method(name, dependencies) {
	const node = declaration.members.find(node => node.name?.getText(source) === name);
	assert.ok(node);
	return new Function(...Object.keys(dependencies), `return ({ ${node.getText(source)} })[${JSON.stringify(name)}];`)(...Object.values(dependencies));
}

function distanceFixture() {
	const selected = {};
	const sourceEquip = { distance: { globalFrom: -1 } };
	const targetEquip = { distance: { globalTo: 2, attackTo: 3 } };
	const excluded = { cards: [selected], distance: { globalTo: 100, attackTo: 100 } };
	const from = { getXY: () => [0, 0], getVCards: (_, filter) => [sourceEquip].filter(filter) };
	const to = { getXY: () => [4, 0], getVCards: (_, filter) => [targetEquip, excluded].filter(filter) };
	const calls = [];
	const game = {
		players: [from, to],
		dead: [],
		chess: true,
		checkMod(source, target, value, key, owner) {
			calls.push([key, value, owner]);
			return key === "attackFrom" ? value * 2 : key === "attackTo" ? value - 1 : value;
		},
	};
	const run = method("distance", { game, get: { info: card => card }, ui: { selected: { cards: [selected] } } });
	return { run, from, to, calls, targetEquip };
}

test("distance applies target equipment attackTo only after attack Mods", () => {
	const { run, from, to, calls } = distanceFixture();
	assert.equal(run(from, to, "attack"), 12);
	assert.deepEqual(calls, [
		["globalFrom", 4, from],
		["globalTo", 4, to],
		["attackFrom", 5, from],
		["attackTo", 10, to],
	]);
});

test("ordinary and raw distance exclude attack-only corrections and selected equipment", () => {
	const { run, from, to, calls } = distanceFixture();
	assert.equal(run(from, to), 5);
	assert.equal(run(from, to, "unchecked"), 5);
	assert.equal(run(from, to, "raw"), 4);
	assert.equal(run(from, from, "attack"), 0);
	assert.equal(run(from, {}, "attack"), Infinity);
	assert.equal(
		calls.some(([key]) => key.startsWith("attack")),
		false
	);
});

test("distance retains negative attack corrections without clamping", () => {
	const { run, from, to, targetEquip } = distanceFixture();
	targetEquip.distance.attackTo = -20;
	assert.equal(run(from, to, "attack"), -11);
});

function threatenRunner() {
	let branch;
	function visit(node) {
		if (ts.isIfStatement(node) && node.expression.getText(source).startsWith('typeof temp3 === "function"')) branch = node;
		ts.forEachChild(node, visit);
	}
	visit(declaration.members.find(node => node.name?.getText(source) === "effect"));
	assert.ok(branch);
	return new Function("temp3", "player", "target", `"use strict"; let threaten = 2; ${branch.getText(source)}; return threaten;`);
}

test("threaten evaluates function once and preserves undefined as no correction", () => {
	const run = threatenRunner();
	const player = {},
		target = {};
	for (const value of [0, 3, undefined, NaN, Infinity]) {
		let calls = 0;
		assert.equal(
			run(
				function (...args) {
					calls++;
					assert.equal(this, undefined);
					assert.deepEqual(args, [player, target]);
					return value;
				},
				player,
				target
			),
			value === undefined ? 2 : 2 * value
		);
		assert.equal(calls, 1);
	}
});

test("threaten uses object target values and retains the callback receiver", () => {
	const run = threatenRunner();
	const player = {},
		target = {};
	assert.equal(run({ target: 3 }, player, target), 6);
	assert.equal(run({ target: 0 }, player, target), 0);
	assert.equal(run({}, player, target), 2);
	assert.equal(run(3, player, target), 6);
	assert.equal(run(undefined, player, target), 2);
	let calls = 0;
	const entry = {
		target(...args) {
			calls++;
			assert.equal(this, entry);
			assert.deepEqual(args, [player, target]);
			return 4;
		},
	};
	assert.equal(run(entry, player, target), 8);
	assert.equal(calls, 1);
	entry.target = () => undefined;
	assert.equal(run(entry, player, target), 2);
});

function fullThreatenFixture(name, threat, aiResult = { target: 1 }) {
	const player = { getSkills: () => [], hasSkillTag: () => false };
	const target = { getSkills: () => ["threat"], hp: 3, countCards: () => 2 };
	const card = { name: "sha" };
	const cache = { delegate: value => value, get: { attitude: (from, to) => (to === target ? -1 : 1) } };
	const get = { autoViewAs: value => value, info: name => (name === "threat" ? { ai: { threaten: threat } } : {}), result: () => aiResult, tag: () => false };
	const run = method(name, { CacheContext: { requireCacheContext: () => cache }, get, game: { expandSkills() {} }, lib: { skill: { global: [] } }, _status: { event: {} } });
	return { run: viewer => run(target, card, player, viewer), player, target };
}

for (const name of ["effect", "effect_use"]) {
	test(`${name} reads a numeric result as having no player or target scores`, () => {
		assert.equal(fullThreatenFixture(name, 4, 2).run(), 0);
	});

	test(`${name} treats a null viewpoint as the acting player's viewpoint`, () => {
		const { run, player } = fullThreatenFixture(name, 4);
		assert.equal(run(null), run());
		assert.equal(run(null), run(player));
	});

	test(`${name} includes zero and NaN numeric threaten in the full calculation`, () => {
		for (const threat of [0, 4, -1, NaN, Infinity, undefined]) {
			const { run } = fullThreatenFixture(name, threat);
			assert.equal(run(), 0 + -1.1 * Math.sqrt(threat === undefined ? 1 : threat));
		}
	});

	test(`${name} evaluates top-level callbacks once and retains undefined fallback`, () => {
		for (const value of [undefined, 0, 4, NaN, false, null, "3", "invalid"]) {
			let count = 0;
			const entry = function (...args) {
				assert.equal(this, undefined);
				assert.deepEqual(args, [player, target]);
				count++;
				return value;
			};
			const { run, player, target } = fullThreatenFixture(name, entry);
			assert.equal(run(), 0 + -1.1 * Math.sqrt(typeof value === "number" ? value : 1));
			assert.equal(count, 1);
		}
	});

	test(`${name} retains object target receiver and calls its callback once`, () => {
		for (const value of [undefined, 0, 4, NaN, false, null, "3", "invalid"]) {
			let count = 0;
			const entry = {
				target(...args) {
					assert.equal(this, entry);
					assert.deepEqual(args, [player, target]);
					count++;
					return value;
				},
			};
			const { run, player, target } = fullThreatenFixture(name, entry);
			assert.equal(run(), 0 + -1.1 * Math.sqrt(typeof value === "number" ? value : 1));
			assert.equal(count, 1);
		}
	});
}

for (const name of ["effect", "effect_use"]) {
	test(`${name} reads the target member once before preserving its receiver`, () => {
		let reads = 0;
		const entry = {
			get target() {
				reads++;
				return function () {
					assert.equal(this, entry);
					return 4;
				};
			},
		};
		assert.equal(fullThreatenFixture(name, entry).run(), -2.2);
		assert.equal(reads, 1);
	});
}

for (const name of ["effect", "effect_use"]) {
	test(`${name} preserves null event-player capture and result callbacks before required-player failure`, () => {
		const calls = [];
		const status = { event: { player: null } };
		const replacement = {};
		const get = {
			info: () => ({}),
			result: () => ({
				player(player) {
					calls.push(["player", player]);
					status.event.player = replacement;
					return 1;
				},
				target(player) {
					calls.push(["target", player]);
					return 2;
				},
			}),
		};
		const run = method(name, { get, _status: status, CacheContext: { requireCacheContext: () => ({}) } });
		assert.throws(() => run(undefined, "sha"), /AI effect evaluation requires a player/);
		assert.deepEqual(calls, [
			["player", null],
			["target", null],
		]);
	});
}

test("effect_use keeps the empty changed-target early return without requiring a player", () => {
	let calls = 0;
	const get = {
		autoViewAs: card => card,
		info: () => ({
			changeTarget(player, targets) {
				assert.equal(player, null);
				calls++;
				targets.length = 0;
			},
		}),
	};
	const run = method("effect_use", { get, _status: { event: { player: null } }, CacheContext: { requireCacheContext: () => ({}) } });
	assert.equal(run(undefined, { name: "sha" }), 0);
	assert.equal(calls, 1);
});

test("prompt accepts a missing event player while usage counts fail only when a player is required", () => {
	const get = {
		player: () => null,
		skillTranslation: (name, player) => {
			assert.equal(player, null);
			return name;
		},
	};
	assert.equal(method("prompt", { get })("skill"), "是否发动【skill】？");
	const status = { event: { player: null } };
	const count = method("skillCount", { _status: status });
	assert.throws(() => count("skill"), /require an event player/);
	assert.equal(count("skill", { getStat: () => ({ skill: 2 }) }), 2);
});
