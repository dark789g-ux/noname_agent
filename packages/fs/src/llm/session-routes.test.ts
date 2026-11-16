import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import Fastify from "fastify";
import { LlmSessionHost } from "./session-host";
import { registerLlmSessionRoutes } from "./session-routes";

function createMockSessionScript(root: string): string {
	const scriptPath = path.join(root, "mock-session-acp.mjs");
	const source = `
import readline from "node:readline";

let seq = 0;
let turns = 0;

function send(obj) {
	process.stdout.write(JSON.stringify(obj) + "\\n");
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", line => {
	if (!line.trim()) return;
	const msg = JSON.parse(line);
	if (msg.method === "initialize") {
		send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: 1 } });
		return;
	}
	if (msg.method === "session/new") {
		seq++;
		send({ jsonrpc: "2.0", id: msg.id, result: { sessionId: "s-" + seq } });
		return;
	}
	if (msg.method === "session/set_model") {
		send({ jsonrpc: "2.0", id: msg.id, result: {} });
		return;
	}
	if (msg.method === "session/prompt") {
		turns++;
		send({
			jsonrpc: "2.0",
			method: "session/update",
			params: {
				sessionId: msg.params.sessionId,
				update: { sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "思#" + turns } },
			},
		});
		send({
			jsonrpc: "2.0",
			method: "session/update",
			params: {
				sessionId: msg.params.sessionId,
				update: {
					sessionUpdate: "agent_message_chunk",
					content: { type: "text", text: JSON.stringify({ tool: "pass", reason: "r#" + turns, arguments_json: "{}" }) },
				},
			},
		});
		send({ jsonrpc: "2.0", id: msg.id, result: { stopReason: "end_turn" } });
	}
});
`;
	writeFileSync(scriptPath, source, "utf8");
	return scriptPath;
}

function parseSseFrames(raw: string): Array<Record<string, unknown>> {
	return raw
		.split(/\r?\n\r?\n/)
		.map(frame =>
			frame
				.split(/\r?\n/)
				.filter(line => line.startsWith("data:"))
				.map(line => line.slice(5).trim())
				.join("\n")
		)
		.filter(Boolean)
		.map(json => JSON.parse(json));
}

test("registerLlmSessionRoutes enforces session lifecycle, SSE streaming, delete, and reset-game", async () => {
	const root = mkdtempSync(path.join(tmpdir(), "noname-session-routes-"));
	const script = createMockSessionScript(root);
	const host = new LlmSessionHost();
	const app = Fastify({ logger: false });
	registerLlmSessionRoutes(app, host);

	try {
		const address = await app.listen({ port: 0, host: "127.0.0.1" });

		// 1. Disallowed origin is rejected with 403
		const blocked = await fetch(`${address}/_llm/session/turn`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Origin: "https://evil.example.com" },
			body: JSON.stringify({ sessionKey: "g1:1", provider: "agy", prompt: "hi", jsonSchema: { type: "object" } }),
		});
		assert.equal(blocked.status, 403);

		// 2. Non-reset incremental call before session exists yields session_lost error event
		const missingRes = await fetch(`${address}/_llm/session/turn`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				sessionKey: "g1:1",
				gameId: "g1",
				seatNum: 1,
				provider: "agy",
				command: script,
				reset: false,
				prompt: "delta",
				jsonSchema: { type: "object" },
			}),
		});
		const missingEvents = parseSseFrames(await missingRes.text());
		assert.equal(missingEvents[0]?.type, "error");
		assert.equal(missingEvents[0]?.code, "session_lost");

		// 3. Initial turn with reset=true streams thought_delta, text_delta, result
		const turn1Res = await fetch(`${address}/_llm/session/turn`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				sessionKey: "g1:1",
				gameId: "g1",
				seatNum: 1,
				provider: "agy",
				command: script,
				reset: true,
				prompt: "full",
				jsonSchema: { type: "object" },
			}),
		});
		const turn1Events = parseSseFrames(await turn1Res.text());
		assert.ok(turn1Events.some(e => e.type === "thought_delta" && e.delta === "思#1"));
		const result1 = turn1Events.find(e => e.type === "result");
		assert.ok(result1);
		assert.equal(result1?.reasoningContent, "思#1");
		assert.match(String(result1?.rawOutput), /r#1/);

		// 4. Subsequent turn with reset=false reuses persistent process
		const turn2Res = await fetch(`${address}/_llm/session/turn`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				sessionKey: "g1:1",
				gameId: "g1",
				seatNum: 1,
				provider: "agy",
				command: script,
				reset: false,
				prompt: "delta2",
				jsonSchema: { type: "object" },
			}),
		});
		const turn2Events = parseSseFrames(await turn2Res.text());
		const result2 = turn2Events.find(e => e.type === "result");
		assert.match(String(result2?.rawOutput), /r#2/);

		// 5. Delete & reset-game cleanup
		const delRes = await fetch(`${address}/_llm/session/${encodeURIComponent("g1:1")}`, { method: "DELETE" });
		assert.deepEqual(await delRes.json(), { ok: true, deleted: true });
		assert.equal(host.listSessionKeys().length, 0);

		const resetGameRes = await fetch(`${address}/_llm/session/reset-game`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ gameId: "g1" }),
		});
		assert.deepEqual(await resetGameRes.json(), { ok: true, removed: 0 });
	} finally {
		host.dispose();
		await app.close();
		rmSync(root, { recursive: true, force: true });
	}
});
