import { defineComponent, ref, computed, nextTick, watch, onMounted, onUnmounted, openBlock, createElementBlock, withModifiers, normalizeStyle, normalizeClass, createElementVNode, Fragment, renderList, unref, toDisplayString, createBlock, resolveDynamicComponent, withDirectives, vShow } from "vue";
import "../../../../../../noname.js";
import { getTabDataMap } from "../data/tabRegistry.js";
import "./LeftPaneItem.vue.js";
import "./NonameConfig.vue.js";
import { menuBridge } from "../utils/menuBridge.js";
import { menuUpdates } from "../menuState.js";
import { lib } from "../../../../../library/index.js";
import { _status } from "../../../../../status/index.js";
import { game } from "../../../../../game/index.js";
import { get } from "../../../../../get/binding.js";
import { ui } from "../../../../index.js";
import _sfc_main$1 from "./LeftPaneItem.vue2.js";
import _sfc_main$2 from "./NonameConfig.vue2.js";
const _hoisted_1 = ["onClick"];
const _hoisted_2 = { class: "menu-content" };
const _hoisted_3 = { class: "left pane" };
const _hoisted_4 = { key: 1 };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "MenuView",
  props: {
    connectMenu: { type: Boolean }
  },
  setup(__props) {
    const props = __props;
    const tabDataMap = getTabDataMap(props.connectMenu);
    const tabNames = Array.from(tabDataMap.keys());
    const activeTab = ref(tabNames[0]);
    const activeLeftKey = ref("");
    const startButtonText = ref("启");
    const lockedModeKey = ref(null);
    const currentMenuData = computed(() => {
      return tabDataMap.get(activeTab.value);
    });
    const currentLeftPaneData = computed(() => {
      const data = currentMenuData.value;
      const items = data.getLeftPaneData ? data.getLeftPaneData() : data.leftPaneData;
      return items.filter((item) => !item.attrs?.hidden);
    });
    const rightPaneData = computed(() => {
      return currentMenuData.value.getRightPane(rightPaneCtx.value);
    });
    const rightPaneCtx = computed(() => {
      return {
        connectMenu: props.connectMenu,
        item: currentLeftPaneData.value.find((i) => i.key === activeLeftKey.value) || { name: "", key: "" },
        startButtonEl: startButtonRef.value ?? null
      };
    });
    const useCustomRightPane = computed(() => !!currentMenuData.value.rightPaneComponent);
    const tabBarStyle = ref("transform: translateX(0px)");
    const menuTabRef = ref();
    const startButtonRef = ref();
    const rightPaneRef = ref();
    const rootRef = ref();
    const savedDialogWidth = lib.config.menu_dialog_width;
    const savedDialogHeight = lib.config.menu_dialog_height;
    const rootStyle = computed(() => {
      const s = {};
      if (savedDialogWidth) {
        s["width"] = savedDialogWidth + "px";
        s["--menu-w"] = savedDialogWidth + "px";
      }
      if (savedDialogHeight) {
        s["height"] = savedDialogHeight + "px";
        s["--menu-h"] = savedDialogHeight + "px";
      }
      return s;
    });
    let resizeObserver = null;
    let resizeSaveTimer = null;
    function onTabClick(tabName) {
      if (activeTab.value === tabName) return;
      activeTab.value = tabName;
      activeLeftKey.value = "";
      const data = currentMenuData.value;
      const defaultKey = data.getDefaultActiveKey(props.connectMenu);
      nextTick(() => {
        selectDefaultLeftItem(defaultKey);
        updateTabBarStyle();
      });
    }
    function onLeftItemClick(item) {
      if (item.attrs?.onClick) {
        item.attrs.onClick();
        return;
      }
      if (isItemUnselectable(item)) {
        return;
      }
      activeLeftKey.value = item.key;
    }
    function isItemUnselectable(item) {
      return lockedModeKey.value !== null && activeTab.value === tabNames[0] && item.key !== lockedModeKey.value;
    }
    function updateWaitingForPlayer() {
      if (!props.connectMenu) {
        return;
      }
      if (_status.waitingForPlayer) {
        const mode = lib.configOL.mode;
        startButtonText.value = "设";
        lockedModeKey.value = mode;
        if (activeTab.value === tabNames[0]) {
          activeLeftKey.value = mode;
        }
      } else {
        startButtonText.value = "启";
        lockedModeKey.value = null;
      }
    }
    function onStartClick() {
      if (startButtonRef.value?.classList.contains("dim")) {
        return;
      }
      if (activeTab.value !== tabNames[0]) {
        return;
      }
      const mode = activeLeftKey.value;
      if (!mode) {
        return;
      }
      const status = _status;
      const libAny = lib;
      const gameAny = game;
      if (props.connectMenu) {
        if (status.waitingForPlayer) {
          const config = {};
          for (const i in libAny.mode[libAny.configOL.mode].connect) {
            if (i === "update") continue;
            config[i.slice(8)] = get.config(i, libAny.configOL.mode);
          }
          config.zhinang_tricks = libAny.config.connect_zhinang_tricks;
          if (gameAny.online) {
            if (gameAny.onlinezhu) {
              gameAny.send("changeRoomConfig", config);
            }
          } else {
            gameAny.broadcastAll(function(config2) {
              for (const i in config2) {
                libAny.configOL[i] = config2[i];
              }
            }, config);
            if (libAny.configOL.mode === "identity" && libAny.configOL.identity_mode === "zhong" && gameAny.connectPlayers) {
              for (let i = 0; i < gameAny.connectPlayers.length; i++) {
                gameAny.connectPlayers[i].classList.remove("unselectable2");
              }
              libAny.configOL.number = 8;
              gameAny.updateWaiting();
            }
            if (gameAny.onlineroom) {
              gameAny.send("server", "config", libAny.configOL);
            }
            gameAny.connectPlayers[0].chat("房间设置已更改");
          }
        } else if (status.enteringroom || status.creatingroom) {
          libAny.configOL.mode = mode;
          if (status.enteringroomserver) {
            game.saveConfig("connect_mode", mode);
            const config = {};
            for (const i in libAny.mode[libAny.configOL.mode].connect) {
              if (i === "update") continue;
              config[i.slice(8)] = get.config(i, libAny.configOL.mode);
            }
            config.zhinang_tricks = libAny.config.connect_zhinang_tricks;
            config.characterPack = libAny.connectCharacterPack.slice(0);
            config.cardPack = libAny.connectCardPack.slice(0);
            for (let i = 0; i < libAny.config.connect_characters.length; i++) {
              config.characterPack.remove(libAny.config.connect_characters[i]);
            }
            for (let i = 0; i < libAny.config.connect_cards.length; i++) {
              config.cardPack.remove(libAny.config.connect_cards[i]);
            }
            config.banned = libAny.config["connect_" + mode + "_banned"];
            config.bannedcards = libAny.config["connect_" + mode + "_bannedcards"];
            gameAny.send("server", "create", gameAny.onlineKey, get.connectNickname(), libAny.config.connect_avatar, config, mode);
          } else {
            gameAny.send("server", "create", gameAny.onlineKey, get.connectNickname(), libAny.config.connect_avatar);
          }
        } else {
          localStorage.setItem(lib.configprefix + "directstart", "true");
          game.saveConfig("directstartmode", mode);
          game.saveConfig("mode", "connect");
          ui.exitroom = ui.create.system(
            "退出房间",
            function() {
              game.saveConfig("directstartmode");
              game.reload();
            },
            true
          );
          game.switchMode(mode);
          game.requireSandboxOn();
        }
        menuBridge.closeMenu?.();
      } else {
        game.saveConfig("mode", mode);
        localStorage.setItem(lib.configprefix + "directstart", "true");
        game.reload();
      }
    }
    function selectDefaultLeftItem(defaultKey) {
      const items = currentLeftPaneData.value;
      if (items.length === 0) {
        activeLeftKey.value = "";
        return;
      }
      const match = defaultKey ? items.find((i) => i.key === defaultKey) : null;
      activeLeftKey.value = match ? match.key : items[0].key;
    }
    function updateTabBarStyle() {
      if (!menuTabRef.value) return;
      const active = menuTabRef.value.querySelector(".active");
      if (!active) return;
      const container = menuTabRef.value.parentElement;
      if (!container) return;
      const offset = active.getBoundingClientRect().left - container.getBoundingClientRect().left;
      tabBarStyle.value = `transform: translateX(${offset / get.menuZoom()}px)`;
    }
    watch(currentLeftPaneData, (items) => {
      if (items.length === 0) {
        activeLeftKey.value = "";
        return;
      }
      if (!items.some((i) => i.key === activeLeftKey.value)) {
        activeLeftKey.value = items[0].key;
      }
    });
    onMounted(() => {
      const data = currentMenuData.value;
      const defaultKey = data.getDefaultActiveKey(props.connectMenu);
      selectDefaultLeftItem(defaultKey);
      nextTick(() => {
        updateTabBarStyle();
        if (rightPaneRef.value) {
          lib.setScroll(rightPaneRef.value);
        }
      });
      menuBridge.setActiveTab = (tab) => {
        if (tabNames.includes(tab)) {
          onTabClick(tab);
        }
      };
      menuBridge.setActiveLeftItem = (tab, itemKey) => {
        if (tabNames.includes(tab)) {
          if (activeTab.value !== tab) {
            activeTab.value = tab;
            activeLeftKey.value = "";
          }
          nextTick(() => {
            const items = currentLeftPaneData.value;
            const match = items.find((i) => i.key === itemKey);
            if (match) {
              activeLeftKey.value = match.key;
            }
            updateTabBarStyle();
          });
        }
      };
      menuUpdates.push(updateWaitingForPlayer);
      updateWaitingForPlayer();
      if (rootRef.value) {
        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const width = Math.round(entry.contentRect.width);
            const height = Math.round(entry.contentRect.height);
            if (!rootRef.value) continue;
            rootRef.value.style.setProperty("--menu-w", width + "px");
            rootRef.value.style.setProperty("--menu-h", height + "px");
            if (resizeSaveTimer) clearTimeout(resizeSaveTimer);
            resizeSaveTimer = setTimeout(() => {
              game.saveConfig("menu_dialog_width", width);
              game.saveConfig("menu_dialog_height", height);
            }, 300);
          }
        });
        resizeObserver.observe(rootRef.value);
      }
    });
    onUnmounted(() => {
      menuBridge.setActiveTab = null;
      menuBridge.setActiveLeftItem = null;
      const idx = menuUpdates.indexOf(updateWaitingForPlayer);
      if (idx >= 0) {
        menuUpdates.splice(idx, 1);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (resizeSaveTimer) {
        clearTimeout(resizeSaveTimer);
        resizeSaveTimer = null;
      }
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        ref_key: "rootRef",
        ref: rootRef,
        class: normalizeClass(["main menu dialog popped static", { center: __props.connectMenu }]),
        style: normalizeStyle(rootStyle.value),
        onClick: _cache[0] || (_cache[0] = withModifiers(() => {
        }, ["stop"]))
      }, [
        createElementVNode("div", {
          class: "menu-tab",
          ref_key: "menuTabRef",
          ref: menuTabRef
        }, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(unref(tabNames), (tabName) => {
            return openBlock(), createElementBlock("div", {
              key: tabName,
              class: normalizeClass({ active: activeTab.value === tabName }),
              onClick: ($event) => onTabClick(tabName)
            }, toDisplayString(tabName), 11, _hoisted_1);
          }), 128))
        ], 512),
        createElementVNode("div", {
          class: "menu-tab-bar",
          style: normalizeStyle(tabBarStyle.value)
        }, null, 4),
        createElementVNode("div", _hoisted_2, [
          createElementVNode("div", null, [
            createElementVNode("div", _hoisted_3, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(currentLeftPaneData.value, (item) => {
                return openBlock(), createBlock(_sfc_main$1, {
                  key: item.key,
                  item,
                  active: activeLeftKey.value === item.key,
                  unselectable: isItemUnselectable(item),
                  onClick: onLeftItemClick
                }, null, 8, ["item", "active", "unselectable"]);
              }), 128))
            ]),
            createElementVNode("div", {
              class: "right pane",
              ref_key: "rightPaneRef",
              ref: rightPaneRef
            }, [
              useCustomRightPane.value && currentMenuData.value.rightPaneComponent ? (openBlock(), createBlock(resolveDynamicComponent(currentMenuData.value.rightPaneComponent), {
                key: 0,
                ctx: rightPaneCtx.value
              }, null, 8, ["ctx"])) : (openBlock(), createElementBlock("div", _hoisted_4, [
                (openBlock(true), createElementBlock(Fragment, null, renderList(rightPaneData.value, (cfg) => {
                  return openBlock(), createBlock(_sfc_main$2, {
                    key: cfg.name,
                    config: cfg
                  }, null, 8, ["config"]);
                }), 128))
              ]))
            ], 512),
            withDirectives(createElementVNode("div", {
              class: "menubutton round highlight",
              ref_key: "startButtonRef",
              ref: startButtonRef,
              onClick: onStartClick
            }, toDisplayString(startButtonText.value), 513), [
              [vShow, activeTab.value === unref(tabNames)[0]]
            ])
          ])
        ])
      ], 6);
    };
  }
});
export {
  _sfc_main as default
};
