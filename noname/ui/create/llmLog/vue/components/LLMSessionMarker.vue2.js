import { defineComponent, openBlock, createElementBlock, normalizeClass, createElementVNode, toDisplayString } from "vue";
const _hoisted_1 = { class: "marker-pill" };
const _hoisted_2 = { class: "marker-icon" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "LLMSessionMarker",
  props: {
    marker: {}
  },
  setup(__props) {
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        class: normalizeClass(["llm-session-marker", `kind-${__props.marker.kind}`])
      }, [
        _cache[0] || (_cache[0] = createElementVNode("span", { class: "marker-line" }, null, -1)),
        createElementVNode("span", _hoisted_1, [
          createElementVNode("span", _hoisted_2, toDisplayString(__props.marker.icon), 1),
          createElementVNode("span", null, toDisplayString(__props.marker.label), 1)
        ]),
        _cache[1] || (_cache[1] = createElementVNode("span", { class: "marker-line" }, null, -1))
      ], 2);
    };
  }
});
export {
  _sfc_main as default
};
