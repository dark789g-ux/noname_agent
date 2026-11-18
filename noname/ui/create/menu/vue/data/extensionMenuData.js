import { ref, markRaw } from "vue";
import "../../../../../../noname.js";
import "../components/ExtensionPane.vue.js";
import { game } from "../../../../../game/index.js";
import { lib } from "../../../../../library/index.js";
import { get } from "../../../../../get/binding.js";
import _sfc_main from "../components/ExtensionPane.vue2.js";
const leftPaneItems = ref([]);
function togglePack(mode, bool, onswitch) {
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
  if (onswitch) onswitch(bool);
  leftPaneItems.value = buildLeftPaneData();
}
function buildExtensionConfigs(mode) {
  const configs = [];
  const menu = lib.extensionMenu[mode];
  if (!menu) return configs;
  for (const key in menu) {
    if (key === "game") continue;
    const cfg = get.copy(menu[key]);
    cfg._key = key;
    let j;
    if (mode.startsWith("extension_")) {
      j = mode + "_" + key;
    } else {
      j = mode + "_" + key + "_playpackconfig";
    }
    cfg._name = j;
    if (j in lib.config) {
      cfg.init = lib.config[j];
    } else {
      game.saveConfig(j, cfg.init);
    }
    if (key !== "enable" && !menu[key].onclick) {
      cfg.onclick = function(result) {
        const cfgSelf = this._link.config;
        game.saveConfig(cfgSelf._name, result);
      };
    }
    configs.push(cfg);
  }
  return configs;
}
function buildLeftPaneData() {
  const items = [];
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
    const displayName = i.startsWith("extension_") ? lib.translate[i] || i.slice(10) : lib.translate[`${i}_play_config`] || i;
    items.push({
      name: displayName,
      key: i,
      attrs: { mode: i }
    });
  }
  if ((lib.device || lib.db) && lib.config.show_extensionmaker !== false) {
    items.push({
      name: "制作扩展",
      key: "extension_maker",
      attrs: { mode: "create" }
    });
  }
  if (lib.device || lib.db) {
    items.push({
      name: "获取扩展",
      key: "extension_get",
      attrs: { mode: "get" }
    });
  }
  return items;
}
function getLeftPaneData() {
  if (leftPaneItems.value.length === 0) {
    leftPaneItems.value = buildLeftPaneData();
  }
  return leftPaneItems.value;
}
function createExtensionMenuData(connectMenu) {
  if (connectMenu) {
    return {
      leftPaneData: [],
      getRightPane() {
        return [];
      },
      getDefaultActiveKey(_connectMenu) {
        return null;
      }
    };
  }
  leftPaneItems.value = buildLeftPaneData();
  return {
    leftPaneData: leftPaneItems.value,
    getLeftPaneData,
    getRightPane(_ctx) {
      if (_ctx.item.key !== "extension_maker" && _ctx.item.key !== "extension_get") {
        return buildExtensionConfigs(_ctx.item.key);
      }
      return [];
    },
    getDefaultActiveKey(_connectMenu) {
      return null;
    },
    // 右栏专用组件：ExtensionPane 根据 item.key 分派子组件
    rightPaneComponent: markRaw(_sfc_main)
  };
}
export {
  buildExtensionConfigs,
  createExtensionMenuData,
  togglePack
};
