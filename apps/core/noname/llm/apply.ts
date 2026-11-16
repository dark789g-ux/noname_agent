import { SelectionContext, SelectionSession, SelectionStep } from "@/library/selection/index.js";
import type { CandidateCard, CandidateTarget } from "./candidates.js";
import { assertSupportedTargetRules, resolveAuthoritativeTargetRange, resolveSkillActionPlan, type ActionCandidateRuntime, type CandidateAction, type DecisionCandidateSnapshot } from "./action-candidates.js";
import { assertActionTargets, assertCardLegal, assertTargetLegal, buildDecisionLogResult, hasLegalDirectTargetCandidate, isCardOwned, isTargetCurrent, materializeResponseResult, requireAction, resolveActionCardRefs, resolveCandidateCards, resolveCandidateTargets, resolveCurrentAction, type ValidationRuntime } from "./decision-validation.js";
import type { ToolCallResult } from "./client.js";
import { buildBackupStepDefinitions, getViewAsSource, materializeViewAsResult, mergeBackupSelectionSpecs, resolveViewAs, type BackupDecisionKind } from "./backup-protocol.js";
import { materializeDirectResult } from "./direct-materializer.js";
import { assertActionAllowed, parseActionProposal, selectionRequired, type ActionProposal } from "./protocol.js";
import { actionResolution, deriveSimpleSteps, directSelectionDefinition, fail, labelFor, normalizeRange, resolveSelectionSpec, shortRefPrefix, type HeadlessSelectionSpec } from "./selection-adapter.js";
import { DecisionSelection, type DecisionStage, type DecisionRuntime } from "./decision-selection.js";
import { evalFilterTargetValue, evaluateSelectionSpec, isSingleCardAddedTarget, splitAddedTargetPrimaryRange } from "./generic-skill-plan.js";
import { withVirtualSelection } from "./legacy-bridge.js";
import { matchesSelectionFilter } from "./selection-filter.js";
export type { DecisionStage, DecisionRuntime } from "./decision-selection.js";

export class DecisionSession extends DecisionSelection {
	constructor(event: any, candidates: DecisionCandidateSnapshot | { cards: CandidateCard[]; skills: string[] }, runtime: DecisionRuntime, targets: CandidateTarget[] = "targetPool" in candidates ? candidates.targetPool : []) {
		super(event, candidates, runtime, targets);
		if (!this.initializeBackupSelection()) this.initializeDirectSelection();
	}

	completeAutomatic(): { result: any } | undefined {
		if ((this.directKind || this.backupKind) && !this.event.forced && !(this.directKind && this.event.skill) && this.isInitialStageImpossible()) {
			return { result: { bool: false } };
		}
		if (!(this.backupKind || (this.directKind && this.event.forced)) || !this.stages.length || this.stage) return;
		this.revalidate();
		this.finalizeOrFail();
		return { result: this.backupKind ? this.materializeBackup() : this.materializeDirect() };
	}
	get isPending(): boolean {
		return !!this.stage;
	}

	accept(toolCall: ToolCallResult): { pending?: DecisionStage; result?: any } {
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

	private startCard(proposal: ActionProposal): { pending?: DecisionStage; result?: any } {
		const cards = resolveCandidateCards(this.cardMap, this.candidates.cards, proposal.cardRefs, "use_card", 1, 1);
		const card = cards[0];
		const cardRef = this.refsForCards(cards)[0];
		const action = requireAction(this.snapshot, "use_card", cardRef);
		return withVirtualSelection(this.runtime.legacyBridgeHost, { event: this.event, player: this.event.player, cards: [], targets: [] }, () => {
			assertCardLegal(this.event, card, this.runtime);
			if (action?.target.mode !== "dynamic") {
				let targets = resolveCandidateTargets(this.targetMap, assertActionTargets(action, proposal.targetRefs, "use_card"), "use_card");
				for (const target of targets) assertTargetLegal(this.event, target, card, this.runtime);
				this.registerProposalSelection(cards, targets, "card");
				this.finalizeOrFail();
				targets = this.selectedValues("target")
					.map(ref => this.targetMap.get(ref)?.player)
					.filter(Boolean);
				return { result: { bool: true, card, cards, targets } };
			}
			const info = this.runtime.getCardInfo(card) || {};
			this.directUseCard = card;
			this.activeAction = action;
			const steps: any[] = [
				{
					id: `card:${cardRef}:card`,
					type: "card",
					select: 1,
					required: true,
					filter: (value: any) => isCardOwned(this.event, value, this.runtime) && this.event.filterCard?.(value, this.event.player) !== false,
				},
			];
			const addedSource = isSingleCardAddedTarget(info) ? info : isSingleCardAddedTarget(this.event) ? this.event : undefined;
			if (addedSource) {
				const range = resolveAuthoritativeTargetRange(this.event, card, this.event.player, this.runtime);
				const primaryRange = splitAddedTargetPrimaryRange(range, !!(this.runtime.defaultSelectTarget && this.event.selectTarget === this.runtime.defaultSelectTarget));
				steps.push({
					id: `card:${cardRef}:target:0`,
					type: "target",
					select: primaryRange,
					required: true,
					filter: (target: any) => isTargetCurrent(this.event, target, this.runtime) && this.event.filterTarget?.(card, this.event.player, target) !== false,
				});
				steps.push({
					id: `card:${cardRef}:target:1`,
					type: "target",
					select: 1,
					required: true,
					addedTargetFilter: true,
				});
			} else {
				steps.push({
					id: `card:${cardRef}:target:0`,
					type: "target",
					selectionMode: "sequential",
					select: () => resolveAuthoritativeTargetRange(this.event, card, this.event.player, this.runtime),
					filter: (target: any) => isTargetCurrent(this.event, target, this.runtime) && this.event.filterTarget?.(card, this.event.player, target) !== false,
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

	private materializeDirectUseCard(): any {
		const card = this.directUseCard!;
		const targets = this.selectedValues("target")
			.map(ref => this.targetMap.get(ref)?.player)
			.filter(Boolean);
		const info = this.runtime.getCardInfo(card) || {};
		const addedSource = isSingleCardAddedTarget(info) ? info : isSingleCardAddedTarget(this.event) ? this.event : undefined;
		if (addedSource) {
			if (!targets[0]) fail("use_card: primary target missing");
			assertTargetLegal(this.event, targets[0], card, this.runtime);
			if (!targets[1] || !addedSource.filterAddedTarget(card, this.event.player, targets[1], targets[0])) {
				fail("use_card: added target is no longer legal");
			}
		} else {
			for (let i = 0; i < targets.length; i++) {
				withVirtualSelection(this.runtime.legacyBridgeHost, { event: this.event, player: this.event.player, cards: [card], targets: targets.slice(0, i) }, () =>
					assertTargetLegal(this.event, targets[i], card, this.runtime)
				);
			}
		}
		return { bool: true, card, cards: [card], targets };
	}

	private startRespond(proposal: ActionProposal): { pending?: DecisionStage; result?: any } {
		const cards = resolveCandidateCards(this.cardMap, this.candidates.cards, proposal.cardRefs, "respond_card", 1, 1);
		this.activeAction = requireAction(this.snapshot, "respond_card", this.refsForCards(cards)[0]);
		assertCardLegal(this.event, cards[0], this.runtime);
		this.responseCard = cards[0];
		if (this.activeAction?.target.mode === "dynamic") {
			const targetSteps = (this.eventSpec?.steps?.filter(step => step.type === "target") || []).map(step => ({ ...step, filter: step.filter || ((target: any) => this.event.filterTarget?.(cards[0], this.event.player, target) !== false) }));
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

	private materializeResponse(): any {
		const targets = this.selectedValues("target")
			.map(ref => this.targetMap.get(ref)?.player)
			.filter(Boolean);
		return materializeResponseResult(this.responseCard, targets);
	}

	private materializeDiscard(proposal: ActionProposal): any {
		const cards = resolveCandidateCards(this.cardMap, this.candidates.cards, proposal.cardRefs, "discard_cards", 1);
		for (const card of cards) assertCardLegal(this.event, card, this.runtime);
		this.registerProposalSelection(cards, [], "discard");
		this.finalizeOrFail();
		return { bool: true, cards };
	}

	private startSkill(proposal: ActionProposal): { pending?: DecisionStage; result?: any } {
		if (!proposal.skillName || !this.candidates.skills.includes(proposal.skillName) || !this.runtime.isSkillEligible(this.event, this.event.player, proposal.skillName)) fail(`use_skill: skill "${proposal.skillName}" is no longer eligible`);
		const action = requireAction(this.snapshot, "use_skill", undefined, proposal.skillName);
		this.activeAction = action;
		proposal.cardRefs = this.canonicalCardRefs(proposal.cardRefs || []);
		if (proposal.cardRefs?.some(ref => !action?.materialCardRefs.includes(ref))) fail("use_skill: material card is not allowed by this action");
		proposal.targetRefs = proposal.targetRefs?.length || action?.target.mode === "automatic" ? assertActionTargets(action, proposal.targetRefs, "use_skill") : [];
		this.skillName = proposal.skillName;
		const info = this.runtime.getSkillInfo(proposal.skillName);
		if (!info) fail(`use_skill: unknown skill "${proposal.skillName}"`);
		const plan = resolveSkillActionPlan(this.event, this.event.player, proposal.skillName, info);
		if (!plan) fail(`use_skill: skill "${proposal.skillName}" has no headless selectionSpec`);
		const spec = plan.spec;
		if (spec.finalPredicate) this.installFinalPredicate(spec);
		else if (!plan.generic && typeof info.filterOk === "function") fail(`use_skill: skill "${proposal.skillName}" has UI-dependent filterOk without finalPredicate`);
		else this.installGenericSkillFilterOk(info);
		// chooseButton 的 dialog/link 可能包含不可序列化对象。由 content 创建
		// 后续 chooseButton 子事件；此处仅返回技能中间结果，绝不伪造最终选择。
		if (info.chooseButton && !spec.steps) {
			this.finalizeOrFail();
			return { result: { bool: true, skill: proposal.skillName, cards: [], targets: [] } };
		}
		this.stages = this.registerSkillSteps(spec, info, plan.steps);
		this.consumeInitialSkillSelections(proposal);
		if (this.stage) return { pending: this.stage };
		this.finalizeOrFail();
		return { result: this.materializeSkill() };
	}

	private installBackupFinalPredicate(info: any, spec: HeadlessSelectionSpec, explicitSpec: boolean): void {
		if (explicitSpec && typeof this.event._backup?.filterOk === "function") fail(`backup: skill "${this.event.skill}" has an unsupported outer filterOk`);
		if (explicitSpec && typeof info.filterOk === "function" && !spec.finalPredicate) fail(`backup: skill "${this.event.skill}" has UI-dependent filterOk without finalPredicate`);
		this.selection.filterOk = context =>
			this.withBridge(context, undefined, undefined, () => {
				const cards = this.selectedValues("card")
					.map(ref => this.cardMap.get(ref)?.card)
					.filter(Boolean);
				const { source, definition } = resolveViewAs(spec, info, cards, this.event.player);
				if (source) {
					if (!definition) return false;
					const card = this.runtime.autoViewAs(definition, cards);
					if (typeof this.event._backup?.filterCard === "function" && this.event._backup.filterCard(card, this.event.player, this.event) === false) return false;
				}
				if (spec.finalPredicate) return spec.finalPredicate(context, this.event, this.event.player) !== false;
				if (!explicitSpec) {
					if (typeof info.filterOk === "function") return !!info.filterOk();
					if (typeof this.event.filterOk === "function") return !!this.event.filterOk();
				}
				return true;
			});
		if (explicitSpec || spec.finalPredicate) this.hasExplicitFinalPredicate = true;
	}

	private acceptStage(toolCall: ToolCallResult): { pending?: DecisionStage; result?: any } {
		if (toolCall.name === "pass" && !this.event.forced) return { result: { bool: false } };
		const stage = this.stage!;
		const expected = `select_${stage.type}s`;
		if (toolCall.name !== expected || toolCall.arguments.step_id !== stage.id) fail(`selection: expected ${expected} for ${stage.id}`);
		const key = `${stage.type}_refs`;
		const refs = toolCall.arguments[key];
		if (!Array.isArray(refs)) fail(`selection: ${key} must be an array`);
		const actionRefs = stage.type === "card" ? this.currentActionCardRefs() : stage.type === "target" ? this.currentActionTargetRefs() : undefined;
		if (actionRefs && refs.some((ref: string) => !actionRefs.includes(ref))) fail(`selection: ${stage.type} reference is outside the current action`);
		const inspection = this.selection.evaluate(stage.id).inspection;
		if (inspection?.automatic && refs.length && (refs.length !== inspection.automaticSelected.length || refs.some((ref: string, index: number) => ref !== inspection.automaticSelected[index]))) fail("selection: automatic selection contains stale or incomplete references");
		const outcome = this.selection.setSelection(stage.id, refs);
		if (!outcome.ok) fail(`selection: ${outcome.reason || outcome.status}`);
		this.currentStageIndex++;
		if (this.stage) return { pending: this.stage };
		this.finalizeOrFail();
		return { result: this.directUseCard ? this.materializeDirectUseCard() : this.responseCard ? this.materializeResponse() : this.backupKind ? this.materializeBackup() : this.directKind ? this.materializeDirect() : this.materializeSkill() };
	}

	private initializeBackupSelection(): boolean {
		if (!this.event.skill || !["chooseToUse", "chooseToRespond"].includes(this.event.name)) return false;
		const info = this.runtime.getSkillInfo(this.event.skill);
		if (!info) fail(`backup: unknown skill "${this.event.skill}"`);
		const infoEvaluated = evaluateSelectionSpec(info.selectionSpec, this.event, this.event.player, this.event.skill, fail);
		if (infoEvaluated.mode === "disabled") fail(`backup: skill "${this.event.skill}" has no headless selectionSpec`);
		const infoSpec = infoEvaluated.mode === "explicit" ? infoEvaluated.spec : undefined;
		const explicitSpec = !!(infoSpec || this.eventSpec);
		const spec = mergeBackupSelectionSpecs(infoSpec, this.eventSpec) || ({} as HeadlessSelectionSpec);
		this.skillName = this.event.skill;
		this.backupKind = this.event.name;
		this.backupInfo = info;
		this.backupSpec = spec;
		const steps = buildBackupStepDefinitions(this.event, info, spec, {
			cardFilter: card => isCardOwned(this.event, card, this.runtime) && (typeof this.event.filterCard === "function" ? this.event.filterCard(card, this.event.player, this.event) !== false : this.event.filterCard !== false),
			targetFilter: target => isTargetCurrent(this.event, target, this.runtime) && (typeof this.event.filterTarget === "function" ? this.event.filterTarget(this.currentViewAsCard(info, spec), this.event.player, target) !== false : this.event.filterTarget !== false),
			targetSelect: () => this.viewAsTargetRange(info, spec),
			deferTarget: !!(getViewAsSource(spec, info) || this.event.complexTarget || this.event.complexSelect || info?.complexTarget || info?.complexSelect),
		});
		for (const step of steps) if (step.type === "card" && !step.items) step.items = this.candidates.cards.map(card => card.ref);
		this.installBackupFinalPredicate(info, spec, explicitSpec);
		this.stages = this.registerSkillSteps({ ...spec, steps }, info);
		if (!this.stages.length) fail(`backup: skill "${this.event.skill}" has no selection stages`);
		return true;
	}

	private initializeDirectSelection(): void {
		if (this.event.name === "chooseToUse" || this.event.name === "chooseToRespond") return;
		const definition = directSelectionDefinition(this.event, this.eventSpec, {
			isCardOwned: card => isCardOwned(this.event, card, this.runtime),
			isTargetCurrent: target => isTargetCurrent(this.event, target, this.runtime),
			selectedCard: () => this.selectedDirectCard(),
			selectedNumbers: () => this.selectedNumbers(),
			normalizeFilter: this.runtime.normalizeFilter,
			hasLegalDirectTarget: (value, kind) => hasLegalDirectTargetCandidate(this.event, this.targetMap.values(), this.runtime, value, kind),
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

	private materializeSkill(): any {
		const skill = this.skillName!;
		if (!this.runtime.isSkillEligible(this.event, this.event.player, skill)) fail(`use_skill: skill "${skill}" is no longer eligible`);
		const info = this.runtime.getSkillInfo(skill);
		const cards = this.selectedValues("card")
			.map(ref => this.cardMap.get(ref)?.card)
			.filter(Boolean);
		const targets = this.selectedValues("target")
			.map(ref => this.targetMap.get(ref)?.player)
			.filter(Boolean);
		const spec = resolveSelectionSpec(info.selectionSpec, this.event, this.event.player);
		const { source: viewAs, definition, viewAsCard } = withVirtualSelection(
			this.runtime.legacyBridgeHost,
			{ event: this.event, player: this.event.player, skill, cards, targets, synthesizeBackup: true },
			() => {
				const resolved = resolveViewAs(spec, info, cards, this.event.player);
				return {
					...resolved,
					viewAsCard: resolved.definition ? this.runtime.autoViewAs(resolved.definition, cards) : undefined,
				};
			}
		);
		for (let i = 0; i < cards.length; i++) this.assertSkillCardLegal(cards[i], info, spec, cards.slice(0, i));
		if (isSingleCardAddedTarget(info)) {
			if (!targets[0]) fail(`use_skill: primary target missing for ${skill}`);
			this.assertSkillTargetLegal(targets[0], viewAsCard || cards[0], info, spec, cards, []);
			const addedOk = withVirtualSelection(
				this.runtime.legacyBridgeHost,
				{ event: this.event, player: this.event.player, skill, cards, targets: [targets[0]], synthesizeBackup: true },
				() => !!targets[1] && !!info.filterAddedTarget(viewAsCard || cards[0], this.event.player, targets[1], targets[0])
			);
			if (!addedOk) fail(`use_skill: added target is no longer legal for ${skill}`);
		} else {
			for (let i = 0; i < targets.length; i++) this.assertSkillTargetLegal(targets[i], viewAsCard || cards[0], info, spec, cards, targets.slice(0, i));
		}
		if (viewAs) {
			if (!definition) fail(`use_skill: viewAs did not resolve for ${skill}`);
			const viewAsAllowed = withVirtualSelection(
				this.runtime.legacyBridgeHost,
				{ event: this.event, player: this.event.player, skill, cards, targets, synthesizeBackup: true },
				() => typeof this.event.filterCard !== "function" || !!this.event.filterCard(viewAsCard, this.event.player, this.event)
			);
			if (!viewAsAllowed) fail(`use_skill: viewAs card is no longer legal for ${skill}`);
			return materializeViewAsResult(skill, definition, cards, targets, this.runtime.autoViewAs);
		}
		return { bool: true, skill, cards, targets };
	}

	private materializeBackup(): any {
		const skill = this.skillName!;
		const info = this.backupInfo;
		const spec = this.backupSpec;
		const cards = this.selectedValues("card")
			.map(ref => this.cardMap.get(ref)?.card)
			.filter(Boolean);
		const targets = this.selectedValues("target")
			.map(ref => this.targetMap.get(ref)?.player)
			.filter(Boolean);
		for (let i = 0; i < cards.length; i++) {
			withVirtualSelection(
				this.runtime.legacyBridgeHost,
				{ event: this.event, player: this.event.player, skill, cards: cards.slice(0, i), targets: [] },
				() => assertCardLegal(this.event, cards[i], this.runtime)
			);
		}
		return withVirtualSelection(
			this.runtime.legacyBridgeHost,
			{ event: this.event, player: this.event.player, skill, cards, targets },
			() => {
				const { source, definition } = resolveViewAs(spec, info, cards, this.event.player);
				if (source && !definition) fail(`backup ${skill} did not resolve viewAs definition`);
				const card = definition ? this.runtime.autoViewAs(definition, cards) : cards[0];
				for (let i = 0; i < targets.length; i++) {
					withVirtualSelection(
						this.runtime.legacyBridgeHost,
						{ event: this.event, player: this.event.player, skill, cards, targets: targets.slice(0, i) },
						() => assertTargetLegal(this.event, targets[i], card, this.runtime)
					);
				}
				return definition
					? materializeViewAsResult(skill, definition, cards, targets, this.runtime.autoViewAs)
					: { bool: true, skill, cards, targets };
			}
		);
	}

	private materializeDirect(): any {
		const cards = this.selectedValues("card")
			.map(ref => this.cardMap.get(ref)?.card)
			.filter(Boolean);
		const targets = this.selectedValues("target")
			.map(ref => this.targetMap.get(ref)?.player)
			.filter(Boolean);
		const buttons = this.selectedItems("button");
		return materializeDirectResult({
			kind: this.directKind!,
			event: this.event,
			cards,
			targets,
			buttons,
			control: this.selectedItems("control")[0],
			targetCard: this.selectedDirectCard(),
			numbers: this.selectedNumbers(),
			stageCount: this.stages.length,
			assertCard: card => {
				if (this.eventSpec?.steps?.some(step => step.type === "card" && step.filter)) {
					if (!isCardOwned(this.event, card, this.runtime)) fail("direct card ownership changed");
				} else assertCardLegal(this.event, card, this.runtime);
			},
			assertTarget: (target, card) => {
				if (this.eventSpec?.steps?.some(step => step.type === "target" && step.filter)) {
					if (!isTargetCurrent(this.event, target, this.runtime)) fail("direct target state changed");
				} else assertTargetLegal(this.event, target, card, this.runtime);
			},
			fail,
		});
	}

	private registerProposalSelection(cards: any[], targets: any[], kind: "card" | "respond" | "discard"): void {
		const cardSpec = this.eventSpec?.steps?.find(step => step.type === "card");
		const targetSpec = this.eventSpec?.steps?.find(step => step.type === "target");
		const cardSelect = cardSpec?.select ?? (kind === "discard" ? (this.event.selectCard ?? 1) : 1);
		const steps: any[] = [{ id: `proposal:${kind}:card`, type: "card", select: cardSelect, required: cardSpec?.required ?? (kind === "discard" ? undefined : true), filter: cardSpec?.filter || ((card: any) => isCardOwned(this.event, card, this.runtime) && this.event.filterCard?.(card, this.event.player) !== false) }];
		if (kind === "card" && (typeof this.event.filterTarget === "function" || this.event.selectTarget !== undefined || this.event.targetRequired)) {
			steps.push({ id: "proposal:card:target", type: "target", select: targetSpec?.select ?? this.authoritativeCardTargetSelect(cards[0]), required: targetSpec?.required ?? (this.event.targetRequired ? true : undefined), filter: targetSpec?.filter || ((target: any) => isTargetCurrent(this.event, target, this.runtime) && this.event.filterTarget?.(cards[0], this.event.player, target) !== false) });
		}
		this.stages = this.registerSkillSteps({ steps }, {});
		for (const stage of this.stages) {
			const refs = stage.type === "card" ? this.refsForCards(cards) : this.refsForTargets(targets);
			const outcome = this.selection.setSelection(stage.id, refs);
			if (!outcome.ok) fail(`${kind}: ${stage.type} ${outcome.reason || outcome.status}`);
		}
	}

	private authoritativeCardTargetSelect(card: any): any {
		return resolveAuthoritativeTargetRange(this.event, card, this.event.player, this.runtime);
	}

	private assertSkillCardLegal(card: any, info: any, spec?: HeadlessSelectionSpec, selectedBeforeCard: any[] = []): void {
		if (!isCardOwned(this.event, card, this.runtime)) fail("skill card is no longer owned by the player");
		try {
			withVirtualSelection(
				this.runtime.legacyBridgeHost,
				{ event: this.event, player: this.event.player, skill: this.skillName, cards: selectedBeforeCard, targets: [], synthesizeBackup: true },
				() => {
					if (!spec?.steps?.some(step => step.type === "card" && step.filter) && !matchesSelectionFilter(info.filterCard, card, this.event.player, info, this.runtime.normalizeFilter, this.event)) fail("skill card is no longer legal");
				}
			);
		} catch (error) {
			if ((error as any)?.stage) throw error;
			fail("skill card legality could not be verified");
		}
	}

	private assertSkillTargetLegal(target: any, card: any, info: any, spec?: HeadlessSelectionSpec, selectedCards: any[] = [], selectedBeforeTarget: any[] = []): void {
		if (!isTargetCurrent(this.event, target, this.runtime)) fail("skill target is no longer current");
		try {
			withVirtualSelection(
				this.runtime.legacyBridgeHost,
				{ event: this.event, player: this.event.player, skill: this.skillName, cards: selectedCards, targets: selectedBeforeTarget, synthesizeBackup: true },
				() => {
					if (!spec?.steps?.some(step => step.type === "target" && step.filter) && info.filterTarget !== undefined && !evalFilterTargetValue(info.filterTarget, card, this.event.player, target)) fail("skill target is no longer legal");
					if (getViewAsSource(spec, info) && typeof this.event.filterTarget === "function" && !this.event.filterTarget(card, this.event.player, target)) fail("viewAs target is no longer legal");
				}
			);
		} catch (error) {
			if ((error as any)?.stage) throw error;
			fail("skill target legality could not be verified");
		}
	}
}

/** 保持旧的导出入口，调用方可以继续一次性翻译。 */
export function translateResult(event: any, toolCall: ToolCallResult, candidates: { cards: CandidateCard[]; skills: string[] }, targets: CandidateTarget[] = [], runtime?: DecisionRuntime): any {
	if (!runtime) fail("translateResult requires a decision runtime");
	return new DecisionSession(event, candidates, runtime, targets).accept(toolCall).result ?? fail("Action requires additional selection turns");
}
