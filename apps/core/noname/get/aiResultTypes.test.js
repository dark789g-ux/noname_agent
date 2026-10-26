import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

test("generated AI result declarations accept the precise protocol and reject unsafe fallback calls", () => {
	const root = fileURLToPath(new URL("../../", import.meta.url));
	const fixturePath = resolve(root, "aiResult.type-test.ts");
	const valid = [
		'import { Get } from "./dist-types/noname/get/index.js";',
		"declare const get: Get; declare const card: Card;",
		"const config: SkillAI = { result: { player: 1, target_use: false, ignoreStatus: true } };",
		"const numeric: SkillAI = { result: 2 };",
		"const dynamic: SkillAI = { result: item => item ? { player: 1 } : undefined };",
		"const absent: SkillAI = { result: () => null };",
		"const callback: AIResultResolver = item => 3; callback.keepAI = true;",
		'const result: AIResultConfig | number = get.result(card, "skill");',
		'get.result({ name: "sha" }, null);',
		'get.result("skill");',
		'get.result(Symbol("skill"));',
		"get.result(undefined);",
	];
	const invalid = [
		"const bad: SkillAI = { result: () => false };",
		"const badParam: SkillAI = { result: (item: number) => 1 };",
		'const badValue: SkillAI = { result: "score" };',
		"get.result(123);",
		"get.result(card, {});",
		"const lostPrecision: number = get.result(card);",
		'const invalidField: SkillAI = { result: { target: "score" } };',
	];
	const fixture = [...valid, ...invalid].join("\n");
	const options = { module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, baseUrl: root, paths: { "@/*": ["./dist-types/noname/*"], noname: ["./dist-types/noname.js"] }, noEmit: true, strict: true, target: ts.ScriptTarget.ESNext };
	const host = ts.createCompilerHost(options);
	const originalRead = host.getSourceFile.bind(host);
	const originalExists = host.fileExists.bind(host);
	host.fileExists = path => resolve(path) === fixturePath || originalExists(path);
	host.getSourceFile = (path, version) => resolve(path) === fixturePath ? ts.createSourceFile(path, fixture, version, true) : originalRead(path, version);
	const typings = ts.sys.readDirectory(resolve(root, "typings"), [".d.ts"]);
	const program = ts.createProgram([fixturePath, ...typings], options, host);
	const errors = ts.getPreEmitDiagnostics(program).filter(item => item.file && resolve(item.file.fileName) === fixturePath);
	assert.deepEqual(errors.map(item => item.file.getLineAndCharacterOfPosition(item.start).line), invalid.map((_, index) => valid.length + index), errors.map(item => ts.flattenDiagnosticMessageText(item.messageText, "\n")).join("\n"));
});
