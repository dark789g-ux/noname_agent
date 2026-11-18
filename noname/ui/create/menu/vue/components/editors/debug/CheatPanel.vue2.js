import { defineComponent, ref, computed, watch, onMounted, onUnmounted, openBlock, createElementBlock, createElementVNode, normalizeStyle, Fragment, renderList, normalizeClass, toDisplayString, withDirectives, withModifiers, createCommentVNode, vShow, unref } from "vue";
import "../../../../../../../../noname.js";
import { menuUpdates } from "../../../menuState.js";
import { vCharBg } from "../shared/vCharBg.js";
import { game } from "../../../../../../../game/index.js";
import { _status } from "../../../../../../../status/index.js";
import { ui } from "../../../../../../index.js";
import { get } from "../../../../../../../get/binding.js";
import { lib } from "../../../../../../../library/index.js";
const _hoisted_1 = { class: "menu-sym" };
const _hoisted_2 = ["onClick"];
const _hoisted_3 = ["onClick"];
const _hoisted_4 = ["onClick"];
const _hoisted_5 = {
  key: 0,
  class: "avatar_name"
};
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "CheatPanel",
  emits: ["cheat-executed"],
  setup(__props, { emit: __emit }) {
    const emit = __emit;
    const currentAction = ref(null);
    const currentNum = ref(null);
    const selectedTargets = ref(/* @__PURE__ */ new Set());
    const playerItems = ref([]);
    const hasPlayers = ref(false);
    const actionLabels = ["伤害", "回复", "摸牌", "弃牌", "横置", "翻面", "复活", "换人"];
    const actions = ref(
      actionLabels.map((label) => ({ label, disabled: false }))
    );
    const numbers = [1, 2, 3, 4, 5];
    function numLabel(n) {
      return ["一", "二", "三", "四", "五"][n - 1];
    }
    function norow2() {
      return currentAction.value === "横置" || currentAction.value === "翻面" || currentAction.value === "换人" || currentAction.value === "复活";
    }
    const isRow2Disabled = computed(() => norow2());
    const canExecute = computed(
      () => currentAction.value !== null && (currentNum.value !== null || norow2()) && selectedTargets.value.size > 0
    );
    function isPlayerUnselectable(item) {
      return currentAction.value === "换人" && item.player === game.me;
    }
    function onClickRow1(action) {
      if (action.disabled) return;
      currentAction.value = currentAction.value === action.label ? null : action.label;
      if (currentAction.value === "换人") {
        selectedTargets.value = /* @__PURE__ */ new Set();
      }
    }
    function onClickRow2(num) {
      if (isRow2Disabled.value) return;
      currentNum.value = currentNum.value === num ? null : num;
    }
    function onClickPlayer(item) {
      if (isPlayerUnselectable(item)) return;
      const player = item.player;
      const next = new Set(selectedTargets.value);
      if (currentAction.value === "换人") {
        if (player === game.me) return;
        next.clear();
        next.add(player);
      } else if (next.has(player)) {
        next.delete(player);
      } else {
        next.add(player);
      }
      selectedTargets.value = next;
    }
    function executeCheat() {
      if (!canExecute.value || !currentAction.value) return;
      const num = currentNum.value;
      for (const target of Array.from(selectedTargets.value)) {
        switch (currentAction.value) {
          case "伤害":
            target.damage(num, "nosource");
            break;
          case "回复":
            target.recover(num, "nosource");
            break;
          case "摸牌":
            target.draw(num);
            break;
          case "弃牌":
            target.discard(target.getCards("he").randomGets(num));
            break;
          case "横置":
            target.link();
            break;
          case "翻面":
            target.turnOver();
            break;
          case "复活":
            target.revive(target.maxHp);
            break;
          case "换人": {
            if (_status.event.isMine()) {
              if (!ui.auto.classList.contains("hidden")) {
                setTimeout(() => {
                  ui.click.auto();
                  setTimeout(() => {
                    ui.click.auto();
                    game.swapPlayer(target);
                  }, 500);
                });
              }
            } else {
              game.swapPlayer(target);
            }
            break;
          }
        }
      }
      if (ui.coin) game.changeCoin(-20);
      emit("cheat-executed");
    }
    function toCheatPlayerItem(player, isDead) {
      const isUnknown = Boolean(player.name && player.name.startsWith("unknown"));
      const isCardBg = isUnknown && Boolean(player.node?.name_seat);
      return {
        player,
        isDead,
        isCardBg,
        seatLabel: isCardBg ? get.translation(player.name) : "",
        bgName: isUnknown ? player.name1 : player.name
      };
    }
    function updateReplaceActionDisabled() {
      const replaceIdx = actionLabels.indexOf("换人");
      if (replaceIdx < 0) return;
      if (!game.canReplaceViewpoint || !game.canReplaceViewpoint()) {
        actions.value[replaceIdx].disabled = true;
        return;
      }
      if (lib.config.mode === "identity" || lib.config.mode === "guozhan" || lib.config.mode === "doudizhu") {
        const hasSwapLock = game.notMe || game.me && (game.me._trueMe || game.hasPlayer((c) => c._trueMe == game.me)) || !game.phaseNumber || _status.qianlidanji;
        const isHiddenAutoMine = _status.event.isMine() && ui.auto.classList.contains("hidden");
        actions.value[replaceIdx].disabled = Boolean(hasSwapLock || isHiddenAutoMine);
      }
    }
    function refreshPlayerList() {
      if (_status.video || _status.connectMode) {
        hasPlayers.value = false;
        playerItems.value = [];
        return;
      }
      const items = [];
      for (const p of game.players) {
        if (lib.character[p.name] || p.name1) items.push(toCheatPlayerItem(p, false));
      }
      for (const p of game.dead) {
        if (lib.character[p.name] || p.name1) items.push(toCheatPlayerItem(p, true));
      }
      playerItems.value = items;
      hasPlayers.value = items.length > 0;
      if (!items.length) return;
      updateReplaceActionDisabled();
      const reviveIdx = actionLabels.indexOf("复活");
      if (reviveIdx >= 0) {
        actions.value[reviveIdx].disabled = game.dead.length === 0;
      }
    }
    watch(currentAction, (next) => {
      if (next !== "复活") return;
      selectedTargets.value = new Set(Array.from(selectedTargets.value).filter((t) => game.dead.includes(t)));
    });
    onMounted(() => {
      menuUpdates.push(refreshPlayerList);
      refreshPlayerList();
    });
    onUnmounted(() => {
      const idx = menuUpdates.indexOf(refreshPlayerList);
      if (idx >= 0) menuUpdates.splice(idx, 1);
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", {
          class: "menu-cheat",
          style: normalizeStyle({ display: hasPlayers.value ? "" : "none" })
        }, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(actions.value, (action) => {
            return openBlock(), createElementBlock("div", {
              key: action.label,
              class: normalizeClass(["menubutton", {
                selectedx: currentAction.value === action.label,
                unselectable: action.disabled
              }]),
              onClick: ($event) => onClickRow1(action)
            }, toDisplayString(action.label), 11, _hoisted_2);
          }), 128))
        ], 4),
        createElementVNode("div", {
          class: "menu-cheat",
          style: normalizeStyle({ display: hasPlayers.value ? "" : "none" })
        }, [
          (openBlock(), createElementBlock(Fragment, null, renderList(numbers, (num) => {
            return createElementVNode("div", {
              key: num,
              class: normalizeClass(["menubutton", {
                selectedx: currentNum.value === num,
                unselectable: isRow2Disabled.value
              }]),
              onClick: ($event) => onClickRow2(num)
            }, toDisplayString(numLabel(num)), 11, _hoisted_3);
          }), 64))
        ], 4),
        createElementVNode("div", {
          class: "menu-buttons leftbutton commandbutton",
          style: normalizeStyle({ display: hasPlayers.value ? "" : "none", marginTop: "3px" })
        }, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(playerItems.value, (item, idx) => {
            return withDirectives((openBlock(), createElementBlock("div", {
              key: idx,
              class: normalizeClass(["button character", {
                cardbg: item.isCardBg,
                glow: selectedTargets.value.has(item.player),
                unselectable: isPlayerUnselectable(item)
              }]),
              onClick: withModifiers(($event) => onClickPlayer(item), ["stop"])
            }, [
              item.isCardBg ? (openBlock(), createElementBlock("div", _hoisted_5, toDisplayString(item.seatLabel), 1)) : createCommentVNode("", true),
              _cache[0] || (_cache[0] = createElementVNode("div", { class: "name" }, null, -1)),
              _cache[1] || (_cache[1] = createElementVNode("div", { class: "intro" }, null, -1))
            ], 10, _hoisted_4)), [
              [vShow, currentAction.value === "复活" ? item.isDead : !item.isDead],
              [unref(vCharBg), item.isCardBg ? void 0 : item.bgName, "character"]
            ]);
          }), 128))
        ], 4),
        createElementVNode("div", {
          class: normalizeClass(["menubutton round highlight cheat-float-btn", { glowing: canExecute.value }]),
          onClick: executeCheat
        }, " 作 ", 2)
      ]);
    };
  }
});
export {
  _sfc_main as default
};
