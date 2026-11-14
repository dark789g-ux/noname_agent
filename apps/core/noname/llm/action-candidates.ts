import type { CandidateCard, CandidateTarget } from "./candidates.js";
import { withVirtualSelection, type LegacyBridgeHost } from "./legacy-bridge.js";
import {
	assertSupportedTargetRules as assertGenericSupportedTargetRules,
	evalFilterTargetValue,
	evaluateSelectionSpec,
	hasComplexTargetFlags,
	isSingleCardAddedTarget,
	normalizeSelectionStep,
	resolveUnifiedSkillPlan,
	splitAddedTargetPrimaryRange,
} from "./generic-skill-plan.js";

export type TargetMode = "none" | "automatic" | "select" | "dynamic";

export interface ActionTargetMeta {
	mode: TargetMode;
	range?: [number, number];
	targetRefs: string[];
	deferredStepId?: string;
}

export interface CandidateAction {
	id: string;
	kind: "card" | "skill";
	tool: "use_card" | "respond_card" | "use_skill";
	cardRef?: string;
	skillName?: string;
	materialCardRefs: string[];
	materialRange?: [number, number];
	materialAutomatic?: boolean;
	target: ActionTargetMeta;
}

export interface DecisionCandidateSnapshot {
	cards: CandidateCard[];
	skills: string[];
	targetPool: CandidateTarget[];
	actions: CandidateAction[];
	skippedActions?: Array<{ id: string; reason: string }>;
}

export interface ActionCandidateRuntime {
	getCandidateSkills(event: any, player: any): string[];
	getCandidateCards(event: any, player: any, skills: string[]): CandidateCard[];
	getPlayers(event: any): any[];
	getTargetId(target: any, index: number): string;
	getTargetName(target: any): string;
	getSkillInfo(skill: string): any;
	getCardInfo(card: any): any;
	/** chooseToUse 的引擎默认函数；内部已执行 selectTarget mod。 */
	defaultSelectTarget?: (card: any, player: any) => any;
	autoViewAs(definition: any, cards: any[]): any;
	checkSelectTarget(card: any, player: any, range: [number, number]): void;
	legacyBridgeHost?: LegacyBridgeHost;
}

export interface PlannedSkillAction {
	spec: any;
	generic?: boolean;
	steps: any[];
	cardStep?: any;
	targetStep?: any;
	targetDeferred: boolean;
	viewAs: any;
}

export function buildDecisionCandidateSnapshot(event: any, player: any, runtime: ActionCandidateRuntime): DecisionCandidateSnapshot {
	const skills = strictCollect(() => runtime.getCandidateSkills(event, player), "skill candidate collection");
	const cards = strictCollect(() => runtime.getCandidateCards(event, player, skills), "card candidate collection");
	const targetPool = collectTargetPool(event, runtime);
	const skippedActions: Array<{ id: string; reason: string }> = [];
	const eventEvaluated = evaluateSelectionSpec(event.selectionSpec, event, player, "event", actionResolution);
	const cardActions: CandidateAction[] = [];
	if (eventEvaluated.mode !== "disabled") {
		for (const card of cards.filter(item => item.cardAction)) {
			const runCard = () =>
				withVirtualSelection(runtime.legacyBridgeHost, { event, player, cards: [], targets: [], buttons: [] }, () =>
					buildCardAction(event, player, card, targetPool, runtime, eventEvaluated)
				);
			if (eventEvaluated.mode === "explicit") {
				cardActions.push(...runCard());
			} else {
				try {
					cardActions.push(...runCard());
				} catch (error) {
					skippedActions.push({ id: `card:${card.ref}`, reason: (error as Error)?.message || "unknown error" });
				}
			}
		}
	}
	const skillActions: CandidateAction[] = [];
	for (const skill of skills) {
		const info = runtime.getSkillInfo(skill);
		const evaluated = info ? evaluateSelectionSpec(info.selectionSpec, event, player, skill, actionResolution) : { mode: "disabled" as const };
		if (evaluated.mode === "disabled") continue;
		const runSkill = () =>
			withVirtualSelection(
				runtime.legacyBridgeHost,
				{ event, player, skill, cards: [], targets: [], buttons: [], synthesizeBackup: true },
				() => buildSkillAction(event, player, skill, cards, targetPool, runtime)
			);
		if (evaluated.mode === "explicit") {
			skillActions.push(...runSkill());
		} else {
			try {
				skillActions.push(...runSkill());
			} catch (error) {
				skippedActions.push({ id: `skill:${skill}`, reason: (error as Error)?.message || "unknown error" });
			}
		}
	}
	const actions = [...cardActions, ...skillActions];
	return skippedActions.length ? { cards, skills, targetPool, actions, skippedActions } : { cards, skills, targetPool, actions };
}

export function buildCandidateSnapshot(event: any, player: any, runtime: ActionCandidateRuntime): DecisionCandidateSnapshot {
	if (event.skill && ["chooseToUse", "chooseToRespond"].includes(event?.name)) {
		const cards = strictCollect(() => runtime.getCandidateCards(event, player, []), "backup material collection");
		return { cards: cards.map(card => ({ ...card, cardAction: false, skills: [event.skill] })), skills: [], targetPool: collectTargetPool(event, runtime), actions: [] };
	}
	if (["chooseToUse", "chooseToRespond"].includes(event?.name)) return buildDecisionCandidateSnapshot(event, player, runtime);
	const skills: string[] = [];
	return { cards: strictCollect(() => runtime.getCandidateCards(event, player, skills), "card candidate collection"), skills, targetPool: collectTargetPool(event, runtime), actions: [] };
}

/** 快照与 DecisionSession 共用的技能步骤规划器。 */
export function resolveSkillActionPlan(event: any, player: any, skill: string, info: any): PlannedSkillAction | undefined {
	return resolveUnifiedSkillPlan(event, player, skill, info, actionResolution);
}

/** 对齐 content.ts：牌规则 → event.selectTarget 覆盖 → selectTarget mod。 */
export function resolveAuthoritativeTargetRange(event: any, card: any, player: any, runtime: Pick<ActionCandidateRuntime, "getCardInfo" | "checkSelectTarget" | "defaultSelectTarget">): [number, number] {
	const info = runtime.getCardInfo(card) || {};
	if (info.notarget) return [0, 0];
	const source = `decision=${event.name} card=${card?.name ?? "unknown"}`;
	// 默认函数需要显式卡牌/玩家，不能读取尚未选择的 ui.selected.cards。
	if (runtime.defaultSelectTarget && event.selectTarget === runtime.defaultSelectTarget) {
		return inspectStepRange(() => runtime.defaultSelectTarget!(card, player), `${source} source=lib.filter.selectTarget`);
	}
	let range: [number, number];
	if (event.selectTarget !== undefined) {
		range = inspectStepRange(() => (typeof event.selectTarget === "function" ? event.selectTarget() : event.selectTarget), `${source} source=event.selectTarget raw=${describeRange(event.selectTarget)}`);
	} else {
		range = inspectStepRange(() => (typeof info.selectTarget === "function" ? info.selectTarget(card, player) : (info.selectTarget ?? (info.filterTarget ? 1 : 0))), `${source} source=card.selectTarget raw=${describeRange(info.selectTarget)}`);
	}
	runtime.checkSelectTarget(card, player, range);
	return normalizeRange(range, `${source} source=selectTarget mod`);
}

export function actionResolution(message: string): never {
	const error: any = new Error(message);
	error.stage = "translate/action-resolution";
	throw error;
}

export function assertExecutableSnapshot(event: any, snapshot: DecisionCandidateSnapshot): void {
	if (event.forced && !event.skill && ["chooseToUse", "chooseToRespond"].includes(event.name) && !snapshot.actions.length) actionResolution("forced decision has no executable action");
}

function collectTargetPool(event: any, runtime: ActionCandidateRuntime): CandidateTarget[] {
	return runtime.getPlayers(event).map((target, index) => ({ player: target, ref: `p${index}`, id: runtime.getTargetId(target, index), name: runtime.getTargetName(target) }));
}

function buildCardAction(
	event: any,
	player: any,
	candidate: CandidateCard,
	pool: CandidateTarget[],
	runtime: ActionCandidateRuntime,
	eventEvaluated = evaluateSelectionSpec(event.selectionSpec, event, player, "event", actionResolution)
): CandidateAction[] {
	if (eventEvaluated.mode === "disabled") return [];
	const info = runtime.getCardInfo(candidate.card) || {};
	const eventSpec = eventEvaluated.mode === "explicit" ? eventEvaluated.spec : undefined;
	const explicitSteps = eventSpec?.steps?.map((step: any, index: number) => normalizeSelectionStep(step, "event", index, actionResolution));
	if (eventSpec) {
		for (const step of explicitSteps || []) if (step.selectionMode === "sequential") actionResolution(`direct card has sequential step ${step.id}`);
		assertSupportedTargetRules(event, "direct card event");
		assertSupportedTargetRules(info, `card "${candidate.card?.name || candidate.ref}"`);
	}
	let target: ActionTargetMeta | undefined;
	if (event.name === "chooseToRespond") {
		const targetSteps = explicitSteps?.filter((step: any) => step.type === "target") || [];
		if (!targetSteps.length) target = { mode: "none", targetRefs: [] };
		else {
			const available = resolveExplicitTarget(event, player, candidate.card, targetSteps[0], pool);
			if (!available) return [];
			target = { mode: "dynamic", targetRefs: [], deferredStepId: targetSteps[0].id };
		}
	} else {
		if (explicitSteps && explicitSteps.filter((step: any) => step.type === "target").length > 1) actionResolution("direct card has multiple target steps that require headless rounds");
		const explicitTargetStep = explicitSteps?.find((step: any) => step.type === "target");
		if (explicitTargetStep) {
			target = resolveExplicitTarget(event, player, candidate.card, explicitTargetStep, pool);
		} else {
			const addedSource = isSingleCardAddedTarget(info) ? info : isSingleCardAddedTarget(event) ? event : undefined;
			if (addedSource) {
				const range = resolveAuthoritativeTargetRange(event, candidate.card, player, runtime);
				const primaryRange = splitAddedTargetPrimaryRange(range, !!(runtime.defaultSelectTarget && event.selectTarget === runtime.defaultSelectTarget));
				const primaryCandidates = pool.filter(item => strictTargetFilter(undefined, undefined, event, candidate.card, player, item.player));
				const validPrimary = primaryCandidates.filter(primary =>
					withVirtualSelection(runtime.legacyBridgeHost, { event, player, cards: [candidate.card], targets: [primary.player] }, () =>
						pool.some(added => !!addedSource.filterAddedTarget(candidate.card, player, added.player, primary.player))
					)
				);
				if (validPrimary.length < primaryRange[0]) return [];
				target = { mode: "dynamic", targetRefs: [], deferredStepId: `card:${candidate.ref}:target:0` };
			} else if (hasComplexTargetFlags(info) || hasComplexTargetFlags(event)) {
				const range = resolveAuthoritativeTargetRange(event, candidate.card, player, runtime);
				if (range[1] === 0) {
					target = { mode: "none", range, targetRefs: [] };
				} else {
					const refs = pool.filter(item => strictTargetFilter(undefined, undefined, event, candidate.card, player, item.player)).map(item => item.ref);
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

function buildSkillAction(event: any, player: any, skill: string, cards: CandidateCard[], pool: CandidateTarget[], runtime: ActionCandidateRuntime): CandidateAction[] {
	const info = runtime.getSkillInfo(skill);
	const plan = resolveSkillActionPlan(event, player, skill, info);
	if (!plan) return [];
	if (plan.viewAs && typeof plan.viewAs !== "function") {
		const viewAsInfo = runtime.getCardInfo(runtime.autoViewAs(plan.viewAs, []));
		if (!plan.generic) assertSupportedTargetRules(viewAsInfo, `skill "${skill}" viewAs card`);
		else if (!plan.targetDeferred && hasComplexTargetFlags(viewAsInfo)) plan.targetDeferred = true;
	}
	const materialCardRefs = cards.filter(card => card.skills?.includes(skill)).map(card => card.ref);
	const rawMaterialRange = plan.cardStep ? inspectStepRange(plan.cardStep.select ?? info?.selectCard ?? 1, `decision=${event.name} skill=${skill} source=${plan.cardStep.id}.selectCard`) : undefined;
	const materialAutomatic = !!rawMaterialRange && rawMaterialRange[1] < 0;
	const materialRange = materialAutomatic ? ([materialCardRefs.length, materialCardRefs.length] as [number, number]) : rawMaterialRange ? ([rawMaterialRange[0], Math.min(rawMaterialRange[1], materialCardRefs.length)] as [number, number]) : undefined;
	if (materialRange && materialRange[0] > materialCardRefs.length) return [];
	let target: ActionTargetMeta | undefined;
	if (plan.targetDeferred) target = { mode: "dynamic", targetRefs: [], deferredStepId: plan.targetStep?.id };
	else target = resolveSkillTarget(event, player, skill, plan, info, pool, runtime);
	if (!target) return [];
	return [{ id: `skill:${skill}`, kind: "skill", tool: "use_skill", skillName: skill, materialCardRefs, materialRange, materialAutomatic, target }];
}

function resolveSkillTarget(event: any, player: any, skill: string, plan: PlannedSkillAction, info: any, pool: CandidateTarget[], runtime: ActionCandidateRuntime): ActionTargetMeta | undefined {
	if (!plan.targetStep) return { mode: "none", targetRefs: [] };
	const range = inspectStepRange(plan.targetStep.select ?? info.selectTarget ?? 1, `decision=${event.name} skill=${skill} source=${plan.targetStep.id}.selectTarget`);
	const scopedPool = Array.isArray(plan.targetStep.items) ? pool.filter(candidate => plan.targetStep.items.some((item: any) => item === candidate.player || item?.player === candidate.player || item === candidate.ref || item?.ref === candidate.ref)) : pool;
	const refs = scopedPool.filter(candidate => strictTargetFilter(plan.targetStep, info, event, undefined, player, candidate.player)).map(candidate => candidate.ref);
	return targetFromRange(range, refs);
}

function resolveStaticTarget(event: any, player: any, card: any, pool: CandidateTarget[], runtime: ActionCandidateRuntime): ActionTargetMeta | undefined {
	const dying = event.dying || event._trigger?.dying;
	if (card?.name === "tao" && dying) {
		const target = pool.find(candidate => candidate.player === dying);
		if (target) return { mode: "automatic", range: [1, 1], targetRefs: [target.ref] };
	}
	const range = resolveAuthoritativeTargetRange(event, card, player, runtime);
	if (range[1] === 0) return { mode: "none", range, targetRefs: [] };
	const refs = pool.filter(candidate => strictTargetFilter(undefined, undefined, event, card, player, candidate.player)).map(candidate => candidate.ref);
	return targetFromRange(range, refs);
}

function resolveExplicitTarget(event: any, player: any, card: any, step: any, pool: CandidateTarget[]): ActionTargetMeta | undefined {
	const range = inspectStepRange(step.select ?? event.selectTarget ?? 1, `decision=${event.name} card=${card?.name ?? "unknown"} source=${step.id}.selectTarget`);
	const scopedPool = Array.isArray(step.items) ? pool.filter(candidate => step.items.some((item: any) => item === candidate.player || item?.player === candidate.player || item === candidate.ref || item?.ref === candidate.ref)) : pool;
	const refs = scopedPool.filter(candidate => strictTargetFilter(step, undefined, event, card, player, candidate.player)).map(candidate => candidate.ref);
	return targetFromRange(range, refs);
}

function targetFromRange(range: [number, number], refs: string[]): ActionTargetMeta | undefined {
	if (range[1] < 0) return refs.length ? { mode: "automatic", range: [refs.length, refs.length], targetRefs: refs } : undefined;
	if (range[0] > refs.length) return undefined;
	return { mode: "select", range: [range[0], Math.min(range[1], refs.length)], targetRefs: refs };
}

function strictTargetFilter(step: any, info: any, event: any, card: any, player: any, target: any): boolean {
	try {
		if (typeof step?.filter === "function") return !!step.filter(target, player, Object.freeze({ selected: Object.freeze({ card: [], target: [] }) }), []);
		if (info?.filterTarget !== undefined) return evalFilterTargetValue(info.filterTarget, card, player, target);
		return typeof event.filterTarget !== "function" || !!event.filterTarget(card, player, target);
	} catch (error) {
		actionResolution(`target filter threw: ${(error as Error)?.message || "unknown error"}`);
	}
}

export function assertSupportedTargetRules(source: any, label: string): void {
	assertGenericSupportedTargetRules(source, label, actionResolution);
}

function inspectStepRange(select: any, source: string): [number, number] {
	try {
		return normalizeRange(typeof select === "function" ? select(Object.freeze({ selected: Object.freeze({ card: [], target: [] }) }), [], undefined) : select, `${source} raw=${describeRange(select)}`);
	} catch (error) {
		actionResolution(`selection range cannot be resolved (${source}): ${(error as Error)?.message || "unknown error"}`);
	}
}

function normalizeRange(select: any, source: string): [number, number] {
	if (typeof select === "number" && !Number.isNaN(select)) return [select, select];
	if (Array.isArray(select) && select.length === 2 && select.every(value => typeof value === "number" && !Number.isNaN(value))) return [select[0], select[1]];
	actionResolution(`selection range must be numeric (${source} result=${describeRange(select)})`);
}

function describeRange(value: any, depth = 0): string {
	if (Array.isArray(value))
		return depth
			? "array"
			: `[${value
					.slice(0, 4)
					.map(item => describeRange(item, depth + 1))
					.join(",")}]`;
	if (value === null) return "null";
	if (["number", "boolean", "undefined"].includes(typeof value)) return `${typeof value}:${String(value)}`;
	return typeof value === "string" ? `string:${JSON.stringify(value.slice(0, 100))}` : typeof value;
}

function strictCollect<T>(collect: () => T, label: string): T {
	try {
		return collect();
	} catch (error) {
		if ((error as any)?.stage) throw error;
		actionResolution(`${label} threw: ${(error as Error)?.message || "unknown error"}`);
	}
}
