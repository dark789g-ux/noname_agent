import "../../noname.js";
import { getRegisteredSkill } from "../library/skillRegistry.js";
import { getOpeningSummary } from "./character-selection/summary.js";
import { buildFactsSnapshotParts, buildRefLabels, renderStatelessContextMessages } from "./prompt-facts.js";
import { collectPromptPlayers, cleanPromptText, selectPromptDescription, promptTranslation, translatePromptValue } from "./prompt-format.js";
import { getPromptHistorySnapshot, getCurrentRoundNumber, getShuffleCount, getDiscardPileCount, getDrawPileCount } from "./round-history.js";
import { get } from "../get/binding.js";
import { lib } from "../library/index.js";
import { game } from "../game/index.js";
const DECISION_DESCRIPTIONS = {
  chooseToUse: "出牌阶段/需要出牌",
  chooseToRespond: "需要响应别人的牌",
  chooseToDiscard: "弃牌阶段/需要弃牌",
  chooseBool: "是否选择"
};
function collectDecisionPromptFacts(event, candidates, options) {
  const decisionPoint = event.name || "unknown";
  const runtime = createPromptRuntime();
  const referencedPlayers = "targetPool" in candidates ? candidates.targetPool.map((target) => target.player) : void 0;
  const snapshot = collectPromptPlayers(runtime, event.player, referencedPlayers);
  const states = "targetPool" in candidates ? snapshot.states.map((state, index) => ({ ...state, ref: candidates.targetPool[index]?.ref })) : snapshot.states;
  const normalizedCandidates = {
    ...candidates,
    targets: "targetPool" in candidates && candidates.actions.length ? candidates.targetPool : candidates.targets
  };
  const roundHistory = getPromptHistorySnapshot();
  const roundNumber = roundHistory.currentRound || getCurrentRoundNumber();
  const parts = buildFactsSnapshotParts(decisionPoint, event, normalizedCandidates, {
    decisionDescriptions: DECISION_DESCRIPTIONS,
    getSkillName: skillName,
    getSkillDescription: (skill) => engineSkillDescription(skill, void 0),
    getCardLabel: (card) => `${get.translation(card)} ${get.suit(card)} ${get.number(card)}`,
    getPlayerLabel: (player) => displayText(get.translation(player) || player.name)
  });
  return {
    decisionPoint,
    profiles: snapshot.profiles,
    states,
    pileOverview: {
      roundNumber,
      drawPileCount: getDrawPileCount(),
      discardPileCount: getDiscardPileCount(),
      shuffleNumber: getShuffleCount(),
      canInspectDiscard: options?.canInspectDiscard
    },
    roundHistory,
    decisionHeaderText: [parts.headerText, getOpeningSummary(event.player)].filter(Boolean).join("\n\n"),
    decisionChoicesText: parts.choicesText,
    refLabels: buildRefLabels(normalizedCandidates, states)
  };
}
function buildContext(event, candidates, options) {
  const facts = collectDecisionPromptFacts(event, candidates, options);
  return { messages: renderStatelessContextMessages(facts) };
}
function createPromptRuntime() {
  return {
    players: Array.from(game.players || []),
    globalSkills: lib.skill.global || [],
    translate: translateId,
    getPlayerName: (player) => displayText(get.translation(player) || player.name),
    getSkillName: skillName,
    getSkillDescription: engineSkillDescription,
    getSkillMeta: (skill) => getRegisteredSkill(lib.skill, skill),
    isZhuanhuanji: (skill, player) => Boolean(get.is?.zhuanhuanji?.(skill, player)),
    isCardKnown: (card, observer) => Boolean(card?.isKnownBy?.(observer)),
    getEquipmentSkills: (card) => Array.from(get.skillsFromEquips?.([card]) || []),
    isEquipmentCard: (card) => get.info(card, false)?.type === "equip",
    getCardName: (card) => displayText(get.translation(card) || translateId(viewAsName(card) || card.name)),
    getCardProperties: (card, owner) => ({
      suit: translateId(get.suit(card, owner)),
      number: get.number(card, owner) ?? "未知",
      color: translateId(get.color(card, owner))
    }),
    getCardDescription: engineCardDescription,
    getViewedAsDescription: engineViewedAsDescription
  };
}
function engineSkillDescription(skill, player) {
  let dynamicDescription = "";
  try {
    dynamicDescription = cleanPromptText(get.skillInfoTranslation?.(skill, player));
  } catch {
  }
  return selectPromptDescription(dynamicDescription, promptTranslation(lib.translate, `${skill}_info`));
}
function engineCardDescription(card, owner) {
  let description = "";
  try {
    description = get.cardDescription(card, owner);
  } catch {
  }
  let prompt = "";
  try {
    prompt = get.info(card, false)?.cardPrompt?.(card, owner);
  } catch {
  }
  return selectPromptDescription(description, prompt, promptTranslation(lib.translate, `${card.name}_info`));
}
function engineViewedAsDescription(card, effectiveId, owner) {
  let prompt = "";
  try {
    prompt = lib.card[effectiveId]?.cardPrompt?.(card, owner);
  } catch {
  }
  return selectPromptDescription(prompt, promptTranslation(lib.translate, `${effectiveId}_info`));
}
function translateId(value) {
  return translatePromptValue(value, get.translation);
}
function displayText(value) {
  return cleanPromptText(value) || "未知";
}
function skillName(skill) {
  const translated = displayText(get.skillTranslation?.(skill));
  if (translated !== "未知" && translated !== skill) return translated;
  const fallback = translateId(skill);
  return fallback === skill ? "" : fallback;
}
function viewAsName(card) {
  if (typeof card?.viewAs === "string") return card.viewAs;
  if (card?.viewAs && typeof card.viewAs.name === "string") return card.viewAs.name;
  return void 0;
}
function cleanSkillDescription(value) {
  return cleanPromptText(value);
}
export {
  buildContext,
  cleanSkillDescription,
  collectDecisionPromptFacts
};
