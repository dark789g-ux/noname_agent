import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { itemType } from "../library/experimental/symbol.js";

const source = ts.createSourceFile("game.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const gameClass = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Game");
const method = gameClass.members.find(node => node.name?.getText(source) === "logv");

class Div {
	style = {};
	classList = { add() {}, remove() {} };
	children = [];
	appendChild(child) { this.children.push(child); }
	insertBefore(child) { this.children.unshift(child); }
	cloneNode() { return new Div(); }
	addEventListener() {}
}
class Card extends Div {
	name = "wuxie";
	suit = "spade";
	number = 1;
	copy(node) { node.appendChild(new Div()); }
}
class VCard { name = "sha"; }

function fixture() {
	const history = new Div();
	history.offsetHeight = 400;
	Object.defineProperty(history, "childNodes", { get: () => history.children });
	Object.defineProperty(history, "firstElementChild", { get: () => history.children[0] });
	const ui = { historybar: history, create: { div: () => new Div() }, refresh() {}, click: {} };
	const actor = { node: { avatar: new Div() }, isUnseen: () => false };
	const calls = [];
	const game = { broadcast: (...args) => calls.push(args), online: false };
	const lib = { element: { Card, VCard }, config: { touchscreen: false } };
	const get = { id: () => "history-1", plainText: value => value, itemtype: value => value[itemType] || (value === actor ? "player" : value instanceof Card ? "card" : "vcard") };
	const event = {};
	game.logv = new Function("game", "lib", "get", "ui", "_status", "HTMLDivElement", "isHistoryLogNode", `return ({${method.getText(source)}}).logv;`)(game, lib, get, ui, { event }, Div, value => value instanceof Div && typeof value.logvid === "string");
	return { game, actor, history, calls, event, get };
}

test("wuxie history keeps card targets by identity without creating player avatars", () => {
	for (const target of [new Card(), new VCard(), { [itemType]: "card", name: "sha" }]) {
		const { game, actor, history, calls, event } = fixture();
		const physical = new Card();
		const cards = [physical];
		const targets = [target];
		game.logv(actor, [physical, cards], targets);
		const node = history.children[0];
		assert.equal(node.targets, targets);
		assert.equal(node.targets[0], target);
		assert.notEqual(node.cards, cards);
		assert.deepEqual(node.cards, cards);
		assert.equal(node.node.avatar2, undefined);
		assert.equal(calls[0][3], targets);
		assert.equal(event.logvid, "history-1");
	}
});

test("ordinary history retains the original player-target avatar path", () => {
	const { game, actor, history, get } = fixture();
	const target = { node: { avatar: new Div() }, isUnseen: () => false };
	get.itemtype = value => value === target ? "player" : "card";
	const card = new Card();
	card.name = "sha";
	game.logv(actor, [card, [card]], [target]);
	const node = history.children[0];
	assert.ok(node.node.avatar2 instanceof Div);
	assert.equal(node.targets[0], target);
});
