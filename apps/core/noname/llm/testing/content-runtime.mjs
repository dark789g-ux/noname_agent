import ts from "typescript";
import { createModuleRuntime } from "./module-runtime.mjs";

/** Execute the registry with supplied engine objects. */
export async function loadContent(engine, globals, overrides) {
	const runtime = await createModuleRuntime(engine, globals, overrides);
	return (await runtime.import("noname/library/element/content.ts")).Content;
}

/**
 * Wire callbacks must still be inspected without their module closures. Derive
 * that inspection source from loaded exports, rather than a historical file's
 * layout. Whole-event behavior tests use loadContent directly.
 */
export async function contentTestSource() {
	const runtime = await createModuleRuntime();
	const { Content } = await runtime.import("noname/library/element/content.ts");
	const helpers = await runtime.import("noname/library/element/content/selectionResults.ts");
	const declarations = Object.values(helpers)
		.filter(value => typeof value === "function")
		.map(value => value.toString());
	const predicates = Object.values(helpers.selectionResultRuntime).map(value => value.toString());
	const members = Object.entries(Content).map(([key, value]) => (Array.isArray(value) ? `${key}: [${value.map(fn => fn.toString()).join(",\n")}]` : value.toString()));
	return ts.createSourceFile("loaded-content.js", `${declarations.join("\n")}\nconst selectionResultRuntime = {${predicates.join(",\n")}};\nconst Content = {${members.join(",\n")}};`, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}
