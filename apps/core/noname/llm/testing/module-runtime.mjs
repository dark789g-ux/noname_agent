import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import console from "node:console";
import { setTimeout, clearTimeout } from "node:timers";
import { createContext, runInContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";

const core = fileURLToPath(new URL("../../../", import.meta.url));

/** Load actual source modules in an isolated engine, without source extraction. */
export async function createModuleRuntime(engine = {}, globals = {}, overrides = {}) {
	const context = createContext({ console, setTimeout, clearTimeout, URL, ...globals });
	const modules = new Map();
	const singletons = { lib: {}, game: {}, get: {}, ui: {}, ai: {}, _status: {}, ...engine };
	const replacements = {
		noname: singletons,
		"@/util/index.js": { delay: async () => {} },
		"@/llm/index.js": { tryLLMDecide: async () => ({ handled: false }) },
		[resolve(core, "noname/library/element/gameEvent.js")]: { GameEvent: class GameEvent {}, initializeEvent: event => event },
		[resolve(core, "noname/library/element/player.js")]: { Player: class Player {} },
		...overrides,
	};
	function synthetic(id, values) {
		if (!modules.has(id)) {
			modules.set(
				id,
				new SyntheticModule(
					Object.keys(values),
					function () {
						for (const [key, value] of Object.entries(values)) this.setExport(key, value);
					},
					{ context, identifier: id }
				)
			);
		}
		return modules.get(id);
	}
	function load(id) {
		if (Object.hasOwn(replacements, id)) return synthetic(id, replacements[id]);
		if (!existsSync(id) && id.endsWith(".js")) id = id.slice(0, -3) + ".ts";
		if (modules.has(id)) return modules.get(id);
		let text = readFileSync(id, "utf8");
		if (id.endsWith(".ts")) text = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
		const module = new SourceTextModule(text, { context, identifier: id });
		modules.set(id, module);
		return module;
	}
	const link = (specifier, parent) => load(Object.hasOwn(replacements, specifier) ? specifier : specifier.startsWith("@/") ? resolve(core, "noname", specifier.slice(2)) : resolve(dirname(parent.identifier), specifier));
	return {
		engine: singletons,
		modules,
		run: source => runInContext(source, context),
		async import(relative) {
			const module = load(resolve(core, relative));
			if (module.status === "unlinked") await module.link(link);
			if (module.status === "linked") await module.evaluate();
			return module.namespace;
		},
	};
}
