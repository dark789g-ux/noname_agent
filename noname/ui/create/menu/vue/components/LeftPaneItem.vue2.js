import { defineComponent, openBlock, createElementBlock, normalizeClass, toDisplayString } from "vue";
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "LeftPaneItem",
  props: {
    item: {},
    active: { type: Boolean },
    unselectable: { type: Boolean }
  },
  emits: ["click"],
  setup(__props) {
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        class: normalizeClass(["menubutton large", { active: __props.active, off: __props.item.attrs?.enabled === false, lefttext: __props.item.attrs?.action, unselectable: __props.unselectable }]),
        onClick: _cache[0] || (_cache[0] = ($event) => _ctx.$emit("click", __props.item))
      }, toDisplayString(__props.item.name), 3);
    };
  }
});
export {
  _sfc_main as default
};
