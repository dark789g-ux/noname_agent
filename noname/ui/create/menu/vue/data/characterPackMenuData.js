import { ref, markRaw } from "vue";
import "../../../../../../noname.js";
import "../components/CharacterPackPane.vue.js";
import { setUpdateActive, menuUpdates } from "../menuState.js";
import { menuBridge } from "../utils/menuBridge.js";
import { game } from "../../../../../game/index.js";
import { lib } from "../../../../../library/index.js";
import { get } from "../../../../../get/binding.js";
import _sfc_main from "../components/CharacterPackPane.vue2.js";
let _connectMenu = false;
function getConnectMenu() {
  return _connectMenu;
}
function togglePack(mode, bool) {
  if (mode.startsWith("mode_extension")) {
    const extName = mode.slice(15);
    if (!game.hasExtension(extName) || !game.hasExtensionLoaded(extName)) {
      return false;
    }
    game.saveExtensionConfig(extName, "characters_enable", bool);
  } else {
    if (_connectMenu) {
      if (!bool) {
        lib.config.connect_characters.add(mode);
      } else {
        lib.config.connect_characters.remove(mode);
      }
      game.saveConfig("connect_characters", lib.config.connect_characters);
    } else {
      if (bool) {
        lib.config.characters.add(mode);
      } else {
        lib.config.characters.remove(mode);
      }
      game.saveConfig("characters", lib.config.characters);
    }
  }
  triggerUpdate();
  return void 0;
}
const _version = ref(0);
function triggerUpdate() {
  _version.value++;
}
const favouriteVersion = ref(0);
function isPackEnabled(mode) {
  if (mode.startsWith("mode_")) {
    if (mode.startsWith("mode_extension")) {
      const extName = mode.slice(15);
      if (!game.hasExtension(extName) || !game.hasExtensionLoaded(extName)) {
        return false;
      }
      return lib.config[`extension_${extName}_characters_enable`] == true;
    }
    return true;
  }
  if (mode == "custom") {
    return true;
  }
  if (_connectMenu) {
    return !lib.config.connect_characters.includes(mode);
  } else {
    return lib.config.characters.includes(mode);
  }
}
function buildLeftPaneData(connectMenu) {
  let items = [];
  let keysSeen = /* @__PURE__ */ new Set();
  if (lib.config.show_favourite_menu && !connectMenu && Array.isArray(lib.config.favouriteCharacter)) {
    lib.characterPack.mode_favourite = {};
    for (let i = 0; i < lib.config.favouriteCharacter.length; i++) {
      let favname = lib.config.favouriteCharacter[i];
      if (lib.character[favname]) {
        lib.characterPack.mode_favourite[favname] = lib.character[favname];
      }
    }
    if (!get.is.empty(lib.characterPack.mode_favourite)) {
      items.push({
        name: lib.translate["mode_favourite_character_config"],
        key: "mode_favourite"
      });
      keysSeen.add("mode_favourite");
    }
    delete lib.characterPack.mode_favourite;
  }
  if (!connectMenu && lib.config.show_ban_menu) {
    lib.characterPack.mode_banned = {};
    for (let i = 0; i < lib.config.all.mode.length; i++) {
      let banned = lib.config[lib.config.all.mode[i] + "_banned"];
      if (banned) {
        for (let j = 0; j < banned.length; j++) {
          if (lib.character[banned[j]]) {
            lib.characterPack.mode_banned[banned[j]] = lib.character[banned[j]];
          }
        }
      }
    }
    if (!get.is.empty(lib.characterPack.mode_banned)) {
      items.push({
        name: lib.translate["mode_banned_character_config"],
        key: "mode_banned"
      });
      keysSeen.add("mode_banned");
    }
    delete lib.characterPack.mode_banned;
  }
  let characterlist = connectMenu ? lib.connectCharacterPack : lib.config.all.characters;
  for (let i = 0; i < characterlist.length; i++) {
    let mode = characterlist[i];
    if (keysSeen.has(mode)) continue;
    items.push({
      name: lib.translate[mode + "_character_config"] || mode,
      key: mode
    });
    keysSeen.add(mode);
  }
  if (!connectMenu) {
    Object.keys(lib.characterPack).forEach((key) => {
      if (!keysSeen.has(key)) {
        items.push({
          name: lib.translate[key + "_character_config"] || key,
          key
        });
        keysSeen.add(key);
      }
    });
  }
  if (!connectMenu) {
    items.push(
      { name: "全部开启", key: "_batch_on", attrs: { action: true, onClick: () => batchToggleCharacterPacks("on") } },
      { name: "全部关闭", key: "_batch_off", attrs: { action: true, onClick: () => batchToggleCharacterPacks("off") } },
      { name: "恢复默认", key: "_batch_default", attrs: { action: true, onClick: () => batchToggleCharacterPacks("default") } }
    );
  }
  return items;
}
let _leftPaneItems = [];
function getLeftPaneItems() {
  void _version.value;
  return _leftPaneItems.map((item) => {
    if (item.attrs?.action) {
      return item;
    }
    return {
      ...item,
      attrs: {
        enabled: isPackEnabled(item.key)
      }
    };
  });
}
function createCharacterPackMenuData(connectMenu) {
  _connectMenu = connectMenu;
  _leftPaneItems = buildLeftPaneData(connectMenu);
  setUpdateActive(() => {
  });
  menuUpdates.push(() => {
    triggerUpdate();
  });
  const data = {
    leftPaneData: _leftPaneItems,
    getLeftPaneData() {
      return getLeftPaneItems();
    },
    getRightPane(_ctx) {
      return [];
    },
    getDefaultActiveKey(_connectMenu2) {
      return null;
    },
    rightPaneComponent: markRaw(_sfc_main)
  };
  return data;
}
function refreshCharacterPack(packName) {
  if (_leftPaneItems.some((item) => item.key === packName)) {
    return;
  }
  if (!lib.connectCharacterPack.includes(packName) && !lib.config.all.characters.includes(packName)) {
    const newItem = {
      name: lib.translate[packName + "_character_config"] || packName,
      key: packName
    };
    const actionIndex = _leftPaneItems.findIndex((item) => item.attrs?.action);
    if (actionIndex === -1) {
      _leftPaneItems.push(newItem);
    } else {
      _leftPaneItems.splice(actionIndex, 0, newItem);
    }
    if (_connectMenu) {
      lib.connectCharacterPack.add(packName);
    }
    triggerUpdate();
  }
}
function refreshCharacterPackMenu() {
  const items = buildLeftPaneData(_connectMenu);
  _leftPaneItems.length = 0;
  _leftPaneItems.push(...items);
  triggerUpdate();
  favouriteVersion.value++;
}
menuBridge.refreshCharacterPackMenu = refreshCharacterPackMenu;
function batchToggleCharacterPacks(mode) {
  if (mode === "on") {
    game.saveConfig(
      "characters",
      Object.keys(lib.characterPack).filter((name) => {
        return !name.startsWith("mode_") || name.startsWith("mode_extension_") && lib.config.all.stockextension.includes(name.slice(15));
      })
    );
  } else if (mode === "off") {
    game.saveConfig("characters", []);
  } else {
    game.saveConfig("characters", lib.config.defaultcharacters);
  }
  triggerUpdate();
}
export {
  batchToggleCharacterPacks,
  createCharacterPackMenuData,
  favouriteVersion,
  getConnectMenu,
  getLeftPaneItems,
  refreshCharacterPack,
  togglePack
};
