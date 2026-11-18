import { ref, createApp, markRaw } from "vue";
import "../../../../../../noname.js";
import "../components/OtherPane.vue.js";
import { menuUpdates } from "../menuState.js";
import { lib } from "../../../../../library/index.js";
import { _status } from "../../../../../status/index.js";
import _sfc_main from "../components/OtherPane.vue2.js";
const helpVisible = ref(false);
const _version = ref(0);
function toggleHelpVisible() {
  helpVisible.value = !helpVisible.value;
}
const helpPageCache = /* @__PURE__ */ new Map();
function getHelpPageContent(name) {
  if (helpPageCache.has(name)) {
    return helpPageCache.get(name);
  }
  const content = lib.help[name];
  const page = document.createElement("div");
  page.classList.add("menu-help");
  if (typeof content == "object") {
    const contentObject = content;
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
function buildLeftPaneData() {
  const items = [];
  items.push({
    name: "更新",
    key: "update"
  });
  items.push({
    name: "控制",
    key: "control",
    attrs: { type: "cheat" }
  });
  items.push({
    name: "命令",
    key: "command",
    attrs: { type: "cmd" }
  });
  items.push({
    name: "LLM 日志",
    key: "llm_log"
  });
  items.push({
    name: "内核",
    key: "core"
  });
  items.push({
    name: "战绩",
    key: "record",
    attrs: { type: "rec" }
  });
  if (window.indexedDB && !window.nodb) {
    items.push({
      name: "录像",
      key: "video",
      attrs: { type: "video" }
    });
  }
  for (const name of Object.keys(lib.help)) {
    items.push({
      name,
      key: "help_" + name,
      attrs: { type: "help", helpName: name }
    });
  }
  items.push({
    name: helpVisible.value ? "返回" : "帮助",
    key: "help_toggle",
    attrs: { onClick: toggleHelpVisible }
  });
  return items;
}
function getLeftPaneData() {
  void _version.value;
  const items = buildLeftPaneData();
  for (const item of items) {
    if (item.attrs?.type === "help") {
      item.attrs.hidden = !helpVisible.value;
    } else if (item.attrs?.type === "cmd") {
      item.attrs.hidden = !!_status.connectMode || helpVisible.value;
    } else if (item.key === "help_toggle") {
    } else {
      if (helpVisible.value) {
        item.attrs.hidden = true;
      } else {
        delete item.attrs?.hidden;
      }
    }
  }
  return items;
}
function createOtherMenuData(connectMenu) {
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
  menuUpdates.push(() => {
    _version.value++;
  });
  return {
    leftPaneData: buildLeftPaneData(),
    getLeftPaneData,
    getRightPane(_ctx) {
      return [];
    },
    getDefaultActiveKey(_connectMenu) {
      return null;
    },
    // 右栏专用组件：OtherPane 根据 item.key 分派子组件
    rightPaneComponent: markRaw(_sfc_main)
  };
}
export {
  createOtherMenuData,
  getHelpPageContent,
  toggleHelpVisible
};
