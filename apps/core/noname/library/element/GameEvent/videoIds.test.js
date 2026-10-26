import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("content.ts", readFileSync(new URL("../content.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const content = source.statements.flatMap(node => (ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])).find(node => node.name.getText(source) === "Content").initializer;
function callback(name, runtime) {
	const property = content.properties.find(node => node.name?.getText(source) === name);
	const expression = ts.isMethodDeclaration(property) ? `({${property.getText(source)}}).${name}` : property.initializer.elements[0].getText(source);
	const code = ts.transpileModule(`const callback = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
	return new Function(...Object.keys(runtime), `${code}; return callback;`)(...Object.values(runtime));
}
function counter(value) {
	const operations = [];
	return {
		operations,
		status: {
			get videoId() {
				operations.push(["read", value]);
				return value;
			},
			set videoId(next) {
				operations.push(["write", next]);
				value = next;
			},
		},
	};
}

test("judge assigns videoId and increments the shared counter even when the original no-card branch finishes", async () => {
	const { operations, status } = counter(40);
	const sequence = [];
	const event = {
		judgestr: "test",
		finish() {
			sequence.push("finish");
		},
	};
	const first = callback("judge", {
		lib: { status },
		get: {
			translation: () => "player",
			cards() {
				sequence.push("cards");
				return [];
			},
		},
	});
	assert.equal(Object.hasOwn(event, "videoId"), false);
	await first(event, undefined, {});
	assert.equal(event.videoId, 40);
	assert.deepEqual(operations, [
		["read", 40],
		["write", 41],
	]);
	assert.deepEqual(sequence, ["cards", "finish"]);
});

test("showHandcards keeps the counter, broadcast ID and post-await dialog-ID reread in their original order", async () => {
	const { operations, status } = counter(8);
	const calls = [];
	const cards = [{ id: "material" }];
	const dialogs = [];
	const event = {};
	const ui = {
		create: {
			dialog(str, values) {
				const dialog = {
					close() {
						calls.push("close-local");
					},
				};
				dialogs.push([str, values, dialog]);
				return dialog;
			},
		},
	};
	const closeDialog = id => calls.push(["close-remote", id]);
	const lib = { status, message: { client: { closeDialog } } };
	const game = {
		broadcast(fn, ...args) {
			fn(...args);
		},
		log() {
			calls.push("log");
		},
		addVideo(name, owner, payload) {
			calls.push(["video", name, owner, payload]);
		},
		async delayx() {
			calls.push("delay");
			await Promise.resolve();
			event.dialogid = 99;
		},
	};
	const next = {
		setContent(fn) {
			assert.equal(typeof fn, "function");
			calls.push("bind-child");
		},
		then(resolve) {
			calls.push("await-child");
			resolve();
		},
	};
	const player = {
		name: "owner",
		countCards: () => 1,
		getCards: () => cards,
		showCards(values) {
			assert.equal(values, cards);
			return next;
		},
	};
	const show = callback("showHandcards", { game, lib, ui, get: { translation: value => value, cardsInfo: values => values } });
	await show(event, undefined, player);
	assert.deepEqual(operations, [
		["read", 8],
		["write", 9],
	]);
	assert.equal(dialogs[0][1], cards);
	assert.equal(dialogs[1][1], cards);
	assert.equal(dialogs[0][2].videoId, 8);
	assert.equal(dialogs[1][2].videoId, 8);
	assert.equal(event.dialogid, 99);
	assert.deepEqual(calls.slice(-4), ["delay", "await-child", ["close-remote", 99], "close-local"]);
	const empty = {};
	await show(empty, undefined, { countCards: () => 0 });
	assert.equal(Object.hasOwn(empty, "dialogid"), false);
	assert.equal(operations.length, 2);
});

test("lose writes discardid on the real parent and preserves animation opt-out and material copying", async () => {
	const { operations, status } = counter(20);
	const ui = { todiscard: {} };
	const throws = [];
	const game = {
		broadcastAll(fn, ...args) {
			fn(...args);
		},
	};
	const first = callback("lose", { game, lib: { status, config: {} }, ui, get: { time: () => 123 } });
	const parent = { name: "discard" };
	const material = { id: "material" };
	const wrapper = { cards: [material] };
	const cards = [wrapper];
	const event = {
		cards,
		type: "discard",
		getParent(...args) {
			assert.deepEqual(args, [undefined, true]);
			return parent;
		},
	};
	const player = {
		$throw(...args) {
			throws.push([this, ...args]);
		},
	};
	await first(event, undefined, player);
	assert.equal(parent.discardid, 20);
	assert.equal(Object.hasOwn(event, "discardid"), false);
	assert.deepEqual(operations, [
		["read", 20],
		["write", 21],
	]);
	assert.equal(throws.length, 1);
	assert.equal(throws[0][0], player);
	assert.notEqual(throws[0][1], cards);
	assert.equal(throws[0][1][0], material);
	assert.deepEqual(throws[0].slice(2), [null, "nobroadcast"]);
	assert.equal(ui.todiscard[20]._discardtime, 123);
	const hiddenParent = { name: "discard", animate: false };
	await first({ cards, type: "discard", getParent: () => hiddenParent }, undefined, player);
	assert.equal(Object.hasOwn(hiddenParent, "discardid"), false);
	assert.equal(operations.length, 2);
	const unrelated = { name: "other" };
	const unrelatedEvent = { cards, type: "discard", getParent: () => unrelated };
	await first(unrelatedEvent, undefined, player);
	assert.equal(unrelatedEvent.delay, false);
	assert.equal(Object.hasOwn(unrelated, "discardid"), false);
});
