import "../../noname.js";
import { getRegisteredSkill } from "../library/skillRegistry.js";
import { matchesSelectionFilter } from "./selection-filter.js";
import { resolveSelectionSpec } from "./selection-adapter.js";
import { evaluateSelectionSpec } from "./generic-skill-plan.js";
import { withVirtualSelection } from "./legacy-bridge.js";
import { resolveEffectiveSkillSemantics, resolveBaseEvent } from "./skill-backup-semantics.js";
import { lib } from "../library/index.js";
import { game } from "../game/index.js";
import { get } from "../get/binding.js";
import { _status } from "../status/index.js";
import { ui } from "../ui/index.js";
function createCandidatesSemanticRuntime() {
  return {
    getCardInfo: (card) => typeof get?.info === "function" ? get.info(card) || {} : card?.info || {},
    autoViewAs: (definition, selected) => typeof get?.autoViewAs === "function" ? get.autoViewAs(definition, selected) : { ...definition, cards: selected },
    normalizeFilter: (value) => get.filter(value),
    checkCardEnabled2: (card, current) => typeof game?.checkMod === "function" ? game.checkMod(card, current, "unchanged", "cardEnabled2", current) : "unchanged",
    isCardDiscardable: (card, current) => typeof lib?.filter?.cardDiscardable === "function" ? !!lib.filter.cardDiscardable(card, current) : true,
    isCardRespondable: (card, current) => typeof lib?.filter?.cardRespondable === "function" ? !!lib.filter.cardRespondable(card, current) : true
  };
}
function resolveMinCardSelect(select) {
  const raw = typeof select === "function" ? select() : select;
  if (raw === void 0) return 1;
  if (typeof raw === "number") return raw < 0 ? 0 : raw;
  if (Array.isArray(raw) && typeof raw[0] === "number") return raw[0] < 0 ? 0 : raw[0];
  return 1;
}
function getCandidateCards(event, player, skills = []) {
  const records = /* @__PURE__ */ new Map();
  const semanticRuntime = createCandidatesSemanticRuntime();
  const backupSkillInfo = event?.skill && !skills.length ? getRegisteredSkill(lib.skill, event.skill) : void 0;
  const targetSkills = backupSkillInfo ? [event.skill] : skills;
  if (!event?.skill || !backupSkillInfo) {
    const eventSpec = resolveSelectionSpec(event.selectionSpec, event, player);
    const eventFilter = eventSpec?.steps?.find((step) => step.type === "card")?.filter ?? event.filterCard;
    withVirtualSelection({ ui, status: _status }, { event, player, cards: [], targets: [], buttons: [] }, () => {
      if (typeof player?.isOut === "function" && player.isOut()) return;
      for (const card of player.getCards(event.position || "hs")) {
        if (semanticRuntime.isCardRespondable && !semanticRuntime.isCardRespondable(card, player)) continue;
        if (eventFilter != null && matchesSelectionFilter(eventFilter, card, player, event, (value) => get.filter(value), event)) {
          records.set(card, { cardAction: !event?.skill, skills: event?.skill ? [event.skill] : [] });
        }
      }
    });
  }
  for (const skill of targetSkills) {
    const info = getRegisteredSkill(lib.skill, skill);
    if (!info) continue;
    const evaluated = evaluateSelectionSpec(info.selectionSpec, event, player, skill, (message) => {
      throw new Error(message);
    });
    if (evaluated.mode === "disabled") continue;
    const spec = evaluated.mode === "explicit" ? evaluated.spec : void 0;
    const semantics = resolveEffectiveSkillSemantics({ event, player, skill, info, spec, runtime: semanticRuntime });
    const collectSkillCards = () => {
      if (typeof player?.isOut === "function" && player.isOut()) return;
      const pool = player.getCards(semantics.position) || [];
      const addSkillCard = (card) => {
        const record = records.get(card) || { cardAction: false, skills: [] };
        if (!record.skills.includes(skill)) record.skills.push(skill);
        records.set(card, record);
      };
      if (semantics.complexCard || semantics.complexSelect) {
        if (!semantics.hasCardFilterRule) return;
        const minSelect = resolveMinCardSelect(semantics.effectiveSelectCard);
        const hasStarter = minSelect <= 0 || pool.some((card) => semantics.isMaterialCardEligible(card, event));
        if (!hasStarter) return;
        for (const card of pool) {
          if (semantics.isMaterialCardGuardEligible(card)) addSkillCard(card);
        }
        return;
      }
      for (const card of pool) {
        if (semantics.isMaterialCardEligible(card, event)) addSkillCard(card);
      }
    };
    const runWithBridge = () => withVirtualSelection(
      { ui, status: _status },
      { event, player, skill, cards: [], targets: [], buttons: [], synthesizeBackup: true, eventOverrides: semantics.eventOverrides },
      collectSkillCards
    );
    if (evaluated.mode === "explicit") runWithBridge();
    else {
      try {
        runWithBridge();
      } catch {
      }
    }
  }
  return Array.from(records, ([card, scopes], index) => ({ card, ref: `c${index}`, id: cardToId(card), name: get.translation(card), ...scopes }));
}
function getCandidateSkills(event, player) {
  const excluded = Array.isArray(event._aiexclude) ? event._aiexclude : [];
  const skills = game.expandSkills(player.getSkills("invisible").concat(lib.skill.global));
  return skills.filter((skill) => {
    const info = getRegisteredSkill(lib.skill, skill);
    return !excluded.some((item) => typeof item === "string" && (item === skill || typeof info?.sourceSkill === "string" && item === info.sourceSkill)) && isSkillEligible(event, player, skill);
  });
}
function isSkillEligible(event, player, skill) {
  const info = getRegisteredSkill(lib.skill, skill);
  if (!info) return false;
  const evaluated = evaluateSelectionSpec(info.selectionSpec, event, player, skill, (message) => {
    throw new Error(message);
  });
  if (evaluated.mode === "disabled") return false;
  const check = () => withVirtualSelection(
    { ui, status: _status },
    { event, player, cards: [], targets: [], buttons: [] },
    () => !!lib.filter.filterEnable(event, player, skill)
  );
  if (evaluated.mode === "explicit") return check();
  try {
    return check();
  } catch {
    return false;
  }
}
function getCandidateTargets(event, player, card) {
  if (!event.filterTarget) return [];
  const baseEvent = resolveBaseEvent(event);
  const cardInfo = card && typeof get?.info === "function" ? get.info(card) : void 0;
  const all = Array.from(game.players);
  if (event.deadTarget || baseEvent?.deadTarget || cardInfo?.deadTarget) all.push(...game.dead);
  return all.filter((t) => event.filterTarget(card, player, t));
}
function getCandidateTargetRefs(event, player, card) {
  const baseEvent = resolveBaseEvent(event);
  const cardInfo = card && typeof get?.info === "function" ? get.info(card) : void 0;
  const players = Array.from(game.players);
  if (event.deadTarget || baseEvent?.deadTarget || cardInfo?.deadTarget) players.push(...game.dead);
  return players.filter((target) => {
    if (!event.filterTarget || !card) return true;
    return event.filterTarget(card, player, target);
  }).map((target, index) => ({
    player: target,
    ref: `p${index}`,
    id: target.playerid || String(index),
    name: get.translation(target) || target.name || "未知"
  }));
}
function cardToId(card) {
  const name = card.name || "";
  const suit = card.originalSuit || card.suit || "";
  const num = card.originalNumber || card.number || "";
  return `${name}_${suit}_${num}`;
}
function findCardById(candidates, id) {
  const matches = candidates.filter((candidate) => candidate.id === id);
  return matches.length === 1 ? matches[0] : void 0;
}
export {
  cardToId,
  findCardById,
  getCandidateCards,
  getCandidateSkills,
  getCandidateTargetRefs,
  getCandidateTargets,
  isSkillEligible
};
