import { defineComponent, ref, computed, onBeforeUnmount, openBlock, createElementBlock, normalizeStyle, normalizeClass, createElementVNode, toDisplayString, createCommentVNode, withModifiers } from "vue";
const _hoisted_1 = { class: "progress-main" };
const _hoisted_2 = { class: "progress-count" };
const _hoisted_3 = ["title"];
const _hoisted_4 = { class: "progress-badges" };
const _hoisted_5 = { class: "pill" };
const _hoisted_6 = {
  key: 0,
  class: "pill waiting"
};
const _hoisted_7 = {
  key: 1,
  class: "pill warn"
};
const _hoisted_8 = {
  key: 2,
  class: "pill muted"
};
const _hoisted_9 = ["disabled"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "OpeningProgress",
  props: {
    state: {}
  },
  emits: ["skip", "update:offset"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const rootRef = ref(null);
    const isDragging = ref(false);
    const percent = computed(() => {
      if (props.state.total <= 0) return 0;
      return Math.min(100, Math.max(0, Math.round(props.state.completed / props.state.total * 100)));
    });
    const rootStyle = computed(() => ({
      transform: `translate(calc(-50% + ${props.state.offsetX}px), ${props.state.offsetY}px)`
    }));
    let dragCleanup = null;
    function clampOffset(x, y, zoom) {
      const vw = (typeof window !== "undefined" ? window.innerWidth : 0) / zoom;
      const vh = (typeof window !== "undefined" ? window.innerHeight : 0) / zoom;
      const el = rootRef.value;
      if (!vw || !vh || !el) return { x, y };
      const margin = 8;
      const halfW = el.offsetWidth / 2;
      const maxX = Math.max(0, vw / 2 - halfW - margin);
      const minX = -maxX;
      const minY = -12 + margin;
      const maxY = Math.max(minY, vh - 12 - el.offsetHeight - margin);
      return {
        x: Math.round(Math.min(maxX, Math.max(minX, x))),
        y: Math.round(Math.min(maxY, Math.max(minY, y)))
      };
    }
    function onPointerDown(e) {
      if (e.button !== 0) return;
      const target = e.target;
      if (target?.closest?.("button")) return;
      dragCleanup?.();
      const zoom = globalThis.game?.documentZoom || 1;
      const startX = e.clientX;
      const startY = e.clientY;
      const baseX = props.state.offsetX;
      const baseY = props.state.offsetY;
      isDragging.value = true;
      const onMove = (ev) => {
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;
        emit("update:offset", clampOffset(baseX + dx, baseY + dy, zoom));
      };
      const stop = () => {
        isDragging.value = false;
        dragCleanup?.();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
      dragCleanup = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
        dragCleanup = null;
      };
    }
    onBeforeUnmount(() => {
      dragCleanup?.();
      isDragging.value = false;
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        ref_key: "rootRef",
        ref: rootRef,
        class: normalizeClass(["llm-opening-progress", { "is-dragging": isDragging.value }]),
        style: normalizeStyle(rootStyle.value),
        onPointerdown: onPointerDown
      }, [
        createElementVNode("div", _hoisted_1, [
          _cache[2] || (_cache[2] = createElementVNode("span", { class: "progress-title" }, "LLM 选将", -1)),
          createElementVNode("span", _hoisted_2, toDisplayString(__props.state.completed) + "/" + toDisplayString(__props.state.total), 1),
          createElementVNode("div", {
            class: "progress-track",
            title: `已完成 ${percent.value}%`
          }, [
            createElementVNode("div", {
              class: "progress-fill",
              style: normalizeStyle({ width: `${percent.value}%` })
            }, null, 4)
          ], 8, _hoisted_3)
        ]),
        createElementVNode("div", _hoisted_4, [
          createElementVNode("span", _hoisted_5, toDisplayString(__props.state.elapsedSec) + "秒", 1),
          __props.state.waitingText ? (openBlock(), createElementBlock("span", _hoisted_6, "等待 " + toDisplayString(__props.state.waitingText), 1)) : createCommentVNode("", true),
          __props.state.fallbacks > 0 ? (openBlock(), createElementBlock("span", _hoisted_7, "回退 " + toDisplayString(__props.state.fallbacks), 1)) : createCommentVNode("", true),
          __props.state.skipped ? (openBlock(), createElementBlock("span", _hoisted_8, "已跳过")) : createCommentVNode("", true)
        ]),
        createElementVNode("button", {
          type: "button",
          class: "skip-btn",
          disabled: __props.state.skipped,
          onPointerdown: _cache[0] || (_cache[0] = withModifiers(() => {
          }, ["stop"])),
          onClick: _cache[1] || (_cache[1] = ($event) => emit("skip"))
        }, " 跳过剩余 LLM 选将 ", 40, _hoisted_9)
      ], 38);
    };
  }
});
export {
  _sfc_main as default
};
