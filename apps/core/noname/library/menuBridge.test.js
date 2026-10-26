import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

function declaration(name) {
	const node = source.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
	assert.ok(node, name);
	return node.getText(source);
}

function configOnclick(name) {
	let config;
	function visit(node) {
		if (config || !ts.isPropertyAssignment(node) || node.name.getText(source) !== name || !ts.isObjectLiteralExpression(node.initializer)) return;
		config = node.initializer;
	}
	ts.forEachChild(source, function walk(node) {
		visit(node);
		ts.forEachChild(node, walk);
	});
	assert.ok(config, name);
	const onclick = config.properties.find(property => ts.isMethodDeclaration(property) && property.name.getText(source) === "onclick");
	assert.ok(onclick, `${name}.onclick`);
	const parameters = onclick.parameters.map(parameter => parameter.getText(source)).join(",");
	return new Function("game", "lib", "alert", "refreshExtensionSourceMenu", "requestImportData", `return function(${parameters}) ${onclick.body.getText(source)}`);
}

function helpers(menuBridge) {
	return new Function("menuBridge", `${declaration("refreshExtensionSourceMenu")}; ${declaration("requestImportData")}; return { refreshExtensionSourceMenu, requestImportData };`)(menuBridge);
}

function extensionRuntime(sources, current, menuBridge) {
	const calls = [];
	const alerts = [];
	const lib = {
		config: { extension_sources: { ...sources }, extension_source: current },
		configMenu: { general: { config: { extension_source: { item: Object.fromEntries(Object.keys(sources).map(name => [name, name])) } } } },
	};
	const game = {
		saveConfig(name, value) {
			calls.push([name, value]);
			lib.config[name] = value;
		},
		prompt(_message, callback) {
			callback(this.answers.shift());
		},
		answers: [],
	};
	const { refreshExtensionSourceMenu, requestImportData } = helpers(menuBridge);
	return {
		alerts,
		calls,
		game,
		lib,
		create: configOnclick("extension_create")(game, lib, message => alerts.push(message), refreshExtensionSourceMenu, requestImportData),
		remove: configOnclick("extension_delete")(game, lib, message => alerts.push(message), refreshExtensionSourceMenu, requestImportData),
		importData: configOnclick("import_data")(game, lib, message => alerts.push(message), refreshExtensionSourceMenu, requestImportData),
	};
}

test("extension source creation keeps prompt and save order, then refreshes the Vue menu", () => {
	const refreshes = [];
	const runtime = extensionRuntime({ old: "https://old", keep: "https://keep" }, "old", { refreshOptionsConfig: name => refreshes.push(name), requestImportData: () => {} });
	runtime.game.answers.push("new", "https://new");
	runtime.create();
	assert.deepEqual(runtime.calls.map(([name]) => name), ["extension_sources", "extension_source"]);
	assert.equal(runtime.lib.config.extension_sources.new, "https://new");
	assert.equal(runtime.lib.config.extension_source, "new");
	assert.equal(runtime.lib.configMenu.general.config.extension_source.item.new, "new");
	assert.deepEqual(refreshes, ["extension_source"]);
	assert.deepEqual(runtime.alerts, ["已添加扩展地址：new"]);
});

test("extension source deletion retains the final-source protection and refreshes after a real deletion", () => {
	const refreshes = [];
	const protectedRuntime = extensionRuntime({ only: "https://only" }, "only", { refreshOptionsConfig: name => refreshes.push(name), requestImportData: () => {} });
	protectedRuntime.remove();
	assert.deepEqual(protectedRuntime.calls, []);
	assert.deepEqual(refreshes, []);
	assert.deepEqual(protectedRuntime.alerts, ["不能删除最后一个扩展地址！"]);

	const runtime = extensionRuntime({ old: "https://old", next: "https://next" }, "old", { refreshOptionsConfig: name => refreshes.push(name), requestImportData: () => {} });
	runtime.remove();
	assert.deepEqual(runtime.calls.map(([name]) => name), ["extension_source", "extension_sources"]);
	assert.equal(runtime.lib.config.extension_source, "next");
	assert.equal(runtime.lib.config.extension_sources.old, undefined);
	assert.equal(runtime.lib.configMenu.general.config.extension_source.item.old, undefined);
	assert.deepEqual(refreshes, ["extension_source"]);
});

test("required bridges fail explicitly, while import uses its bridge exactly once", () => {
	const missingRefresh = extensionRuntime({ old: "https://old", next: "https://next" }, "old", { refreshOptionsConfig: null, requestImportData: () => {} });
	assert.throws(() => missingRefresh.remove(), TypeError);

	let importCalls = 0;
	const runtime = extensionRuntime({ old: "https://old" }, "old", { refreshOptionsConfig: () => {}, requestImportData: () => importCalls++ });
	runtime.importData();
	assert.equal(importCalls, 1);
	const missingImport = extensionRuntime({ old: "https://old" }, "old", { refreshOptionsConfig: () => {}, requestImportData: null });
	assert.throws(() => missingImport.importData(), TypeError);
});
