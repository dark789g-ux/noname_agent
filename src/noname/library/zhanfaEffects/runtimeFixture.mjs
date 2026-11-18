import assert from "node:assert/strict";
import console from "node:console";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";
import { zhanfaTestSource } from "./testSource.js";

const root = dirname(fileURLToPath(import.meta.url));
const context = createContext({ console });
const modules = new Map();
let initialized = false;
const template = { subSkill: { child: {} } };
const library = { skill: { zf_template: template }, cardPack: {}, translate: {}, card: {} };
const lib = new Proxy(library, {
	get(target, key) {
		assert.equal(initialized, true, `Singleton read before manager construction: ${String(key)}`);
		return target[key];
	},
});
const unavailable = new Proxy(
	{},
	{
		get(_target, key) {
			throw new Error(`Unexpected singleton access: ${String(key)}`);
		},
	}
);
const globals = new SyntheticModule(
	["_status", "game", "get", "lib"],
	function () {
		for (const name of ["_status", "game", "get"]) this.setExport(name, unavailable);
		this.setExport("lib", lib);
	},
	{ context, identifier: "noname" }
);
modules.set("noname", globals);
function load(path) {
	if (modules.has(path)) return modules.get(path);
	const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
	const module = new SourceTextModule(code, { context, identifier: path });
	modules.set(path, module);
	return module;
}
const entry = load(resolve(root, "../zhanfa.js"));
await entry.link((specifier, parent) => {
	if (specifier === "noname") return globals;
	let path = resolve(dirname(parent.identifier), specifier);
	if (!existsSync(path) && path.endsWith(".js")) path = path.slice(0, -3) + ".ts";
	return load(path);
});
await entry.evaluate();
initialized = true;
const Manager = entry.namespace.ZhanfaManager;
assert.equal(load(resolve(root, "../zhanfa.js")).namespace.ZhanfaManager, Manager);
const source = zhanfaTestSource();
const registry = source.statements[0].declarationList.declarations[0].initializer;
const expected = registry.properties.map(property => property.name.getText(source));
const manager = new Manager(lib);
assert.equal(Object.getPrototypeOf(manager), Manager.prototype);
assert.equal(Object.getPrototypeOf(Manager.prototype), runInContext("Object.prototype", context));
assert.deepEqual(Array.from(manager.getList(true)), expected);
assert.deepEqual(Array.from(library.cardPack.zhanfa), expected);
assert.equal(template.priority, 0.99);
assert.equal(library.skill.zf_template_child, template.subSkill.child);
for (const [path, module] of modules) {
	if (!path.startsWith(root) || !path.endsWith(".js") || path.endsWith("testSource.js")) continue;
	for (const group of Object.values(module.namespace)) {
		for (const [key, definition] of Object.entries(group)) {
			assert.equal(library.card[key], definition.card, key);
			if (typeof definition.skill !== "string" && !definition.skill.inherit) assert.equal(library.skill[key], definition.skill, key);
		}
	}
}
const first = expected[0];
const original = library.skill[first].content;
const replacement = () => "replacement";
library.skill[first].content = replacement;
const firstGroup = modules.get(resolve(root, "dongfeng.js")).namespace.dongfengEffects;
assert.equal(firstGroup[first].skill.content, replacement);
library.skill[first].content = original;
assert.equal(firstGroup[first].skill.content, original);
assert.equal(manager.getPack(first), "zhanfa");
const record = manager.get(first);
record.rarity = "test_copy";
assert.notEqual(manager.getRarity(first, true), "test_copy");
manager.setRarity(first, "epic");
assert.equal(manager.getRarity(first), "zf_epic");
const calls = [];
manager.set(first, {
	filterBan(player) {
		calls.push([this, player]);
		return true;
	},
});
const player = {};
assert.equal(manager.getList(false, player).includes(first), false);
assert.equal(calls.length, 1);
assert.equal(calls[0][0].skill, manager.getSkill(first));
assert.equal(calls[0][1], player);
manager.set(first, {
	filterBan() {
		return false;
	},
});
assert.equal(manager.getList(false, player).includes(first), true);
assert.throws(() => Manager.prototype.get.call({}, first), /private|brand|class/i);
console.log("real battle effect modules: order, identities, constructor, private state, copy and dynamic replacement verified");
