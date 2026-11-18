import { defineComponent, ref, onMounted, openBlock, createElementBlock, createElementVNode } from "vue";
const _hoisted_1 = ["data-color"];
const _hoisted_2 = ["innerHTML"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "PlayerIdentityBadge",
  props: {
    state: {},
    onNodeReady: { type: Function }
  },
  setup(__props) {
    const props = __props;
    const identityRef = ref(null);
    onMounted(() => {
      if (identityRef.value) {
        props.onNodeReady("identity", identityRef.value);
      }
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        ref_key: "identityRef",
        ref: identityRef,
        class: "identity",
        "data-color": __props.state.identityColor || void 0
      }, [
        createElementVNode("div", {
          innerHTML: __props.state.identityText
        }, null, 8, _hoisted_2)
      ], 8, _hoisted_1);
    };
  }
});
export {
  _sfc_main as default
};
