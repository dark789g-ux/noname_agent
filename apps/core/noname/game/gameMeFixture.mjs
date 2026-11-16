import { createModuleRuntime } from "../llm/testing/module-runtime.mjs";
import assert from "node:assert/strict";
import ts from "typescript";
import { gameTestSource } from "./testSource.js";

if (typeof Array.prototype.addArray !== "function") {
	Object.defineProperty(Array.prototype, "addArray", {
		value(values) {
			this.push(...values);
			return this;
		},
		configurable: true,
	});
}

const gameSource = gameTestSource();

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
