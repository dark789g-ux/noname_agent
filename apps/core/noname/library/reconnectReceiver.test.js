import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const calls = new Map();
function visit(node) {
	if (ts.isCallExpression(node)) {
		const text = node.expression.getText(source);
		if (text === "postReconnect[i].shift().apply" || text === "onreconnect.shift().apply") calls.set(text, node.getText(source));
	}
	ts.forEachChild(node, visit);
}
visit(source);

for (const name of ["postReconnect", "onreconnect"]) {
	test(`${name} callback keeps reinit receiver, argument order and destructive shift`, () => {
		const key = name === "postReconnect" ? "postReconnect[i].shift().apply" : "onreconnect.shift().apply";
		const expression = calls.get(key);
		assert.ok(expression);
		const run = new Function("postReconnect", "onreconnect", "i", `"use strict"; return ${expression};`);
		for (const receiver of [undefined, null, { connection: "restored" }]) {
			const first = { card: "sha" };
			const seen = [];
			const tuple = [function (...args) { seen.push({ receiver: this, args }); }, first, 3];
			run.call(receiver, { extension: tuple }, tuple, "extension");
			assert.deepEqual(seen, [{ receiver, args: [first, 3] }]);
			assert.equal(seen[0].receiver, receiver);
			assert.equal(seen[0].args[0], first);
			assert.deepEqual(tuple, [first, 3]);
		}
	});
}
