import { contentTestSource } from "../../../llm/testing/content-runtime.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { isImportModePayload, isSelectionResultObject, normalizeSelectionResult } from "./resultBoundary.js";

const realContentSource = await contentTestSource();

class TestCard {}
class TestPlayer {}
class TestVCard {}

const dom = new JSDOM();
const document = dom.window.document;

const runtime = {
	isCard(value) {
		return value instanceof TestCard;
	},
	isPlayer(value) {
		return value instanceof TestPlayer;
	},
	isVCard(value) {
		return value instanceof TestVCard;
	},
	isSelectableButton(value) {
		return value instanceof dom.window.HTMLDivElement;
	},
};

function createSelectableDiv(link) {
	const button = document.createElement("div");
	Object.defineProperty(button, "link", { value: link });
	return button;
}

const getSource = ts.createSourceFile("get/index.js", readFileSync(new URL("../../../get/index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const contentSource = realContentSource;

test("production selection boundary accepts plain divs without inventing a link", () => {
	let predicate;
	function visit(node) {
		if (ts.isMethodDeclaration(node) && node.name.getText(contentSource) === "isSelectableButton") predicate = node;
		ts.forEachChild(node, visit);
	}
	visit(contentSource);
	assert.ok(predicate);
	const javascript = ts.transpileModule(`const runtime = { ${predicate.getText(contentSource)} };`, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
	const isSelectableButton = new Function("HTMLDivElement", `${javascript}; return runtime.isSelectableButton;`)(dom.window.HTMLDivElement);
	const plain = document.createElement("div");
	const result = { buttons: [plain] };
	assert.equal(isSelectableButton(plain), true);
	assert.equal(isSelectableButton(document.createElement("span")), false);
	assert.equal(normalizeSelectionResult(result, { ...runtime, isSelectableButton }), result);
	assert.equal(Object.hasOwn(plain, "link"), false);
});

test("chooseToDiscard precontent consumes only a selection skill name and preserves result identity", async () => {
	let stage;
	function visit(node) {
		if (ts.isPropertyAssignment(node) && node.name.getText(contentSource) === "chooseToDiscard" && ts.isArrayLiteralExpression(node.initializer)) {
			stage = node.initializer.elements.find(element => element.getText(contentSource).includes("pre_${event.result.skill}"));
		}
		ts.forEachChild(node, visit);
	}
	visit(contentSource);
	assert.ok(stage);
	const calls = [];
	const skillInfo = { precontent() {} };
	const lib = { skill: {} };
	const child = {
		setContent(value) {
			calls.push(["content", value]);
		},
		set(key, value) {
			calls.push([key, value]);
		},
	};
	const game = {
		online: false,
		createEvent(name) {
			calls.push(["create", name]);
			return child;
		},
	};
	const get = {
		info(name) {
			calls.push(["info", name]);
			return skillInfo;
		},
	};
	const javascript = ts.transpileModule(`const stage = ${stage.getText(contentSource)};`, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
	const run = new Function("lib", "game", "get", `${javascript}; return stage;`)(lib, game, get);
	const player = {};
	const sentSkill = {};
	const result = { skill: "selected", _sendskill: ["registered", sentSkill] };
	const event = {
		result,
		resume() {
			calls.push(["resume"]);
		},
	};
	await run(event, {}, player);
	assert.equal(event.result, result);
	assert.equal(lib.skill.registered, sentSkill);
	assert.deepEqual(calls, [["resume"], ["info", "selected"], ["create", "pre_selected"], ["content", skillInfo.precontent], ["result", result], ["player", player]]);

	for (const skill of [undefined, "", { modeSkill: {} }]) {
		calls.length = 0;
		const businessResult = { skill };
		event.result = businessResult;
		await run(event, {}, player);
		assert.equal(event.result, businessResult);
		assert.deepEqual(calls, [["resume"]]);
	}
});

function getMethodText(name) {
	let methodText;
	const visit = node => {
		if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
			methodText = node.getText(getSource);
			return;
		}
		ts.forEachChild(node, visit);
	};
	visit(getSource);
	if (methodText === undefined) {
		throw new Error(`Missing production get.${name}`);
	}
	return methodText;
}

function createProductionWireCodec() {
	const Card = class {};
	const VCard = class {};
	const Player = class {};
	const Button = class {};
	const Dialog = class {};
	const GameEvent = class {};
	const lib = {
		natureSeparator: "|",
		nature: new Set(),
		element: { Card, VCard, Player, Button, Dialog, GameEvent },
		experimental: { symbol: { itemType: Symbol("itemType") } },
	};
	const get = {
		is: { object: value => typeof value === "object" && value !== null && !Array.isArray(value) },
		itemtype(..._args) {},
		stringifiedResult(item) {
			return item;
		},
		parsedResult(item) {
			return item;
		},
	};
	const makeMethod = method => new Function("get", "lib", "HTMLDivElement", "TYPE_KEY", `return (function ${method});`)(get, lib, dom.window.HTMLDivElement, "_noname_type");
	get.itemtype = makeMethod(getMethodText("itemtype"));
	get.stringifiedResult = makeMethod(getMethodText("stringifiedResult"));
	get.parsedResult = makeMethod(getMethodText("parsedResult"));
	return get;
}

function getContentFunctionText(name) {
	let functionText;
	const visit = node => {
		if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
			functionText = node.getText(contentSource);
			return;
		}
		ts.forEachChild(node, visit);
	};
	visit(contentSource);
	if (functionText === undefined) {
		throw new Error(`Missing content ${name}`);
	}
	return functionText;
}

function getChooseToGuanxingConsumerText() {
	let statements;
	const visit = node => {
		if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "chooseToGuanxing") {
			statements = node.body?.statements;
			return;
		}
		ts.forEachChild(node, visit);
	};
	visit(contentSource);
	if (statements === undefined) {
		throw new Error("Missing chooseToGuanxing body");
	}
	const start = statements.findIndex(statement => statement.getText(contentSource).includes("const moved = result.moved"));
	const end = statements.findIndex(statement => statement.getText(contentSource).includes("await game.cardsGotoPile"));
	if (start < 1 || end < start) {
		throw new Error("Missing chooseToGuanxing card consumer");
	}
	return statements
		.slice(start - 1, end + 1)
		.map(statement => statement.getText(contentSource))
		.join("\n");
}

function transpile(source) {
	return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
}

function createContentEntityGuards() {
	const source = ["isCardLinks", "isVCardLinks", "isCardMatrix"].map(getContentFunctionText).join("\n");
	return new Function("lib", `${transpile(source)}\nreturn { isCardLinks, isVCardLinks, isCardMatrix };`)({ element: { Card: TestCard, VCard: TestVCard } });
}

test("selection result keeps its identity, extension fields, nullable bool, and viewed", () => {
	const card = new TestCard();
	const player = new TestPlayer();
	const button = createSelectableDiv({ extension: true });
	const result = {
		bool: null,
		cards: [card],
		targets: [player],
		buttons: [button],
		links: [{ extension: true }],
		numbers: [1],
		cost_data: { source: "extension" },
		extensionValue: "kept",
	};

	assert.equal(isSelectionResultObject(result, runtime), true);
	assert.equal(normalizeSelectionResult(result, runtime), result);
	assert.equal(normalizeSelectionResult("viewed", runtime), "viewed");
});

test("selection result rejects malformed documented fields but permits explicit undefined", () => {
	const validCardBase = { name: "sha", nature: null, cards: [new TestCard()] };
	assert.equal(isSelectionResultObject({ card: validCardBase, bool: undefined, cost_data: undefined }, runtime), true);
	const inheritedCards = Object.create({ cards: [new TestCard()] });
	const throwingAccessor = {};
	Object.defineProperty(throwingAccessor, "cards", {
		get() {
			throw new Error("selection boundary must not read accessors");
		},
	});
	assert.equal(isSelectionResultObject(inheritedCards, runtime), false);
	assert.equal(isSelectionResultObject(throwingAccessor, runtime), false);

	const malformedResults = [{ cards: [new TestVCard()] }, { targets: [new TestCard()] }, { buttons: [{ link: "not-a-div" }] }, { numbers: [1, "two"] }, { card: { name: 1 } }, { card: { cards: [new TestVCard()] } }, { cost_data: [] }, { bool: "true" }, { confirm: 1 }, { buttons: [Object.defineProperty({}, "hidden", { value: true })] }, { buttons: [{ [Symbol("hidden")]: true }] }];
	for (const result of malformedResults) {
		assert.equal(isSelectionResultObject(result, runtime), false);
	}
});

test("selection buttons require a div while arbitrary links remain external input", () => {
	const button = createSelectableDiv("skill");
	assert.equal(isSelectionResultObject({ buttons: [button], links: [Symbol("extension-link")] }, runtime), true);
	assert.equal(isSelectionResultObject({ buttons: [document.createElement("span")] }, runtime), false);
});

test("production wire codec restores ordinary button divs as serialized button placeholders", () => {
	const get = createProductionWireCodec();
	const button = createSelectableDiv("skill");
	button.classList.add("button");
	const serialized = get.stringifiedResult({ buttons: [button] });
	const parsed = get.parsedResult(JSON.parse(JSON.stringify(serialized)));

	assert.deepEqual(serialized, { buttons: [{}] });
	assert.equal(isSelectionResultObject(parsed, runtime), true);
});

test("content entity guards only accept the exact card shape used by each consumer", () => {
	const guards = createContentEntityGuards();
	const card = new TestCard();
	const vcard = new TestVCard();

	assert.equal(guards.isCardLinks([card]), true);
	assert.equal(guards.isCardLinks([vcard]), false);
	assert.equal(guards.isVCardLinks([vcard]), true);
	assert.equal(guards.isVCardLinks([card]), false);
	assert.equal(guards.isCardMatrix([[card], []]), true);
	assert.equal(guards.isCardMatrix([[vcard]]), false);
});

test("chooseToGuanxing does not move cards when its matrix is not entity cards", async () => {
	const guards = createContentEntityGuards();
	const consumer = new Function("result", "game", "event", "isCardMatrix", `return (async () => { ${transpile(getChooseToGuanxingConsumerText())} })();`);
	const calls = [];
	const game = {
		cardsGotoPile(...args) {
			calls.push(args);
		},
	};

	await consumer({ moved: [[new TestVCard()]] }, game, {}, guards.isCardMatrix);
	assert.equal(calls.length, 0);
	await consumer({ moved: [[new TestCard()]] }, game, {}, guards.isCardMatrix);
	assert.equal(calls.length, 1);
});

test("mode payload discrimination keeps open extension fields without claiming complete configuration", () => {
	assert.equal(isImportModePayload({ name: "identity", start() {}, extensionSetting: { enabled: true } }), true);
	assert.equal(isImportModePayload({ name: "identity", start: [() => {}], extensionSetting: "kept" }), true);
	assert.equal(isImportModePayload({ name: 1, start() {} }), false);
	assert.equal(isImportModePayload({ name: "identity", start: ["not-a-function"] }), false);
});
