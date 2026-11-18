import { getTestText } from "./testing/testSource.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const getText = getTestText();
const getFile = ts.createSourceFile("index.js", getText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);

function findInfoVCardOL() {
	for (const statement of getFile.statements) {
		if (!ts.isClassDeclaration(statement) || statement.name?.text !== "Get") continue;
		const method = statement.members.find(member => ts.isMethodDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === "infoVCardOL");
		assert.ok(method?.body, "Get.infoVCardOL should have a body");
		return method.body.getText(getFile);
	}
	assert.fail("Get should exist");
}

function createInfoVCardOL(parsedResult = value => value) {
	const source = ts.transpileModule(`function infoVCardOL(item) ${findInfoVCardOL()}`, {
		compilerOptions: { target: ts.ScriptTarget.ESNext },
	}).outputText;
	const lib = {
		vcardOL: {},
		element: {
			VCard: class {
				constructor(data) {
					this.received = data;
					Object.assign(this, data);
				}
			},
		},
	};
	const infoVCardOL = Function("get", "lib", `${source}; return infoVCardOL;`)({ parsedResult }, lib);
	return { infoVCardOL, lib };
}

function wire(value) {
	return `_noname_vcard:${JSON.stringify(value)}`;
}

test("infoVCardOL 保留字符串与数字 vcardID 的缓存身份", () => {
	const { infoVCardOL, lib } = createInfoVCardOL();
	const stringCard = infoVCardOL(wire({ vcardID: "same", name: "sha" }));
	const stringCardAgain = infoVCardOL(wire({ vcardID: "same", name: "shan" }));
	assert.equal(stringCardAgain, stringCard);
	assert.equal(lib.vcardOL.same, stringCard);
	assert.equal(stringCard.name, "shan");

	const numberCard = infoVCardOL(wire({ vcardID: 7, name: "tao" }));
	assert.equal(lib.vcardOL["7"], numberCard);
	assert.equal(infoVCardOL(wire({ vcardID: 7, name: "jiu" })), numberCard);
	assert.equal(numberCard.name, "jiu");
});

test("infoVCardOL 保留原来的 truthy 缓存分支和数组引用", () => {
	const parsedArrays = [];
	const { infoVCardOL, lib } = createInfoVCardOL(value => {
		if (Array.isArray(value)) {
			const parsed = value.slice();
			parsedArrays.push(parsed);
			return parsed;
		}
		return value;
	});
	for (const id of [false, 0, ""]) {
		const first = infoVCardOL(wire({ vcardID: id }));
		const second = infoVCardOL(wire({ vcardID: id }));
		assert.notEqual(first, second);
	}
	assert.deepEqual(Object.keys(lib.vcardOL), []);

	const cached = infoVCardOL(wire({ vcardID: "cards", cards: ["a"] }));
	const updated = infoVCardOL(wire({ vcardID: "cards", cards: ["b"] }));
	assert.equal(updated, cached);
	assert.equal(updated.cards, parsedArrays.at(-1));
});

test("infoVCardOL 保留 symbol 与对象 ToPropertyKey 的转换次数", () => {
	const symbol = Symbol("vcard");
	let conversions = 0;
	const keyObject = {
		[Symbol.toPrimitive](hint) {
			assert.equal(hint, "string");
			conversions++;
			return "object-key";
		},
	};
	const { infoVCardOL, lib } = createInfoVCardOL(value => (value === "symbol" ? symbol : value === "object" ? keyObject : value));
	const symbolCard = infoVCardOL(wire({ vcardID: "symbol" }));
	assert.equal(lib.vcardOL[symbol], symbolCard);
	assert.equal(infoVCardOL(wire({ vcardID: "symbol" })), symbolCard);

	const objectCard = infoVCardOL(wire({ vcardID: "object" }));
	assert.equal(conversions, 2);
	assert.equal(infoVCardOL(wire({ vcardID: "object" })), objectCard);
	assert.equal(conversions, 4);
});

test("infoVCardOL 保留 Object.entries reduce 的根输入和 __proto__ 语义", () => {
	const { infoVCardOL } = createInfoVCardOL();
	assert.deepEqual(infoVCardOL(wire(["a", "b"])).received, { 0: "a", 1: "b" });
	assert.deepEqual(infoVCardOL(wire("ab")).received, { 0: "a", 1: "b" });
	assert.throws(() => infoVCardOL(wire(null)), TypeError);

	const payload = JSON.parse('{"__proto__":{"inherited":true},"vcardID":"proto"}');
	const card = infoVCardOL(wire(payload));
	assert.equal(Object.hasOwn(card.received, "__proto__"), false);
	assert.equal(Object.getPrototypeOf(card.received).inherited, true);
});
