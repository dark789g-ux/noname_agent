import { getTestText } from "./testing/testSource.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const getSource = ts.createSourceFile("index.js", getTestText(), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const vcardSource = ts.createSourceFile("vcard.js", readFileSync(new URL("../library/element/vcard.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

function findMethodBody() {
	const getClass = getSource.statements.find(statement => ts.isClassDeclaration(statement) && statement.name?.text === "Get");
	assert.ok(getClass);
	const method = getClass.members.find(member => ts.isMethodDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === "autoViewAs");
	assert.ok(method?.body);
	return { parameters: method.parameters.map(parameter => parameter.getText(getSource)).join(","), body: method.body.getText(getSource) };
}

function findVCardClass() {
	const declaration = vcardSource.statements.find(statement => ts.isClassDeclaration(statement) && statement.name?.text === "VCard");
	assert.ok(declaration);
	return declaration.getText(vcardSource).replace(/^export\s+/, "");
}

function createProtocol() {
	const get = {
		itemtype() {
			return "vcard";
		},
		info() {
			return undefined;
		},
		suit() {
			return "heart";
		},
		color() {
			return "red";
		},
		number() {
			return 7;
		},
		nature() {
			return undefined;
		},
	};
	const lib = { suits: ["heart", "diamond", "club", "spade"], color: { red: true, black: true }, element: {} };
	const vcardJavaScript = ts.transpileModule(findVCardClass(), { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
	const VCard = Function("get", "lib", "ai", "_status", `${vcardJavaScript}; return VCard;`)(get, lib, {}, {});
	lib.element.VCard = VCard;
	const { parameters, body } = findMethodBody();
	const autoViewAsJavaScript = ts.transpileModule(`function autoViewAs(${parameters}) ${body}`, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
	const autoViewAs = Function("lib", `${autoViewAsJavaScript}; return autoViewAs;`)(lib);
	return { autoViewAs, VCard };
}

test('autoViewAs 的 "unsure" 分支只补全缺失的牌面字段', () => {
	const { autoViewAs } = createProtocol();
	const missing = autoViewAs({ name: "sha" }, "unsure");
	assert.equal(missing.name, "sha");
	assert.equal(missing.suit, "unsure");
	assert.equal(missing.color, "unsure");
	assert.equal(missing.number, "unsure");
	assert.deepEqual(missing.cards, []);

	const existing = autoViewAs({ name: "sha", suit: "heart", color: "red", number: 7 }, "unsure");
	assert.equal(existing.suit, "heart");
	assert.equal(existing.color, "red");
	assert.equal(existing.number, 7);
	assert.deepEqual(existing.cards, []);
});

test('autoViewAs 的 "unsure" 不覆盖明确 isCard 的牌面', () => {
	const { autoViewAs } = createProtocol();
	const vcard = autoViewAs({ name: "sha", isCard: true }, "unsure");
	assert.equal(vcard.isCard, true);
	assert.equal(vcard.suit, undefined);
	assert.equal(vcard.color, undefined);
	assert.equal(vcard.number, undefined);
});

test("实体 cards 数组会复制，单参数 VCard 保持身份", () => {
	const { autoViewAs, VCard } = createProtocol();
	const physicalCard = { cardid: "physical" };
	const cards = [physicalCard];
	const vcard = autoViewAs({ name: "sha" }, cards);
	assert.notEqual(vcard.cards, cards);
	assert.deepEqual(vcard.cards, cards);

	const existing = new VCard({ name: "shan" });
	assert.equal(autoViewAs(existing), existing);
});

test("字符串输入的现有运行时行为是 suit，而不是 name", () => {
	const { autoViewAs } = createProtocol();
	const vcard = autoViewAs("sha");
	assert.equal(vcard.suit, "sha");
	assert.equal(vcard.name, undefined);
	assert.deepEqual(vcard.cards, []);
});

test("生成声明接受 unsure 与实体数组，并拒绝字符串牌名和描述数组", () => {
	const fixturePath = fileURLToPath(new URL("../../autoViewAs.type-test.ts", import.meta.url));
	const fixture = ['import { Get } from "./dist-types/noname/get/index.js";', 'import { Card } from "./dist-types/noname/library/element/card.js";', 'import { VCard } from "./dist-types/noname/library/element/vcard.js";', "declare const get: Get; declare const card: Card; declare const vcard: VCard;", 'get.autoViewAs({ name: "sha" }, "unsure");', 'get.autoViewAs({ name: "sha" }, [card]);', "get.autoViewAs(vcard);", 'get.autoViewAs("sha");', 'get.autoViewAs({ name: "sha" }, "heart");', 'get.autoViewAs({ name: "sha" }, [{ name: "sha" }]);'].join("\n");
	const options = {
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		baseUrl: fileURLToPath(new URL("../../", import.meta.url)),
		paths: { "@/*": ["./dist-types/noname/*"], noname: ["./dist-types/noname.js"] },
		noEmit: true,
		strict: true,
		target: ts.ScriptTarget.ESNext,
	};
	const host = ts.createCompilerHost(options);
	const originalRead = host.getSourceFile.bind(host);
	const originalExists = host.fileExists.bind(host);
	host.fileExists = path => resolve(path) === fixturePath || originalExists(path);
	host.getSourceFile = (path, version) => (resolve(path) === fixturePath ? ts.createSourceFile(path, fixture, version, true) : originalRead(path, version));
	const typings = ts.sys.readDirectory(fileURLToPath(new URL("../../typings", import.meta.url)), [".d.ts"]);
	const program = ts.createProgram([fixturePath, ...typings], options, host);
	const diagnostics = ts.getPreEmitDiagnostics(program).filter(item => item.file && resolve(item.file.fileName) === fixturePath);
	assert.deepEqual(
		diagnostics.map(item => item.file.getLineAndCharacterOfPosition(item.start).line + 1),
		[8, 9, 10]
	);
});
