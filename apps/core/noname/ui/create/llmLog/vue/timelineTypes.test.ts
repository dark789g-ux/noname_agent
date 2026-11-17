import assert from "node:assert/strict";
import test from "node:test";
import { copyToClipboard, formatShortLogId } from "./timelineTypes.js";

test("formatShortLogId extracts suffix from standard log_<timestamp>_<suffix> ids", () => {
	assert.equal(formatShortLogId("log_1794929219000_a1b2c3"), "#a1b2c3");
	assert.equal(formatShortLogId("  log_1794929219000_z9x8y7  "), "#z9x8y7");
});

test("formatShortLogId handles non-standard and empty ids gracefully", () => {
	assert.equal(formatShortLogId("1234567890"), "#567890");
	assert.equal(formatShortLogId("abc"), "#abc");
	assert.equal(formatShortLogId("log_1794929219000_toolongsuffix"), "#suffix");
	assert.equal(formatShortLogId(""), "");
	assert.equal(formatShortLogId("   "), "");
});

test("copyToClipboard returns false for empty input", async () => {
	assert.equal(await copyToClipboard(""), false);
});

test("copyToClipboard prefers navigator.clipboard.writeText when available", async () => {
	let copiedText = "";
	const prevNavigator = globalThis.navigator;
	Object.defineProperty(globalThis, "navigator", {
		configurable: true,
		value: {
			clipboard: {
				async writeText(text: string) {
					copiedText = text;
				},
			},
		},
	});
	try {
		const ok = await copyToClipboard("log_1794929219000_a1b2c3");
		assert.equal(ok, true);
		assert.equal(copiedText, "log_1794929219000_a1b2c3");
	} finally {
		if (prevNavigator === undefined) {
			delete (globalThis as Record<string, unknown>).navigator;
		} else {
			Object.defineProperty(globalThis, "navigator", {
				configurable: true,
				value: prevNavigator,
			});
		}
	}
});
