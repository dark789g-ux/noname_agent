import { markRaw, ref } from "vue";
import { lib, game, get, ui } from "noname";
import type { menuData, LeftPaneItem, RightPaneContext } from "../types";
import type { SelectConfigData } from "../../../../../../typings/type";
import ExtensionPane from "../components/ExtensionPane.vue";

// ---------------------------------------------------------------------------
// 模块级状态：扩展左栏数据（用于 getLeftPaneData 响应式刷新）
// 对应旧版 updateNodes 刷新各扩展项的 .off 状态
// ---------------------------------------------------------------------------

const leftPaneItems = ref<LeftPaneItem[]>([]);

// ---------------------------------------------------------------------------
// togglePack —— 扩展开关逻辑（旧 88-109）
// 1:1 迁移，this._link.config._name → 闭包 mode
// ---------------------------------------------------------------------------

function togglePack(mode: string, bool: boolean, onswitch?: (result: boolean) => void) {
	if (mode.startsWith("extension_")) {
		game.saveConfig(mode, bool);
	} else {
		const name = mode.slice(0, mode.indexOf("_enable_playpackconfig"));
		if (bool) {
			lib.config.plays.add(name);
		} else {
			lib.config.plays.remove(name);
		}
		game.saveConfig("plays", lib.config.plays);
	}
	// 旧版 105-108：调用 onswitch 回调 + 刷新左栏（updateNodes）
	if (onswitch) onswitch(bool);
	leftPaneItems.value = buildLeftPaneData();
}

// ---------------------------------------------------------------------------
// buildExtensionConfigs —— 构建某个扩展的配置项列表（旧 111-156）
// 对应旧版 createModeConfig 函数
// ---------------------------------------------------------------------------

function buildExtensionConfigs(mode: string): SelectConfigData[] {
	const configs: SelectConfigData[] = [];
	const menu = lib.extensionMenu[mode];
	if (!menu) return configs;

	for (const key in menu) {
			if (key === "game") continue;
			const cfg = get.copy(menu[key]);
			(cfg as any)._key = key;
			let j: string;
		if (mode.startsWith("extension_")) {
			j = mode + "_" + key;
		} else {
			j = mode + "_" + key + "_playpackconfig";
		}
		(cfg as any)._name = j;
		if (j in lib.config) {
			(cfg as any).init = lib.config[j];
		} else {
			game.saveConfig(j, (cfg as any).init);
		}

		// onclick 由 ExtensionPane.renderConfigs 设置（enable 需要 togglePack + onswitch）
		// 非自定义 onclick 的项使用默认 saveConfig
		if (key !== "enable" && !menu[key].onclick) {
			(cfg as any).onclick = function (result: any) {
				const cfgSelf = this._link.config as any;
				game.saveConfig(cfgSelf._name, result);
			};
		}

		configs.push(cfg);
	}
	return configs;
}

// ---------------------------------------------------------------------------
// 构建左栏数据（旧 157-171 + 172-181 + 2362-2392）
// ---------------------------------------------------------------------------

function buildLeftPaneData(): LeftPaneItem[] {
	const items: LeftPaneItem[] = [];

	// 旧 157-171: 遍历 lib.extensionMenu 构建扩展配置项
	let extensionsInMenu = Object.keys(lib.extensionMenu);
	if (lib.config.extensionSort && Array.isArray(lib.config.extensionSort)) {
		extensionsInMenu.sort((a, b) => {
			return lib.config.extensionSort.indexOf(a) - lib.config.extensionSort.indexOf(b);
		});
	}
	for (const i of extensionsInMenu) {
		if (lib.config.all.stockextension.includes(i) && !lib.config.all.plays.includes(i)) {
			continue;
		}
		if (lib.config.hiddenPlayPack.includes(i)) {
			continue;
		}
		const displayName = i.startsWith("extension_")
			? (lib.translate[i] || i.slice(10))
			: lib.translate[`${i}_play_config`] || i;
		items.push({
			name: displayName,
			key: i,
			attrs: { mode: i },
		});
	}

	// 旧 172-181: "制作扩展"项（仅当 lib.device || lib.db 且 show_extensionmaker != false）
	if ((lib.device || lib.db) && lib.config.show_extensionmaker !== false) {
		items.push({
			name: "制作扩展",
			key: "extension_maker",
			attrs: { mode: "create" },
		});
	}

	// 旧 2362-2392: "获取扩展"项
	if (lib.device || lib.db) {
		items.push({
			name: "获取扩展",
			key: "extension_get",
			attrs: { mode: "get" },
		});
	}

	return items;
}

// ---------------------------------------------------------------------------
// getLeftPaneData —— 响应式获取左栏数据（支持 updateNodes 刷新）
// ---------------------------------------------------------------------------

function getLeftPaneData(): LeftPaneItem[] {
	if (leftPaneItems.value.length === 0) {
		leftPaneItems.value = buildLeftPaneData();
	}
	return leftPaneItems.value;
}

// ---------------------------------------------------------------------------
// 外部 API 兼容性标注
// TODO: 阶段 6 —— 以下外部 API 需要跨组件协调接入
//
// 1. ui.click.extensionTab(name)（旧 43-51）
//    - 需调用 menuTab("扩展") + 切换到指定扩展的左栏项
//    - menuTab 是 MenuView 的方法，需通过事件总线或全局状态触发
//
// 2. game.editExtension(name)（旧 182/259）
//    - 需要切换到 "制作扩展" 页面并加载指定扩展
//    - 由 ExtensionMaker 内部实现
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// menuData 工厂
// 对应旧版 exetensionMenu.js 整体（2704 行）
// ---------------------------------------------------------------------------

/**
 * 创建「扩展」页 menuData
 * @param connectMenu 联机时返回占位（联机无扩展管理）
 */
export function createExtensionMenuData(connectMenu: boolean): menuData {
	if (connectMenu) {
		// 联机模式：返回空占位
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

	// 构建左栏数据
	leftPaneItems.value = buildLeftPaneData();

	return {
		leftPaneData: leftPaneItems.value,
		getLeftPaneData,
		getRightPane(_ctx: RightPaneContext): SelectConfigData[] {
			// 右栏由 rightPaneComponent（ExtensionPane）渲染
			// 非 extension_maker 和 extension_get 的项可在此返回配置项
			if (_ctx.item.key !== "extension_maker" && _ctx.item.key !== "extension_get") {
				return buildExtensionConfigs(_ctx.item.key);
			}
			return [];
		},
		getDefaultActiveKey(_connectMenu: boolean): string | null {
			// 旧版 2694-2702：选第一个
			return null;
		},
		// 右栏专用组件：ExtensionPane 根据 item.key 分派子组件
		rightPaneComponent: markRaw(ExtensionPane),
	};
}

// ---------------------------------------------------------------------------
// 导出 togglePack 供 ExtensionPane 使用
// ---------------------------------------------------------------------------

export { togglePack, buildExtensionConfigs };
