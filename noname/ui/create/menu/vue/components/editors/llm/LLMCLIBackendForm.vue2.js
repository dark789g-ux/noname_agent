import { defineComponent, reactive, computed, openBlock, createElementBlock, createElementVNode, createTextVNode, toDisplayString, withDirectives, withModifiers, vModelText, normalizeClass, createCommentVNode, Fragment, renderList, vModelSelect, unref } from "vue";
import "../../../../../../../../noname.js";
import { readBackendsFromRawConfig, getCLIModelOptions, defaultCLISettings } from "../../../../../../../llm/backends.js";
import { clampInt, THINKING_EFFORT_OPTIONS } from "./llmConfigShared.js";
import { lib } from "../../../../../../../library/index.js";
import { game } from "../../../../../../../game/index.js";
import { ui } from "../../../../../../index.js";
const _hoisted_1 = { class: "llm-cli-form" };
const _hoisted_2 = { class: "llm-cli-notice" };
const _hoisted_3 = { class: "llm-grid-2" };
const _hoisted_4 = { class: "llm-field" };
const _hoisted_5 = ["placeholder"];
const _hoisted_6 = { class: "llm-field" };
const _hoisted_7 = ["placeholder"];
const _hoisted_8 = { class: "llm-field" };
const _hoisted_9 = ["value"];
const _hoisted_10 = ["value"];
const _hoisted_11 = {
  key: 0,
  class: "llm-field"
};
const _hoisted_12 = ["value"];
const _hoisted_13 = { class: "llm-field" };
const _hoisted_14 = {
  key: 0,
  class: "llm-field-hint"
};
const _hoisted_15 = { class: "llm-field" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "LLMCLIBackendForm",
  props: {
    provider: {}
  },
  emits: ["labels-change"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const initialExtra = readBackendsFromRawConfig(lib.config, document);
    const cliStates = reactive({
      agy: { ...initialExtra.agy },
      codex: { ...initialExtra.codex }
    });
    const current = computed(() => cliStates[props.provider]);
    const modelOptions = computed(() => getCLIModelOptions(props.provider));
    const hasCustomModel = computed(() => {
      const value = current.value.model.trim();
      return !!value && !modelOptions.value.includes(value);
    });
    function saveCliConfig(affectsLabel, ensureCommandFallback = false) {
      const target = props.provider;
      const src = cliStates[target];
      if (ensureCommandFallback && !src.command.trim()) {
        src.command = defaultCLISettings(target).command;
      }
      const plain = {
        displayName: src.displayName.trim(),
        command: src.command.trim() || defaultCLISettings(target).command,
        model: src.model.trim(),
        thinkingEffort: target === "agy" ? "default" : src.thinkingEffort,
        timeoutSec: clampInt(src.timeoutSec, 60, 5, 300),
        extraArgs: src.extraArgs.trim()
      };
      game.saveConfig(target === "agy" ? "llm_agy_config" : "llm_codex_config", plain);
      if (affectsLabel) {
        ui?.updateLLMLogButtons?.();
        emit("labels-change");
      }
    }
    function commitTimeout() {
      cliStates[props.provider].timeoutSec = clampInt(cliStates[props.provider].timeoutSec, 60, 5, 300);
      saveCliConfig(false);
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", _hoisted_2, [
          _cache[26] || (_cache[26] = createTextVNode(" 通过本地 ", -1)),
          _cache[27] || (_cache[27] = createElementVNode("code", null, "@noname/fs", -1)),
          _cache[28] || (_cache[28] = createTextVNode("（", -1)),
          _cache[29] || (_cache[29] = createElementVNode("code", null, "/_llm/cli", -1)),
          createTextVNode("）以隔离临时目录运行 " + toDisplayString(__props.provider) + " 子进程，不读取仓库项目指令；CLI 路径与登录态需提前在终端可用。 ", 1)
        ]),
        createElementVNode("div", _hoisted_3, [
          createElementVNode("div", _hoisted_4, [
            _cache[30] || (_cache[30] = createElementVNode("label", { class: "llm-field-label" }, "显示名称", -1)),
            withDirectives(createElementVNode("input", {
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => current.value.displayName = $event),
              type: "text",
              class: "llm-input",
              placeholder: __props.provider,
              onInput: _cache[1] || (_cache[1] = ($event) => saveCliConfig(true)),
              onBlur: _cache[2] || (_cache[2] = ($event) => saveCliConfig(true)),
              onKeydown: _cache[3] || (_cache[3] = withModifiers(() => {
              }, ["stop"])),
              onKeyup: _cache[4] || (_cache[4] = withModifiers(() => {
              }, ["stop"]))
            }, null, 40, _hoisted_5), [
              [vModelText, current.value.displayName]
            ])
          ]),
          createElementVNode("div", _hoisted_6, [
            _cache[31] || (_cache[31] = createElementVNode("label", { class: "llm-field-label" }, "可执行命令", -1)),
            withDirectives(createElementVNode("input", {
              "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => current.value.command = $event),
              type: "text",
              class: "llm-input",
              placeholder: __props.provider,
              onBlur: _cache[6] || (_cache[6] = ($event) => saveCliConfig(false, true)),
              onChange: _cache[7] || (_cache[7] = ($event) => saveCliConfig(false, true)),
              onKeydown: _cache[8] || (_cache[8] = withModifiers(() => {
              }, ["stop"])),
              onKeyup: _cache[9] || (_cache[9] = withModifiers(() => {
              }, ["stop"]))
            }, null, 40, _hoisted_7), [
              [vModelText, current.value.command]
            ])
          ])
        ]),
        createElementVNode("div", {
          class: normalizeClass(__props.provider === "agy" ? "llm-grid-2" : "llm-grid-3")
        }, [
          createElementVNode("div", _hoisted_8, [
            _cache[33] || (_cache[33] = createElementVNode("label", { class: "llm-field-label" }, "模型名称（可选）", -1)),
            withDirectives(createElementVNode("select", {
              "onUpdate:modelValue": _cache[10] || (_cache[10] = ($event) => current.value.model = $event),
              class: "llm-select",
              onChange: _cache[11] || (_cache[11] = ($event) => saveCliConfig(false)),
              onKeydown: _cache[12] || (_cache[12] = withModifiers(() => {
              }, ["stop"])),
              onKeyup: _cache[13] || (_cache[13] = withModifiers(() => {
              }, ["stop"]))
            }, [
              _cache[32] || (_cache[32] = createElementVNode("option", { value: "" }, "默认（使用 CLI 默认模型）", -1)),
              hasCustomModel.value ? (openBlock(), createElementBlock("option", {
                key: 0,
                value: current.value.model
              }, toDisplayString(current.value.model), 9, _hoisted_9)) : createCommentVNode("", true),
              (openBlock(true), createElementBlock(Fragment, null, renderList(modelOptions.value, (modelId) => {
                return openBlock(), createElementBlock("option", {
                  key: modelId,
                  value: modelId
                }, toDisplayString(modelId), 9, _hoisted_10);
              }), 128))
            ], 544), [
              [vModelSelect, current.value.model]
            ])
          ]),
          __props.provider === "codex" ? (openBlock(), createElementBlock("div", _hoisted_11, [
            _cache[35] || (_cache[35] = createElementVNode("label", { class: "llm-field-label" }, "思考深度", -1)),
            withDirectives(createElementVNode("select", {
              "onUpdate:modelValue": _cache[14] || (_cache[14] = ($event) => current.value.thinkingEffort = $event),
              class: "llm-select",
              onChange: _cache[15] || (_cache[15] = ($event) => saveCliConfig(false)),
              onKeydown: _cache[16] || (_cache[16] = withModifiers(() => {
              }, ["stop"])),
              onKeyup: _cache[17] || (_cache[17] = withModifiers(() => {
              }, ["stop"]))
            }, [
              _cache[34] || (_cache[34] = createElementVNode("option", { value: "default" }, "默认（CLI 自身设置）", -1)),
              (openBlock(true), createElementBlock(Fragment, null, renderList(unref(THINKING_EFFORT_OPTIONS), (opt) => {
                return openBlock(), createElementBlock("option", {
                  key: opt.value,
                  value: opt.value
                }, toDisplayString(opt.label) + "（" + toDisplayString(opt.value) + "） ", 9, _hoisted_12);
              }), 128))
            ], 544), [
              [vModelSelect, current.value.thinkingEffort]
            ])
          ])) : createCommentVNode("", true),
          createElementVNode("div", _hoisted_13, [
            _cache[36] || (_cache[36] = createElementVNode("label", { class: "llm-field-label" }, "单次调用超时（秒）", -1)),
            withDirectives(createElementVNode("input", {
              "onUpdate:modelValue": _cache[18] || (_cache[18] = ($event) => current.value.timeoutSec = $event),
              type: "number",
              min: "5",
              max: "300",
              class: "llm-input",
              onBlur: commitTimeout,
              onChange: commitTimeout,
              onKeydown: _cache[19] || (_cache[19] = withModifiers(() => {
              }, ["stop"])),
              onKeyup: _cache[20] || (_cache[20] = withModifiers(() => {
              }, ["stop"]))
            }, null, 544), [
              [
                vModelText,
                current.value.timeoutSec,
                void 0,
                { number: true }
              ]
            ])
          ])
        ], 2),
        __props.provider === "agy" ? (openBlock(), createElementBlock("div", _hoisted_14, [..._cache[37] || (_cache[37] = [
          createTextVNode(" 提示：", -1),
          createElementVNode("code", null, "agy", -1),
          createTextVNode(" 的模型 ID 已包含思考强度档位，请直接通过上方模型下拉框选择。 ", -1)
        ])])) : createCommentVNode("", true),
        createElementVNode("div", _hoisted_15, [
          _cache[38] || (_cache[38] = createElementVNode("label", { class: "llm-field-label" }, "附加 CLI 参数（可选）", -1)),
          withDirectives(createElementVNode("input", {
            "onUpdate:modelValue": _cache[21] || (_cache[21] = ($event) => current.value.extraArgs = $event),
            type: "text",
            class: "llm-input",
            placeholder: "例如 --sandbox read-only 或其他只读参数",
            onBlur: _cache[22] || (_cache[22] = ($event) => saveCliConfig(false)),
            onChange: _cache[23] || (_cache[23] = ($event) => saveCliConfig(false)),
            onKeydown: _cache[24] || (_cache[24] = withModifiers(() => {
            }, ["stop"])),
            onKeyup: _cache[25] || (_cache[25] = withModifiers(() => {
            }, ["stop"]))
          }, null, 544), [
            [vModelText, current.value.extraArgs]
          ])
        ])
      ]);
    };
  }
});
export {
  _sfc_main as default
};
