import { defineComponent, openBlock, createElementBlock, createBlock, createCommentVNode } from "vue";
import "./editors/InfoPages.vue.js";
import "./editors/debug/CheatPanel.vue.js";
import "./editors/debug/CommandConsole.vue.js";
import "./editors/VideoManager.vue.js";
import LLMLogViewer from "./editors/llm/LLMLogViewer.vue.js";
import { menuBridge } from "../utils/menuBridge.js";
import _sfc_main$1 from "./editors/InfoPages.vue2.js";
import _sfc_main$2 from "./editors/debug/CheatPanel.vue2.js";
import _sfc_main$3 from "./editors/debug/CommandConsole.vue2.js";
import _sfc_main$4 from "./editors/VideoManager.vue2.js";
const _hoisted_1 = { class: "other-pane" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "OtherPane",
  props: {
    ctx: {}
  },
  setup(__props) {
    function onCheatExecuted() {
      menuBridge.closeMenu?.();
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        __props.ctx.item.key === "update" ? (openBlock(), createBlock(_sfc_main$1, {
          key: 0,
          "page-key": "update"
        })) : __props.ctx.item.key === "control" ? (openBlock(), createBlock(_sfc_main$2, {
          key: 1,
          onCheatExecuted
        })) : __props.ctx.item.key === "command" ? (openBlock(), createBlock(_sfc_main$3, { key: 2 })) : __props.ctx.item.key === "core" ? (openBlock(), createBlock(_sfc_main$1, {
          key: 3,
          "page-key": "core"
        })) : __props.ctx.item.key === "record" ? (openBlock(), createBlock(_sfc_main$1, {
          key: 4,
          "page-key": "record"
        })) : __props.ctx.item.key === "video" ? (openBlock(), createBlock(_sfc_main$4, { key: 5 })) : __props.ctx.item.key === "llm_log" ? (openBlock(), createBlock(LLMLogViewer, { key: 6 })) : __props.ctx.item.key?.startsWith("help_") && __props.ctx.item.key !== "help_toggle" ? (openBlock(), createBlock(_sfc_main$1, {
          key: 7,
          "page-key": "help",
          "help-name": __props.ctx.item.attrs?.helpName || ""
        }, null, 8, ["help-name"])) : createCommentVNode("", true)
      ]);
    };
  }
});
export {
  _sfc_main as default
};
