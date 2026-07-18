import { markRaw, ref, createApp } from "vue";
import { lib, game, get, _status, ui } from "noname";
import type { menuData, LeftPaneItem, RightPaneContext } from "../types";
import OtherPane from "../components/OtherPane.vue";
import { menuUpdates } from "../menuState";

// ---------------------------------------------------------------------------
// 帮助可见状态 —— 由 otherMenuData 持有，帮助/返回按钮切换
// 旧版 1041-1090：帮助项默认 display:none，点击"帮助"切换
// ---------------------------------------------------------------------------
const helpVisible = ref(false);

/**
 * 左栏刷新版本号 —— menuUpdates 回调中自增，
 * 迫使 getLeftPaneData 重算 _status.connectMode 等非响应式状态（旧版 405-418）
 */
const _version = ref(0);

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

		// 3.5 LLM 日志（开发者工具）
		items.push({
			name: "LLM 日志",
			key: "llm_log",
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
 * 获取左栏数据（支持响应式帮助切换、联机隐藏命令项）
 * MenuView 会过滤 attrs.hidden 的项
 */
function getLeftPaneData(): LeftPaneItem[] {
	// 触发 _version 依赖：menuUpdates 自增后重算 _status.connectMode 等非响应式状态
	void _version.value;
	const items = buildLeftPaneData();
	for (const item of items) {
		if (item.attrs?.type === "help") {
			// 帮助项：helpVisible 为 true 时显示，false 时隐藏
			item.attrs.hidden = !helpVisible.value;
		} else if (item.attrs?.type === "cmd") {
			// 命令项：联机模式下隐藏（旧版 405-418：menuUpdates 回调中加 .off 并切走 active，
			// 切走 active 由 MenuView watch currentLeftPaneData 兜底选中第一个可见项实现）
			item.attrs.hidden = !!_status.connectMode || helpVisible.value;
		} else if (item.key === "help_toggle") {
			// 帮助/返回按钮始终可见，不需要 hidden
			// 文案已在 buildLeftPaneData 构建时按 helpVisible.value 生成（"帮助"/"返回"）
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
// 外部 API 兼容性标注（现状）
//
// 1. ui.click.consoleMenu（旧 87-90）—— 已接入
//    - index.ts 经 menuBridge.setActiveTab + setActiveLeftItem("其它", "command") 切换
//
// 2. ui.commandnode（旧 403）—— 无消费方，不提供替代
//    - 旧版指向命令左栏按钮 DOM 节点；
//      全仓仅 ui/index.js:119 一处解构声明，无任何读取/调用方
//
// 3. ui.create.videoNode（旧 810, 889）—— 已接入
//    - VideoManager.vue 挂载后覆盖为 DOM 创建版本（含 lib.videos 维护）
//
// 4. ui.updateVideoMenu（旧 978-989）—— 已接入
//    - VideoManager.vue 中赋值，经 menuBridge.setActiveLeftItem("其它", "video") 切换
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

	// 注册 menuUpdates 回调：打开菜单时自增版本号，
	// 迫使 getLeftPaneData 重算 _status.connectMode（旧版 405-418 的 .off 切换）
	menuUpdates.push(() => {
		_version.value++;
	});

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
