import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { playerTestSource } from "./testSource.js";

const source = playerTestSource();
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Player");
const method = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === "canRespond");

function harness(usable = true) {
	const fallback = {};
	const observed = [];
	const card = { name: "sha" };
	const event = { name: "useCard", card, directHit: [] };
	const current = { getParent: () => fallback };
	const get = {
		canRespond(item) {
			const keys = item === card ? ["shan"] : [];
			keys.addArray = values => { keys.push(...values); };
			return keys;
		},
		type: () => "basic",
		tag: () => false,
		event: () => current,
		itemtype: candidate => candidate === event ? "event" : undefined,
	};
	const player = { getCards: (_position, filter) => [{ name: "shan" }].filter(filter), hasUsableCard: () => usable };
	const lib = { filter: { cardEnabled: (_card, owner, sourceEvent) => { observed.push([owner, sourceEvent]); return true; } } };
	const canRespond = new Function("get", "lib", `return ({${method.getText(source)}}).canRespond;`)(get, lib);
	return { canRespond: () => canRespond.call(player, event, undefined, "use"), event, fallback, observed, player };
}

test("canRespond preserves the empty parent context passed to card filters", () => {
	const { canRespond, observed, player, fallback } = harness();
	assert.equal(canRespond(), true);
	assert.deepEqual(observed, [[player, fallback]]);
});

test("canRespond preserves direct-hit short circuits and the original read count", () => {
	for (const [usable, value, expected, expectedReads] of [[false, undefined, false, 0], [true, true, false, 1], [true, [], true, 2]]) {
		const { canRespond, event } = harness(usable);
		let reads = 0;
		Object.defineProperty(event, "directHit", { get() { reads++; return value; } });
		assert.equal(canRespond(), expected);
		assert.equal(reads, expectedReads);
	}
});

test("canRespond still fails when a usable response has no direct-hit list", () => {
	const { canRespond, event } = harness();
	event.directHit = undefined;
	assert.throws(canRespond, TypeError);
	let reads = 0;
	Object.defineProperty(event, "directHit", { get() { return ++reads === 1 ? [] : true; } });
	assert.throws(canRespond, TypeError);
	assert.equal(reads, 2);
});
