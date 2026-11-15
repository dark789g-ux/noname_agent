import assert from "node:assert/strict";
import test from "node:test";
import { AGY_MODEL_OPTIONS, buildResolvedBackend, CODEX_MODEL_OPTIONS, deriveOpenAIDisplayName, getCLIModelOptions, readBackendsFromRawConfig, resolveBackendDisplayName, resolvePlayerBackend, resolvePlayerSeatIndex, resolveSummaryBackend } from "./backends.js";
import { buildCliDecisionJsonSchema, buildCliDecisionPrompt, callCliStream, callCliWithTimeout, parseCliEnvelopeToToolCall } from "./cli-client.js";
import { buildTools } from "./tools.js";

test("deriveOpenAIDisplayName 与 resolveBackendDisplayName 自动提取及自定义命名", () => {
	assert.equal(deriveOpenAIDisplayName("deepseek-flash", "https://api.deepseek.com"), "deepseek");
	assert.equal(deriveOpenAIDisplayName("gpt-4o-mini", "https://api.openai.com/v1"), "gpt");
	assert.equal(deriveOpenAIDisplayName("o3-mini", "https://api.openai.com/v1"), "openai");
	assert.equal(deriveOpenAIDisplayName("claude-3-7-sonnet", ""), "claude");
	assert.equal(deriveOpenAIDisplayName("Qwen/Qwen2.5-72B-Instruct", ""), "qwen");
	assert.equal(deriveOpenAIDisplayName("", "https://api.deepseek.com/v1"), "deepseek");
	assert.equal(deriveOpenAIDisplayName("", ""), "openai");

	assert.equal(
		resolveBackendDisplayName("openai", {
			model: "deepseek-flash",
			openaiDisplayName: "深度求索",
		}),
		"深度求索"
	);
	assert.equal(resolveBackendDisplayName("agy", { agy: { displayName: "" } }), "agy");
	assert.equal(resolveBackendDisplayName("codex", { codex: { displayName: "Codex-Pro" } }), "Codex-Pro");
});

test("resolvePlayerBackend 按行动顺位、桌位回退与玩家自控开关正确解析", () => {
	const raw = readBackendsFromRawConfig({
		llm_default_backend: "openai",
		llm_agy_config: { command: "agy", displayName: "agy", timeoutSec: 45 },
		llm_codex_config: { command: "codex", displayName: "codex", model: "gpt-5-codex" },
		llm_seat_backends: { 1: "default", 2: "agy", 3: "codex", 4: "local" },
	});
	const cfg = { enabled: true, controlSelf: false, url: "https://api.deepseek.com", apikey: "k", model: "deepseek-flash", ...raw };

	const human = { getSeatNum: () => 2, isUnderControl: (self?: boolean) => !!self, dataset: { position: "0" } };
	assert.equal(resolvePlayerBackend(human, cfg, { llmSelfControlledAtGameStart: false }).kind, "local");
	assert.equal(resolvePlayerBackend(human, cfg, { llmSelfControlledAtGameStart: true }).kind, "agy");

	// seatNum 未结算（0）时回退 dataset.position + 1
	const unsettledAi = { getSeatNum: () => 0, isUnderControl: () => false, dataset: { position: "2" } };
	assert.equal(resolvePlayerSeatIndex(unsettledAi), 3);
	const resolvedUnsettled = resolvePlayerBackend(unsettledAi, cfg);
	assert.equal(resolvedUnsettled.kind, "codex");
	assert.equal(resolvedUnsettled.label, "codex");

	// seat 4 指定本地规则 AI
	const localAi = { getSeatNum: () => 4, isUnderControl: () => false, dataset: { position: "3" } };
	assert.equal(resolvePlayerBackend(localAi, cfg).kind, "local");
});

test("resolveSummaryBackend 优先默认外部后端，回退场上首个已配置外部后端", () => {
	const cfgDefaultLocal = {
		enabled: true,
		defaultBackend: "local" as const,
		url: "",
		apikey: "",
		model: "",
		agy: { command: "agy", displayName: "agy", model: "", thinkingEffort: "default" as const, timeoutSec: 60, extraArgs: "" },
		codex: { command: "", displayName: "codex", model: "", thinkingEffort: "default" as const, timeoutSec: 60, extraArgs: "" },
		seatBackends: { 1: "local" as const, 2: "agy" as const },
	};
	const summary = resolveSummaryBackend(cfgDefaultLocal, [1, 2]);
	assert.ok(summary);
	assert.equal(summary.kind, "agy");

	const builtLocal = buildResolvedBackend("local", cfgDefaultLocal);
	assert.equal(builtLocal.configured, false);
});

test("CLI Schema、Prompt 构建与响应信封解析兼容多形态与合法性校验", () => {
	const tools = buildTools("chooseToUse", { cards: [{ ref: "c0" } as any], skills: [] });
	const schema = buildCliDecisionJsonSchema(tools);
	assert.deepEqual(schema.required, ["tool", "reason", "arguments_json"]);
	assert.equal(schema.additionalProperties, false);
	assert.equal(schema.properties.tool.enum.includes("use_card"), true);
	assert.equal(schema.properties.tool.enum.includes("pass"), true);

	const prompt = buildCliDecisionPrompt(
		[
			{ role: "system", content: "系统要求" },
			{ role: "user", content: "当前手牌 c0 杀" },
		],
		tools
	);
	assert.match(prompt, /## 系统指令/);
	assert.match(prompt, /## 可用工具列表/);
	assert.match(prompt, /`use_card`/);

	const parsed = parseCliEnvelopeToToolCall(
		{ structured_output: { tool: "use_card", reason: "对敌方出杀压血线", arguments_json: '{"card_ref":"c0","target_refs":["p0"]}' } },
		"先评估手牌与距离。",
		schema.properties.tool.enum
	);
	assert.equal(parsed.name, "use_card");
	assert.equal(parsed.reason, "对敌方出杀压血线");
	assert.equal(parsed.reasoningContent, "先评估手牌与距离。");
	assert.deepEqual(parsed.arguments, { card_ref: "c0", target_refs: ["p0"] });

	const parsedNestedResult = parseCliEnvelopeToToolCall(
		{ result: { status: "SUCCESS", structured_output: { tool: "pass", reason: "保留手牌观察局势", arguments_json: "{}" } } },
		undefined,
		schema.properties.tool.enum
	);
	assert.equal(parsedNestedResult.name, "pass");
	assert.equal(parsedNestedResult.reason, "保留手牌观察局势");

	const parsedResponseText = parseCliEnvelopeToToolCall(
		{ status: "SUCCESS", response: JSON.stringify({ tool: "pass", reason: "兼容仅返回 response 字段", arguments_json: "{}" }) },
		undefined,
		schema.properties.tool.enum
	);
	assert.equal(parsedResponseText.name, "pass");
	assert.equal(parsedResponseText.reason, "兼容仅返回 response 字段");

	assert.throws(
		() => parseCliEnvelopeToToolCall({ tool: "unknown_tool", reason: "测试", arguments_json: "{}" }, undefined, schema.properties.tool.enum),
		(err: any) => err.stage === "parse"
	);
	assert.throws(
		() => parseCliEnvelopeToToolCall({ tool: "pass", reason: "   ", arguments_json: "{}" }, undefined, schema.properties.tool.enum),
		(err: any) => err.stage === "parse"
	);
});

test("callCliStream 与 callCliWithTimeout 正确消费 /_llm/cli SSE 与 JSON 响应", async t => {
	const tools = buildTools("chooseBool", { cards: [], skills: [] });
	const backend = buildResolvedBackend("codex", { codex: { command: "codex", displayName: "codex", timeoutSec: 15 } });
	const encoder = new TextEncoder();

	t.mock.method(globalThis, "fetch", async (_url: unknown, init: any) => {
		const body = JSON.parse(String(init.body));
		if (body.stream) {
			const frames = [
				'data: {"type":"first_chunk"}\n\n',
				'data: {"type":"first_token"}\n\n',
				'data: {"type":"chunk","text":"思考中"}\n\n',
				'data: {"type":"result","rawOutput":{"tool":"yes","reason":"流式选是","arguments_json":"{}"},"reasoningContent":"完整思考"}\n\n',
			];
			return new Response(
				new ReadableStream({
					start(controller) {
						for (const frame of frames) controller.enqueue(encoder.encode(frame));
						controller.close();
					},
				}),
				{ status: 200, headers: { "Content-Type": "text/event-stream" } }
			);
		}
		return Response.json({
			ok: true,
			rawOutput: JSON.stringify({ tool: "no", reason: "非流式选否", arguments_json: "{}" }),
			reasoningContent: "非流式思考",
		});
	});

	let chunks = 0;
	let firstToken = false;
	const streamResult = await callCliStream([{ role: "user", content: "是否发动" }], tools, backend, {
		onFirstToken: () => {
			firstToken = true;
		},
		onChunk: () => {
			chunks++;
		},
	});
	assert.equal(firstToken, true);
	assert.equal(chunks, 1);
	assert.equal(streamResult.name, "yes");
	assert.equal(streamResult.reasoningContent, "完整思考");

	const nonStreamResult = await callCliWithTimeout([{ role: "user", content: "是否发动" }], tools, backend);
	assert.equal(nonStreamResult.name, "no");
	assert.equal(nonStreamResult.reason, "非流式选否");
});

test("AGY_MODEL_OPTIONS 与 CODEX_MODEL_OPTIONS 提供预期模型列表", () => {
	assert.equal(AGY_MODEL_OPTIONS.length, 22);
	assert.equal(AGY_MODEL_OPTIONS.includes("gemini-4-argon-high"), true);
	assert.equal(AGY_MODEL_OPTIONS.includes("claude-opus-5-5-high"), true);
	assert.equal(getCLIModelOptions("agy"), AGY_MODEL_OPTIONS);

	assert.equal(CODEX_MODEL_OPTIONS.length, 8);
	assert.equal(CODEX_MODEL_OPTIONS.includes("gpt-6.1-terra"), true);
	assert.equal(CODEX_MODEL_OPTIONS.includes("gpt-reserve" as any), false);
	assert.equal(getCLIModelOptions("codex"), CODEX_MODEL_OPTIONS);
});
