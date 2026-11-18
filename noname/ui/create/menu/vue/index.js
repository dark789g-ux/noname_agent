import { createApp } from "vue";
import "../../../../../noname.js";
import "./components/MenuView.vue.js";
import { menuBridge } from "./utils/menuBridge.js";
import { refreshCharacterPack } from "./data/characterPackMenuData.js";
import { refreshCardPack } from "./data/cardPackMenuData.js";
import { menuInits, menuUpdates } from "./menuState.js";
import { _status } from "../../../../status/index.js";
import { ui } from "../../../index.js";
import { game } from "../../../../game/index.js";
import { lib } from "../../../../library/index.js";
import _sfc_main from "./components/MenuView.vue2.js";
let menuContainer;
let popupContainer;
function clickContainer(container, connectMenu) {
  container.classList.add("hidden");
  menuBridge.clearOptionsMenuState?.();
  if (connectMenu) {
    if (_status.enteringroom) {
      _status.enteringroom = false;
    }
    if (_status.creatingroom) {
      _status.creatingroom = false;
    }
    ui.window.classList.remove("shortcutpaused");
  } else {
    game.resume2();
    if (game.onresume2) {
      game.onresume2();
    }
    ui.arena.classList.remove("menupaused");
    ui.historybar.classList.remove("menupaused");
    ui.window.classList.remove("touchinfohidden");
    ui.config2.classList.remove("pressdown2");
  }
}
const updateCharacterPackMenuFn = (packName) => refreshCharacterPack(packName);
const updateCardPackMenuFn = (packName) => refreshCardPack(packName, false);
const updateCardPackMenuConnectFn = (packName) => refreshCardPack(packName, true);
let menuInitsDone = false;
function menu(connectMenu = false) {
  let menuTimeout = null;
  if (!connectMenu && !game.syncMenu) {
    menuTimeout = setTimeout(() => lib.init.reset(), 1e3);
  }
  if (!menuInitsDone) {
    menuInitsDone = true;
    for (const init of menuInits) {
      init();
    }
  }
  const cacheMenuContainer = menuContainer = ui.create.div(
    ".menu-container.hidden",
    ui.window,
    () => {
      clickContainer(cacheMenuContainer, connectMenu);
    }
  );
  if (connectMenu) {
    cacheMenuContainer.classList.add("centermenu");
  }
  const cachePopupContainer = popupContainer = ui.create.div(
    ".popup-container.hidden",
    ui.window,
    function closeMenu() {
      if (cachePopupContainer.noclose) {
        cachePopupContainer.noclose = false;
        return;
      }
      cachePopupContainer.classList.add("hidden");
      if (typeof cachePopupContainer.onclose == "function") {
        cachePopupContainer.onclose();
      }
    }
  );
  const app = createApp(_sfc_main, { connectMenu });
  app.mount(cacheMenuContainer);
  if (!connectMenu) {
    ui.menuContainer = cacheMenuContainer;
    ui.click.configMenu = function() {
      ui.click.shortcut(false);
      if (cacheMenuContainer.classList.contains("hidden")) {
        ui.config2.classList.add("pressdown2");
        ui.arena.classList.add("menupaused");
        ui.historybar.classList.add("menupaused");
        ui.window.classList.add("touchinfohidden");
        cacheMenuContainer.classList.remove("hidden");
        for (let i = 0; i < menuUpdates.length; i++) {
          menuUpdates[i]();
        }
      } else {
        clickContainer(cacheMenuContainer, connectMenu);
      }
    };
  } else {
    ui.connectMenuContainer = cacheMenuContainer;
    ui.click.connectMenu = function() {
      if (cacheMenuContainer.classList.contains("hidden")) {
        ui.window.classList.add("shortcutpaused");
        cacheMenuContainer.classList.remove("hidden");
        for (let i = 0; i < menuUpdates.length; i++) {
          menuUpdates[i]();
        }
      } else {
        clickContainer(cacheMenuContainer, connectMenu);
      }
    };
  }
  menuBridge.closeMenu = () => clickContainer(cacheMenuContainer, connectMenu);
  ui.click.menuTab = function(tab) {
    menuBridge.setActiveTab?.(tab);
  };
  ui.click.extensionTab = function(name) {
    ui.click.menuTab("扩展");
    menuBridge.setActiveLeftItem?.("扩展", name);
  };
  ui.click.consoleMenu = function() {
    ui.click.menuTab("其它");
    menuBridge.setActiveLeftItem?.("其它", "command");
  };
  game.editExtension = (name) => {
    menuBridge.setActiveLeftItem?.("扩展", "extension_maker");
    if (menuBridge.openExtensionMaker) {
      menuBridge.openExtensionMaker(name);
    } else {
      menuBridge.pendingEditExtensionName = name;
    }
  };
  if (!ui.updateCharacterPackMenu.includes(updateCharacterPackMenuFn)) {
    ui.updateCharacterPackMenu.push(updateCharacterPackMenuFn);
  }
  const updateCardPackFn = connectMenu ? updateCardPackMenuConnectFn : updateCardPackMenuFn;
  if (!ui.updateCardPackMenu.includes(updateCardPackFn)) {
    ui.updateCardPackMenu.push(updateCardPackFn);
  }
  if (menuTimeout) {
    clearTimeout(menuTimeout);
    delete window.resetExtension;
    localStorage.removeItem(lib.configprefix + "disable_extension");
  }
}
export {
  menu,
  menuContainer,
  popupContainer
};
