import assert from "node:assert/strict";
import test from "node:test";
import { requireOnFree } from "./onfree.js";

test("startup consumers append to the original ordered callback queue", () => {
	const calls = [];
	const callbacks = [() => calls.push("first")];
	const pending = requireOnFree(callbacks);
	assert.equal(pending, callbacks);
	pending.push(() => calls.push("second"));
	callbacks.forEach(callback => callback());
	assert.deepEqual(calls, ["first", "second"]);
});

test("a drained startup queue fails instead of dropping or reinitializing work", () => {
	assert.throws(() => requireOnFree(undefined), TypeError);
});
