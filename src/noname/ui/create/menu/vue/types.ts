import type { Component } from "vue";

export interface LeftPaneItem {
	/** 显示名 */
	name: string | undefined;
	/** 数据标识，替代旧版 getAttribute("mode") */
	key: string;
	/** 附加属性（保留扩展能力，如 mode=favourite） */
	attrs?: Record<string, any>;
}

export interface RightPaneContext {
	/** 是否联机菜单 */
	connectMenu: boolean;
	/** 当前左栏选中项 */
	item: LeftPaneItem;
	/** 启动按钮元素引用（用于标记 glowing，对应旧版 startButton.classList.add("glowing")） */
	startButtonEl: HTMLElement | null;
}

/**
 * Vue 菜单新契约（解耦 DOM）。
 * 本接口与 apps/core/typings/type.d.ts 的全局 `declare interface menuData` 对应。
 */
export interface menuData {
	/** 左栏数据源（响应式，由组件持有） */
	leftPaneData: LeftPaneItem[];
	/**
	 * 可选的左栏数据 getter。
	 * 若提供，MenuView 优先使用此 getter 获取左栏数据（支持响应式更新，如 togglePack 后刷新 .off 状态）。
	 * 未提供时回退到静态 leftPaneData。
	 */
	getLeftPaneData?: () => LeftPaneItem[];
	/** 右栏要渲染的配置项列表（响应式）。旧版 initConfigs + rightPaneTemplate 的逻辑迁移到此 */
	getRightPane(ctx: RightPaneContext): SelectConfigData[];
	/** 获取默认选中项的 key（替代旧版 getDefaultActive 遍历 DOM）。返回 null 表示选第一个 */
	getDefaultActiveKey(connectMenu: boolean): string | null;
	/** 右栏使用哪个 Vue 组件渲染。未提供时默认用 NonameConfig 列表渲染；包类页面可返回专用组件 */
	rightPaneComponent?: Component;
}
