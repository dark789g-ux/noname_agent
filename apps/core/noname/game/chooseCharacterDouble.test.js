import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Game");
const method = declaration.members.find(node => node.name?.getText(source) === "chooseCharacterDouble");
assert.ok(method);

function find(predicate) {
	let match;
	function visit(node) {
		if (!match && predicate(node)) match = node;
		ts.forEachChild(node, visit);
	}
	visit(method);
	assert.ok(match);
	return match;
}

const stages = find(node => ts.isCallExpression(node) && node.expression.getText(source) === "next.setContent").arguments[0].elements;
const reselect = find(node => ts.isCallExpression(node) && node.expression.getText(source) === "ui.create.system" && node.arguments[0]?.text === "重选").arguments[1];
function assigned(name) {
	return find(node => ts.isBinaryExpression(node) && node.left.getText(source) === `event.${name}`).right;
}

function avatar(link, index) {
	const classes = new Set();
	return {
		link, index, nodename: { innerHTML: link, dataset: {} },
		classList: { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name) },
		setBackground(name) { this.background = name; },
		delete() {},
	};
}

function harness() {
	const calls = [];
	const avatars = [avatar("a", 2), avatar("b", 3), avatar("c", 4), avatar("d", 5)];
	const event = {
		config: { width: 2, height: 4, num: 1 }, avatars, friend: [], enemy: [], blank: [], list2: ["spare"],
		imchoosing: true, promptbar: { hide: () => calls.push("hide"), delete() {} }, nodes: [],
		custom: { add: { window: () => calls.push("window") } },
		checkredo: () => false, resize() {},
		moveAvatar(node, index) {
			if (!node.classList.contains("moved")) event.blank.push(node.index);
			node.index = index;
			calls.push(["move", node.link, index]);
		},
	};
	event.blank.randomRemove = () => event.blank.pop();
	const game = { resume: () => calls.push("resume"), delay: () => calls.push("delay") };
	const get = { slimName: name => name, groupnature: group => group };
	const lib = { character: { replacement: ["male", "wei"] }, onresize: { remove() {} } };
	const ui = { wuxie: { show() {} }, auto: { show() {} } };
	function compile(node) {
		return new Function("event", "game", "get", "lib", "ui", "Math", `return ${node.getText(source)};`)(event, game, get, lib, ui, { random: () => 0 });
	}
	event.aiMove = compile(assigned("aiMove"));
	event.clickAvatar = compile(assigned("clickAvatar"));
	return { event, avatars, calls, reselect: compile(reselect), fill: compile(stages[4]), finish: compile(stages[6]) };
}

test("human and AI picks retain avatar nodes while reselect stores only character codes", () => {
	const { event, avatars, calls, reselect } = harness();
	event.clickAvatar.call(avatars[0]);
	event.aiMove();
	assert.equal(event.friend[0], avatars[0]);
	assert.equal(event.enemy[0], avatars[1]);
	assert.deepEqual(calls.slice(0, 3), [["move", "a", 6], "resume", ["move", "b", 0]]);
	reselect();
	assert.deepEqual(event.list2, ["spare", "a", "b"]);
	assert.equal(event.list2.every(name => typeof name === "string"), true);
	assert.equal(event.friend.length, 0);
	assert.equal(event.enemy.length, 0);
	assert.equal(event.redoing, true);
	assert.equal(avatars[0].classList.contains("moved"), false);
	assert.equal(avatars[1].classList.contains("moved"), false);
	assert.deepEqual(calls.slice(-3), [["move", "a", 3], ["move", "b", 2], "resume"]);
	// The same existing avatars can be picked again after reset.
	event.clickAvatar.call(avatars[1]);
	event.aiMove();
	assert.equal(event.friend[0], avatars[1]);
	assert.equal(event.enemy[0], avatars[0]);
});

test("replacement keeps selected avatar identity and reselect reads its current code", () => {
	const { event, avatars, calls, reselect } = harness();
	event.clickAvatar.call(avatars[0]);
	event.replacing = "replacement";
	event.clickAvatar.call(avatars[0]);
	assert.equal(event.friend[0], avatars[0]);
	assert.equal(event.friend.length, 1);
	assert.equal(avatars[0].background, "replacement");
	assert.equal(avatars[0].nodename.dataset.nature, "wei");
	assert.equal(calls.includes("window"), true);
	reselect();
	assert.deepEqual(event.list2, ["spare", "replacement"]);
});

test("AI and final filling use the same node collections and publish code results", () => {
	for (const side of [0, 2]) {
		const { event, avatars, fill, finish } = harness();
		event.clickAvatar.call(avatars[0]);
		event.aiMove();
		event.side = side;
		fill(event);
		const filled = side < 2 ? event.friend : event.enemy;
		assert.equal(filled[filled.length - 2], avatars[2]);
		assert.equal(filled[filled.length - 1], avatars[3]);
		assert.equal(avatars.every(node => node.classList.contains("moved")), true);
		event.friendlist = [event.friend[0]];
		event.enemylist = [event.enemy[0]];
		finish(event);
		assert.deepEqual(event.result, { friend: ["a"], enemy: ["b"] });
	}
});
