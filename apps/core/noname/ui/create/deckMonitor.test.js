import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let getResultSource;
function collect(node) {
	if (ts.isFunctionDeclaration(node) && node.name?.text === "getResult" && node.getText(source).includes("Online deck monitoring requires a WebSocket")) {
		assert.equal(getResultSource, undefined);
		getResultSource = node.getText(source);
	}
	ts.forEachChild(node, collect);
}
collect(source);
assert.equal(typeof getResultSource, "string");

function createGetResult(game, ui = {}) {
	return new Function("game", "ui", `return (${getResultSource});`)(game, ui);
}

test("online deck monitoring preserves the socket receiver, request and reply protocol", async () => {
	const data = { drawPile: ["card1"], discardPile: [] };
	const calls = [];
	const socket = {
		send(payload) {
			assert.equal(this, socket);
			calls.push(JSON.parse(payload));
		},
		addEventListener(name, callback, options) {
			assert.equal(this, socket);
			assert.equal(name, "message");
			assert.deepEqual(options, { once: true });
			callback({ data: JSON.stringify([JSON.stringify({ type: "cardPile", data })]) });
		},
	};
	assert.deepEqual(await createGetResult({ online: true, ws: socket })(), data);
	assert.deepEqual(calls, [["cardPile"]]);
});

test("missing or failing online sockets retain the existing false result", async () => {
	for (const ws of [undefined, null, { send() { throw new Error("closed"); } }]) {
		assert.equal(await createGetResult({ online: true, ws })(), false);
	}
});

test("offline deck monitoring retains the existing DOM collection identities", async () => {
	const drawPile = [];
	const discardPile = [];
	const result = await createGetResult({ online: false }, { cardPile: { children: drawPile }, discardPile: { children: discardPile } })();
	assert.equal(result.drawPile, drawPile);
	assert.equal(result.discardPile, discardPile);
});
