import { defineComponent, ref, computed, watch, nextTick, openBlock, createElementBlock, normalizeClass, createElementVNode, toDisplayString, createCommentVNode } from "vue";
import { renderLLMMarkdown } from "../../../../../llm/markdown-renderer.js";
import { formatDurationSec, formatCompactTokens } from "../timelineTypes.js";
const _hoisted_1 = { class: "thinking-title" };
const _hoisted_2 = {
  key: 0,
  class: "thinking-caret"
};
const _hoisted_3 = ["innerHTML"];
const _hoisted_4 = {
  key: 1,
  class: "thinking-placeholder"
};
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "LLMThinkingBlock",
  props: {
    thought: {},
    active: { type: Boolean },
    thinkingMs: {},
    thoughtTokens: {},
    defaultExpanded: { type: Boolean }
  },
  setup(__props) {
    const props = __props;
    const expanded = ref(Boolean(props.defaultExpanded));
    const bodyEl = ref(null);
    const shouldRender = computed(() => Boolean(props.active || props.thought.trim() || props.thinkingMs && props.thinkingMs > 0));
    const showBody = computed(() => Boolean(props.active || expanded.value && props.thought.trim()));
    const headerText = computed(() => {
      const timePart = props.thinkingMs && props.thinkingMs > 0 ? formatDurationSec(props.thinkingMs) : "";
      const tokenPart = props.thoughtTokens != null ? `↓ ${formatCompactTokens(props.thoughtTokens)} tokens` : "";
      const meta = [timePart, tokenPart].filter(Boolean).join(" · ");
      if (props.active) {
        return meta ? `思考中… (${meta})` : "思考中…";
      }
      if (!props.thought.trim()) {
        return meta ? `已思考 ${meta}（模型未公开思考文本）` : "已完成思考";
      }
      return meta ? `已思考 ${meta}` : "思考过程";
    });
    const renderedHtml = computed(() => {
      const text = props.thought.trim();
      if (!text) return "";
      return renderLLMMarkdown(text);
    });
    function toggleExpand() {
      if (props.active || !props.thought.trim()) return;
      expanded.value = !expanded.value;
    }
    watch(
      () => props.thought,
      async () => {
        if (!props.active) return;
        await nextTick();
        if (bodyEl.value) bodyEl.value.scrollTop = bodyEl.value.scrollHeight;
      }
    );
    return (_ctx, _cache) => {
      return shouldRender.value ? (openBlock(), createElementBlock("div", {
        key: 0,
        class: normalizeClass(["llm-thinking-block", { "is-active": __props.active, "is-expanded": expanded.value }])
      }, [
        createElementVNode("div", {
          class: normalizeClass(["thinking-header", { clickable: !__props.active && Boolean(__props.thought) }]),
          onClick: toggleExpand
        }, [
          createElementVNode("span", {
            class: normalizeClass(["thinking-glyph", { spinning: __props.active }])
          }, toDisplayString(__props.active ? "✻" : "∴"), 3),
          createElementVNode("span", _hoisted_1, toDisplayString(headerText.value), 1),
          !__props.active && __props.thought ? (openBlock(), createElementBlock("span", _hoisted_2, toDisplayString(expanded.value ? "▾" : "▸"), 1)) : createCommentVNode("", true)
        ], 2),
        showBody.value ? (openBlock(), createElementBlock("div", {
          key: 0,
          ref_key: "bodyEl",
          ref: bodyEl,
          class: "thinking-body"
        }, [
          renderedHtml.value ? (openBlock(), createElementBlock("div", {
            key: 0,
            class: "thinking-markdown",
            innerHTML: renderedHtml.value
          }, null, 8, _hoisted_3)) : (openBlock(), createElementBlock("div", _hoisted_4, "模型正在深度思考中…"))
        ], 512)) : createCommentVNode("", true)
      ], 2)) : createCommentVNode("", true);
    };
  }
});
export {
  _sfc_main as default
};
