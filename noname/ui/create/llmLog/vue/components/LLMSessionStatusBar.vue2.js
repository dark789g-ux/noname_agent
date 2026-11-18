import { defineComponent, computed, openBlock, createElementBlock, createElementVNode, toDisplayString, normalizeClass, normalizeStyle, createCommentVNode, createTextVNode, unref, Fragment } from "vue";
import { formatCompactTokens } from "../timelineTypes.js";
const _hoisted_1 = { class: "llm-session-status-bar" };
const _hoisted_2 = { class: "status-main" };
const _hoisted_3 = { class: "seat-name" };
const _hoisted_4 = { class: "seat-tag" };
const _hoisted_5 = { class: "backend-name" };
const _hoisted_6 = ["title"];
const _hoisted_7 = {
  key: 0,
  class: "status-context"
};
const _hoisted_8 = ["title"];
const _hoisted_9 = ["title"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "LLMSessionStatusBar",
  props: {
    status: {}
  },
  setup(__props) {
    const props = __props;
    const contextTooltip = computed(() => {
      if (props.status.contextUsed == null) return "";
      if (props.status.contextSize) {
        return `上下文占用 ${props.status.contextUsed} / ${props.status.contextSize} tokens`;
      }
      return `上下文 tokens: ${props.status.contextUsed}`;
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", _hoisted_2, [
          createElementVNode("span", _hoisted_3, toDisplayString(__props.status.playerName), 1),
          createElementVNode("span", _hoisted_4, "座位" + toDisplayString(__props.status.playerSeatNum), 1),
          _cache[0] || (_cache[0] = createElementVNode("span", { class: "sep" }, "·", -1)),
          createElementVNode("span", _hoisted_5, toDisplayString(__props.status.backendLabel), 1),
          _cache[1] || (_cache[1] = createElementVNode("span", { class: "sep" }, "·", -1)),
          createElementVNode("span", {
            class: "model-name",
            title: __props.status.model
          }, toDisplayString(__props.status.model), 9, _hoisted_6),
          createElementVNode("span", {
            class: normalizeClass(["mode-pill", { active: __props.status.modeText === "常驻会话", warn: __props.status.modeText === "已降级无状态" }])
          }, toDisplayString(__props.status.modeText), 3)
        ]),
        __props.status.contextUsed != null ? (openBlock(), createElementBlock("div", _hoisted_7, [
          __props.status.contextPercent != null ? (openBlock(), createElementBlock("div", {
            key: 0,
            class: "context-bar",
            title: contextTooltip.value
          }, [
            createElementVNode("div", {
              class: normalizeClass(["context-fill", { high: __props.status.contextPercent >= 75 }]),
              style: normalizeStyle({ width: `${__props.status.contextPercent}%` })
            }, null, 6)
          ], 8, _hoisted_8)) : createCommentVNode("", true),
          createElementVNode("span", {
            class: "context-text",
            title: contextTooltip.value
          }, [
            createTextVNode(toDisplayString(unref(formatCompactTokens)(__props.status.contextUsed)), 1),
            __props.status.contextSize ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
              createTextVNode("/" + toDisplayString(unref(formatCompactTokens)(__props.status.contextSize)) + " (" + toDisplayString(__props.status.contextPercent) + "%)", 1)
            ], 64)) : createCommentVNode("", true)
          ], 8, _hoisted_9)
        ])) : createCommentVNode("", true)
      ]);
    };
  }
});
export {
  _sfc_main as default
};
