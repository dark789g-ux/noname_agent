import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { gameTestSource } from "./testSource.js";

const source = gameTestSource();
let statements;
function visit(node) {
	if (ts.isBlock(node)) {
		const start = node.statements.findIndex(statement => statement.getText(source).startsWith("let modecharacters ="));
		const end = node.statements.findIndex(statement => statement.getText(source) === "newvid.video = structuredClone(newvid.video);");
		if (start >= 0 && end > start) statements = node.statements.slice(start, end);
	}
	ts.forEachChild(node, visit);
}
visit(source);
assert.ok(statements);
const run = new Function("newvid", "lib", "get", statements.map(statement => statement.getText(source)).join("\n"));

test("video names preserve missing names and native undefined registry lookup", () => {
	const unnamed = { name1: undefined };
	run(unnamed, { characterPack: { mode_identity: {} } }, { mode: () => "identity" });
	assert.equal(unnamed.name1, undefined);
	run(unnamed, { characterPack: { mode_identity: { undefined: {} } } }, { mode: () => "identity" });
	assert.equal(unnamed.name1, "identity::undefined");
	const missing = { name1: undefined };
	assert.throws(() => run(missing, { characterPack: { mode_guozhan: { undefined: {} } } }, { mode: () => "guozhan" }), TypeError);
	assert.equal(missing.name1, undefined);
});

test("video names keep guozhan conversion and the existing missing-main subplayer failure", () => {
	const video = { name1: "gz_shibing1wei", name2: "gz_hero" };
	run(video, { characterPack: { mode_guozhan: { gz_shibing1wei: {}, gz_hero: {} } } }, { mode: () => "guozhan" });
	assert.deepEqual(video, { name1: "shibing1", name2: "hero" });
	const missing = { name1: undefined, name2: "subplayer_vice_1" };
	assert.throws(() => run(missing, { characterPack: {} }, { mode: () => "identity" }), TypeError);
	assert.deepEqual(missing, { name1: undefined, name2: "subplayer_vice_1" });
});
