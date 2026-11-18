import { defineComponent, openBlock, createElementBlock, createVNode, unref, createElementVNode, createCommentVNode, Fragment, renderList, createBlock, normalizeClass, toDisplayString } from "vue";
import LLMDecisionBlock from "./LLMDecisionBlock.vue.js";
import LLMSessionMarker from "./LLMSessionMarker.vue.js";
import LLMSessionStatusBar from "./LLMSessionStatusBar.vue.js";
import { buildTimelineMarkers } from "../timelineTypes.js";
import { useLLMSeatTimeline } from "../useLLMSeatTimeline.js";
const _hoisted_1 = { class: "llm-session-timeline" };
const _hoisted_2 = { class: "timeline-scroll-wrap" };
const _hoisted_3 = {
  key: 0,
  class: "timeline-empty"
};
const _hoisted_4 = {
  key: 1,
  class: "timeline-empty"
};
const _hoisted_5 = { class: "toolbar" };
const _hoisted_6 = ["disabled"];
const _hoisted_7 = ["disabled"];
const _hoisted_8 = { class: "toolbar-summary" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "LLMSessionTimeline",
  props: {
    playerSeatNum: {},
    gameId: {},
    playerName: {}
  },
  emits: ["select-detail"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const {
      timelineEl,
      currentCall,
      activeStream,
      partialArgs,
      history,
      elapsedMs,
      liveThinkingMs,
      isLoading,
      isClearing,
      isFollowing,
      hasNewBelow,
      sessionStatus,
      handleScroll,
      scrollToBottom,
      refresh,
      clearLogs
    } = useLLMSeatTimeline(props);
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createVNode(LLMSessionStatusBar, { status: unref(sessionStatus) }, null, 8, ["status"]),
        createElementVNode("div", _hoisted_2, [
          createElementVNode("div", {
            ref_key: "timelineEl",
            ref: timelineEl,
            class: "timeline-scroll",
            onScroll: _cache[1] || (_cache[1] = //@ts-ignore
            (...args) => unref(handleScroll) && unref(handleScroll)(...args))
          }, [
            unref(isLoading) && unref(history).length === 0 && !unref(currentCall) ? (openBlock(), createElementBlock("div", _hoisted_3, " 正在加载决策记录… ")) : unref(history).length === 0 && !unref(currentCall) ? (openBlock(), createElementBlock("div", _hoisted_4, " 暂无决策时间线，等待该玩家下次决策… ")) : createCommentVNode("", true),
            (openBlock(true), createElementBlock(Fragment, null, renderList(unref(history), (entry, index) => {
              return openBlock(), createElementBlock(Fragment, {
                key: entry.id
              }, [
                (openBlock(true), createElementBlock(Fragment, null, renderList(unref(buildTimelineMarkers)(entry, index), (marker, mIdx) => {
                  return openBlock(), createBlock(LLMSessionMarker, {
                    key: `${entry.id}-marker-${mIdx}`,
                    marker
                  }, null, 8, ["marker"]);
                }), 128)),
                createVNode(LLMDecisionBlock, {
                  entry,
                  onSelectDetail: _cache[0] || (_cache[0] = ($event) => emit("select-detail", $event))
                }, null, 8, ["entry"])
              ], 64);
            }), 128)),
            unref(currentCall) ? (openBlock(), createElementBlock(Fragment, { key: 2 }, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(unref(buildTimelineMarkers)(unref(currentCall), unref(history).length), (marker, mIdx) => {
                return openBlock(), createBlock(LLMSessionMarker, {
                  key: `${unref(currentCall).id}-active-marker-${mIdx}`,
                  marker
                }, null, 8, ["marker"]);
              }), 128)),
              createVNode(LLMDecisionBlock, {
                entry: unref(currentCall),
                active: true,
                "active-stream": unref(activeStream),
                "partial-args": unref(partialArgs),
                "elapsed-ms": unref(elapsedMs),
                "live-thinking-ms": unref(liveThinkingMs)
              }, null, 8, ["entry", "active-stream", "partial-args", "elapsed-ms", "live-thinking-ms"])
            ], 64)) : createCommentVNode("", true)
          ], 544),
          !unref(isFollowing) ? (openBlock(), createElementBlock("button", {
            key: 0,
            class: normalizeClass(["jump-latest-btn", { "has-new": unref(hasNewBelow) }]),
            onClick: _cache[2] || (_cache[2] = //@ts-ignore
            (...args) => unref(scrollToBottom) && unref(scrollToBottom)(...args))
          }, toDisplayString(unref(hasNewBelow) ? "↓ 有新输出，回到最新" : "↓ 回到最新"), 3)) : createCommentVNode("", true)
        ]),
        createElementVNode("div", _hoisted_5, [
          createElementVNode("button", {
            class: "btn",
            disabled: unref(isClearing),
            onClick: _cache[3] || (_cache[3] = //@ts-ignore
            (...args) => unref(refresh) && unref(refresh)(...args))
          }, "刷新", 8, _hoisted_6),
          createElementVNode("button", {
            class: "btn",
            disabled: unref(isClearing),
            onClick: _cache[4] || (_cache[4] = //@ts-ignore
            (...args) => unref(clearLogs) && unref(clearLogs)(...args))
          }, toDisplayString(unref(isClearing) ? "清空中…" : "清空"), 9, _hoisted_7),
          createElementVNode("span", _hoisted_8, "共 " + toDisplayString(unref(history).length) + " 次已完成决策", 1)
        ])
      ]);
    };
  }
});
export {
  _sfc_main as default
};
