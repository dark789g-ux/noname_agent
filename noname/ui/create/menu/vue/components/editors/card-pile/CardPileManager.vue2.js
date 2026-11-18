import { defineComponent, ref, onMounted, openBlock, createElementBlock, Fragment, createElementVNode, createTextVNode, withDirectives, renderList, toDisplayString, vModelSelect, withModifiers, unref, normalizeStyle, normalizeClass, vModelText, createCommentVNode } from "vue";
import "../../../../../../../../noname.js";
import { getAvailablePileOptions, getCustomPileKeys, resolveCurrentPileSelection, deleteNamedCustomPile, saveNamedCustomPile, ensureGlobalPileContainers } from "./cardPileService.js";
import { game } from "../../../../../../../game/index.js";
const _hoisted_1 = { class: "config toggle cardpilecfg nomarginleft" };
const _hoisted_2 = ["value"];
const _hoisted_3 = ["onClick"];
const _hoisted_4 = {
  key: 0,
  class: "config cardpileadd indent"
};
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "CardPileManager",
  setup(__props) {
    const showRestart = ref(false);
    const saveExpanded = ref(false);
    const saveName = ref("自定义牌堆");
    const pileOptions = ref([]);
    const customPileKeys = ref([]);
    const selectedPile = ref("默认牌堆");
    function syncOptionsAndKeys() {
      const options = getAvailablePileOptions();
      pileOptions.value = options;
      customPileKeys.value = getCustomPileKeys();
      selectedPile.value = resolveCurrentPileSelection(options);
    }
    function onSelectPile() {
      game.saveConfig("cardpilename", selectedPile.value, true);
      showRestart.value = true;
    }
    function onDeletePile(name) {
      deleteNamedCustomPile(name);
      syncOptionsAndKeys();
    }
    function onSavePile() {
      saveNamedCustomPile(saveName.value);
      syncOptionsAndKeys();
    }
    onMounted(() => {
      ensureGlobalPileContainers();
      syncOptionsAndKeys();
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock(Fragment, null, [
        createElementVNode("div", _hoisted_1, [
          _cache[4] || (_cache[4] = createTextVNode(" 选择牌堆 ", -1)),
          withDirectives(createElementVNode("select", {
            "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => selectedPile.value = $event),
            style: { "float": "right", "width": "100px" },
            onChange: onSelectPile
          }, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(pileOptions.value, (name) => {
              return openBlock(), createElementBlock("option", {
                key: name,
                value: name
              }, toDisplayString(name), 9, _hoisted_2);
            }), 128))
          ], 544), [
            [vModelSelect, selectedPile.value]
          ])
        ]),
        (openBlock(true), createElementBlock(Fragment, null, renderList(customPileKeys.value, (name) => {
          return openBlock(), createElementBlock("div", {
            key: name,
            class: "config toggle cardpilecfg nomarginleft"
          }, [
            createElementVNode("span", null, toDisplayString(name), 1),
            createElementVNode("span", {
              class: "cardpiledelete",
              onClick: withModifiers(($event) => onDeletePile(name), ["stop"])
            }, "删除", 8, _hoisted_3)
          ]);
        }), 128)),
        createElementVNode("div", {
          class: "config more",
          style: normalizeStyle({ display: showRestart.value ? "" : "none" }),
          onClick: _cache[1] || (_cache[1] = //@ts-ignore
          (...args) => unref(game).reload && unref(game).reload(...args))
        }, " 重新启动 ", 4),
        createElementVNode("div", {
          class: normalizeClass(["config more", { on: saveExpanded.value }]),
          onClick: _cache[2] || (_cache[2] = ($event) => saveExpanded.value = !saveExpanded.value)
        }, [..._cache[5] || (_cache[5] = [
          createTextVNode(" 保存当前牌堆 ", -1),
          createElementVNode("div", null, ">", -1)
        ])], 2),
        saveExpanded.value ? (openBlock(), createElementBlock("div", _hoisted_4, [
          _cache[6] || (_cache[6] = createTextVNode(" 名称：", -1)),
          withDirectives(createElementVNode("input", {
            "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => saveName.value = $event),
            type: "text",
            style: { "margin-right": "3px", "width": "120px" }
          }, null, 512), [
            [vModelText, saveName.value]
          ]),
          createElementVNode("button", { onClick: onSavePile }, "确定")
        ])) : createCommentVNode("", true)
      ], 64);
    };
  }
});
export {
  _sfc_main as default
};
