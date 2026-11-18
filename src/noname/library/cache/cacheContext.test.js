import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Match the application's bundler interop for crypto-js's CommonJS exports.
const require = createRequire(import.meta.url);
const { buildSync } = createRequire(require.resolve("vite"))("esbuild");
const bundle = buildSync({ entryPoints: [fileURLToPath(new URL("./cacheContext.js", import.meta.url))], bundle: true, platform: "node", format: "esm", write: false });
const { CacheContext } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

test("cache proxy preserves object identity, receiver, and string-key memoization", () => {
	let calls = 0;
	const source = {
		value: 3,
		read(offset) {
			assert.equal(this, source);
			calls++;
			return this.value + offset;
		},
	};
	const proxy = new CacheContext().delegate(source);
	assert.equal(proxy._cacheDelegateSource, source);
	assert.equal(proxy.value, 3);
	assert.equal(proxy.read(2), 5);
	assert.equal(proxy.read(2), 5);
	assert.equal(calls, 1);
});

test("cache support lists and cache-prefixed methods retain bypass behavior", () => {
	const source = {
		cacheSupportFunction() { return ["included"]; },
		included() { return 1; },
		excluded() { return 2; },
		cacheDirect() { return 3; },
	};
	const proxy = new CacheContext().delegate(source);
	assert.equal(proxy.excluded, source.excluded);
	assert.equal(proxy.cacheDirect, source.cacheDirect);
	assert.equal(proxy.included(), 1);
});

test("symbol properties bypass caching and keep original function identity", () => {
	const key = Symbol("value");
	let reads = 0;
	const source = {
		get [key]() { reads++; return reads; },
		*[Symbol.iterator]() { yield this[key]; },
		cacheSupportFunction() { throw new Error("Symbol reads must bypass the string support list"); },
	};
	const proxy = new CacheContext().delegate(source);
	assert.equal(proxy[key], 1);
	assert.equal(proxy[key], 2);
	assert.equal(proxy[Symbol.iterator], source[Symbol.iterator]);
	assert.deepEqual([...proxy], [3]);
	assert.equal(proxy[Symbol.toStringTag], undefined);
});
