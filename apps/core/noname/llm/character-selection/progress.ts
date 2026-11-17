import type { OpeningState } from "./state.js";

/** 轻量原生 DOM，不暂停引擎，不显示隐藏身份、候选或理由。 */
export function createOpeningProgress(state: OpeningState, total: number, parent: HTMLElement) {
	const root = document.createElement("div");
	root.className = "llm-opening-progress";
	root.style.cssText = "position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:1000;padding:10px 16px;background:rgba(20,20,25,.94);color:#eee;border:1px solid #888;border-radius:8px;font-size:14px;pointer-events:auto;max-width:90%;";
	const text = document.createElement("span");
	const button = document.createElement("button");
	button.textContent = "跳过剩余 LLM 选将";
	button.style.cssText = "margin-left:12px;padding:4px 8px;cursor:pointer;";
	button.addEventListener("click", () => {
		state.skip();
		update();
	});
	root.append(text, button);
	parent.appendChild(root);
	const started = Date.now();
	function update() {
		const waiting = [...state.active.keys()].map(seat => `${seat}号位`).join("、");
		text.textContent = `LLM 选将 ${state.completed}/${total} · ${Math.floor((Date.now() - started) / 1000)}秒${waiting ? ` · 等待 ${waiting}` : ""}${state.fallbacks ? ` · 回退 ${state.fallbacks}` : ""}${state.skipped ? " · 已跳过" : ""}`;
		button.disabled = state.skipped;
	}
	update();
	const timer = setInterval(update, 250);
	return {
		update,
		close() {
			clearInterval(timer);
			root.remove();
		},
	};
}
