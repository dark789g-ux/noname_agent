import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { playerTestSource } from "./testSource.js";

const source = playerTestSource();
const playerClass = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Player");
const useCard = playerClass.members.find(node => node.name?.getText(source) === "useCard");
const branch = useCard.body.statements.find(node => ts.isIfStatement(node) && node.expression.getText(source).includes('typeof this.logAi == "function"'));
assert.ok(branch);
const run = new Function("next", "get", branch.getText(source));

test("useCard passes noai tag and card/targets context to skill filtering", () => {
	const calls = [];
	const next = { card: {}, targets: [{}] };
	const player = {
		hasSkillTag(...args) { calls.push(args); return true; },
		logAi() { assert.fail("noai skill must suppress identity inference"); },
	};
	run.call(player, next, { info: () => ({}) });
	assert.deepEqual(calls, [["noai", true, { card: next.card, targets: next.targets }, true]]);
});

test("event and card noai keep their short-circuit behavior", () => {
	const player = { hasSkillTag() { assert.fail("earlier noai should short-circuit"); }, logAi() { assert.fail("noai"); } };
	run.call(player, { noai: true }, { info() { assert.fail("event noai should short-circuit"); } });
	run.call(player, { card: {} }, { info: () => ({ noai: true }) });
});

test("rejected noai tag preserves immediate and postAi inference", () => {
	for (const deferred of [false, true]) {
		const next = { card: {}, targets: [{}] };
		const calls = [];
		const player = { hasSkillTag: () => false, logAi(...args) { calls.push(args); } };
		run.call(player, next, { info: () => ({ postAi(targets) { assert.equal(targets, next.targets); return deferred; } }) });
		assert.deepEqual(calls, deferred ? [] : [[next.targets, next.card]]);
		assert.equal(next.postAi, deferred ? true : undefined);
	}
});
