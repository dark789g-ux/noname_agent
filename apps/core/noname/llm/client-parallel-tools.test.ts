import assert from "node:assert/strict";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { APIError } from "openai";
import { callLLMStream, callLLMWithTimeout } from "./client.js";
import { requestWithParallelToolFallback } from "./client-request.js";
import type { LLMConfig } from "./index.js";

type RequestBody = Record<string, any>;

function config(url: string): LLMConfig {
	return { enabled: true, url, apikey: "test", model: "test", thinkingEffort: "none", maxRetries: 0, timeoutSec: 5, multiTurn: false, maxTurns: 1, decisionTimeoutSec: 5 };
}

async function withServer(handler: (body: RequestBody, response: ServerResponse, count: number) => void, operation: (url: string, requests: RequestBody[]) => Promise<void>): Promise<void> {
	const requests: RequestBody[] = [];
	const server = createServer(async (request, response) => {
		let data = "";
		for await (const chunk of request) data += chunk;
		const body = JSON.parse(data);
		requests.push(body);
		handler(body, response, requests.length);
	});
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	try {
		await operation(`http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`, requests);
	} finally {
		await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
	}
}

function success(body: RequestBody, response: ServerResponse): void {
	const call = { id: "call_1", type: "function", function: { name: "pass", arguments: '{"reason":"完成"}' } };
	if (body.stream) {
		response.writeHead(200, { "content-type": "text/event-stream" });
		response.write(`data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, ...call }] } }] })}\n\n`);
		response.end("data: [DONE]\n\n");
	} else {
		response.writeHead(200, { "content-type": "application/json" });
		response.end(JSON.stringify({ choices: [{ message: { role: "assistant", tool_calls: [call] } }] }));
	}
}

function failure(response: ServerResponse, status: number, error: object): void {
	response.writeHead(status, { "content-type": "application/json" });
	response.end(JSON.stringify({ error }));
}

for (const stream of [false, true]) {
	const mode = stream ? "stream" : "non-stream";
	test(`${mode} sends the single-tool parameter and parses a valid call`, async () => {
		await withServer(success, async (url, requests) => {
			const result = stream ? await callLLMStream([], [], config(url)) : await callLLMWithTimeout([], [], config(url));
			assert.equal(result.name, "pass");
			assert.equal(requests.length, 1);
			assert.equal(requests[0].parallel_tool_calls, false);
		});
	});

	test(`${mode} retries an unsupported parameter once without caching`, async () => {
		await withServer((body, response) => {
			if (Object.hasOwn(body, "parallel_tool_calls")) {
				failure(response, 400, { param: "parallel_tool_calls", code: "unsupported_parameter", message: "Unsupported parameter" });
			} else success(body, response);
		}, async (url, requests) => {
			for (let i = 0; i < 2; i++) {
				const errors: string[] = [];
				const result = stream
					? await callLLMStream([], [], config(url), { onError: (_stage, message) => errors.push(message) })
					: await callLLMWithTimeout([], [], config(url));
				assert.equal(result.name, "pass");
				assert.deepEqual(errors, []);
			}
			assert.equal(requests.length, 4);
			for (let i = 0; i < 4; i += 2) {
				assert.equal(requests[i].parallel_tool_calls, false);
				assert.equal(Object.hasOwn(requests[i + 1], "parallel_tool_calls"), false);
				const { parallel_tool_calls, ...rest } = requests[i];
				assert.deepEqual(requests[i + 1], rest);
			}
		});
	});

	test(`${mode} does not retry unrelated errors and does not retry a second failure`, async () => {
		for (const error of [
			{ status: 400, message: "Bad request" },
			{ status: 400, message: "Unknown parameter: another_field" },
			{ status: 401, message: "Unsupported parameter: parallel_tool_calls" },
		]) {
			await withServer((_body, response) => failure(response, error.status, { message: error.message }), async (url, requests) => {
				const call = stream ? callLLMStream([], [], config(url)) : callLLMWithTimeout([], [], config(url));
				await assert.rejects(call, (result: any) => result.stage === "fetch" && result.httpStatus === error.status);
				assert.equal(requests.length, 1);
			});
		}
		await withServer((_body, response) => failure(response, 422, { message: "Unknown parameter: parallel_tool_calls" }), async (url, requests) => {
			const errors: string[] = [];
			const call = stream
				? callLLMStream([], [], config(url), { onError: (_stage, message) => errors.push(message) })
				: callLLMWithTimeout([], [], config(url));
			await assert.rejects(call, (result: any) => result.stage === "fetch" && result.httpStatus === 422);
			assert.equal(requests.length, 2);
			assert.equal(errors.length, stream ? 1 : 0);
		});
	});

	test(`${mode} still rejects multiple tool calls without compatibility retry`, async () => {
		await withServer((body, response) => {
			const call = { id: "call_1", type: "function", function: { name: "pass", arguments: '{"reason":"完成"}' } };
			if (body.stream) {
				response.writeHead(200, { "content-type": "text/event-stream" });
				response.write(`data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, ...call }, { index: 1, ...call }] } }] })}\n\n`);
				response.end("data: [DONE]\n\n");
			} else {
				response.writeHead(200, { "content-type": "application/json" });
				response.end(JSON.stringify({ choices: [{ message: { tool_calls: [call, call] } }] }));
			}
		}, async (url, requests) => {
			const errors: string[] = [];
			const call = stream
				? callLLMStream([], [], config(url), { onError: (stage, message) => errors.push(`${stage}: ${message}`) })
				: callLLMWithTimeout([], [], config(url));
			await assert.rejects(call, (error: any) => error.stage === "parse" && /multiple tool_calls/.test(error.message));
			assert.equal(requests.length, 1);
			assert.equal(errors.length, stream ? 1 : 0);
		});
	});
}

test("fallback respects cancellation and the remaining timeout budget", async () => {
	const unsupported = new APIError(400, { param: "parallel_tool_calls", code: "unsupported_parameter", message: "Unsupported parameter" }, "Unsupported parameter", undefined);
	const controller = new AbortController();
	let attempts = 0;
	await assert.rejects(requestWithParallelToolFallback(async () => {
		attempts++;
		controller.abort();
		throw unsupported;
	}, 1000, controller.signal), (error: any) => error.name === "AbortError");
	assert.equal(attempts, 1);

	attempts = 0;
	await assert.rejects(requestWithParallelToolFallback(async () => {
		attempts++;
		throw unsupported;
	}, 0), (error: any) => error.constructor.name === "APIConnectionTimeoutError");
	assert.equal(attempts, 1);

	const timeouts: number[] = [];
	const result = await requestWithParallelToolFallback(async (include, timeout) => {
		timeouts.push(timeout);
		if (include) throw unsupported;
		return "ok";
	}, 1000);
	assert.equal(result, "ok");
	assert.equal(timeouts.length, 2);
	assert.ok(timeouts[1] > 0 && timeouts[1] <= timeouts[0]);
});
