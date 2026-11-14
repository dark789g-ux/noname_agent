import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { callLLMStream, callLLMWithTimeout, parseToolCallResult } from "./client.js";
import type { LLMConfig } from "./index.js";
import { assistantToolMessage } from "./protocol.js";
import { submitRoundSummaryTool } from "./prompt-history.js";
import { buildTools, type SelectionToolType } from "./tools.js";

test("all function tools require a bounded reason", () => {
	const groups = [
		buildTools("chooseToUse", { cards: [], skills: ["skill"] }, undefined, false, { allowInspectDiscard: true }),
		buildTools("chooseToRespond", { cards: [], skills: [] }),
		buildTools("chooseToDiscard", { cards: [], skills: [] }),
		buildTools("chooseBool", { cards: [], skills: [] }),
		[submitRoundSummaryTool()],
		...(["button", "card", "target", "control", "number"] as SelectionToolType[]).map(type => buildTools("selection", { cards: [], skills: [] }, { id: "step_1", type })),
	];
	for (const tools of groups) {
		for (const tool of tools) {
			const parameters: any = tool.function.parameters;
			assert.deepEqual(parameters.properties.reason, { type: "string", description: "简要说明选择原因。", minLength: 1, maxLength: 200 });
			assert.equal(parameters.required.includes("reason"), true, tool.function.name);
			assert.equal(parameters.additionalProperties, false, tool.function.name);
		}
	}
});

test("shared tool-call parser trims and removes reason without mutating arguments", () => {
	const raw = { reason: "  使用杀进攻  ", card_ref: "c0" };
	const parsed = parseToolCallResult("call_1", "use_card", raw);
	assert.deepEqual(parsed, { id: "call_1", name: "use_card", reason: "使用杀进攻", arguments: { card_ref: "c0" } });
	assert.deepEqual(raw, { reason: "  使用杀进攻  ", card_ref: "c0" });
	assert.equal(Object.hasOwn(parsed.arguments, "reason"), false);
});

test("shared tool-call parser accepts one and two hundred Unicode code points", () => {
	assert.equal(parseToolCallResult("call_1", "pass", { reason: "理" }).reason, "理");
	const reason = "😀".repeat(200);
	assert.equal([...parseToolCallResult("call_2", "pass", JSON.stringify({ reason })).reason].length, 200);
});

test("shared tool-call parser rejects invalid reason and argument shapes at parse stage", () => {
	const invalid = [
		{},
		{ reason: 1 },
		{ reason: " \t\n " },
		{ reason: "a".repeat(201) },
		null,
		[],
	];
	for (const raw of invalid) {
		assert.throws(() => parseToolCallResult("call_1", "pass", raw), (error: any) => error?.stage === "parse");
	}
});

test("shared tool-call parser rejects inherited, polluted, and throwing reason access", () => {
	const inherited = Object.create({ reason: "继承原因" });
	assertParseError(() => parseToolCallResult("call_1", "pass", inherited));
	const previous = Object.getOwnPropertyDescriptor(Object.prototype, "reason");
	Object.defineProperty(Object.prototype, "reason", { value: "污染原因", configurable: true });
	try {
		assertParseError(() => parseToolCallResult("call_2", "pass", {}));
	} finally {
		if (previous) Object.defineProperty(Object.prototype, "reason", previous);
		else delete (Object.prototype as Record<string, unknown>).reason;
	}
	const getter = {};
	Object.defineProperty(getter, "reason", { enumerable: true, get() { throw new Error("blocked"); } });
	assertParseError(() => parseToolCallResult("call_3", "pass", getter));
	const proxy = new Proxy({ reason: "代理原因" }, { ownKeys() { throw new Error("blocked"); } });
	assertParseError(() => parseToolCallResult("call_4", "pass", proxy));
});

test("multi-turn assistant history restores top-level reason without mutating arguments", () => {
	const arguments_ = { step_id: "step_1", target_refs: ["p0"], reason: "残留原因" };
	const withoutReasoning = assistantToolMessage({ id: "call_1", name: "select_targets", reason: "选择敌方目标", arguments: arguments_ });
	assert.deepEqual(JSON.parse(withoutReasoning.tool_calls[0].function.arguments), { step_id: "step_1", target_refs: ["p0"], reason: "选择敌方目标" });
	assert.equal(Object.hasOwn(withoutReasoning, "reasoning_content"), false);
	assert.deepEqual(arguments_, { step_id: "step_1", target_refs: ["p0"], reason: "残留原因" });
	const withReasoning = assistantToolMessage({ id: "call_2", name: "select_targets", reason: "选择敌方目标", reasoningContent: "先分析局势", arguments: arguments_ });
	assert.equal(withReasoning.reasoning_content, "先分析局势");
});

test("LLM client entry points parse valid non-streaming and streaming responses", async () => {
	await withMockServer(nonStreamingResponse({ reason: "直接响应" }), async url => {
		assert.deepEqual(await callLLMWithTimeout([], [], config(url)), { id: "call_1", name: "pass", reason: "直接响应", arguments: {} });
	});
	await withMockServer(streamingResponse({ reason: "流式响应" }), async url => {
		assert.deepEqual(await callLLMStream([], [], config(url)), { id: "call_1", name: "pass", reason: "流式响应", arguments: {} });
	});
});

test("LLM client entry points reject invalid reasons as parse errors and stream reports once", async () => {
	await withMockServer(nonStreamingResponse({}), async url => {
		await assert.rejects(() => callLLMWithTimeout([], [], config(url)), (error: any) => error?.stage === "parse" && error?.message === "tool_call arguments.reason must be a string");
	});
	await withMockServer(streamingResponse({}), async url => {
		const errors: Array<{ stage: string; message: string }> = [];
		await assert.rejects(() => callLLMStream([], [], config(url), { onError: (stage, message) => errors.push({ stage, message }) }), (error: any) => error?.stage === "parse");
		assert.deepEqual(errors, [{ stage: "parse", message: "tool_call arguments.reason must be a string" }]);
	});
	await withMockServer(streamingRawResponse("{"), async url => {
		const errors: Array<{ stage: string; message: string }> = [];
		await assert.rejects(() => callLLMStream([], [], config(url), { onError: (stage, message) => errors.push({ stage, message }) }), (error: any) => error?.stage === "parse");
		assert.equal(errors.length, 1);
		assert.equal(errors[0].stage, "parse");
		assert.match(errors[0].message, /^Bad tool_call arguments JSON:/);
	});
});

test("stream telemetry distinguishes first chunk from first token across role, name and argument fragments", async () => {
	const events: string[] = [];
	await withMockServer(streamingChunks([
		{ choices: [{ delta: { role: "assistant" } }] },
		{ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "pass" } }] } }] },
		{ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "" } }] } }] },
		{ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"reason":"分' } }] } }] },
		{ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '片"}' } }] } }] },
	]), async url => {
		const result = await callLLMStream([], [], config(url), {
			onFirstChunk: () => events.push("chunk"),
			onFirstToken: () => events.push("token"),
			onChunk: partial => events.push(`args:${partial}`),
		});
		assert.equal(result.reason, "分片");
	});
	assert.deepEqual(events, ["chunk", "token", 'args:{"reason":"分', 'args:{"reason":"分片"}']);
});

test("stream telemetry treats text as a token and isolates telemetry callback failures", async () => {
	await withMockServer(streamingChunks([
		{ choices: [{ delta: { content: "先出现文本" } }] },
		{ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "pass", arguments: '{"reason":"完成"}' } }] } }] },
	]), async url => {
		let firstChunk = 0;
		let firstToken = 0;
		assert.deepEqual(await callLLMStream([], [], config(url), {
			onFirstChunk: () => { firstChunk++; throw new Error("telemetry"); },
			onFirstToken: () => { firstToken++; throw new Error("telemetry"); },
			onChunk: () => { throw new Error("telemetry"); },
		}), { id: "call_1", name: "pass", reason: "完成", arguments: {} });
		assert.equal(firstChunk, 1);
		assert.equal(firstToken, 1);
	});
});

test("stream telemetry marks empty and malformed chunks without hiding their token semantics", async () => {
	for (const [chunks, expectedTokens] of [
		[[{ choices: [] }], 0],
		[[{ choices: [{ delta: { tool_calls: [{ index: 1, function: { arguments: "x" } }] } }] }], 1],
	] as const) {
		await withMockServer(streamingChunks(chunks), async url => {
			let chunksSeen = 0;
			let tokensSeen = 0;
			await assert.rejects(() => callLLMStream([], [], config(url), { onFirstChunk: () => chunksSeen++, onFirstToken: () => tokensSeen++ }), (error: any) => error?.stage === "parse");
			assert.equal(chunksSeen, 1);
			assert.equal(tokensSeen, expectedTokens);
		});
	}
});

test("stream and non-streaming responses capture reasoning_content and count reasoning as first token", async () => {
	const events: string[] = [];
	await withMockServer(streamingChunks([
		{ choices: [{ delta: { role: "assistant", reasoning_content: "" } }] },
		{ choices: [{ delta: { reasoning_content: "思考第一段" } }] },
		{ choices: [{ delta: { reasoning: "，继续思考" } }] },
		{ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "pass", arguments: '{"reason":"完成"}' } }] } }] },
	]), async url => {
		const result = await callLLMStream([], [], config(url), {
			onFirstChunk: () => events.push("chunk"),
			onFirstToken: () => events.push("token"),
			onChunk: partial => events.push(`stream:${partial}`),
		});
		assert.deepEqual(result, {
			id: "call_1",
			name: "pass",
			reason: "完成",
			reasoningContent: "思考第一段，继续思考",
			arguments: {},
		});
	});
	assert.deepEqual(events, [
		"chunk",
		"token",
		"stream:思考第一段",
		"stream:思考第一段，继续思考",
		'stream:思考第一段，继续思考\n\n[tool_call]\n{"reason":"完成"}',
	]);

	await withMockServer(response => {
		response.writeHead(200, { "content-type": "application/json" });
		response.end(JSON.stringify({
			choices: [{
				message: {
					role: "assistant",
					reasoning_content: "非流式思考内容",
					tool_calls: [{ id: "call_2", type: "function", function: { name: "pass", arguments: JSON.stringify({ reason: "直接响应" }) } }],
				},
			}],
		}));
	}, async url => {
		assert.deepEqual(await callLLMWithTimeout([], [], config(url)), {
			id: "call_2",
			name: "pass",
			reason: "直接响应",
			reasoningContent: "非流式思考内容",
			arguments: {},
		});
	});
});

function assertParseError(operation: () => unknown): void {
	assert.throws(operation, (error: any) => error?.stage === "parse");
}

function config(url: string): LLMConfig {
	return { enabled: true, url, apikey: "test", model: "test", thinkingEffort: "none", maxRetries: 0, timeoutSec: 5, multiTurn: false, maxTurns: 1, decisionTimeoutSec: 5 };
}

function nonStreamingResponse(arguments_: Record<string, any>): (response: any) => void {
	return response => {
		response.writeHead(200, { "content-type": "application/json" });
		response.end(JSON.stringify({ choices: [{ message: { role: "assistant", tool_calls: [{ id: "call_1", type: "function", function: { name: "pass", arguments: JSON.stringify(arguments_) } }] } }] }));
	};
}

function streamingResponse(arguments_: Record<string, any>): (response: any) => void {
	return streamingRawResponse(JSON.stringify(arguments_));
}

function streamingRawResponse(arguments_: string): (response: any) => void {
	return response => {
		response.writeHead(200, { "content-type": "text/event-stream" });
		response.write(`data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "pass", arguments: arguments_ } }] } }] })}\n\n`);
		response.end("data: [DONE]\n\n");
	};
}

function streamingChunks(chunks: any[]): (response: any) => void {
	return response => {
		response.writeHead(200, { "content-type": "text/event-stream" });
		for (const chunk of chunks) response.write(`data: ${JSON.stringify(chunk)}\n\n`);
		response.end("data: [DONE]\n\n");
	};
}

async function withMockServer(writeResponse: (response: any) => void, operation: (url: string) => Promise<void>): Promise<void> {
	const server = createServer((_request, response) => writeResponse(response));
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	try {
		const { port } = server.address() as AddressInfo;
		await operation(`http://127.0.0.1:${port}/v1`);
	} finally {
		await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
	}
}
