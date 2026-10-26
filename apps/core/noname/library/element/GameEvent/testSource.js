import { readFileSync } from "node:fs";
import ts from "typescript";

/** Reassembles extracted implementations only for existing isolated AST fixtures. */
export function gameEventTestSource() {
	const read = (path, name) => ts.createSourceFile(name, readFileSync(new URL(path, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
	const entry = read("../gameEvent.ts", "gameEvent.ts");
	const declaration = entry.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "GameEvent");
	if (!declaration) throw new Error("Missing real GameEvent declaration");
	const additions = [];
	for (const group of ["trigger", "selection", "promise", "handlers", "state"]) {
		const source = read(`./${group}Methods.ts`, `${group}Methods.ts`);
		const statement = source.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(source) === `${group}Methods`));
		const object = statement?.declarationList.declarations[0].initializer;
		if (!object || !ts.isObjectLiteralExpression(object)) throw new Error(`Missing ${group} implementations`);
		additions.push(...object.properties.map(method => method.getText(source)
			.replace("<E extends GameEvent<GameEventNumberValue>>", "")
			.replace("<E extends GameEvent<GameEventNumberValue>, ", "<")
			.replace("(this: E, ", "(")
			.replace("(this: E)", "()")
			.replace(/\): E\s*\{/, "): this {")));
	}
	const contracts = read("./eventContracts.ts", "eventContracts.ts");
	const fields = contracts.statements.find(node => ts.isInterfaceDeclaration(node) && node.name.text === "EventSelectionFields");
	if (!fields) throw new Error("Missing type-only selection fields");
	additions.push(...fields.members.map(member => `declare ${member.getText(contracts)}`));
	const text = declaration.getText(entry);
	return ts.createSourceFile("gameEvent.ts", text.slice(0, -1) + "\n" + additions.join("\n") + "\n}", ts.ScriptTarget.Latest, true);
}
