import { isReactive } from "vue";
import type { SelectConfigData } from "./../../../../../../typings/type";

/**
 * doToggle —— 1:1 迁移旧版 clickToggle（index.js:39-53）。
 * 改造为数据驱动 + DOM 操作分叉：Vue reactive 路径下仅更新 config.init，
 * 非 reactive 路径下保留命令式 DOM 操作（与旧版一致）。
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
	// 兜底：为 Vue 路径补上游戏源 onclick 依赖的 this._link.config
	// @ts-expect-error _link 是运行时挂在节点上的自定义属性
	if (!nodeEl._link) nodeEl._link = { config };

	const currentOn = config.init === true;
	const newInit = !currentOn;
	// 数据层更新（两条路径都需要）
	config.init = newInit;

	const reactive = isReactive(config);
	// DOM 分叉：仅在非 reactive（createConfig）路径下操作 DOM
	if (!reactive) {
		nodeEl.classList.toggle("on");
	}

	if (config.onclick) {
		if (config.onclick.call(nodeEl, newInit) === false) {
			// 返回 false → 回滚数据层和 DOM
			config.init = currentOn;
			if (!reactive) {
				nodeEl.classList.toggle("on");
			}
		}
	}
	// 无条件调用 update
	if (config.update) {
		config.update();
	}
}

/**
 * doMenuItem —— 1:1 迁移旧版 clickMenuItem（index.js:124-138）。
 * 改造为数据驱动 + DOM 操作分叉：Vue reactive 路径下仅更新 config.init，
 * 非 reactive 路径下保留命令式 DOM 操作（与旧版一致）。
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
	// 兜底：为 Vue 路径补上游戏源 onclick 依赖的 this._link.config
	// @ts-expect-error _link 是运行时挂在节点上的自定义属性
	if (!nodeEl._link) nodeEl._link = { config };
	// @ts-expect-error _link 是运行时挂在节点上的自定义属性
	nodeEl._link.current = link;

	// 数据层更新
	const oldInit = config.init;
	config.init = link;

	const reactive = isReactive(config);
	// DOM 分叉：仅在非 reactive（createConfig）路径下操作 DOM
	let tmpName: string | undefined;
	if (!reactive) {
		// 旧版 node.lastChild 是 "choosing" div（显示当前选项文本）
		// @ts-expect-error lastChild 可能不是 HTMLElement，但旧版逻辑假设如此
		tmpName = nodeEl.lastChild.innerHTML;
		// @ts-expect-error lastChild 可能不是 HTMLElement
		nodeEl.lastChild.innerHTML = config.item[link];
	}

	if (config.onclick) {
		if (config.onclick.call(nodeEl, link, menuItemEl) === false) {
			// 返回 false → 回滚数据层和 DOM
			config.init = oldInit;
			if (!reactive && tmpName !== undefined) {
				// @ts-expect-error lastChild 可能不是 HTMLElement
				nodeEl.lastChild.innerHTML = tmpName;
			}
		}
	}
	// 无条件调用 update
	if (config.update) {
		config.update();
	}
}
