import { defineComponent, ref, computed, onMounted, openBlock, createElementBlock, normalizeClass, Fragment, createTextVNode, toDisplayString, createElementVNode, renderList, createCommentVNode } from "vue";
const _hoisted_1 = ["data-condition"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "PlayerHpBar",
  props: {
    state: {},
    onNodeReady: { type: Function }
  },
  setup(__props) {
    const props = __props;
    const hpRef = ref(null);
    const isInfiniteMax = computed(() => props.state.maxHp === Infinity);
    const isInfiniteHp = computed(() => props.state.hp === Infinity);
    const isTextStyle = computed(() => {
      const maxHp = props.state.maxHp;
      return maxHp !== void 0 && maxHp !== Infinity && Number(maxHp) > 5;
    });
    const segmentCount = computed(() => {
      const maxHp = props.state.maxHp;
      if (maxHp === void 0 || maxHp === Infinity || Number(maxHp) > 5) {
        return 0;
      }
      return Math.max(0, Number(maxHp));
    });
    function isSegmentLost(domIndex) {
      const logicalIndex = props.state.isNewLayout ? segmentCount.value - domIndex - 1 : domIndex;
      return !(logicalIndex < Number(props.state.hp));
    }
    onMounted(() => {
      if (hpRef.value) {
        props.onNodeReady("hp", hpRef.value);
      }
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        ref_key: "hpRef",
        ref: hpRef,
        class: normalizeClass(["hp", { textstyle: isTextStyle.value }]),
        "data-condition": __props.state.hpCondition
      }, [
        isInfiniteMax.value ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
          isInfiniteHp.value ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
            createTextVNode("∞")
          ], 64)) : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
            createTextVNode(toDisplayString(__props.state.hp), 1),
            _cache[0] || (_cache[0] = createElementVNode("br", null, null, -1)),
            _cache[1] || (_cache[1] = createTextVNode("/", -1)),
            _cache[2] || (_cache[2] = createElementVNode("br", null, null, -1)),
            _cache[3] || (_cache[3] = createTextVNode("∞", -1)),
            _cache[4] || (_cache[4] = createElementVNode("div", null, null, -1))
          ], 64))
        ], 64)) : isTextStyle.value ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
          createTextVNode(toDisplayString(__props.state.hp), 1),
          _cache[5] || (_cache[5] = createElementVNode("br", null, null, -1)),
          _cache[6] || (_cache[6] = createTextVNode("/", -1)),
          _cache[7] || (_cache[7] = createElementVNode("br", null, null, -1)),
          createTextVNode(toDisplayString(__props.state.maxHp), 1),
          createElementVNode("div", {
            class: normalizeClass({ lost: __props.state.hp == 0 })
          }, null, 2)
        ], 64)) : segmentCount.value > 0 ? (openBlock(true), createElementBlock(Fragment, { key: 2 }, renderList(segmentCount.value, (idx) => {
          return openBlock(), createElementBlock("div", {
            key: idx,
            class: normalizeClass({ lost: isSegmentLost(idx - 1) })
          }, null, 2);
        }), 128)) : createCommentVNode("", true)
      ], 10, _hoisted_1);
    };
  }
});
export {
  _sfc_main as default
};
