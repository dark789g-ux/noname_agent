import assert from "node:assert/strict";
import test from "node:test";
import type { ChatCompletionTool } from "openai/resources/chat/completions.js";
import { RemoteSessionTransport } from "./remote-session.js";
import type { TransportTurnInput } from "../types.js";

test("常驻会话使用显式工具集生成手册、schema 并校验返回工具", async t => {
	const tools: ChatCompletionTool[] = [
		{
			type: "function",
			function: { name: "select_character", description: "选将", parameters: { type: "object", properties: {} } },
		},
	];
	const input: TransportTurnInput = {
		sessionKey: "game:opening:seat_1",
		gameId: "game",
		seatNum: 1,
		backend: { kind: "codex", label: "codex", configured: true, model: "", timeoutSec: 30, maxRetries: 0, thinkingEffort: "default" },
		tools,
		remoteSessionTools: tools,
		fullTranscript: [
			{ role: "system", content: "选将" },
			{ role: "user", content: "请选择" },
		],
		deltaMessages: [],
		resetRemoteSession: true,
		allowStream: true,
		deadline: Date.now() + 30000,
	};
	const originalFetch = globalThis.fetch;
	t.after(() => {
		globalThis.fetch = originalFetch;
	});
	let request: any;
	globalThis.fetch = async (_url, options) => {
		request = JSON.parse(String(options?.body));
		const result = { type: "result", rawOutput: { tool: "select_character", reason: "选择武将", arguments_json: "{}" } };
		return new Response(`data: ${JSON.stringify(result)}\n\n`);
	};
	const result = await new RemoteSessionTransport().sendTurn(input);
	assert.deepEqual(request.jsonSchema.properties.tool.enum, ["select_character"]);
	assert.match(request.prompt, /`select_character`/);
	assert.doesNotMatch(request.prompt, /`use_card`/);
	assert.equal(result.toolCall.name, "select_character");
});

test("主动取消远端请求后不进行修复或会话重建", async t => {
	const originalFetch = globalThis.fetch;
	t.after(() => {
		globalThis.fetch = originalFetch;
	});
	let calls = 0;
	globalThis.fetch = async (_url, options) => {
		calls++;
		return await new Promise<Response>((_resolve, reject) => {
			options?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
		});
	};
	const controller = new AbortController();
	const pending = new RemoteSessionTransport().sendTurn({
		sessionKey: "game:opening:seat_1",
		gameId: "game",
		seatNum: 1,
		backend: { kind: "codex", label: "codex", configured: true, model: "", timeoutSec: 30, maxRetries: 0, thinkingEffort: "default" },
		tools: [],
		fullTranscript: [{ role: "system", content: "选将" }],
		deltaMessages: [{ role: "user", content: "选择" }],
		resetRemoteSession: false,
		allowStream: true,
		deadline: Date.now() + 30000,
		signal: controller.signal,
	});
	controller.abort();
	await assert.rejects(pending, { name: "AbortError" });
	assert.equal(calls, 1);
});
