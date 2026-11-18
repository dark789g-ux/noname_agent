import { loadLibraryModules } from "./moduleLoader.mjs";
export const runtime = await loadLibraryModules();
export const field = (name, dependencies) => runtime.field(name, dependencies);
export function config(name, dependencies) {
	const menu = field("configMenu", dependencies);
	for (const group of Object.values(menu)) if (group.config && name in group.config) return group.config[name];
	const modes = field("mode", dependencies);
	for (const mode of Object.values(modes)) if (mode.config && name in mode.config) return mode.config[name];
	throw new Error(`Unknown library config: ${name}`);
}
