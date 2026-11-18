import { evalFilterTargetValue } from "./generic-skill-plan.js";
import { withVirtualSelection } from "./legacy-bridge.js";
import { uniqueLegacyMatch } from "./protocol.js";
import { fail, normalizeRange } from "./selection-adapter.js";
import { matchesSelectionFilter } from "./selection-filter.js";
function resolveCandidateCards(cards, candidates, refs, action, min, max = Infinity) {
  if (!Array.isArray(refs) || refs.length < min || refs.length > max) fail(`${action}: invalid card count`);
  const values = refs.map((ref) => cards.get(ref)?.card || uniqueLegacyMatch(candidates, ref, (candidate) => candidate.id)?.card);
  if (values.some((card) => !card) || new Set(values).size !== values.length) fail(`${action}: unknown or duplicate card reference`);
  return values;
}
function resolveCandidateTargets(targets, refs, action) {
  const values = refs || [];
  const result = values.map((ref) => targets.get(ref)?.player);
  if (result.some((target) => !target) || new Set(result).size !== result.length) fail(`${action}: unknown or duplicate target reference`);
  return result;
}
function isCardOwned(event, card, runtime) {
  try {
    return runtime.getOwner(card) === event.player || event.player.getCards("hejxs").includes(card);
  } catch {
    return false;
  }
}
function isTargetCurrent(event, target, runtime, options) {
  const chessForceAll = !!(options?.skipChess || (options?.chessForceAll ?? event?.chessForceAll));
  if (runtime.alivePlayers().includes(target)) {
    const isIn = (typeof target.isIn !== "function" || target.isIn()) && (typeof target.isOut !== "function" || !target.isOut());
    const includeOut = !!(options?.includeOut ?? event?.includeOut);
    if (!isIn && !includeOut) return false;
    if (!chessForceAll && runtime.isTargetChessReachable && !runtime.isTargetChessReachable(event, event?.player, target, false)) return false;
    return true;
  }
  const deadTarget = !!(options?.deadTarget ?? event?.deadTarget);
  if (!deadTarget || !runtime.deadPlayers().includes(target)) return false;
  if (!chessForceAll && runtime.isTargetChessReachable && !runtime.isTargetChessReachable(event, event?.player, target, false)) return false;
  return true;
}
function assertCardLegal(event, card, runtime) {
  try {
    if (!isCardOwned(event, card, runtime)) fail("card is no longer owned by the player");
    if (runtime.isCardRespondable && !runtime.isCardRespondable(card, event.player)) fail("card is no longer legal");
    if (event.filterCard !== void 0 && !matchesSelectionFilter(event.filterCard, card, event.player, event, runtime.normalizeFilter, event)) fail("card is no longer legal");
  } catch (error) {
    if (error?.stage) throw error;
    fail("card legality could not be verified");
  }
}
function assertTargetLegal(event, target, card, runtime, options) {
  try {
    if (!isTargetCurrent(event, target, runtime, options)) fail("target is no longer current");
    if (event.filterTarget !== void 0 && !evalFilterTargetValue(event.filterTarget, card, event.player, target)) fail("target is no longer legal");
  } catch (error) {
    if (error?.stage) throw error;
    fail("target legality could not be verified");
  }
}
function requireAction(snapshot, tool, id, skill) {
  if (!snapshot) return void 0;
  const action = snapshot.actions.find((value) => value.tool === tool && (skill ? value.skillName === skill : value.cardRef === id));
  if (!action) fail(`${tool}: action is not in the decision snapshot`);
  return action;
}
function assertActionTargets(action, refs, tool) {
  const supplied = refs || [];
  if (!action) return supplied;
  const target = action.target;
  if (target.mode === "automatic") return target.targetRefs.slice();
  if (target.mode === "none") {
    if (supplied.length) fail(`${tool}: action has no selectable targets`);
    return [];
  }
  if (target.mode === "dynamic") return supplied;
  if (supplied.some((ref) => !target.targetRefs.includes(ref))) fail(`${tool}: target is not allowed by this action`);
  const [min, max] = target.range || [0, 0];
  if (supplied.length < min || supplied.length > max) fail(`${tool}: target count is outside action range`);
  return supplied;
}
function formatTargetInstruction(info, event, targetOrder, targetStepsCount) {
  const prompts = Array.isArray(info?.targetprompt) ? info.targetprompt : Array.isArray(event?.targetprompt) ? event.targetprompt : void 0;
  if (!prompts?.length) return void 0;
  if (targetStepsCount > 1) return `当前目标（${targetOrder + 1}/${targetStepsCount}）：${prompts[Math.min(targetOrder, prompts.length - 1)]}`;
  return prompts.map((text, idx) => `第 ${idx + 1} 名：${text}`).join("；");
}
function directCardTargetLiveness(event, card, getCardInfo) {
  const cardInfo = card ? getCardInfo?.(card) : void 0;
  if (!cardInfo) return void 0;
  return { deadTarget: !!(event.deadTarget || cardInfo.deadTarget), includeOut: !!(event.includeOut || cardInfo.includeOut), chessForceAll: !!(event.chessForceAll || cardInfo.chessForceAll) };
}
function resolveAddedTargetPreTarget(stages, rawId, getStepSelected, targetMap) {
  const currentIndex = stages.findIndex((stage) => stage.id === rawId);
  const priorRefs = stages.slice(0, currentIndex >= 0 ? currentIndex : void 0).filter((stage) => stage.type === "target").flatMap((stage) => getStepSelected(stage.id));
  return priorRefs.length ? targetMap.get(priorRefs[priorRefs.length - 1])?.player : void 0;
}
const SESSION_SCALAR_KEYS = [
  "currentStageIndex",
  "skillName",
  "directKind",
  "backupKind",
  "backupInfo",
  "backupSpec",
  "skillInfo",
  "skillSpec",
  "skillSemantics",
  "skillFilterInstalled",
  "hasExplicitFinalPredicate",
  "activeAction",
  "responseCard",
  "directUseCard"
];
function captureSelectionCheckpoint(target, selection, stepItems, stepIdentities, stages, automaticSteps) {
  const snap = {
    selectionSteps: Array.from(selection.steps.entries()),
    selectionFilterOk: selection.filterOk,
    contextSelections: Array.from(selection.context.selections.entries()).map(([stepId, entry]) => [
      stepId,
      { type: entry.type, items: entry.items.slice() }
    ]),
    stepItems: Array.from(stepItems.entries()).map(([stepId, map]) => [stepId, new Map(map)]),
    stepIdentities: Array.from(stepIdentities.entries()).map(([stepId, map]) => [
      stepId,
      new Map(Array.from(map.entries()).map(([key, value]) => [key, { ...value }]))
    ]),
    stages: stages.slice(),
    automaticSteps: automaticSteps.slice()
  };
  for (const key of SESSION_SCALAR_KEYS) snap[key] = target[key];
  return snap;
}
function restoreSelectionCheckpoint(snap, target, selection, stepItems, stepIdentities, automaticSteps) {
  selection.steps.clear();
  for (const [id, step] of snap.selectionSteps) selection.steps.set(id, step);
  selection.filterOk = snap.selectionFilterOk;
  selection.context.selections.clear();
  for (const [stepId, entry] of snap.contextSelections) {
    selection.context.selections.set(stepId, { type: entry.type, items: entry.items.slice() });
  }
  stepItems.clear();
  for (const [stepId, map] of snap.stepItems) stepItems.set(stepId, new Map(map));
  stepIdentities.clear();
  for (const [stepId, map] of snap.stepIdentities) stepIdentities.set(stepId, new Map(map));
  automaticSteps.length = 0;
  automaticSteps.push(...snap.automaticSteps);
  for (const key of SESSION_SCALAR_KEYS) target[key] = snap[key];
  return snap.stages.slice();
}
function buildDecisionLogResult(result, selected) {
  const plain = { bool: result?.bool };
  if (typeof result?.skill === "string") plain.skill = result.skill;
  for (const type of ["button", "card", "target", "control", "number"]) {
    const refs = selected(type);
    if (refs.length) plain[`${type}_refs`] = refs;
  }
  if (Array.isArray(result?.numbers)) plain.numbers = result.numbers.slice();
  if (typeof result?.control === "string") plain.control = result.control;
  if (typeof result?.index === "number") plain.index = result.index;
  return plain;
}
function materializeResponseResult(card, targets) {
  return targets.length ? { bool: true, card, cards: [card], targets } : { bool: true, card, cards: [card] };
}
function resolveCurrentAction(snapshot, skill, active) {
  return active || (skill ? snapshot?.actions.find((action) => action.kind === "skill" && action.skillName === skill) : void 0);
}
function resolveActionCardRefs(action, cards) {
  return action?.cardRef ? [action.cardRef] : action?.materialCardRefs || cards.map((card) => card.ref);
}
function hasLegalDirectTargetCandidate(event, targets, runtime, value, kind) {
  return withVirtualSelection(
    runtime.legacyBridgeHost,
    { event, player: event.player, cards: kind === "card" ? [value] : [], targets: [], buttons: kind === "button" ? [value] : [] },
    () => {
      const rawSelect = typeof event.selectTarget === "function" ? event.selectTarget() : event.selectTarget;
      const [minTargets, maxTargets] = normalizeRange(rawSelect);
      if (maxTargets < 0 || minTargets <= 0) return true;
      const card = kind === "card" ? value : value?.link;
      let count = 0;
      for (const target of targets) {
        if (isTargetCurrent(event, target.player, runtime) && evalFilterTargetValue(event.filterTarget, card, event.player, target.player)) {
          if (++count >= minTargets) return true;
        }
      }
      return false;
    }
  );
}
export {
  assertActionTargets,
  assertCardLegal,
  assertTargetLegal,
  buildDecisionLogResult,
  captureSelectionCheckpoint,
  directCardTargetLiveness,
  formatTargetInstruction,
  hasLegalDirectTargetCandidate,
  isCardOwned,
  isTargetCurrent,
  materializeResponseResult,
  requireAction,
  resolveActionCardRefs,
  resolveAddedTargetPreTarget,
  resolveCandidateCards,
  resolveCandidateTargets,
  resolveCurrentAction,
  restoreSelectionCheckpoint
};
