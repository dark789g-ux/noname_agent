import { defineComponent, reactive, computed, openBlock, createElementBlock, createElementVNode, Fragment, renderList, unref, toDisplayString, withDirectives, withModifiers, vModelSelect } from "vue";
import "../../../../../../../../noname.js";
import { readBackendsFromRawConfig, SEAT_NUMBERS, defaultSeatBackends } from "../../../../../../../llm/backends.js";
import { lib } from "../../../../../../../library/index.js";
import { game } from "../../../../../../../game/index.js";
import { ui } from "../../../../../../index.js";
const _hoisted_1 = { class: "llm-seat-panel" };
const _hoisted_2 = { class: "llm-seat-grid" };
const _hoisted_3 = { class: "llm-seat-label" };
const _hoisted_4 = ["onUpdate:modelValue"];
const _hoisted_5 = { value: "default" };
const _hoisted_6 = { value: "openai" };
const _hoisted_7 = { value: "agy" };
const _hoisted_8 = { value: "codex" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "LLMSeatAssignmentTable",
  props: {
    defaultBackend: {},
    backendLabels: {}
  },
  setup(__props) {
    const props = __props;
    const initial = readBackendsFromRawConfig(lib.config, document);
    const seatBackends = reactive({ ...initial.seatBackends });
    const defaultBackendLabel = computed(() => {
      if (props.defaultBackend === "local") return "本地规则 AI";
      if (props.defaultBackend === "agy") return props.backendLabels.agy;
      if (props.defaultBackend === "codex") return props.backendLabels.codex;
      return props.backendLabels.openai;
    });
    function saveSeatBackends() {
      const plain = {};
      for (const seat of SEAT_NUMBERS) {
        const key = String(seat);
        plain[key] = seatBackends[key] || "default";
      }
      game.saveConfig("llm_seat_backends", plain);
      ui?.updateLLMLogButtons?.();
    }
    function resetAllToDefault() {
      const defaults = defaultSeatBackends();
      for (const seat of SEAT_NUMBERS) {
        const key = String(seat);
        seatBackends[key] = defaults[key];
      }
      saveSeatBackends();
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", { class: "llm-seat-header" }, [
          _cache[2] || (_cache[2] = createElementVNode("div", { class: "llm-section-title" }, "按行动顺位分配 AI 后端", -1)),
          createElementVNode("button", {
            type: "button",
            class: "llm-reset-btn",
            onClick: resetAllToDefault
          }, " 全部重置为跟随默认 ")
        ]),
        _cache[4] || (_cache[4] = createElementVNode("div", { class: "llm-seat-note" }, " 按行动顺位（1号位 = 首家行动）生效；未开启「玩家角色接入 LLM」时，玩家本人座位保持手动操控。 ", -1)),
        createElementVNode("div", _hoisted_2, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(unref(SEAT_NUMBERS), (seat) => {
            return openBlock(), createElementBlock("div", {
              key: seat,
              class: "llm-seat-item"
            }, [
              createElementVNode("span", _hoisted_3, toDisplayString(seat) + "号位", 1),
              withDirectives(createElementVNode("select", {
                "onUpdate:modelValue": ($event) => seatBackends[String(seat)] = $event,
                class: "llm-seat-select",
                onChange: saveSeatBackends,
                onKeydown: _cache[0] || (_cache[0] = withModifiers(() => {
                }, ["stop"])),
                onKeyup: _cache[1] || (_cache[1] = withModifiers(() => {
                }, ["stop"]))
              }, [
                createElementVNode("option", _hoisted_5, "跟随默认（" + toDisplayString(defaultBackendLabel.value) + "）", 1),
                createElementVNode("option", _hoisted_6, "OpenAI API（" + toDisplayString(__props.backendLabels.openai) + "）", 1),
                createElementVNode("option", _hoisted_7, "agy CLI（" + toDisplayString(__props.backendLabels.agy) + "）", 1),
                createElementVNode("option", _hoisted_8, "codex CLI（" + toDisplayString(__props.backendLabels.codex) + "）", 1),
                _cache[3] || (_cache[3] = createElementVNode("option", { value: "local" }, "本地规则 AI", -1))
              ], 40, _hoisted_4), [
                [vModelSelect, seatBackends[String(seat)]]
              ])
            ]);
          }), 128))
        ])
      ]);
    };
  }
});
export {
  _sfc_main as default
};
