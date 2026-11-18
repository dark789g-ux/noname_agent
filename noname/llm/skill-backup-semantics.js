import { matchesSelectionFilter } from "./selection-filter.js";
function resolveBaseEvent(event) {
  if (!event || typeof event !== "object") return event;
  if (event.skill && event._backup && typeof event._backup === "object") {
    return { ...event, ...event._backup };
  }
  return { ...event };
}
function normalizeViewAsDefinition(definition) {
  return typeof definition === "string" ? { name: definition } : definition;
}
function resolvePoolTargetFlags(params) {
  const { event, cards, skills, activeSkill, activeSpec, activeSemantics, selectedCards = [], runtime } = params;
  const baseEvent = resolveBaseEvent(event);
  let deadTarget = !!baseEvent?.deadTarget;
  let includeOut = !!baseEvent?.includeOut;
  const inspectCard = (card) => {
    const cardInfo = card ? runtime.getCardInfo?.(card) : void 0;
    if (cardInfo?.deadTarget) deadTarget = true;
    if (cardInfo?.includeOut) includeOut = true;
  };
  for (const candidate of cards) inspectCard(candidate.card);
  const allSkills = activeSkill ? [activeSkill, ...skills] : skills;
  for (const skill of allSkills) {
    const info = runtime.getSkillInfo?.(skill);
    if (!info) continue;
    if (info.deadTarget) deadTarget = true;
    if (info.includeOut) includeOut = true;
    const viewAs = (skill === activeSkill ? activeSpec?.viewAs : void 0) ?? info.viewAs;
    if (viewAs && typeof viewAs !== "function") {
      const def = normalizeViewAsDefinition(viewAs);
      if (def && typeof def === "object" && runtime.autoViewAs) inspectCard(runtime.autoViewAs(def, []));
    }
  }
  if (activeSemantics) {
    const liveness = activeSemantics.resolveTargetLiveness(selectedCards);
    deadTarget ||= liveness.deadTarget;
    includeOut ||= liveness.includeOut;
  }
  return { deadTarget, includeOut, chessForceAll: true };
}
function evalTargetFilter(filterTarget, card, player, target, normalize) {
  if (filterTarget === true || filterTarget == null) return true;
  if (filterTarget === false) return false;
  if (typeof filterTarget === "function") return !!filterTarget(card, player, target);
  if (typeof filterTarget === "object" && !Array.isArray(filterTarget) && normalize) {
    return !!normalize(filterTarget)(card, player, target);
  }
  return false;
}
function normalizeEventFilter(filter, normalize) {
  if (typeof filter === "boolean") return () => filter;
  if (typeof filter === "object" && filter !== null && !Array.isArray(filter) && normalize) return normalize(filter);
  return filter;
}
function resolveEffectiveSkillSemantics(params) {
  const { event, player, info, spec, runtime = {} } = params;
  const baseEvent = resolveBaseEvent(event);
  const viewAsSource = spec?.viewAs ?? info?.viewAs;
  const hasViewAs = Boolean(viewAsSource);
  const cardStep = spec?.steps?.find((step) => step.type === "card");
  const targetStep = spec?.steps?.find((step) => step.type === "target");
  const hasExplicitStepCardFilter = typeof cardStep?.filter === "function";
  const hasExplicitStepTargetFilter = typeof targetStep?.filter === "function";
  const position = hasViewAs ? info?.position ?? baseEvent?.position ?? "hs" : info?.position ?? "h";
  const complexSelect = hasViewAs ? Boolean(info?.complexSelect ?? baseEvent?.complexSelect) : Boolean(info?.complexSelect);
  const complexCard = hasViewAs ? Boolean(info?.complexCard ?? baseEvent?.complexCard) : Boolean(info?.complexCard);
  const complexTarget = hasViewAs ? Boolean(info?.complexTarget ?? baseEvent?.complexTarget) : Boolean(info?.complexTarget);
  const inheritsBaseFilterCard = hasViewAs && info?.filterCard === void 0;
  const effectiveFilterCard = hasExplicitStepCardFilter ? cardStep.filter : inheritsBaseFilterCard ? baseEvent?.filterCard : info?.filterCard;
  const filterCardReceiver = inheritsBaseFilterCard ? baseEvent : info;
  const hasCardFilterRule = hasExplicitStepCardFilter || effectiveFilterCard !== void 0 && effectiveFilterCard !== false && effectiveFilterCard !== null;
  const effectiveSelectCard = cardStep?.select ?? (hasViewAs ? info?.selectCard ?? baseEvent?.selectCard : info?.selectCard);
  const effectiveFilterTarget = hasExplicitStepTargetFilter ? targetStep.filter : hasViewAs ? info?.filterTarget !== void 0 ? info.filterTarget : baseEvent?.filterTarget : info?.filterTarget;
  const effectiveSelectTarget = targetStep?.select ?? (hasViewAs ? info?.selectTarget : info?.selectTarget);
  const checkModCardEnabled2 = (card) => {
    if (!(hasViewAs && info?.filterCard !== void 0 && !info?.ignoreMod && player && runtime.checkCardEnabled2)) {
      return "unchanged";
    }
    return runtime.checkCardEnabled2(card, player);
  };
  const isMaterialCardGuardEligible = (card) => {
    if (typeof player?.isOut === "function" && player.isOut()) return false;
    if (runtime.isCardRespondable && !runtime.isCardRespondable(card, player)) return false;
    if (!hasViewAs && hasCardFilterRule && info?.discard !== false && info?.lose !== false && runtime.isCardDiscardable) {
      if (!runtime.isCardDiscardable(card, player)) return false;
    }
    const mod = checkModCardEnabled2(card);
    if (mod !== "unchanged") return !!mod;
    return true;
  };
  const isMaterialCardEligible = (card, evalEvent = event) => {
    if (typeof player?.isOut === "function" && player.isOut()) return false;
    if (runtime.isCardRespondable && !runtime.isCardRespondable(card, player)) return false;
    if (!hasViewAs && hasCardFilterRule && info?.discard !== false && info?.lose !== false && runtime.isCardDiscardable) {
      if (!runtime.isCardDiscardable(card, player)) return false;
    }
    const mod = checkModCardEnabled2(card);
    if (mod !== "unchanged") return !!mod;
    if (hasExplicitStepCardFilter) return !!cardStep.filter(card, player, evalEvent, []);
    if (effectiveFilterCard == null || effectiveFilterCard === false) return false;
    return matchesSelectionFilter(effectiveFilterCard, card, player, filterCardReceiver, runtime.normalizeFilter, evalEvent);
  };
  const resolveActiveCard = (selectedCards = []) => {
    if (hasViewAs) {
      const rawDef = typeof viewAsSource === "function" ? viewAsSource(selectedCards, player) : viewAsSource;
      if (!rawDef) return void 0;
      const cardData = normalizeViewAsDefinition(rawDef);
      if (!cardData || typeof cardData !== "object") return rawDef;
      const sourceCards = selectedCards.length ? selectedCards : "cards" in cardData && Array.isArray(cardData.cards) ? cardData.cards : [];
      return runtime.autoViewAs ? runtime.autoViewAs(cardData, sourceCards) : { ...cardData, cards: sourceCards };
    }
    if (selectedCards.length) {
      return runtime.autoViewAs ? runtime.autoViewAs(selectedCards[0], selectedCards) : selectedCards[0];
    }
    return baseEvent?._get_card;
  };
  const resolveTargetLiveness = (selectedCards = []) => {
    const canInspectViewAs = !hasViewAs || typeof viewAsSource !== "function" || selectedCards.length > 0 || !hasCardFilterRule;
    const activeCard = canInspectViewAs ? resolveActiveCard(selectedCards) : void 0;
    const cardInfo = activeCard && runtime.getCardInfo ? runtime.getCardInfo(activeCard) || {} : {};
    return {
      deadTarget: Boolean((hasViewAs || targetStep?.items !== void 0 ? info?.deadTarget ?? baseEvent?.deadTarget : info?.deadTarget) || cardInfo.deadTarget),
      includeOut: Boolean(baseEvent?.includeOut || info?.includeOut || cardInfo.includeOut),
      chessForceAll: Boolean((hasViewAs ? info?.chessForceAll ?? baseEvent?.chessForceAll : info?.chessForceAll) || cardInfo.chessForceAll)
    };
  };
  const isSkillTargetFilterMatch = (target, selectedCards = [], step, context, selected) => {
    const stepFilter = step?.filter;
    if (typeof stepFilter === "function") {
      return !!stepFilter(target, player, context ?? Object.freeze({ selected: Object.freeze({ card: [], target: [] }) }), selected ?? []);
    }
    const activeCard = resolveActiveCard(selectedCards);
    if (hasViewAs) {
      const filter = info?.filterTarget !== void 0 ? info.filterTarget : baseEvent?.filterTarget;
      return evalTargetFilter(filter, activeCard, player, target, runtime.normalizeFilter);
    }
    if (info?.filterTarget !== void 0) {
      return evalTargetFilter(info.filterTarget, activeCard, player, target, runtime.normalizeFilter);
    }
    return true;
  };
  const resolveFinalOk = (selectedCards, activeCard, context, evalEvent = event) => {
    if (hasViewAs && typeof baseEvent?.filterCard === "function") {
      const resolved = activeCard ?? resolveActiveCard(selectedCards);
      if (!baseEvent.filterCard(resolved, player, evalEvent)) return false;
    }
    if (typeof spec?.finalPredicate === "function") {
      return spec.finalPredicate(context, evalEvent, player) !== false;
    }
    if (typeof info?.filterOk === "function") return !!info.filterOk();
    if (hasViewAs && typeof baseEvent?.filterOk === "function") return !!baseEvent.filterOk();
    return true;
  };
  const eventOverrides = {};
  if (hasViewAs) {
    if (info?.filterButton !== void 0) eventOverrides.filterButton = normalizeEventFilter(info.filterButton, runtime.normalizeFilter);
    if (info?.selectButton !== void 0) eventOverrides.selectButton = info.selectButton;
    if (info?.filterTarget !== void 0) eventOverrides.filterTarget = normalizeEventFilter(info.filterTarget, runtime.normalizeFilter);
    if (info?.selectTarget !== void 0) eventOverrides.selectTarget = info.selectTarget;
    if (info?.deadTarget !== void 0) eventOverrides.deadTarget = info.deadTarget;
    if (info?.chessForceAll !== void 0) eventOverrides.chessForceAll = info.chessForceAll;
    if (info?.filterCard !== void 0) {
      if (info.ignoreMod) eventOverrides.ignoreMod = true;
      eventOverrides.filterCard = (card, _p, evtArg) => isMaterialCardEligible(card, evtArg || event);
    }
    if (info?.selectCard !== void 0) eventOverrides.selectCard = info.selectCard;
    if (info?.position !== void 0) eventOverrides.position = info.position;
    if (info?.allowChooseAll !== void 0) eventOverrides.allowChooseAll = info.allowChooseAll;
    if (info?.complexSelect !== void 0) eventOverrides.complexSelect = info.complexSelect;
    if (info?.complexCard !== void 0) eventOverrides.complexCard = info.complexCard;
    if (info?.complexTarget !== void 0) eventOverrides.complexTarget = info.complexTarget;
  } else {
    eventOverrides.filterButton = info?.filterButton ? normalizeEventFilter(info.filterButton, runtime.normalizeFilter) : void 0;
    eventOverrides.selectButton = info?.selectButton;
    eventOverrides.filterTarget = info?.filterTarget !== void 0 ? normalizeEventFilter(info.filterTarget, runtime.normalizeFilter) : void 0;
    eventOverrides.selectTarget = info?.selectTarget;
    eventOverrides.deadTarget = info?.deadTarget;
    eventOverrides.chessForceAll = info?.chessForceAll;
    eventOverrides.filterCard = info?.filterCard !== void 0 ? (card, _p, evtArg) => isMaterialCardEligible(card, evtArg || event) : void 0;
    eventOverrides.selectCard = info?.selectCard;
    eventOverrides.position = info?.position;
    eventOverrides.allowChooseAll = info?.allowChooseAll;
    eventOverrides.complexSelect = info?.complexSelect;
    eventOverrides.complexCard = info?.complexCard;
    eventOverrides.complexTarget = info?.complexTarget;
    eventOverrides.filterOk = info?.filterOk;
  }
  if (info?.ai1 !== void 0) eventOverrides.ai1 = info.ai1;
  if (info?.ai2 !== void 0) eventOverrides.ai2 = info.ai2;
  return {
    baseEvent,
    hasViewAs,
    viewAsSource,
    position,
    hasExplicitStepCardFilter,
    hasExplicitStepTargetFilter,
    hasCardFilterRule,
    effectiveFilterCard,
    filterCardReceiver,
    effectiveSelectCard,
    complexCard,
    complexTarget,
    complexSelect,
    effectiveFilterTarget,
    effectiveSelectTarget,
    resolveActiveCard,
    resolveTargetLiveness,
    isMaterialCardGuardEligible,
    isMaterialCardEligible,
    isSkillTargetFilterMatch,
    resolveFinalOk,
    eventOverrides
  };
}
export {
  normalizeViewAsDefinition,
  resolveBaseEvent,
  resolveEffectiveSkillSemantics,
  resolvePoolTargetFlags
};
