import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";
import dedent from "dedent";
import { saveLLMTextInput } from "../../llm/config-input.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const singletonNames = ["lib", "game", "get", "ui", "ai", "_status"];
const environmentNames = ["console", "window", "document", "alert", "confirm", "prompt", "localStorage", "navigator", "HTMLElement", "HTMLDivElement", "HTMLInputElement", "FileReader", "location", "require"];

/** Load the real entry and split modules; only platform dependencies are replaced. */
export async function loadLibraryModules(initial = {}, options = {}) {
	const modules = new Map();
	const dependencies = { game: { updateCardPackMenu() {} }, get: {}, ui: { updateCardPackMenu: [] }, ai: {}, _status: {}, ...initial };
	let initialized = false;
	const premature = new Proxy(
		{},
		{
			get(_target, key) {
				// Zhanfa schedules UI pack refresh in a microtask, after construction.
				if (initialized && key === "updateCardPackMenu") return [];
				throw new Error(`Singleton read before initialization: ${String(key)}`);
			},
		}
	);
	const synthetic = (id, values) => {
		const module = new SyntheticModule(
			Object.keys(values),
			function () {
				for (const [key, value] of Object.entries(values)) this.setExport(key, value);
			},
			{ identifier: id }
		);
		modules.set(id, module);
		return module;
	};
	const globals = synthetic("noname", Object.fromEntries(singletonNames.map(key => [key, premature])));
	const environment = synthetic("library:test-environment", Object.fromEntries(environmentNames.map(key => [key, globalThis[key]])));
	const mock = (relative, values) => synthetic(resolve(root, relative), values);
	const classes = Object.fromEntries(["Player", "Card", "VCard", "Button", "GameEvent", "Dialog", "Control", "Client", "NodeWS", "Character"].map(name => [name, class {}]));
	Object.defineProperty(classes.VCard.prototype, "virtualCardMarker", { value: true, configurable: true });
	mock("element/index.js", { ...classes, Content: {}, Contents: {} });
	mock("init/index.js", { LibInit: class {} });
	mock("announce/index.js", { Announce: class {} });
	mock("experimental/index.js", { experimental: {} });
	mock("poptip.js", { PoptipManager: class {}, HTMLPoptipElement: class {} });
	mock("../util/index.js", { assetURL: "", userAgentLowerCase: "", GeneratorFunction: Object.getPrototypeOf(function* () {}).constructor, AsyncFunction: Object.getPrototypeOf(async function () {}).constructor, characterDefaultPicturePath: "" });
	mock("../util/sandbox.js", { security: {}, ErrorManager: {} });
	mock("../init/onload/index.js", { defaultSplashs: [] });
	const bridge = {};
	mock("../ui/create/menu/vue/utils/menuBridge", { menuBridge: bridge });
	mock("../llm/config-input.js", { saveLLMTextInput });
	synthetic("dedent", { default: dedent });
	function load(path) {
		if (modules.has(path)) return modules.get(path);
		if (!existsSync(path) && path.endsWith(".js")) path = path.slice(0, -3) + ".ts";
		if (modules.has(path)) return modules.get(path);
		const source = ts.transpileModule(path === resolve(root, "index.js") && options.source ? options.source : readFileSync(path, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
		const module = new SourceTextModule(`import { ${environmentNames.join(", ")} } from "library:test-environment";\n${source}`, { identifier: path });
		modules.set(path, module);
		return module;
	}
	if (options.liveLibrary) {
		modules.set("library:test-singletons", globals);
		modules.set("noname", new SourceTextModule('export { lib } from "./index.js"; export { game, get, ui, ai, _status } from "library:test-singletons";', { identifier: resolve(root, "noname-fixture.js") }));
	}
	const entry = load(resolve(root, "index.js"));
	await entry.link((specifier, parent) => {
		if (modules.has(specifier)) return modules.get(specifier);
		const path = specifier.startsWith("@/") ? resolve(root, "..", specifier.slice(2)) : resolve(dirname(parent.identifier), specifier);
		return load(path);
	});
	globalThis.queueMicrotask(() => {
		initialized = true;
	});
	await entry.evaluate();
	const set = values => {
		Object.assign(dependencies, values);
		for (const name of singletonNames) globals.setExport(name, dependencies[name] ?? entry.namespace.lib);
		for (const name of environmentNames) environment.setExport(name, dependencies[name] ?? globalThis[name]);
		if (values.menuBridge) {
			for (const key of Object.keys(bridge)) delete bridge[key];
			Object.assign(bridge, values.menuBridge);
		}
	};
	set(initial);
	return {
		...entry.namespace,
		get lib() {
			return entry.namespace.lib;
		},
		set,
		field(name, values = {}) {
			set(values);
			const factoryName = "create" + name[0].toUpperCase() + name.slice(1);
			for (const module of modules.values()) {
				if (typeof module.namespace[factoryName] === "function") return module.namespace[factoryName]();
			}
			return entry.namespace.lib[name];
		},
		module(relative) {
			let path = resolve(root, relative);
			if (!modules.has(path) && path.endsWith(".js")) path = path.slice(0, -3) + ".ts";
			return modules.get(path)?.namespace;
		},
	};
}
