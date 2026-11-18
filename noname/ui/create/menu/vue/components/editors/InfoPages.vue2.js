import { defineComponent, ref, computed, watch, onUnmounted, openBlock, createElementBlock, createElementVNode, toDisplayString, unref, Fragment, renderList, createCommentVNode } from "vue";
import "../../../../../../../noname.js";
import { getHelpPageContent } from "../../data/otherMenuData.js";
import { get } from "../../../../../../get/binding.js";
import { lib } from "../../../../../../library/index.js";
import { game } from "../../../../../../game/index.js";
const _hoisted_1 = {
  key: 0,
  class: "menu-help"
};
const _hoisted_2 = {
  key: 1,
  class: "menu-sym"
};
const _hoisted_3 = {
  class: "core-info",
  style: { "margin": "10px 0", "text-align": "left" }
};
const _hoisted_4 = {
  key: 2,
  style: { "padding-bottom": "10px" }
};
const _hoisted_5 = {
  class: "config indent",
  style: { "margin-bottom": "-5px" }
};
const _hoisted_6 = {
  class: "config indent",
  style: { "height": "auto" }
};
const _hoisted_7 = ["innerHTML"];
const _hoisted_8 = ["onClick"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "InfoPages",
  props: {
    pageKey: {},
    helpName: {}
  },
  setup(__props) {
    const props = __props;
    const helpContainerRef = ref();
    const recordItems = ref([]);
    const confirmTimers = /* @__PURE__ */ new Map();
    const coreInfoLines = computed(() => {
      if (props.pageKey !== "core") return [];
      const coreInfo = get.coreInfo();
      const lines = [
        `浏览器内核: ${coreInfo[0]}`,
        `浏览器版本: ${coreInfo[1]}.${coreInfo[2]}.${coreInfo[3]}`
      ];
      if (lib.device === "android") {
        lines.push("应用平台: 安卓");
        const bridge = window.NonameAndroidBridge;
        if (typeof bridge?.getPackageName === "function") {
          lines.push(`安卓应用包名: ${bridge.getPackageName()}`);
        }
        if (typeof bridge?.getPackageVersionCode === "function") {
          lines.push(`安卓应用版本: ${bridge.getPackageVersionCode()}`);
        }
        if (typeof window.device === "object") {
          const device = window.device;
          lines.push(
            `安卓版本: ${device.version}`,
            `安卓SDK版本: ${device.sdkVersion}`,
            `设备制造商: ${device.manufacturer}`
          );
        }
      } else if (lib.device === "ios") {
        lines.push("应用平台: 苹果");
      } else if (typeof window.require === "function" && typeof window.process === "object" && typeof window.__dirname === "string") {
        lines.push("应用平台: Electron", `Electron版本: ${window.process.versions.electron}`);
      }
      return lines;
    });
    function loadRecordItems() {
      const items = [];
      for (const mode of lib.config.all.mode) {
        const record = lib.config.gameRecord[mode];
        if (!record || !record.str) continue;
        items.push({
          mode,
          modeLabel: lib.translate[mode],
          recordHtml: record.str,
          confirming: false
        });
      }
      recordItems.value = items;
    }
    function clearConfirmTimer(mode) {
      const timer = confirmTimers.get(mode);
      if (timer !== void 0) {
        window.clearTimeout(timer);
        confirmTimers.delete(mode);
      }
    }
    function onResetRecordClick(idx) {
      const item = recordItems.value[idx];
      if (!item) return;
      if (!item.confirming) {
        item.confirming = true;
        clearConfirmTimer(item.mode);
        const timer = window.setTimeout(() => {
          item.confirming = false;
          confirmTimers.delete(item.mode);
        }, 1e3);
        confirmTimers.set(item.mode, timer);
        return;
      }
      clearConfirmTimer(item.mode);
      lib.config.gameRecord[item.mode] = { data: {} };
      game.saveConfig("gameRecord", lib.config.gameRecord);
      recordItems.value.splice(idx, 1);
    }
    function syncDynamicPageContent() {
      if (props.pageKey === "record") {
        loadRecordItems();
      }
      if (props.pageKey === "help" && helpContainerRef.value) {
        if (props.helpName) {
          helpContainerRef.value.replaceChildren(getHelpPageContent(props.helpName));
        } else {
          helpContainerRef.value.replaceChildren();
        }
      }
    }
    watch(
      () => [props.pageKey, props.helpName],
      syncDynamicPageContent,
      { immediate: true, flush: "post" }
    );
    onUnmounted(() => {
      for (const timer of confirmTimers.values()) {
        window.clearTimeout(timer);
      }
      confirmTimers.clear();
    });
    function openGithub() {
      window.open("https://github.com/libnoname/noname");
    }
    function changeWebview() {
      if (typeof window.NonameAndroidBridge?.changeWebviewProvider === "function") {
        window.NonameAndroidBridge.changeWebviewProvider();
      } else {
        alert("此客户端不支持此功能");
      }
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", null, [
        __props.pageKey === "update" ? (openBlock(), createElementBlock("div", _hoisted_1, [
          createElementVNode("ul", null, [
            createElementVNode("li", null, "游戏版本：" + toDisplayString(unref(lib).version), 1),
            _cache[0] || (_cache[0] = createElementVNode("li", null, " 由于无名杀正在重构项目结构，在线更新暂时无法使用，请访问github主页获取最新版本。 ", -1))
          ]),
          createElementVNode("p", { style: { "white-space": "nowrap", "margin-top": "8px" } }, [
            createElementVNode("button", { onClick: openGithub }, "访问项目主页")
          ])
        ])) : __props.pageKey === "core" ? (openBlock(), createElementBlock("div", _hoisted_2, [
          createElementVNode("div", _hoisted_3, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(coreInfoLines.value, (line, idx) => {
              return openBlock(), createElementBlock("div", { key: idx }, toDisplayString(line), 1);
            }), 128))
          ]),
          createElementVNode("button", {
            class: "changeWebviewProvider",
            onClick: changeWebview
          }, "点击切换WebView实现")
        ])) : __props.pageKey === "record" ? (openBlock(), createElementBlock("div", _hoisted_4, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(recordItems.value, (item, idx) => {
            return openBlock(), createElementBlock(Fragment, {
              key: item.mode
            }, [
              createElementVNode("div", _hoisted_5, toDisplayString(item.modeLabel), 1),
              createElementVNode("div", _hoisted_6, [
                createElementVNode("span", {
                  innerHTML: item.recordHtml
                }, null, 8, _hoisted_7),
                createElementVNode("span", {
                  class: "pointerdiv",
                  onClick: ($event) => onResetRecordClick(idx)
                }, toDisplayString(item.confirming ? "确定" : "重置"), 9, _hoisted_8)
              ])
            ], 64);
          }), 128))
        ])) : __props.pageKey === "help" ? (openBlock(), createElementBlock("div", {
          key: 3,
          ref_key: "helpContainerRef",
          ref: helpContainerRef,
          class: "menu-help"
        }, null, 512)) : createCommentVNode("", true)
      ]);
    };
  }
});
export {
  _sfc_main as default
};
