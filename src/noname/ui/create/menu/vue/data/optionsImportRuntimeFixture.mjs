import assert from "node:assert/strict";
import console from "node:console";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";

const root = dirname(fileURLToPath(import.meta.url));
const calls = [];
const storage = new Map([
	["noname_inited", "yes"],
	["test_key", "key"],
]);
const config = {
	customBackgroundMusic: {},
	all: {
		background_music: {
			add(link) {
				calls.push(["add", link]);
			},
		},
	},
};
const library = {
	config,
	configprefix: "test_",
	db: false,
	configMenu: { audio: { config: { background_music: { item: {} } } } },
	init: {
		decode(value) {
			calls.push(["decode", value]);
			return value;
		},
		background() {
			calls.push(["background"]);
		},
	},
};
const status = {};
const game = {
	reload() {
		calls.push(["reload"]);
	},
	writeFile(file, directory, filename, callback) {
		calls.push(["write", file, directory, filename]);
		callback();
	},
	prompt(text, bool, callback) {
		calls.push(["prompt", text, bool]);
		callback("renamed");
	},
	saveConfig(key, value) {
		calls.push(["save", key, value]);
	},
	playBackgroundMusic() {
		calls.push(["play"]);
	},
};
let ready = false;
const guard = object =>
	new Proxy(object, {
		get(target, key) {
			assert.equal(ready, true, `Early singleton read: ${String(key)}`);
			return target[key];
		},
	});
const values = { lib: guard(library), game: guard(game), get: guard({}), ui: guard({}), _status: guard(status) };
const component = {};
const context = createContext({
	console,
	alert(message) {
		calls.push(["alert", message]);
	},
	confirm() {
		throw new Error("Unexpected duplicate-music confirmation");
	},
	FileReader: class {
		readAsText(file, encoding) {
			calls.push(["read", file, encoding]);
			this.onload({ target: { result: JSON.stringify({ imported: "value" }) } });
		}
	},
	localStorage: {
		getItem(key) {
			calls.push(["get", key]);
			return storage.get(key) ?? null;
		},
		clear() {
			calls.push(["clear"]);
			storage.clear();
		},
		setItem(key, value) {
			calls.push(["set", key, value]);
			storage.set(key, value);
		},
	},
});
const modules = new Map();
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
const globals = synthetic("noname", values);
const vue = synthetic("vue", { reactive: value => value, markRaw: value => value });
const pane = synthetic("OptionsRightPane.vue", { default: component });
function load(path) {
	if (modules.has(path)) return modules.get(path);
	const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
	const module = new SourceTextModule(code, { context, identifier: path });
	modules.set(path, module);
	return module;
}
const entry = load(resolve(root, "optionsMenuData.ts"));
await entry.link((specifier, parent) => {
	if (specifier === "noname") return globals;
	if (specifier === "vue") return vue;
	if (specifier.endsWith("OptionsRightPane.vue")) return pane;
	let path = resolve(dirname(parent.identifier), specifier);
	if (!existsSync(path)) path += ".ts";
	return load(path);
});
await entry.evaluate();
assert.equal(calls.length, 0);
const handlers = modules.get(resolve(root, "optionsImportHandlers.ts")).namespace;
assert.equal(entry.namespace.handleImportDataButton, handlers.handleImportDataButton);
assert.equal(entry.namespace.handleImportMusic, handlers.handleImportMusic);
assert.equal(entry.namespace.default.rightPaneComponent, component);
const menuState = modules.get(resolve(root, "../menuState.ts")).namespace;
const bridge = modules.get(resolve(root, "../utils/menuBridge.ts")).namespace.menuBridge;
assert.equal(menuState.menuInits.length, 1);
assert.equal(typeof bridge.refreshOptionsConfig, "function");
ready = true;
const dataFile = {};
entry.namespace.handleImportDataButton(dataFile);
assert.equal(calls[0][0], "read");
assert.equal(calls[0][1], dataFile);
assert.equal(calls[0][2], "UTF-8");
assert.deepEqual(
	calls.map(call => call[0]),
	["read", "decode", "get", "get", "clear", "set", "set", "set", "alert", "background", "reload"]
);
assert.deepEqual(
	[...storage],
	[
		["noname_inited", "yes"],
		["test_key", "key"],
		["imported", "value"],
	]
);
calls.length = 0;
const originalRefresh = bridge.refreshOptionsConfig;
bridge.refreshOptionsConfig = name => calls.push(["refresh", name]);
const musicFile = { name: "song.mp3" };
entry.namespace.handleImportMusic(musicFile);
assert.deepEqual(
	calls.map(call => call[0]),
	["write", "prompt", "add", "save", "save", "play", "refresh"]
);
assert.equal(calls[0][1], musicFile);
assert.equal(calls[0][2], "audio/background");
assert.equal(calls[0][3], "cdv_song.mp3");
assert.equal(config.customBackgroundMusic.cdv_song, "renamed");
assert.equal(config.background_music, "cdv_song");
assert.equal(library.configMenu.audio.config.background_music.item.cdv_song, "renamed");
assert.equal(status.music_importing, false);
bridge.refreshOptionsConfig = originalRefresh;
console.log("real options menu modules: exports, deferred singleton reads, initialization and import callback order verified");
