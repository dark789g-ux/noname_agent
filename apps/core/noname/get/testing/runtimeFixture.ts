import { fileURLToPath } from "node:url";
import { createModuleRuntime } from "../../llm/testing/module-runtime.mjs";
import { getRegisteredSkill, requireRegisteredSkill } from "../../library/skillRegistry.js";
import { copyValue } from "../copy.js";

const core = new URL("../../../", import.meta.url);
const source = (path: string) => fileURLToPath(new URL(path, core));

/** Load the real facade, installer and every implementation module together. */
export async function loadGet(engine: { lib?: object; game?: object; ui?: object } = {}) {
	const dictionary = {};
	const registrations: object[] = [];
	class Is {}
	class Promises {}
	class Audio {}
	const lib = { config: { dev: false }, ...engine.lib };
	const window = {} as { get?: unknown };
	const runtime = await createModuleRuntime(
		{ ...engine, lib, rootURL: "" },
		{ window },
		{
			[source("noname/get/is.js")]: { Is },
			[source("noname/get/promises")]: { Promises },
			[source("noname/get/audio.ts")]: { Audio },
			[source("noname/get/pinyins/noname-dict.js")]: { default: dictionary },
			[source("noname/get/copy.js")]: { copyValue },
			[source("noname/library/skillRegistry.js")]: { getRegisteredSkill, requireRegisteredSkill },
			"pinyin-pro": { addDict: (value: object) => registrations.push(value) },
			jszip: { default: class JSZip {} },
			"@/util/index.js": {
				GeneratorFunction: function* () {}.constructor,
				AsyncFunction: async function () {}.constructor,
				AsyncGeneratorFunction: async function* () {}.constructor,
				userAgentLowerCase: "",
			},
			"@/util/sandbox.js": {
				security: { isSandboxRequired: () => false, exec: (code: string) => new Function(code)() },
				CodeSnippet: class {},
				ErrorManager: class {
					static setCodeSnippet() {}
				},
			},
			"@/library/poptip.js": { HTMLPoptipElement: class {} },
			"@/library/cache/cacheContext.js": { CacheContext: class {} },
		}
	);
	const module = await runtime.import("noname/get/index.js");
	return { module, lib, window, dictionary, registrations, Is, Promises, Audio, runtime };
}
