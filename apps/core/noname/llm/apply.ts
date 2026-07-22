import { SelectionContext, SelectionSession, SelectionStep } from "@/library/selection/index.js";
import type { CandidateCard, CandidateTarget } from "./candidates.js";
import { assertSupportedTargetRules, resolveAuthoritativeTargetRange, resolveSkillActionPlan, type ActionCandidateRuntime, type CandidateAction, type DecisionCandidateSnapshot } from "./action-candidates.js";
import { assertActionTargets, assertCardLegal, assertTargetLegal, buildDecisionLogResult, isCardOwned, isTargetCurrent, materializeResponseResult, requireAction, resolveActionCardRefs, resolveCandidateCards, resolveCandidateTargets, resolveCurrentAction, type ValidationRuntime } from "./decision-validation.js";
import type { ToolCallResult } from "./client.js";
import { buildBackupStepDefinitions, getViewAsSource, materializeViewAsResult, mergeBackupSelectionSpecs, resolveViewAs, type BackupDecisionKind } from "./backup-protocol.js";
import { materializeDirectResult } from "./direct-materializer.js";
import { assertActionAllowed, parseActionProposal, selectionRequired, type ActionProposal } from "./protocol.js";
import { actionResolution, deriveSimpleSteps, directSelectionDefinition, fail, labelFor, normalizeRange, resolveSelectionSpec, shortRefPrefix, type HeadlessSelectionSpec } from "./selection-adapter.js";
export { parseActionProposal, type ActionProposal } from "./protocol.js";
export type { HeadlessSelectionSpec } from "./selection-adapter.js";

export interface DecisionStage {
	id: string;
	type: "button" | "card" | "target" | "control" | "number";
	items: { ref: string; label: string }[];
	range: [number, number];
}

export interface DecisionRuntime extends ActionCandidateRuntime, ValidationRuntime {
	translate(value: any): string;
	isSkillEligible(event: any, player: any, skill: string): boolean;
}

export class DecisionSession {
	private readonly cardMap = new Map<string, CandidateCard>();
	private readonly targetMap = new Map<string, CandidateTarget>();
	private readonly selection: SelectionSession;
	private readonly stepItems = new Map<string, Map<string, any>>();
	private skillName?: string;
	private stages: DecisionStage[] = [];
	private currentStageIndex = 0;
	private directKind?: string;
	private backupKind?: BackupDecisionKind;
	private backupInfo?: any;
	private backupSpec?: HeadlessSelectionSpec;
	private hasExplicitFinalPredicate = false;
	private readonly eventSpec?: HeadlessSelectionSpec;
	private readonly snapshot?: DecisionCandidateSnapshot;
	private activeAction?: CandidateAction;
	private responseCard?: any;

	constructor(
		private readonly event: any,
		private readonly candidates: DecisionCandidateSnapshot | { cards: CandidateCard[]; skills: string[] },
		private readonly runtime: DecisionRuntime,
		targets: CandidateTarget[] = ("targetPool" in candidates ? candidates.targetPool : []),
	) {
		if ("targetPool" in candidates) this.snapshot = candidates;
		for (const card of candidates.cards) this.cardMap.set(card.ref, card);
		for (const target of targets) this.targetMap.set(target.ref, target);
		this.eventSpec = resolveSelectionSpec(event.selectionSpec, event, event.player);
		this.selection = new SelectionSession({ context: new SelectionContext({ event, player: event.player, source: "llm" } as any), filterOk: this.eventSpec?.finalPredicate ? context => this.eventSpec!.finalPredicate!(context, event, event.player) : undefined });
		this.hasExplicitFinalPredicate = !!this.eventSpec?.finalPredicate;
		if (!this.initializeBackupSelection()) this.initializeDirectSelection();
	}

	get stage(): DecisionStage | undefined {
		this.advanceAutomaticStages();
		const stage = this.stages[this.currentStageIndex];
		if (!stage) return undefined;
		const inspection = this.selection.evaluate(stage.id).inspection;
		if (!inspection) return stage;
		const available = inspection.entries.filter((entry: any) => entry.available);
		if (!inspection.automatic && inspection.range[0] > available.length) actionResolution(`selection ${stage.id} has no legal continuation`);
		return { ...stage, range: inspection.automatic ? [inspection.automaticSelected.length, inspection.automaticSelected.length] : inspection.range, items: available.map((entry: any) => ({ ref: entry.item, label: this.stepItems.get(stage.id)?.has(entry.item) ? labelFor(this.stepItems.get(stage.id)?.get(entry.item), this.runtime.translate) : String(entry.item) })) };
	}

	get isPending(): boolean {
		return !!this.stage;
	}

	private advanceAutomaticStages(): void {
		while (this.currentStageIndex < this.stages.length) {
			const stage = this.stages[this.currentStageIndex];
			const outcome = this.selection.evaluate(stage.id);
			if (!outcome.inspection?.automatic) break;
			if (outcome.status === "invalid" || outcome.status === "unsupported") fail(`selection: automatic ${stage.id} is invalid`);
			this.currentStageIndex++;
		}
	}

	private currentActionTargetRefs(): string[] {
		if (!this.snapshot) return Array.from(this.targetMap.keys());
		const action = resolveCurrentAction(this.snapshot, this.skillName, this.activeAction);
		return action?.target.mode === "select" || action?.target.mode === "automatic" ? action.target.targetRefs : Array.from(this.targetMap.keys());
	}

	private currentActionCardRefs(): string[] {
		return resolveActionCardRefs(resolveCurrentAction(this.snapshot, this.skillName, this.activeAction), this.candidates.cards);
	}

	revalidate(): void {
		if (this.candidates.cards.some(candidate => !isCardOwned(this.event, candidate.card, this.runtime))) fail("candidate card ownership changed during decision");
		if (Array.from(this.targetMap.values()).some(candidate => !isTargetCurrent(this.event, candidate.player, this.runtime))) fail("candidate target state changed during decision");
		if (this.candidates.skills.some(skill => !this.runtime.isSkillEligible(this.event, this.event.player, skill))) fail("candidate skill eligibility changed during decision");
		if (this.stage) {
			const outcome = this.selection.evaluate(this.stage.id);
			if (outcome.status === "invalid" || outcome.status === "unsupported") fail(`selection: current stage is no longer valid (${outcome.reason || outcome.status})`);
		}
	}

	toLogResult(result: any): Record<string, any> {
		return buildDecisionLogResult(result, type => this.selectedValues(type));
	}

	accept(toolCall: ToolCallResult): { pending?: DecisionStage; result?: any } {
		if (this.stage) return this.acceptStage(toolCall);
		const proposal = parseActionProposal(toolCall);
		assertActionAllowed(proposal, !!this.event.forced);
		switch (proposal.kind) {
			case "pass": return { result: { bool: false } };
			case "bool": return { result: { bool: proposal.bool } };
			case "card": return { result: this.materializeCard(proposal) };
			case "respond": return this.startRespond(proposal);
			case "discard": return { result: this.materializeDiscard(proposal) };
			case "skill": return this.startSkill(proposal);
		}
	}

	private materializeCard(proposal: ActionProposal): any {
		const cards = resolveCandidateCards(this.cardMap, this.candidates.cards, proposal.cardRefs, "use_card", 1, 1);
		const card = cards[0];
		const action = requireAction(this.snapshot, "use_card", this.refsForCards(cards)[0]);
		assertCardLegal(this.event, card, this.runtime);
		let targets = resolveCandidateTargets(this.targetMap, assertActionTargets(action, proposal.targetRefs, "use_card"), "use_card");
		for (const target of targets) assertTargetLegal(this.event, target, card, this.runtime);
		this.registerProposalSelection(cards, targets, "card");
		this.finalizeOrFail();
		targets = this.selectedValues("target").map(ref => this.targetMap.get(ref)?.player).filter(Boolean);
		return { bool: true, card, cards, targets };
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
		const targets = this.selectedValues("target").map(ref => this.targetMap.get(ref)?.player).filter(Boolean);
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
		proposal.cardRefs = this.canonicalCardRefs(proposal.cardRefs || []);
		if (proposal.cardRefs?.some(ref => !action?.materialCardRefs.includes(ref))) fail("use_skill: material card is not allowed by this action");
		proposal.targetRefs = assertActionTargets(action, proposal.targetRefs, "use_skill");
		this.skillName = proposal.skillName;
		const info = this.runtime.getSkillInfo(proposal.skillName);
		if (!info) fail(`use_skill: unknown skill "${proposal.skillName}"`);
		const plan = resolveSkillActionPlan(this.event, this.event.player, proposal.skillName, info);
		if (!plan) fail(`use_skill: skill "${proposal.skillName}" has no headless selectionSpec`);
		const spec = plan.spec;
		this.installFinalPredicate(spec);
		if (typeof info.filterOk === "function" && !spec.finalPredicate) fail(`use_skill: skill "${proposal.skillName}" has UI-dependent filterOk without finalPredicate`);
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

	private registerSkillSteps(spec: HeadlessSelectionSpec, info: any, plannedSteps?: any[]): DecisionStage[] {
		const rawSteps = plannedSteps || spec.steps?.slice() || deriveSimpleSteps(info);
		const stages: DecisionStage[] = [];
		for (let index = 0; index < rawSteps.length; index++) {
			const raw = rawSteps[index];
			const id = raw.id || `skill:${this.skillName}:${raw.type}:${index}`;
			const itemMap = this.resolveStepItems(raw, info);
			this.stepItems.set(id, itemMap);
			const values = Array.from(itemMap.keys());
			const select = raw.select ?? (raw.type === "card" ? info.selectCard : raw.type === "target" && getViewAsSource(spec, info) ? () => this.viewAsTargetRange(info, spec) : raw.type === "target" ? info.selectTarget : 1);
			const step = this.selection.register(new SelectionStep({
				id,
				type: raw.type,
				items: values as any,
				select,
				isSelectable: (value: string, context: any, selected: string[]) => this.isStepSelectable(raw, info, spec, itemMap.get(value), context, selected),
				required: false,
				forced: true,
			} as any));
			let initial = this.selection.evaluate(id);
			if (initial.status === "unsupported" || initial.status === "invalid") fail(`selection: cannot inspect ${id}`);
			step.required = selectionRequired(initial.inspection?.range || normalizeRange(select), raw.required);
			initial = this.selection.evaluate(id);
			const inspectedRange = initial.inspection?.range || normalizeRange(select);
			const range = initial.inspection?.automatic ? [initial.inspection.automaticSelected.length, initial.inspection.automaticSelected.length] as [number, number] : inspectedRange;
			stages.push({ id, type: raw.type, items: Array.from(itemMap, ([ref, value]) => ({ ref, label: labelFor(value, this.runtime.translate) })), range });
		}
		return stages;
	}

	private consumeInitialSkillSelections(proposal: ActionProposal): void {
		const consumedTypes = new Set<string>();
		while (this.stage) {
			const stage = this.stage;
			if (stage.type !== "card" && stage.type !== "target") break;
			if (consumedTypes.has(stage.type)) break;
			const supplied = stage.type === "card" ? this.canonicalCardRefs(proposal.cardRefs || []) : proposal.targetRefs || [];
			if (!supplied.length && stage.range[0] > 0) break;
			const outcome = this.selection.setSelection(stage.id, supplied);
			if (!outcome.ok) fail(`selection: ${outcome.reason || outcome.status}`);
			consumedTypes.add(stage.type);
			this.currentStageIndex++;
		}
	}

	private installFinalPredicate(spec?: HeadlessSelectionSpec): void {
		if (!spec?.finalPredicate) return;
		this.selection.filterOk = context => spec.finalPredicate!(context, this.event, this.event.player);
		this.hasExplicitFinalPredicate = true;
	}

	private installBackupFinalPredicate(info: any, spec: HeadlessSelectionSpec): void {
		if (typeof this.event._backup?.filterOk === "function") fail(`backup: skill "${this.event.skill}" has an unsupported outer filterOk`);
		if (typeof info.filterOk === "function" && !spec.finalPredicate) fail(`backup: skill "${this.event.skill}" has UI-dependent filterOk without finalPredicate`);
		this.selection.filterOk = context => {
			const cards = this.selectedValues("card").map(ref => this.cardMap.get(ref)?.card).filter(Boolean);
			const { source, definition } = resolveViewAs(spec, info, cards, this.event.player);
			if (source) {
				if (!definition) return false;
				const card = this.runtime.autoViewAs(definition, cards);
				if (typeof this.event._backup?.filterCard === "function" && this.event._backup.filterCard(card, this.event.player, this.event) === false) return false;
			}
			return spec.finalPredicate?.(context, this.event, this.event.player) !== false;
		};
		this.hasExplicitFinalPredicate = true;
	}

	private acceptStage(toolCall: ToolCallResult): { pending?: DecisionStage; result?: any } {
		const stage = this.stage!;
		const expected = `select_${stage.type}s`;
		if (toolCall.name !== expected || (toolCall.arguments.step_id !== stage.id)) fail(`selection: expected ${expected} for ${stage.id}`);
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
		return { result: this.responseCard ? this.materializeResponse() : this.backupKind ? this.materializeBackup() : this.directKind ? this.materializeDirect() : this.materializeSkill() };
	}

	private initializeBackupSelection(): boolean {
		if (!this.event.skill || !["chooseToUse", "chooseToRespond"].includes(this.event.name)) return false;
		const info = this.runtime.getSkillInfo(this.event.skill);
		if (!info) fail(`backup: unknown skill "${this.event.skill}"`);
		const infoSpec = resolveSelectionSpec(info.selectionSpec, this.event, this.event.player);
		if (!infoSpec && !this.eventSpec) fail(`backup: skill "${this.event.skill}" has no headless selectionSpec`);
		const spec = mergeBackupSelectionSpecs(infoSpec, this.eventSpec) as HeadlessSelectionSpec;
		this.skillName = this.event.skill;
		this.backupKind = this.event.name;
		this.backupInfo = info;
		this.backupSpec = spec;
		const steps = buildBackupStepDefinitions(this.event, info, spec, {
			cardFilter: card => isCardOwned(this.event, card, this.runtime) && this.event.filterCard?.(card, this.event.player, this.event) !== false,
			targetFilter: target => isTargetCurrent(this.event, target, this.runtime) && this.event.filterTarget?.(this.currentViewAsCard(info, spec), this.event.player, target) !== false,
			targetSelect: () => this.viewAsTargetRange(info, spec),
		});
		for (const step of steps) if (step.type === "card" && !step.items) step.items = this.candidates.cards.map(card => card.ref);
		this.installBackupFinalPredicate(info, spec);
		this.stages = this.registerSkillSteps({ ...spec, steps }, info);
		if (!this.stages.length) fail(`backup: skill "${this.event.skill}" has no selection stages`);
		return true;
	}
	private initializeDirectSelection(): void {
		if (this.event.name === "chooseToUse" || this.event.name === "chooseToRespond") return;
		const definition = directSelectionDefinition(this.event, this.eventSpec, { isCardOwned: card => isCardOwned(this.event, card, this.runtime), isTargetCurrent: target => isTargetCurrent(this.event, target, this.runtime), selectedCard: () => this.selectedDirectCard(), selectedNumbers: () => this.selectedNumbers() });
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
		const cards = this.selectedValues("card").map(ref => this.cardMap.get(ref)?.card).filter(Boolean);
		const targets = this.selectedValues("target").map(ref => this.targetMap.get(ref)?.player).filter(Boolean);
		const spec = resolveSelectionSpec(info.selectionSpec, this.event, this.event.player);
		const { source: viewAs, definition } = resolveViewAs(spec, info, cards, this.event.player);
		const viewAsCard = definition ? this.runtime.autoViewAs(definition, cards) : undefined;
		for (const card of cards) this.assertSkillCardLegal(card, info);
		for (const target of targets) this.assertSkillTargetLegal(target, viewAsCard || cards[0], info, spec);
		if (viewAs) {
			if (!definition) fail(`use_skill: viewAs did not resolve for ${skill}`);
			if (typeof this.event.filterCard === "function" && !this.event.filterCard(viewAsCard, this.event.player, this.event)) fail(`use_skill: viewAs card is no longer legal for ${skill}`);
			return materializeViewAsResult(skill, definition, cards, targets, this.runtime.autoViewAs);
		}
		return { bool: true, skill, cards, targets };
	}

	private materializeBackup(): any {
		const skill = this.skillName!;
		const info = this.backupInfo;
		const spec = this.backupSpec;
		const cards = this.selectedValues("card").map(ref => this.cardMap.get(ref)?.card).filter(Boolean);
		const targets = this.selectedValues("target").map(ref => this.targetMap.get(ref)?.player).filter(Boolean);
		for (const card of cards) assertCardLegal(this.event, card, this.runtime);
		const { definition } = resolveViewAs(spec, info, cards, this.event.player);
		const card = definition ? this.runtime.autoViewAs(definition, cards) : cards[0];
		for (const target of targets) assertTargetLegal(this.event, target, card, this.runtime);
		return materializeViewAsResult(skill, definition, cards, targets, this.runtime.autoViewAs);
	}

	private materializeDirect(): any {
		const cards = this.selectedValues("card").map(ref => this.cardMap.get(ref)?.card).filter(Boolean);
		const targets = this.selectedValues("target").map(ref => this.targetMap.get(ref)?.player).filter(Boolean);
		const buttons = this.selectedItems("button");
		return materializeDirectResult({
			kind: this.directKind!, event: this.event, cards, targets, buttons,
			control: this.selectedItems("control")[0], targetCard: this.selectedDirectCard(),
			numbers: this.selectedNumbers(), stageCount: this.stages.length,
			assertCard: card => assertCardLegal(this.event, card, this.runtime),
			assertTarget: (target, card) => assertTargetLegal(this.event, target, card, this.runtime), fail,
		});
	}
	private selectedValues(type: DecisionStage["type"]): string[] {
		return this.stages.filter(stage => stage.type === type).flatMap(stage => this.selection.context.getStepSelected(stage.id));
	}

	private selectedItems(type: DecisionStage["type"]): any[] {
		return this.stages.filter(stage => stage.type === type).flatMap(stage => {
			const items = this.stepItems.get(stage.id);
			return this.selection.context.getStepSelected(stage.id).map(ref => items?.get(ref)).filter(value => value !== undefined);
		});
	}

	private selectedNumbers(): number[] {
		return this.stages.filter(stage => stage.type === "number").map((stage, index) => {
			const ref = this.selection.context.getStepSelected(stage.id)[0];
			return this.stepItems.get(stage.id)?.get(ref) ?? this.event.numbers?.[index];
		});
	}

	private selectedDirectCard(): any {
		return this.selectedValues("card")[0] ? this.cardMap.get(this.selectedValues("card")[0])?.card : this.selectedItems("button")[0]?.link;
	}

	private resolveStepItems(raw: any, info: any): Map<string, any> {
		const allowedRefs = raw.type === "card" ? this.currentActionCardRefs() : raw.type === "target" ? this.currentActionTargetRefs() : undefined;
		const source = raw.items || allowedRefs || [];
		const map = new Map<string, any>();
		for (const [index, value] of source.entries()) {
			const explicitRef = typeof value === "string" ? value : value?.ref;
			const identityRef = raw.type === "card" ? this.candidates.cards.find(card => card.card === value)?.ref : raw.type === "target" ? Array.from(this.targetMap.values()).find(target => target.player === value)?.ref : undefined;
			const ref = identityRef || (this.cardMap.has(explicitRef) || this.targetMap.has(explicitRef) ? explicitRef : raw.type === "card" || raw.type === "target" ? undefined : value?.ref || `${shortRefPrefix(raw.type)}${index}`);
			if (!ref) actionResolution(`selection ${raw.id || raw.type} contains an object outside the decision snapshot`);
			if (allowedRefs && !allowedRefs.includes(ref)) continue;
			map.set(ref, this.cardMap.get(ref)?.card || this.targetMap.get(ref)?.player || value);
		}
		return map;
	}

	private isStepSelectable(raw: any, info: any, spec: HeadlessSelectionSpec, value: any, context: any, selected: string[]): boolean {
		if (!value) return false;
		try {
			if (raw.type === "card" && !isCardOwned(this.event, value, this.runtime)) return false;
			if (raw.type === "target" && !isTargetCurrent(this.event, value, this.runtime)) return false;
			if (typeof raw.filter === "function") return !!raw.filter(value, this.event.player, context, selected);
			if (raw.type === "card" && typeof info.filterCard === "function") return !!info.filterCard(value, this.event.player);
			if (raw.type === "target" && typeof info.filterTarget === "function") return !!info.filterTarget(this.selectedCard(), this.event.player, value);
			if (raw.type === "target" && getViewAsSource(spec, info) && typeof this.event.filterTarget === "function") return !!this.event.filterTarget(this.currentViewAsCard(info, spec), this.event.player, value);
			return true;
		} catch (error) {
			if ((error as any)?.stage) throw error;
			actionResolution(`selection filter threw in ${raw.id || raw.type}: ${(error as Error)?.message || "unknown error"}`);
		}
	}

	private selectedCard(): any {
		const ref = this.selectedValues("card")[0];
		return ref ? this.cardMap.get(ref)?.card : undefined;
	}

	private currentViewAsCard(info: any, spec?: HeadlessSelectionSpec): any {
		const cards = this.selectedValues("card").map(ref => this.cardMap.get(ref)?.card).filter(Boolean);
		const resolvedSpec = spec ?? resolveSelectionSpec(info.selectionSpec, this.event, this.event.player);
		const { definition } = resolveViewAs(resolvedSpec, info, cards, this.event.player);
		return definition ? this.runtime.autoViewAs(definition, cards) : undefined;
	}

	private viewAsTargetRange(info: any, spec?: HeadlessSelectionSpec): any {
		const card = this.currentViewAsCard(info, spec);
		assertSupportedTargetRules(this.runtime.getCardInfo(card), `skill "${this.skillName}" viewAs card`);
		return resolveAuthoritativeTargetRange(this.event, card, this.event.player, this.runtime);
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

	private finalizeOrFail(): void {
		if (typeof this.event.filterOk === "function" && !this.hasExplicitFinalPredicate) fail("unsupported: legacy filterOk has no headless finalPredicate");
		const final = this.selection.finalize();
		if (!final.ok) fail(`selection: ${final.reason || final.status}`);
	}

	private canonicalCardRefs(refs: string[]): string[] {
		return this.refsForCards(resolveCandidateCards(this.cardMap, this.candidates.cards, refs, "selection", 0));
	}

	private refsForCards(cards: any[]): string[] {
		return cards.map(card => {
			const candidate = this.candidates.cards.find(value => value.card === card);
			if (!candidate) fail("card is not in the current candidate set");
			return candidate.ref;
		});
	}

	private refsForTargets(targets: any[]): string[] {
		return targets.map(target => {
			const candidate = Array.from(this.targetMap.values()).find(value => value.player === target);
			if (!candidate) fail("target is not in the current candidate set");
			return candidate.ref;
		});
	}

	private assertSkillCardLegal(card: any, info: any): void {
		if (!isCardOwned(this.event, card, this.runtime)) fail("skill card is no longer owned by the player");
		try {
			if (typeof info.filterCard === "function" && !info.filterCard(card, this.event.player)) fail("skill card is no longer legal");
		} catch (error) {
			if ((error as any)?.stage) throw error;
			fail("skill card legality could not be verified");
		}
	}
	private assertSkillTargetLegal(target: any, card: any, info: any, spec?: HeadlessSelectionSpec): void {
		if (!isTargetCurrent(this.event, target, this.runtime)) fail("skill target is no longer current");
		try {
			if (typeof info.filterTarget === "function" && !info.filterTarget(card, this.event.player, target)) fail("skill target is no longer legal");
			if (getViewAsSource(spec, info) && typeof this.event.filterTarget === "function" && !this.event.filterTarget(card, this.event.player, target)) fail("viewAs target is no longer legal");
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
