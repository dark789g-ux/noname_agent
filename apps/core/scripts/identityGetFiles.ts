import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain } from "./isMain.js";

/** Only this refactor's implementation graph, never node_modules/workspaces. */
export function identityGetFiles(core: string): string[] {
	function walk(path: string): string[] {
		return readdirSync(path, { withFileTypes: true }).flatMap(entry => (entry.isDirectory() ? walk(join(path, entry.name)) : /\.(?:[cm]?js|ts)$/.test(entry.name) ? [join(path, entry.name)] : []));
	}
	return [...["mode/identity.js", "noname/get/index.js", "noname/get/Get.ts", "noname/get/runtime.ts", "noname/get/binding.ts", "noname/get/dependencies.ts", "noname/get/installGetMethods.ts", "noname/get/methodGroups.ts", "noname/get/build.test.ts"].map(path => join(core, path)), ...["mode/identity", "noname/get/contracts", "noname/get/methods", "noname/get/intro", "noname/get/testing"].flatMap(path => walk(join(core, path)))];
}

export function identityGetVerificationFiles(core: string): string[] {
	return [...new Set([...identityGetFiles(core), ...["noname/get/publicContract.test.mjs", "noname/get/publicTypes.test.ts", "noname/get/nodeIntroRuntime.test.ts", ...["aiResultProtocol", "autoViewAsProtocol", "cardType", "copy", "effectLink", "eventPrompt", "experimentalCardOwner", "parentSource", "platformBoundary", "runtimeDefects", "translationInfo", "vcardWire"].map(name => `noname/get/${name}.test.js`), "noname/get/infoRegistry.test.ts", ...["washCard", "registrationMusic", "cardMoveInitialization"].map(name => `noname/game/${name}.test.js`), "noname/llm/character-selection/identity-fixture.mjs", "noname/llm/character-selection/identity.test.mjs", "noname/llm/character-selection/build.test.ts", "scripts/build.ts", "scripts/individualSourceTargets.ts", "scripts/identityGetFiles.ts", "scripts/checkIdentityGet.ts", "typings/GetRuntime.d.ts"].map(path => join(core, path))])];
}

if (isMain(import.meta)) {
	for (const file of identityGetVerificationFiles(fileURLToPath(new URL("../", import.meta.url)))) console.log(file);
}
