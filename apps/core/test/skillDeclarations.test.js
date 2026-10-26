import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

test("the original Skill declaration entry reaches every split global contract", () => {
	const root = fileURLToPath(new URL("../", import.meta.url));
	const directory = resolve(root, "typings");
	const entry = resolve(directory, "Skill.d.ts");
	const references = ts.preProcessFile(readFileSync(entry, "utf8")).referencedFiles;
	assert.equal(references.length, 13);
	const runtimeReferences = ts.preProcessFile(readFileSync(resolve(directory, "type.d.ts"), "utf8")).referencedFiles;
	assert.equal(runtimeReferences.length, 5);
	const fixturePath = resolve(root, "skillEntry.type-test.ts");
	const valid = ["declare const player: Player;", "const activation: Skill = { trigger: { player: 'phaseBegin' }, forced: true };", "const display: Skill = { mark: true, prompt2: false };", "const selection: Skill = { selectCard: 1, complexCard: true };", "const ai: SkillAI = { result: () => 2, tag: { damage: 1 } };", "const context: EffectLinkContext = { source: player, eff: 1, num: 1, odds: 1 };", "const factory: SelectionSpecFactory = () => ({});"];
	const invalid = ["const invalidSkill: Skill = { selectCard: 'bad' };", "const invalidAI: SkillAI = { result: () => false };", "const invalidTrigger: SkillTrigger = { player: 1 };"];
	valid.push("const select: Select = [1, 2];", "const sex: Sex = 'none';", "declare const pack: importCardConfig; declare const sampleRuntimeEvent: RuntimeGameEvent; declare const menu: menuData;");
	invalid.push("const invalidSelect: Select = ['bad', 2];", "const invalidSex: Sex = 'bad';");
	const fixture = [...valid, ...invalid].join("\n");
	const config = ts.readConfigFile(resolve(root, "tsconfig.json"), ts.sys.readFile);
	assert.equal(config.error, undefined);
	const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
	const host = ts.createCompilerHost(parsed.options);
	const getSource = host.getSourceFile.bind(host);
	host.getSourceFile = (path, version) => (resolve(path) === fixturePath ? ts.createSourceFile(path, fixture, version, true) : getSource(path, version));
	// Loading only the pre-existing root entries proves the triple-slash links,
	// rather than relying on independently including each newly split file.
	const entries = readdirSync(directory)
		.filter(name => name.endsWith(".d.ts") && !name.startsWith("Skill-") && !name.startsWith("type-"))
		.map(name => resolve(directory, name));
	const program = ts.createProgram([...entries, fixturePath], parsed.options, host);
	for (const reference of [...references, ...runtimeReferences]) {
		const path = resolve(directory, reference.fileName);
		assert.ok(program.getSourceFile(path), reference.fileName);
		assert.ok(readFileSync(path, "utf8").trimEnd().split(/\r?\n/).length <= 500, reference.fileName);
	}
	const diagnostics = ts.getPreEmitDiagnostics(program).filter(item => item.file && resolve(item.file.fileName) === fixturePath);
	const lines = [...new Set(diagnostics.map(item => item.file.getLineAndCharacterOfPosition(item.start).line))];
	assert.deepEqual(
		lines,
		invalid.map((_, index) => valid.length + index),
		diagnostics.map(item => ts.flattenDiagnosticMessageText(item.messageText, "\n")).join("\n")
	);
});
