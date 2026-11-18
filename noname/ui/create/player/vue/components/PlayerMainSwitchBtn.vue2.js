import { defineComponent, ref, onMounted, withDirectives, openBlock, createElementBlock, normalizeClass, vShow } from "vue";
import "../../../../../../noname.js";
import { game } from "../../../../../game/index.js";
import { _status } from "../../../../../status/index.js";
import { ui } from "../../../../index.js";
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "PlayerMainSwitchBtn",
  props: {
    player: {},
    state: {},
    onNodeReady: { type: Function }
  },
  setup(__props) {
    const props = __props;
    const btnRef = ref(null);
    function handleClick(event) {
      event.stopPropagation();
      const target = props.player;
      if (!target || target === game.me) return;
      if (target.isDead?.() || target.classList?.contains("dead")) return;
      if (_status.gameStarted === false) return;
      if (_status.connectMode || game.online) return;
      const initialHuman = _status.llmInitialHumanPlayer;
      if (!_status.auto && target !== initialHuman) {
        ui.click?.auto?.();
      }
      game.swapPlayer(target, null, {
        animate: true,
        preserveIdentity: true
      });
    }
    onMounted(() => {
      if (btnRef.value) {
        props.onNodeReady("mainSwitchBtn", btnRef.value);
      }
    });
    return (_ctx, _cache) => {
      return withDirectives((openBlock(), createElementBlock("div", {
        ref_key: "btnRef",
        ref: btnRef,
        class: normalizeClass(["player-main-switch-btn", { "with-llm-badge": __props.state.llmBadge.visible }]),
        title: "切换为主角色并查看手牌",
        onClick: handleClick
      }, " 视角 ", 2)), [
        [vShow, !__props.state.isMainPlayer]
      ]);
    };
  }
});
export {
  _sfc_main as default
};
