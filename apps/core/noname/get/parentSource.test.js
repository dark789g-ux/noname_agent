import { getTestText } from "./testing/testSource.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { gameEventTestSource } from "../library/element/GameEvent/testSource.js";

function readClass(path, name) {
	const source = name === "GameEvent" ? gameEventTestSource() : ts.createSourceFile(path, name === "Get" ? getTestText() : readFileSync(new URL(path, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
	const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === name);
	assert.ok(declaration);
	return { source, declaration };
}

const getSource = readClass("./index.js", "Get");
const eventSource = readClass("../library/element/gameEvent.ts", "GameEvent");
const method = getSource.declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(getSource.source) === "cardsetion");

function harness() {
	const game = { online: false, hasPlayer2: () => false, globalEventHandlers: { addHandlerToEvent() {} } };
	const status = { eventManager: {} };
	const javascript = ts.transpileModule(eventSource.declaration.getText(eventSource.source).replace(/^export\s+/, ""), { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
	const GameEvent = new Function("game", "_status", `${javascript}; return GameEvent;`)(game, status);
	const lib = { translate: {}, skill: {}, card: {}, element: { GameEvent } };
	const get = { event: () => status.event, slimName: name => name, groupnature: value => value, bordergroup: () => "wei" };
	const cardsetion = new Function("game", "lib", "get", "_status", `return ({${method.getText(getSource.source)}}).cardsetion;`)(game, lib, get, status);
	status.event = new GameEvent("draw");
	const player = { name: "test", getSeatNum: () => 1 };
	return { game, lib, get, status, GameEvent, cardsetion, player };
}

test("card information accepts a real empty parent fallback without fabricating an event", () => {
	const { cardsetion, player } = harness();
	assert.equal(cardsetion(player, true), false);
	assert.match(cardsetion(player), /test/);
});

test("card information follows the current source event and native undefined translation-key lookup", () => {
	const { cardsetion, player, lib, status, GameEvent } = harness();
	const parent = new GameEvent("skill");
	lib.translate.skill = "测试技能";
	parent.next.push(status.event);
	assert.equal(cardsetion(player, true), parent);
	status.event = new GameEvent("gain");
	let reads = 0;
	Object.defineProperty(lib.translate, "undefined", {
		get() {
			reads++;
			return "undefined key";
		},
	});
	assert.equal(cardsetion(player, true), false);
	assert.equal(reads, 1);
});

test("missing local player still fails only at the required capability, after optional name formatting", () => {
	const { cardsetion, game, get } = harness();
	game.me = null;
	const formatted = [];
	get.slimName = name => {
		formatted.push(name);
		return name;
	};
	assert.throws(() => cardsetion(null, true), TypeError);
	assert.deepEqual(formatted, [undefined]);
	game.online = true;
	assert.equal(cardsetion(null, true), undefined);
	assert.deepEqual(formatted, [undefined]);
});

test("judgment information reads its card once and only requires it for display", () => {
	const { cardsetion, get, player, status, GameEvent } = harness();
	status.event = new GameEvent("phaseJudge");
	let reads = 0;
	let card;
	Object.defineProperty(status.event, "card", {
		get() {
			reads++;
			return card;
		},
	});
	assert.equal(cardsetion(player, true), false);
	assert.equal(reads, 0);
	assert.throws(() => cardsetion(player), TypeError);
	assert.equal(reads, 1);
	card = { name: "lebu", viewAs: "bingliang" };
	get.translation = name => name;
	assert.match(cardsetion(player), /bingliang/);
	assert.equal(reads, 2);
});
