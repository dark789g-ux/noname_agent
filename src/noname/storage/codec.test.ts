import assert from "node:assert/strict";
import test from "node:test";
import { encode, decode, encodeKey, decodeKey, compareKeys } from "./codec.js";

test("configuration values, cycles, maps, sparse arrays and binary views survive serialization", async () => {
	const buffer = new Uint8Array([0, 1, 255, 3]).buffer;
	const value: any = { date: new Date(0), nan: NaN, inf: Infinity, minusZero: -0, big: 2n ** 80n, empty: undefined, regexp: /test/gi, buffer, view: new Uint8Array(buffer, 1, 2), dataView: new DataView(buffer, 1, 2), sparse: new Array(4) };
	value.self = value;
	value.map = new Map([[value, new Set([value])]]);
	value.sparse[3] = value;
	Object.defineProperty(value, "__proto__", { value: { safe: true }, enumerable: true });
	const result = decode(await encode(value));
	assert.equal(result.self, result);
	assert.equal(result.sparse.length, 4);
	assert.equal(0 in result.sparse, false);
	assert.equal(result.sparse[3], result);
	assert.equal(result.view.buffer, result.buffer);
	assert.equal(result.dataView.buffer, result.buffer);
	assert.deepEqual([...result.view], [1, 255]);
	assert.equal(result.map.get(result).has(result), true);
	assert.equal(result.date.getTime(), 0);
	assert.equal(result.regexp.flags, "gi");
	assert.equal(result.big, value.big);
	assert.ok(Number.isNaN(result.nan));
	assert.ok(Object.is(result.minusZero, -0));
	assert.equal(result.inf, Infinity);
	assert.equal(result.empty, undefined);
	assert.deepEqual(result.__proto__, { safe: true });
	assert.equal(Object.getPrototypeOf(result), Object.prototype);
});

test("custom image/audio Blob and File keep their bytes, MIME type and file metadata", async () => {
	const value = { image: new Blob([new Uint8Array([0, 128, 255])], { type: "image/png" }), audio: new File(["music"], "music.ogg", { type: "audio/ogg", lastModified: 123 }) };
	const result = decode(await encode(value));
	assert.equal(result.image.type, "image/png");
	assert.deepEqual([...new Uint8Array(await result.image.arrayBuffer())], [0, 128, 255]);
	assert.ok(result.audio instanceof File);
	assert.equal(result.audio.name, "music.ogg");
	assert.equal(result.audio.lastModified, 123);
	assert.equal(await result.audio.text(), "music");
});

test("record keys preserve numeric/string distinctions and composite keys", () => {
	assert.notEqual(encodeKey(123), encodeKey("123"));
	for (const key of [0, 123, Infinity, -Infinity, "123", new Date(0), ["seat", 2], new Uint8Array([0, 255]).buffer]) assert.deepEqual(decodeKey(encodeKey(key)), key);
	assert.throws(() => encodeKey(NaN), /无效/);
	assert.ok(compareKeys(123, "123") < 0);
	assert.ok(compareKeys(["a", 2], ["a", 10]) < 0);
	assert.ok(compareKeys(new Uint8Array([1, 2]).buffer, new Uint8Array([1, 3]).buffer) < 0);
});

test("boxed primitives keep their value and unsupported prototypes fail instead of losing content", async () => {
	for (const primitive of [true, "text", 123, 4n]) {
		const restored = decode(await encode(Object(primitive)));
		assert.equal(typeof restored, "object");
		assert.equal(restored.valueOf(), primitive);
	}
	class Unsupported { value = 1; }
	await assert.rejects(encode(new Unsupported()), /无法无损保存/);
});
