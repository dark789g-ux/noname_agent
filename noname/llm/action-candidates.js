import { withVirtualSelection } from "./legacy-bridge.js";
import { evaluateSelectionSpec, resolveUnifiedSkillPlan, normalizeSelectionStep, isSingleCardAddedTarget, splitAddedTargetPrimaryRange, hasComplexTargetFlags, evalFilterTargetValue, assertSupportedTargetRules as assertSupportedTargetRules$1 } from "./generic-skill-plan.js";
import { resolveEffectiveSkillSemantics, resolveBaseEvent, normalizeViewAsDefinition } from "./skill-backup-semantics.js";
function buildDecisionCandidateSnapshot(event, player, runtime) {
  const skills = strictCollect(() => runtime.getCandidateSkills(event, player), "skill candidate collection");
  const cards = strictCollect(() => runtime.getCandidateCards(event, player, skills), "card candidate collection");
  const targetPool = collectTargetPool(event, player, runtime, skills, cards);
  const skippedActions = [];
  const eventEvaluated = evaluateSelectionSpec(event.selectionSpec, event, player, "event", actionResolution);
  const cardActions = [];
  if (eventEvaluated.mode !== "disabled") {
    for (const card of cards.filter((item) => item.cardAction)) {
      const runCard = () => withVirtualSelection(
        runtime.legacyBridgeHost,
        { event, player, cards: [], targets: [], buttons: [] },
        () => buildCardAction(event, player, card, targetPool, runtime, eventEvaluated)
      );
      if (eventEvaluated.mode === "explicit") {
        cardActions.push(...runCard());
      } else {
        try {
          cardActions.push(...runCard());
        } catch (error) {
          skippedActions.push({ id: `card:${card.ref}`, reason: error?.message || "unknown error" });
        }
      }
    }
  }
  const skillActions = [];
  for (const skill of skills) {
    const info = runtime.getSkillInfo(skill);
    const evaluated = info ? evaluateSelectionSpec(info.selectionSpec, event, player, skill, actionResolution) : { mode: "disabled" };
    if (evaluated.mode === "disabled") continue;
    const spec = evaluated.mode === "explicit" ? evaluated.spec : void 0;
    const semantics = resolveEffectiveSkillSemantics({ event, player, skill, info, spec, runtime });
    const runSkill = () => withVirtualSelection(
      runtime.legacyBridgeHost,
      { event, player, skill, cards: [], targets: [], buttons: [], synthesizeBackup: true, eventOverrides: semantics.eventOverrides },
      () => buildSkillAction(event, player, skill, info, semantics, cards, targetPool, runtime)
    );
    if (evaluated.mode === "explicit") {
      skillActions.push(...runSkill());
    } else {
      try {
        skillActions.push(...runSkill());
      } catch (error) {
        skippedActions.push({ id: `skill:${skill}`, reason: error?.message || "unknown error" });
      }
    }
  }
  const actions = [...cardActions, ...skillActions];
  return skippedActions.length ? { cards, skills, targetPool, actions, skippedActions } : { cards, skills, targetPool, actions };
}
function buildCandidateSnapshot(event, player, runtime) {
  if (event.skill && ["chooseToUse", "chooseToRespond"].includes(event?.name)) {
    const cards2 = strictCollect(() => runtime.getCandidateCards(event, player, []), "backup material collection");
    return { cards: cards2.map((card) => ({ ...card, cardAction: false, skills: [event.skill] })), skills: [], targetPool: collectTargetPool(event, player, runtime, [event.skill], cards2), actions: [] };
  }
  if (["chooseToUse", "chooseToRespond"].includes(event?.name)) return buildDecisionCandidateSnapshot(event, player, runtime);
  const skills = [];
  const cards = strictCollect(() => runtime.getCandidateCards(event, player, skills), "card candidate collection");
  return { cards, skills, targetPool: collectTargetPool(event, player, runtime, skills, cards), actions: [] };
}
function resolveSkillActionPlan(event, player, skill, info) {
  return resolveUnifiedSkillPlan(event, player, skill, info, actionResolution);
}
function resolveAuthoritativeTargetRange(event, card, player, runtime) {
  const info = runtime.getCardInfo(card) || {};
  if (info.notarget) return [0, 0];
  const source = `decision=${event.name} card=${card?.name ?? "unknown"}`;
  if (runtime.defaultSelectTarget && event.selectTarget === runtime.defaultSelectTarget) {
    return inspectStepRange(() => runtime.defaultSelectTarget(card, player), `${source} source=lib.filter.selectTarget`);
  }
  let range;
  if (event.selectTarget !== void 0) {
    range = inspectStepRange(() => typeof event.selectTarget === "function" ? event.selectTarget() : event.selectTarget, `${source} source=event.selectTarget raw=${describeRange(event.selectTarget)}`);
  } else {
    range = inspectStepRange(() => typeof info.selectTarget === "function" ? info.selectTarget(card, player) : info.selectTarget ?? (info.filterTarget ? 1 : 0), `${source} source=card.selectTarget raw=${describeRange(info.selectTarget)}`);
  }
  runtime.checkSelectTarget(card, player, range);
  return normalizeRange(range, `${source} source=selectTarget mod`);
}
function actionResolution(message) {
  const error = new Error(message);
  error.stage = "translate/action-resolution";
  throw error;
}
function assertExecutableSnapshot(event, snapshot) {
  if (event.forced && !event.skill && ["chooseToUse", "chooseToRespond"].includes(event.name) && !snapshot.actions.length) actionResolution("forced decision has no executable action");
}
function isActionTargetCurrent(event, target, runtime, options) {
  const chessForceAll = !!(options?.chessForceAll ?? event?.chessForceAll);
  if (runtime.alivePlayers) {
    if (runtime.alivePlayers().includes(target)) {
      const isIn = (typeof target.isIn !== "function" || target.isIn()) && (typeof target.isOut !== "function" || !target.isOut());
      const includeOut = !!(options?.includeOut ?? event?.includeOut);
      if (!isIn && !includeOut) return false;
      if (!chessForceAll && runtime.isTargetChessReachable && !runtime.isTargetChessReachable(event, event?.player, target, false)) return false;
      return true;
    }
    const deadTarget = !!(options?.deadTarget ?? event?.deadTarget);
    if (!deadTarget || !runtime.deadPlayers?.().includes(target)) return false;
    if (!chessForceAll && runtime.isTargetChessReachable && !runtime.isTargetChessReachable(event, event?.player, target, false)) return false;
    return true;
  }
  if (!chessForceAll && runtime.isTargetChessReachable && !runtime.isTargetChessReachable(event, event?.player, target, false)) return false;
  return true;
}
function collectTargetPool(event, player, runtime, skills, cards) {
  const baseEvent = resolveBaseEvent(event);
  let needsDeadTarget = Boolean(event?.deadTarget || baseEvent?.deadTarget);
  if (!needsDeadTarget) {
    for (const candidate of cards) {
      if (runtime.getCardInfo(candidate.card)?.deadTarget) {
        needsDeadTarget = true;
        break;
      }
    }
  }
  if (!needsDeadTarget) {
    for (const skill of skills) {
      const info = runtime.getSkillInfo(skill);
      if (!info) continue;
      if (info.deadTarget) {
        needsDeadTarget = true;
        break;
      }
      const evaluated = evaluateSelectionSpec(info.selectionSpec, event, player, skill, () => void 0);
      const viewAs = (evaluated.mode === "explicit" ? evaluated.spec?.viewAs : void 0) ?? info.viewAs;
      if (viewAs && typeof viewAs !== "function") {
        const cardData = normalizeViewAsDefinition(viewAs);
        if (cardData && typeof cardData === "object" && runtime.getCardInfo(runtime.autoViewAs(cardData, []))?.deadTarget) {
          needsDeadTarget = true;
          break;
        }
      }
    }
  }
  const poolEvent = needsDeadTarget && !event?.deadTarget ? { ...event, deadTarget: true } : event;
  return runtime.getPlayers(poolEvent).map((target, index) => ({ player: target, ref: `p${index}`, id: runtime.getTargetId(target, index), name: runtime.getTargetName(target) }));
}
function buildCardAction(event, player, candidate, pool, runtime, eventEvaluated = evaluateSelectionSpec(event.selectionSpec, event, player, "event", actionResolution)) {
  if (eventEvaluated.mode === "disabled") return [];
  const info = runtime.getCardInfo(candidate.card) || {};
  const eventSpec = eventEvaluated.mode === "explicit" ? eventEvaluated.spec : void 0;
  const explicitSteps = eventSpec?.steps?.map((step, index) => normalizeSelectionStep(step, "event", index, actionResolution));
  if (eventSpec) {
    for (const step of explicitSteps || []) if (step.selectionMode === "sequential") actionResolution(`direct card has sequential step ${step.id}`);
    assertSupportedTargetRules(event, "direct card event");
    assertSupportedTargetRules(info, `card "${candidate.card?.name || candidate.ref}"`);
  }
  let target;
  if (event.name === "chooseToRespond") {
    const targetSteps = explicitSteps?.filter((step) => step.type === "target") || [];
    if (!targetSteps.length) target = { mode: "none", targetRefs: [] };
    else {
      const available = resolveExplicitTarget(event, player, candidate.card, targetSteps[0], pool);
      if (!available) return [];
      target = { mode: "dynamic", targetRefs: [], deferredStepId: targetSteps[0].id };
    }
  } else {
    if (explicitSteps && explicitSteps.filter((step) => step.type === "target").length > 1) actionResolution("direct card has multiple target steps that require headless rounds");
    const explicitTargetStep = explicitSteps?.find((step) => step.type === "target");
    if (explicitTargetStep) {
      target = resolveExplicitTarget(event, player, candidate.card, explicitTargetStep, pool, runtime, info);
    } else {
      const directLiveness = { deadTarget: !!(event.deadTarget || info.deadTarget), includeOut: !!(event.includeOut || info.includeOut), chessForceAll: !!(event.chessForceAll || info.chessForceAll) };
      const addedSource = isSingleCardAddedTarget(info) ? info : isSingleCardAddedTarget(event) ? event : void 0;
      if (addedSource) {
        const range = resolveAuthoritativeTargetRange(event, candidate.card, player, runtime);
        const primaryRange = splitAddedTargetPrimaryRange(range, !!(runtime.defaultSelectTarget && event.selectTarget === runtime.defaultSelectTarget));
        const primaryCandidates = pool.filter((item) => isActionTargetCurrent(event, item.player, runtime, directLiveness) && strictTargetFilter(void 0, void 0, event, candidate.card, player, item.player));
        const validPrimary = primaryCandidates.filter(
          (primary) => withVirtualSelection(
            runtime.legacyBridgeHost,
            { event, player, cards: [candidate.card], targets: [primary.player] },
            () => pool.some((added) => isActionTargetCurrent(event, added.player, runtime, directLiveness) && !!addedSource.filterAddedTarget(candidate.card, player, added.player, primary.player))
          )
        );
        if (validPrimary.length < primaryRange[0]) return [];
        target = { mode: "dynamic", targetRefs: [], deferredStepId: `card:${candidate.ref}:target:0` };
      } else if (hasComplexTargetFlags(info) || hasComplexTargetFlags(event)) {
        const range = resolveAuthoritativeTargetRange(event, candidate.card, player, runtime);
        if (range[1] === 0) {
          target = { mode: "none", range, targetRefs: [] };
        } else {
          const refs = pool.filter((item) => isActionTargetCurrent(event, item.player, runtime, directLiveness) && strictTargetFilter(void 0, void 0, event, candidate.card, player, item.player)).map((item) => item.ref);
          if (range[0] > refs.length) return [];
          target = { mode: "dynamic", targetRefs: [], deferredStepId: `card:${candidate.ref}:target:0` };
        }
      } else {
        target = resolveStaticTarget(event, player, candidate.card, pool, runtime);
      }
    }
  }
  return target ? [{ id: `card:${candidate.ref}`, kind: "card", tool: event.name === "chooseToRespond" ? "respond_card" : "use_card", cardRef: candidate.ref, materialCardRefs: [], target }] : [];
}
function buildSkillAction(event, player, skill, info, semantics, cards, pool, runtime) {
  const plan = resolveSkillActionPlan(event, player, skill, info);
  if (!plan) return [];
  if (plan.viewAs && typeof plan.viewAs !== "function") {
    const viewAsInfo = runtime.getCardInfo(semantics.resolveActiveCard([]));
    if (!plan.generic) assertSupportedTargetRules(viewAsInfo, `skill "${skill}" viewAs card`);
    else if (!plan.targetDeferred && hasComplexTargetFlags(viewAsInfo)) plan.targetDeferred = true;
  }
  const materialCardRefs = cards.filter((card) => card.skills?.includes(skill)).map((card) => card.ref);
  const rawMaterialRange = plan.cardStep ? inspectStepRange(plan.cardStep.select ?? semantics.effectiveSelectCard ?? 1, `decision=${event.name} skill=${skill} source=${plan.cardStep.id}.selectCard`) : void 0;
  const materialAutomatic = !!rawMaterialRange && rawMaterialRange[1] < 0;
  const materialRange = materialAutomatic ? [materialCardRefs.length, materialCardRefs.length] : rawMaterialRange ? [rawMaterialRange[0], Math.min(rawMaterialRange[1], materialCardRefs.length)] : void 0;
  if (materialRange && materialRange[0] > materialCardRefs.length) return [];
  let target;
  if (plan.targetDeferred) target = { mode: "dynamic", targetRefs: [], deferredStepId: plan.targetStep?.id };
  else target = resolveSkillTarget(event, player, skill, plan, info, semantics, pool, runtime);
  if (!target) return [];
  return [{ id: `skill:${skill}`, kind: "skill", tool: "use_skill", skillName: skill, materialCardRefs, materialRange, materialAutomatic, target }];
}
function resolveSkillTarget(event, player, skill, plan, info, semantics, pool, runtime) {
  if (!plan.targetStep) return { mode: "none", targetRefs: [] };
  const activeCard = semantics.hasViewAs ? semantics.resolveActiveCard([]) : void 0;
  let range;
  if (plan.targetStep.select !== void 0) {
    range = inspectStepRange(plan.targetStep.select, `decision=${event.name} skill=${skill} source=${plan.targetStep.id}.selectTarget`);
  } else if (info?.selectTarget !== void 0) {
    range = inspectStepRange(info.selectTarget, `decision=${event.name} skill=${skill} source=${plan.targetStep.id}.selectTarget`);
  } else if (activeCard) {
    range = resolveAuthoritativeTargetRange(semantics.baseEvent, activeCard, player, runtime);
  } else {
    range = inspectStepRange(info?.filterTarget ? 1 : 0, `decision=${event.name} skill=${skill} source=${plan.targetStep.id}.selectTarget`);
  }
  if (range[1] === 0) return { mode: "none", range, targetRefs: [] };
  const liveness = semantics.resolveTargetLiveness([]);
  const scopedPool = Array.isArray(plan.targetStep.items) ? pool.filter((candidate) => plan.targetStep.items.some((item) => item === candidate.player || item?.player === candidate.player || item === candidate.ref || item?.ref === candidate.ref)) : pool;
  const refs = scopedPool.filter((candidate) => {
    if (!isActionTargetCurrent(semantics.baseEvent, candidate.player, runtime, liveness)) return false;
    try {
      return semantics.isSkillTargetFilterMatch(candidate.player, [], plan.targetStep);
    } catch (error) {
      if (error?.stage) throw error;
      actionResolution(`target filter threw: ${error?.message || "unknown error"}`);
    }
  }).map((candidate) => candidate.ref);
  return targetFromRange(range, refs);
}
function resolveStaticTarget(event, player, card, pool, runtime) {
  const cardInfo = runtime.getCardInfo(card) || {};
  const directLiveness = { deadTarget: !!(event.deadTarget || cardInfo.deadTarget), includeOut: !!(event.includeOut || cardInfo.includeOut), chessForceAll: !!(event.chessForceAll || cardInfo.chessForceAll) };
  const dying = event.dying || event._trigger?.dying;
  if (card?.name === "tao" && dying) {
    const target = pool.find((candidate) => candidate.player === dying && isActionTargetCurrent(event, candidate.player, runtime, directLiveness));
    if (target) return { mode: "automatic", range: [1, 1], targetRefs: [target.ref] };
  }
  const range = resolveAuthoritativeTargetRange(event, card, player, runtime);
  if (range[1] === 0) return { mode: "none", range, targetRefs: [] };
  const refs = pool.filter((candidate) => isActionTargetCurrent(event, candidate.player, runtime, directLiveness) && strictTargetFilter(void 0, void 0, event, card, player, candidate.player)).map((candidate) => candidate.ref);
  return targetFromRange(range, refs);
}
function resolveExplicitTarget(event, player, card, step, pool, runtime, cardInfo) {
  const range = inspectStepRange(step.select ?? event.selectTarget ?? 1, `decision=${event.name} card=${card?.name ?? "unknown"} source=${step.id}.selectTarget`);
  const directLiveness = { deadTarget: !!(event.deadTarget || cardInfo?.deadTarget), includeOut: !!(event.includeOut || cardInfo?.includeOut), chessForceAll: !!(event.chessForceAll || cardInfo?.chessForceAll) };
  const scopedPool = Array.isArray(step.items) ? pool.filter((candidate) => step.items.some((item) => item === candidate.player || item?.player === candidate.player || item === candidate.ref || item?.ref === candidate.ref)) : pool;
  const refs = scopedPool.filter((candidate) => (!runtime || isActionTargetCurrent(event, candidate.player, runtime, directLiveness)) && strictTargetFilter(step, void 0, event, card, player, candidate.player)).map((candidate) => candidate.ref);
  return targetFromRange(range, refs);
}
function targetFromRange(range, refs) {
  if (range[1] < 0) return refs.length ? { mode: "automatic", range: [refs.length, refs.length], targetRefs: refs } : void 0;
  if (range[0] > refs.length) return void 0;
  return { mode: "select", range: [range[0], Math.min(range[1], refs.length)], targetRefs: refs };
}
function strictTargetFilter(step, info, event, card, player, target) {
  try {
    if (typeof step?.filter === "function") return !!step.filter(target, player, Object.freeze({ selected: Object.freeze({ card: [], target: [] }) }), []);
    if (info?.filterTarget !== void 0) return evalFilterTargetValue(info.filterTarget, card, player, target);
    return typeof event.filterTarget !== "function" || !!event.filterTarget(card, player, target);
  } catch (error) {
    actionResolution(`target filter threw: ${error?.message || "unknown error"}`);
  }
}
function assertSupportedTargetRules(source, label) {
  assertSupportedTargetRules$1(source, label, actionResolution);
}
function inspectStepRange(select, source) {
  try {
    return normalizeRange(typeof select === "function" ? select(Object.freeze({ selected: Object.freeze({ card: [], target: [] }) }), [], void 0) : select, `${source} raw=${describeRange(select)}`);
  } catch (error) {
    actionResolution(`selection range cannot be resolved (${source}): ${error?.message || "unknown error"}`);
  }
}
function normalizeRange(select, source) {
  if (typeof select === "number" && !Number.isNaN(select)) return [select, select];
  if (Array.isArray(select) && select.length === 2 && select.every((value) => typeof value === "number" && !Number.isNaN(value))) return [select[0], select[1]];
  actionResolution(`selection range must be numeric (${source} result=${describeRange(select)})`);
}
function describeRange(value, depth = 0) {
  if (Array.isArray(value))
    return depth ? "array" : `[${value.slice(0, 4).map((item) => describeRange(item, depth + 1)).join(",")}]`;
  if (value === null) return "null";
  if (["number", "boolean", "undefined"].includes(typeof value)) return `${typeof value}:${String(value)}`;
  return typeof value === "string" ? `string:${JSON.stringify(value.slice(0, 100))}` : typeof value;
}
function strictCollect(collect, label) {
  try {
    return collect();
  } catch (error) {
    if (error?.stage) throw error;
    actionResolution(`${label} threw: ${error?.message || "unknown error"}`);
  }
}
export {
  actionResolution,
  assertExecutableSnapshot,
  assertSupportedTargetRules,
  buildCandidateSnapshot,
  buildDecisionCandidateSnapshot,
  resolveAuthoritativeTargetRange,
  resolveSkillActionPlan
};
