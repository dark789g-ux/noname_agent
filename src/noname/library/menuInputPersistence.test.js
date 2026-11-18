import { field, config } from "./testing/fixtures.mjs";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { JSDOM } from "jsdom";
import { IDBFactory } from "fake-indexeddb";
import { parse, compileScript } from "vue/compiler-sfc";
import ts from "typescript";
import { copyValue } from "../get/copy.js";
import { openMainDatabase } from "../init/database-schema.js";
import { SqliteDatabase, transaction } from "../storage/database.js";
import { StorageTransport } from "../storage/transport.js";
import { migrateIndexedDB } from "../storage/migration.js";
import { SqliteStorage } from "../../../../packages/fs/src/storage/database.js";
import { initLLMTextInput, saveLLMTextInput } from "../llm/config-input.js";
import { migrateLLMTextConfig } from "../llm/config.js";

// Load Vue after installing the DOM, so runtime-dom captures this document.
const dom = new JSDOM("<body></body>");
for (const key of ["window", "document", "HTMLElement", "Element", "SVGElement", "Node"]) globalThis[key] = dom.window[key];
const require = createRequire(import.meta.url);
const vue = require("vue");

function source(relative) {
	return ts.createSourceFile(relative, readFileSync(new URL(relative, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
}

function findNode(root, predicate) {
	if (predicate(root)) return root;
	return ts.forEachChild(root, child => findNode(child, predicate));
}

function evaluate(text, dependencies) {
	const compiled = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText;
	return new Function(...Object.keys(dependencies), compiled)(...Object.values(dependencies));
}

const options = source("../ui/create/menu/vue/data/optionsMenuData.ts");
const build = findNode(options, node => ts.isFunctionDeclaration(node) && node.name?.text === "buildModeConfigs");
const gameSource = source("../game/index.js");
const saveConfig = findNode(gameSource, node => ts.isMethodDeclaration(node) && node.name.getText(gameSource) === "saveConfig");
const util = source("../util/config.js");
const save = findNode(util, node => ts.isFunctionDeclaration(node) && node.name?.text === "save");
const componentPath = "../ui/create/menu/vue/components/NonameConfig.vue";
const component = compileScript(parse(readFileSync(new URL(componentPath, import.meta.url), "utf8")).descriptor, { id: "input-persistence-test", inlineTemplate: true }).content;

async function persistence(t, backend) {
	if (backend === "indexedDB") {
		const database = await openMainDatabase(new IDBFactory(), "input-test");
		t.after(() => database.close());
		return database;
	}
	const directory = mkdtempSync(path.join(tmpdir(), "noname-menu-input-"));
	const storage = new SqliteStorage(path.join(directory, "test.sqlite"));
	t.after(() => {
		storage.close();
		rmSync(directory, { recursive: true, force: true });
	});
	const transport = new StorageTransport(
		async (_url, options) => {
			const input = JSON.parse(String(options.body));
			return Response.json({ result: storage.execute(input.id, input) });
		},
		async error => {
			throw error;
		}
	);
	await migrateIndexedDB(transport, undefined, "input-test", "test");
	return new SqliteDatabase(transport, "main");
}

function runtime(database) {
	const pending = [];
	const lib = { db: database, config: {}, setIntro() {} };
	const game = {
		putDB(store, key, value) {
			const write = transaction(database, [store], "readwrite", operation => operation.objectStore(store).put(value, key));
			pending.push(write);
			return write;
		},
	};
	const dependencies = { lib, game, _status: {}, saveLLMTextInput };
	const saveFunction = evaluate(`${save.getText(util).replace("export ", "")}; return save;`, dependencies);
	game.saveConfig = evaluate(`return function ${saveConfig.getText(gameSource)};`, { ...dependencies, save: saveFunction });
	lib.configMenu = { llm: field("configMenu", dependencies).llm };
	const buildConfigs = evaluate(`${build.getText(options)}; return buildModeConfigs;`, {
		...dependencies,
		reactive: vue.reactive,
		get: { copy: value => copyValue(value, false, new WeakMap()) },
		makeConfigAdapter: value => value,
	});
	const exports = {};
	evaluate(component, {
		exports,
		require: name => (name === "vue" ? vue : name === "noname" ? dependencies : name.endsWith("/llm/config-input.js") ? { initLLMTextInput } : {}),
	});
	return {
		lib,
		configs: () => buildConfigs("llm"),
		migrate: () => migrateLLMTextConfig(lib.config, (key, value) => game.saveConfig(key, value), document),
		flush: () => Promise.all(pending),
		mount(config) {
			const host = document.createElement("div");
			document.body.append(host);
			const app = vue.createApp(exports.default, { config });
			app.mount(host);
			return {
				input: host.querySelector(".config-input"),
				close() {
					app.unmount();
					host.remove();
				},
			};
		},
	};
}

async function readConfig(database) {
	if (database instanceof SqliteDatabase) return Object.fromEntries((await database.entries("config")).map(row => [row.key, row.value]));
	return new Promise((resolve, reject) => {
		const result = {};
		const reading = database.transaction("config", "readonly");
		const cursor = reading.objectStore("config").openCursor();
		cursor.onsuccess = () => {
			if (cursor.result) {
				result[cursor.result.key] = cursor.result.value;
				cursor.result.continue();
			}
		};
		reading.oncomplete = () => resolve(result);
		reading.onerror = () => reject(reading.error);
	});
}

for (const backend of ["indexedDB", "sqlite"]) {
	test(`${backend}: rich text is saved as plain text and survives a fresh load`, async t => {
		const database = await persistence(t, backend);
		const context = runtime(database);
		const values = { llm_url: "https://example.invalid/v1?a=1&b=2", llm_model: "test-model", llm_apikey: "test-only-key" };
		for (const config of context.configs().filter(config => config._name in values)) {
			const view = context.mount(config);
			view.input.focus();
			view.input.innerHTML = `<span style="color:red"> ${values[config._name].replaceAll("&", "&amp;")} </span><br>`;
			view.input.blur();
			assert.equal(config.init, values[config._name]);
			assert.equal(view.input.children.length, 0);
			assert.match(view.input.parentElement.querySelector('[role="status"]').textContent, /下局生效/);
			view.close();
		}
		await context.flush();
		const reloaded = runtime(database);
		reloaded.lib.config = await readConfig(database);
		for (const config of reloaded.configs().filter(config => config._name in values)) {
			const view = reloaded.mount(config);
			assert.equal(view.input.textContent, values[config._name]);
			view.close();
		}
	});

	test(`${backend}: invalid addresses are shown but cannot overwrite saved configuration`, async t => {
		const database = await persistence(t, backend);
		const context = runtime(database);
		const config = context.configs().find(config => config._name === "llm_url");
		const view = context.mount(config);
		for (const value of ["https://example.invalid/v1", "example.invalid/v1"]) {
			view.input.focus();
			view.input.textContent = value;
			view.input.blur();
		}
		assert.equal(view.input.getAttribute("aria-invalid"), "true");
		assert.match(view.input.parentElement.querySelector('[role="status"]').textContent, /完整的 http/);
		await context.flush();
		assert.equal((await readConfig(database)).llm_url, "https://example.invalid/v1");
		view.input.focus();
		view.input.textContent = "";
		view.input.blur();
		assert.equal(view.input.getAttribute("aria-invalid"), "false");
		await context.flush();
		assert.equal((await readConfig(database)).llm_url, "");
		view.close();
	});

	test(`${backend}: legacy markup is migrated before rendering and is durable`, async t => {
		const database = await persistence(t, backend);
		const context = runtime(database);
		context.lib.config = { llm_url: '<span style="color:red">https://example.invalid/v1</span>', llm_model: "<b>test-model</b>", llm_apikey: " test-only-key " };
		context.migrate();
		await context.flush();
		const reloaded = runtime(database);
		reloaded.lib.config = await readConfig(database);
		assert.deepEqual(reloaded.lib.config, { llm_url: "https://example.invalid/v1", llm_model: "test-model", llm_apikey: "test-only-key" });
		for (const config of reloaded.configs().filter(config => ["llm_url", "llm_model", "llm_apikey"].includes(config._name))) {
			const view = reloaded.mount(config);
			assert.equal(view.input.textContent, reloaded.lib.config[config._name]);
			assert.equal(view.input.children.length, 0);
			view.close();
		}
		await reloaded.flush();
	});

	test(`${backend}: paste inserts only clipboard text at the selection`, async t => {
		const database = await persistence(t, backend);
		const context = runtime(database);
		const config = context.configs().find(config => config._name === "llm_model");
		const view = context.mount(config);
		view.input.focus();
		view.input.textContent = "replace";
		const range = document.createRange();
		range.selectNodeContents(view.input);
		const selection = document.getSelection();
		selection.removeAllRanges();
		selection.addRange(range);
		const paste = new dom.window.Event("paste", { bubbles: true, cancelable: true });
		Object.defineProperty(paste, "clipboardData", { value: { getData: type => (type === "text/plain" ? "test-model" : "<b>wrong</b>") } });
		view.input.dispatchEvent(paste);
		assert.equal(paste.defaultPrevented, true);
		assert.equal(view.input.textContent, "test-model");
		assert.equal(view.input.children.length, 0);
		view.input.blur();
		await context.flush();
		assert.equal((await readConfig(database)).llm_model, "test-model");
		view.close();
	});

	test(`${backend}: LLM edits survive remount, another blur, and fresh configuration loading`, async t => {
		const database = await persistence(t, backend);
		const context = runtime(database);
		const configs = context.configs();
		const values = {
			llm_url: "https://example.invalid/v1",
			llm_apikey: "test-only-key",
			llm_model: "test-model",
			llm_timeout: 25,
			llm_decision_timeout: 120,
		};
		for (const [key, value] of Object.entries(values)) {
			const config = configs.find(config => config._name === key);
			let view = context.mount(config);
			view.input.focus();
			view.input.textContent = String(value);
			// Enter uses the real component's key handler to trigger native blur.
			view.input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
			await vue.nextTick();
			await context.flush();
			assert.equal((await readConfig(database))[key], value, `${key}: blur must persist before remount`);
			view.close();
			view = context.mount(config);
			try {
				assert.equal(view.input.textContent, String(value), `${key}: remount must restore the edit`);
				view.input.focus();
				view.input.blur();
				await context.flush();
			} finally {
				view.close();
			}
		}
		// A fresh runtime and fresh menu cache model page reload, reading persisted values.
		const reloaded = runtime(database);
		reloaded.lib.config = await readConfig(database);
		const freshConfigs = reloaded.configs();
		for (const [key, value] of Object.entries(values)) {
			assert.equal(reloaded.lib.config[key], value, `${key}: persisted value`);
			const view = reloaded.mount(freshConfigs.find(config => config._name === key));
			try {
				assert.equal(view.input.textContent, String(value));
			} finally {
				view.close();
			}
		}
		await reloaded.flush();
	});

	test(`${backend}: cached inputs retain normalized values and allow deliberate clearing`, async t => {
		const database = await persistence(t, backend);
		const context = runtime(database);
		const configs = context.configs();
		for (const key of ["llm_timeout", "llm_decision_timeout"]) {
			const config = configs.find(config => config._name === key);
			const view = context.mount(config);
			try {
				view.input.focus();
				view.input.textContent = "900";
				view.input.blur();
				assert.equal(config.init, "300");
			} finally {
				view.close();
			}
		}
		const config = configs.find(config => config._name === "llm_model");
		for (const value of ["test-model", ""]) {
			const view = context.mount(config);
			try {
				view.input.focus();
				view.input.textContent = value;
				view.input.blur();
				assert.equal(config.init, value);
			} finally {
				view.close();
			}
		}
		await context.flush();
		const stored = await readConfig(database);
		assert.equal(stored.llm_timeout, 300);
		assert.equal(stored.llm_decision_timeout, 300);
		assert.equal(stored.llm_model, "");
	});
}
