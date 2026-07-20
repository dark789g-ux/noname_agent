import { game, get, lib } from "noname";
import { SelectionContext, SelectionSession, SelectionStep } from "@/library/selection/index.js";
import type { CandidateCard, CandidateTarget } from "./candidates.js";
import { isSkillEligible } from "./candidates.js";
import type { ToolCallResult } from "./client.js";
import { buildBackupStepDefinitions, getViewAsSource, materializeViewAsResult, mergeBackupSelectionSpecs, resolveCardTargetSelect, resolveViewAs, type BackupDecisionKind } from "./backup-protocol.js";
import { materializeDirectResult } from "./direct-materializer.js";
import { assertActionAllowed, parseActionProposal, selectionRequired, uniqueLegacyMatch, type ActionProposal } from "./protocol.js";
import { deriveSimpleSteps, directSelectionDefinition, fail, labelFor, normalizeRange, resolveSelectionSpec, shortRefPrefix, type HeadlessSelectionSpec } from "./selection-adapter.js";
export { parseActionProposal, type ActionProposal } from "./protocol.js";
export type { HeadlessSelectionSpec } from "./selection-adapter.js";

export interface DecisionStage {
	id: string;
	type: "button" | "card" | "target" | "control" | "number";
	items: { ref: string; label: string }[];
	range: [number, number];
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

	constructor(
		private readonly event: any,
		private readonly candidates: { cards: CandidateCard[]; skills: string[] },
		targets: CandidateTarget[],
	) {
		for (const card of candidates.cards) this.cardMap.set(card.ref, card);
		for (const target of targets) this.targetMap.set(target.ref, target);
		this.eventSpec = resolveSelectionSpec(event.selectionSpec, event, event.player);
		this.selection = new SelectionSession({ context: new SelectionContext({ event, player: event.player, source: "llm" }), filterOk: this.eventSpec?.finalPredicate ? context => this.eventSpec!.finalPredicate!(context, event, event.player) : undefined });
		this.hasExplicitFinalPredicate = !!this.eventSpec?.finalPredicate;
		if (!this.initializeBackupSelection()) this.initializeDirectSelection();
	}

	get stage(): DecisionStage | undefined {
		return this.stages[this.currentStageIndex];
	}

	get isPending(): boolean {
		return !!this.stage;
	}

	revalidate(): void {
		if (this.candidates.cards.some(candidate => !this.isCardOwned(candidate.card))) fail("candidate card ownership changed during decision");
		if (Array.from(this.targetMap.values()).some(candidate => !this.isTargetCurrent(candidate.player))) fail("candidate target state changed during decision");
		if (this.candidates.skills.some(skill => !isSkillEligible(this.event, this.event.player, skill))) fail("candidate skill eligibility changed during decision");
		if (this.stage) {
			const outcome = this.selection.evaluate(this.stage.id);
			if (outcome.status === "invalid" || outcome.status === "unsupported") fail(`selection: current stage is no longer valid (${outcome.reason || outcome.status})`);
		}
	}

	toLogResult(result: any): Record<string, any> {
		const plain: Record<string, any> = { bool: result?.bool };
		if (typeof result?.skill === "string") plain.skill = result.skill;
		for (const type of ["button", "card", "target", "control", "number"] as const) {
			const refs = this.selectedValues(type);
			if (refs.length) plain[`${type}_refs`] = refs;
		}
		if (Array.isArray(result?.numbers)) plain.numbers = result.numbers.slice();
		if (typeof result?.control === "string") plain.control = result.control;
		if (typeof result?.index === "number") plain.index = result.index;
		return plain;
	}

	accept(toolCall: ToolCallResult): { pending?: DecisionStage; result?: any } {
		if (this.stage) return this.acceptStage(toolCall);
		const proposal = parseActionProposal(toolCall);
		assertActionAllowed(proposal, !!this.event.forced);
		switch (proposal.kind) {
			case "pass": return { result: { bool: false } };
			case "bool": return { result: { bool: proposal.bool } };
			case "card": return { result: this.materializeCard(proposal) };
			case "respond": return { result: this.materializeRespond(proposal) };
			case "discard": return { result: this.materializeDiscard(proposal) };
			case "skill": return this.startSkill(proposal);
		}
	}

	private materializeCard(proposal: ActionProposal): any {
		const cards = this.resolveCards(proposal.cardRefs, "use_card", 1, 1);
		const card = cards[0];
		this.assertCardStillLegal(card);
		let targets = this.resolveTargets(proposal.targetRefs, card, "use_card");
		this.registerProposalSelection(cards, targets, "card");
		this.finalizeOrFail();
		targets = this.selectedValues("target").map(ref => this.targetMap.get(ref)?.player).filter(Boolean);
		return { bool: true, card, cards, targets };
	}

	private materializeRespond(proposal: ActionProposal): any {
		const cards = this.resolveCards(proposal.cardRefs, "respond_card", 1, 1);
		this.assertCardStillLegal(cards[0]);
		this.registerProposalSelection(cards, [], "respond");
		this.finalizeOrFail();
		return { bool: true, card: cards[0], cards };
	}

	private materializeDiscard(proposal: ActionProposal): any {
		const cards = this.resolveCards(proposal.cardRefs, "discard_cards", 1);
		for (const card of cards) this.assertCardStillLegal(card);
		this.registerProposalSelection(cards, [], "discard");
		this.finalizeOrFail();
		return { bool: true, cards };
	}

	private startSkill(proposal: ActionProposal): { pending?: DecisionStage; result?: any } {
		if (!proposal.skillName || !this.candidates.skills.includes(proposal.skillName) || !isSkillEligible(this.event, this.event.player, proposal.skillName)) fail(`use_skill: skill "${proposal.skillName}" is no longer eligible`);
		this.skillName = proposal.skillName;
		const info = lib.skill[proposal.skillName];
		if (!info) fail(`use_skill: unknown skill "${proposal.skillName}"`);
		const spec = resolveSelectionSpec(info.selectionSpec, this.event, this.event.player);
		if (!spec) fail(`use_skill: skill "${proposal.skillName}" has no headless selectionSpec`);
		this.installFinalPredicate(spec);
		if (typeof info.filterOk === "function" && !spec.finalPredicate) fail(`use_skill: skill "${proposal.skillName}" has UI-dependent filterOk without finalPredicate`);
		// chooseButton 的 dialog/link 可能包含不可序列化对象。由 content 创建
		// 后续 chooseButton 子事件；此处仅返回技能中间结果，绝不伪造最终选择。
		if (info.chooseButton && !spec.steps) {
			this.finalizeOrFail();
			return { result: { bool: true, skill: proposal.skillName, cards: [], targets: [] } };
		}
		this.stages = this.registerSkillSteps(spec, info);
		this.consumeInitialSkillSelections(proposal);
		if (this.stage) return { pending: this.stage };
		this.finalizeOrFail();
		return { result: this.materializeSkill() };
	}

	private registerSkillSteps(spec: HeadlessSelectionSpec, info: any): DecisionStage[] {
		const rawSteps = spec.steps ? spec.steps.slice() : deriveSimpleSteps(info);
		if (!spec.steps && getViewAsSource(spec, info) && !rawSteps.some(step => step.type === "target") && typeof this.event.filterTarget === "function") {
			rawSteps.push({ type: "target", select: () => this.viewAsTargetRange(info, spec) });
		}
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
				items: values,
				select,
				isSelectable: (value: string, context: any, selected: string[]) => this.isStepSelectable(raw, info, spec, itemMap.get(value), context, selected),
				required: false,
				forced: true,
			}));
			let initial = this.selection.evaluate(id);
			if (initial.status === "unsupported" || initial.status === "invalid") fail(`selection: cannot inspect ${id}`);
			step.required = selectionRequired(initial.inspection?.range || normalizeRange(select), raw.required);
			initial = this.selection.evaluate(id);
			const inspectedRange = initial.inspection?.range || normalizeRange(select);
			const range = initial.inspection?.automatic ? [initial.inspection.automaticSelected.length, initial.inspection.automaticSelected.length] as [number, number] : inspectedRange;
			stages.push({ id, type: raw.type, items: Array.from(itemMap, ([ref, value]) => ({ ref, label: labelFor(value) })), range });
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
				const card = get.autoViewAs(definition, cards);
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
		const inspection = this.selection.evaluate(stage.id).inspection;
		if (inspection?.automatic && refs.length && (refs.length !== inspection.automaticSelected.length || refs.some((ref: string, index: number) => ref !== inspection.automaticSelected[index]))) fail("selection: automatic selection contains stale or incomplete references");
		const outcome = this.selection.setSelection(stage.id, refs);
		if (!outcome.ok) fail(`selection: ${outcome.reason || outcome.status}`);
		this.currentStageIndex++;
		if (this.stage) return { pending: this.stage };
		this.finalizeOrFail();
		return { result: this.backupKind ? this.materializeBackup() : this.directKind ? this.materializeDirect() : this.materializeSkill() };
	}

	private initializeBackupSelection(): boolean {
		if (!this.event.skill || !["chooseToUse", "chooseToRespond"].includes(this.event.name)) return false;
		const info = lib.skill[this.event.skill];
		if (!info) fail(`backup: unknown skill "${this.event.skill}"`);
		const infoSpec = resolveSelectionSpec(info.selectionSpec, this.event, this.event.player);
		if (!infoSpec && !this.eventSpec) fail(`backup: skill "${this.event.skill}" has no headless selectionSpec`);
		const spec = mergeBackupSelectionSpecs(infoSpec, this.eventSpec) as HeadlessSelectionSpec;
		this.skillName = this.event.skill;
		this.backupKind = this.event.name;
		this.backupInfo = info;
		this.backupSpec = spec;
		const steps = buildBackupStepDefinitions(this.event, info, spec, {
			cardFilter: card => this.isCardOwned(card) && this.event.filterCard?.(card, this.event.player, this.event) !== false,
			targetFilter: target => this.isTargetCurrent(target) && this.event.filterTarget?.(this.currentViewAsCard(info, spec), this.event.player, target) !== false,
			targetSelect: () => this.viewAsTargetRange(info, spec),
		});
		for (const step of steps) if (step.type === "card" && !step.items) step.items = this.candidates.cards.map(card => card.ref);
		this.installBackupFinalPredicate(info, spec);
		this.stages = this.registerSkillSteps({ ...spec, steps }, info);
		if (!this.stages.length) fail(`backup: skill "${this.event.skill}" has no selection stages`);
		return true;
	}
	private initializeDirectSelection(): void {
		const definition = directSelectionDefinition(this.event, this.eventSpec, { isCardOwned: card => this.isCardOwned(card), isTargetCurrent: target => this.isTargetCurrent(target), selectedCard: () => this.selectedDirectCard(), selectedNumbers: () => this.selectedNumbers() });
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
		if (!isSkillEligible(this.event, this.event.player, skill)) fail(`use_skill: skill "${skill}" is no longer eligible`);
		const info = lib.skill[skill];
		const cards = this.selectedValues("card").map(ref => this.cardMap.get(ref)?.card).filter(Boolean);
		const targets = this.selectedValues("target").map(ref => this.targetMap.get(ref)?.player).filter(Boolean);
		const spec = resolveSelectionSpec(info.selectionSpec, this.event, this.event.player);
		const { source: viewAs, definition } = resolveViewAs(spec, info, cards, this.event.player);
		const viewAsCard = definition ? get.autoViewAs(definition, cards) : undefined;
		for (const card of cards) this.assertSkillCardLegal(card, info);
		for (const target of targets) this.assertSkillTargetLegal(target, viewAsCard || cards[0], info, spec);
		if (viewAs) {
			if (!definition) fail(`use_skill: viewAs did not resolve for ${skill}`);
			if (typeof this.event.filterCard === "function" && !this.event.filterCard(viewAsCard, this.event.player, this.event)) fail(`use_skill: viewAs card is no longer legal for ${skill}`);
			return materializeViewAsResult(skill, definition, cards, targets, get.autoViewAs);
		}
		return { bool: true, skill, cards, targets };
	}

	private materializeBackup(): any {
		const skill = this.skillName!;
		const info = this.backupInfo;
		const spec = this.backupSpec;
		const cards = this.selectedValues("card").map(ref => this.cardMap.get(ref)?.card).filter(Boolean);
		const targets = this.selectedValues("target").map(ref => this.targetMap.get(ref)?.player).filter(Boolean);
		for (const card of cards) this.assertCardStillLegal(card);
		const { definition } = resolveViewAs(spec, info, cards, this.event.player);
		const card = definition ? get.autoViewAs(definition, cards) : cards[0];
		for (const target of targets) this.assertTargetStillLegal(target, card);
		return materializeViewAsResult(skill, definition, cards, targets, get.autoViewAs);
	}

	private materializeDirect(): any {
		const cards = this.selectedValues("card").map(ref => this.cardMap.get(ref)?.card).filter(Boolean);
		const targets = this.selectedValues("target").map(ref => this.targetMap.get(ref)?.player).filter(Boolean);
		const buttons = this.selectedItems("button");
		return materializeDirectResult({
			kind: this.directKind!, event: this.event, cards, targets, buttons,
			control: this.selectedItems("control")[0], targetCard: this.selectedDirectCard(),
			numbers: this.selectedNumbers(), stageCount: this.stages.length,
			assertCard: card => this.assertCardStillLegal(card),
			assertTarget: (target, card) => this.assertTargetStillLegal(target, card), fail,
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
		const scopedCards = this.candidates.cards.filter(card => !this.skillName || !card.skills || card.skills.includes(this.skillName));
		const source = raw.items || (raw.type === "card" ? scopedCards.map(card => card.ref) : raw.type === "target" ? Array.from(this.targetMap.keys()) : []);
		const map = new Map<string, any>();
		for (const [index, value] of source.entries()) {
			const existingRef = typeof value === "string" ? value : value?.ref;
			const ref = this.cardMap.has(existingRef) || this.targetMap.has(existingRef) ? existingRef : value?.ref || `${shortRefPrefix(raw.type)}${index}`;
			const item = this.cardMap.get(ref)?.card || this.targetMap.get(ref)?.player || value;
			if (ref) map.set(ref, item);
		}
		return map;
	}

	private isStepSelectable(raw: any, info: any, spec: HeadlessSelectionSpec, value: any, context: any, selected: string[]): boolean {
		if (!value) return false;
		try {
			if (raw.type === "card" && !this.isCardOwned(value)) return false;
			if (raw.type === "target" && !this.isTargetCurrent(value)) return false;
			if (typeof raw.filter === "function") return !!raw.filter(value, this.event.player, context, selected);
			if (raw.type === "card" && typeof info.filterCard === "function") return !!info.filterCard(value, this.event.player);
			if (raw.type === "target" && typeof info.filterTarget === "function") return !!info.filterTarget(this.selectedCard(), this.event.player, value);
			if (raw.type === "target" && getViewAsSource(spec, info) && typeof this.event.filterTarget === "function") return !!this.event.filterTarget(this.currentViewAsCard(info, spec), this.event.player, value);
			return true;
		} catch {
			return false;
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
		return definition ? get.autoViewAs(definition, cards) : undefined;
	}

	private viewAsTargetRange(info: any, spec?: HeadlessSelectionSpec): any {
		const card = this.currentViewAsCard(info, spec);
		return resolveCardTargetSelect(card, this.event.player, value => get.info(value));
	}

	private registerProposalSelection(cards: any[], targets: any[], kind: "card" | "respond" | "discard"): void {
		const cardSpec = this.eventSpec?.steps?.find(step => step.type === "card");
		const targetSpec = this.eventSpec?.steps?.find(step => step.type === "target");
		const cardSelect = cardSpec?.select ?? (kind === "discard" ? (this.event.selectCard ?? 1) : 1);
		const steps: any[] = [{ id: `proposal:${kind}:card`, type: "card", select: cardSelect, required: cardSpec?.required ?? (kind === "discard" ? undefined : true), filter: cardSpec?.filter || ((card: any) => this.isCardOwned(card) && this.event.filterCard?.(card, this.event.player) !== false) }];
		if (kind === "card" && (typeof this.event.filterTarget === "function" || this.event.selectTarget !== undefined || this.event.targetRequired)) {
			steps.push({ id: "proposal:card:target", type: "target", select: targetSpec?.select ?? this.authoritativeCardTargetSelect(cards[0]), required: targetSpec?.required ?? (this.event.targetRequired ? true : undefined), filter: targetSpec?.filter || ((target: any) => this.isTargetCurrent(target) && this.event.filterTarget?.(cards[0], this.event.player, target) !== false) });
		}
		this.stages = this.registerSkillSteps({ steps }, {});
		for (const stage of this.stages) {
			const refs = stage.type === "card" ? this.refsForCards(cards) : this.refsForTargets(targets);
			const outcome = this.selection.setSelection(stage.id, refs);
			if (!outcome.ok) fail(`${kind}: ${stage.type} ${outcome.reason || outcome.status}`);
		}
	}

	private authoritativeCardTargetSelect(card: any): any {
		return resolveCardTargetSelect(card, this.event.player, value => get.info(value));
	}

	private finalizeOrFail(): void {
		if (typeof this.event.filterOk === "function" && !this.hasExplicitFinalPredicate) fail("unsupported: legacy filterOk has no headless finalPredicate");
		const final = this.selection.finalize();
		if (!final.ok) fail(`selection: ${final.reason || final.status}`);
	}

	private canonicalCardRefs(refs: string[]): string[] {
		return this.refsForCards(this.resolveCards(refs, "selection", 0));
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

	private isCardOwned(card: any): boolean {
		try {
			return get.owner(card) === this.event.player || this.event.player.getCards("hejxs").includes(card);
		} catch {
			return false;
		}
	}

	private isTargetCurrent(target: any): boolean {
		if (game.players.includes(target)) return typeof target.isIn !== "function" || target.isIn();
		return !!this.event.deadTarget && game.dead.includes(target);
	}

	private resolveCards(refs: string[] | undefined, action: string, min: number, max = Infinity): any[] {
		if (!Array.isArray(refs) || refs.length < min || refs.length > max) fail(`${action}: invalid card count`);
		const values = refs.map(ref => {
			const direct = this.cardMap.get(ref)?.card;
			if (direct) return direct;
			return uniqueLegacyMatch(this.candidates.cards, ref, card => card.id)?.card;
		});
		if (values.some(card => !card) || new Set(values).size !== values.length) fail(`${action}: unknown or duplicate card reference`);
		return values;
	}

	private resolveTargets(refs: string[] | undefined, card: any, action: string): any[] {
		const values = refs || [];
		const targets = values.map(ref => this.targetMap.get(ref)?.player);
		if (targets.some(target => !target) || new Set(targets).size !== targets.length) fail(`${action}: unknown or duplicate target reference`);
		for (const target of targets) this.assertTargetStillLegal(target, card);
		return targets;
	}

	private assertCardStillLegal(card: any): void {
		try {
			if (!this.isCardOwned(card)) fail("card is no longer owned by the player");
			if (typeof this.event.filterCard === "function" && !this.event.filterCard(card, this.event.player)) fail("card is no longer legal");
		} catch (error) {
			if ((error as any)?.stage) throw error;
			fail("card legality could not be verified");
		}
	}

	private assertTargetStillLegal(target: any, card: any): void {
		try {
			if (!this.isTargetCurrent(target)) fail("target is no longer current");
			if (typeof this.event.filterTarget === "function" && !this.event.filterTarget(card, this.event.player, target)) fail("target is no longer legal");
		} catch (error) {
			if ((error as any)?.stage) throw error;
			fail("target legality could not be verified");
		}
	}

	private assertSkillCardLegal(card: any, info: any): void {
		if (!this.isCardOwned(card)) fail("skill card is no longer owned by the player");
		try {
			if (typeof info.filterCard === "function" && !info.filterCard(card, this.event.player)) fail("skill card is no longer legal");
		} catch (error) {
			if ((error as any)?.stage) throw error;
			fail("skill card legality could not be verified");
		}
	}
	private assertSkillTargetLegal(target: any, card: any, info: any, spec?: HeadlessSelectionSpec): void {
		if (!this.isTargetCurrent(target)) fail("skill target is no longer current");
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
export function translateResult(event: any, toolCall: ToolCallResult, candidates: { cards: CandidateCard[]; skills: string[] }, targets: CandidateTarget[] = []): any {
	return new DecisionSession(event, candidates, targets).accept(toolCall).result ?? fail("Action requires additional selection turns");
}
