import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import createApp from "../index";
import { splitCliArgs } from "./cli-runner";

function createMockCliScript(root: string): string {
	const scriptPath = path.join(root, "mock-cli.mjs");
	const source = `
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const stdinPrompt = readFileSync(0, "utf8");
const modeIdx = args.indexOf("--mock-mode");
const mode = modeIdx >= 0 ? args[modeIdx + 1] : "ok";

if (mode === "slow") {
	setTimeout(() => {
		console.log("late");
		process.exit(0);
	}, 10000);
} else {
	const schemaIdx = args.indexOf("--json-schema");
	const outSchemaIdx = args.indexOf("--output-schema");
	const outIdx = args.indexOf("-o");
	const schemaFile = schemaIdx >= 0 ? args[schemaIdx + 1] : args[outSchemaIdx + 1];
	const schemaOk = schemaFile ? existsSync(schemaFile) : false;

	if (args.includes("--json")) {
		const payload = JSON.stringify({
			tool: "pass",
			reason: "测试流式跳过",
			arguments_json: JSON.stringify({ cwd: process.cwd(), schemaOk, stdinLen: stdinPrompt.length, args }),
		});
		console.log(JSON.stringify({ type: "item.completed", item: { id: "r0", type: "reasoning", text: "思考第一步" } }));
		setTimeout(() => {
			console.log(JSON.stringify({ type: "item.completed", item: { id: "m0", type: "agent_message", text: payload } }));
			if (outIdx >= 0 && args[outIdx + 1]) {
				writeFileSync(path.resolve(args[outIdx + 1]), payload, "utf8");
			}
		}, 15);
	} else if (args.includes("stream-json")) {
		const payload = {
			tool: "use_card",
			reason: "使用杀",
			arguments_json: JSON.stringify({
				card_ref: "c0",
				target_refs: ["p0"],
				cwd: process.cwd(),
				schemaOk,
				stdinPrompt,
				args,
			}),
		};
		console.log(JSON.stringify({ event: "init", conversation_id: "conv-1", init: { cwd: process.cwd() } }));
		console.log(JSON.stringify({ event: "step_update", step_update: { step_index: 0, state: "DONE", step_type: "user_input" } }));
		console.log(
			JSON.stringify({
				event: "step_update",
				step_update: { step_index: 1, state: "ACTIVE", step_type: "agent_response", thinking_delta: "正在分析", text_delta: "{" },
			})
		);
		setTimeout(() => {
			console.log(
				JSON.stringify({
					event: "step_update",
					step_update: { step_index: 1, state: "DONE", step_type: "agent_response", thinking_delta: "牌面", text_delta: "}" },
				})
			);
			console.log(
				JSON.stringify({
					event: "result",
					result: {
						conversation_id: "conv-1",
						status: "SUCCESS",
						response: JSON.stringify(payload),
						structured_output: payload,
					},
				})
			);
		}, 15);
	} else if (outIdx >= 0 && args[outIdx + 1]) {
		const payload = JSON.stringify({
			tool: "pass",
			reason: "非流式codex",
			arguments_json: JSON.stringify({ cwd: process.cwd(), schemaOk, args }),
		});
		writeFileSync(path.resolve(args[outIdx + 1]), payload, "utf8");
	} else {
		console.log(JSON.stringify({
			thinking: "agy非流式思考",
			structured_output: { tool: "pass", reason: "非流式agy", arguments_json: "{}" },
		}));
	}
}
`;
	writeFileSync(scriptPath, source.trimStart(), "utf8");
	return scriptPath;
}

test("splitCliArgs 正确切分引号与空格参数", () => {
	assert.deepEqual(splitCliArgs(' --sandbox read-only -c "key=a b" \'--flag=1 2\' '), ["--sandbox", "read-only", "-c", "key=a b", "--flag=1 2"]);
	assert.deepEqual(splitCliArgs(""), []);
});

test("/_llm/cli 拦截非回环地址、非本机 Origin 与非法参数", async t => {
	const root = mkdtempSync(path.join(tmpdir(), "noname-llm-sec-"));
	mkdirSync(path.join(root, "data"));
	const app = createApp({ dirname: root, database: path.join(root, "data", "noname.sqlite"), listen: false });
	t.after(async () => {
		await app.close();
		rmSync(root, { recursive: true, force: true });
	});

	const remoteIpRes = await app.inject({
		method: "POST",
		url: "/_llm/cli",
		remoteAddress: "192.168.1.20",
		payload: { provider: "codex", prompt: "test" },
	});
	assert.equal(remoteIpRes.statusCode, 403);

	const remoteOriginRes = await app.inject({
		method: "POST",
		url: "/_llm/cli",
		headers: { origin: "https://evil.example" },
		payload: { provider: "codex", prompt: "test" },
	});
	assert.equal(remoteOriginRes.statusCode, 403);

	const badProviderRes = await app.inject({
		method: "POST",
		url: "/_llm/cli",
		headers: { origin: "http://127.0.0.1:8080" },
		payload: { provider: "unknown", prompt: "test" },
	});
	assert.equal(badProviderRes.statusCode, 400);
});

test("/_llm/cli 支持 agy 与 codex 非流式和 SSE 流式执行、沙箱目录隔离以及断连中止", async t => {
	const root = mkdtempSync(path.join(tmpdir(), "noname-llm-cli-test-"));
	mkdirSync(path.join(root, "data"));
	const mockScript = createMockCliScript(root);
	const app = createApp({ dirname: root, database: path.join(root, "data", "noname.sqlite"), listen: false });
	const baseUrl = await app.listen({ port: 0, host: "127.0.0.1" });
	t.after(async () => {
		await app.close();
		rmSync(root, { recursive: true, force: true });
	});

	// 1. 非流式 codex
	const nonStreamCodex = await fetch(`${baseUrl}/_llm/cli`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Origin: "http://localhost:8080" },
		body: JSON.stringify({
			provider: "codex",
			command: mockScript,
			model: "gpt-5-codex",
			thinkingEffort: "medium",
			prompt: "请决策",
			jsonSchema: { type: "object" },
			stream: false,
		}),
	}).then(r => r.json());
	assert.equal(nonStreamCodex.ok, true);
	const parsedCodexOut = JSON.parse(nonStreamCodex.rawOutput);
	assert.equal(parsedCodexOut.tool, "pass");
	const codexMeta = JSON.parse(parsedCodexOut.arguments_json);
	assert.notEqual(path.resolve(codexMeta.cwd), path.resolve(root));
	assert.equal(codexMeta.schemaOk, true);
	assert.equal(codexMeta.args.includes("exec"), true);
	assert.equal(codexMeta.args.includes("read-only"), true);
	assert.equal(codexMeta.args.includes("model_reasoning_effort='medium'"), true);
	assert.equal(existsSync(codexMeta.cwd), false);

	// 2. 流式 SSE codex
	const sseCodexText = await fetch(`${baseUrl}/_llm/cli`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			provider: "codex",
			command: mockScript,
			prompt: "流式测试",
			jsonSchema: { type: "object" },
			stream: true,
		}),
	}).then(r => r.text());
	const codexEvents = sseCodexText
		.split("\n\n")
		.map(block => block.trim())
		.filter(block => block.startsWith("data:"))
		.map(block => JSON.parse(block.slice(5).trim()));
	assert.equal(codexEvents.some(e => e.type === "first_chunk"), true);
	assert.equal(codexEvents.some(e => e.type === "first_token"), true);
	assert.equal(codexEvents.some(e => e.type === "chunk" && String(e.text).includes("思考第一步")), true);
	const codexFinal = codexEvents.find(e => e.type === "result");
	assert.ok(codexFinal);
	assert.equal(codexFinal.reasoningContent, "思考第一步");

	// 3. 流式 SSE agy（验证真实 init/step_update/result 协议及无 -p/--effort、通过 stdin 传入完整 prompt）
	const sseAgyText = await fetch(`${baseUrl}/_llm/cli`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			provider: "agy",
			command: mockScript,
			model: "gemini-3.8-flash-medium",
			thinkingEffort: "high",
			prompt: "agy流式测试",
			jsonSchema: { type: "object" },
			stream: true,
		}),
	}).then(r => r.text());
	const agyEvents = sseAgyText
		.split("\n\n")
		.map(block => block.trim())
		.filter(block => block.startsWith("data:"))
		.map(block => JSON.parse(block.slice(5).trim()));
	assert.equal(agyEvents.some(e => e.type === "first_token"), true);
	const agyFinal = agyEvents.find(e => e.type === "result");
	assert.ok(agyFinal);
	assert.equal(agyFinal.reasoningContent, "正在分析牌面");
	assert.equal(agyFinal.rawOutput.tool, "use_card");
	const agyMeta = JSON.parse(agyFinal.rawOutput.arguments_json);
	assert.equal(agyMeta.stdinPrompt.includes("agy流式测试"), true);
	assert.equal(agyMeta.args.includes("--disable-slash-commands"), true);
	assert.equal(agyMeta.args.includes("-p"), false);
	assert.equal(agyMeta.args.includes("--effort"), false);
	assert.equal(agyMeta.args.includes("--mode"), false);

	// 4. 客户端主动中止应迅速结束流读取，并清理慢子进程
	const controller = new AbortController();
	const startedAt = Date.now();
	setTimeout(() => controller.abort(), 120);
	const slowRes = await fetch(`${baseUrl}/_llm/cli`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		signal: controller.signal,
		body: JSON.stringify({
			provider: "agy",
			command: mockScript,
			extraArgs: "--mock-mode slow",
			timeoutSec: 20,
			prompt: "slow",
			jsonSchema: { type: "object" },
			stream: true,
		}),
	});
	await assert.rejects(slowRes.text());
	assert.ok(Date.now() - startedAt < 2500);
});

test("resolveCommandTarget 在 PATH 未命中时回退本机常见 agy/codex 路径", async t => {
	const { resolveCommandTarget } = await import("./cli-command.js");
	const fakeHome = mkdtempSync(path.join(tmpdir(), "noname-cli-home-"));
	t.after(() => {
		rmSync(fakeHome, { recursive: true, force: true });
	});

	const agyDir = path.join(fakeHome, ".gemini", "bin");
	const codexDir = path.join(fakeHome, ".codex", ".sandbox-bin");
	mkdirSync(agyDir, { recursive: true });
	mkdirSync(codexDir, { recursive: true });
	const agyExe = path.join(agyDir, "agy.exe");
	const codexExe = path.join(codexDir, "codex.exe");
	writeFileSync(agyExe, "", "utf8");
	writeFileSync(codexExe, "", "utf8");

	const agyTarget = resolveCommandTarget("agy", {
		platform: "win32",
		pathEnv: "",
		pathExtEnv: ".exe;.cmd",
		homeDir: fakeHome,
		appDataDir: path.join(fakeHome, "AppData", "Roaming"),
	});
	assert.deepEqual(agyTarget, { kind: "exe", resolved: agyExe });

	const codexTarget = resolveCommandTarget("codex", {
		platform: "win32",
		pathEnv: "",
		pathExtEnv: ".exe;.cmd",
		homeDir: fakeHome,
		appDataDir: path.join(fakeHome, "AppData", "Roaming"),
	});
	assert.deepEqual(codexTarget, { kind: "exe", resolved: codexExe });

	// 若 ~/.codex/config.toml 中配置了 CODEX_CLI_PATH，应优先于 .sandbox-bin
	const appDir = path.join(fakeHome, "app-codex");
	mkdirSync(appDir, { recursive: true });
	const appCodexExe = path.join(appDir, "codex.exe");
	writeFileSync(appCodexExe, "", "utf8");
	writeFileSync(path.join(fakeHome, ".codex", "config.toml"), `CODEX_CLI_PATH = '${appCodexExe}'\n`, "utf8");

	const configuredCodexTarget = resolveCommandTarget("codex", {
		platform: "win32",
		pathEnv: "",
		pathExtEnv: ".exe;.cmd",
		homeDir: fakeHome,
		appDataDir: path.join(fakeHome, "AppData", "Roaming"),
	});
	assert.deepEqual(configuredCodexTarget, { kind: "exe", resolved: appCodexExe });
});
