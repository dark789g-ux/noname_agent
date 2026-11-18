import type { Directive, DirectiveBinding } from "vue";

interface BgElement extends HTMLElement {
	setBackground?: (name: string, type?: string) => void;
}

function applyBackground(el: BgElement, binding: DirectiveBinding<string | null | undefined>) {
	const name = binding.value;
	if (!name) {
		el.style.backgroundImage = "";
		return;
	}
	if (typeof el.setBackground === "function") {
		el.setBackground(name, binding.arg || undefined);
	}
}

/**
 * 封装引擎 `HTMLDivElement.prototype.setBackground(name, type)`，
 * 供声明式 `v-for` 元素通过 `v-char-bg:character="id"` 或 `v-char-bg="path"` 自动解析皮肤、`ext:` 与 `db:` 背景图。
 */
export const vCharBg: Directive<BgElement, string | null | undefined> = {
	mounted(el, binding) {
		applyBackground(el, binding);
	},
	updated(el, binding) {
		if (binding.value === binding.oldValue && binding.arg === undefined) return;
		applyBackground(el, binding);
	},
};
