import assert from "node:assert/strict";
import console from "node:console";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

const root = dirname(fileURLToPath(import.meta.url));
const context = createContext({ console });
const modules = new Map();
const registrations = [];
let initialized = false;
function engine(value, allowed = []) {
	return new Proxy(value, {
		get(target, key) {
			assert.ok(initialized || allowed.includes(key), `early singleton read: ${String(key)}`);
			return target[key];
		},
	});
}
const calls = [];
const get = {
	mode() {
		calls.push(this);
		return "guozhan";
	},
};
const exports = {
	lib: engine({}),
	game: engine(
		{
			import(type, factory) {
				registrations.push([type, factory()]);
			},
		},
		["import"]
	),
	ui: engine({}),
	get: engine(get),
	ai: engine({}),
	_status: engine({}),
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
const entry = load(resolve(root, "../index.js"));
await entry.link((specifier, parent) => (specifier === "noname" ? globals : load(resolve(dirname(parent.identifier), specifier))));
await entry.evaluate();
initialized = true;
assert.equal(registrations.length, 1);
assert.equal(registrations[0][0], "character");
const pack = registrations[0][1];
const registry = modules.get(resolve(root, "../skill.js")).namespace.default;
assert.equal(pack.name, "standard");
assert.equal(pack.connect, true);
assert.equal(Object.keys(registry).length, 70);
assert.deepEqual(Object.keys(pack.skill), Object.keys(registry));
assert.notEqual(pack.skill, registry); // The original index intentionally spreads the registry.
const keys = [];
for (const path of ["lordAndWei", "weiJudgement", "weiAndShu", "shuCombat", "wuTactics", "wuAndVariants", "variantSupport"]) {
	const group = modules.get(resolve(root, `${path}.js`)).namespace[`${path}Skills`];
	for (const key of Object.keys(group)) {
		keys.push(key);
		assert.equal(registry[key], group[key]);
		assert.equal(pack.skill[key], group[key]);
	}
}
assert.deepEqual(Object.keys(registry), keys);
assert.equal(keys[0], "stdqingjiao");
assert.equal(keys.at(-1), "xinfu_jiyuan");
assert.equal(load(resolve(root, "../index.js")), entry);
const positions = [];
const player = {
	hasCards(position) {
		positions.push([this, position]);
		return true;
	},
};
assert.equal(pack.skill.guicai.filter({}, player), true);
assert.deepEqual(positions, [[player, "hes"]]);
assert.deepEqual(calls, [exports.get]);
get.mode = () => "identity";
assert.equal(pack.skill.guicai.filter({}, player), true);
assert.deepEqual(positions[1], [player, "hs"]);
const order = [];
const owner = {
	draw() {
		assert.equal(this, owner);
		order.push("draw");
		return Promise.resolve();
	},
};
await pack.skill.stdqingjiao.content({}, undefined, owner);
assert.deepEqual(order, ["draw"]);
const original = registry.stdqingjiao.content;
const replacement = function (event, trigger, current) {
	order.push([this, event, trigger, current]);
};
registry.stdqingjiao.content = replacement;
const event = {},
	trigger = {};
pack.skill.stdqingjiao.content(event, trigger, owner);
assert.deepEqual(order.at(-1), [registry.stdqingjiao, event, trigger, owner]);
registry.stdqingjiao.content = original;
assert.equal(pack.skill.stdqingjiao.content, original);
assert.equal(pack.skill.guicai.audioname2, registry.guicai.audioname2);
assert.equal(pack.skill.jijiang.group, registry.jijiang.group);
console.log("real standard character pack: original registration, groups, identities and callback protocols verified");
