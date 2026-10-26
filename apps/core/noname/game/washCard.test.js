import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { itemType } from "../library/experimental/symbol.js";

const source = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Game");
const method = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === "washCard");
assert.ok(method);
const getSource = ts.createSourceFile("get.js", readFileSync(new URL("../get/index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const getClass = getSource.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Get");
const itemtype = getClass.members.find(node => node.name?.getText(getSource) === "itemtype");
assert.ok(itemtype);

class Card {
	constructor(name) {
		this.name = name;
		this.vanishtag = ["old"];
		this.storage = {};
		this.cleared = 0;
	}
	clearKnowers() {
		this.cleared++;
	}
}

function setup(pile, discarded) {
	const calls = [];
	const _status = { discarded: ["old"] };
	const game = {
		shuffleNumber: 0,
		cardsGotoPile(...args) {
			calls.push(args);
			return args;
		},
		over: reason => calls.push(reason),
	};
	const ui = { cardPile: { childNodes: pile, hasChildNodes: () => !!pile.length }, discardPile: { childNodes: discarded, hasChildNodes: () => !!discarded.length } };
	const array = {
		from(nodes, map) {
			const result = Array.from(nodes, map);
			Object.defineProperty(result, "randomSort", {
				value() {
					this.reverse();
				},
			});
			return result;
		},
	};
	const wash = new Function("game", "ui", "lib", "get", "_status", "Array", `return function() ${method.body.getText(source)}`)(game, ui, { element: { Card } }, { info: () => ({}) }, _status, array);
	return { wash, calls, game, _status };
}

test("washing copies the physical pile and retains card identities and event arguments", () => {
	const first = new Card("sha"),
		second = new Card("shan");
	const pile = [first],
		discarded = [second];
	const state = setup(pile, discarded);
	const result = state.wash();
	assert.equal(state.game.shuffleNumber, 1);
	assert.deepEqual(state._status.discarded, []);
	assert.deepEqual(second.vanishtag, []);
	assert.equal(second.cleared, 1);
	assert.notEqual(result[0], pile);
	assert.deepEqual(result[0], [second, first]);
	assert.deepEqual(result.slice(1), ["triggeronly", "washCard", ["shuffleNumber", 1]]);
	assert.deepEqual(pile, [first]);
});

test("washing keeps empty-pile and shuffle-limit short circuits", () => {
	const empty = setup([], []);
	assert.equal(empty.wash(), false);
	assert.equal(empty.game.shuffleNumber, 0);
	const limited = setup([new Card("sha")], []);
	limited._status.maxShuffle = 0;
	assert.deepEqual(limited.wash(), []);
	assert.deepEqual(limited.calls, ["平局"]);
	assert.equal(limited.game.shuffleNumber, 0);
});

test("washing rejects malformed discard nodes instead of silently omitting them", () => {
	const state = setup([new Card("sha")], [{}]);
	assert.throws(() => state.wash(), TypeError);
	assert.deepEqual(state.calls, []);
});

function connectPileParser(state) {
	const parser = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === "cardsGotoPile");
	assert.ok(parser);
	const removed = [], moved = [];
	state._status.event = { next: { remove: event => removed.push(event) } };
	state.game.createEvent = name => ({
		name,
		set(key, value) { this[key] = value; },
		setContent(value) { this.content = value; },
	});
	state.game.$cardsGotoPile = event => moved.push(event.cards.slice());
	const lib = {
		element: { Card, Player: class {}, VCard: class {}, Button: class {}, Dialog: class {}, GameEvent: class {} },
		card: { sha: {}, shan: {} },
		natureSeparator: "|", nature: new Set(), experimental: { symbol: { itemType } },
	};
	const get = { is: { object: value => value !== null && typeof value === "object" && !Array.isArray(value) } };
	get.itemtype = new Function("lib", "get", "HTMLDivElement", `return ({${itemtype.getText(getSource)}}).itemtype;`)(lib, get, class {});
	state.game.cardsGotoPile = runInNewContext(`
		Array.prototype.add = function (value) { if (!this.includes(value)) this.push(value); };
		Array.prototype.addArray = function (values) { for (const value of values) this.add(value); };
		({ ${parser.getText(source)} }).cardsGotoPile
	`, { game: state.game, _status: state._status, lib, get });
	return { removed, moved };
}

test("washing mixed DOM snapshots retains the parser's whole-array rejection", () => {
	const dom = new JSDOM();
	try {
		for (const node of [dom.window.document.createTextNode("text"), dom.window.document.createElement("div")]) {
			const first = new Card("sha"), second = new Card("shan");
			const state = setup([first, node], [second]);
			const { removed, moved } = connectPileParser(state);
			const event = state.wash();
			assert.equal(event.cards.length, 0);
			assert.deepEqual(removed, [event]);
			assert.deepEqual(moved, []);
			assert.equal(second.cleared, 1);
		}
	} finally {
		dom.window.close();
	}
});

test("the pile parser copies pure card arrays in order and washing preserves identities", () => {
	const first = new Card("sha"), second = new Card("shan");
	const state = setup([first], [second]);
	const { removed, moved } = connectPileParser(state);
	const input = [first, second];
	const direct = state.game.cardsGotoPile(input);
	assert.notEqual(direct.cards, input);
	assert.deepEqual(Array.from(direct.cards), input);
	assert.equal(direct.cards[0], first);
	assert.equal(direct.cards[1], second);
	assert.equal(direct.content, "cardsGotoPile");
	const washed = state.wash();
	assert.deepEqual(Array.from(washed.cards), [second, first]);
	assert.equal(washed.cards[0], second);
	assert.equal(washed.cards[1], first);
	assert.equal(washed.shuffleNumber, 1);
	assert.equal(washed.washCard, true);
	assert.deepEqual(Array.from(moved[0]), [second, first]);
	assert.deepEqual(removed, []);
});
