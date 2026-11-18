import { defineComponent, ref, onMounted, watch, openBlock, createElementBlock, Fragment, createElementVNode, normalizeClass, createTextVNode, normalizeStyle, withDirectives, renderList, toDisplayString, vModelSelect, unref, createCommentVNode, withModifiers, vShow, createVNode } from "vue";
import "../../NonameToggle.vue.js";
import { PILE_SUIT_OPTIONS, PILE_NUMBER_OPTIONS, loadModeAddedCards, loadModeDefaultCards, getAddableCardOptions, setModeCardEnabled, addCardToModePile, removeAddedCardAt } from "./cardPileService.js";
import _sfc_main$1 from "../../NonameToggle.vue2.js";
const _hoisted_1 = {
  key: 0,
  class: "config toggle cardpilecfg cardpilecfgadd",
  style: { "white-space": "nowrap" }
};
const _hoisted_2 = ["value"];
const _hoisted_3 = ["value"];
const _hoisted_4 = ["value"];
const _hoisted_5 = ["onClick"];
const _hoisted_6 = ["onClick"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "CardPileEditor",
  props: {
    mode: {}
  },
  setup(__props) {
    const props = __props;
    const expanded = ref(false);
    const showAddPanel = ref(false);
    const addedCards = ref([]);
    const defaultCards = ref([]);
    const cardOptions = ref([]);
    const addName = ref("");
    const addSuit = ref(PILE_SUIT_OPTIONS[0].value);
    const addNumber = ref(PILE_NUMBER_OPTIONS[0]);
    function reloadPileLists() {
      addedCards.value = loadModeAddedCards(props.mode);
      defaultCards.value = loadModeDefaultCards(props.mode);
      if (!cardOptions.value.length) {
        cardOptions.value = getAddableCardOptions();
        if (cardOptions.value.length) addName.value = cardOptions.value[0][0];
      }
    }
    function toggleExpand() {
      expanded.value = !expanded.value;
      if (!expanded.value) showAddPanel.value = false;
    }
    function onToggleDefaultCard(item) {
      item.enabled = !item.enabled;
      setModeCardEnabled(props.mode, item.index, item.enabled);
    }
    function setAllDefaultEnabled(enabled) {
      for (const item of defaultCards.value) {
        if (item.enabled === enabled) continue;
        item.enabled = enabled;
        setModeCardEnabled(props.mode, item.index, enabled);
      }
    }
    function onAddCard() {
      if (!addName.value) return;
      const created = addCardToModePile(props.mode, [addSuit.value, addNumber.value, addName.value]);
      addedCards.value.unshift(created);
    }
    function onDeleteAddedCard(uiIndex) {
      const target = addedCards.value[uiIndex];
      if (!target) return;
      const backingList = loadModeAddedCards(props.mode);
      const backingIdx = backingList.findIndex((item) => item.card === target.card);
      if (backingIdx >= 0) {
        removeAddedCardAt(props.mode, backingIdx);
      }
      addedCards.value.splice(uiIndex, 1);
    }
    onMounted(reloadPileLists);
    watch(
      () => props.mode,
      () => {
        expanded.value = false;
        showAddPanel.value = false;
        reloadPileLists();
      }
    );
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock(Fragment, null, [
        createElementVNode("div", {
          class: normalizeClass(["config more pile", { on: expanded.value }]),
          onClick: toggleExpand
        }, [..._cache[6] || (_cache[6] = [
          createTextVNode(" 编辑牌堆 ", -1),
          createElementVNode("div", null, ">", -1)
        ])], 2),
        createElementVNode("div", {
          class: "config pointerspan cardpilecfg toggle",
          style: normalizeStyle({ display: expanded.value ? "" : "none", marginTop: "5px" })
        }, [
          createElementVNode("button", {
            onClick: _cache[0] || (_cache[0] = ($event) => showAddPanel.value = !showAddPanel.value)
          }, "添加卡牌"),
          createElementVNode("button", {
            style: { "margin-left": "5px" },
            onClick: _cache[1] || (_cache[1] = ($event) => setAllDefaultEnabled(false))
          }, "全部关闭"),
          createElementVNode("button", {
            style: { "margin-left": "5px" },
            onClick: _cache[2] || (_cache[2] = ($event) => setAllDefaultEnabled(true))
          }, "全部开启")
        ], 4),
        showAddPanel.value ? (openBlock(), createElementBlock("div", _hoisted_1, [
          withDirectives(createElementVNode("select", {
            "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => addName.value = $event),
            style: { "width": "75px", "margin-right": "2px", "margin-left": "-1px" }
          }, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(cardOptions.value, (opt) => {
              return openBlock(), createElementBlock("option", {
                key: opt[0],
                value: opt[0]
              }, toDisplayString(opt[1]), 9, _hoisted_2);
            }), 128))
          ], 512), [
            [vModelSelect, addName.value]
          ]),
          withDirectives(createElementVNode("select", {
            "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => addSuit.value = $event),
            style: { "width": "53px", "margin-right": "2px" }
          }, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(unref(PILE_SUIT_OPTIONS), (suit) => {
              return openBlock(), createElementBlock("option", {
                key: suit.value,
                value: suit.value
              }, toDisplayString(suit.label), 9, _hoisted_3);
            }), 128))
          ], 512), [
            [vModelSelect, addSuit.value]
          ]),
          withDirectives(createElementVNode("select", {
            "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => addNumber.value = $event),
            style: { "width": "43px", "margin-right": "2px" }
          }, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(unref(PILE_NUMBER_OPTIONS), (n) => {
              return openBlock(), createElementBlock("option", {
                key: n,
                value: n
              }, toDisplayString(n), 9, _hoisted_4);
            }), 128))
          ], 512), [
            [vModelSelect, addNumber.value]
          ]),
          createElementVNode("button", {
            style: { "width": "40px" },
            onClick: onAddCard
          }, "确定")
        ])) : createCommentVNode("", true),
        (openBlock(true), createElementBlock(Fragment, null, renderList(addedCards.value, (item, idx) => {
          return withDirectives((openBlock(), createElementBlock("div", {
            key: `added-${__props.mode}-${idx}`,
            class: "config toggle cardpilecfg"
          }, [
            createElementVNode("span", null, toDisplayString(item.label), 1),
            createElementVNode("span", {
              class: "cardpiledelete",
              onClick: withModifiers(($event) => onDeleteAddedCard(idx), ["stop"])
            }, "删除", 8, _hoisted_5)
          ])), [
            [vShow, expanded.value]
          ]);
        }), 128)),
        (openBlock(true), createElementBlock(Fragment, null, renderList(defaultCards.value, (item) => {
          return withDirectives((openBlock(), createElementBlock("div", {
            key: `default-${__props.mode}-${item.index}`,
            class: normalizeClass(["config toggle cardpilecfg", { on: item.enabled }]),
            type: "defaultcards",
            onClick: ($event) => onToggleDefaultCard(item)
          }, [
            createElementVNode("span", null, toDisplayString(item.label), 1),
            createVNode(_sfc_main$1)
          ], 10, _hoisted_6)), [
            [vShow, expanded.value]
          ]);
        }), 128))
      ], 64);
    };
  }
});
export {
  _sfc_main as default
};
