import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { playerTestSource, playerTestText } from "./testSource.js";

const sourceText = playerTestText();
const sourceFile = playerTestSource();

function getFunctionText(name) {
	const declaration = sourceFile.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
	assert.ok(declaration, `${name} should exist`);
	return declaration.getText(sourceFile);
}

function getNestedFunctionText(name) {
	let declaration;
	const visit = node => {
		if (!declaration && ts.isFunctionDeclaration(node) && node.name?.text === name) {
			declaration = node;
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	assert.ok(declaration, `${name} should exist`);
	return declaration.getText(sourceFile);
}

function getPlayerMethodText(name) {
	for (const statement of sourceFile.statements) {
		if (!ts.isClassDeclaration(statement) || statement.name?.text !== "Player") continue;
		const method = statement.members.find(member => ts.isMethodDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === name);
		assert.ok(method, `Player.${name} should exist`);
		return method.getText(sourceFile);
	}
	assert.fail("Player should exist");
}

function compile(functions, parameters = [], values = []) {
	const javascript = ts.transpileModule(functions.join("\n"), {
		compilerOptions: { target: ts.ScriptTarget.ESNext },
	}).outputText;
	return Function(...parameters, `${javascript}; return { ${functions.map(functionText => functionText.match(/function (\w+)/)?.[1]).filter(Boolean).join(", ")} };`)(...values);
}

class FakeNode {}

class FakeDiv extends FakeNode {
	constructor() {
		super();
		this.style = {};
	}
}

test("普通动画 div 仅在已验证的元数据上读写", () => {
	const helpers = compile(
		["isThrownNode", "getThrownCardId", "isThrownCardSelected", "selectThrownCard", "isMarkNode", "hasMarkName", "hasMarkIdentifier", "hasFixedMarkInfo", "deleteMarkNode"].map(getFunctionText),
		["HTMLDivElement"],
		[FakeDiv]
	);
	const plain = new FakeDiv();
	assert.equal(helpers.isThrownNode(plain), true);
	assert.equal(helpers.getThrownCardId(plain), undefined);
	plain._cardid = "throw-1";
	assert.equal(helpers.selectThrownCard(plain, "throw-1"), true);
	assert.equal(plain.selectedt, true);
	assert.equal(helpers.selectThrownCard(plain, "throw-1"), false);
	plain._cardid = {};
	assert.equal(helpers.getThrownCardId(plain), plain._cardid);
	plain.selectedt = 1;
	assert.equal(helpers.isThrownCardSelected(plain), true);
	plain.selectedt = "selected";
	assert.equal(helpers.isThrownCardSelected(plain), true);
	plain.selectedt = "";
	assert.equal(helpers.isThrownCardSelected(plain), false);

	const mark = new FakeDiv();
	mark.name = 1;
	mark.markidentifer = 2;
	const info = () => {};
	info.fixed = 1;
	mark.info = info;
	let receiver;
	mark.delete = function () {
		receiver = this;
	};
	assert.equal(helpers.isMarkNode(mark), true);
	assert.equal(helpers.hasMarkName(mark, "1"), true);
	assert.equal(helpers.hasMarkIdentifier(mark, "2"), true);
	assert.equal(helpers.hasFixedMarkInfo(mark), true);
	helpers.deleteMarkNode(mark);
	assert.equal(receiver, mark);
	assert.throws(() => helpers.deleteMarkNode(new FakeDiv()), TypeError);
});

test("牌区插入点接受任意 Node，而非仅 div", () => {
	const helpers = compile(
		["isThrownNodeMap", "getThrownNodeMap", "getThrownCardsetion"].map(getFunctionText),
		["HTMLDivElement", "Node"],
		[FakeDiv, FakeNode]
	);
	const card = new FakeDiv();
	const insertionPoint = new FakeNode();
	card.node = { cardsetion: insertionPoint };
	assert.equal(helpers.getThrownCardsetion(card), insertionPoint);
	card.node.cardsetion = {};
	assert.throws(() => helpers.getThrownCardsetion(card), TypeError);
});

test("复制动画牌在临时改原型后调用继承的 Card.init 并保留清理顺序", () => {
	function Card() {}
	Card.prototype = Object.create(FakeDiv.prototype);
	const helpers = compile(
		["isThrownNodeMap", "getThrownNodeMap"].map(getFunctionText).concat(getNestedFunctionText("reinitClonedCard")),
		["HTMLDivElement", "lib"],
		[
			FakeDiv,
			{
				element: {
					Card,
				},
			},
		]
	);
	const card = new FakeDiv();
	const originalPrototype = Object.getPrototypeOf(card);
	const node = {};
	const calls = [];
	card.node = node;
	FakeDiv.prototype.init = function () {
		assert.fail("temporary DOM prototype init must not run");
	};
	Card.prototype.init = function (data) {
		calls.push([this, data, node.name2, node.range]);
	};
	helpers.reinitClonedCard(card, ["spade", 1, "sha", false]);
	assert.equal(calls.length, 1);
	assert.equal(calls[0][0], card);
	assert.deepEqual(calls[0][2], {});
	assert.deepEqual(calls[0][3], {});
	assert.equal(Object.getPrototypeOf(card), originalPrototype);
	assert.equal("name2" in node, false);
	assert.equal("range" in node, false);
});

test("标记和联机动画消费者保留字段级守卫", () => {
	const unmark = getPlayerMethodText("unmark");
	const checkMarks = getPlayerMethodText("checkMarks");
	const throwMethod = getPlayerMethodText("$throw");
	assert.match(unmark, /hasMarkName\(mark, name\)/);
	assert.match(unmark, /hasMarkIdentifier\(mark, info\)/);
	assert.match(unmark, /deleteMarkNode\(mark\)/);
	assert.match(checkMarks, /hasFixedMarkInfo\(mark\)/);
	assert.match(throwMethod, /getThrownCardId\(lastNode\)/);
	assert.match(throwMethod, /cloned card must adopt the Card prototype/);
	assert.match(sourceText, /const selectThrownCard = value/);
});
