import assert from "node:assert/strict";
import console from "node:console";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

const root = dirname(fileURLToPath(import.meta.url));
const modules = new Map();
const context = createContext({ console });
let initialized = false;
const calls = [];
const get = {
	suit(card) {
		calls.push([this, card]);
		return "spade";
	},
};
function engine(value) {
	return new Proxy(value, {
		get(target, key) {
			assert.equal(initialized, true, `early singleton read: ${String(key)}`);
			return target[key];
		},
	});
}
const exports = { lib: engine({}), game: engine({}), ui: engine({}), get: engine(get), ai: engine({}), _status: engine({}) };
const globals = new SyntheticModule(
	Object.keys(exports),
	function () {
		for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
	},
	{ context, identifier: "noname" }
);
function load(path) {
	if (modules.has(path)) return modules.get(path);
	const module = new SourceTextModule(readFileSync(path, "utf8"), { context, identifier: path });
	modules.set(path, module);
	return module;
}
const entry = load(resolve(root, "../sp.js"));
await entry.link((specifier, parent) => (specifier === "noname" ? globals : load(resolve(dirname(parent.identifier), specifier))));
await entry.evaluate();
initialized = true;
const pack = entry.namespace.default;
const cards = modules.get(resolve(root, "cards.js")).namespace.cards;
const skills = modules.get(resolve(root, "skills.js")).namespace.skills;
assert.equal(entry.namespace.type, "card");
assert.equal(pack.name, "sp");
assert.equal(pack.connect, true);
assert.equal(pack.card, cards);
assert.equal(pack.skill, skills);
assert.equal(load(resolve(root, "../sp.js")), entry);
assert.deepEqual(Object.keys(pack), ["name", "connect", "card", "skill", "translate", "list"]);
assert.deepEqual(Object.keys(cards), ["jinchan", "qijia", "fulei", "qibaodao", "zhungangshuo", "lanyinjia", "yinyueqiang", "shengdong", "zengbin", "caomu"]);
assert.deepEqual(Object.keys(skills), ["lanyinjia", "lanyinjia2", "zhungangshuo", "qibaodao", "qibaodao2", "g_jinchan", "g_jinchan2", "yinyueqiang", "caomu_skill", "caomu_skill2"]);
assert.equal(pack.list.length, 19);
assert.deepEqual(Array.from(pack.list[0]), ["spade", 1, "caomu"]);
assert.deepEqual(Array.from(pack.list.at(-1)), ["club", 2, "lanyinjia"]);
const card = { id: "experimental-card" };
assert.equal(cards.fulei.judge(card), -6);
assert.equal(calls.length, 1);
assert.equal(calls[0][0], exports.get);
assert.equal(calls[0][1], card);
get.suit = value => {
	assert.equal(value, card);
	return "heart";
};
assert.equal(pack.card.fulei.judge(card), 6);
const original = skills.g_jinchan.filter;
const replacement = function (...args) {
	calls.push([this, args]);
	return true;
};
pack.skill.g_jinchan.filter = replacement;
assert.equal(skills.g_jinchan.filter, replacement);
const event = {};
const player = {};
assert.equal(skills.g_jinchan.filter(event, player), true);
assert.equal(calls.at(-1)[0], skills.g_jinchan);
assert.deepEqual(calls.at(-1)[1], [event, player]);
skills.g_jinchan.filter = original;
assert.equal(pack.skill.g_jinchan.filter, original);
assert.equal(pack.card.fulei.selectTarget, cards.fulei.selectTarget);
assert.equal(pack.card.jinchan.global, cards.jinchan.global);
assert.equal(pack.skill.lanyinjia.ai, skills.lanyinjia.ai);
console.log("real SP card pack: entry, order, identities, callbacks and deferred singleton reads verified");
