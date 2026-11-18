import { field } from "./testing/fixtures.mjs";
import assert from "node:assert/strict";

import test from "node:test";

for (const name of ["filterTrigger", "filterEnable"]) {
	test(`${name} retains one ReferenceError log and false when skill info is missing`, () => {
		const calls = [];
		const queried = [];
		const receiver = field("filter", {
			get: {
				info(skill) {
					queried.push(skill);
					return undefined;
				},
			},
			console: {
				error(...args) {
					calls.push(args);
				},
			},
		});
		const args = name === "filterTrigger" ? [{}, {}, "phaseBegin", "missing"] : [{}, {}, "missing"];
		assert.equal(receiver[name](...args), false);
		assert.deepEqual(queried, ["missing"]);
		assert.equal(calls.length, 1);
		assert.equal(calls[0].length, 1);
		const error = calls[0][0];
		assert.ok(error instanceof ReferenceError);
		assert.equal(error.message, "缺少info的技能:");
		assert.equal(Object.hasOwn(error, "cause"), false);
		assert.equal(Object.hasOwn(error, "fileName"), false);
	});
}
