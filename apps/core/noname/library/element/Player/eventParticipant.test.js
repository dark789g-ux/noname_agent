import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { gameEventTestSource } from "../GameEvent/testSource.js";

function readClass(path, name) {
	const source = name === "GameEvent" ? gameEventTestSource() : ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
	const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === name);
	assert.ok(declaration);
	return { source, declaration };
}

const player = readClass("../player.js", "Player");
const event = readClass("../gameEvent.ts", "GameEvent");

function method(tree, name) {
	const node = tree.declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(tree.source) === name);
	assert.ok(node);
	return node;
}

function loadCallback(name, property) {
	let callback;
	function visit(node) {
		if (ts.isBinaryExpression(node) && node.left.getText(player.source) === `next.${property}` && ts.isFunctionExpression(node.right)) callback = node.right;
		ts.forEachChild(node, visit);
	}
	visit(method(player, name));
	assert.ok(callback);
	return new Function(`return (${callback.getText(player.source)});`)();
}

const getPlayer = new Function(`return ({${method(event, "getPlayer").getText(event.source)}}).getPlayer;`)();

for (const name of ["chooseCard", "chooseToDiscard"]) {
	test(`${name} autochoose preserves early exits and rereads the player after filters`, () => {
		const body = method(player, name).getText(player.source);
		let callback;
		function visit(node) {
			if (ts.isBinaryExpression(node) && node.left.getText(player.source) === "next.autochoose") callback = node.right;
			ts.forEachChild(node, visit);
		}
		visit(method(player, name));
		assert.ok(callback, body);
		const seen = [];
		const next = { getPlayer, forced: false, selectCard: [1, 1], position: "h" };
		const replacement = { countCards: () => 1 };
		const initial = { getCards: () => [{}] };
		next.filterCard = (_card, current) => {
			seen.push(current);
			next.player = replacement;
			return true;
		};
		const autochoose = new Function("get", "lib", `return (${callback.getText(player.source)});`)(
			{ select: range => range },
			{ filter: { cardDiscardable: (_card, current) => { seen.push(current); return true; } } }
		);
		assert.equal(autochoose.call(next), false);
		next.forced = true;
		for (const earlyExit of [
			{ selectCard: () => [1, 1] },
			{ complexCard: true },
			{ complexSelect: true },
			{ filterOk: () => true },
			...(name === "chooseCard" ? [{ type: "compare" }] : []),
		]) {
			assert.equal(autochoose.call({ ...next, ...earlyExit }), false);
		}
		assert.throws(() => autochoose.call(next), /requires a player/);
		next.player = initial;
		assert.equal(autochoose.call(next), true);
		assert.equal(seen[0], initial);
		if (name === "chooseToDiscard") assert.equal(seen[1], replacement);
	});
}

test("recover filterStop preserves the nonpositive short circuit and requires a player only otherwise", () => {
	const filterStop = loadCallback("recover", "filterStop");
	const next = { getPlayer, num: 0, finish() { this.finished = true; } };
	assert.equal(filterStop.call(next), true);
	assert.equal(next.finished, true);
	next.num = 1;
	assert.throws(() => filterStop.call(next), /requires a player/);
	next.player = { isHealthy: () => false };
	assert.equal(filterStop.call(next), undefined);
	next.player = { isHealthy: () => true };
	assert.equal(filterStop.call(next), true);
});

test("dying filterStop reads the current player each time", () => {
	const filterStop = loadCallback("dying", "filterStop");
	const next = { getPlayer, player: { hp: 0 } };
	assert.equal(filterStop.call(next), undefined);
	next.player = { hp: 1 };
	assert.equal(filterStop.call(next), true);
	delete next.player;
	assert.throws(() => filterStop.call(next), /requires a player/);
});

for (const name of ["mayHaveSha", "mayHaveShan"]) {
	test(`${name} keeps the shown-card fallback when the current event has no player`, () => {
		const evaluate = new Function("get", "_status", `return ({${method(player, name).getText(player.source)}}).${name};`)(
			{ itemtype: value => value ? "player" : undefined },
			{ event: { player: null } }
		);
		const subject = { hp: 0, getShownCards: () => [], getCards: () => [], getKnownCards: () => assert.fail("no viewer") };
		assert.equal(evaluate.call(subject, undefined, undefined, undefined, "count"), 0);
	});
}

test("getKnownCards preserves the legacy null warning and viewer fallback", () => {
	const trace = [];
	const observed = [];
	const current = { id: "current" };
	let eventPlayer = current;
	const load = new Function("get", "console", `return ({${method(player, "iterableGetKnownCards").getText(player.source)}, ${method(player, "getKnownCards").getText(player.source)}});`);
	const subject = load({ player: () => eventPlayer }, { trace: message => trace.push(message) });
	const card = { isKnownBy(viewer) { observed.push(viewer); return true; } };
	subject.iterableGetCards = () => [card];
	assert.deepEqual(subject.getKnownCards(null), [card]);
	assert.equal(observed[0], current);
	assert.equal(trace.length, 1);
	eventPlayer = undefined;
	assert.deepEqual(subject.getKnownCards(null), [card]);
	assert.equal(observed[1], subject);
	assert.equal(trace.length, 2);
});
