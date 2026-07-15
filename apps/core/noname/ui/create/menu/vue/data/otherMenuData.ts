import { markRaw, ref, createApp } from "vue";
import { lib, game, get, _status, ui } from "noname";
import type { menuData, LeftPaneItem, RightPaneContext } from "../types";
import type { SelectConfigData } from "../../../../../../typings/type";
import OtherPane from "../components/OtherPane.vue";

// ---------------------------------------------------------------------------
// 帮助可见状态 —— 由 otherMenuData 持有，帮助/返回按钮切换
// 旧版 1041-1090：帮助项默认 display:none，点击"帮助"切换
// ---------------------------------------------------------------------------
const helpVisible = ref(false);

/**
 * 切换帮助可见状态
 * 对应旧版 1041-1090 的帮助/返回按钮 click
 */
export function toggleHelpVisible() {
	helpVisible.value = !helpVisible.value;
}

// ---------------------------------------------------------------------------
// 帮助页内容缓存（DOM 节点）
// 对应旧版 998-1038：遍历 lib.help 创建页面内容
// ---------------------------------------------------------------------------
const helpPageCache = new Map<string, HTMLElement>();

/**
 * 获取或创建帮助页内容 DOM 节点
 * 对应旧版 998-1038
 */
export function getHelpPageContent(name: string): HTMLElement {
	if (helpPageCache.has(name)) {
		return helpPageCache.get(name)!;
	}
	const content = lib.help[name];
	const page = document.createElement("div");
	page.classList.add("menu-help");

	if (typeof content == "object") {
		const contentObject = content as Record<string, any>;
		if (typeof contentObject.mount == "function") {
			contentObject.mount(page);
		} else if (typeof contentObject.data == "function" || typeof contentObject.setup == "function") {
			const component = createApp(contentObject);
			component.mount(page);
		} else {
			page.innerHTML = String(content);
		}
	} else {
		page.innerHTML = String(content);
	}

	helpPageCache.set(name, page);
	return page;
}

// ---------------------------------------------------------------------------
// 构建左栏数据
// 对应旧版 otherMenu.js 92-1090 的所有左栏按钮
// ---------------------------------------------------------------------------

/**
 * 构建左栏数据列表
 * 对应旧版 buildLeftPaneData（散布在各 IIFE 中）
 */
function buildLeftPaneData(): LeftPaneItem[] {
	const items: LeftPaneItem[] = [];

	// 1. 更新（旧 94）
	items.push({
		name: "更新",
		key: "update",
	});

	// 2. 控制（旧 246，type=cheat）
	items.push({
		name: "控制",
		key: "control",
		attrs: { type: "cheat" },
	});

	// 3. 命令（旧 402，type=cmd）
	items.push({
		name: "命令",
		key: "command",
		attrs: { type: "cmd" },
	});

	// 4. 内核（旧 705）
	items.push({
		name: "内核",
		key: "core",
	});

	// 5. 战绩（旧 765，type=rec）
	items.push({
		name: "战绩",
		key: "record",
		attrs: { type: "rec" },
	});

	// 6. 录像（旧 807，type=video，仅 indexedDB 可用时）
	if (window.indexedDB && !(window as any).nodb) {
		items.push({
			name: "录像",
			key: "video",
			attrs: { type: "video" },
		});
	}

	// 7. 帮助项（旧 998-1038：遍历 lib.help，默认隐藏）
	for (const name of Object.keys(lib.help)) {
		items.push({
			name: name,
			key: "help_" + name,
			attrs: { type: "help", helpName: name },
		});
	}

	// 8. 帮助/返回（旧 1041-1090）
	items.push({
		name: helpVisible.value ? "返回" : "帮助",
		key: "help_toggle",
		attrs: { onClick: toggleHelpVisible },
	});

	return items;
}

/**
 * 获取左栏数据（支持响应式帮助切换）
 * MenuView 会过滤 attrs.hidden 的项
 */
function getLeftPaneData(): LeftPaneItem[] {
	const items = buildLeftPaneData();
	for (const item of items) {
		if (item.attrs?.type === "help") {
			// 帮助项：helpVisible 为 true 时显示，false 时隐藏
			item.attrs.hidden = !helpVisible.value;
		} else if (item.key === "help_toggle") {
			// 帮助/返回按钮始终可见，不需要 hidden
			// 但文案需要根据 helpVisible 切换（由 OtherPane/组件内部处理）
		} else {
			// 非帮助项：helpVisible 为 true 时隐藏
			if (helpVisible.value) {
				item.attrs.hidden = true;
			} else {
				delete item.attrs?.hidden;
			}
		}
	}
	return items;
}

// ---------------------------------------------------------------------------
// 外部 API 兼容性标注
// TODO: 阶段 6 —— 以下外部 API 需要跨组件协调接入
//
// 1. ui.click.consoleMenu（旧 87-90）
//    - 需调用 menuTab("其它") + 切换到命令页
//    - menuTab 是 MenuView 的方法，需通过事件总线或全局状态触发
//
// 2. ui.commandnode（旧 403）
//    - 旧版指向命令左栏按钮 DOM 节点
//    - Vue 版用 ref 桥接或重新设计
//
// 3. ui.create.videoNode（旧 810, 889）
//    - 录像结束时添加录像节点
//    - Vue 版需通过 ref 桥接到 VideoManager 组件内部方法
//
// 4. ui.updateVideoMenu（旧 978-989）
//    - 录像结束后切换到录像 tab
//    - Vue 版需通过事件总线或全局状态触发
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// menuData 工厂
// 对应旧版 otherMenu.js export const otherMenu
// ---------------------------------------------------------------------------

/**
 * 创建「其它」页 menuData
 * @param connectMenu 联机时返回占位（联机无此页，旧版 8-10 行直接 return）
 */
export function createOtherMenuData(connectMenu: boolean): menuData {
	if (connectMenu) {
		// 联机模式：返回空占位（旧版直接 return 不创建任何内容）
		return {
			leftPaneData: [],
			getRightPane() {
				return [];
			},
				getDefaultActiveKey(_connectMenu: boolean) {
				return null;
			},
		};
	}

	return {
		leftPaneData: buildLeftPaneData(),
		getLeftPaneData,
		getRightPane(_ctx: RightPaneContext): SelectConfigData[] {
			// 右栏使用专用组件 OtherPane，不需要 NonameConfig 数据
			return [];
		},
		getDefaultActiveKey(_connectMenu: boolean): string | null {
			// 旧版 1093-1097：选第一个（默认"更新"页）
			return null;
		},
		// 右栏专用组件：OtherPane 根据 item.key 分派子组件
		rightPaneComponent: markRaw(OtherPane),
	};
}
