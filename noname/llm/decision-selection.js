import "../library/selection/index.js";
import { assertSupportedTargetRules, resolveAuthoritativeTargetRange } from "./action-candidates.js";
import { resolveCurrentAction, resolveActionCardRefs, isCardOwned, isTargetCurrent, buildDecisionLogResult, formatTargetInstruction, resolveAddedTargetPreTarget, directCardTargetLiveness, resolveCandidateCards, captureSelectionCheckpoint, restoreSelectionCheckpoint } from "./decision-validation.js";
import { matchesSelectionFilter } from "./selection-filter.js";
import { getViewAsSource, resolveViewAs } from "./backup-protocol.js";
import { evaluateSelectionSpec } from "./generic-skill-plan.js";
import { withVirtualSelection } from "./legacy-bridge.js";
import { selectionRequired } from "./protocol.js";
import { fail, resolveSelectionSpec, actionResolution, labelFor, deriveSimpleSteps, normalizeRange, formatSelectionFailure, shortRefPrefix } from "./selection-adapter.js";
import { resolvePoolTargetFlags, resolveBaseEvent, resolveEffectiveSkillSemantics } from "./skill-backup-semantics.js";
import { SelectionSession } from "../library/selection/session.js";
import { SelectionContext } from "../library/selection/context.js";
import { SelectionStep } from "../library/selection/step.js";
class DecisionSelection {
  constructor(event, candidates, runtime, targets = "targetPool" in candidates ? candidates.targetPool : []) {
    this.event = event;
    this.candidates = candidates;
    this.runtime = runtime;
    if (event?.selectionSpec === false) fail("decision disabled by selectionSpec: false");
    if ("targetPool" in candidates) this.snapshot = candidates;
    for (const card of candidates.cards) this.cardMap.set(card.ref, card);
    for (const target of targets) this.targetMap.set(target.ref, target);
    this.eventSpec = resolveSelectionSpec(event.selectionSpec, event, event.player);
    this.selection = new SelectionSession({ context: new SelectionContext({ event, player: event.player, source: "llm" }), filterOk: this.eventSpec?.finalPredicate ? (context) => this.eventSpec.finalPredicate(context, event, event.player) : void 0 });
    this.hasExplicitFinalPredicate = !!this.eventSpec?.finalPredicate;
  }
  cardMap = /* @__PURE__ */ new Map();
  targetMap = /* @__PURE__ */ new Map();
  selection;
  stepItems = /* @__PURE__ */ new Map();
  automaticSteps = [];
  stepIdentities = /* @__PURE__ */ new Map();
  skillName;
  stages = [];
  currentStageIndex = 0;
  directKind;
  backupKind;
  backupInfo;
  backupSpec;
  skillInfo;
  skillSpec;
  skillSemantics;
  skillFilterInstalled = false;
  hasExplicitFinalPredicate = false;
  eventSpec;
  snapshot;
  activeAction;
  responseCard;
  directUseCard;
  get stage() {
    this.advanceAutomaticStages();
    const stage = this.stages[this.currentStageIndex];
    if (!stage) return void 0;
    const inspection = this.selection.evaluate(stage.id).inspection;
    if (!inspection) return stage;
    const available = inspection.entries.filter((entry) => entry.available);
    if (!inspection.automatic && inspection.range[0] > available.length) actionResolution(`selection ${stage.id} has no legal continuation`);
    return { ...stage, range: inspection.automatic ? [inspection.automaticSelected.length, inspection.automaticSelected.length] : [inspection.range[0], Math.min(inspection.range[1], available.length)], items: available.map((entry) => ({ ref: entry.item, label: this.stepItems.get(stage.id)?.has(entry.item) ? labelFor(this.stepItems.get(stage.id)?.get(entry.item), this.runtime.translate) : String(entry.item) })) };
  }
  isInitialStageImpossible() {
    if (this.currentStageIndex !== 0) return false;
    this.advanceAutomaticStages();
    const stage = this.stages[this.currentStageIndex];
    if (!stage) return false;
    const inspection = this.selection.evaluate(stage.id).inspection;
    if (!inspection) return false;
    const availableCount = inspection.entries.filter((entry) => entry.available).length;
    return !inspection.automatic && inspection.range[0] > availableCount;
  }
  advanceAutomaticStages() {
    while (this.currentStageIndex < this.stages.length) {
      const stage = this.stages[this.currentStageIndex];
      const outcome = this.selection.evaluate(stage.id);
      if (!outcome.inspection?.automatic && outcome.inspection?.range[1] !== 0) break;
      if (outcome.status === "invalid" || outcome.status === "unsupported") fail(`selection: automatic ${stage.id} is invalid`);
      this.automaticSteps.push(stage.id);
      this.currentStageIndex++;
    }
  }
  currentActionTargetRefs() {
    if (!this.snapshot) return Array.from(this.targetMap.keys());
    const action = resolveCurrentAction(this.snapshot, this.skillName, this.activeAction);
    return action?.target.mode === "select" || action?.target.mode === "automatic" ? action.target.targetRefs : Array.from(this.targetMap.keys());
  }
  currentActionCardRefs() {
    return resolveActionCardRefs(resolveCurrentAction(this.snapshot, this.skillName, this.activeAction), this.candidates.cards);
  }
  revalidate() {
    if (this.candidates.cards.some((candidate) => !isCardOwned(this.event, candidate.card, this.runtime))) fail("candidate card ownership changed during decision");
    const poolFlags = resolvePoolTargetFlags({ event: this.event, cards: this.candidates.cards, skills: this.candidates.skills, activeSkill: this.skillName, activeSpec: this.skillSpec, activeSemantics: this.skillSemantics, selectedCards: this.selectedCards(), runtime: this.runtime });
    if (Array.from(this.targetMap.values()).some((candidate) => !isTargetCurrent(resolveBaseEvent(this.event), candidate.player, this.runtime, poolFlags))) fail("candidate target state changed during decision");
    if (this.candidates.skills.some((skill) => !this.runtime.isSkillEligible(this.event, this.event.player, skill))) fail("candidate skill eligibility changed during decision");
    if (this.stage) {
      const outcome = this.selection.evaluate(this.stage.id);
      if (outcome.status === "invalid" || outcome.status === "unsupported") fail(`selection: current stage is no longer valid (${outcome.reason || outcome.status})`);
    }
  }
  resolveSkillSemantics(info, spec) {
    return resolveEffectiveSkillSemantics({ event: this.event, player: this.event.player, skill: this.skillName, info, spec, runtime: this.runtime });
  }
  selectedCards() {
    return this.selectedValues("card").map((ref) => this.cardMap.get(ref)?.card).filter(Boolean);
  }
  toLogResult(result) {
    return { ...buildDecisionLogResult(result, (type) => this.selectedValues(type)), ...this.automaticSteps.length ? { automatic_steps: this.automaticSteps.slice() } : {} };
  }
  registerSkillSteps(spec, info, plannedSteps) {
    const rawSteps = plannedSteps || spec.steps?.slice() || deriveSimpleSteps(info);
    const semantics = this.skillName ? this.skillSemantics || this.resolveSkillSemantics(info, spec) : void 0;
    const targetStepsCount = rawSteps.filter((step) => step.type === "target").length;
    const prompts = Array.isArray(info?.targetprompt) ? info.targetprompt : Array.isArray(this.event?.targetprompt) ? this.event.targetprompt : void 0;
    let targetOrder = 0;
    return rawSteps.map((original, index) => {
      const prefix = this.skillName ? `skill:${this.skillName}` : `direct:${this.directKind || this.event?.name || "event"}`;
      const id = original.id || `${prefix}:${original.type}:${index}`;
      const raw = { ...original, id };
      const select = raw.select ?? (raw.type === "card" ? semantics?.effectiveSelectCard ?? info?.selectCard : raw.type === "target" && info?.selectTarget !== void 0 ? info.selectTarget : raw.type === "target" && (semantics ? semantics.hasViewAs : getViewAsSource(spec, info)) ? () => this.viewAsTargetRange(info, spec) : raw.type === "target" ? info?.selectTarget : 1);
      const step = new SelectionStep({
        id,
        type: raw.type,
        selectionMode: raw.selectionMode,
        items: (context) => this.withBridge(context, void 0, void 0, () => {
          if (raw.type === "target" && raw.deferredFromCards && !info?.filterTarget && info?.selectTarget === void 0 && this.runtime.getCardInfo(this.currentViewAsCard(info, spec))?.notarget) {
            this.stepItems.set(id, /* @__PURE__ */ new Map());
            return [];
          }
          const map = this.resolveStepItems(raw, info, this.stepContext(context));
          this.stepItems.set(id, map);
          return Array.from(map.keys());
        }),
        select: (context, selected) => this.withBridge(
          context,
          selected,
          raw.type,
          () => {
            const range = normalizeRange(typeof select === "function" ? select(this.stepContext(context), selected) : select);
            step.required = selectionRequired(range, raw.required);
            return range;
          },
          id
        ),
        isSelectable: (ref, context, selected) => this.withBridge(
          context,
          selected,
          raw.type,
          () => this.isStepSelectable(raw, info, spec, this.stepItems.get(id)?.get(ref), this.stepContext(context), selected),
          id
        ),
        required: false,
        forced: true
      });
      this.selection.register(step);
      return { id, type: raw.type, items: [], range: [0, Infinity], instruction: raw.instruction || (raw.type === "target" ? formatTargetInstruction(info, this.event, targetOrder++, targetStepsCount) : void 0) };
    });
  }
  stepContext(context) {
    return Object.freeze({ ...context, selectedCards: Object.freeze((context.selected?.card || []).map((ref) => this.cardMap.get(ref)?.card).filter(Boolean)), selectedTargets: Object.freeze((context.selected?.target || []).map((ref) => this.targetMap.get(ref)?.player).filter(Boolean)), resolveTargets: (refs) => refs.map((ref) => this.targetMap.get(ref)?.player) });
  }
  consumeInitialSkillSelections(proposal) {
    const consumedTypes = /* @__PURE__ */ new Set();
    while (this.stage) {
      const stage = this.stage;
      if (stage.type !== "card" && stage.type !== "target") break;
      if (consumedTypes.has(stage.type)) break;
      const supplied = stage.type === "card" ? this.canonicalCardRefs(proposal.cardRefs || []) : proposal.targetRefs || [];
      if (!supplied.length && (stage.range[0] > 0 || stage.type === "target" && this.activeAction?.target.mode === "dynamic")) break;
      const outcome = this.selection.setSelection(stage.id, supplied);
      if (!outcome.ok) fail(formatSelectionFailure(outcome));
      consumedTypes.add(stage.type);
      this.currentStageIndex++;
    }
  }
  installSkillFilterOk(info, spec, semantics, requireHeadlessFilterOk) {
    if (requireHeadlessFilterOk && typeof info?.filterOk === "function" && !spec?.finalPredicate) {
      fail(`skill "${this.skillName}" has UI-dependent filterOk without finalPredicate`);
    }
    this.selection.filterOk = (context) => this.withBridge(context, void 0, void 0, () => {
      const cards = this.selectedCards();
      const { source, definition } = resolveViewAs(spec, info, cards, this.event.player);
      if (source && !definition) return false;
      return semantics.resolveFinalOk(cards, semantics.resolveActiveCard(cards), context, this.event);
    });
    this.skillFilterInstalled = true;
    if (spec?.finalPredicate || !semantics.hasViewAs) {
      this.hasExplicitFinalPredicate = true;
    }
  }
  withBridge(context, selected, stageType, fn, stageId) {
    const collectRefs = (type) => {
      if (stageType === type && selected !== void 0) {
        const currentIndex = stageId ? this.stages.findIndex((stage) => stage.id === stageId) : -1;
        const priorStages = currentIndex >= 0 ? this.stages.slice(0, currentIndex) : this.stages;
        const otherRefs = priorStages.filter((stage) => stage.type === type && (stageId ? stage.id !== stageId : false)).flatMap((stage) => this.selection.context.getStepSelected(stage.id));
        return stageId ? [...otherRefs, ...selected] : [...selected];
      }
      const stageRefs = this.stages.filter((stage) => stage.type === type).flatMap((stage) => this.selection.context.getStepSelected(stage.id));
      return stageRefs.length ? stageRefs : context?.selected?.[type] || [];
    };
    const cards = collectRefs("card").map((ref) => this.cardMap.get(ref)?.card).filter(Boolean);
    const targets = collectRefs("target").map((ref) => this.targetMap.get(ref)?.player).filter(Boolean);
    const buttons = collectRefs("button").map((ref) => this.findStepItemByRef("button", ref)).filter(Boolean);
    return withVirtualSelection(
      this.runtime.legacyBridgeHost,
      {
        event: this.event,
        player: this.event.player,
        skill: this.skillName,
        cards,
        targets,
        buttons,
        synthesizeBackup: true,
        eventOverrides: this.skillName ? this.skillSemantics?.eventOverrides : void 0
      },
      fn
    );
  }
  findStepItemByRef(type, ref) {
    for (const stage of this.stages) {
      if (stage.type !== type) continue;
      const found = this.stepItems.get(stage.id)?.get(ref);
      if (found !== void 0) return found;
    }
    return void 0;
  }
  selectedValues(type) {
    return this.stages.filter((stage) => stage.type === type).flatMap((stage) => this.selection.context.getStepSelected(stage.id));
  }
  selectedItems(type) {
    return this.stages.filter((stage) => stage.type === type).flatMap((stage) => {
      const items = this.stepItems.get(stage.id);
      return this.selection.context.getStepSelected(stage.id).map((ref) => items?.get(ref)).filter((value) => value !== void 0);
    });
  }
  selectedNumbers() {
    return this.stages.filter((stage) => stage.type === "number").map((stage, index) => {
      const ref = this.selection.context.getStepSelected(stage.id)[0];
      return this.stepItems.get(stage.id)?.get(ref) ?? this.event.numbers?.[index];
    });
  }
  selectedDirectCard() {
    return this.selectedValues("card")[0] ? this.cardMap.get(this.selectedValues("card")[0])?.card : this.selectedItems("button")[0]?.link ?? this.event._get_card ?? this.event.card;
  }
  resolveStepItems(raw, info, context) {
    const allowedRefs = raw.type === "card" ? this.currentActionCardRefs() : raw.type === "target" ? this.currentActionTargetRefs() : void 0;
    const source = (typeof raw.items === "function" ? raw.items(context) : raw.items) || allowedRefs || [];
    if (!Array.isArray(source)) actionResolution("selection items must resolve to an array");
    const map = /* @__PURE__ */ new Map();
    const identities = this.stepIdentities.get(raw.id) || /* @__PURE__ */ new Map();
    this.stepIdentities.set(raw.id, identities);
    for (const value of source) {
      const explicitRef = typeof value === "string" ? value : value?.ref;
      const identityRef = raw.type === "card" ? this.candidates.cards.find((card) => card.card === value)?.ref : raw.type === "target" ? Array.from(this.targetMap.values()).find((target) => target.player === value)?.ref : void 0;
      const previous = identities.get(value);
      if (previous && value && typeof value === "object" && "link" in value && previous.link !== value.link) fail("button link identity changed during decision");
      const canonical = raw.type === "card" ? this.cardMap.has(explicitRef) : raw.type === "target" ? this.targetMap.has(explicitRef) : false;
      const ref = identityRef || (canonical ? explicitRef : raw.type === "card" || raw.type === "target" ? void 0 : previous?.ref || value?.ref || `${shortRefPrefix(raw.type)}${identities.size}`);
      if (!ref) actionResolution(`selection ${raw.id || raw.type} contains an object outside the decision snapshot`);
      if (allowedRefs && !allowedRefs.includes(ref)) continue;
      if (map.has(ref)) fail("selection contains duplicate references");
      identities.set(value, { ref, link: value && typeof value === "object" ? value.link : void 0 });
      map.set(ref, raw.type === "card" ? this.cardMap.get(ref)?.card : raw.type === "target" ? this.targetMap.get(ref)?.player : value);
    }
    return map;
  }
  isStepSelectable(raw, info, spec, value, context, selected) {
    if (value == null) return false;
    try {
      if (this.skillName) {
        const semantics = this.skillSemantics || this.resolveSkillSemantics(info, spec);
        if (raw.type === "card") {
          if (!isCardOwned(this.event, value, this.runtime)) return false;
          if (typeof raw.filter === "function") return semantics.isMaterialCardGuardEligible(value) && !!raw.filter(value, this.event.player, context, selected);
          return semantics.isMaterialCardEligible(value, this.event);
        }
        if (raw.type === "target") {
          const selectedCards = this.selectedCards();
          const liveness = semantics.resolveTargetLiveness(selectedCards);
          if (!isTargetCurrent(semantics.baseEvent, value, this.runtime, liveness)) return false;
          if (raw.addedTargetFilter) {
            const activeCard = this.directUseCard || semantics.resolveActiveCard(selectedCards);
            const cardInfo = activeCard ? this.runtime.getCardInfo?.(activeCard) : void 0;
            const addedFn = info?.filterAddedTarget ?? (semantics.hasViewAs ? cardInfo?.filterAddedTarget ?? semantics.baseEvent?.filterAddedTarget : void 0);
            const preTarget = resolveAddedTargetPreTarget(this.stages, raw.id, (id) => this.selection.context.getStepSelected(id), this.targetMap);
            return typeof addedFn === "function" ? !!addedFn(activeCard, this.event.player, value, preTarget) : true;
          }
          return semantics.isSkillTargetFilterMatch(value, selectedCards, raw, context, selected);
        }
      }
      const directLiveness = directCardTargetLiveness(this.event, this.directUseCard, this.runtime.getCardInfo);
      if (raw.type === "card" && !isCardOwned(this.event, value, this.runtime)) return false;
      if (raw.type === "target" && !isTargetCurrent(this.event, value, this.runtime, directLiveness)) return false;
      if (typeof raw.filter === "function") return !!raw.filter(value, this.event.player, context, selected);
      if (raw.type === "card") return matchesSelectionFilter(info.filterCard, value, this.event.player, info, this.runtime.normalizeFilter, this.event);
      if (raw.type === "target" && raw.addedTargetFilter) {
        const addedFn = info?.filterAddedTarget ?? this.event.filterAddedTarget;
        const activeCard = this.directUseCard || this.selectedCard();
        const preTarget = resolveAddedTargetPreTarget(this.stages, raw.id, (id) => this.selection.context.getStepSelected(id), this.targetMap);
        return typeof addedFn === "function" ? !!addedFn(activeCard, this.event.player, value, preTarget) : true;
      }
      return true;
    } catch (error) {
      if (error?.stage) throw error;
      actionResolution(`selection filter threw in ${raw.id || raw.type}: ${error?.message || "unknown error"}`);
    }
  }
  selectedCard() {
    const ref = this.selectedValues("card")[0];
    return ref ? this.cardMap.get(ref)?.card : void 0;
  }
  currentViewAsCard(info, spec) {
    return (this.skillSemantics || this.resolveSkillSemantics(info, spec)).resolveActiveCard(this.selectedCards());
  }
  viewAsTargetRange(info, spec) {
    const semantics = this.skillSemantics || this.resolveSkillSemantics(info, spec);
    if (!semantics.hasViewAs) {
      return info?.selectTarget ?? (info?.filterTarget !== void 0 ? 1 : 0);
    }
    if (info?.selectTarget !== void 0) return info.selectTarget;
    const card = semantics.resolveActiveCard(this.selectedCards());
    if (!card) {
      return semantics.baseEvent.selectTarget !== this.runtime.defaultSelectTarget ? semantics.baseEvent.selectTarget : semantics.baseEvent.filterTarget !== void 0 ? 1 : 0;
    }
    const explicit = !!(spec && Object.keys(spec).length) || evaluateSelectionSpec(info?.selectionSpec, this.event, this.event.player, this.skillName || "skill", fail).mode === "explicit";
    if (explicit) {
      assertSupportedTargetRules(this.runtime.getCardInfo(card), `skill "${this.skillName}" viewAs card`);
    }
    return resolveAuthoritativeTargetRange(semantics.baseEvent, card, this.event.player, this.runtime);
  }
  finalizeOrFail() {
    if (!this.skillFilterInstalled && typeof this.event.filterOk === "function" && !this.hasExplicitFinalPredicate) {
      if (this.eventSpec) fail("unsupported: legacy filterOk has no headless finalPredicate");
      if (!this.selection.filterOk) {
        this.selection.filterOk = (context) => this.withBridge(context, void 0, void 0, () => !!this.event.filterOk());
      }
    }
    const final = this.selection.finalize();
    if (!final.ok) fail(formatSelectionFailure(final));
  }
  canonicalCardRefs(refs) {
    return this.refsForCards(resolveCandidateCards(this.cardMap, this.candidates.cards, refs, "selection", 0));
  }
  refsForCards(cards) {
    return cards.map((card) => {
      const candidate = this.candidates.cards.find((value) => value.card === card);
      if (!candidate) fail("card is not in the current candidate set");
      return candidate.ref;
    });
  }
  checkpoint() {
    return captureSelectionCheckpoint(this, this.selection, this.stepItems, this.stepIdentities, this.stages, this.automaticSteps);
  }
  rollback(snap) {
    this.stages = restoreSelectionCheckpoint(snap, this, this.selection, this.stepItems, this.stepIdentities, this.automaticSteps);
  }
  refsForTargets(targets) {
    return targets.map((target) => {
      const candidate = Array.from(this.targetMap.values()).find((value) => value.player === target);
      if (!candidate) fail("target is not in the current candidate set");
      return candidate.ref;
    });
  }
}
export {
  DecisionSelection
};
