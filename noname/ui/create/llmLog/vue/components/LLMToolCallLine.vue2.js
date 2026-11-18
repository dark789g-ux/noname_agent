import { defineComponent, computed, openBlock, createElementBlock, createElementVNode, normalizeClass, toDisplayString, createCommentVNode } from "vue";
import { formatToolCallSummary } from "../timelineTypes.js";
const _hoisted_1 = { class: "llm-tool-call-line" };
const _hoisted_2 = { class: "tool-main" };
const _hoisted_3 = { class: "tool-summary" };
const _hoisted_4 = {
  key: 0,
  class: "tool-badge badge-pending"
};
const _hoisted_5 = ["title"];
const _hoisted_6 = {
  key: 2,
  class: "tool-badge badge-ok"
};
const _hoisted_7 = {
  key: 0,
  class: "tool-reason"
};
const _hoisted_8 = { class: "reason-text" };
const _hoisted_9 = {
  key: 1,
  class: "tool-error-msg"
};
const _hoisted_10 = { class: "error-text" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "LLMToolCallLine",
  props: {
    name: {},
    args: {},
    reason: {},
    refLabels: {},
    result: {},
    error: {},
    pending: { type: Boolean }
  },
  setup(__props) {
    const props = __props;
    const summary = computed(() => formatToolCallSummary(props.name, props.args, props.refLabels));
    const resultLabel = computed(() => {
      if (props.result === void 0 || props.result === null) return "";
      if (typeof props.result === "object") {
        const rec = props.result;
        if (typeof rec.ok === "boolean") return rec.ok ? "已采纳" : "无效";
        if (typeof rec.bool === "boolean") return rec.bool ? "确认" : "取消";
      }
      return "已完成";
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", _hoisted_2, [
          createElementVNode("span", {
            class: normalizeClass(["tool-bullet", { pending: __props.pending, error: Boolean(__props.error) }])
          }, "●", 2),
          createElementVNode("span", _hoisted_3, toDisplayString(summary.value), 1),
          __props.pending ? (openBlock(), createElementBlock("span", _hoisted_4, "执行中")) : __props.error ? (openBlock(), createElementBlock("span", {
            key: 1,
            class: "tool-badge badge-error",
            title: __props.error
          }, "失败", 8, _hoisted_5)) : resultLabel.value ? (openBlock(), createElementBlock("span", _hoisted_6, toDisplayString(resultLabel.value), 1)) : createCommentVNode("", true)
        ]),
        __props.reason ? (openBlock(), createElementBlock("div", _hoisted_7, [
          _cache[0] || (_cache[0] = createElementVNode("span", { class: "reason-branch" }, "⎿", -1)),
          createElementVNode("span", _hoisted_8, toDisplayString(__props.reason), 1)
        ])) : createCommentVNode("", true),
        __props.error ? (openBlock(), createElementBlock("div", _hoisted_9, [
          _cache[1] || (_cache[1] = createElementVNode("span", { class: "reason-branch" }, "⎿", -1)),
          createElementVNode("span", _hoisted_10, toDisplayString(__props.error), 1)
        ])) : createCommentVNode("", true)
      ]);
    };
  }
});
export {
  _sfc_main as default
};
