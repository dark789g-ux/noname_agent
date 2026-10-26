import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import ts from "typescript";

const source = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const library = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Library");
assert.ok(library);
const field = library.members.find(node => ts.isPropertyDeclaration(node) && node.name.getText(source) === "characterSort");
assert.ok(field?.initializer);

test("character sort keeps dynamic registration identity and extension key aliases", () => {
	const sorts = new Function(`return ${field.initializer.getText(source)}`)();
	assert.equal(sorts.shiji, undefined);
	const entries = { history: ["liubei"] };
	sorts.mode_extension_shiji = entries;
	assert.equal(sorts.shiji, entries);
	assert.equal(sorts.mode_extension_shiji, entries);
	const second = { heroes: ["caocao"] };
	Object.defineProperty(sorts, "mode_extension_extra", { value: second, configurable: true });
	assert.equal(sorts.extra, second);
});

test("mobile prefix uses the registered sort and retains missing initialization failure", () => {
	let prefixEntry;
	const visit = node => {
		if (ts.isArrayLiteralExpression(node) && node.elements[0] && ts.isStringLiteral(node.elements[0]) && node.elements[0].text === "手杀") prefixEntry = node;
		ts.forEachChild(node, visit);
	};
	visit(library);
	assert.ok(prefixEntry);
	const getSpan = prefixEntry.elements[1].properties.find(node => node.name?.getText(source) === "getSpan");
	assert.ok(getSpan);
	const dom = new JSDOM();
	const lib = { config: { buttoncharacter_prefix: "simple" }, characterPack: { shiji: { liubei: {} } }, characterSort: {} };
	const render = new Function("lib", "get", "document", `return ${getSpan.initializer.getText(source)}`)(lib, { translation: () => "仁君" }, dom.window.document);
	assert.throws(() => render("手杀", "liubei"), TypeError);
	lib.characterSort.shiji = { history: ["liubei"] };
	assert.match(render("手杀", "liubei"), /君/);
	assert.match(render("手杀", "caocao"), /手杀/);
	dom.window.close();
});
