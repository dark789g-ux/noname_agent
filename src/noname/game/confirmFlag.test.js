import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("check.js", readFileSync(new URL("check.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const reader = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "readEventNoConfirm");
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Check");
const method = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === "confirm");
assert.ok(reader && method);

function harness(value, options = {}) {
	const calls = [];
	const event = {};
	Object.defineProperty(event, "noconfirm", {
		get() {
			calls.push("flag");
			if (value instanceof Error) throw value;
			return value;
		},
	});
	const status = { noconfirm: options.noconfirm, mouseleft: options.mouseleft, mousedown: options.mousedown };
	Object.defineProperty(status, "event", { get() { calls.push("event"); return event; } });
	const ui = { arena: { classList: { add(value) { calls.push(value); } } }, create: { confirm(value) { calls.push(["confirm", value]); } } };
	const game = { countChoose() { calls.push("count"); } };
	const confirm = new Function("_status", "ui", "game", `${reader.getText(source)}; return function(event, confirm) ${method.body.getText(source)}`)(status, ui, game);
	return { calls, confirm };
}

test("confirmation preserves extension truthiness, single reads and UI order", () => {
	for (const value of [undefined, null, false, 0, "", true, 1, "disabled", {}]) {
		const { calls, confirm } = harness(value);
		confirm({}, "ok");
		assert.deepEqual(calls, ["selecting", "count", "event", "flag", ...(!value ? [["confirm", "ok"]] : [])]);
	}
});

test("confirmation keeps status and mouse short-circuiting", () => {
	const blocked = harness(new Error("must not read"), { noconfirm: true });
	blocked.confirm({}, "ok");
	assert.deepEqual(blocked.calls, ["selecting", "count"]);
	for (const mouseleft of [false, true]) {
		const { calls, confirm } = harness(false, { mouseleft, mousedown: true });
		confirm({ filterTarget: true }, "ok");
		assert.deepEqual(calls, ["selecting", "tempnoe", "count", "event", "flag", ...(mouseleft ? [["confirm", "ok"]] : [])]);
	}
});

test("confirmation propagates a getter failure at the original read point", () => {
	const error = new Error("extension getter");
	const { calls, confirm } = harness(error);
	assert.throws(() => confirm({}, "ok"), caught => caught === error);
	assert.deepEqual(calls, ["selecting", "count", "event", "flag"]);
});
