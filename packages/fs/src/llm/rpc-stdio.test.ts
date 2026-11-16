import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { RpcProtocolError, RpcStdioClient } from "./rpc-stdio";

function createMockRpcScript(root: string): string {
	const scriptPath = path.join(root, "mock-rpc.mjs");
	const source = `
import readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", line => {
	if (!line.trim()) return;
	const msg = JSON.parse(line);
	if (msg.method === "echo") {
		console.log(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { echoed: msg.params } }));
		return;
	}
	if (msg.method === "ask_client") {
		console.log(JSON.stringify({ id: "srv-1", method: "client/ping", params: { seq: 1 } }));
		const waitReply = setInterval(() => {
			if (globalThis.__srvReply) {
				clearInterval(waitReply);
				console.log(JSON.stringify({ id: msg.id, result: { got: globalThis.__srvReply } }));
				globalThis.__srvReply = null;
			}
		}, 10);
		return;
	}
	if (msg.id === "srv-1") {
		globalThis.__srvReply = msg.result ?? msg.error;
		return;
	}
	if (msg.method === "notify_test") {
		console.log(JSON.stringify({ method: "server/tick", params: { n: 42 } }));
		console.log(JSON.stringify({ id: msg.id, result: { ok: true } }));
		return;
	}
	if (msg.method === "fail_rpc") {
		console.log(JSON.stringify({ id: msg.id, error: { code: -32001, message: "boom" } }));
		return;
	}
	if (msg.method === "crash_now") {
		process.exit(2);
	}
});
`;
	writeFileSync(scriptPath, source, "utf8");
	return scriptPath;
}

test("RpcStdioClient handles request/response, server requests, notifications, and RPC errors", async () => {
	const root = mkdtempSync(path.join(tmpdir(), "noname-rpc-test-"));
	const notifications: Array<{ method: string; params: unknown }> = [];
	const script = createMockRpcScript(root);
	const client = new RpcStdioClient({
		command: script,
		args: [],
		includeJsonRpcHeader: false,
		onNotification: (method, params) => notifications.push({ method, params }),
		onRequest: async (_id, method, params) => ({ pong: method, params }),
	});

	try {
		client.start();
		const res = await client.request<{ echoed: { a: number } }>("echo", { a: 1 });
		assert.deepEqual(res, { echoed: { a: 1 } });

		const pinged = await client.request<{ got: unknown }>("ask_client", {});
		assert.deepEqual(pinged, { got: { pong: "client/ping", params: { seq: 1 } } });

		await client.request("notify_test", {});
		assert.equal(notifications.length, 1);
		assert.deepEqual(notifications[0], { method: "server/tick", params: { n: 42 } });

		await assert.rejects(
			() => client.request("fail_rpc", {}),
			err => err instanceof RpcProtocolError && err.code === -32001 && err.message === "boom"
		);
	} finally {
		client.dispose();
		rmSync(root, { recursive: true, force: true });
	}
});

test("RpcStdioClient rejects pending requests on process crash and maps ENOENT", async () => {
	const root = mkdtempSync(path.join(tmpdir(), "noname-rpc-crash-"));
	const script = createMockRpcScript(root);
	const client = new RpcStdioClient({ command: script, args: [] });

	try {
		await assert.rejects(
			() => client.request("crash_now", {}),
			err => (err as { stage?: string }).stage === "fetch"
		);
		assert.equal(client.isAlive(), false);
	} finally {
		client.dispose();
		rmSync(root, { recursive: true, force: true });
	}

	const missing = new RpcStdioClient({ command: "definitely-not-installed-cli-xyz-999", args: [] });
	try {
		await assert.rejects(
			() => missing.request("initialize", {}),
			err => (err as { stage?: string }).stage === "config"
		);
	} finally {
		missing.dispose();
	}
});
