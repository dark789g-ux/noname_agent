import { createApp, reactive } from "vue";
import OpeningProgress from "./OpeningProgress.vue";
import type { OpeningState } from "./state.js";

export interface OpeningProgressViewState {
	completed: number;
	total: number;
	elapsedSec: number;
	waitingText: string;
	fallbacks: number;
	skipped: boolean;
	offsetX: number;
	offsetY: number;
}

let savedOffset = { x: 0, y: 0 };

/** 重置选将进度浮窗的内存拖拽偏移（主要用于单测隔离）。 */
export function resetOpeningProgressOffset() {
	savedOffset = { x: 0, y: 0 };
}

/** 轻量 Vue 浮窗，不暂停引擎，不显示隐藏身份、候选或理由。 */
export function createOpeningProgress(state: OpeningState, total: number, parent: HTMLElement) {
	const host = document.createElement("div");
	host.style.display = "contents";
	parent.appendChild(host);

	const viewState = reactive<OpeningProgressViewState>({
		completed: state.completed,
		total,
		elapsedSec: 0,
		waitingText: "",
		fallbacks: state.fallbacks,
		skipped: state.skipped,
		offsetX: savedOffset.x,
		offsetY: savedOffset.y,
	});

	const started = Date.now();
	function update() {
		viewState.completed = state.completed;
		viewState.total = total;
		viewState.elapsedSec = Math.floor((Date.now() - started) / 1000);
		viewState.waitingText = [...state.active.keys()].map(seat => `${seat}号位`).join("、");
		viewState.fallbacks = state.fallbacks;
		viewState.skipped = state.skipped;
	}
	update();

	const canMountVue = typeof document.createComment === "function" && typeof document.createTextNode === "function";
	const app = canMountVue
		? createApp(OpeningProgress, {
				state: viewState,
				onSkip() {
					state.skip();
					update();
				},
				"onUpdate:offset"(offset: { x: number; y: number }) {
					savedOffset = { x: offset.x, y: offset.y };
					viewState.offsetX = offset.x;
					viewState.offsetY = offset.y;
				},
			})
		: null;
	app?.mount(host);

	const timer = setInterval(update, 250);
	let closed = false;

	return {
		update,
		close() {
			if (closed) return;
			closed = true;
			clearInterval(timer);
			app?.unmount();
			host.remove();
		},
	};
}
