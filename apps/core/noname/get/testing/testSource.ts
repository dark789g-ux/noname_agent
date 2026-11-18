import { readFileSync } from "node:fs";
import ts from "typescript";

function javascript(path: string): ts.SourceFile {
	const text = readFileSync(new URL(path, import.meta.url), "utf8");
	const output = ts.transpileModule(text, {
		compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, removeComments: false },
	}).outputText;
	return ts.createSourceFile(path, output, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}

/**
 * Compatibility adapter for narrow, dependency-injected method tests. Reads the
 * actual installed method groups; it contains no copy of the old implementation.
 * Runtime assembly and live bindings are checked by publicContract.test.mjs.
 */
export function getTestText(): string {
	const core = javascript("../Get.ts");
	const declaration = core.statements.find(ts.isClassDeclaration)!;
	const members = declaration.members.map(node => node.getFullText(core));
	const groups = javascript("../methodGroups.ts");
	for (const statement of groups.statements) {
		if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
		const path = statement.moduleSpecifier.text.replace(/\.js$/, ".ts");
		const source = javascript(`../${path}`);
		for (const item of source.statements) {
			if (!ts.isVariableStatement(item)) continue;
			for (const variable of item.declarationList.declarations) {
				if (!variable.initializer || !ts.isObjectLiteralExpression(variable.initializer)) continue;
				members.push(...variable.initializer.properties.filter(ts.isMethodDeclaration).map(method => method.getFullText(source)));
			}
		}
	}
	const dependencies = javascript("../dependencies.ts");
	return `${dependencies.text}\nclass Get {\n${members.join("\n")}\n}`;
}

export function skinTestSource(): ts.SourceFile {
	return javascript("../intro/skin.ts");
}
