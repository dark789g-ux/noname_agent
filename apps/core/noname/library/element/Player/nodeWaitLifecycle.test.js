import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("player.js", readFileSync(new URL("../player.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const playerClass = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Player");
assert.ok(playerClass);

function waitMethod(dependencies) {
	const node = playerClass.members.find(member => ts.isMethodDeclaration(member) && member.name.getText(source) === "wait");
	assert.ok(node);
	const parameters = node.parameters.map(parameter => parameter.getText(source)).join(",");
	return new Function(...Object.keys(dependencies), `return function(${parameters}) ${node.body.getText(source)}`)(...Object.values(dependencies));
}

function waitRuntime() {
	const node = { torespond: {}, torespondtimeout: {} };
	let timer;
	const wait = waitMethod({
		lib: { node: {}, configOL: { choose_timeout: "1" }, requireNodeServer: () => node },
		_status: { event: { _global_timer: false, _global_waiting: true, getParent: () => ({ skillHidden: false }) }, noclearcountdown: undefined },
		game: { players: [] },
		clearTimeout() {},
		setTimeout(callback, delay) {
			timer = { callback, delay };
			return timer;
		},
	});
	return { wait, timer: () => timer };
}

test("wait timeout closes the connection rebound after waiting began", () => {
	const runtime = waitRuntime();
	let oldClosed = 0;
	let currentClosed = 0;
	const player = {
		playerid: "p1",
		ws: { closed: false, ws: { close: () => oldClosed++ } },
		showTimer() {},
		unwait(result) {
			assert.equal(result, "ai");
		},
	};
	runtime.wait.call(player);
	assert.equal(runtime.timer().delay, 6000);
	player.ws = { closed: false, ws: { close: () => currentClosed++ } };
	runtime.timer().callback();
	assert.equal(oldClosed, 0);
	assert.equal(currentClosed, 1);
});

test("wait timeout reports a missing rebound connection as a TypeError", () => {
	const runtime = waitRuntime();
	const player = {
		playerid: "p1",
		ws: { closed: false, ws: { close() {} } },
		showTimer() {},
		unwait() {},
	};
	runtime.wait.call(player);
	player.ws = undefined;
	assert.throws(() => runtime.timer().callback(), TypeError);
});
