import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { readMaximumNumberOfPlayers } from "./playerLimit.js";

const source = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const getters = [];
function visit(node) {
	if (ts.isGetAccessor(node) && node.name.getText(source) === "item" && node.getText(source).includes("readMaximumNumberOfPlayers")) getters.push(node);
	ts.forEachChild(node, visit);
}
visit(source);
assert.equal(getters.length, 2);

for (const [index, fallback] of [10, 12].entries()) {
	test(`player menu preserves default ${fallback}, coercion and invalid setting failures`, () => {
		const status = {};
		const menu = new Function("_status", "get", "readMaximumNumberOfPlayers", `"use strict"; return { ${getters[index].getText(source)} };`)(status, { cnNumber: String }, readMaximumNumberOfPlayers);
		assert.equal(Object.keys(menu.item).length, fallback - 1);
		for (const value of [undefined, null, false, "", 0, NaN]) {
			status.maximumNumberOfPlayers = value;
			assert.equal(Object.keys(menu.item).length, fallback - 1);
		}
		for (const value of ["3", { valueOf: () => 3 }]) {
			status.maximumNumberOfPlayers = value;
			assert.deepEqual(menu.item, { 2: "2人", 3: "3人" });
		}
		status.maximumNumberOfPlayers = 1;
		assert.deepEqual(menu.item, { 2: "2人" });
		status.maximumNumberOfPlayers = { valueOf: () => NaN };
		assert.deepEqual(menu.item, {});
		for (const value of [1n, Symbol("limit")]) {
			status.maximumNumberOfPlayers = value;
			assert.throws(() => menu.item, TypeError);
		}
	});
}

test("player limit reads once with the original receiver and does not clamp Infinity", () => {
	let reads = 0;
	const status = {
		get maximumNumberOfPlayers() {
			assert.equal(this, status);
			reads++;
			return Infinity;
		},
	};
	assert.equal(readMaximumNumberOfPlayers(status, 10, 2), Infinity);
	assert.equal(reads, 1);
});

test("player limit captures Math.max before evaluating the setting getter", () => {
	const original = Math.max;
	const status = {
		get maximumNumberOfPlayers() {
			Math.max = () => 100;
			return 3;
		},
	};
	try {
		assert.equal(readMaximumNumberOfPlayers(status, 10, 2), 3);
	} finally {
		Math.max = original;
	}
});
