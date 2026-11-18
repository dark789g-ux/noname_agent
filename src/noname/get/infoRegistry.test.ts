import { getTestText } from "./testing/testSource.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";
import { getRegisteredSkill, type SkillRegistry } from "../library/skillRegistry.js";

function readInfoMethod() {
	const path = join(process.cwd(), "noname/get/index.js");
	const source = ts.createSourceFile(path, getTestText(), ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
	const getClass = source.statements.find((statement): statement is ts.ClassDeclaration => ts.isClassDeclaration(statement) && statement.name?.text === "Get");
	if (!getClass) {
		throw new Error("Get class is missing");
	}
	const method = getClass.members.find(member => ts.isMethodDeclaration(member) && member.name.getText(source) === "info");
	if (!method) {
		throw new Error("Get.info is missing");
	}
	return method.getText(source).replace(/^info\(/, "function info(");
}

test("Get.info excludes metadata keys while retaining string and symbol skills", () => {
	const source = readInfoMethod();
	const registry: SkillRegistry = defineRegistry();
	const warn = console.warn;
	const warnings: string[] = [];
	console.warn = message => warnings.push(String(message));
	try {
		const info = new Function("lib", "get", "getRegisteredSkill", `return ${source}`)({ skill: registry }, {}, getRegisteredSkill);
		if (typeof info !== "function") {
			throw new Error("Get.info extraction did not produce a function");
		}
		assert.equal(info("ordinary"), registry.ordinary);
		assert.deepEqual(info("global"), {});
		assert.deepEqual(info("globalmap"), {});
		const symbol = Symbol("skill");
		registry[symbol] = {};
		assert.equal(info(symbol), registry[symbol]);
		assert.equal(warnings.length, 2);
	} finally {
		console.warn = warn;
	}
});

function defineRegistry(): SkillRegistry {
	return {
		global: ["ordinary"],
		globalmap: { ordinary: [] },
		ordinary: {},
	};
}
