import type { menuData } from "../types";
import { createStartMenuData } from "./startMenuData";
import optionsMenuData from "./optionsMenuData";
import { createCardPackMenuData } from "./cardPackMenuData";
import { createCharacterPackMenuData } from "./characterPackMenuData";
import { createOtherMenuData } from "./otherMenuData";
import { createExtensionMenuData } from "./extensionMenuData";

/**
 * 阶段 0 占位 menuData。
 * 后续阶段（2-5）会为每个 tab 替换为真实数据。
 * 阶段 5："扩展"已替换为 extensionMenuData。
 */
const placeholderMenuData: menuData = {
	leftPaneData: [],
	getRightPane() {
		return [];
	},
	getDefaultActiveKey() {
		return null;
	},
	// TODO: 阶段 1 实现 NonameConfig 列表渲染后，此处无需提供 rightPaneComponent
	// rightPaneComponent: undefined,
};

/**
 * 非联机 tabs 名称列表
 */
const OFFLINE_TABS = ["开始", "选项", "武将", "卡牌", "扩展", "其它"] as const;

/**
 * 联机 tabs 名称列表
 */
const ONLINE_TABS = ["模式", "武将", "卡牌"] as const;

/** 开始/模式 tab 对应的 key（用于查找替换） */
const START_TAB_KEYS: Record<string, string> = {
	false: "开始",
	true: "模式",
};

const OPTIONS_TAB_KEY = "选项";

const CARD_TAB_KEY = "卡牌";

const CHARACTER_TAB_KEY = "武将";

const OTHER_TAB_KEY = "其它";

const EXTENSION_TAB_KEY = "扩展";

/**
 * 根据 connectMenu 获取 tab 名 → menuData 的 Map。
 *
 * 阶段 2A："开始" / "模式" 使用 createStartMenuData 工厂创建真实数据。
 * 阶段 2B："选项" 使用 optionsMenuData。
 * 阶段 3E："武将" 使用 createCharacterPackMenuData。
 * 阶段 3F："卡牌" 使用 createCardPackMenuData。
 * 阶段 4："其它" 使用 createOtherMenuData。
 * 阶段 5："扩展" 使用 createExtensionMenuData。
 * 其余 tab 仍使用 placeholderMenuData。
 */
export function getTabDataMap(connectMenu: boolean): Map<string, menuData> {
	const tabs = connectMenu ? ONLINE_TABS : OFFLINE_TABS;
	const startTabKey = START_TAB_KEYS[String(connectMenu)];
	const startMenuData = createStartMenuData(connectMenu);
	const characterPackMenuData = createCharacterPackMenuData(connectMenu);
	const cardPackMenuData = createCardPackMenuData(connectMenu);
	const otherMenuData = createOtherMenuData(connectMenu);
	const extensionMenuData = createExtensionMenuData(connectMenu);

	const map = new Map<string, menuData>();
	for (const tabName of tabs) {
		if (tabName === startTabKey) {
			map.set(tabName, startMenuData);
		} else if (tabName === OPTIONS_TAB_KEY) {
			map.set(tabName, optionsMenuData);
		} else if (tabName === CHARACTER_TAB_KEY) {
			map.set(tabName, characterPackMenuData);
		} else if (tabName === CARD_TAB_KEY) {
			map.set(tabName, cardPackMenuData);
	} else if (tabName === OTHER_TAB_KEY) {
				map.set(tabName, otherMenuData);
			} else if (tabName === EXTENSION_TAB_KEY) {
				map.set(tabName, extensionMenuData);
			} else {
				map.set(tabName, placeholderMenuData);
		}
	}
	return map;
}
