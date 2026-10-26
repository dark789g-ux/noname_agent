import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "AI");
const method = declaration.members.find(node => node.name?.getText(source) === "guessTargetPoints");
const check = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "isTargetPointEstimate");
assert.ok(method && check);
const isTargetPointEstimate = new Function(`${check.getText(source)}; return isTargetPointEstimate;`)();

function harness(cached, access = "11") {
	const calls = [];
	const cards = [{ number: 4 }];
	const target = {
		getCards(zone, filter) { calls.push(["cards", zone]); return cards.filter(filter); },
		getKnownCards(viewer, filter) { calls.push(["known", viewer]); return cards.filter(filter); },
	};
	const event = {
		getTempCache(namespace, key) { calls.push(["read", namespace, key]); return cached; },
		putTempCache(namespace, key, value) { calls.push(["write", namespace, key]); cached = value; return value; },
	};
	const run = new Function("_status", "get", "isTargetPointEstimate", `return ({${method.getText(source)}}).guessTargetPoints;`)({ event }, { number: card => card.number }, isTargetPointEstimate);
	const ai = { getCacheKey() { calls.push(["key"]); return "key"; }, run };
	return { calls, cards, target, evaluate: () => ai.run(target, true, cards, access), get cache() { return cached; } };
}

test("valid point cache hits preserve identity and avoid recalculation or writes", () => {
	for (const nums of [[3], ["unsure"], [null], [undefined], [NaN, Infinity]]) {
		const cached = { nums, max: NaN, min: Infinity };
		const state = harness(cached);
		assert.equal(state.evaluate(), cached);
		assert.deepEqual(state.calls, [["key"], ["read", "guessTargetPoints", "key"]]);
	}
});

test("falsy cache entries retain the original miss and write path", () => {
	for (const cached of [undefined, null, false, 0, ""]) {
		const state = harness(cached);
		const result = state.evaluate();
		assert.deepEqual(result, { nums: [4], max: 4, min: 4 });
		assert.equal(state.cache, result);
		assert.equal(state.calls.filter(([name]) => name === "read").length, 1);
		assert.equal(state.calls.filter(([name]) => name === "write").length, 1);
	}
});

test("self-produced non-numeric point values can be reused without changing arithmetic", () => {
	for (const point of ["unsure", null, undefined, NaN, Infinity]) {
		const state = harness(undefined);
		state.cards[0].number = point;
		const first = state.evaluate();
		assert.equal(first.nums[0], point);
		assert.equal(first.max, Math.min(13, Math.max(point)));
		assert.equal(first.min, Math.max(1, Math.min(point)));
		state.calls.length = 0;
		assert.equal(state.evaluate(), first);
		assert.deepEqual(state.calls, [["key"], ["read", "guessTargetPoints", "key"]]);
	}
});

test("truthy values from another cache contract fail at the return boundary", () => {
	for (const cached of [true, "wrong", {}, { nums: ["wrong"], max: 2, min: 1 }, { nums: [], max: "2", min: 1 }]) {
		const state = harness(cached);
		assert.throws(state.evaluate, TypeError);
		assert.deepEqual(state.calls, [["key"], ["read", "guessTargetPoints", "key"]]);
	}
});

test("disabled cache reads and empty inputs keep their short circuits", () => {
	const state = harness({}, "10");
	assert.deepEqual(state.evaluate(), { nums: [4], max: 4, min: 4 });
	assert.equal(state.calls.some(([name]) => name === "read"), false);
	state.calls.length = 0;
	state.cards.length = 0;
	assert.deepEqual(state.evaluate(), { nums: [], max: 1, min: 13 });
	assert.deepEqual(state.calls, []);
});
