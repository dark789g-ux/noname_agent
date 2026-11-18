import { resolveAuthoritativeTargetRange, resolveSkillActionPlan } from "./action-candidates.js";
import { resolveCandidateCards, requireAction, assertCardLegal, directCardTargetLiveness, resolveCandidateTargets, assertActionTargets, assertTargetLegal, isCardOwned, isTargetCurrent, materializeResponseResult, hasLegalDirectTargetCandidate } from "./decision-validation.js";
import { mergeBackupSelectionSpecs, buildBackupStepDefinitions, resolveViewAs, materializeViewAsResult } from "./backup-protocol.js";
import { materializeDirectResult } from "./direct-materializer.js";
import { parseActionProposal, assertActionAllowed } from "./protocol.js";
import { fail, actionResolution, formatSelectionFailure, directSelectionDefinition, resolveSelectionSpec } from "./selection-adapter.js";
import { DecisionSelection } from "./decision-selection.js";
import { isSingleCardAddedTarget, splitAddedTargetPrimaryRange, evaluateSelectionSpec } from "./generic-skill-plan.js";
import { withVirtualSelection } from "./legacy-bridge.js";
class DecisionSession extends DecisionSelection {
  constructor(event, candidates, runtime, targets = "targetPool" in candidates ? candidates.targetPool : []) {
    super(event, candidates, runtime, targets);
    if (!this.initializeBackupSelection()) this.initializeDirectSelection();
  }
  completeAutomatic() {
    if (this.event?.name === "chooseToDiscard" && !this.event?.forced && !this.candidates.cards.length) {
      return { result: { bool: false } };
    }
    if ((this.directKind || this.backupKind) && !this.event.forced && !(this.directKind && this.event.skill) && this.isInitialStageImpossible()) {
      return { result: { bool: false } };
    }
    if (!(this.backupKind || this.directKind && this.event.forced) || !this.stages.length || this.stage) return;
    this.revalidate();
    this.finalizeOrFail();
    return { result: this.backupKind ? this.materializeSkillDecision("backup") : this.materializeDirect() };
  }
  get isPending() {
    return !!this.stage;
  }
  accept(toolCall) {
    if (this.stage) return this.acceptStage(toolCall);
    const proposal = parseActionProposal(toolCall);
    assertActionAllowed(proposal, !!this.event.forced);
    switch (proposal.kind) {
      case "pass":
        return { result: { bool: false } };
      case "bool":
        return { result: { bool: proposal.bool } };
      case "card":
        return this.startCard(proposal);
      case "respond":
        return this.startRespond(proposal);
      case "discard":
        return { result: this.materializeDiscard(proposal) };
      case "skill":
        return this.startSkill(proposal);
    }
  }
  startCard(proposal) {
    const cards = resolveCandidateCards(this.cardMap, this.candidates.cards, proposal.cardRefs, "use_card", 1, 1);
    const card = cards[0];
    const cardRef = this.refsForCards(cards)[0];
    const action = requireAction(this.snapshot, "use_card", cardRef);
    return withVirtualSelection(this.runtime.legacyBridgeHost, { event: this.event, player: this.event.player, cards: [], targets: [] }, () => {
      assertCardLegal(this.event, card, this.runtime);
      const directLiveness = directCardTargetLiveness(this.event, card, this.runtime.getCardInfo);
      if (action?.target.mode !== "dynamic") {
        let targets = resolveCandidateTargets(this.targetMap, assertActionTargets(action, proposal.targetRefs, "use_card"), "use_card");
        for (const target of targets) assertTargetLegal(this.event, target, card, this.runtime, directLiveness);
        this.registerProposalSelection(cards, targets, "card");
        this.finalizeOrFail();
        targets = this.selectedValues("target").map((ref) => this.targetMap.get(ref)?.player).filter(Boolean);
        return { result: { bool: true, card, cards, targets } };
      }
      const info = this.runtime.getCardInfo(card) || {};
      this.directUseCard = card;
      this.activeAction = action;
      const steps = [
        {
          id: `card:${cardRef}:card`,
          type: "card",
          select: 1,
          required: true,
          filter: (value) => isCardOwned(this.event, value, this.runtime) && this.event.filterCard?.(value, this.event.player) !== false
        }
      ];
      const addedSource = isSingleCardAddedTarget(info) ? info : isSingleCardAddedTarget(this.event) ? this.event : void 0;
      if (addedSource) {
        const range = resolveAuthoritativeTargetRange(this.event, card, this.event.player, this.runtime);
        const primaryRange = splitAddedTargetPrimaryRange(range, !!(this.runtime.defaultSelectTarget && this.event.selectTarget === this.runtime.defaultSelectTarget));
        steps.push({
          id: `card:${cardRef}:target:0`,
          type: "target",
          selectionMode: "sequential",
          select: primaryRange,
          required: true,
          filter: (target) => isTargetCurrent(this.event, target, this.runtime, directLiveness) && this.event.filterTarget?.(card, this.event.player, target) !== false
        });
        steps.push({
          id: `card:${cardRef}:target:1`,
          type: "target",
          select: 1,
          required: true,
          addedTargetFilter: true
        });
      } else {
        steps.push({
          id: `card:${cardRef}:target:0`,
          type: "target",
          selectionMode: "sequential",
          select: () => resolveAuthoritativeTargetRange(this.event, card, this.event.player, this.runtime),
          filter: (target) => isTargetCurrent(this.event, target, this.runtime, directLiveness) && this.event.filterTarget?.(card, this.event.player, target) !== false
        });
      }
      this.stages = this.registerSkillSteps({ steps }, info);
      const cardOutcome = this.selection.setSelection(this.stages[0].id, [cardRef]);
      if (!cardOutcome.ok) fail(`use_card: ${cardOutcome.reason || cardOutcome.status}`);
      this.currentStageIndex = 1;
      let suppliedTargets = assertActionTargets(action, proposal.targetRefs, "use_card");
      while (this.stage && suppliedTargets.length) {
        const stage = this.stage;
        const take = stage.range[1] < 0 ? suppliedTargets.length : Math.min(stage.range[1], suppliedTargets.length);
        const batch = suppliedTargets.slice(0, take);
        suppliedTargets = suppliedTargets.slice(take);
        const outcome = this.selection.setSelection(stage.id, batch);
        if (!outcome.ok) fail(`use_card: ${outcome.reason || outcome.status}`);
        this.currentStageIndex++;
      }
      if (suppliedTargets.length) fail("use_card: target count is outside action range");
      if (this.stage) return { pending: this.stage };
      this.finalizeOrFail();
      return { result: this.materializeDirectUseCard() };
    });
  }
  materializeDirectUseCard() {
    const card = this.directUseCard;
    const targets = this.selectedValues("target").map((ref) => this.targetMap.get(ref)?.player).filter(Boolean);
    const info = this.runtime.getCardInfo(card) || {};
    const directLiveness = directCardTargetLiveness(this.event, card, this.runtime.getCardInfo);
    const addedSource = isSingleCardAddedTarget(info) ? info : isSingleCardAddedTarget(this.event) ? this.event : void 0;
    if (addedSource) {
      if (!targets[0]) fail("use_card: primary target missing");
      assertTargetLegal(this.event, targets[0], card, this.runtime, directLiveness);
      if (!targets[1] || !isTargetCurrent(this.event, targets[1], this.runtime, directLiveness) || !addedSource.filterAddedTarget(card, this.event.player, targets[1], targets[0])) {
        fail("use_card: added target is no longer legal");
      }
    } else {
      for (let i = 0; i < targets.length; i++) {
        withVirtualSelection(
          this.runtime.legacyBridgeHost,
          { event: this.event, player: this.event.player, cards: [card], targets: targets.slice(0, i) },
          () => assertTargetLegal(this.event, targets[i], card, this.runtime, directLiveness)
        );
      }
    }
    return { bool: true, card, cards: [card], targets };
  }
  startRespond(proposal) {
    const cards = resolveCandidateCards(this.cardMap, this.candidates.cards, proposal.cardRefs, "respond_card", 1, 1);
    this.activeAction = requireAction(this.snapshot, "respond_card", this.refsForCards(cards)[0]);
    assertCardLegal(this.event, cards[0], this.runtime);
    this.responseCard = cards[0];
    if (this.activeAction?.target.mode === "dynamic") {
      const targetSteps = (this.eventSpec?.steps?.filter((step) => step.type === "target") || []).map((step) => ({ ...step, filter: step.filter || ((target) => this.event.filterTarget?.(cards[0], this.event.player, target) !== false) }));
      if (!targetSteps.length) actionResolution("respond action has no explicit headless target step");
      this.stages = this.registerSkillSteps({ steps: targetSteps }, {});
      if (this.stage) return { pending: this.stage };
      this.finalizeOrFail();
      return { result: this.materializeResponse() };
    }
    this.registerProposalSelection(cards, [], "respond");
    this.finalizeOrFail();
    return { result: this.materializeResponse() };
  }
  materializeResponse() {
    const targets = this.selectedValues("target").map((ref) => this.targetMap.get(ref)?.player).filter(Boolean);
    return materializeResponseResult(this.responseCard, targets);
  }
  materializeDiscard(proposal) {
    const cards = resolveCandidateCards(this.cardMap, this.candidates.cards, proposal.cardRefs, "discard_cards", 1);
    for (const card of cards) assertCardLegal(this.event, card, this.runtime);
    this.registerProposalSelection(cards, [], "discard");
    this.finalizeOrFail();
    return { bool: true, cards };
  }
  startSkill(proposal) {
    if (!proposal.skillName || !this.candidates.skills.includes(proposal.skillName) || !this.runtime.isSkillEligible(this.event, this.event.player, proposal.skillName)) fail(`use_skill: skill "${proposal.skillName}" is no longer eligible`);
    const action = requireAction(this.snapshot, "use_skill", void 0, proposal.skillName);
    this.activeAction = action;
    proposal.cardRefs = this.canonicalCardRefs(proposal.cardRefs || []);
    if (proposal.cardRefs?.some((ref) => !action?.materialCardRefs.includes(ref))) fail("use_skill: material card is not allowed by this action");
    proposal.targetRefs = proposal.targetRefs?.length || action?.target.mode === "automatic" ? assertActionTargets(action, proposal.targetRefs, "use_skill") : [];
    this.skillName = proposal.skillName;
    const info = this.runtime.getSkillInfo(proposal.skillName);
    if (!info) fail(`use_skill: unknown skill "${proposal.skillName}"`);
    const plan = resolveSkillActionPlan(this.event, this.event.player, proposal.skillName, info);
    if (!plan) fail(`use_skill: skill "${proposal.skillName}" has no headless selectionSpec`);
    const spec = plan.spec;
    this.skillInfo = info;
    this.skillSpec = spec;
    const semantics = this.resolveSkillSemantics(info, spec);
    this.skillSemantics = semantics;
    if (info.chooseButton && !spec.steps) {
      if (!plan.generic && typeof info.filterOk === "function" && !spec.finalPredicate) fail(`use_skill: skill "${proposal.skillName}" has UI-dependent filterOk without finalPredicate`);
      return { result: { bool: true, skill: proposal.skillName, cards: [], targets: [] } };
    }
    this.installSkillFilterOk(info, spec, semantics, !plan.generic);
    this.stages = this.registerSkillSteps(spec, info, plan.steps);
    this.consumeInitialSkillSelections(proposal);
    if (this.stage) return { pending: this.stage };
    this.finalizeOrFail();
    return { result: this.materializeSkillDecision("use_skill") };
  }
  acceptStage(toolCall) {
    if (toolCall.name === "pass" && !this.event.forced) return { result: { bool: false } };
    const stage = this.stage;
    const expected = `select_${stage.type}s`;
    if (toolCall.name !== expected || toolCall.arguments.step_id !== stage.id) fail(`selection: expected ${expected} for ${stage.id}`);
    const key = `${stage.type}_refs`;
    const refs = toolCall.arguments[key];
    if (!Array.isArray(refs)) fail(`selection: ${key} must be an array`);
    const actionRefs = stage.type === "card" ? this.currentActionCardRefs() : stage.type === "target" ? this.currentActionTargetRefs() : void 0;
    if (actionRefs && refs.some((ref) => !actionRefs.includes(ref))) fail(`selection: ${stage.type} reference is outside the current action`);
    const inspection = this.selection.evaluate(stage.id).inspection;
    if (inspection?.automatic && refs.length && (refs.length !== inspection.automaticSelected.length || refs.some((ref, index) => ref !== inspection.automaticSelected[index]))) fail("selection: automatic selection contains stale or incomplete references");
    const outcome = this.selection.setSelection(stage.id, refs);
    if (!outcome.ok) fail(formatSelectionFailure(outcome, inspection));
    this.currentStageIndex++;
    if (this.stage) return { pending: this.stage };
    this.finalizeOrFail();
    return { result: this.directUseCard ? this.materializeDirectUseCard() : this.responseCard ? this.materializeResponse() : this.backupKind ? this.materializeSkillDecision("backup") : this.directKind ? this.materializeDirect() : this.materializeSkillDecision("use_skill") };
  }
  initializeBackupSelection() {
    if (!this.event.skill || !["chooseToUse", "chooseToRespond"].includes(this.event.name)) return false;
    const info = this.runtime.getSkillInfo(this.event.skill);
    if (!info) fail(`backup: unknown skill "${this.event.skill}"`);
    const infoEvaluated = evaluateSelectionSpec(info.selectionSpec, this.event, this.event.player, this.event.skill, fail);
    if (infoEvaluated.mode === "disabled") fail(`backup: skill "${this.event.skill}" has no headless selectionSpec`);
    const infoSpec = infoEvaluated.mode === "explicit" ? infoEvaluated.spec : void 0;
    const explicitSpec = !!(infoSpec || this.eventSpec);
    const spec = mergeBackupSelectionSpecs(infoSpec, this.eventSpec) || {};
    this.skillName = this.event.skill;
    this.backupKind = this.event.name;
    this.backupInfo = info;
    this.backupSpec = spec;
    this.skillInfo = info;
    this.skillSpec = spec;
    const semantics = this.resolveSkillSemantics(info, spec);
    this.skillSemantics = semantics;
    const steps = buildBackupStepDefinitions(this.event, info, spec, {
      cardFilter: (card) => isCardOwned(this.event, card, this.runtime) && semantics.isMaterialCardEligible(card, this.event),
      targetFilter: (target) => isTargetCurrent(semantics.baseEvent, target, this.runtime, semantics.resolveTargetLiveness(this.selectedCards())) && semantics.isSkillTargetFilterMatch(target, this.selectedCards()),
      targetSelect: () => this.viewAsTargetRange(info, spec),
      deferTarget: !!(semantics.hasViewAs || semantics.complexTarget || semantics.complexSelect)
    });
    for (const step of steps) if (step.type === "card" && !step.items) step.items = this.candidates.cards.map((card) => card.ref);
    this.installSkillFilterOk(info, spec, semantics, explicitSpec);
    this.stages = this.registerSkillSteps({ ...spec, steps }, info);
    if (!this.stages.length) fail(`backup: skill "${this.event.skill}" has no selection stages`);
    return true;
  }
  initializeDirectSelection() {
    if (this.event.name === "chooseToUse" || this.event.name === "chooseToRespond") return;
    const definition = directSelectionDefinition(this.event, this.eventSpec, {
      isCardOwned: (card) => isCardOwned(this.event, card, this.runtime),
      isTargetCurrent: (target) => isTargetCurrent(this.event, target, this.runtime),
      selectedCard: () => this.selectedDirectCard(),
      selectedNumbers: () => this.selectedNumbers(),
      normalizeFilter: this.runtime.normalizeFilter,
      hasLegalDirectTarget: (value, kind) => hasLegalDirectTargetCandidate(this.event, this.targetMap.values(), this.runtime, value, kind)
    });
    if (!definition) return;
    this.directKind = definition.kind;
    if (definition.filterOk) {
      this.selection.filterOk = definition.filterOk;
      this.hasExplicitFinalPredicate = true;
    }
    this.stages = this.registerSkillSteps({ steps: definition.steps }, {});
    if (!this.stages.length) fail(`unsupported ${definition.kind}: no serializable candidates`);
  }
  materializeSkillDecision(mode) {
    const skill = this.skillName;
    const prefix = mode === "use_skill" ? "use_skill" : "backup";
    if (mode === "use_skill" && !this.runtime.isSkillEligible(this.event, this.event.player, skill)) fail(`use_skill: skill "${skill}" is no longer eligible`);
    const info = mode === "backup" ? this.backupInfo : this.runtime.getSkillInfo(skill);
    const spec = mode === "backup" ? this.backupSpec : resolveSelectionSpec(info.selectionSpec, this.event, this.event.player);
    const semantics = this.resolveSkillSemantics(info, spec);
    const cards = this.selectedCards();
    const targets = this.selectedValues("target").map((ref) => this.targetMap.get(ref)?.player).filter(Boolean);
    const { source: viewAs, definition, activeCard } = withVirtualSelection(
      this.runtime.legacyBridgeHost,
      { event: this.event, player: this.event.player, skill, cards, targets, synthesizeBackup: true, eventOverrides: semantics.eventOverrides },
      () => ({ ...resolveViewAs(spec, info, cards, this.event.player), activeCard: semantics.resolveActiveCard(cards) })
    );
    if (viewAs && !definition) fail(`${prefix}: viewAs did not resolve for ${skill}`);
    for (let i = 0; i < cards.length; i++) {
      if (!isCardOwned(this.event, cards[i], this.runtime)) fail("skill card is no longer owned by the player");
      try {
        const ok = withVirtualSelection(
          this.runtime.legacyBridgeHost,
          { event: this.event, player: this.event.player, skill, cards: cards.slice(0, i), targets: [], synthesizeBackup: true, eventOverrides: semantics.eventOverrides },
          () => semantics.hasExplicitStepCardFilter ? semantics.isMaterialCardGuardEligible(cards[i]) : semantics.isMaterialCardEligible(cards[i], this.event)
        );
        if (!ok) fail("skill card is no longer legal");
      } catch (error) {
        if (error?.stage) throw error;
        fail("skill card legality could not be verified");
      }
    }
    const liveness = semantics.resolveTargetLiveness(cards);
    const cardInfo = activeCard ? this.runtime.getCardInfo?.(activeCard) : void 0;
    const addedSource = isSingleCardAddedTarget(info) ? info : semantics.hasViewAs && isSingleCardAddedTarget(cardInfo) ? cardInfo : void 0;
    if (addedSource) {
      if (!targets[0]) fail(`${prefix}: primary target missing for ${skill}`);
      this.assertSkillTargetStep(semantics, targets[0], cards, [], liveness, semantics.hasExplicitStepTargetFilter, info);
      const addedOk = withVirtualSelection(
        this.runtime.legacyBridgeHost,
        { event: this.event, player: this.event.player, skill, cards, targets: [targets[0]], synthesizeBackup: true, eventOverrides: semantics.eventOverrides },
        () => !!targets[1] && isTargetCurrent(semantics.baseEvent, targets[1], this.runtime, liveness) && !!addedSource.filterAddedTarget(activeCard, this.event.player, targets[1], targets[0])
      );
      if (!addedOk) fail(`${prefix}: added target is no longer legal for ${skill}`);
    } else {
      for (let i = 0; i < targets.length; i++) {
        this.assertSkillTargetStep(semantics, targets[i], cards, targets.slice(0, i), liveness, semantics.hasExplicitStepTargetFilter, info);
      }
    }
    if (viewAs) {
      const viewAsAllowed = withVirtualSelection(
        this.runtime.legacyBridgeHost,
        { event: this.event, player: this.event.player, skill, cards, targets, synthesizeBackup: true, eventOverrides: semantics.eventOverrides },
        () => typeof semantics.baseEvent?.filterCard !== "function" || !!semantics.baseEvent.filterCard(activeCard, this.event.player, this.event)
      );
      if (!viewAsAllowed) fail(`${prefix}: viewAs card is no longer legal for ${skill}`);
      return materializeViewAsResult(skill, definition, cards, targets, this.runtime.autoViewAs);
    }
    return { bool: true, skill, cards, targets };
  }
  assertSkillTargetStep(semantics, target, cards, targetsBefore, liveness, explicitFilter, info) {
    if (!isTargetCurrent(semantics.baseEvent, target, this.runtime, liveness)) fail("skill target is no longer current");
    try {
      const ok = withVirtualSelection(
        this.runtime.legacyBridgeHost,
        { event: this.event, player: this.event.player, skill: this.skillName, cards, targets: targetsBefore, synthesizeBackup: true, eventOverrides: semantics.eventOverrides },
        () => explicitFilter || semantics.isSkillTargetFilterMatch(target, cards)
      );
      if (!ok) fail(semantics.hasViewAs && info?.filterTarget === void 0 ? "viewAs target is no longer legal" : "skill target is no longer legal");
    } catch (error) {
      if (error?.stage) throw error;
      fail("skill target legality could not be verified");
    }
  }
  materializeDirect() {
    const cards = this.selectedValues("card").map((ref) => this.cardMap.get(ref)?.card).filter(Boolean);
    const targets = this.selectedValues("target").map((ref) => this.targetMap.get(ref)?.player).filter(Boolean);
    const buttons = this.selectedItems("button");
    return materializeDirectResult({
      kind: this.directKind,
      event: this.event,
      cards,
      targets,
      buttons,
      control: this.selectedItems("control")[0],
      targetCard: this.selectedDirectCard(),
      numbers: this.selectedNumbers(),
      stageCount: this.stages.length,
      assertCard: (card) => {
        if (this.eventSpec?.steps?.some((step) => step.type === "card" && step.filter)) {
          if (!isCardOwned(this.event, card, this.runtime)) fail("direct card ownership changed");
        } else assertCardLegal(this.event, card, this.runtime);
      },
      assertTarget: (target, card) => {
        if (this.eventSpec?.steps?.some((step) => step.type === "target" && step.filter)) {
          if (!isTargetCurrent(this.event, target, this.runtime)) fail("direct target state changed");
        } else assertTargetLegal(this.event, target, card, this.runtime);
      },
      fail
    });
  }
  registerProposalSelection(cards, targets, kind) {
    const cardSpec = this.eventSpec?.steps?.find((step) => step.type === "card");
    const targetSpec = this.eventSpec?.steps?.find((step) => step.type === "target");
    const cardSelect = cardSpec?.select ?? (kind === "discard" ? this.event.selectCard ?? 1 : 1);
    const steps = [{ id: `proposal:${kind}:card`, type: "card", select: cardSelect, required: cardSpec?.required ?? (kind === "discard" ? void 0 : true), filter: cardSpec?.filter || ((card) => isCardOwned(this.event, card, this.runtime) && this.event.filterCard?.(card, this.event.player) !== false) }];
    if (kind === "card" && (typeof this.event.filterTarget === "function" || this.event.selectTarget !== void 0 || this.event.targetRequired)) {
      steps.push({ id: "proposal:card:target", type: "target", select: targetSpec?.select ?? this.authoritativeCardTargetSelect(cards[0]), required: targetSpec?.required ?? (this.event.targetRequired ? true : void 0), filter: targetSpec?.filter || ((target) => isTargetCurrent(this.event, target, this.runtime) && this.event.filterTarget?.(cards[0], this.event.player, target) !== false) });
    }
    this.stages = this.registerSkillSteps({ steps }, {});
    for (const stage of this.stages) {
      const refs = stage.type === "card" ? this.refsForCards(cards) : this.refsForTargets(targets);
      const outcome = this.selection.setSelection(stage.id, refs);
      if (!outcome.ok) fail(`${kind}: ${stage.type} ${outcome.reason || outcome.status}`);
    }
  }
  authoritativeCardTargetSelect(card) {
    return resolveAuthoritativeTargetRange(this.event, card, this.event.player, this.runtime);
  }
}
function translateResult(event, toolCall, candidates, targets = [], runtime) {
  if (!runtime) fail("translateResult requires a decision runtime");
  return new DecisionSession(event, candidates, runtime, targets).accept(toolCall).result ?? fail("Action requires additional selection turns");
}
export {
  DecisionSession,
  translateResult
};
