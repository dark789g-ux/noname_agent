import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { CodexAppSessionAdapter } from "./codex-app-adapter";

function createMockCodexAppScript(root: string): string {
	const scriptPath = path.join(root, "mock-codex-app.mjs");
	const source = `
import readline from "node:readline";

let threadSeq = 0;
let turnSeq = 0;
let initializedNotified = false;

function send(obj) {
	process.stdout.write(JSON.stringify(obj) + "\\n");
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", line => {
	if (!line.trim()) return;
	const msg = JSON.parse(line);
	if (msg.method === "initialize") {
		send({ id: msg.id, result: { userAgent: "mock-codex/1.0" } });
		return;
	}
	if (msg.method === "initialized") {
		initializedNotified = true;
		return;
	}
	if (msg.method === "thread/start") {
		threadSeq++;
		send({ id: msg.id, result: { thread: { id: "thr-" + threadSeq } } });
		return;
	}
	if (msg.method === "turn/start") {
		turnSeq++;
		const turnId = "turn-" + turnSeq;
		const text = msg.params?.input?.[0]?.text || "";
		if (text.includes("CRASH_NOW")) {
			send({ id: msg.id, result: { turn: { id: turnId } } });
			setTimeout(() => process.exit(4), 10);
			return;
		}
		if (text.includes("SLOW_TURN")) {
			send({ id: msg.id, result: { turn: { id: turnId } } });
			globalThis.__slowTurn = turnId;
			return;
		}
		send({ id: msg.id, result: { turn: { id: turnId } } });

		setTimeout(() => {
			send({
				method: "item/reasoning/summaryTextDelta",
				params: { threadId: msg.params.threadId, turnId, delta: "判断手牌" },
			});
			send({
				method: "item/reasoning/summaryTextDelta",
				params: { threadId: msg.params.threadId, turnId, delta: "，选择出杀" },
			});
			send({
				method: "thread/tokenUsage/updated",
				params: {
					threadId: msg.params.threadId,
					tokenUsage: {
						last: { inputTokens: 450, outputTokens: 28, reasoningOutputTokens: 12 },
						total: { totalTokens: 900 },
						modelContextWindow: 200000,
					},
				},
			});
			const payload = JSON.stringify({
				tool: "pass",
				reason: "thr=" + threadSeq + ",turn=" + turnSeq + ",init=" + initializedNotified + ",schema=" + Boolean(msg.params?.outputSchema) + ",effort=" + (msg.params?.effort || ""),
				arguments_json: "{}",
			});
			send({
				method: "item/agentMessage/delta",
				params: { threadId: msg.params.threadId, turnId, delta: payload },
			});
			send({
				method: "turn/completed",
				params: { threadId: msg.params.threadId, turn: { id: turnId, status: "completed" } },
			});
		}, 15);
		return;
	}
	if (msg.method === "turn/interrupt") {
		if (globalThis.__slowTurn) {
			send({
				method: "turn/completed",
				params: { threadId: msg.params.threadId, turn: { id: globalThis.__slowTurn, status: "interrupted" } },
			});
			globalThis.__slowTurn = null;
		}
	}
});
`;
	writeFileSync(scriptPath, source, "utf8");
	return scriptPath;
}

test("CodexAppSessionAdapter handles initialize, thread reuse, reasoning deltas, outputSchema, abort, and crash recovery", async () => {
	const root = mkdtempSync(path.join(tmpdir(), "noname-codex-app-test-"));
	const script = createMockCodexAppScript(root);
	const adapter = new CodexAppSessionAdapter({ command: script, extraArgs: "" });

	try {
		let thought = "";
		let usage: Record<string, number> | undefined;
		const res1 = await adapter.runTurn(
			{
				sessionKey: "g2:1",
				provider: "codex",
				command: script,
				model: "gpt-5.4",
				thinkingEffort: "medium",
				timeoutSec: 20,
				reset: true,
				prompt: "首轮全量上下文",
				jsonSchema: { type: "object", properties: { tool: { type: "string" } } },
			},
			{
				onThoughtDelta: d => {
					thought += d;
				},
				onUsage: u => {
					usage = u as Record<string, number>;
				},
			}
		);

		assert.equal(thought, "判断手牌，选择出杀");
		assert.equal(res1.reasoningContent, "判断手牌，选择出杀");
		assert.equal(res1.sessionId, "thr-1");
		assert.equal(usage?.inputTokens, 450);
		assert.equal(usage?.thoughtTokens, 12);
		assert.equal(usage?.contextUsed, 900);
		assert.equal(usage?.contextSize, 200000);
		const parsed1 = JSON.parse(String(res1.rawOutput));
		assert.match(parsed1.reason, /thr=1,turn=1,init=true,schema=true,effort=medium/);

		// Turn 2 with reset=false reuses thr-1
		const res2 = await adapter.runTurn(
			{
				sessionKey: "g2:1",
				provider: "codex",
				command: script,
				model: "gpt-5.4",
				thinkingEffort: "high",
				timeoutSec: 20,
				reset: false,
				prompt: "第二轮增量",
				jsonSchema: { type: "object" },
			},
			{}
		);
		const parsed2 = JSON.parse(String(res2.rawOutput));
		assert.match(parsed2.reason, /thr=1,turn=2.*effort=high/);

		// Abort sends turn/interrupt
		const ac = new AbortController();
		setTimeout(() => ac.abort(), 30);
		await assert.rejects(
			() =>
				adapter.runTurn(
					{
						sessionKey: "g2:1",
						provider: "codex",
						command: script,
						model: "gpt-5.4",
						timeoutSec: 20,
						reset: false,
						prompt: "SLOW_TURN",
						jsonSchema: { type: "object" },
					},
					{ signal: ac.signal }
				),
			err => (err as { stage?: string }).stage === "fetch"
		);

		// Crash yields fetch error and subsequent reset=false yields session_lost
		await assert.rejects(
			() =>
				adapter.runTurn(
					{
						sessionKey: "g2:1",
						provider: "codex",
						command: script,
						model: "gpt-5.4",
						timeoutSec: 20,
						reset: false,
						prompt: "CRASH_NOW",
						jsonSchema: { type: "object" },
					},
					{}
				),
			err => (err as { stage?: string }).stage === "fetch"
		);

		await assert.rejects(
			() =>
				adapter.runTurn(
					{
						sessionKey: "g2:1",
						provider: "codex",
						command: script,
						model: "gpt-5.4",
						timeoutSec: 20,
						reset: false,
						prompt: "崩溃后的增量调用",
						jsonSchema: { type: "object" },
					},
					{}
				),
			err => (err as { code?: string }).code === "session_lost"
		);
	} finally {
		adapter.dispose();
		rmSync(root, { recursive: true, force: true });
	}
});
