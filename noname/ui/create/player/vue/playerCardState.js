import { reactive } from "vue";
import "../../../../../noname.js";
import { game } from "../../../../game/index.js";
import { get } from "../../../../get/binding.js";
const playerCardStateMap = /* @__PURE__ */ new WeakMap();
function getPlayerCardState(player) {
  return playerCardStateMap.get(player);
}
function setPlayerCardState(player, state) {
  playerCardStateMap.set(player, state);
}
function deletePlayerCardState(player) {
  playerCardStateMap.delete(player);
}
function createPlayerCardState() {
  return reactive({
    nameHtml: "",
    name2Html: "",
    nameNature: "",
    nameLong: false,
    identityText: "",
    identityColor: "",
    hp: void 0,
    maxHp: void 0,
    hpCondition: "",
    isNewLayout: Boolean(get.is.newLayout?.()),
    count: "",
    countCondition: "",
    chainLength: game.layout == "default" ? 64 : 40,
    isMainPlayer: false,
    llmBadge: {
      label: "AI",
      visible: false,
      highlighted: false,
      title: ""
    }
  });
}
function syncHpState(state, player) {
  const hidden = player.classList?.contains("unseen_show") || player.classList?.contains("unseen2_show") || false;
  const maxHp = hidden ? 1 : player.maxHp;
  state.hp = player.hp;
  state.maxHp = maxHp;
  state.isNewLayout = Boolean(get.is.newLayout());
  const hpNode = player.node?.hp;
  if (hidden) {
    state.hpCondition = "hidden";
  } else if (hpNode?.classList?.contains("room")) {
    state.hpCondition = "high";
  } else if (player.hp == 0) {
    state.hpCondition = "";
  } else if (Number(player.hp) > Math.round(Number(maxHp) / 2) || player.hp === maxHp) {
    state.hpCondition = "high";
  } else if (Number(player.hp) > Math.floor(Number(maxHp) / 3)) {
    state.hpCondition = "mid";
  } else {
    state.hpCondition = "low";
  }
}
function syncCountState(state, numh) {
  state.count = numh?.toString() ?? "";
  if (typeof numh !== "number") {
    state.countCondition = "high";
  } else if (numh < 10) {
    state.countCondition = "low";
  } else if (numh < 100) {
    state.countCondition = "mid";
  } else {
    state.countCondition = "high";
  }
}
function syncIdentityState(state, player, identity, nature) {
  const resolvedIdentity = identity || player.identity || "";
  const text = get.is.jun(player) ? "君" : get.translation(resolvedIdentity);
  const color = nature || resolvedIdentity;
  state.identityText = text;
  state.identityColor = color;
  const identityNode = player.node?.identity;
  if (identityNode) {
    if (identityNode.firstChild instanceof HTMLElement) {
      identityNode.firstChild.innerHTML = text;
    }
    identityNode.dataset.color = color;
  }
}
function syncCharacterName1State(state, character, group, isMinskin) {
  const html = character ? get.slimName(character) : "";
  state.nameHtml = html;
  if (group !== void 0) {
    state.nameNature = get.groupnature(String(group));
  }
  if (isMinskin !== void 0) {
    state.nameLong = Boolean(isMinskin && (html.match(/<br\s*\/?>/gi)?.length ?? 0) >= 4);
  }
}
function syncCharacterName2State(state, character2) {
  state.name2Html = character2 ? get.slimName(character2) : "";
}
function syncLLMBadgeState(state, badge) {
  state.llmBadge.label = badge.label;
  state.llmBadge.visible = badge.visible;
  state.llmBadge.highlighted = badge.highlighted;
  state.llmBadge.title = badge.title;
}
function syncMainPlayerState(state, player) {
  state.isMainPlayer = Boolean(player && player === game.me);
}
function syncAllMainPlayerStates() {
  const allPlayers = [...game.players || [], ...game.dead || []];
  for (const p of allPlayers) {
    const state = getPlayerCardState(p);
    if (state) {
      syncMainPlayerState(state, p);
    }
  }
}
function resetPlayerCardState(state) {
  state.nameHtml = "";
  state.name2Html = "";
  state.nameNature = "";
  state.nameLong = false;
  state.hp = void 0;
  state.maxHp = void 0;
  state.hpCondition = "";
  state.count = "0";
}
export {
  createPlayerCardState,
  deletePlayerCardState,
  getPlayerCardState,
  resetPlayerCardState,
  setPlayerCardState,
  syncAllMainPlayerStates,
  syncCharacterName1State,
  syncCharacterName2State,
  syncCountState,
  syncHpState,
  syncIdentityState,
  syncLLMBadgeState,
  syncMainPlayerState
};
