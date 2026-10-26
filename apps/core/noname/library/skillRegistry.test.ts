import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";
import { defineBuiltinSkills, getRegisteredSkill, type SkillRegistry } from "./skillRegistry.js";

test("registry lookup excludes only confirmed metadata keys", () => {
	const registry: SkillRegistry = defineBuiltinSkills({
		global: ["global_skill"],
		globalmap: { global_skill: [] },
		ordinary: {},
		land_used: {},
	});

	assert.deepEqual(getRegisteredSkill(registry, "ordinary"), {});
	assert.deepEqual(getRegisteredSkill(registry, "land_used"), {});
	assert.equal(getRegisteredSkill(registry, "global"), undefined);
	assert.equal(getRegisteredSkill(registry, "globalmap"), undefined);
	registry.invalid = ["not_a_skill"];
	assert.throws(() => getRegisteredSkill(registry, "invalid"), /Non-metadata skill entry/);
	const symbolSkill = Symbol("skill");
	registry[symbolSkill] = {};
	assert.deepEqual(getRegisteredSkill(registry, symbolSkill), {});
});

test("finite built-ins reject invalid metadata and skill contracts", async () => {
	const directory = await mkdtemp(join(tmpdir(), "noname-skill-registry-"));
	const fixture = join(directory, "invalid.ts");
	await writeFile(
		fixture,
		`import type { BuiltinSkillRegistry } from ${JSON.stringify(join(process.cwd(), "noname/library/skillRegistry.js"))};
const invalidGlobal: Pick<BuiltinSkillRegistry, "global"> = { global: [1] };
const invalidHiddenCard: Pick<BuiltinSkillRegistry, "aozhan"> = { aozhan: { hiddenCard() { return "invalid"; } } };
const ordinarySkills: Pick<BuiltinSkillRegistry, "undist" | "land_used"> = { undist: {}, land_used: {} };
void invalidGlobal;
void invalidHiddenCard;
void ordinarySkills;`
	);
	try {
		const config = ts.readConfigFile(join(process.cwd(), "tsconfig.json"), ts.sys.readFile);
		assert.equal(config.error, undefined);
		const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
		const typeFiles = ts.sys.readDirectory(join(process.cwd(), "typings"), [".d.ts"]);
		const program = ts.createProgram([...typeFiles, join(process.cwd(), "noname/library/skillRegistry.ts"), fixture], parsed.options);
		const messages = ts.getPreEmitDiagnostics(program)
			.filter(diagnostic => diagnostic.file?.fileName.endsWith("invalid.ts"))
			.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
		assert.ok(messages.some(message => message.includes("number") && message.includes("string")), messages.join("\n"));
		assert.ok(messages.some(message => message.includes("hiddenCard") || message.includes("string") && message.includes("boolean")), messages.join("\n"));
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
