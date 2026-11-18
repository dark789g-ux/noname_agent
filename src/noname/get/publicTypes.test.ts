import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

test("emitted Get facade preserves overloads, generics, booleans and JS optional arguments", () => {
	const core = fileURLToPath(new URL("../../", import.meta.url));
	const file = resolve(core, "identityGetContract.type-test.ts");
	const text = ['import { Get, get, setGet } from "./dist-types/noname/get/index.js";', "const instance: Get = new Get(); setGet(instance); setGet();", "get.config('identity_mode'); get.filter();", "const copied: { value: number } = get.copy({ value: 1 });", "const numeric: number | undefined = get.max([1,2], value => value);", "const item: { value: number } | undefined = get.min([{ value: 1 }], value => value.value, 'item');", "const tied: { value: number }[] = get.max([{ value: 1 }], 'value', 'list');", "const valid: boolean = get.isFunctionBody('return 1');", "const clean: string = get.pureFunctionStr('() => 1');", "// @ts-expect-error explicit JS/JSDoc input restrictions remain in force", "get.autoViewAs('sha');", "// @ts-expect-error max still requires a scoring key or callback", "get.max([1,2]);", "// @ts-expect-error boolean results are not silently widened to any", "const bad: number = get.isFunctionBody('return 1');"].join("\n");
	const config = ts.readConfigFile(resolve(core, "tsconfig.json"), ts.sys.readFile);
	const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, core);
	const host = ts.createCompilerHost(parsed.options);
	const read = host.readFile.bind(host);
	const exists = host.fileExists.bind(host);
	host.readFile = name => (resolve(name) === file ? text : read(name));
	host.fileExists = name => resolve(name) === file || exists(name);
	const program = ts.createProgram([file, ...parsed.fileNames.filter(name => /[\\/]typings[\\/]/.test(name))], parsed.options, host);
	const source = program.getSourceFile(file)!;
	const diagnostics = [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)];
	assert.deepEqual(
		diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
		[]
	);
});
