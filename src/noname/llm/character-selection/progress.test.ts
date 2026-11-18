import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { parse, compileScript } from "vue/compiler-sfc";
import { OpeningState } from "./state.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	Node: dom.window.Node,
	Element: dom.window.Element,
	HTMLElement: dom.window.HTMLElement,
	HTMLDivElement: dom.window.HTMLDivElement,
	SVGElement: dom.window.SVGElement,
	Comment: dom.window.Comment,
	Text: dom.window.Text,
});

const vue = await import("vue");

function loadProgressModule() {
	const sfcSource = readFileSync(new URL("./OpeningProgress.vue", import.meta.url), "utf8");
	const { descriptor } = parse(sfcSource, { filename: "OpeningProgress.vue" });
	const compiled = compileScript(descriptor, { id: "llm-opening-progress", inlineTemplate: true });
	const sfcJs = ts.transpileModule(compiled.content, {
		compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
	}).outputText;
	const sfcMod = { exports: {} as Record<string, any> };
	new Function("exports", "require", "module", sfcJs)(
		sfcMod.exports,
		(id: string) => {
			if (id === "vue") return vue;
			throw new Error(`Unexpected SFC import: ${id}`);
		},
		sfcMod
	);

	const tsSource = readFileSync(new URL("./progress.ts", import.meta.url), "utf8");
	const tsJs = ts.transpileModule(tsSource, {
		compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
	}).outputText;
	const progressMod = { exports: {} as Record<string, any> };
	new Function("exports", "require", "module", tsJs)(
		progressMod.exports,
		(id: string) => {
			if (id === "vue") return vue;
			if (id === "./OpeningProgress.vue") return sfcMod.exports;
			throw new Error(`Unexpected progress.ts import: ${id}`);
		},
		progressMod
	);

	return progressMod.exports as {
		createOpeningProgress: typeof import("./progress.js").createOpeningProgress;
		resetOpeningProgressOffset: typeof import("./progress.js").resetOpeningProgressOffset;
	};
}

function resetTestDom(t: test.TestContext) {
	dom.window.document.body.innerHTML = "";
	const previousGame = (globalThis as any).game;
	t.after(() => {
		dom.window.document.body.innerHTML = "";
		if (previousGame === undefined) delete (globalThis as any).game;
		else (globalThis as any).game = previousGame;
	});
	return dom;
}

function pointerEvent(type: string, clientX = 0, clientY = 0) {
	return new dom.window.MouseEvent(type, {
		bubbles: true,
		cancelable: true,
		clientX,
		clientY,
		button: 0,
	});
}

test("Vue 进度面板显示进度条、座位、回退告警，跳过只修改本轮状态并可清理", async t => {
	resetTestDom(t);
	const { createOpeningProgress, resetOpeningProgressOffset } = loadProgressModule();
	resetOpeningProgressOffset();

	const state = new OpeningState();
	state.completed = 1;
	state.active.set(3, new AbortController());
	const parent = dom.window.document.body;
	const view = createOpeningProgress(state, 5, parent);

	try {
		const banner = parent.querySelector(".llm-opening-progress") as HTMLElement;
		assert.ok(banner);
		assert.match(banner.textContent || "", /LLM 选将/);
		assert.match(banner.textContent || "", /1\/5/);
		assert.match(banner.textContent || "", /等待 3号位/);
		assert.equal((banner.querySelector(".progress-fill") as HTMLElement).style.width, "20%");
		assert.equal(banner.querySelector(".pill.warn"), null);

		state.completed = 2;
		state.fallbacks = 2;
		state.active.delete(3);
		state.active.set(4, new AbortController());
		view.update();
		await vue.nextTick();

		assert.match(banner.textContent || "", /2\/5/);
		assert.equal((banner.querySelector(".progress-fill") as HTMLElement).style.width, "40%");
		assert.match(banner.textContent || "", /等待 4号位/);
		assert.match(banner.querySelector(".pill.warn")?.textContent || "", /回退 2/);

		const button = banner.querySelector("button.skip-btn") as HTMLButtonElement;
		button.click();
		await vue.nextTick();

		assert.equal(state.skipped, true);
		assert.equal(state.active.get(4)!.signal.aborted, true);
		assert.equal(button.disabled, true);
		assert.match(banner.textContent || "", /已跳过/);
	} finally {
		view.close();
	}

	assert.equal(parent.children.length, 0);
});

test("进度面板支持按缩放比例拖拽并记忆内存偏移，点击跳过按钮不触发拖拽", async t => {
	resetTestDom(t);
	const { createOpeningProgress, resetOpeningProgressOffset } = loadProgressModule();
	resetOpeningProgressOffset();
	(globalThis as any).game = { documentZoom: 2 };

	const parent = dom.window.document.body;
	const firstState = new OpeningState();
	const firstView = createOpeningProgress(firstState, 4, parent);

	try {
		const banner = parent.querySelector(".llm-opening-progress") as HTMLElement;
		const button = banner.querySelector("button.skip-btn") as HTMLButtonElement;

		button.dispatchEvent(pointerEvent("pointerdown", 10, 10));
		dom.window.dispatchEvent(pointerEvent("pointermove", 110, 90));
		dom.window.dispatchEvent(pointerEvent("pointerup", 110, 90));
		await vue.nextTick();
		assert.equal(banner.style.transform, "translate(calc(-50% + 0px), 0px)");

		banner.dispatchEvent(pointerEvent("pointerdown", 100, 100));
		await vue.nextTick();
		assert.equal(banner.classList.contains("is-dragging"), true);
		dom.window.dispatchEvent(pointerEvent("pointermove", 220, 180));
		dom.window.dispatchEvent(pointerEvent("pointerup", 220, 180));
		await vue.nextTick();

		assert.equal(banner.classList.contains("is-dragging"), false);
		assert.equal(banner.style.transform, "translate(calc(-50% + 60px), 40px)");
	} finally {
		firstView.close();
	}

	const secondState = new OpeningState();
	const secondView = createOpeningProgress(secondState, 4, parent);
	try {
		const banner = parent.querySelector(".llm-opening-progress") as HTMLElement;
		assert.equal(banner.style.transform, "translate(calc(-50% + 60px), 40px)");
	} finally {
		secondView.close();
		resetOpeningProgressOffset();
	}
});
