import { defineComponent, ref, reactive, computed, openBlock, createElementBlock, createElementVNode, createTextVNode, toDisplayString, withDirectives, withModifiers, vModelText, createCommentVNode, vModelDynamic, unref, Fragment, renderList, vModelSelect } from "vue";
import "../../../../../../../../noname.js";
import { readBackendsFromRawConfig, resolveBackendDisplayName, DEFAULT_OPENAI_CONTEXT_SIZE } from "../../../../../../../llm/backends.js";
import { normalizeLLMText, llmURLProblem } from "../../../../../../../llm/config.js";
import { clampInt, THINKING_EFFORT_OPTIONS } from "./llmConfigShared.js";
import { lib } from "../../../../../../../library/index.js";
import { ui } from "../../../../../../index.js";
import { game } from "../../../../../../../game/index.js";
const _hoisted_1 = { class: "llm-openai-form" };
const _hoisted_2 = { class: "llm-field" };
const _hoisted_3 = { class: "llm-field-label" };
const _hoisted_4 = { class: "llm-field" };
const _hoisted_5 = {
  key: 0,
  class: "llm-field-error"
};
const _hoisted_6 = { class: "llm-field" };
const _hoisted_7 = { class: "llm-input-row" };
const _hoisted_8 = ["type"];
const _hoisted_9 = { class: "llm-field" };
const _hoisted_10 = { class: "llm-grid-3" };
const _hoisted_11 = { class: "llm-field" };
const _hoisted_12 = ["value"];
const _hoisted_13 = { class: "llm-field" };
const _hoisted_14 = { class: "llm-field" };
const _hoisted_15 = { class: "llm-field" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "LLMOpenAIBackendForm",
  emits: ["labels-change"],
  setup(__props, { emit: __emit }) {
    const emit = __emit;
    const initialExtra = readBackendsFromRawConfig(lib.config, document);
    const showApiKey = ref(false);
    const state = reactive({
      displayName: initialExtra.openaiDisplayName,
      url: normalizeLLMText(lib.config.llm_url, document),
      apikey: normalizeLLMText(lib.config.llm_apikey, document),
      model: normalizeLLMText(lib.config.llm_model, document),
      thinkingEffort: String(lib.config.llm_thinking_effort || "medium"),
      maxRetries: String(lib.config.llm_max_retries ?? "0"),
      timeoutSec: clampInt(lib.config.llm_timeout, 30, 1, 300),
      contextSize: initialExtra.openaiContextSize
    });
    const openaiPreviewName = computed(
      () => resolveBackendDisplayName("openai", {
        openaiDisplayName: state.displayName,
        model: state.model,
        url: state.url
      })
    );
    const urlWarning = computed(() => {
      const cleaned = normalizeLLMText(state.url, document);
      if (!cleaned) return "";
      return llmURLProblem(cleaned) || "";
    });
    function notifyLabelsChanged() {
      ui?.updateLLMLogButtons?.();
      emit("labels-change");
    }
    function saveText(key, raw, affectsLabel) {
      const cleaned = normalizeLLMText(raw, document);
      if (key === "llm_openai_display_name") state.displayName = cleaned;
      if (key === "llm_apikey") state.apikey = cleaned;
      if (key === "llm_model") state.model = cleaned;
      game.saveConfig(key, cleaned);
      if (affectsLabel) notifyLabelsChanged();
    }
    function handleUrlChange(commitClean) {
      const cleaned = normalizeLLMText(state.url, document);
      if (commitClean) state.url = cleaned;
      game.saveConfig("llm_url", cleaned);
      notifyLabelsChanged();
    }
    function commitTimeout() {
      state.timeoutSec = clampInt(state.timeoutSec, 30, 1, 300);
      game.saveConfig("llm_timeout", state.timeoutSec);
    }
    function commitContextSize() {
      state.contextSize = clampInt(state.contextSize, DEFAULT_OPENAI_CONTEXT_SIZE, 4096, 2e6);
      game.saveConfig("llm_context_size", state.contextSize);
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", _hoisted_2, [
          createElementVNode("label", _hoisted_3, [
            _cache[35] || (_cache[35] = createTextVNode(" 显示名称（留空自动识别，当前识别：", -1)),
            createElementVNode("strong", null, toDisplayString(openaiPreviewName.value), 1),
            _cache[36] || (_cache[36] = createTextVNode("） ", -1))
          ]),
          withDirectives(createElementVNode("input", {
            "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => state.displayName = $event),
            type: "text",
            class: "llm-input",
            placeholder: "留空按模型名提取，例如 deepseek、gpt",
            onInput: _cache[1] || (_cache[1] = ($event) => saveText("llm_openai_display_name", state.displayName, true)),
            onBlur: _cache[2] || (_cache[2] = ($event) => saveText("llm_openai_display_name", state.displayName, true)),
            onKeydown: _cache[3] || (_cache[3] = withModifiers(() => {
            }, ["stop"])),
            onKeyup: _cache[4] || (_cache[4] = withModifiers(() => {
            }, ["stop"]))
          }, null, 544), [
            [vModelText, state.displayName]
          ])
        ]),
        createElementVNode("div", _hoisted_4, [
          _cache[37] || (_cache[37] = createElementVNode("label", { class: "llm-field-label" }, "API 地址（baseURL，自动拼接 /chat/completions）", -1)),
          withDirectives(createElementVNode("input", {
            "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => state.url = $event),
            type: "text",
            class: "llm-input",
            placeholder: "https://api.deepseek.com 或 http://localhost:11434/v1",
            onInput: _cache[6] || (_cache[6] = ($event) => handleUrlChange(false)),
            onBlur: _cache[7] || (_cache[7] = ($event) => handleUrlChange(true)),
            onKeydown: _cache[8] || (_cache[8] = withModifiers(() => {
            }, ["stop"])),
            onKeyup: _cache[9] || (_cache[9] = withModifiers(() => {
            }, ["stop"]))
          }, null, 544), [
            [vModelText, state.url]
          ]),
          urlWarning.value ? (openBlock(), createElementBlock("div", _hoisted_5, toDisplayString(urlWarning.value), 1)) : createCommentVNode("", true)
        ]),
        createElementVNode("div", _hoisted_6, [
          _cache[38] || (_cache[38] = createElementVNode("label", { class: "llm-field-label" }, "API 密钥（仅存本地 IndexedDB）", -1)),
          createElementVNode("div", _hoisted_7, [
            withDirectives(createElementVNode("input", {
              "onUpdate:modelValue": _cache[10] || (_cache[10] = ($event) => state.apikey = $event),
              type: showApiKey.value ? "text" : "password",
              class: "llm-input",
              placeholder: "sk-...",
              autocomplete: "off",
              onBlur: _cache[11] || (_cache[11] = ($event) => saveText("llm_apikey", state.apikey, false)),
              onChange: _cache[12] || (_cache[12] = ($event) => saveText("llm_apikey", state.apikey, false)),
              onKeydown: _cache[13] || (_cache[13] = withModifiers(() => {
              }, ["stop"])),
              onKeyup: _cache[14] || (_cache[14] = withModifiers(() => {
              }, ["stop"]))
            }, null, 40, _hoisted_8), [
              [vModelDynamic, state.apikey]
            ]),
            createElementVNode("button", {
              type: "button",
              class: "llm-mini-btn",
              onClick: _cache[15] || (_cache[15] = ($event) => showApiKey.value = !showApiKey.value)
            }, toDisplayString(showApiKey.value ? "隐藏" : "显示"), 1)
          ])
        ]),
        createElementVNode("div", _hoisted_9, [
          _cache[39] || (_cache[39] = createElementVNode("label", { class: "llm-field-label" }, "模型名称", -1)),
          withDirectives(createElementVNode("input", {
            "onUpdate:modelValue": _cache[16] || (_cache[16] = ($event) => state.model = $event),
            type: "text",
            class: "llm-input",
            placeholder: "例如 deepseek-chat、gpt-4o-mini",
            onInput: _cache[17] || (_cache[17] = ($event) => saveText("llm_model", state.model, true)),
            onBlur: _cache[18] || (_cache[18] = ($event) => saveText("llm_model", state.model, true)),
            onKeydown: _cache[19] || (_cache[19] = withModifiers(() => {
            }, ["stop"])),
            onKeyup: _cache[20] || (_cache[20] = withModifiers(() => {
            }, ["stop"]))
          }, null, 544), [
            [vModelText, state.model]
          ])
        ]),
        createElementVNode("div", _hoisted_10, [
          createElementVNode("div", _hoisted_11, [
            _cache[40] || (_cache[40] = createElementVNode("label", { class: "llm-field-label" }, "思考深度", -1)),
            withDirectives(createElementVNode("select", {
              "onUpdate:modelValue": _cache[21] || (_cache[21] = ($event) => state.thinkingEffort = $event),
              class: "llm-select",
              onChange: _cache[22] || (_cache[22] = ($event) => unref(game).saveConfig("llm_thinking_effort", state.thinkingEffort)),
              onKeydown: _cache[23] || (_cache[23] = withModifiers(() => {
              }, ["stop"])),
              onKeyup: _cache[24] || (_cache[24] = withModifiers(() => {
              }, ["stop"]))
            }, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(unref(THINKING_EFFORT_OPTIONS), (opt) => {
                return openBlock(), createElementBlock("option", {
                  key: opt.value,
                  value: opt.value
                }, toDisplayString(opt.label), 9, _hoisted_12);
              }), 128))
            ], 544), [
              [vModelSelect, state.thinkingEffort]
            ])
          ]),
          createElementVNode("div", _hoisted_13, [
            _cache[42] || (_cache[42] = createElementVNode("label", { class: "llm-field-label" }, "最大重试次数", -1)),
            withDirectives(createElementVNode("select", {
              "onUpdate:modelValue": _cache[25] || (_cache[25] = ($event) => state.maxRetries = $event),
              class: "llm-select",
              onChange: _cache[26] || (_cache[26] = ($event) => unref(game).saveConfig("llm_max_retries", state.maxRetries)),
              onKeydown: _cache[27] || (_cache[27] = withModifiers(() => {
              }, ["stop"])),
              onKeyup: _cache[28] || (_cache[28] = withModifiers(() => {
              }, ["stop"]))
            }, [..._cache[41] || (_cache[41] = [
              createElementVNode("option", { value: "0" }, "0（不重试）", -1),
              createElementVNode("option", { value: "1" }, "1 次", -1),
              createElementVNode("option", { value: "2" }, "2 次", -1),
              createElementVNode("option", { value: "3" }, "3 次", -1)
            ])], 544), [
              [vModelSelect, state.maxRetries]
            ])
          ]),
          createElementVNode("div", _hoisted_14, [
            _cache[43] || (_cache[43] = createElementVNode("label", { class: "llm-field-label" }, "单轮超时（秒）", -1)),
            withDirectives(createElementVNode("input", {
              "onUpdate:modelValue": _cache[29] || (_cache[29] = ($event) => state.timeoutSec = $event),
              type: "number",
              min: "1",
              max: "300",
              class: "llm-input",
              onBlur: commitTimeout,
              onChange: commitTimeout,
              onKeydown: _cache[30] || (_cache[30] = withModifiers(() => {
              }, ["stop"])),
              onKeyup: _cache[31] || (_cache[31] = withModifiers(() => {
              }, ["stop"]))
            }, null, 544), [
              [
                vModelText,
                state.timeoutSec,
                void 0,
                { number: true }
              ]
            ])
          ]),
          createElementVNode("div", _hoisted_15, [
            _cache[44] || (_cache[44] = createElementVNode("label", { class: "llm-field-label" }, "上下文窗口（Tokens）", -1)),
            withDirectives(createElementVNode("input", {
              "onUpdate:modelValue": _cache[32] || (_cache[32] = ($event) => state.contextSize = $event),
              type: "number",
              min: "4096",
              max: "2000000",
              step: "1024",
              class: "llm-input",
              onBlur: commitContextSize,
              onChange: commitContextSize,
              onKeydown: _cache[33] || (_cache[33] = withModifiers(() => {
              }, ["stop"])),
              onKeyup: _cache[34] || (_cache[34] = withModifiers(() => {
              }, ["stop"]))
            }, null, 544), [
              [
                vModelText,
                state.contextSize,
                void 0,
                { number: true }
              ]
            ])
          ])
        ])
      ]);
    };
  }
});
export {
  _sfc_main as default
};
