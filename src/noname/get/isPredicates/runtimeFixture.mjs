import assert from "node:assert/strict";
import console from "node:console";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";

const root = dirname(fileURLToPath(import.meta.url));
const context = createContext({ console });
const modules = new Map();
let ready = false;
let subtype = "equip4";
const calls = [];
const values = {
	_status: {},
	lib: {},
	game: {},
	ui: {},
	get: {
		subtype(card, player) {
			calls.push(["subtype", card, player]);
			return subtype;
		},
		subtypes(card, player) {
			calls.push(["subtypes", card, player]);
			return ["equip3", "equip4"];
		},
		nameList(player) {
			calls.push(["names", player]);
			return ["hero", "other"];
		},
	},
};
const guard = object =>
	new Proxy(object, {
		get(target, key) {
			assert.equal(ready, true, `Early singleton read: ${String(key)}`);
			return target[key];
		},
	});
function synthetic(identifier, exports) {
	const module = new SyntheticModule(
		Object.keys(exports),
		function () {
			for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
		},
		{ context, identifier }
	);
	modules.set(identifier, module);
	return module;
}
const globals = synthetic("noname", Object.fromEntries(Object.entries(values).map(([key, value]) => [key, guard(value)])));
const utility = synthetic("@/util/index.js", { userAgentLowerCase: "test", GeneratorFunction: Object.getPrototypeOf(function* () {}).constructor, AsyncFunction: Object.getPrototypeOf(async function () {}).constructor });
function load(path) {
	if (modules.has(path)) return modules.get(path);
	const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
	const module = new SourceTextModule(code, { context, identifier: path });
	modules.set(path, module);
	return module;
}
const entry = load(resolve(root, "../is.js"));
await entry.link((specifier, parent) => {
	if (specifier === "noname") return globals;
	if (specifier === "@/util/index.js") return utility;
	let path = resolve(dirname(parent.identifier), specifier);
	if (!existsSync(path) && path.endsWith(".js")) path = path.slice(0, -3) + ".ts";
	return load(path);
});
await entry.evaluate();
const Is = entry.namespace.Is;
const expected = ["functionMethod", "emotion", "attackingMount", "defendingMount", "mountCombined", "sameNature", "differentNature", "connectedCard", "shownCard", "damageCard", "virtualCard", "convertedCard", "ordinaryCard", "yayun", "blocked", "double", "yingbianConditional", "complexlyYingbianConditional", "simplyYingbianConditional", "yingbianEffective", "yingbian", "emoji", "banWords", "converted", "safari", "freePosition", "nomenu", "altered", "node", "div", "map", "set", "object", "singleSelect", "jun", "versus", "changban", "single", "mobileMe", "newLayout", "phoneLayout", "singleHandcard", "linked2", "empty", "pos", "locked", "zhuanhuanji", "qidingSkill", "playerNames"];
assert.deepEqual(Reflect.ownKeys(Is.prototype), ["constructor", ...expected]);
assert.equal(Object.getPrototypeOf(Is.prototype), runInContext("Object.prototype", context));
assert.equal(load(resolve(root, "../is.js")).namespace.Is, Is);
const instance = new Is();
assert.equal(Object.getPrototypeOf(instance), Is.prototype);
assert.deepEqual(Reflect.ownKeys(instance), []);
for (const name of ["cardAndContent", "skillAndText", "platformAndState"]) {
	const group = modules.get(resolve(root, `${name}.js`)).namespace[`${name}Predicates`];
	for (const [key, method] of Object.entries(group)) {
		const descriptor = Object.getOwnPropertyDescriptor(Is.prototype, key);
		assert.equal(descriptor.value, method, key);
		assert.deepEqual([descriptor.enumerable, descriptor.configurable, descriptor.writable], [false, true, true]);
		assert.equal(method.name, key);
		assert.throws(() => Reflect.construct(method, []), /constructor/);
	}
}
ready = true;
const card = {};
const player = {};
assert.equal(instance.attackingMount(card, player), true);
assert.equal(calls.length, 1);
assert.equal(calls[0][1], card);
assert.equal(calls[0][2], player);
calls.length = 0;
subtype = "equip6";
assert.equal(instance.attackingMount(card, player), true);
assert.deepEqual(
	calls.map(call => call[0]),
	["subtype", "subtypes"]
);
assert.equal(instance.virtualCard({}), true);
assert.equal(instance.ordinaryCard({ isCard: true, cards: [card] }), true);
assert.equal(instance.convertedCard({ isCard: false, cards: [card] }), true);
const sample = { async content() {} };
assert.equal(instance.functionMethod(sample, "content"), true);
assert.equal(instance.functionMethod({ content: 1 }, "content"), false);
assert.equal(instance.map(new Map()), true);
assert.equal(instance.object({}), true);
assert.equal(instance.object(null), false);
assert.equal(instance.playerNames(player, "her"), true);
values.get.nameList = owner => {
	assert.equal(owner, player);
	return ["replacement"];
};
assert.equal(instance.playerNames(player, "her"), false);
const replacement = () => "replacement";
Is.prototype.playerNames = replacement;
assert.equal(instance.playerNames, replacement);
console.log("real Is modules: original constructor, prototype order, descriptors, method identities and dynamic replacement verified");
