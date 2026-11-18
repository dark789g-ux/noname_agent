import assert from "node:assert/strict";
import test from "node:test";
import { fetchDeckMonitorResult } from "./arena/deckMonitorResult.js";

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
	assert.deepEqual(await fetchDeckMonitorResult({ online: true, ws: socket }, {}), data);
	assert.deepEqual(calls, [["cardPile"]]);
});

test("missing or failing online sockets retain the existing false result", async () => {
	for (const ws of [undefined, null, { send() { throw new Error("closed"); } }]) {
		assert.equal(await fetchDeckMonitorResult({ online: true, ws }, {}), false);
	}
});

test("offline deck monitoring retains the existing DOM collection identities", async () => {
	const drawPile = [];
	const discardPile = [];
	const result = await fetchDeckMonitorResult({ online: false }, { cardPile: { children: drawPile }, discardPile: { children: discardPile } });
	assert.equal(result.drawPile, drawPile);
	assert.equal(result.discardPile, discardPile);
});
