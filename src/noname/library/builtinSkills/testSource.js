import { readFileSync } from "node:fs";
import ts from "typescript";

/** AST regressions follow the entry's actual imported groups and spread order. */
export function builtinSkillTestSource() {
	const entryUrl = new URL("../skill.js", import.meta.url);
	const entry = ts.createSourceFile("skill.js", readFileSync(entryUrl, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	const imports = new Map();
	for (const statement of entry.statements) {
		if (!ts.isImportDeclaration(statement) || !statement.moduleSpecifier.text.startsWith("./builtinSkills/")) continue;
		for (const binding of statement.importClause.namedBindings.elements) imports.set(binding.name.text, statement.moduleSpecifier.text);
	}
	const declaration = entry.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations[0].name.getText(entry) === "builtinSkills");
	const properties = [];
	for (const spread of declaration.declarationList.declarations[0].initializer.properties) {
		if (!ts.isSpreadAssignment(spread)) throw new Error("Expected a builtin skill group spread");
		const name = spread.expression.getText(entry);
		const path = imports.get(name);
		if (!path) throw new Error(`Missing imported skill group: ${name}`);
		const group = ts.createSourceFile(path, readFileSync(new URL(path, entryUrl), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
		const variable = group.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations[0].name.getText(group) === name);
		for (const property of variable.declarationList.declarations[0].initializer.properties) properties.push(property.getFullText(group).trim());
	}
	return ts.createSourceFile("skill.js", `const builtinSkills = {\n${properties.join(",\n")}\n};`, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}
