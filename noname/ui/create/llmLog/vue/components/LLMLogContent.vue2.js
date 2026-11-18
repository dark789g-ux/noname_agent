import { defineComponent, ref, computed, nextTick, watch, onMounted, onBeforeUnmount, openBlock, createElementBlock, createElementVNode, toDisplayString, createCommentVNode, unref, normalizeClass } from "vue";
import { formatLLMLogValue, renderLLMMarkdown } from "../../../../../llm/markdown-renderer.js";
const _hoisted_1 = { class: "llm-log-content" };
const _hoisted_2 = { class: "llm-log-content-header" };
const _hoisted_3 = { class: "llm-log-content-label" };
const _hoisted_4 = { class: "llm-log-content-actions" };
const _hoisted_5 = ["aria-pressed"];
const _hoisted_6 = ["aria-controls", "aria-expanded"];
const _hoisted_7 = ["id"];
const _hoisted_8 = {
  key: 0,
  class: "llm-log-content-json"
};
const _hoisted_9 = ["innerHTML"];
let contentSequence = 0;
function nextContentId() {
  return `llm-log-content-${++contentSequence}`;
}
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "LLMLogContent",
  props: {
    value: {},
    mode: {},
    defaultExpanded: { type: Boolean },
    label: {}
  },
  setup(__props) {
    const props = __props;
    const PREVIEW_MAX_HEIGHT = 200;
    const contentId = nextContentId();
    const contentElement = ref(null);
    const expanded = ref(props.defaultExpanded);
    const showSource = ref(false);
    const isOverflowing = ref(false);
    let resizeObserver;
    const isMarkdown = computed(() => props.mode === "auto" && typeof props.value === "string");
    const textValue = computed(() => isMarkdown.value ? props.value : formatLLMLogValue(props.value));
    const renderedMarkdown = computed(() => isMarkdown.value ? renderLLMMarkdown(textValue.value) : "");
    function measureOverflow() {
      const element = contentElement.value;
      if (!element) return;
      isOverflowing.value = element.scrollHeight > PREVIEW_MAX_HEIGHT;
    }
    async function resetState() {
      expanded.value = props.defaultExpanded;
      showSource.value = false;
      await nextTick();
      measureOverflow();
    }
    watch(() => [props.value, props.mode, props.defaultExpanded, props.label], () => void resetState(), { deep: false });
    watch(showSource, async () => {
      await nextTick();
      measureOverflow();
    });
    onMounted(async () => {
      resizeObserver = new ResizeObserver(measureOverflow);
      if (contentElement.value) resizeObserver.observe(contentElement.value);
      await nextTick();
      measureOverflow();
    });
    onBeforeUnmount(() => resizeObserver?.disconnect());
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("section", _hoisted_1, [
        createElementVNode("div", _hoisted_2, [
          createElementVNode("span", _hoisted_3, toDisplayString(__props.label), 1),
          createElementVNode("div", _hoisted_4, [
            isMarkdown.value ? (openBlock(), createElementBlock("button", {
              key: 0,
              type: "button",
              class: "llm-log-content-button",
              "aria-pressed": showSource.value,
              onClick: _cache[0] || (_cache[0] = ($event) => showSource.value = !showSource.value)
            }, " 原文 ", 8, _hoisted_5)) : createCommentVNode("", true),
            isOverflowing.value ? (openBlock(), createElementBlock("button", {
              key: 1,
              type: "button",
              class: "llm-log-content-button",
              "aria-controls": unref(contentId),
              "aria-expanded": expanded.value,
              onClick: _cache[1] || (_cache[1] = ($event) => expanded.value = !expanded.value)
            }, toDisplayString(expanded.value ? "收起" : "展开"), 9, _hoisted_6)) : createCommentVNode("", true)
          ])
        ]),
        createElementVNode("div", {
          id: unref(contentId),
          ref_key: "contentElement",
          ref: contentElement,
          class: normalizeClass(["llm-log-content-body", { "is-collapsed": isOverflowing.value && !expanded.value }])
        }, [
          showSource.value || !isMarkdown.value ? (openBlock(), createElementBlock("pre", _hoisted_8, toDisplayString(textValue.value), 1)) : (openBlock(), createElementBlock("div", {
            key: 1,
            class: "llm-log-markdown",
            innerHTML: renderedMarkdown.value
          }, null, 8, _hoisted_9))
        ], 10, _hoisted_7)
      ]);
    };
  }
});
export {
  _sfc_main as default
};
