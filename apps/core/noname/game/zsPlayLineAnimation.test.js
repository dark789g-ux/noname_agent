import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const gameClass = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Game");
assert.ok(gameClass);
const method = gameClass.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === "zsPlayLineAnimation");
assert.ok(method);

let positionBranch;
const visit = node => {
	if (!positionBranch && ts.isIfStatement(node) && node.expression.getText(source) === "points == undefined") {
		positionBranch = node;
	}
	ts.forEachChild(node, visit);
};
visit(method);
assert.ok(positionBranch);

const javascript = ts.transpileModule(`function position(points, div, judgeStyle) { ${positionBranch.getText(source)} }`, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
const position = Function(`${javascript}; return position;`)();

function createDiv() {
	return {
		offsetHeight: 40,
		offsetWidth: 80,
		style: {},
		children: [],
		appendChild(child) {
			this.children.push(child);
			child.parentNode = this;
		},
		setBackgroundImage() {},
	};
}

function createAnimationHarness(animation) {
	const window = createDiv();
	window.removed = [];
	window.removeChild = function (child) {
		this.removed.push(child);
		const index = this.children.indexOf(child);
		if (index !== -1) {
			this.children.splice(index, 1);
		}
	};
	const timers = [];
	const game = {
		jianqiLineAnim: animation,
		pause2() {
			this.paused = (this.paused || 0) + 1;
		},
		resume2() {
			this.resumed = (this.resumed || 0) + 1;
		},
	};
	const ui = { window, create: { div: createDiv } };
	const _status = {};
	const run = new Function("game", "lib", "_status", "ui", "document", "Image", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "cancelAnimationFrame", `return function(${method.parameters.map(node => node.getText(source)).join(",")}) ${method.body.getText(source)}`)(
		game,
		{ config: {}, assetURL: "" },
		_status,
		ui,
		{ createElement() { return { getContext() { return null; } }; } },
		class Image {},
		(callback, delay) => {
			timers.push({ callback, delay });
			return timers.length;
		},
		() => {},
		() => 0,
		() => {},
		() => {}
	);
	return { game, ui, _status, run, timers };
}

test("fake 无路径动画在 ui.window 坐标系居中", () => {
	const div = createDiv();
	position(undefined, div, () => false);
	assert.equal(div.style.top, "calc(50% - 20px)");
	assert.equal(div.style.left, "calc(50% - 40px)");
});

test("无路径动画分别保留显式 top 与 left", () => {
	const topDiv = createDiv();
	topDiv.style.top = "12px";
	position(undefined, topDiv, style => style === "top");
	assert.equal(topDiv.style.top, "12px");
	assert.equal(topDiv.style.left, "calc(50% - 40px)");

	const leftDiv = createDiv();
	leftDiv.style.left = "15px";
	position(undefined, leftDiv, style => style === "left");
	assert.equal(leftDiv.style.top, "calc(50% - 20px)");
	assert.equal(leftDiv.style.left, "15px");
});

test("带路径动画仍以首个点定位", () => {
	const div = createDiv();
	position(
		[
			[30, 70],
			[80, 100],
		],
		div,
		() => false
	);
	assert.equal(div.style.top, "50px");
	assert.equal(div.style.left, "30px");
});

test("fake 无路径动画挂载 ui.window，并保留显式轴", () => {
	const harness = createAnimationHarness({ image: "line.png", time: 20, style: { top: "12px" }, width: "80px", height: "40px" });
	harness.run("line.png", undefined, true);
	assert.equal(harness.ui.window.children.length, 1);
	const div = harness.ui.window.children[0];
	assert.equal(div.style.top, "12px");
	assert.equal(div.style.left, "calc(50% - 40px)");
	assert.equal(harness.timers.some(timer => timer.delay === 20), true);
});

test("fake 动画画布初始化失败时从 ui.window 清理并恢复暂停状态", () => {
	const harness = createAnimationHarness({ image: "frames", time: 20, width: "80px", height: "40px" });
	harness.run("frames", undefined, true);
	assert.equal(harness.ui.window.children.length, 0);
	assert.equal(harness.ui.window.removed.length, 1);
	assert.equal(harness._status.zhx_onAnimation, 0);
	assert.equal(harness.game.paused, 1);
	assert.equal(harness.game.resumed, 1);
});
