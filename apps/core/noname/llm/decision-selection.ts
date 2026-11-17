import { SelectionContext, SelectionSession, SelectionStep } from "@/library/selection/index.js";
import type { CandidateCard, CandidateTarget } from "./candidates.js";
import { assertSupportedTargetRules, resolveAuthoritativeTargetRange, type ActionCandidateRuntime, type CandidateAction, type DecisionCandidateSnapshot } from "./action-candidates.js";
import { buildDecisionLogResult, directCardTargetLiveness, formatTargetInstruction, isCardOwned, isTargetCurrent, resolveActionCardRefs, resolveAddedTargetPreTarget, resolveCandidateCards, resolveCurrentAction, type ValidationRuntime } from "./decision-validation.js";
import { matchesSelectionFilter } from "./selection-filter.js";
import { getViewAsSource, resolveViewAs, type BackupDecisionKind } from "./backup-protocol.js";
import { evaluateSelectionSpec } from "./generic-skill-plan.js";
import { withVirtualSelection } from "./legacy-bridge.js";
import { selectionRequired, type ActionProposal } from "./protocol.js";
import { actionResolution, deriveSimpleSteps, fail, formatSelectionFailure, labelFor, normalizeRange, resolveSelectionSpec, shortRefPrefix, type HeadlessSelectionSpec } from "./selection-adapter.js";
import { resolveBaseEvent, resolveEffectiveSkillSemantics, resolvePoolTargetFlags, type EffectiveSkillSemantics } from "./skill-backup-semantics.js";

export interface DecisionStage {
	id: string;
	type: "button" | "card" | "target" | "control" | "number";
	items: { ref: string; label: string }[];
	range: [number, number];
	instruction?: string;
}

export interface DecisionRuntime extends ActionCandidateRuntime, ValidationRuntime {
	translate(value: any): string;
	isSkillEligible(event: any, player: any, skill: string): boolean;
	normalizeFilter?(filter: any): Function;
}

export class DecisionSelection {
	protected readonly cardMap = new Map<string, CandidateCard>();

	protected readonly targetMap = new Map<string, CandidateTarget>();

	protected readonly selection: SelectionSession<string>;

	protected readonly stepItems = new Map<string, Map<string, any>>();
	protected readonly automaticSteps: string[] = [];
	protected readonly stepIdentities = new Map<string, Map<any, { ref: string; link?: any }>>();

	protected skillName?: string;

	protected stages: DecisionStage[] = [];

	protected currentStageIndex = 0;

	protected directKind?: string;

	protected backupKind?: BackupDecisionKind;

	protected backupInfo?: any;

	protected backupSpec?: HeadlessSelectionSpec;

	protected skillInfo?: any;

	protected skillSpec?: HeadlessSelectionSpec;

	protected skillSemantics?: EffectiveSkillSemantics;

	protected skillFilterInstalled = false;

	protected hasExplicitFinalPredicate = false;

	protected readonly eventSpec?: HeadlessSelectionSpec;

	protected readonly snapshot?: DecisionCandidateSnapshot;

	protected activeAction?: CandidateAction;

	protected responseCard?: any;

	protected directUseCard?: any;

	constructor(
		protected readonly event: any,
		protected readonly candidates: DecisionCandidateSnapshot | { cards: CandidateCard[]; skills: string[] },
		protected readonly runtime: DecisionRuntime,
		targets: CandidateTarget[] = "targetPool" in candidates ? candidates.targetPool : []
	) {
		if (event?.selectionSpec === false) fail("decision disabled by selectionSpec: false");
		if ("targetPool" in candidates) this.snapshot = candidates;
		for (const card of candidates.cards) this.cardMap.set(card.ref, card);
		for (const target of targets) this.targetMap.set(target.ref, target);
		this.eventSpec = resolveSelectionSpec(event.selectionSpec, event, event.player);
		this.selection = new SelectionSession<string>({ context: new SelectionContext<string>({ event, player: event.player, source: "llm" }), filterOk: this.eventSpec?.finalPredicate ? context => this.eventSpec!.finalPredicate!(context, event, event.player) : undefined });
		this.hasExplicitFinalPredicate = !!this.eventSpec?.finalPredicate;
	}

	get stage(): DecisionStage | undefined {
		this.advanceAutomaticStages();
		const stage = this.stages[this.currentStageIndex];
		if (!stage) return undefined;
		const inspection = this.selection.evaluate(stage.id).inspection;
		if (!inspection) return stage;
		const available = inspection.entries.filter((entry: any) => entry.available);
		if (!inspection.automatic && inspection.range[0] > available.length) actionResolution(`selection ${stage.id} has no legal continuation`);
		return { ...stage, range: inspection.automatic ? [inspection.automaticSelected.length, inspection.automaticSelected.length] : [inspection.range[0], Math.min(inspection.range[1], available.length)], items: available.map((entry: any) => ({ ref: entry.item, label: this.stepItems.get(stage.id)?.has(entry.item) ? labelFor(this.stepItems.get(stage.id)?.get(entry.item), this.runtime.translate) : String(entry.item) })) };
	}

	isInitialStageImpossible(): boolean {
		if (this.currentStageIndex !== 0) return false;
		this.advanceAutomaticStages();
		const stage = this.stages[this.currentStageIndex];
		if (!stage) return false;
		const inspection = this.selection.evaluate(stage.id).inspection;
		if (!inspection) return false;
		const availableCount = inspection.entries.filter((entry: any) => entry.available).length;
		return !inspection.automatic && inspection.range[0] > availableCount;
	}

	protected advanceAutomaticStages(): void {
		while (this.currentStageIndex < this.stages.length) {
			const stage = this.stages[this.currentStageIndex];
			const outcome = this.selection.evaluate(stage.id);
			if (!outcome.inspection?.automatic && outcome.inspection?.range[1] !== 0) break;
			if (outcome.status === "invalid" || outcome.status === "unsupported") fail(`selection: automatic ${stage.id} is invalid`);
			this.automaticSteps.push(stage.id);
			this.currentStageIndex++;
		}
	}

	protected currentActionTargetRefs(): string[] {
		if (!this.snapshot) return Array.from(this.targetMap.keys());
		const action = resolveCurrentAction(this.snapshot, this.skillName, this.activeAction);
		return action?.target.mode === "select" || action?.target.mode === "automatic" ? action.target.targetRefs : Array.from(this.targetMap.keys());
	}

	protected currentActionCardRefs(): string[] {
		return resolveActionCardRefs(resolveCurrentAction(this.snapshot, this.skillName, this.activeAction), this.candidates.cards);
	}

	revalidate(): void {
		if (this.candidates.cards.some(candidate => !isCardOwned(this.event, candidate.card, this.runtime))) fail("candidate card ownership changed during decision");
		const poolFlags = resolvePoolTargetFlags({ event: this.event, cards: this.candidates.cards, skills: this.candidates.skills, activeSkill: this.skillName, activeSpec: this.skillSpec, activeSemantics: this.skillSemantics, selectedCards: this.selectedCards(), runtime: this.runtime });
		if (Array.from(this.targetMap.values()).some(candidate => !isTargetCurrent(resolveBaseEvent(this.event), candidate.player, this.runtime, poolFlags))) fail("candidate target state changed during decision");
		if (this.candidates.skills.some(skill => !this.runtime.isSkillEligible(this.event, this.event.player, skill))) fail("candidate skill eligibility changed during decision");
		if (this.stage) {
			const outcome = this.selection.evaluate(this.stage.id);
			if (outcome.status === "invalid" || outcome.status === "unsupported") fail(`selection: current stage is no longer valid (${outcome.reason || outcome.status})`);
		}
	}

	protected resolveSkillSemantics(info: any, spec?: HeadlessSelectionSpec): EffectiveSkillSemantics {
		return resolveEffectiveSkillSemantics({ event: this.event, player: this.event.player, skill: this.skillName, info, spec, runtime: this.runtime });
	}

	protected selectedCards(): any[] {
		return this.selectedValues("card")
			.map(ref => this.cardMap.get(ref)?.card)
			.filter(Boolean);
	}

	toLogResult(result: any): Record<string, any> {
		return { ...buildDecisionLogResult(result, type => this.selectedValues(type)), ...(this.automaticSteps.length ? { automatic_steps: this.automaticSteps.slice() } : {}) };
	}

	protected registerSkillSteps(spec: HeadlessSelectionSpec, info: any, plannedSteps?: any[]): DecisionStage[] {
		const rawSteps = plannedSteps || spec.steps?.slice() || deriveSimpleSteps(info);
		const semantics = this.skillName ? (this.skillSemantics || this.resolveSkillSemantics(info, spec)) : undefined;
		const targetStepsCount = rawSteps.filter(step => step.type === "target").length;
		const prompts = Array.isArray(info?.targetprompt) ? info.targetprompt : Array.isArray(this.event?.targetprompt) ? this.event.targetprompt : undefined;
		let targetOrder = 0;
		return rawSteps.map((original, index) => {
			const prefix = this.skillName ? `skill:${this.skillName}` : `direct:${this.directKind || this.event?.name || "event"}`;
			const id = original.id || `${prefix}:${original.type}:${index}`;
			const raw = { ...original, id };
			const select =
				raw.select ??
				(raw.type === "card"
					? (semantics?.effectiveSelectCard ?? info?.selectCard)
					: raw.type === "target" && info?.selectTarget !== undefined
						? info.selectTarget
						: raw.type === "target" && (semantics ? semantics.hasViewAs : getViewAsSource(spec, info))
							? () => this.viewAsTargetRange(info, spec)
							: raw.type === "target"
								? info?.selectTarget
								: 1);
			const step = new SelectionStep({
				id,
				type: raw.type,
				selectionMode: raw.selectionMode,
				items: (context: any) =>
					this.withBridge(context, undefined, undefined, () => {
						if (raw.type === "target" && raw.deferredFromCards && !info?.filterTarget && info?.selectTarget === undefined && this.runtime.getCardInfo(this.currentViewAsCard(info, spec))?.notarget) {
							this.stepItems.set(id, new Map());
							return [];
						}
						const map = this.resolveStepItems(raw, info, this.stepContext(context));
						this.stepItems.set(id, map);
						return Array.from(map.keys());
					}),
				select: (context: any, selected: string[]) =>
					this.withBridge(
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
				isSelectable: (ref: string, context: any, selected: string[]) =>
					this.withBridge(
						context,
						selected,
						raw.type,
						() => this.isStepSelectable(raw, info, spec, this.stepItems.get(id)?.get(ref), this.stepContext(context), selected),
						id
					),
				required: false,
				forced: true,
			} as any);
			this.selection.register(step);
			return { id, type: raw.type, items: [], range: [0, Infinity] as [number, number], instruction: raw.instruction || (raw.type === "target" ? formatTargetInstruction(info, this.event, targetOrder++, targetStepsCount) : undefined) };
		});
	}

	protected stepContext(context: any): any {
		return Object.freeze({ ...context, selectedCards: Object.freeze((context.selected?.card || []).map((ref: string) => this.cardMap.get(ref)?.card).filter(Boolean)), selectedTargets: Object.freeze((context.selected?.target || []).map((ref: string) => this.targetMap.get(ref)?.player).filter(Boolean)), resolveTargets: (refs: string[]) => refs.map(ref => this.targetMap.get(ref)?.player) });
	}

	protected consumeInitialSkillSelections(proposal: ActionProposal): void {
		const consumedTypes = new Set<string>();
		while (this.stage) {
			const stage = this.stage;
			if (stage.type !== "card" && stage.type !== "target") break;
			if (consumedTypes.has(stage.type)) break;
			const supplied = stage.type === "card" ? this.canonicalCardRefs(proposal.cardRefs || []) : proposal.targetRefs || [];
			if (!supplied.length && (stage.range[0] > 0 || (stage.type === "target" && this.activeAction?.target.mode === "dynamic"))) break;
			const outcome = this.selection.setSelection(stage.id, supplied);
			if (!outcome.ok) fail(formatSelectionFailure(outcome));
			consumedTypes.add(stage.type);
			this.currentStageIndex++;
		}
	}

	protected installSkillFilterOk(info: any, spec: HeadlessSelectionSpec | undefined, semantics: EffectiveSkillSemantics, requireHeadlessFilterOk: boolean): void {
		if (requireHeadlessFilterOk && typeof info?.filterOk === "function" && !spec?.finalPredicate) {
			fail(`skill "${this.skillName}" has UI-dependent filterOk without finalPredicate`);
		}
		this.selection.filterOk = context =>
			this.withBridge(context, undefined, undefined, () => {
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

	protected withBridge<T>(
		context: any,
		selected: string[] | undefined,
		stageType: DecisionStage["type"] | undefined,
		fn: () => T,
		stageId?: string
	): T {
		const collectRefs = (type: "card" | "target" | "button") => {
			if (stageType === type && selected !== undefined) {
				const currentIndex = stageId ? this.stages.findIndex(stage => stage.id === stageId) : -1;
				const priorStages = currentIndex >= 0 ? this.stages.slice(0, currentIndex) : this.stages;
				const otherRefs = priorStages
					.filter(stage => stage.type === type && (stageId ? stage.id !== stageId : false))
					.flatMap(stage => this.selection.context.getStepSelected(stage.id));
				return stageId ? [...otherRefs, ...selected] : [...selected];
			}
			const stageRefs = this.stages.filter(stage => stage.type === type).flatMap(stage => this.selection.context.getStepSelected(stage.id));
			return stageRefs.length ? stageRefs : (context?.selected?.[type] || []);
		};
		const cards = collectRefs("card").map((ref: string) => this.cardMap.get(ref)?.card).filter(Boolean);
		const targets = collectRefs("target").map((ref: string) => this.targetMap.get(ref)?.player).filter(Boolean);
		const buttons = collectRefs("button").map((ref: string) => this.findStepItemByRef("button", ref)).filter(Boolean);
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
				eventOverrides: this.skillName ? this.skillSemantics?.eventOverrides : undefined,
			},
			fn
		);
	}

	protected findStepItemByRef(type: DecisionStage["type"], ref: string): any {
		for (const stage of this.stages) {
			if (stage.type !== type) continue;
			const found = this.stepItems.get(stage.id)?.get(ref);
			if (found !== undefined) return found;
		}
		return undefined;
	}

	protected selectedValues(type: DecisionStage["type"]): string[] {
		return this.stages.filter(stage => stage.type === type).flatMap(stage => this.selection.context.getStepSelected(stage.id));
	}

	protected selectedItems(type: DecisionStage["type"]): any[] {
		return this.stages
			.filter(stage => stage.type === type)
			.flatMap(stage => {
				const items = this.stepItems.get(stage.id);
				return this.selection.context
					.getStepSelected(stage.id)
					.map(ref => items?.get(ref))
					.filter(value => value !== undefined);
			});
	}

	protected selectedNumbers(): number[] {
		return this.stages
			.filter(stage => stage.type === "number")
			.map((stage, index) => {
				const ref = this.selection.context.getStepSelected(stage.id)[0];
				return this.stepItems.get(stage.id)?.get(ref) ?? this.event.numbers?.[index];
			});
	}

	protected selectedDirectCard(): any {
		return this.selectedValues("card")[0] ? this.cardMap.get(this.selectedValues("card")[0])?.card : (this.selectedItems("button")[0]?.link ?? this.event._get_card ?? this.event.card);
	}

	protected resolveStepItems(raw: any, info: any, context?: any): Map<string, any> {
		const allowedRefs = raw.type === "card" ? this.currentActionCardRefs() : raw.type === "target" ? this.currentActionTargetRefs() : undefined;
		const source = (typeof raw.items === "function" ? raw.items(context) : raw.items) || allowedRefs || [];
		if (!Array.isArray(source)) actionResolution("selection items must resolve to an array");
		const map = new Map<string, any>();
		const identities = this.stepIdentities.get(raw.id) || new Map<any, { ref: string; link?: any }>();
		this.stepIdentities.set(raw.id, identities);
		for (const value of source) {
			const explicitRef = typeof value === "string" ? value : value?.ref;
			const identityRef = raw.type === "card" ? this.candidates.cards.find(card => card.card === value)?.ref : raw.type === "target" ? Array.from(this.targetMap.values()).find(target => target.player === value)?.ref : undefined;
			const previous = identities.get(value);
			if (previous && value && typeof value === "object" && "link" in value && previous.link !== value.link) fail("button link identity changed during decision");
			const canonical = raw.type === "card" ? this.cardMap.has(explicitRef) : raw.type === "target" ? this.targetMap.has(explicitRef) : false;
			const ref = identityRef || (canonical ? explicitRef : raw.type === "card" || raw.type === "target" ? undefined : previous?.ref || value?.ref || `${shortRefPrefix(raw.type)}${identities.size}`);
			if (!ref) actionResolution(`selection ${raw.id || raw.type} contains an object outside the decision snapshot`);
			if (allowedRefs && !allowedRefs.includes(ref)) continue;
			if (map.has(ref)) fail("selection contains duplicate references");
			identities.set(value, { ref, link: value && typeof value === "object" ? value.link : undefined });
			map.set(ref, raw.type === "card" ? this.cardMap.get(ref)?.card : raw.type === "target" ? this.targetMap.get(ref)?.player : value);
		}
		return map;
	}

	protected isStepSelectable(raw: any, info: any, spec: HeadlessSelectionSpec, value: any, context: any, selected: string[]): boolean {
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
						const cardInfo = activeCard ? this.runtime.getCardInfo?.(activeCard) : undefined;
						const addedFn = info?.filterAddedTarget ?? (semantics.hasViewAs ? (cardInfo?.filterAddedTarget ?? semantics.baseEvent?.filterAddedTarget) : undefined);
						const currentIndex = this.stages.findIndex(stage => stage.id === raw.id);
						const priorTargetRefs = this.stages.slice(0, currentIndex >= 0 ? currentIndex : undefined).filter(stage => stage.type === "target").flatMap(stage => this.selection.context.getStepSelected(stage.id));
						const preTarget = priorTargetRefs.length ? this.targetMap.get(priorTargetRefs[priorTargetRefs.length - 1])?.player : undefined;
						return typeof addedFn === "function" ? !!addedFn(activeCard, this.event.player, value, preTarget) : true;
					}
					return semantics.isSkillTargetFilterMatch(value, selectedCards, raw, context, selected);
				}
			}
			const directCardInfo = this.directUseCard ? this.runtime.getCardInfo?.(this.directUseCard) : undefined;
			const directLiveness = directCardInfo ? { deadTarget: !!(this.event.deadTarget || directCardInfo.deadTarget), includeOut: !!(this.event.includeOut || directCardInfo.includeOut), chessForceAll: !!(this.event.chessForceAll || directCardInfo.chessForceAll) } : undefined;
			if (raw.type === "card" && !isCardOwned(this.event, value, this.runtime)) return false;
			if (raw.type === "target" && !isTargetCurrent(this.event, value, this.runtime, directLiveness)) return false;
			if (typeof raw.filter === "function") return !!raw.filter(value, this.event.player, context, selected);
			if (raw.type === "card") return matchesSelectionFilter(info.filterCard, value, this.event.player, info, this.runtime.normalizeFilter, this.event);
			if (raw.type === "target" && raw.addedTargetFilter) {
				const addedFn = info?.filterAddedTarget ?? this.event.filterAddedTarget;
				const activeCard = this.directUseCard || this.selectedCard();
				const currentIndex = this.stages.findIndex(stage => stage.id === raw.id);
				const priorTargetRefs = this.stages
					.slice(0, currentIndex >= 0 ? currentIndex : undefined)
					.filter(stage => stage.type === "target")
					.flatMap(stage => this.selection.context.getStepSelected(stage.id));
				const preTarget = priorTargetRefs.length ? this.targetMap.get(priorTargetRefs[priorTargetRefs.length - 1])?.player : undefined;
				return typeof addedFn === "function" ? !!addedFn(activeCard, this.event.player, value, preTarget) : true;
			}
			return true;
		} catch (error) {
			if ((error as any)?.stage) throw error;
			actionResolution(`selection filter threw in ${raw.id || raw.type}: ${(error as Error)?.message || "unknown error"}`);
		}
	}

	protected selectedCard(): any {
		const ref = this.selectedValues("card")[0];
		return ref ? this.cardMap.get(ref)?.card : undefined;
	}

	protected currentViewAsCard(info: any, spec?: HeadlessSelectionSpec): any {
		return (this.skillSemantics || this.resolveSkillSemantics(info, spec)).resolveActiveCard(this.selectedCards());
	}

	protected viewAsTargetRange(info: any, spec?: HeadlessSelectionSpec): any {
		const semantics = this.skillSemantics || this.resolveSkillSemantics(info, spec);
		const card = semantics.resolveActiveCard(this.selectedCards());
		if (!card) {
			return info?.selectTarget ?? (info?.filterTarget !== undefined ? 1 : semantics.baseEvent.selectTarget !== this.runtime.defaultSelectTarget ? semantics.baseEvent.selectTarget : semantics.baseEvent.filterTarget !== undefined ? 1 : 0);
		}
		const explicit = !!(spec && Object.keys(spec).length) || evaluateSelectionSpec(info?.selectionSpec, this.event, this.event.player, this.skillName || "skill", fail).mode === "explicit";
		if (explicit) {
			assertSupportedTargetRules(this.runtime.getCardInfo(card), `skill "${this.skillName}" viewAs card`);
		}
		return resolveAuthoritativeTargetRange(semantics.baseEvent, card, this.event.player, this.runtime);
	}

	protected finalizeOrFail(): void {
		if (!this.skillFilterInstalled && typeof this.event.filterOk === "function" && !this.hasExplicitFinalPredicate) {
			if (this.eventSpec) fail("unsupported: legacy filterOk has no headless finalPredicate");
			if (!this.selection.filterOk) {
				this.selection.filterOk = context => this.withBridge(context, undefined, undefined, () => !!this.event.filterOk());
			}
		}
		const final = this.selection.finalize();
		if (!final.ok) fail(formatSelectionFailure(final));
	}

	protected canonicalCardRefs(refs: string[]): string[] {
		return this.refsForCards(resolveCandidateCards(this.cardMap, this.candidates.cards, refs, "selection", 0));
	}

	protected refsForCards(cards: any[]): string[] {
		return cards.map(card => {
			const candidate = this.candidates.cards.find(value => value.card === card);
			if (!candidate) fail("card is not in the current candidate set");
			return candidate.ref;
		});
	}

	checkpoint(): any {
		const selectionSteps = Array.from((this.selection as any).steps.entries());
		const contextSelections = Array.from(this.selection.context.selections.entries()).map(([stepId, entry]: [string, any]) => [
			stepId,
			{ type: entry.type, items: entry.items.slice() },
		]);
		const stepItems = Array.from(this.stepItems.entries()).map(([stepId, map]) => [stepId, new Map(map)]);
		const stepIdentities = Array.from(this.stepIdentities.entries()).map(([stepId, map]) => [
			stepId,
			new Map(Array.from(map.entries()).map(([key, value]) => [key, { ...value }])),
		]);
		return {
			selectionSteps,
			selectionFilterOk: this.selection.filterOk,
			contextSelections,
			stepItems,
			stepIdentities,
			stages: this.stages.slice(),
			currentStageIndex: this.currentStageIndex,
			automaticSteps: this.automaticSteps.slice(),
			skillName: this.skillName,
			directKind: this.directKind,
			backupKind: this.backupKind,
			backupInfo: this.backupInfo,
			backupSpec: this.backupSpec,
			skillInfo: this.skillInfo,
			skillSpec: this.skillSpec,
			skillSemantics: this.skillSemantics,
			skillFilterInstalled: this.skillFilterInstalled,
			hasExplicitFinalPredicate: this.hasExplicitFinalPredicate,
			activeAction: this.activeAction,
			responseCard: this.responseCard,
			directUseCard: this.directUseCard,
		};
	}

	rollback(snap: any): void {
		const rawSelection = this.selection as any;
		rawSelection.steps.clear();
		for (const [id, step] of snap.selectionSteps) rawSelection.steps.set(id, step);
		this.selection.filterOk = snap.selectionFilterOk;
		this.selection.context.selections.clear();
		for (const [stepId, entry] of snap.contextSelections) {
			this.selection.context.selections.set(stepId, { type: entry.type, items: entry.items.slice() });
		}
		this.stepItems.clear();
		for (const [stepId, map] of snap.stepItems) this.stepItems.set(stepId, new Map(map));
		this.stepIdentities.clear();
		for (const [stepId, map] of snap.stepIdentities) this.stepIdentities.set(stepId, new Map(map));
		this.stages = snap.stages.slice();
		this.currentStageIndex = snap.currentStageIndex;
		this.automaticSteps.length = 0;
		this.automaticSteps.push(...snap.automaticSteps);
		this.skillName = snap.skillName;
		this.directKind = snap.directKind;
		this.backupKind = snap.backupKind;
		this.backupInfo = snap.backupInfo;
		this.backupSpec = snap.backupSpec;
		this.skillInfo = snap.skillInfo;
		this.skillSpec = snap.skillSpec;
		this.skillSemantics = snap.skillSemantics;
		this.skillFilterInstalled = snap.skillFilterInstalled;
		this.hasExplicitFinalPredicate = snap.hasExplicitFinalPredicate;
		this.activeAction = snap.activeAction;
		this.responseCard = snap.responseCard;
		this.directUseCard = snap.directUseCard;
	}

	protected refsForTargets(targets: any[]): string[] {
		return targets.map(target => {
			const candidate = Array.from(this.targetMap.values()).find(value => value.player === target);
			if (!candidate) fail("target is not in the current candidate set");
			return candidate.ref;
		});
	}
}
