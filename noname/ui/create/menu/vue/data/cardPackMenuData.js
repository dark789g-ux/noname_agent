import { ref, markRaw } from "vue";
import "../../../../../../noname.js";
import { setUpdateActiveCard, menuUpdates } from "../menuState.js";
import "../components/CardPackPane.vue.js";
import _sfc_main from "../components/CardPackPane.vue2.js";
import { lib } from "../../../../../library/index.js";
import { game } from "../../../../../game/index.js";
let _leftPaneItems = [];
const _version = ref(0);
function triggerUpdate() {
  _version.value++;
}
function createCardPackMenuData(connectMenu) {
  setUpdateActiveCard(function(_node) {
  });
  _leftPaneItems = buildLeftPaneData(connectMenu);
  const defaultActiveKey = getDefaultActiveKey(_leftPaneItems, connectMenu);
  menuUpdates.push(() => {
    triggerUpdate();
  });
  return {
    leftPaneData: _leftPaneItems,
    getLeftPaneData() {
      void _version.value;
      return _leftPaneItems;
    },
    getRightPane(_ctx) {
      return [];
    },
    getDefaultActiveKey() {
      return defaultActiveKey;
    },
    rightPaneComponent: markRaw(_sfc_main)
  };
}
function buildLeftPaneData(connectMenu) {
  const items = [];
  if (!connectMenu && lib.config.show_ban_menu) {
    lib.cardPack.mode_banned = [];
    for (let i = 0; i < lib.config.all.mode.length; i++) {
      const banned = lib.config[lib.config.all.mode[i] + "_bannedcards"];
      if (banned) {
        for (let j = 0; j < banned.length; j++) {
          lib.cardPack.mode_banned.add(banned[j]);
        }
      }
    }
    items.push({
      name: lib.translate["mode_banned_card_config"] || "封禁卡牌",
      key: "mode_banned",
      attrs: { hidden: lib.cardPack.mode_banned.length === 0 }
    });
    delete lib.cardPack.mode_banned;
  }
  for (let i = 0; i < lib.config.all.cards.length; i++) {
    const packName = lib.config.all.cards[i];
    if (connectMenu && !lib.connectCardPack.includes(packName)) {
      continue;
    }
    items.push(createLeftPaneItem(packName));
  }
  if (!connectMenu) {
    Object.keys(lib.cardPack).forEach((key) => {
      if (!lib.config.all.cards.includes(key)) {
        items.push(createLeftPaneItem(key));
      }
    });
  }
  if (!connectMenu) {
    items.push({
      name: "牌堆",
      key: "cardpile"
    });
  }
  if (!connectMenu) {
    items.push(
      { name: "全部开启", key: "_batch_on", attrs: { action: true, onClick: () => batchToggleCardPacks("on") } },
      { name: "全部关闭", key: "_batch_off", attrs: { action: true, onClick: () => batchToggleCardPacks("off") } },
      { name: "恢复默认", key: "_batch_default", attrs: { action: true, onClick: () => batchToggleCardPacks("default") } }
    );
  }
  return items;
}
function createLeftPaneItem(mode) {
  const name = lib.translate[mode + "_card_config"] || mode;
  return { name, key: mode };
}
function getDefaultActiveKey(leftPaneData, _connectMenu) {
  const visible = leftPaneData.filter(
    (item) => !item.attrs || !item.attrs.hidden
  );
  if (visible.length === 0) return null;
  return visible[0].key;
}
function refreshCardPack(packName, connectMenu) {
  if (_leftPaneItems.some((item) => item.key === packName)) {
    return;
  }
  if (!lib.connectCardPack.includes(packName) && !lib.config.all.cards.includes(packName)) {
    if (!(connectMenu && ["mode_derivation", "mode_banned"].includes(packName))) {
      const newItem = {
        name: lib.translate[packName + "_card_config"] || packName,
        key: packName
      };
      const actionIndex = _leftPaneItems.findIndex((item) => item.attrs?.action);
      if (actionIndex === -1) {
        _leftPaneItems.push(newItem);
      } else {
        _leftPaneItems.splice(actionIndex, 0, newItem);
      }
    }
    if (connectMenu) {
      lib.connectCardPack.add(packName);
    }
    triggerUpdate();
  }
}
function batchToggleCardPacks(mode) {
  const all = lib.config.all.cards || [];
  if (mode === "on") {
    game.saveConfig("cards", all.slice());
  } else if (mode === "off") {
    game.saveConfig("cards", []);
  } else {
    game.saveConfig("cards", lib.config.defaultcards);
  }
  triggerUpdate();
}
export {
  batchToggleCardPacks,
  createCardPackMenuData,
  refreshCardPack
};
