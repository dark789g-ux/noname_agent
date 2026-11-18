import { defineComponent, ref, watch, nextTick, openBlock, createElementBlock, createBlock, createVNode } from "vue";
import "../../../../../../noname.js";
import { createConfig } from "../utils/configBuilder.js";
import { buildExtensionConfigs, togglePack } from "../data/extensionMenuData.js";
import "./editors/extension/ExtensionMaker.vue.js";
import "./editors/extension/ExtensionGetter.vue.js";
import { lib } from "../../../../../library/index.js";
import _sfc_main$1 from "./editors/extension/ExtensionMaker.vue2.js";
import _sfc_main$2 from "./editors/extension/ExtensionGetter.vue2.js";
const _hoisted_1 = { class: "extension-pane" };
const _hoisted_2 = {
  key: 1,
  class: "extension-get"
};
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ExtensionPane",
  props: {
    ctx: {}
  },
  setup(__props) {
    const props = __props;
    const configContainer = ref(null);
    function renderConfigs() {
      if (!configContainer.value) return;
      const container = configContainer.value;
      container.innerHTML = "";
      const mode = props.ctx.item.key;
      const menu = lib.extensionMenu[mode];
      if (!menu) return;
      const configs = buildExtensionConfigs(mode);
      for (const cfg of configs) {
        if (cfg._key === "enable") {
          cfg.onclick = function(result) {
            togglePack(cfg._name, result, cfg.onswitch);
          };
        }
        const cfgnode = createConfig(cfg);
        container.appendChild(cfgnode);
      }
    }
    watch(
      () => props.ctx.item.key,
      () => {
        nextTick(() => {
          if (props.ctx.item.key !== "extension_maker" && props.ctx.item.key !== "extension_get") {
            renderConfigs();
          }
        });
      },
      { immediate: true }
    );
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        __props.ctx.item.key === "extension_maker" ? (openBlock(), createBlock(_sfc_main$1, { key: 0 })) : __props.ctx.item.key === "extension_get" ? (openBlock(), createElementBlock("div", _hoisted_2, [
          createVNode(_sfc_main$2)
        ])) : (openBlock(), createElementBlock("div", {
          key: 2,
          ref_key: "configContainer",
          ref: configContainer,
          class: "extension-config"
        }, null, 512))
      ]);
    };
  }
});
export {
  _sfc_main as default
};
