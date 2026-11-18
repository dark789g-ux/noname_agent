import assert from "node:assert/strict";
import test from "node:test";
import { createSkillRuntime } from "./skill-runtime.mjs";

const f = await createSkillRuntime();
const scope = await f.moduleRuntime.import("noname/llm/support-scope.ts");

test("fixed rosters and acquired skills exactly match actual pack definitions", async () => {
	const standard = (await f.moduleRuntime.import("character/standard/character.js")).default;
	const refresh = (await f.moduleRuntime.import("character/refresh/character.js")).default;
	const sort = (await f.moduleRuntime.import("character/refresh/sort.js")).characterSort;
	assert.deepEqual(Object.keys(standard), Array.from(scope.standardCharacters));
	assert.deepEqual(Array.from(sort.refresh_standard), Array.from(scope.refreshStandardCharacters));
	assert.equal(scope.standardCharacters.length, 33);
	assert.equal(scope.refreshStandardCharacters.length, 29);
	for (const [characters, roster, expected] of [
		[standard, scope.standardCharacters, scope.standardActiveSkills],
		[refresh, scope.refreshStandardCharacters, scope.refreshActiveSkills],
	]) {
		const records = scope.collectSkillScope(characters, roster, f.lib.skill);
		const active = records.filter(record => record.kind === "active");
		assert.deepEqual(Array.from(active, record => record.id).sort(), Array.from(expected).sort());
		for (const record of active) assert.ok(f.lib.skill[record.id].selectionSpec, record.id);
	}
	const records = scope.collectSkillScope(refresh, scope.refreshStandardCharacters, f.lib.skill);
	assert.equal(records.find(record => record.id === "gongxin").acquiredBy, "qinxue");
	assert.equal(records.find(record => record.id === "jianyan").acquiredBy, "qianxin");
});

test("standard optional decisions are explicitly distinguished from engine-only skills", async () => {
	const standard = (await f.moduleRuntime.import("character/standard/character.js")).default;
	const records = scope.collectSkillScope(standard, scope.standardCharacters, f.lib.skill);
	for (const id of Object.keys(scope.standardDecisionFlows))
		assert.ok(
			records.some(record => record.id === id && record.kind === "decision"),
			id
		);
	for (const id of ["paoxiao", "mashu", "kongcheng", "qicai", "wushuang"]) assert.equal(records.find(record => record.id === id).kind, "automatic");
});
