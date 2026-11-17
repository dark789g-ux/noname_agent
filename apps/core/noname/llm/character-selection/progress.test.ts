import assert from "node:assert/strict";
import test from "node:test";
import { OpeningState } from "./state.js";
import { createOpeningProgress } from "./progress.js";

test("进度面板显示座位和完成数，跳过只修改本轮状态并可清理", t => {
	const previous = globalThis.document;
	t.after(() => {
		globalThis.document = previous;
	});
	function node() {
		const listeners = new Map<string, () => void>();
		return {
			style: {},
			children: [] as any[],
			textContent: "",
			disabled: false,
			removed: false,
			append(...children: any[]) {
				this.children.push(...children);
			},
			addEventListener: (type: string, callback: () => void) => listeners.set(type, callback),
			click: () => listeners.get("click")?.(),
			remove() {
				this.removed = true;
			},
		};
	}
	globalThis.document = { createElement: node } as any;
	let root: ReturnType<typeof node>;
	const state = new OpeningState();
	state.completed = 1;
	state.active.set(3, new AbortController());
	const view = createOpeningProgress(state, 5, {
		appendChild(value: any) {
			root = value;
		},
	} as any);
	try {
		assert.match(root!.children[0].textContent, /1\/5/);
		assert.match(root!.children[0].textContent, /等待 3号位/);
		root!.children[1].click();
		assert.equal(state.skipped, true);
		assert.equal(state.active.get(3)!.signal.aborted, true);
		assert.equal(root!.children[1].disabled, true);
		assert.match(root!.children[0].textContent, /已跳过/);
	} finally {
		view.close();
	}
	assert.equal(root!.removed, true);
});
