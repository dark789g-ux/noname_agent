import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const methods = new Map();
function visit(node) {
	if (ts.isMethodDeclaration(node) && ["filterTrigger", "filterEnable"].includes(node.name.getText(source))) methods.set(node.name.getText(source), node);
	ts.forEachChild(node, visit);
}
visit(source);

for (const name of ["filterTrigger", "filterEnable"]) {
	test(`${name} retains one ReferenceError log and false when skill info is missing`, () => {
		const method = methods.get(name);
		assert.ok(method?.body);
		const calls = [];
		const queried = [];
		const receiver = new Function("get", "console", `"use strict"; return { ${method.getText(source)} };`)(
			{ info(skill) { queried.push(skill); return undefined; } },
			{ error(...args) { calls.push(args); } }
		);
		const args = name === "filterTrigger" ? [{}, {}, "phaseBegin", "missing"] : [{}, {}, "missing"];
		assert.equal(receiver[name](...args), false);
		assert.deepEqual(queried, ["missing"]);
		assert.equal(calls.length, 1);
		assert.equal(calls[0].length, 1);
		const error = calls[0][0];
		assert.ok(error instanceof ReferenceError);
		assert.equal(error.message, "缺少info的技能:");
		assert.equal(Object.hasOwn(error, "cause"), false);
		assert.equal(Object.hasOwn(error, "fileName"), false);
	});
}
