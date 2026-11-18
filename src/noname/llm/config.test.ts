import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { assertLLMURL, llmURLProblem, migrateLLMTextConfig, normalizeLLMText } from "./config.js";
import { callLLMStream, callLLMWithTimeout } from "./client.js";
import type { LLMConfig } from "./index.js";

function declaration(file: string, name: string, dependencies: Record<string, any>): any {
	const source = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
	const node = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
	assert.ok(node);
	const compiled = ts.transpileModule(`${node.getText(source).replace(/^export /, "")}; return ${name};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
	return new Function(...Object.keys(dependencies), compiled)(...Object.values(dependencies));
}

test("历史富文本在惰性容器内提取，正常纯文本和空值保持语义", () => {
	const dom = new JSDOM();
	try {
		assert.equal(normalizeLLMText('<span style="color:red"> https://example.invalid/v1?a=1&amp;b=2 </span><script>throw 1</script>', dom.window.document), "https://example.invalid/v1?a=1&b=2");
		assert.equal(normalizeLLMText(" test-only-key ", dom.window.document), "test-only-key");
		assert.equal(normalizeLLMText("literal&value", dom.window.document), "literal&value");
		assert.equal(normalizeLLMText(undefined, dom.window.document), "");
		const config = { llm_url: "<b>https://example.invalid</b>", unrelated: "<b>keep</b>" };
		const saved: string[] = [];
		migrateLLMTextConfig(
			config,
			(key, value) => {
				config[key] = value;
				saved.push(key);
			},
			dom.window.document
		);
		migrateLLMTextConfig(
			config,
			(key, value) => {
				config[key] = value;
				saved.push(key);
			},
			dom.window.document
		);
		assert.deepEqual(saved, ["llm_url"]);
		assert.equal(config.unrelated, "<b>keep</b>");
	} finally {
		dom.window.close();
	}
});

test("API 地址必须为完整 HTTP(S) URL，拒绝 HTML、相对地址和错误协议", () => {
	for (const url of ["https://example.invalid/v1", "http://localhost:11434/v1", "https://example.invalid"]) assert.equal(llmURLProblem(url), undefined);
	for (const url of ["", "example.invalid", "/v1", "ftp://example.invalid", "https:example.invalid", "https://", "https://example.invalid/a b", "<span>https://example.invalid</span>"]) {
		assert.throws(
			() => assertLLMURL(url),
			(error: any) => error.stage === "config" && /API 地址/.test(error.message)
		);
	}
});

test("两个真实请求入口均在联网前拒绝非法配置", async t => {
	let requests = 0;
	t.mock.method(globalThis, "fetch", async () => {
		requests++;
		throw new Error("unexpected network");
	});
	const config = { url: "<span>https://example.invalid</span>", apikey: "test-only-key", model: "test", timeoutSec: 1, maxRetries: 0 } as LLMConfig;
	for (const call of [callLLMStream, callLLMWithTimeout]) await assert.rejects(call([], [], config), (error: any) => error.stage === "config");
	assert.equal(requests, 0);
});

test("配置错误不会从流式重复回退到非流式请求", async () => {
	let attempts = 0;
	const request = declaration("./decide.ts", "requestToolCall", {
		requestStream: async () => {
			attempts++;
			assertLLMURL("bad");
		},
		requestNonstream: async () => {
			attempts++;
			throw new Error("unexpected fallback");
		},
	});
	await assert.rejects(request([], [], {}, Date.now() + 1000, "test", 0, true), (error: any) => error.stage === "config");
	assert.equal(attempts, 1);
});

test("真实决策入口在构造候选和尝试请求前记录配置错误并回退本地 AI", async () => {
	const errors: any[] = [];
	let attempts = 0;
	const decide = declaration("./decide.ts", "tryLLMDecide", {
		decisionTrace: () => ({}),
		_status: { llmEnabledAtGameStart: true },
		getLLMConfig: () => ({ enabled: true, url: "bad", apikey: "test-only", model: "test", decisionTimeoutSec: 1 }),
		llmEnabled: () => true,
		llmConfigured: () => true,
		assertLLMURL,
		llmLogger: {
			start: () => "test",
			logError: (...args: any[]) => errors.push(args),
			endFallback() {},
			startRequestAttempt() {
				attempts++;
			},
		},
		createDecisionRuntime: () => {
			throw new Error("must validate first");
		},
	});
	assert.deepEqual(await decide({ name: "chooseToUse" }), { handled: false });
	assert.equal(errors[0][1], "config");
	assert.equal(attempts, 0);
});

test("开局读取的配置快照使用清理后的纯文本", () => {
	const dom = new JSDOM();
	try {
		const read = declaration("./index.ts", "readLLMConfig", { lib: { config: { llm_url: "<b>https://example.invalid</b>", llm_model: "<span>test-model</span>", llm_apikey: " test-only " } }, normalizeLLMText, globalThis: { document: dom.window.document }, clampNumber: (_value: any, fallback: number) => fallback });
		const config = read();
		assert.equal(config.url, "https://example.invalid");
		assert.equal(config.model, "test-model");
		assert.equal(config.apikey, "test-only");
	} finally {
		dom.window.close();
	}
});
