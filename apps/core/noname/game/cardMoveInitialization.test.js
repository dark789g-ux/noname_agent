import { contentTestSource } from "../llm/testing/content-runtime.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { playerTestSource } from "../library/element/Player/testSource.js";
import { itemType } from "../library/experimental/symbol.js";

const realContentSource = await contentTestSource();

const source = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Game");
const method = declaration.members.find(node => node.name?.getText(source) === "cardsDiscard");
const eventSource = ts.createSourceFile("initializeEvent.ts", readFileSync(new URL("../library/element/GameEvent/initializeEvent.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const initializer = eventSource.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "initializeEvent");
assert.ok(method && initializer);
const initializeEvent = new Function(ts.transpileModule(`${initializer.getText(eventSource).replace(/^export\s+/, "")}; return initializeEvent;`, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText)();
const getSource = ts.createSourceFile("get.js", readFileSync(new URL("../get/index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const getClass = getSource.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Get");
const itemtype = getClass.members.find(node => node.name?.getText(getSource) === "itemtype");

function harness() {
	class Card {}
	const writes = [];
	const created = [];
	const removed = [];
	const game = {
		$cardsGotoPile(event) {
			writes.push(["immediate", event]);
		},
		createEvent(name) {
			let cards;
			const event = {
				name,
				setContent(content) {
					assert.ok(Array.isArray(cards), "the producer must write cards before binding discard content");
					writes.push(["content", content, { insert_card: this.insert_card, washCard: this.washCard, _triggeronly: this._triggeronly }]);
				},
			};
			Object.defineProperty(event, "cards", {
				get: () => cards,
				set(value) {
					cards = value;
					if (Array.isArray(value)) {
						Object.defineProperties(value, {
							add: {
								configurable: true,
								value(item) {
									if (!this.includes(item)) this.push(item);
									return this;
								},
							},
							addArray: {
								configurable: true,
								value(items) {
									for (const item of items) this.add(item);
									return this;
								},
							},
						});
					}
					writes.push(["cards", value]);
				},
				enumerable: true,
			});
			created.push(event);
			return event;
		},
	};
	const lib = { element: { Card, Player: class {}, VCard: class {}, Button: class {}, Dialog: class {}, GameEvent: class {} }, card: { sha: {} }, natureSeparator: "|", nature: new Set(), experimental: { symbol: { itemType } }, commonArea: new Map() };
	const get = { is: { object: value => value !== null && typeof value === "object" && !Array.isArray(value) }, objtype: () => undefined };
	get.itemtype = new Function("lib", "get", "HTMLDivElement", `return ({${itemtype.getText(getSource)}}).itemtype;`)(lib, get, class {});
	const discard = new Function("game", "get", "ui", "initializeEvent", `return ({${method.getText(source)}}).cardsDiscard;`)(game, get, {}, initializeEvent);
	const orderingMethod = declaration.members.find(node => node.name?.getText(source) === "cardsGotoOrdering");
	const ordering = new Function("game", "get", `return ({${orderingMethod.getText(source)}}).cardsGotoOrdering;`)(game, get);
	const pileMethod = declaration.members.find(node => node.name?.getText(source) === "cardsGotoPile");
	const status = {
		event: {
			next: {
				remove(event) {
					removed.push(event);
				},
			},
		},
	};
	const pile = new Function("game", "get", "_status", `return ({${pileMethod.getText(source)}}).cardsGotoPile;`)(game, get, status);
	return { discard, ordering, pile, created, removed, writes, Card, game, get, lib, status };
}

test("discard initialization keeps the queued instance, material identities and defensive copies", () => {
	const { discard, created, writes, Card } = harness();
	const material = new Card();
	let reads = 0;
	const wrapper = new Card();
	Object.defineProperty(wrapper, "cards", {
		get() {
			reads++;
			return [material];
		},
	});
	const input = [wrapper];
	const event = discard(input);
	assert.equal(event, created[0]);
	assert.equal(reads, 2);
	assert.deepEqual(event.cards, [material]);
	assert.notEqual(event.cards, input);
	assert.deepEqual(
		writes.map(([kind]) => kind),
		["cards", "content"]
	);
	const snapshot = event.getd();
	assert.notEqual(snapshot, event.cards);
	assert.equal(snapshot[0], material);
	snapshot.length = 0;
	assert.equal(event.cards.length, 1);
	input.length = 0;
	assert.equal(event.cards.length, 1);
});

test("discard retains experimental marker input and rejects invalid input before creating an event", () => {
	const { discard, created } = harness();
	assert.equal(discard(undefined), undefined);
	assert.equal(created.length, 0);
	const marked = { [itemType]: "card" };
	assert.equal(discard(marked).cards[0], marked);
	assert.equal(discard([marked]), undefined);
	assert.equal(discard({ [itemType]: "card", name: "sha" }), undefined);
	const event = created[0];
	event.cards = undefined;
	assert.throws(() => event.getd(), TypeError);
});

test("a recognized experimental wrapper expands its associated marker without replacing it", () => {
	const { discard } = harness();
	const material = { [itemType]: "card" };
	const wrapper = { [itemType]: "card", cards: [material] };
	const event = discard(wrapper);
	assert.deepEqual(event.cards, [material]);
	assert.equal(event.cards[0], material);
	assert.notEqual(event.cards, wrapper.cards);
});

test("ordering factory retains single markers but does not promise their movement capabilities", () => {
	const { ordering, created, Card } = harness();
	const marked = { [itemType]: "card" };
	const event = ordering(marked);
	assert.equal(event, created[0]);
	assert.equal(event.cards[0], marked);
	assert.equal(ordering([marked]), undefined);
	const card = new Card();
	const input = [card];
	const physical = ordering(input);
	assert.notEqual(physical.cards, input);
	assert.equal(physical.cards[0], card);
	input.length = 0;
	assert.equal(physical.cards.length, 1);
});

test("pile factory retains marker identity and the original empty-candidate removal", () => {
	const { pile, created, removed, Card } = harness();
	const marked = { [itemType]: "card" };
	const event = pile(marked);
	assert.equal(event, created[0]);
	assert.equal(event.cards[0], marked);
	assert.equal(event.cards.length, 1);
	const rejectedArray = pile([marked]);
	assert.equal(rejectedArray.cards.length, 0);
	assert.equal(removed[0], rejectedArray);
	const physical = new Card();
	const input = [physical];
	const acceptedArray = pile(input);
	assert.equal(acceptedArray.cards[0], physical);
	input.length = 0;
	assert.equal(acceptedArray.cards.length, 1);
});

test("pile legacy options write flags before binding and perform immediate movement once", () => {
	const { pile, created, writes, Card } = harness();
	const card = new Card();
	const event = pile(card, "insert", "washCard", "triggeronly");
	assert.equal(event, created[0]);
	assert.equal(event.insert_card, true);
	assert.equal(event.washCard, true);
	assert.equal(event._triggeronly, true);
	assert.equal(event.cards[0], card);
	assert.deepEqual(
		writes.map(([kind]) => kind),
		["cards", "content", "immediate"]
	);
	assert.deepEqual(writes[1][2], { insert_card: true, washCard: true, _triggeronly: true });
	assert.equal(writes.at(-1)[1], event);
});

test("both loss producers preserve insert flags and legacy positional array copies", () => {
	const source = playerTestSource();
	const playerClass = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Player");
	for (const name of ["lose", "loseToDiscardpile"]) {
		const runtime = harness();
		const method = playerClass.members.find(node => node.name?.getText(source) === name);
		const run = new Function("game", "get", "lib", "ui", "_status", `return ({${method.getText(source)}})[${JSON.stringify(name)}];`)(runtime.game, runtime.get, runtime.lib, {}, runtime.status);
		const card = new runtime.Card();
		const input = [card];
		const player = {
			getCards(position) {
				assert.equal(position, "hejsx");
				return [card];
			},
		};
		const legacy = run.call(player, input, "insert");
		assert.equal(legacy.insert_card, true);
		assert.equal(legacy.player, player);
		assert.equal(legacy.cards[0], card);
		assert.notEqual(legacy.cards, input);
		input.length = 0;
		assert.equal(legacy.cards.length, 1);
		const configured = run.call(player, { cards: [card], insert_card: false });
		assert.equal(Object.hasOwn(configured, "insert_card"), true);
		assert.equal(configured.insert_card, false);
	}
});

test("pile content rereads trigger-only after its wash hook and waits for that hook", async () => {
	const contentSource = realContentSource;
	const statement = contentSource.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(contentSource) === "Content"));
	const contentObject = statement.declarationList.declarations.find(item => item.name.getText(contentSource) === "Content").initializer;
	const callback = contentObject.properties.find(node => node.name?.getText(contentSource) === "cardsGotoPile");
	const calls = [];
	let completeWash;
	const pendingWash = new Promise(resolve => {
		completeWash = resolve;
	});
	const history = [];
	const game = {
		getGlobalHistory: () => ({ cardMove: history }),
		$cardsGotoPile(event) {
			calls.push(["move", event]);
		},
	};
	const lib = {
		onwash: [
			() => {
				calls.push(["wash"]);
				return "remove";
			},
		],
		commonArea: new Map(),
	};
	const javascript = ts.transpileModule(`const callbacks = {${callback.getText(contentSource)}};`, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
	const run = new Function("game", "lib", `${javascript}; return callbacks.cardsGotoPile;`)(game, lib);
	const event = {
		cards: [],
		washCard: true,
		_triggeronly: true,
		trigger(name) {
			calls.push(["trigger", name]);
			this._triggeronly = false;
			return pendingWash;
		},
	};
	const finished = run(event, undefined, undefined);
	let settled = false;
	finished.then(() => {
		settled = true;
	});
	await Promise.resolve();
	assert.equal(settled, false);
	assert.deepEqual(
		calls.map(([name]) => name),
		["trigger", "wash", "move"]
	);
	assert.equal(calls[0][1], "washCard");
	assert.equal(calls[2][1], event);
	assert.equal(history[0], event);
	assert.equal(lib.onwash.length, 0);
	completeWash();
	await finished;
	assert.equal(settled, true);
	calls.length = 0;
	const alreadyMoved = { cards: [], _triggeronly: true };
	await run(alreadyMoved, undefined, undefined);
	assert.equal(calls.length, 0, "an unchanged trigger-only flag must not move the cards twice");
	assert.equal(history[1], alreadyMoved);
});
