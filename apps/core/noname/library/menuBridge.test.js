import { runtime, config } from "./testing/fixtures.mjs";
import assert from "node:assert/strict";

import test from "node:test";

function configOnclick(name) {
	return (game, lib, alert, _refresh, _request) => config(name, { game, lib, alert }).onclick;
}
function helpers(menuBridge) {
	runtime.set({ menuBridge });
	return runtime.module("configuration/menuBridge.ts");
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
	assert.deepEqual(
		runtime.calls.map(([name]) => name),
		["extension_sources", "extension_source"]
	);
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
	assert.deepEqual(
		runtime.calls.map(([name]) => name),
		["extension_source", "extension_sources"]
	);
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
