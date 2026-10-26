import assert from "node:assert/strict";
import console from "node:console";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";

const expected = { bingshi: { count: 80, first: "potchiyun", last: "potzhenfeng" }, onlyOL: { count: 176, first: "olanxu", last: "olxuanfeng" } };
const packName = process.argv[2];
assert.ok(Object.hasOwn(expected, packName));
const root = fileURLToPath(new URL(`../character/${packName}/`, import.meta.url));
const modules = new Map();
const context = createContext({ console });
const registrations = [];
let initialized = false;
const early = [];
function engine(value, path, allowed = []) {
	return new Proxy(value, {
		get(target, key) {
			assert.ok(initialized || allowed.includes(key), `early singleton read: ${String(key)}`);
			if (!initialized) early.push(["get", path, key]);
			return target[key];
		},
	});
}
const calls = [];
const get = {
	poptip(key) {
		assert.equal(this, exports.get);
		if (!initialized) early.push(["call", "get.poptip", key]);
		return key;
	},
	rand(...args) {
		calls.push([this, args]);
		return 3;
	},
};
const exports = {
	lib: engine({ poptip: { getInfo: key => key }, filter: engine({ notMe: () => true, cardDiscardable: () => true, cardRecastable: () => true, filterTarget: () => true }, "lib.filter", ["notMe", "cardDiscardable", "cardRecastable", "filterTarget"]) }, "lib", ["filter"]),
	game: engine(
		{
			import(type, factory) {
				registrations.push([type, factory()]);
			},
		},
		"game",
		["import"]
	),
	ui: engine({}, "ui"),
	get: engine(get, "get", ["poptip"]),
	ai: engine({}, "ai"),
	_status: engine({}, "_status"),
};
const globals = new SyntheticModule(
	Object.keys(exports),
	function () {
		for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
	},
	{ context, identifier: "noname" }
);
function load(path) {
	if (modules.has(path)) return modules.get(path);
	const module = new SourceTextModule(readFileSync(path, "utf8"), { context, identifier: path });
	modules.set(path, module);
	return module;
}
const link = (specifier, parent) => (specifier === "noname" ? globals : load(resolve(dirname(parent.identifier), specifier)));
const skillEntry = load(resolve(root, "skill.js"));
await skillEntry.link(link);
await skillEntry.evaluate();
initialized = true;
// The pre-split modules already evaluate these metadata expressions during registration.
const filterReads = packName === "bingshi" ? ["notMe", "cardDiscardable", "notMe", "notMe"] : ["notMe", "notMe", "cardRecastable", "notMe", "notMe", "filterTarget", "notMe", "notMe", "notMe", "notMe"];
assert.deepEqual(early, [
	["get", "get", "poptip"],
	["call", "get.poptip", packName === "bingshi" ? "potyinxian" : "olzhenshan"],
	...filterReads.flatMap(key => [
		["get", "lib", "filter"],
		["get", "lib.filter", key],
	]),
]);
// Now load the unchanged pack entry, including its translation getters and registration.
const entry = load(resolve(root, "index.js"));
await entry.link(link);
await entry.evaluate();
assert.equal(registrations.length, 1);
assert.equal(registrations[0][0], "character");
const pack = registrations[0][1];
const registry = modules.get(resolve(root, "skill.js")).namespace.default;
assert.equal(pack.name, packName);
assert.equal(pack.connect, true);
assert.notEqual(pack.skill, registry);
assert.deepEqual(Object.keys(pack.skill), Object.keys(registry));
assert.equal(Object.keys(registry).length, expected[packName].count);
assert.equal(Object.keys(registry)[0], expected[packName].first);
assert.equal(Object.keys(registry).at(-1), expected[packName].last);
const source = ts.createSourceFile("skill.js", readFileSync(resolve(root, "skill.js"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const keys = [];
for (const node of source.statements.filter(ts.isImportDeclaration)) {
	const group = modules.get(resolve(root, node.moduleSpecifier.text)).namespace.groupSkills;
	for (const key of Object.keys(group)) {
		keys.push(key);
		assert.equal(registry[key], group[key]);
		assert.equal(pack.skill[key], group[key]);
	}
}
assert.deepEqual(Object.keys(registry), keys);
assert.equal(load(resolve(root, "index.js")), entry);
if (packName === "bingshi") {
	const callback = registry.potchiyun.logAudio2.pot_zhouyu_shadow;
	const player = { storage: { potchiyun1: true } };
	assert.equal(callback({}, player), "potchiyun_pot_zhouyu_shadow3.mp3");
	assert.deepEqual(calls, [[exports.get, [3, 4]]]);
	get.rand = function (...args) {
		calls.push([this, args]);
		return 2;
	};
	player.storage.potchiyun1 = false;
	assert.equal(pack.skill.potchiyun.logAudio2.pot_zhouyu_shadow({}, player), "potchiyun_pot_zhouyu_shadow2.mp3");
	assert.deepEqual(calls.at(-1), [exports.get, [1, 2]]);
	assert.equal(pack.skill.potchiyun.audioname2, registry.potchiyun.audioname2);
} else {
	const records = [];
	const player = {
		hasGainableCards(...args) {
			records.push([this, args]);
			return true;
		},
	};
	const target = { hasGainableCards: player.hasGainableCards };
	const card = { experimental: true };
	assert.equal(pack.skill.olanxu.filterTarget(card, player, player), true);
	assert.equal(pack.skill.olanxu.filterTarget(card, player, target), true);
	assert.deepEqual(records, [
		[player, [player, "e"]],
		[target, [player, "he"]],
	]);
}
const first = registry[expected[packName].first];
const original = first.filter;
const replacement = function (...args) {
	calls.push([this, args]);
	return true;
};
first.filter = replacement;
const event = {},
	player = {};
assert.equal(pack.skill[expected[packName].first].filter(event, player), true);
assert.deepEqual(calls.at(-1), [first, [event, player]]);
first.filter = original;
assert.equal(pack.skill[expected[packName].first].filter, original);
console.log(`real ${packName} character pack: registration, all groups, identities and dynamic callbacks verified`);
