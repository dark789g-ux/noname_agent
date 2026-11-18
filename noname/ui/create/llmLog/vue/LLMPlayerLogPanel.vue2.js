import { defineComponent, openBlock, createElementBlock, unref, createBlock } from "vue";
import { llmLogger } from "../../../../llm/logger.js";
import { useLogDetailLoader } from "./llmLogStatus.js";
import LLMLogDetailView from "./components/LLMLogDetailView.vue.js";
import LLMSessionTimeline from "./components/LLMSessionTimeline.vue.js";
const _hoisted_1 = { class: "llm-player-log-panel" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "LLMPlayerLogPanel",
  props: {
    playerSeatNum: {},
    gameId: {},
    playerName: {}
  },
  setup(__props) {
    const { selectedDetail, detailLoading, openDetail, closeDetail } = useLogDetailLoader((id) => llmLogger.getLogDetail(id));
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        unref(selectedDetail) ? (openBlock(), createBlock(LLMLogDetailView, {
          key: 0,
          entry: unref(selectedDetail),
          loading: unref(detailLoading),
          onBack: unref(closeDetail)
        }, null, 8, ["entry", "loading", "onBack"])) : (openBlock(), createBlock(LLMSessionTimeline, {
          key: 1,
          "player-seat-num": __props.playerSeatNum,
          "game-id": __props.gameId,
          "player-name": __props.playerName,
          onSelectDetail: unref(openDetail)
        }, null, 8, ["player-seat-num", "game-id", "player-name", "onSelectDetail"]))
      ]);
    };
  }
});
export {
  _sfc_main as default
};
