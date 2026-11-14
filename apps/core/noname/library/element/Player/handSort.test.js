import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { playerTestSource } from "./testSource.js";

const source = playerTestSource();
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Player");

function loadMethod(name, dependencies) {
	const method = declaration.members.find(node => node.name?.getText(source) === name);
	assert.ok(method);
	return new Function(...Object.keys(dependencies), `return function(${method.parameters.map(node => node.getText(source)).join(",")}) ${method.body.getText(source)}`)(...Object.values(dependencies));
}

function harness(cards, noSort = false) {
	const laidOut = [];
	const container = () => ({ style: {}, prepend(...cards) { laidOut.push(cards); } });
	const player = { hasSkillTag: name => name === "noSortCard" && noSort, getCards: () => cards, node: { handcards1: container(), handcards2: container() } };
	const game = { me: null };
	const get = { is: { singleHandcard: () => true } };
	const lib = { config: { sort_card: () => 1 }, sort: { card: (a, b) => a.localeCompare(b) }, suit: [] };
	const sort = loadMethod("sortHandcard", { get, lib, game, ui: {} });
	return { run: value => sort.call(player, value), laidOut };
}

test("custom comparators keep native coercion, arguments and undefined receiver", () => {
	for (const convert of [value => value, value => String(value), value => value > 0, () => undefined]) {
		const cards = [{ name: "c" }, { name: "a" }, { name: "b" }];
		const compare = (a, b) => convert(a.name.localeCompare(b.name));
		const expected = cards.slice().sort(compare);
		const { run, laidOut } = harness(cards);
		let calls = 0;
		run(function (a, b) {
			assert.equal(this, undefined);
			assert.equal(arguments.length, 2);
			assert.equal(cards.includes(a) && cards.includes(b), true);
			calls++;
			return compare(a, b);
		});
		assert.ok(calls > 0);
		if (expected.every((card, index) => card === cards[index])) assert.deepEqual(laidOut, []);
		else assert.deepEqual(laidOut, [expected.toReversed()]);
	}
});

test("sort keeps BigInt failures, mixed index arrays and early exits", () => {
	const cards = [{ name: "a" }, { name: "b" }];
	assert.throws(() => harness(cards).run(() => 1n), TypeError);
	const { run, laidOut } = harness(cards);
	run([null, cards[1], "extension", cards[0]]);
	assert.deepEqual(laidOut, [[cards[0], cards[1]]]);
	const fail = () => assert.fail("comparator should not be called");
	assert.equal(harness(cards, true).run(fail), false);
	assert.equal(harness([]).run(fail), false);
	assert.equal(harness(cards).run({ ignored: true }), undefined);
});

test("sortHandcardOL forwards the exact extension input and preserves synchronization", () => {
	const calls = [];
	const game = { online: false, syncHandcard(...args) { calls.push(["sync", ...args]); } };
	const sort = loadMethod("sortHandcardOL", { game, _status: { connectMode: true } });
	let result;
	const player = { sortHandcard(value) { calls.push(["sort", this, value]); return result; }, getCards: () => [{ cardid: "one" }, { cardid: 2 }] };
	const value = () => "1";
	sort.call(player, value);
	assert.deepEqual(calls, [["sort", player, value], ["sync", player, ["one"]]]);
	calls.length = 0;
	result = false;
	sort.call(player, value);
	assert.deepEqual(calls, [["sort", player, value]]);
});
