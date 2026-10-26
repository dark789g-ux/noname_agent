import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("content.ts", readFileSync(new URL("../content.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
let stages;
function visit(node) {
	if (ts.isPropertyAssignment(node) && node.name.getText(source) === "die" && ts.isArrayLiteralExpression(node.initializer)) stages = node.initializer.elements;
	ts.forEachChild(node, visit);
}
visit(source);
assert.ok(stages);

function setup(options = {}) {
	const calls = [];
	const { logNode: configuredLogNode, ...eventOptions } = options;
	const logNode = Object.hasOwn(options, "logNode") ? configuredLogNode : { logvid: "log-id" };
	const killer = { stat: [{}] };
	const player = {
		hp: 0,
		classList: { contains: () => false },
		$die(...args) { assert.equal(this, player); calls.push(["animation", ...args]); },
		dieAfter(...args) { assert.equal(this, player); calls.push(["dieAfter", ...args]); },
	};
	const game = {
		logv(...args) { calls.push(["logv", ...args]); return logNode; },
		log(...args) { calls.push(["log", ...args]); },
		broadcastAll() {},
		tryDieAudio(...args) { calls.push(["audio", ...args]); },
		addVideo(...args) { calls.push(["video", ...args]); },
	};
	const load = node => new Function("game", "ui", "_status", `"use strict"; return (${node.getText(source)});`)(game, {}, {});
	return { first: load(stages[0]), second: load(stages[1]), event: { source: killer, ...eventOptions }, player, killer, calls };
}

test("death retains source in logs, statistics and dieAfter while animation uses its zero-argument API", async () => {
	const state = setup();
	await state.first(state.event, undefined, state.player);
	await state.second(state.event, undefined, state.player);
	assert.deepEqual(state.calls, [
		["logv", state.player, "die", state.killer],
		["log", state.player, "被", state.killer, "杀害"],
		["audio", state.player],
		["video", "diex", state.player],
		["animation"],
		["dieAfter", state.killer],
	]);
	assert.equal(state.killer.stat[0].kill, 1);
	assert.equal(state.event.logvid, "log-id");
});

test("death keeps logvid absent when history logging returns no node", async () => {
	const state = setup({ logNode: undefined });
	await state.first(state.event, undefined, state.player);
	assert.equal(state.event.logvid, undefined);
	assert.deepEqual(state.calls[0], ["logv", state.player, "die", state.killer]);
});

test("death animation keeps animate=false and reserveOut short circuits", async () => {
	for (const options of [{ animate: false }, { reserveOut: true }]) {
		const state = setup(options);
		await state.first(state.event, undefined, state.player);
		assert.equal(state.calls.some(call => call[0] === "animation"), false);
		assert.equal(state.calls.some(call => call[0] === "video"), !options.reserveOut);
		assert.equal(state.killer.stat[0].kill, 1);
	}
});
