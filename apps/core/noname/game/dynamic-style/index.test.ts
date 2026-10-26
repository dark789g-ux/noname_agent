import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { DynamicStyle } from "./index.js";

function useDocument() {
	const dom = new JSDOM("<!doctype html><head></head><body></body>");
	Object.assign(globalThis, { document: dom.window.document });
	return dom;
}

test("DynamicStyle adds and removes a rule", () => {
	useDocument();
	const styles = new DynamicStyle();

	assert.equal(styles.add(".target", { color: "red" }), true);
	assert.deepEqual(styles.get(".target"), { color: "red" });
	assert.equal(styles.remove(".target"), true);
	assert.equal(styles.size(), 0);
	assert.equal(styles.get(".target"), null);
});

test("DynamicStyle keeps rules for empty removals and rejects missing selectors", () => {
	useDocument();
	const styles = new DynamicStyle();

	assert.equal(styles.add(".target", { color: "red", opacity: 1 }), true);
	assert.equal(styles.removeStyles(".target", []), true);
	assert.deepEqual(styles.get(".target"), { color: "red", opacity: 1 });
	assert.equal(styles.removeStyles(".missing", ["color"]), false);
	assert.equal(styles.remove(".missing"), false);
});

test("DynamicStyle reports a missing stylesheet during initialization", () => {
	const dom = useDocument();
	const descriptor = Object.getOwnPropertyDescriptor(dom.window.HTMLStyleElement.prototype, "sheet");
	assert.ok(descriptor);
	Object.defineProperty(dom.window.HTMLStyleElement.prototype, "sheet", {
		configurable: true,
		get: () => null,
	});

	try {
		assert.throws(() => new DynamicStyle(), /requires an available stylesheet/);
		assert.equal(document.head.querySelector("#game\\.dynamicStyle"), null);
	} finally {
		Object.defineProperty(dom.window.HTMLStyleElement.prototype, "sheet", descriptor);
	}
});
