import { defineComponent, ref, computed, openBlock, createElementBlock, createElementVNode, Fragment, renderList, unref, normalizeClass, toDisplayString, withDirectives, createVNode, vShow } from "vue";
import "../../../../../../../../noname.js";
import { readBackendsFromRawConfig } from "../../../../../../../llm/backends.js";
import { CLI_BACKEND_TABS } from "./llmConfigShared.js";
import LLMCLIBackendForm from "./LLMCLIBackendForm.vue.js";
import LLMOpenAIBackendForm from "./LLMOpenAIBackendForm.vue.js";
import { lib } from "../../../../../../../library/index.js";
const _hoisted_1 = { class: "llm-backend-panel" };
const _hoisted_2 = { class: "llm-backend-header" };
const _hoisted_3 = {
  class: "llm-tabs",
  role: "tablist",
  "aria-label": "AI 后端配置切换"
};
const _hoisted_4 = ["aria-selected", "onClick"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "LLMBackendConfigForm",
  emits: ["labels-change"],
  setup(__props, { emit: __emit }) {
    const emit = __emit;
    const initialExtra = readBackendsFromRawConfig(lib.config, document);
    const initialTab = initialExtra.defaultBackend === "agy" || initialExtra.defaultBackend === "codex" ? initialExtra.defaultBackend : "openai";
    const activeTab = ref(initialTab);
    const activeCliProvider = computed(() => activeTab.value === "codex" ? "codex" : "agy");
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", _hoisted_2, [
          _cache[2] || (_cache[2] = createElementVNode("div", { class: "llm-section-title" }, "后端详细配置", -1)),
          createElementVNode("div", _hoisted_3, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(unref(CLI_BACKEND_TABS), (tab) => {
              return openBlock(), createElementBlock("button", {
                key: tab.key,
                type: "button",
                role: "tab",
                class: normalizeClass(["llm-tab-btn", { active: activeTab.value === tab.key }]),
                "aria-selected": activeTab.value === tab.key,
                onClick: ($event) => activeTab.value = tab.key
              }, toDisplayString(tab.label), 11, _hoisted_4);
            }), 128))
          ])
        ]),
        withDirectives(createVNode(LLMOpenAIBackendForm, {
          onLabelsChange: _cache[0] || (_cache[0] = ($event) => emit("labels-change"))
        }, null, 512), [
          [vShow, activeTab.value === "openai"]
        ]),
        withDirectives(createVNode(LLMCLIBackendForm, {
          provider: activeCliProvider.value,
          onLabelsChange: _cache[1] || (_cache[1] = ($event) => emit("labels-change"))
        }, null, 8, ["provider"]), [
          [vShow, activeTab.value !== "openai"]
        ])
      ]);
    };
  }
});
export {
  _sfc_main as default
};
