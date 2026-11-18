import { readFileSync } from "node:fs";
import ts from "typescript";

const transpileOptions = {
	compilerOptions: {
		target: ts.ScriptTarget.ESNext,
		module: ts.ModuleKind.ESNext,
		useDefineForClassFields: true,
		removeComments: false,
	},
};

/** @type {string | undefined} */
let cachedText;

function readTranspiled(url, name) {
	const raw = readFileSync(url, "utf8");
	const { outputText } = ts.transpileModule(raw, { ...transpileOptions, fileName: `${name}.ts` });
	return ts.createSourceFile(`${name}.js`, outputText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}

function extractHelperFunctions(relPath, name) {
	const file = readTranspiled(new URL(relPath, import.meta.url), name);
	return file.statements
		.filter(statement => ts.isFunctionDeclaration(statement))
		.map(statement => statement.getText(file).replace(/^export\s+/, ""));
}

/** Reassembles extracted Game helpers, fields, and prototype methods as ESNext JS text for isolated AST tests. */
export function gameTestText() {
	if (cachedText !== undefined) return cachedText;

	const helperTexts = [
		...extractHelperFunctions("./storage/battleLog.ts", "battleLog"),
		...extractHelperFunctions("./card/cardMoveProducers.ts", "cardMoveProducers"),
		...extractHelperFunctions("./animation/elementSwap.ts", "elementSwap"),
		...extractHelperFunctions("./lifecycle/overStatsAndVideo.ts", "overStatsAndVideo"),
		...extractHelperFunctions("./lifecycle/doubleCharacterBoard.ts", "doubleCharacterBoard"),
	];

	const entryUrl = new URL("./index.ts", import.meta.url);
	const entryRaw = readFileSync(entryUrl, "utf8");
	const entryTs = ts.createSourceFile("index.ts", entryRaw, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

	const imports = new Map();
	for (const statement of entryTs.statements) {
		if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
		const specifier = statement.moduleSpecifier.text;
		if (!specifier.startsWith("./") || !statement.importClause?.namedBindings || !ts.isNamedImports(statement.importClause.namedBindings)) continue;
		for (const element of statement.importClause.namedBindings.elements) {
			imports.set(element.name.text, specifier.replace(/\.js$/, ".ts"));
		}
	}

	const groupNames = [];
	for (const statement of entryTs.statements) {
		if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) continue;
		if (statement.expression.expression.getText(entryTs) !== "installGameMethods") continue;
		const listArg = statement.expression.arguments[1];
		if (!listArg || !ts.isArrayLiteralExpression(listArg)) throw new Error("Expected array literal in installGameMethods");
		for (const item of listArg.elements) {
			groupNames.push(item.getText(entryTs));
		}
	}

	const entryJs = readTranspiled(entryUrl, "index");
	const classDecl = entryJs.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Game");
	if (!classDecl) throw new Error("Missing Game class declaration");

	const methodTexts = [];
	for (const groupName of groupNames) {
		const relPath = imports.get(groupName);
		if (!relPath) throw new Error(`Missing import for method group: ${groupName}`);
		const groupJs = readTranspiled(new URL(relPath, entryUrl), groupName);
		const varStmt = groupJs.statements.find(
			node => ts.isVariableStatement(node) && node.declarationList.declarations.some(decl => decl.name.getText(groupJs) === groupName)
		);
		const decl = varStmt?.declarationList.declarations.find(item => item.name.getText(groupJs) === groupName);
		const object = decl?.initializer;
		if (!object || !ts.isObjectLiteralExpression(object)) throw new Error(`Missing object literal for ${groupName}`);
		for (const prop of object.properties) {
			methodTexts.push(`\t${prop.getFullText(groupJs).trim()}`);
		}
	}

	const classText = classDecl.getText(entryJs);
	const assembledClass = `${classText.slice(0, -1)}\n${methodTexts.join("\n\n")}\n}`;
	cachedText = `${helperTexts.join("\n\n")}\n\n${assembledClass}\n`;
	return cachedText;
}

/** Parses the reassembled Game ESNext JS source for isolated AST test suites. */
export function gameTestSource() {
	return ts.createSourceFile("index.js", gameTestText(), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}
