import { defineComponent, ref, onMounted, openBlock, createElementBlock, Fragment, createElementVNode, createVNode, normalizeClass, toDisplayString, renderList, normalizeStyle } from "vue";
import "../../../../../../noname.js";
import "./PlayerHpBar.vue.js";
import "./PlayerIdentityBadge.vue.js";
import "./PlayerLLMBadge.vue.js";
import "./PlayerMainSwitchBtn.vue.js";
import { ui } from "../../../../index.js";
import _sfc_main$1 from "./PlayerIdentityBadge.vue2.js";
import _sfc_main$2 from "./PlayerHpBar.vue2.js";
import _sfc_main$3 from "./PlayerLLMBadge.vue2.js";
import _sfc_main$4 from "./PlayerMainSwitchBtn.vue2.js";
const _hoisted_1 = ["data-nature", "innerHTML"];
const _hoisted_2 = ["innerHTML"];
const _hoisted_3 = ["data-condition"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "PlayerCard",
  props: {
    player: {},
    state: {},
    onNodeReady: { type: Function }
  },
  setup(__props) {
    const props = __props;
    const avatarRef = ref(null);
    const actionRef = ref(null);
    const avatar2Ref = ref(null);
    const turnedoverRef = ref(null);
    const framebgRef = ref(null);
    const introRef = ref(null);
    const nameRef = ref(null);
    const name2Ref = ref(null);
    const nameolRef = ref(null);
    const countRef = ref(null);
    const equipsRef = ref(null);
    const judgesRef = ref(null);
    const marksRef = ref(null);
    const chainRef = ref(null);
    onMounted(() => {
      const refs = [
        ["avatar", avatarRef.value],
        ["action", actionRef.value],
        ["avatar2", avatar2Ref.value],
        ["turnedover", turnedoverRef.value],
        ["framebg", framebgRef.value],
        ["intro", introRef.value],
        ["name", nameRef.value],
        ["name2", name2Ref.value],
        ["nameol", nameolRef.value],
        ["count", countRef.value],
        ["equips", equipsRef.value],
        ["judges", judgesRef.value],
        ["marks", marksRef.value],
        ["chain", chainRef.value]
      ];
      for (const [key, el] of refs) {
        if (el) {
          props.onNodeReady(key, el);
        }
      }
      if (avatarRef.value && ui?.click?.avatar) {
        avatarRef.value.addEventListener("click", ui.click.avatar);
      }
      if (avatar2Ref.value && ui?.click?.avatar2) {
        avatar2Ref.value.addEventListener("click", ui.click.avatar2);
      }
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock(Fragment, null, [
        createElementVNode("div", {
          ref_key: "avatarRef",
          ref: avatarRef,
          class: "avatar hidden"
        }, [
          createElementVNode("div", {
            ref_key: "actionRef",
            ref: actionRef,
            class: "action"
          }, null, 512)
        ], 512),
        createElementVNode("div", {
          ref_key: "avatar2Ref",
          ref: avatar2Ref,
          class: "avatar2 hidden"
        }, null, 512),
        createElementVNode("div", {
          ref_key: "turnedoverRef",
          ref: turnedoverRef,
          class: "turned"
        }, [..._cache[0] || (_cache[0] = [
          createElementVNode("div", null, "翻面", -1)
        ])], 512),
        createElementVNode("div", {
          ref_key: "framebgRef",
          ref: framebgRef,
          class: "framebg"
        }, null, 512),
        createElementVNode("div", {
          ref_key: "introRef",
          ref: introRef,
          class: "intro"
        }, null, 512),
        createVNode(_sfc_main$1, {
          state: __props.state,
          "on-node-ready": __props.onNodeReady
        }, null, 8, ["state", "on-node-ready"]),
        createVNode(_sfc_main$2, {
          state: __props.state,
          "on-node-ready": __props.onNodeReady
        }, null, 8, ["state", "on-node-ready"]),
        createElementVNode("div", {
          ref_key: "nameRef",
          ref: nameRef,
          class: normalizeClass(["name", { long: __props.state.nameLong }]),
          "data-nature": __props.state.nameNature || void 0,
          innerHTML: __props.state.nameHtml
        }, null, 10, _hoisted_1),
        createElementVNode("div", {
          ref_key: "name2Ref",
          ref: name2Ref,
          class: "name name2",
          innerHTML: __props.state.name2Html
        }, null, 8, _hoisted_2),
        createElementVNode("div", {
          ref_key: "nameolRef",
          ref: nameolRef,
          class: "nameol"
        }, null, 512),
        createElementVNode("div", {
          ref_key: "countRef",
          ref: countRef,
          class: "count hidden",
          "data-condition": __props.state.countCondition || void 0
        }, toDisplayString(__props.state.count), 9, _hoisted_3),
        createElementVNode("div", {
          ref_key: "equipsRef",
          ref: equipsRef,
          class: "equips hidden"
        }, null, 512),
        createElementVNode("div", {
          ref_key: "judgesRef",
          ref: judgesRef,
          class: "judges"
        }, null, 512),
        createElementVNode("div", {
          ref_key: "marksRef",
          ref: marksRef,
          class: "marks"
        }, null, 512),
        createElementVNode("div", {
          ref_key: "chainRef",
          ref: chainRef,
          class: "chain"
        }, [
          createElementVNode("div", null, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(__props.state.chainLength, (n) => {
              return openBlock(), createElementBlock("div", {
                key: n,
                class: "cardbg",
                style: normalizeStyle({ transform: `translateX(${(n - 1) * 5 - 5}px)` })
              }, null, 4);
            }), 128))
          ])
        ], 512),
        createVNode(_sfc_main$3, {
          player: __props.player,
          state: __props.state,
          "on-node-ready": __props.onNodeReady
        }, null, 8, ["player", "state", "on-node-ready"]),
        createVNode(_sfc_main$4, {
          player: __props.player,
          state: __props.state,
          "on-node-ready": __props.onNodeReady
        }, null, 8, ["player", "state", "on-node-ready"])
      ], 64);
    };
  }
});
export {
  _sfc_main as default
};
