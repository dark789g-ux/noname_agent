import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { AcpSessionAdapter } from "./acp-adapter";

function createMockAcpScript(root: string): string {
	const scriptPath = path.join(root, "mock-acp.mjs");
	const source = `
import readline from "node:readline";

let sessionSeq = 0;
let turnSeq = 0;
let currentModel = "";
let permissionOutcome = null;

function send(obj) {
	process.stdout.write(JSON.stringify(obj) + "\\n");
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", line => {
	if (!line.trim()) return;
	const msg = JSON.parse(line);
	if (!msg.method && msg.id === "perm-1") {
		permissionOutcome = msg.result?.outcome?.outcome || "unknown";
		return;
	}
	if (msg.method === "initialize") {
		send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: 1, agentInfo: { name: "mock-agy" } } });
		return;
	}
	if (msg.method === "session/new") {
		sessionSeq++;
		send({ jsonrpc: "2.0", id: msg.id, result: { sessionId: "sess-" + sessionSeq } });
		return;
	}
	if (msg.method === "session/set_model") {
		currentModel = msg.params?.modelId || "";
		send({ jsonrpc: "2.0", id: msg.id, result: {} });
		return;
	}
	if (msg.method === "session/prompt") {
		turnSeq++;
		const promptText = msg.params?.prompt?.[0]?.text || "";
		if (promptText.includes("CRASH_NOW")) {
			process.exit(3);
		}
		if (promptText.includes("ASK_PERM")) {
			send({
				jsonrpc: "2.0",
				id: "perm-1",
				method: "session/request_permission",
				params: { options: [{ optionId: "deny-once", kind: "reject_once" }] },
			});
		}
		send({
			jsonrpc: "2.0",
			method: "session/update",
			params: {
				sessionId: msg.params.sessionId,
				update: { sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "分析第" + turnSeq + "轮：" } },
			},
		});
		setTimeout(() => {
			send({
				jsonrpc: "2.0",
				method: "session/update",
				params: {
					sessionId: msg.params.sessionId,
					update: { sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "先跳过" } },
				},
			});
			send({
				jsonrpc: "2.0",
				method: "session/update",
				params: {
					sessionId: msg.params.sessionId,
					update: { sessionUpdate: "usage_update", used: 1200 + turnSeq * 100, size: 100000 },
				},
			});
			const body = JSON.stringify({
				tool: "pass",
				reason: "turn=" + turnSeq + ",sess=" + sessionSeq + ",model=" + currentModel + ",perm=" + permissionOutcome,
				arguments_json: "{}",
			});
			send({
				jsonrpc: "2.0",
				method: "session/update",
				params: {
					sessionId: msg.params.sessionId,
					update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: body } },
				},
			});
			send({
				jsonrpc: "2.0",
				id: msg.id,
				result: { stopReason: "end_turn", usage: { inputTokens: 800, outputTokens: 40, thoughtTokens: 15 } },
			});
		}, 15);
	}
});
`;
	writeFileSync(scriptPath, source, "utf8");
	return scriptPath;
}

test("AcpSessionAdapter streams thought chunks, maintains session across turns, rejects permissions, and detects session_lost", async () => {
	const root = mkdtempSync(path.join(tmpdir(), "noname-acp-test-"));
	const script = createMockAcpScript(root);
	const adapter = new AcpSessionAdapter({ command: script, extraArgs: "" });

	try {
		let thought1 = "";
		let text1 = "";
		let latestUsage: Record<string, number> | undefined;
		const res1 = await adapter.runTurn(
			{
				sessionKey: "g1:1",
				provider: "agy",
				command: script,
				model: "gemini-3.8-flash-low",
				timeoutSec: 20,
				reset: true,
				prompt: "首轮完整上下文 ASK_PERM",
				jsonSchema: { type: "object" },
			},
			{
				onThoughtDelta: delta => {
					thought1 += delta;
				},
				onTextDelta: delta => {
					text1 += delta;
				},
				onUsage: usage => {
					latestUsage = usage as Record<string, number>;
				},
			}
		);

		assert.equal(thought1, "分析第1轮：先跳过");
		assert.equal(res1.reasoningContent, "分析第1轮：先跳过");
		assert.equal(res1.sessionId, "sess-1");
		assert.equal(res1.rebuilt, false);
		assert.equal(latestUsage?.contextUsed, 1300);
		assert.equal(latestUsage?.thoughtTokens, 15);
		const parsed1 = JSON.parse(String(res1.rawOutput));
		assert.match(parsed1.reason, /turn=1,sess=1,model=gemini-3.8-flash-low,perm=selected/);

		// Turn 2 with reset=false should reuse sess-1 and turnSeq=2
		const res2 = await adapter.runTurn(
			{
				sessionKey: "g1:1",
				provider: "agy",
				command: script,
				model: "gemini-3.8-flash-low",
				timeoutSec: 20,
				reset: false,
				prompt: "增量上下文",
				jsonSchema: { type: "object" },
			},
			{}
		);
		const parsed2 = JSON.parse(String(res2.rawOutput));
		assert.match(parsed2.reason, /turn=2,sess=1/);

		// Crash process and ensure next reset=false reports session_lost
		await assert.rejects(
			() =>
				adapter.runTurn(
					{
						sessionKey: "g1:1",
						provider: "agy",
						command: script,
						model: "gemini-3.8-flash-low",
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
						sessionKey: "g1:1",
						provider: "agy",
						command: script,
						model: "gemini-3.8-flash-low",
						timeoutSec: 20,
						reset: false,
						prompt: "崩溃后的增量调用",
						jsonSchema: { type: "object" },
					},
					{}
				),
			err => (err as { code?: string }).code === "session_lost"
		);

		// Recovery with reset=true starts fresh process & session
		const res3 = await adapter.runTurn(
			{
				sessionKey: "g1:1",
				provider: "agy",
				command: script,
				model: "gemini-3.8-flash-low",
				timeoutSec: 20,
				reset: true,
				prompt: "重建全量上下文",
				jsonSchema: { type: "object" },
			},
			{}
		);
		assert.equal(res3.sessionId, "sess-1");
		const parsed3 = JSON.parse(String(res3.rawOutput));
		assert.match(parsed3.reason, /turn=1,sess=1/);
	} finally {
		adapter.dispose();
		rmSync(root, { recursive: true, force: true });
	}
});
