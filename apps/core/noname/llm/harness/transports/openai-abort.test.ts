import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { OpenAITransport } from "./openai.js";

for (const allowStream of [true, false]) {
	test(`OpenAI ${allowStream ? "流式" : "非流式"}主动取消后结束等待且不回退/重试`, async () => {
		let received!: () => void;
		const ready = new Promise<void>(resolve => {
			received = resolve;
		});
		let requests = 0;
		const server = createServer((_request, response) => {
			requests++;
			response.writeHead(200, { "content-type": allowStream ? "text/event-stream" : "application/json" });
			response.flushHeaders();
			received();
		});
		await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
		const controller = new AbortController();
		try {
			const pending = new OpenAITransport().sendTurn({
				gameId: "game",
				sessionKey: "game:opening_1:seat_1",
				seatNum: 1,
				backend: {
					kind: "openai",
					label: "test",
					configured: true,
					url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
					apikey: "test",
					model: "test",
					thinkingEffort: "none",
					timeoutSec: 2,
					maxRetries: 0,
				},
				tools: [],
				fullTranscript: [],
				deltaMessages: [],
				resetRemoteSession: true,
				deadline: Date.now() + 2000,
				allowStream,
				signal: controller.signal,
			});
			await ready;
			controller.abort();
			await assert.rejects(pending);
			assert.equal(requests, 1);
		} finally {
			controller.abort();
			server.closeAllConnections();
			await new Promise<void>(resolve => server.close(() => resolve()));
		}
	});
}
