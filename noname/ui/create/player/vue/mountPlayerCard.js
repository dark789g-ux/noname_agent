import { createApp } from "vue";
import "../../../../../noname.js";
import { ChildNodesWatcher } from "../../../../library/cache/childNodesWatcher.js";
import "./components/PlayerCard.vue.js";
import { createPlayerCardState, syncMainPlayerState, setPlayerCardState, deletePlayerCardState, getPlayerCardState, resetPlayerCardState, syncAllMainPlayerStates, syncLLMBadgeState, syncCharacterName2State, syncCharacterName1State, syncIdentityState, syncCountState, syncHpState } from "./playerCardState.js";
import { ui } from "../../../index.js";
import _sfc_main from "./components/PlayerCard.vue2.js";
import { lib } from "../../../../library/index.js";
const mountedApps = /* @__PURE__ */ new WeakMap();
function mountPlayerCard(player) {
  unmountPlayerCard(player);
  const state = createPlayerCardState();
  syncMainPlayerState(state, player);
  setPlayerCardState(player, state);
  const handcards1 = ui.create.div(".handcards");
  const handcards2 = ui.create.div(".handcards");
  handcards1._childNodesWatcher = new ChildNodesWatcher(handcards1);
  handcards2._childNodesWatcher = new ChildNodesWatcher(handcards2);
  const expansions = ui.create.div(".expansions");
  expansions.style.display = "none";
  const nodeMap = {
    handcards1,
    handcards2,
    expansions
  };
  player.node = nodeMap;
  const app = createApp(_sfc_main, {
    player,
    state,
    onNodeReady(key, el) {
      nodeMap[key] = el;
    }
  });
  app.mount(player);
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === "childList") {
        const addedNodes = Array.from(mutation.addedNodes);
        const removedNodes = Array.from(mutation.removedNodes);
        if (addedNodes.some((card) => card instanceof lib.element.Card && !card.classList.contains("emptyequip")) || removedNodes.some((card) => card instanceof lib.element.Card && !card.classList.contains("emptyequip"))) {
          player.$handleEquipChange();
        }
      }
    }
  });
  if (nodeMap.equips) {
    observer.observe(nodeMap.equips, { childList: true });
  }
  mountedApps.set(player, { app, observer });
  return nodeMap;
}
function unmountPlayerCard(player) {
  const mounted = mountedApps.get(player);
  if (mounted) {
    mounted.observer.disconnect();
    mounted.app.unmount();
    mountedApps.delete(player);
  }
  deletePlayerCardState(player);
}
const playerCardVueBridge = {
  mount: mountPlayerCard,
  unmount: unmountPlayerCard,
  syncHp(player) {
    const state = getPlayerCardState(player);
    if (!state) return false;
    const hpNode = player.node?.hp;
    if (hpNode) {
      hpNode.style.transition = "none";
    }
    syncHpState(state, player);
    if (hpNode) {
      setTimeout(() => {
        hpNode.style.transition = "";
      });
    }
    return true;
  },
  syncCount(player, numh) {
    const state = getPlayerCardState(player);
    if (!state) return false;
    syncCountState(state, numh);
    return true;
  },
  syncIdentity(player, identity, nature) {
    const state = getPlayerCardState(player);
    if (!state) return false;
    syncIdentityState(state, player, identity, nature);
    return true;
  },
  syncName1(player, character, group, isMinskin) {
    const state = getPlayerCardState(player);
    if (!state) return false;
    syncCharacterName1State(state, character, group, isMinskin);
    return true;
  },
  syncName2(player, character2) {
    const state = getPlayerCardState(player);
    if (!state) return false;
    syncCharacterName2State(state, character2);
    return true;
  },
  syncLLMBadge(player, badge) {
    const state = getPlayerCardState(player);
    if (!state) return false;
    syncLLMBadgeState(state, badge);
    return true;
  },
  syncMainPlayer(player) {
    if (player) {
      const state = getPlayerCardState(player);
      if (!state) return false;
      syncMainPlayerState(state, player);
      return true;
    }
    syncAllMainPlayerStates();
    return true;
  },
  reset(player) {
    const state = getPlayerCardState(player);
    if (!state) return false;
    resetPlayerCardState(state);
    return true;
  }
};
export {
  mountPlayerCard,
  playerCardVueBridge,
  unmountPlayerCard
};
