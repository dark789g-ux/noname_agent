import assert from "node:assert/strict";
import console from "node:console";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";

export const SPLIT_PACKS = {
	sixiang: { count: 174, first: "stdkoujing", last: "stdqiansu", layout: "single" },
	clan: { count: 82, first: "clanshixi", last: "chenliuwushi", layout: "single" },
	shenhua: { count: 176, first: "lianhuan", last: "guhuo_phase", layout: "single" },
	shiji: { count: 164, first: "yingba", last: "duoji", layout: "single" },
	yijiang: { count: 285, first: "olbenxi", last: "zpaiyi", layout: "single" },
	huicui: { count: 251, first: "dcfuyue", last: "xinkuangfu", layout: "single" },
	tw: { count: 351, first: "twsbganglie", last: "zhengfu", layout: "two-level" },
	sp: { count: 639, first: "ollingren", last: "xinfu_limu", layout: "two-level" },
	xianding: { count: 498, first: "dcmingjie", last: "mingjie", layout: "two-level" },
};

const packName = process.argv[2];
const spec = SPLIT_PACKS[packName];
assert.ok(spec, `Unknown split pack: ${packName}`);

const root = fileURLToPath(new URL(`../character/${packName}/`, import.meta.url));
const modules = new Map();
const context = createContext({ console });
const registrations = [];
let initialized = false;

function createFilterProxy(prefix, cache = new Map()) {
	const fallback = () => true;
	return new Proxy(fallback, {
		get(target, key) {
			if (typeof key === "symbol") return Reflect.get(target, key);
			assert.ok(initialized || prefix === "lib.filter", `early singleton read: ${prefix}.${String(key)}`);
			const next = `${prefix}.${String(key)}`;
			if (!cache.has(next)) cache.set(next, createFilterProxy(next, cache));
			return cache.get(next);
		},
	});
}

const exports = {
	lib: new Proxy(
		{
			poptip: { getInfo: key => key },
			filter: createFilterProxy("lib.filter"),
		},
		{
			get(target, key) {
				assert.ok(initialized || key === "filter", `early singleton read: lib.${String(key)}`);
				return target[key];
			},
		}
	),
	game: new Proxy(
		{
			import(type, factory) {
				registrations.push([type, factory()]);
			},
		},
		{
			get(target, key) {
				assert.ok(initialized || key === "import", `early singleton read: game.${String(key)}`);
				return target[key];
			},
		}
	),
	ui: new Proxy({}, { get: (_t, key) => assert.fail(`early ui read: ${String(key)}`) }),
	get: new Proxy({ poptip: key => key }, { get: (t, key) => (assert.ok(initialized, `early get read: ${String(key)}`), t[key]) }),
	ai: new Proxy({}, { get: (_t, key) => assert.fail(`early ai read: ${String(key)}`) }),
	_status: new Proxy({}, { get: (_t, key) => assert.fail(`early _status read: ${String(key)}`) }),
};

const globals = new SyntheticModule(
	Object.keys(exports),
	function () {
		for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
	},
	{ context, identifier: "noname" }
);

function load(filePath) {
	if (modules.has(filePath)) return modules.get(filePath);
	const mod = new SourceTextModule(readFileSync(filePath, "utf8"), { context, identifier: filePath });
	modules.set(filePath, mod);
	return mod;
}

const link = (specifier, parent) => (specifier === "noname" ? globals : load(resolve(dirname(parent.identifier), specifier)));

const skillEntry = load(resolve(root, "skill.js"));
await skillEntry.link(link);
await skillEntry.evaluate();
initialized = true;

const entry = load(resolve(root, "index.js"));
await entry.link(link);
await entry.evaluate();

assert.equal(registrations.length, 1);
assert.equal(registrations[0][0], "character");
const pack = registrations[0][1];
const registry = modules.get(resolve(root, "skill.js")).namespace.default;
assert.equal(pack.name, packName);
assert.deepEqual(Object.keys(pack.skill), Object.keys(registry));
assert.equal(Object.keys(registry).length, spec.count);
assert.equal(Object.keys(registry)[0], spec.first);
assert.equal(Object.keys(registry).at(-1), spec.last);

function collectKeysFromModule(modPath, exportName, outKeys) {
	const mod = modules.get(modPath);
	const src = ts.createSourceFile(modPath, readFileSync(modPath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	const decl = src.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations[0].name.getText(src) === exportName);
	const imports = new Map();
	for (const st of src.statements.filter(ts.isImportDeclaration)) {
		for (const el of st.importClause.namedBindings.elements) {
			imports.set(el.name.text, resolve(dirname(modPath), st.moduleSpecifier.text));
		}
	}
	for (const spread of decl.declarationList.declarations[0].initializer.properties) {
		assert.ok(ts.isSpreadAssignment(spread));
		const name = spread.expression.getText(src);
		const childPath = imports.get(name);
		assert.ok(childPath, `Missing import for ${name} in ${modPath}`);
		const childMod = modules.get(childPath);
		if (childPath.endsWith("/index.js") || childPath.endsWith("\\index.js")) {
			collectKeysFromModule(childPath, name, outKeys);
		} else {
			const group = childMod.namespace.groupSkills;
			for (const key of Object.keys(group)) {
				outKeys.push(key);
				assert.equal(registry[key], group[key]);
				assert.equal(pack.skill[key], group[key]);
			}
		}
	}
	void mod;
}

const orderedKeys = [];
collectKeysFromModule(resolve(root, "skill.js"), "skills", orderedKeys);
assert.deepEqual(Object.keys(registry), orderedKeys);

if (packName === "sp") {
	assert.equal(registry.olhedao.tianshuTrigger.length, 30);
	assert.equal(registry.olhedao.tianshuContent.length, 30);
	assert.equal(pack.skill.shenzhi, registry.shenzhi);
}

console.log(`real ${packName} split pack verified (${orderedKeys.length} skills)`);
