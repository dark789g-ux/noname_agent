import { createModuleRuntime } from "../llm/testing/module-runtime.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import ts from "typescript";

if (typeof Array.prototype.addArray !== "function") {
	Object.defineProperty(Array.prototype, "addArray", {
		value(values) {
			this.push(...values);
			return this;
		},
		configurable: true,
	});
}

const gameSource = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

export function gameMethod(name, dependencies = {}) {
	const gameClass = gameSource.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Game");
	assert.ok(gameClass);
	const method = gameClass.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(gameSource) === name);
	assert.ok(method?.body);
	const javascript = ts.transpileModule(`function ${name}(${method.parameters.map(parameter => parameter.getText(gameSource)).join(",")}) ${method.body.getText(gameSource)}`, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
	return Function(...Object.keys(dependencies), `${javascript}; return ${name};`)(...Object.values(dependencies));
}

export async function contentMethod(name, dependencies) {
	const runtime = await createModuleRuntime(dependencies);
	runtime.run('Object.defineProperty(Array.prototype, "addArray", { value(values) { this.push(...values); return this; }, configurable: true });');
	return (await runtime.import("noname/library/element/content.ts")).Content[name];
}
