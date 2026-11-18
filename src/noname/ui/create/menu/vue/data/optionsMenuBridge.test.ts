import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("optionsMenuData.ts", readFileSync(new URL("./optionsMenuData.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const refreshDeclaration = source.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === "refreshOptionsConfig");
assert.ok(refreshDeclaration);

function createRefresh(lib: object, get: { copy(value: object): object }, modeConfigsCache: Map<string, object[]>) {
	const compiled = ts.transpileModule(refreshDeclaration.getText(source), {
		compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
	}).outputText;
	return new Function("lib", "get", "modeConfigsCache", `${compiled}; return refreshOptionsConfig;`)(lib, get, modeConfigsCache);
}

test("extension source refresh copies the canonical item and current selection into the Vue cache", () => {
	let updates = 0;
	const cached = {
		_name: "extension_source",
		item: { old: "old" },
		init: "old",
		update() {
			updates++;
		},
	};
	const canonicalItem = { old: "old", newer: "newer" };
	const lib = {
		config: { extension_source: "newer" },
		configMenu: { general: { config: { extension_source: { item: canonicalItem } } } },
	};
	createRefresh(lib, { copy: value => ({ ...value }) }, new Map([["general", [cached]]]))("extension_source");
	assert.deepEqual(cached.item, canonicalItem);
	assert.notEqual(cached.item, canonicalItem);
	assert.equal(cached.init, "newer");
	assert.equal(updates, 1);
});
