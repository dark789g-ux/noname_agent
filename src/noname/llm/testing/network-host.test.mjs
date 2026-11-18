import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { WebSocket, WebSocketServer } from "ws";
import { createDeciderRuntime, choiceEvent } from "./decider-runtime.mjs";
import { tool } from "./skill-runtime.mjs";

test("connected host AI uses the actual choice event; the peer receives its result without a second model decision", async () => {
	const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
	await once(server, "listening");
	const address = server.address();
	assert.ok(address && typeof address === "object");
	const connection = once(server, "connection");
	const client = new WebSocket(`ws://127.0.0.1:${address.port}`);
	await once(client, "open");
	const [peer] = await connection;
	try {
		const f = await createDeciderRuntime();
		f.moduleRuntime.engine._status.connectMode = true;
		f.game.online = false;
		let resumed = 0;
		f.game.uncheck = () => {};
		f.game.resume = () => resumed++;
		const owner = f.player("host-ai");
		const { Content } = await f.moduleRuntime.import("noname/library/element/content.ts");
		const hostEvent = choiceEvent(owner, "chooseBool", { isMine: () => false, isOnline: () => false, choice: false }, f.decide);
		f.queue.push(tool("yes"));
		await Content.chooseBool(hostEvent, undefined, owner);
		assert.equal(hostEvent.result.bool, true);
		assert.equal(f.requests.length, 1);
		const received = once(client, "message");
		peer.send(JSON.stringify(hostEvent.result));
		const [payload] = await received;
		const remoteEvent = choiceEvent(owner, "chooseBool", { isMine: () => false, isOnline: () => true, sendAsync: async () => JSON.parse(payload.toString()) }, f.decide);
		await Content.chooseBool(remoteEvent, undefined, owner);
		assert.equal(remoteEvent.result.bool, true);
		assert.equal(f.requests.length, 1);
		assert.equal(resumed, 2);
	} finally {
		client.terminate();
		peer.terminate();
		await new Promise(resolve => server.close(resolve));
	}
});
