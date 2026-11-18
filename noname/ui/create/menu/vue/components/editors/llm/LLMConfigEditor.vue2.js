import { defineComponent, ref, reactive, openBlock, createElementBlock, createElementVNode, withKeys, withModifiers, normalizeClass, withDirectives, toDisplayString, vModelSelect, Fragment, renderList, vModelText, createVNode } from "vue";
import "../../../../../../../../noname.js";
import { readBackendsFromRawConfig } from "../../../../../../../llm/backends.js";
import { clampInt, readBackendLabels } from "./llmConfigShared.js";
import LLMBackendConfigForm from "./LLMBackendConfigForm.vue.js";
import LLMSeatAssignmentTable from "./LLMSeatAssignmentTable.vue.js";
import { lib } from "../../../../../../../library/index.js";
import { game } from "../../../../../../../game/index.js";
import { ui } from "../../../../../../index.js";
const _hoisted_1 = { class: "llm-cfg-root" };
const _hoisted_2 = { class: "llm-global-card" };
const _hoisted_3 = ["aria-checked", "onKeydown"];
const _hoisted_4 = ["aria-checked", "onKeydown"];
const _hoisted_5 = { class: "llm-budget-grid" };
const _hoisted_6 = { class: "llm-field" };
const _hoisted_7 = { value: "openai" };
const _hoisted_8 = { value: "agy" };
const _hoisted_9 = { value: "codex" };
const _hoisted_10 = { class: "llm-field" };
const _hoisted_11 = ["value"];
const _hoisted_12 = { class: "llm-field" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "LLMConfigEditor",
  setup(__props) {
    const turnOptions = [1, 2, 3, 4, 5, 6, 7, 8];
    const initialExtra = readBackendsFromRawConfig(lib.config, document);
    const enabled = ref(!!lib.config.llm_enabled);
    const controlSelf = ref(!!lib.config.llm_control_self);
    const defaultBackend = ref(initialExtra.defaultBackend);
    const maxTurns = ref(String(clampInt(lib.config.llm_max_turns, 4, 1, 8)));
    const decisionTimeoutSec = ref(clampInt(lib.config.llm_decision_timeout, 60, 10, 300));
    const backendLabels = reactive(readBackendLabels());
    function refreshLabels() {
      const next = readBackendLabels();
      backendLabels.openai = next.openai;
      backendLabels.agy = next.agy;
      backendLabels.codex = next.codex;
    }
    function toggleEnabled() {
      enabled.value = !enabled.value;
      game.saveConfig("llm_enabled", enabled.value);
      try {
        ui?.updateAIModeIndicator?.();
        ui?.updateLLMLogButtons?.();
      } catch {
      }
    }
    function toggleControlSelf() {
      controlSelf.value = !controlSelf.value;
      game.saveConfig("llm_control_self", controlSelf.value);
      try {
        ui?.updateLLMLogButtons?.();
      } catch {
      }
    }
    function saveDefaultBackend() {
      game.saveConfig("llm_default_backend", defaultBackend.value);
      try {
        ui?.updateLLMLogButtons?.();
      } catch {
      }
    }
    function saveMaxTurns() {
      const clamped = String(clampInt(maxTurns.value, 4, 1, 8));
      maxTurns.value = clamped;
      game.saveConfig("llm_max_turns", clamped);
    }
    function commitDecisionTimeout() {
      decisionTimeoutSec.value = clampInt(decisionTimeoutSec.value, 60, 10, 300);
      game.saveConfig("llm_decision_timeout", decisionTimeoutSec.value);
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", _hoisted_2, [
          _cache[17] || (_cache[17] = createElementVNode("div", { class: "llm-section-title" }, "全局开关与决策预算", -1)),
          createElementVNode("div", {
            class: "llm-switch-row",
            role: "switch",
            "aria-checked": enabled.value,
            tabindex: "0",
            onClick: toggleEnabled,
            onKeydown: withKeys(withModifiers(toggleEnabled, ["prevent"]), ["enter", "space"])
          }, [
            _cache[10] || (_cache[10] = createElementVNode("div", { class: "llm-switch-text" }, [
              createElementVNode("div", { class: "llm-switch-name" }, "启用 LLM AI 助手"),
              createElementVNode("div", { class: "llm-switch-desc" }, "启用后，AI 玩家由 LLM/CLI 接管决策；失败或超时自动回退本地规则 AI。")
            ], -1)),
            createElementVNode("span", {
              class: normalizeClass(["llm-switch-pill", { on: enabled.value }])
            }, [..._cache[9] || (_cache[9] = [
              createElementVNode("span", { class: "llm-switch-knob" }, null, -1)
            ])], 2)
          ], 40, _hoisted_3),
          createElementVNode("div", {
            class: "llm-switch-row",
            role: "switch",
            "aria-checked": controlSelf.value,
            tabindex: "0",
            onClick: toggleControlSelf,
            onKeydown: withKeys(withModifiers(toggleControlSelf, ["prevent"]), ["enter", "space"])
          }, [
            _cache[12] || (_cache[12] = createElementVNode("div", { class: "llm-switch-text" }, [
              createElementVNode("div", { class: "llm-switch-name" }, "玩家角色接入 LLM"),
              createElementVNode("div", { class: "llm-switch-desc" }, "需同时开启助手开关（下一局生效）；选将仍手动完成，进局后完全由 AI 操控。")
            ], -1)),
            createElementVNode("span", {
              class: normalizeClass(["llm-switch-pill", { on: controlSelf.value }])
            }, [..._cache[11] || (_cache[11] = [
              createElementVNode("span", { class: "llm-switch-knob" }, null, -1)
            ])], 2)
          ], 40, _hoisted_4),
          createElementVNode("div", _hoisted_5, [
            createElementVNode("div", _hoisted_6, [
              _cache[14] || (_cache[14] = createElementVNode("label", { class: "llm-field-label" }, "默认 AI 后端", -1)),
              withDirectives(createElementVNode("select", {
                "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => defaultBackend.value = $event),
                class: "llm-select",
                onChange: saveDefaultBackend,
                onKeydown: _cache[1] || (_cache[1] = withModifiers(() => {
                }, ["stop"])),
                onKeyup: _cache[2] || (_cache[2] = withModifiers(() => {
                }, ["stop"]))
              }, [
                createElementVNode("option", _hoisted_7, "OpenAI API（" + toDisplayString(backendLabels.openai) + "）", 1),
                createElementVNode("option", _hoisted_8, "agy CLI（" + toDisplayString(backendLabels.agy) + "）", 1),
                createElementVNode("option", _hoisted_9, "codex CLI（" + toDisplayString(backendLabels.codex) + "）", 1),
                _cache[13] || (_cache[13] = createElementVNode("option", { value: "local" }, "本地规则 AI", -1))
              ], 544), [
                [vModelSelect, defaultBackend.value]
              ])
            ]),
            createElementVNode("div", _hoisted_10, [
              _cache[15] || (_cache[15] = createElementVNode("label", { class: "llm-field-label" }, "最大决策轮次", -1)),
              withDirectives(createElementVNode("select", {
                "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => maxTurns.value = $event),
                class: "llm-select",
                onChange: saveMaxTurns,
                onKeydown: _cache[4] || (_cache[4] = withModifiers(() => {
                }, ["stop"])),
                onKeyup: _cache[5] || (_cache[5] = withModifiers(() => {
                }, ["stop"]))
              }, [
                (openBlock(), createElementBlock(Fragment, null, renderList(turnOptions, (n) => {
                  return createElementVNode("option", {
                    key: n,
                    value: String(n)
                  }, toDisplayString(n) + " 轮 ", 9, _hoisted_11);
                }), 64))
              ], 544), [
                [vModelSelect, maxTurns.value]
              ])
            ]),
            createElementVNode("div", _hoisted_12, [
              _cache[16] || (_cache[16] = createElementVNode("label", { class: "llm-field-label" }, "决策总超时（秒）", -1)),
              withDirectives(createElementVNode("input", {
                "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => decisionTimeoutSec.value = $event),
                type: "number",
                min: "10",
                max: "300",
                class: "llm-input",
                onBlur: commitDecisionTimeout,
                onChange: commitDecisionTimeout,
                onKeydown: _cache[7] || (_cache[7] = withModifiers(() => {
                }, ["stop"])),
                onKeyup: _cache[8] || (_cache[8] = withModifiers(() => {
                }, ["stop"]))
              }, null, 544), [
                [
                  vModelText,
                  decisionTimeoutSec.value,
                  void 0,
                  { number: true }
                ]
              ])
            ])
          ])
        ]),
        createVNode(LLMBackendConfigForm, { onLabelsChange: refreshLabels }),
        createVNode(LLMSeatAssignmentTable, {
          "default-backend": defaultBackend.value,
          "backend-labels": backendLabels
        }, null, 8, ["default-backend", "backend-labels"])
      ]);
    };
  }
});
export {
  _sfc_main as default
};
