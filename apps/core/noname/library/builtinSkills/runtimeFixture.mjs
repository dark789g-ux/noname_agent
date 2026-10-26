import assert from "node:assert/strict";
import console from "node:console";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";

const root = dirname(fileURLToPath(import.meta.url));
const context = createContext({ console });
const modules = new Map();
const notInitialized = new Proxy(
	{},
	{
		get(_target, key) {
			throw new Error(`Singleton read during registry initialization: ${String(key)}`);
		},
	}
);
const globals = new SyntheticModule(
	["_status", "game", "get", "lib", "ui"],
	function () {
		for (const name of ["_status", "game", "get", "lib", "ui"]) this.setExport(name, notInitialized);
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
const entry = load(resolve(root, "../skill.js"));
await entry.link((specifier, parent) => {
	if (specifier === "noname") return globals;
	let path = resolve(dirname(parent.identifier), specifier);
	if (!existsSync(path) && path.endsWith(".js")) path = path.slice(0, -3) + ".ts";
	return load(path);
});
await entry.evaluate();
const registry = entry.namespace.default;
const expected = ["equipEnable", "stratagem_fury", "_stratagem_add_buff", "expandedSlots", "nocount", "zf_anyDamage", "zf_anyGain", "zf_phaseDraw", "zf_anyDraw", "zf_cardDamage", "zf_maxHandcard", "zf_cardUsable", "zf_directDamage", "zf_directGain", "zf_onAdd", "zf_loseMaxHp", "zf_extraEff", "zhanfa", "danqi_hufu", "charge", "cooperation", "zhengsu", "renku", "_showHiddenCharacter", "_kamisha", "_doublegroup_choice", "aozhan", "global", "globalmap", "storage", "undist", "others", "zhu", "zhuSkill", "land_used", "unequip", "subplayer", "autoswap", "dualside", "fengyin", "baiban", "qianxing", "mianyi", "mad", "ghujia", "_usecard", "_discard", "_ismin", "_recasting", "_lianhuan", "_lianhuan4", "_rest_return", "_chongzhu", "dongcha", "sheshen", "identity_mingcha", "_sxrm_connect"];
assert.deepEqual(Object.keys(registry), expected);
for (const [path, module] of modules) {
	if (!path.startsWith(root) || !path.endsWith(".js")) continue;
	for (const group of Object.values(module.namespace)) {
		for (const key of Object.keys(group)) assert.equal(registry[key], group[key], key);
	}
}
assert.equal(load(resolve(root, "../skill.js")), entry);
assert.equal(entry.namespace.default, registry);
assert.equal(Array.isArray(registry.global), true);
const modeGroup = modules.get(resolve(root, "modeState.js")).namespace.modeStateSkills;
registry.global.push("test_dynamic_skill");
assert.equal(modeGroup.global.at(-1), "test_dynamic_skill");
const original = registry.aozhan.mod.cardname;
const replacement = () => "replacement";
registry.aozhan.mod.cardname = replacement;
assert.equal(modeGroup.aozhan.mod.cardname, replacement);
registry.aozhan.mod.cardname = original;
assert.equal(modeGroup.aozhan.mod.cardname, original);
console.log("real builtin skill modules: order, identities, metadata, dynamic replacement and deferred singleton access verified");
