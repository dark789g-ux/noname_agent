import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";
import { identityGetFiles } from "../../../scripts/identityGetFiles.js";

test("serialized identity callbacks do not capture newly extracted module helpers", () => {
	const core = fileURLToPath(new URL("../../../", import.meta.url));
	const globals = new Set(["lib", "game", "ui", "get", "ai", "_status"]);
	let inspected = 0;
	for (const file of identityGetFiles(core).filter(file => /[\\/]mode[\\/]identity[\\/]/.test(file) && !/[\\/]testing[\\/]/.test(file))) {
		const text = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
		const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
		const bindings = new Set<string>();
		for (const statement of source.statements) {
			if (!ts.isImportDeclaration(statement)) continue;
			const clause = statement.importClause;
			if (clause?.name) bindings.add(clause.name.text);
			if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) for (const item of clause.namedBindings.elements) bindings.add(item.name.text);
		}
		const visit = (node: ts.Node) => {
			if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ["broadcast", "broadcastAll", "send"].includes(node.expression.name.text)) {
				const callback = node.arguments[0];
				if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
					inspected++;
					const scan = (child: ts.Node) => {
						if (ts.isIdentifier(child) && bindings.has(child.text) && !globals.has(child.text)) {
							assert.fail(`${file}: wire callback captures module import ${child.text}`);
						}
						ts.forEachChild(child, scan);
					};
					scan(callback);
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
	}
	assert.ok(inspected >= 20, `expected legacy wire callbacks, inspected ${inspected}`);
});
