import { readFileSync } from "node:fs";
import ts from "typescript";

/** Follow the production entry's actual group imports and spread order. */
export function zhanfaTestSource() {
	const entryUrl = new URL("../zhanfa.js", import.meta.url);
	const entry = ts.createSourceFile("zhanfa.js", readFileSync(entryUrl, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	const imports = new Map();
	for (const statement of entry.statements) {
		if (!ts.isImportDeclaration(statement) || !statement.moduleSpecifier.text.startsWith("./zhanfaEffects/")) continue;
		for (const binding of statement.importClause.namedBindings.elements) imports.set(binding.name.text, statement.moduleSpecifier.text);
	}
	const declaration = entry.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations[0].name.getText(entry) === "_zhanfa");
	const properties = [];
	for (const spread of declaration.declarationList.declarations[0].initializer.properties) {
		if (!ts.isSpreadAssignment(spread)) throw new Error("Expected a battle effect group spread");
		const name = spread.expression.getText(entry);
		const path = imports.get(name);
		if (!path) throw new Error(`Missing imported battle effect group: ${name}`);
		const group = ts.createSourceFile(path, readFileSync(new URL(path, entryUrl), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
		const variable = group.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations[0].name.getText(group) === name);
		for (const property of variable.declarationList.declarations[0].initializer.properties) properties.push(property.getFullText(group).trim());
	}
	return ts.createSourceFile("zhanfa.js", `const _zhanfa = {\n${properties.join(",\n")}\n};`, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}
