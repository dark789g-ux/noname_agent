import { createStartMenuData } from "./startMenuData.js";
import optionsMenuData from "./optionsMenuData.js";
import { createCardPackMenuData } from "./cardPackMenuData.js";
import { createCharacterPackMenuData } from "./characterPackMenuData.js";
import { createOtherMenuData } from "./otherMenuData.js";
import { createExtensionMenuData } from "./extensionMenuData.js";
const OFFLINE_TABS = ["开始", "选项", "武将", "卡牌", "扩展", "其它"];
const ONLINE_TABS = ["模式", "武将", "卡牌"];
const START_TAB_KEYS = {
  false: "开始",
  true: "模式"
};
const OPTIONS_TAB_KEY = "选项";
const CARD_TAB_KEY = "卡牌";
const CHARACTER_TAB_KEY = "武将";
const OTHER_TAB_KEY = "其它";
const EXTENSION_TAB_KEY = "扩展";
function getTabDataMap(connectMenu) {
  const tabs = connectMenu ? ONLINE_TABS : OFFLINE_TABS;
  const startTabKey = START_TAB_KEYS[String(connectMenu)];
  const startMenuData = createStartMenuData(connectMenu);
  const characterPackMenuData = createCharacterPackMenuData(connectMenu);
  const cardPackMenuData = createCardPackMenuData(connectMenu);
  const otherMenuData = createOtherMenuData(connectMenu);
  const extensionMenuData = createExtensionMenuData(connectMenu);
  const map = /* @__PURE__ */ new Map();
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
      throw new Error(`未知的菜单 tab 名：${String(tabName)}`);
    }
  }
  return map;
}
export {
  getTabDataMap
};
