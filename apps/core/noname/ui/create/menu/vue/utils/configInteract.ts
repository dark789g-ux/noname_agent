import type { SelectConfigData } from "./../../../../../../typings/type";

/**
 * doToggle —— 1:1 迁移旧版 clickToggle（index.js:39-53）。
 *
 * @param nodeEl  .config DOM 节点
 * @param config  对应的 SelectConfigData
 */
export function doToggle(
	nodeEl: HTMLElement,
	config: SelectConfigData,
) {
	if (nodeEl.classList.contains("disabled")) {
		return;
	}
	nodeEl.classList.toggle("on");
	if (config.onclick) {
		if (config.onclick.call(nodeEl, nodeEl.classList.contains("on")) === false) {
			// 返回 false → 回滚
			nodeEl.classList.toggle("on");
		}
	}
	// 无条件调用 update
	if (config.update) {
		config.update();
	}
}

/**
 * doMenuItem —— 1:1 迁移旧版 clickMenuItem（index.js:124-138）。
 *
 * @param nodeEl     .config DOM 节点（即 menu._link 指向的节点）
 * @param menuItemEl 被点击的菜单项 DOM 节点（含 _link 属性）
 * @param config     对应的 SelectConfigData
 */
export function doMenuItem(
	nodeEl: HTMLElement,
	menuItemEl: HTMLElement,
	config: SelectConfigData,
) {
	// 旧版 this.parentNode._link → node；旧版 this.link（无下划线）为 bug，此处修正为 this._link
	// @ts-expect-error _link 是运行时挂在节点上的自定义属性
	let link = menuItemEl._link;
	// @ts-expect-error _link 是运行时挂在节点上的自定义属性
	nodeEl._link.current = link;

	// 旧版 node.lastChild 是 "choosing" div（显示当前选项文本）
	// @ts-expect-error lastChild 可能不是 HTMLElement，但旧版逻辑假设如此
	let tmpName = nodeEl.lastChild.innerHTML;
	// @ts-expect-error lastChild 可能不是 HTMLElement
	nodeEl.lastChild.innerHTML = config.item[link];

	if (config.onclick) {
		if (config.onclick.call(nodeEl, link, menuItemEl) === false) {
			// 返回 false → 回滚
			// @ts-expect-error lastChild 可能不是 HTMLElement
			nodeEl.lastChild.innerHTML = tmpName;
		}
	}
	// 无条件调用 update
	if (config.update) {
		config.update();
	}
}
