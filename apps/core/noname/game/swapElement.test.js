import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import ts from "typescript";

const source = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Game");
assert.ok(declaration);

function functionSource(name) {
	const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
	assert.ok(declaration);
	return declaration.getText(source);
}

function createSwap(window) {
	const method = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === "$swapElement");
	assert.ok(method);
	const getInlineStyle = new Function(`${functionSource("isSwapElementStyle")}\n${functionSource("getInlineStyle")}\nreturn getInlineStyle;`)();
	let frame;
	const swap = new Function("game", "getInlineStyle", "requestAnimationFrame", `return function(${method.parameters.map(node => node.getText(source)).join(",")}) ${method.body.getText(source)}`)({ documentZoom: 1 }, getInlineStyle, callback => {
		frame = callback;
	});
	return {
		swap,
		runFrame() {
			assert.ok(frame);
			frame();
		},
		get frame() {
			return frame;
		},
		window,
	};
}

function setPosition(element) {
	element.getBoundingClientRect = () => {
		const index = Array.from(element.parentElement.children).indexOf(element);
		return { x: index * 10, y: 0 };
	};
}

async function withUnique(callback) {
	const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, "unique");
	Object.defineProperty(Array.prototype, "unique", {
		configurable: true,
		value() {
			return [...new Set(this)];
		},
	});
	try {
		return await callback();
	} finally {
		if (descriptor) {
			Object.defineProperty(Array.prototype, "unique", descriptor);
		} else {
			delete Array.prototype.unique;
		}
	}
}

test("$swapElement retains HTML and SVG siblings, positions, and inline styles", async () => {
	const dom = new JSDOM("<!doctype html><body></body>");
	try {
		await withUnique(async () => {
			const { document } = dom.window;
			const parent = document.createElement("div");
			const first = document.createElement("div");
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const last = document.createElement("div");
			parent.style.overflow = "hidden";
			parent.append(first, svg, last);
			document.body.append(parent);
			[first, svg, last].forEach(setPosition);
			const harness = createSwap(dom.window);

			const completion = harness.swap(first, last, 120, "ease-in-out");
			assert.deepEqual(Array.from(parent.children), [last, svg, first]);
			assert.equal(svg.style.transition, "none");
			assert.equal(svg.style.transform, "translate(0px, 0px)");
			assert.equal(parent.style.overflow, "visible");

			harness.runFrame();
			assert.equal(svg.style.transition, "120ms ease-in-out");
			assert.equal(svg.style.transform, "");
			first.dispatchEvent(new dom.window.Event("transitionend"));
			await completion;
			assert.equal(parent.style.overflow, "hidden");
		});
	} finally {
		dom.window.close();
	}
});

test("$swapElement rejects detached elements before reading layout or styles", async () => {
	const dom = new JSDOM("<!doctype html><body></body>");
	try {
		await withUnique(async () => {
			const detached = dom.window.document.createElement("div");
			const attached = dom.window.document.createElement("div");
			dom.window.document.body.append(attached);
			const harness = createSwap(dom.window);
			await assert.rejects(harness.swap(detached, attached), /requires both elements to have a parent/);
			assert.equal(harness.frame, undefined);
		});
	} finally {
		dom.window.close();
	}
});

test("$swapElement exchanges elements across document realms", async () => {
	const firstDom = new JSDOM("<!doctype html><body></body>");
	const secondDom = new JSDOM("<!doctype html><body></body>");
	try {
		await withUnique(async () => {
			const firstParent = firstDom.window.document.createElement("div");
			const first = firstDom.window.document.createElement("div");
			const firstSibling = firstDom.window.document.createElement("div");
			const secondParent = secondDom.window.document.createElement("div");
			const second = secondDom.window.document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const secondSibling = secondDom.window.document.createElement("div");
			firstParent.append(first, firstSibling);
			secondParent.append(second, secondSibling);
			firstDom.window.document.body.append(firstParent);
			secondDom.window.document.body.append(secondParent);
			[first, firstSibling, second, secondSibling].forEach(setPosition);
			const harness = createSwap(firstDom.window);

			const completion = harness.swap(first, second, 80);
			assert.deepEqual(Array.from(firstParent.children), [second, firstSibling]);
			assert.deepEqual(Array.from(secondParent.children), [first, secondSibling]);
			assert.equal(first.style.transition, "none");
			assert.equal(second.style.transition, "none");
			harness.runFrame();
			assert.equal(first.style.transition, "80ms linear");
			assert.equal(second.style.transition, "80ms linear");
			first.dispatchEvent(new secondDom.window.Event("transitionend"));
			await completion;
		});
	} finally {
		firstDom.window.close();
		secondDom.window.close();
	}
});

test("$swapElement rejects an observed element without inline styles after swapping", async () => {
	const dom = new JSDOM("<!doctype html><body></body>");
	try {
		await withUnique(async () => {
			const { document } = dom.window;
			const parent = document.createElement("div");
			const first = document.createElement("div");
			const unsupported = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const last = document.createElement("div");
			Object.defineProperty(unsupported, "style", { configurable: true, value: undefined });
			parent.append(first, unsupported, last);
			document.body.append(parent);
			[first, unsupported, last].forEach(setPosition);
			const harness = createSwap(dom.window);

			const completion = harness.swap(first, last);
			assert.deepEqual(Array.from(parent.children), [last, unsupported, first]);
			assert.equal(parent.style.overflow, "visible");
			assert.equal(harness.frame, undefined);
			await assert.rejects(completion, /must support inline styles/);
		});
	} finally {
		dom.window.close();
	}
});
