import type { CandidateCard, CandidateTarget } from "./candidates.js";

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
}

export interface ActionCandidateRuntime {
	getCandidateSkills(event: any, player: any): string[];
	getCandidateCards(event: any, player: any, skills: string[]): CandidateCard[];
	getPlayers(event: any): any[];
	getTargetId(target: any, index: number): string;
	getTargetName(target: any): string;
	getSkillInfo(skill: string): any;
	getCardInfo(card: any): any;
	autoViewAs(definition: any, cards: any[]): any;
	checkSelectTarget(card: any, player: any, range: [number, number]): void;
}

export interface PlannedSkillAction {
	spec: any;
	steps: any[];
	cardStep?: any;
	targetStep?: any;
	targetDeferred: boolean;
	viewAs: any;
}

const COMPLEX_TARGET_KEYS = ["complexSelect", "complexTarget", "filterAddedTarget", "changeTarget"] as const;

export function buildDecisionCandidateSnapshot(event: any, player: any, runtime: ActionCandidateRuntime): DecisionCandidateSnapshot {
	const skills = strictCollect(() => runtime.getCandidateSkills(event, player), "skill candidate collection");
	const cards = strictCollect(() => runtime.getCandidateCards(event, player, skills), "card candidate collection");
	const targetPool = collectTargetPool(event, runtime);
	const actions = [
		...cards.filter(card => card.cardAction).flatMap(card => buildCardAction(event, player, card, targetPool, runtime)),
		...skills.flatMap(skill => buildSkillAction(event, player, skill, cards, targetPool, runtime)),
	];
	return { cards, skills, targetPool, actions };
}

export function buildCandidateSnapshot(event: any, player: any, runtime: ActionCandidateRuntime): DecisionCandidateSnapshot {
	if (["chooseToUse", "chooseToRespond"].includes(event?.name)) return buildDecisionCandidateSnapshot(event, player, runtime);
	const skills = strictCollect(() => runtime.getCandidateSkills(event, player), "skill candidate collection");
	return { cards: strictCollect(() => runtime.getCandidateCards(event, player, skills), "card candidate collection"), skills, targetPool: collectTargetPool(event, runtime), actions: [] };
}

/** 快照与 DecisionSession 共用的技能步骤规划器。 */
export function resolveSkillActionPlan(event: any, player: any, skill: string, info: any): PlannedSkillAction | undefined {
	const spec = resolveSpec(info?.selectionSpec, event, player, skill);
	if (!spec) return undefined;
	if (typeof info?.filterOk === "function" && !spec.finalPredicate) actionResolution(`skill "${skill}" has UI-only filterOk`);
	assertSupportedTargetRules(event, `skill "${skill}" event`);
	assertSupportedTargetRules(info, `skill "${skill}"`);
	const viewAs = spec.viewAs ?? info?.viewAs;
	const steps = (spec.steps?.length ? spec.steps : deriveSteps(info)).map((step: any, index: number) => normalizeStep(step, skill, index));
	let targetDeferred = false;
	if (viewAs && event.name === "chooseToUse" && !steps.some(step => step.type === "target") && (event.filterTarget || event.selectTarget !== undefined || event.targetRequired)) {
		steps.push({ id: `skill:${skill}:target:${steps.length}`, type: "target", select: undefined, deferredFromCards: true });
		targetDeferred = true;
	}
	for (const step of steps) {
		if (step.selectionMode === "sequential") actionResolution(`skill "${skill}" has sequential same-step dependency in ${step.id}`);
	}
	const cardStep = steps.find(step => step.type === "card");
	const targetStep = steps.find(step => step.type === "target");
	if (targetStep?.deferredFromCards || (targetStep && typeof viewAs === "function")) targetDeferred = true;
	return { spec, steps, cardStep, targetStep, targetDeferred, viewAs };
}

/** 对齐 content.ts：牌规则 → event.selectTarget 覆盖 → selectTarget mod。 */
export function resolveAuthoritativeTargetRange(event: any, card: any, player: any, runtime: Pick<ActionCandidateRuntime, "getCardInfo" | "checkSelectTarget">): [number, number] {
	const info = runtime.getCardInfo(card) || {};
	if (info.notarget) return [0, 0];
	let select = typeof info.selectTarget === "function" ? info.selectTarget(card, player) : (info.selectTarget ?? 1);
	if (event.selectTarget !== undefined) select = typeof event.selectTarget === "function" ? event.selectTarget() : event.selectTarget;
	const range = normalizeRange(select);
	runtime.checkSelectTarget(card, player, range);
	return range;
}

export function actionResolution(message: string): never {
	const error: any = new Error(message);
	error.stage = "translate/action-resolution";
	throw error;
}

export function assertExecutableSnapshot(event: any, snapshot: DecisionCandidateSnapshot): void {
	if (event.forced && ["chooseToUse", "chooseToRespond"].includes(event.name) && !snapshot.actions.length) actionResolution("forced decision has no executable action");
}

function collectTargetPool(event: any, runtime: ActionCandidateRuntime): CandidateTarget[] {
	return runtime.getPlayers(event).map((target, index) => ({ player: target, ref: `p${index}`, id: runtime.getTargetId(target, index), name: runtime.getTargetName(target) }));
}

function buildCardAction(event: any, player: any, candidate: CandidateCard, pool: CandidateTarget[], runtime: ActionCandidateRuntime): CandidateAction[] {
	const info = runtime.getCardInfo(candidate.card) || {};
	const eventSpec = resolveSpec(event.selectionSpec, event, player, "event");
	const explicitSteps = eventSpec?.steps?.map((step: any, index: number) => normalizeStep(step, "event", index));
	for (const step of explicitSteps || []) if (step.selectionMode === "sequential") actionResolution(`direct card has sequential step ${step.id}`);
	assertSupportedTargetRules(event, "direct card event");
	assertSupportedTargetRules(info, `card "${candidate.card?.name || candidate.ref}"`);
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
		target = explicitSteps?.find((step: any) => step.type === "target") ? resolveExplicitTarget(event, player, candidate.card, explicitSteps.find((step: any) => step.type === "target"), pool) : resolveStaticTarget(event, player, candidate.card, pool, runtime);
	}
	return target ? [{ id: `card:${candidate.ref}`, kind: "card", tool: event.name === "chooseToRespond" ? "respond_card" : "use_card", cardRef: candidate.ref, materialCardRefs: [], target }] : [];
}

function buildSkillAction(event: any, player: any, skill: string, cards: CandidateCard[], pool: CandidateTarget[], runtime: ActionCandidateRuntime): CandidateAction[] {
	const info = runtime.getSkillInfo(skill);
	const plan = resolveSkillActionPlan(event, player, skill, info);
	if (!plan) return [];
	if (plan.viewAs && typeof plan.viewAs !== "function") assertSupportedTargetRules(runtime.getCardInfo(runtime.autoViewAs(plan.viewAs, [])), `skill "${skill}" viewAs card`);
	const materialCardRefs = cards.filter(card => card.skills?.includes(skill)).map(card => card.ref);
	const rawMaterialRange = plan.cardStep ? inspectStepRange(plan.cardStep.select ?? info?.selectCard ?? 1) : undefined;
	const materialAutomatic = !!rawMaterialRange && rawMaterialRange[1] < 0;
	const materialRange = materialAutomatic ? [materialCardRefs.length, materialCardRefs.length] as [number, number] : rawMaterialRange ? [rawMaterialRange[0], Math.min(rawMaterialRange[1], materialCardRefs.length)] as [number, number] : undefined;
	if (materialRange && materialRange[0] > materialCardRefs.length) return [];
	let target: ActionTargetMeta | undefined;
	if (plan.targetDeferred) target = { mode: "dynamic", targetRefs: [], deferredStepId: plan.targetStep?.id };
	else target = resolveSkillTarget(event, player, plan, info, pool, runtime);
	if (!target) return [];
	return [{ id: `skill:${skill}`, kind: "skill", tool: "use_skill", skillName: skill, materialCardRefs, materialRange, materialAutomatic, target }];
}

function resolveSkillTarget(event: any, player: any, plan: PlannedSkillAction, info: any, pool: CandidateTarget[], runtime: ActionCandidateRuntime): ActionTargetMeta | undefined {
	if (!plan.targetStep) return { mode: "none", targetRefs: [] };
	const range = inspectStepRange(plan.targetStep.select ?? info.selectTarget ?? 1);
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
	const range = inspectStepRange(step.select ?? event.selectTarget ?? 1);
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
		if (typeof step?.filter === "function") return step.filter(target, player, Object.freeze({ selected: Object.freeze({ card: [], target: [] }) }), []) === true;
		if (typeof info?.filterTarget === "function") return info.filterTarget(card, player, target) === true;
		return typeof event.filterTarget !== "function" || event.filterTarget(card, player, target) === true;
	} catch (error) {
		actionResolution(`target filter threw: ${(error as Error)?.message || "unknown error"}`);
	}
}

function resolveSpec(value: any, event: any, player: any, skill: string): any {
	try {
		const spec = typeof value === "function" ? value(event, player) : value;
		return spec === true ? {} : spec && typeof spec === "object" ? spec : undefined;
	} catch (error) {
		actionResolution(`skill "${skill}" selectionSpec threw: ${(error as Error)?.message || "unknown error"}`);
	}
}

function deriveSteps(info: any): any[] {
	const steps: any[] = [];
	if (info?.selectCard !== undefined || info?.filterCard || info?.viewAs) steps.push({ type: "card" });
	if (info?.selectTarget !== undefined || info?.filterTarget) steps.push({ type: "target" });
	return steps;
}

function normalizeStep(step: any, skill: string, index: number): any {
	if (!step || !["button", "card", "target", "control", "number"].includes(step.type)) actionResolution(`skill "${skill}" has an unreadable selection step`);
	return { ...step, id: step.id || `skill:${skill}:${step.type}:${index}` };
}

export function assertSupportedTargetRules(source: any, label: string): void {
	const complex = COMPLEX_TARGET_KEYS.filter(key => typeof source?.[key] === "function" || source?.[key] === true);
	if (complex.length) actionResolution(`${label} uses unsupported legacy target flags: ${complex.join(", ")}`);
}

function inspectStepRange(select: any): [number, number] {
	try {
		return normalizeRange(typeof select === "function" ? select(Object.freeze({ selected: Object.freeze({ card: [], target: [] }) }), [], undefined) : select);
	} catch (error) {
		actionResolution(`selection range cannot be resolved: ${(error as Error)?.message || "unknown error"}`);
	}
}

function normalizeRange(select: any): [number, number] {
	if (typeof select === "number") return [select, select];
	if (Array.isArray(select) && typeof select[0] === "number" && typeof select[1] === "number") return [select[0], select[1]];
	actionResolution("selection range must be numeric");
}

function strictCollect<T>(collect: () => T, label: string): T {
	try {
		return collect();
	} catch (error) {
		if ((error as any)?.stage) throw error;
		actionResolution(`${label} threw: ${(error as Error)?.message || "unknown error"}`);
	}
}
