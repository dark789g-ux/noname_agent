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
import { normalizeViewAsDefinition, resolveBaseEvent, resolveEffectiveSkillSemantics } from "./skill-backup-semantics.js";

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
	alivePlayers?(): any[];
	deadPlayers?(): any[];
	normalizeFilter?(filter: any): Function;
	checkCardEnabled2?(card: any, player: any): boolean | "unchanged";
	isCardDiscardable?(card: any, player: any): boolean;
	isCardRespondable?(card: any, player: any): boolean;
	isTargetChessReachable?(event: any, player: any, target: any, forceAll: boolean): boolean;
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
	const targetPool = collectTargetPool(event, player, runtime, skills, cards);
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
		const spec = evaluated.mode === "explicit" ? evaluated.spec : undefined;
		const semantics = resolveEffectiveSkillSemantics({ event, player, skill, info, spec, runtime });
		const runSkill = () =>
			withVirtualSelection(
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
		return { cards: cards.map(card => ({ ...card, cardAction: false, skills: [event.skill] })), skills: [], targetPool: collectTargetPool(event, player, runtime, [event.skill], cards), actions: [] };
	}
	if (["chooseToUse", "chooseToRespond"].includes(event?.name)) return buildDecisionCandidateSnapshot(event, player, runtime);
	const skills: string[] = [];
	const cards = strictCollect(() => runtime.getCandidateCards(event, player, skills), "card candidate collection");
	return { cards, skills, targetPool: collectTargetPool(event, player, runtime, skills, cards), actions: [] };
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

function isActionTargetCurrent(event: any, target: any, runtime: ActionCandidateRuntime, options?: { deadTarget?: boolean; includeOut?: boolean; chessForceAll?: boolean }): boolean {
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

function collectTargetPool(event: any, player: any, runtime: ActionCandidateRuntime, skills: string[], cards: CandidateCard[]): CandidateTarget[] {
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
			const evaluated = evaluateSelectionSpec(info.selectionSpec, event, player, skill, () => undefined as never);
			const viewAs = (evaluated.mode === "explicit" ? evaluated.spec?.viewAs : undefined) ?? info.viewAs;
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
			target = resolveExplicitTarget(event, player, candidate.card, explicitTargetStep, pool, runtime, info);
		} else {
			const directLiveness = { deadTarget: !!(event.deadTarget || info.deadTarget), includeOut: !!(event.includeOut || info.includeOut), chessForceAll: !!(event.chessForceAll || info.chessForceAll) };
			const addedSource = isSingleCardAddedTarget(info) ? info : isSingleCardAddedTarget(event) ? event : undefined;
			if (addedSource) {
				const range = resolveAuthoritativeTargetRange(event, candidate.card, player, runtime);
				const primaryRange = splitAddedTargetPrimaryRange(range, !!(runtime.defaultSelectTarget && event.selectTarget === runtime.defaultSelectTarget));
				const primaryCandidates = pool.filter(item => isActionTargetCurrent(event, item.player, runtime, directLiveness) && strictTargetFilter(undefined, undefined, event, candidate.card, player, item.player));
				const validPrimary = primaryCandidates.filter(primary =>
					withVirtualSelection(runtime.legacyBridgeHost, { event, player, cards: [candidate.card], targets: [primary.player] }, () =>
						pool.some(added => isActionTargetCurrent(event, added.player, runtime, directLiveness) && !!addedSource.filterAddedTarget(candidate.card, player, added.player, primary.player))
					)
				);
				if (validPrimary.length < primaryRange[0]) return [];
				target = { mode: "dynamic", targetRefs: [], deferredStepId: `card:${candidate.ref}:target:0` };
			} else if (hasComplexTargetFlags(info) || hasComplexTargetFlags(event)) {
				const range = resolveAuthoritativeTargetRange(event, candidate.card, player, runtime);
				if (range[1] === 0) {
					target = { mode: "none", range, targetRefs: [] };
				} else {
					const refs = pool.filter(item => isActionTargetCurrent(event, item.player, runtime, directLiveness) && strictTargetFilter(undefined, undefined, event, candidate.card, player, item.player)).map(item => item.ref);
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

function buildSkillAction(
	event: any,
	player: any,
	skill: string,
	info: any,
	semantics: ReturnType<typeof resolveEffectiveSkillSemantics>,
	cards: CandidateCard[],
	pool: CandidateTarget[],
	runtime: ActionCandidateRuntime
): CandidateAction[] {
	const plan = resolveSkillActionPlan(event, player, skill, info);
	if (!plan) return [];
	if (plan.viewAs && typeof plan.viewAs !== "function") {
		const viewAsInfo = runtime.getCardInfo(semantics.resolveActiveCard([]));
		if (!plan.generic) assertSupportedTargetRules(viewAsInfo, `skill "${skill}" viewAs card`);
		else if (!plan.targetDeferred && hasComplexTargetFlags(viewAsInfo)) plan.targetDeferred = true;
	}
	const materialCardRefs = cards.filter(card => card.skills?.includes(skill)).map(card => card.ref);
	const rawMaterialRange = plan.cardStep ? inspectStepRange(plan.cardStep.select ?? semantics.effectiveSelectCard ?? 1, `decision=${event.name} skill=${skill} source=${plan.cardStep.id}.selectCard`) : undefined;
	const materialAutomatic = !!rawMaterialRange && rawMaterialRange[1] < 0;
	const materialRange = materialAutomatic ? ([materialCardRefs.length, materialCardRefs.length] as [number, number]) : rawMaterialRange ? ([rawMaterialRange[0], Math.min(rawMaterialRange[1], materialCardRefs.length)] as [number, number]) : undefined;
	if (materialRange && materialRange[0] > materialCardRefs.length) return [];
	let target: ActionTargetMeta | undefined;
	if (plan.targetDeferred) target = { mode: "dynamic", targetRefs: [], deferredStepId: plan.targetStep?.id };
	else target = resolveSkillTarget(event, player, skill, plan, info, semantics, pool, runtime);
	if (!target) return [];
	return [{ id: `skill:${skill}`, kind: "skill", tool: "use_skill", skillName: skill, materialCardRefs, materialRange, materialAutomatic, target }];
}

function resolveSkillTarget(
	event: any,
	player: any,
	skill: string,
	plan: PlannedSkillAction,
	info: any,
	semantics: ReturnType<typeof resolveEffectiveSkillSemantics>,
	pool: CandidateTarget[],
	runtime: ActionCandidateRuntime
): ActionTargetMeta | undefined {
	if (!plan.targetStep) return { mode: "none", targetRefs: [] };
	const activeCard = semantics.hasViewAs ? semantics.resolveActiveCard([]) : undefined;
	let range: [number, number];
	if (plan.targetStep.select !== undefined) {
		range = inspectStepRange(plan.targetStep.select, `decision=${event.name} skill=${skill} source=${plan.targetStep.id}.selectTarget`);
	} else if (info?.selectTarget !== undefined) {
		range = inspectStepRange(info.selectTarget, `decision=${event.name} skill=${skill} source=${plan.targetStep.id}.selectTarget`);
	} else if (activeCard) {
		range = resolveAuthoritativeTargetRange(semantics.baseEvent, activeCard, player, runtime);
	} else {
		range = inspectStepRange(info?.filterTarget ? 1 : 0, `decision=${event.name} skill=${skill} source=${plan.targetStep.id}.selectTarget`);
	}
	if (range[1] === 0) return { mode: "none", range, targetRefs: [] };
	const liveness = semantics.resolveTargetLiveness([]);
	const scopedPool = Array.isArray(plan.targetStep.items) ? pool.filter(candidate => plan.targetStep.items.some((item: any) => item === candidate.player || item?.player === candidate.player || item === candidate.ref || item?.ref === candidate.ref)) : pool;
	const refs = scopedPool
		.filter(candidate => {
			if (!isActionTargetCurrent(semantics.baseEvent, candidate.player, runtime, liveness)) return false;
			try {
				return semantics.isSkillTargetFilterMatch(candidate.player, [], plan.targetStep);
			} catch (error) {
				if ((error as any)?.stage) throw error;
				actionResolution(`target filter threw: ${(error as Error)?.message || "unknown error"}`);
			}
		})
		.map(candidate => candidate.ref);
	return targetFromRange(range, refs);
}

function resolveStaticTarget(event: any, player: any, card: any, pool: CandidateTarget[], runtime: ActionCandidateRuntime): ActionTargetMeta | undefined {
	const cardInfo = runtime.getCardInfo(card) || {};
	const directLiveness = { deadTarget: !!(event.deadTarget || cardInfo.deadTarget), includeOut: !!(event.includeOut || cardInfo.includeOut), chessForceAll: !!(event.chessForceAll || cardInfo.chessForceAll) };
	const dying = event.dying || event._trigger?.dying;
	if (card?.name === "tao" && dying) {
		const target = pool.find(candidate => candidate.player === dying && isActionTargetCurrent(event, candidate.player, runtime, directLiveness));
		if (target) return { mode: "automatic", range: [1, 1], targetRefs: [target.ref] };
	}
	const range = resolveAuthoritativeTargetRange(event, card, player, runtime);
	if (range[1] === 0) return { mode: "none", range, targetRefs: [] };
	const refs = pool.filter(candidate => isActionTargetCurrent(event, candidate.player, runtime, directLiveness) && strictTargetFilter(undefined, undefined, event, card, player, candidate.player)).map(candidate => candidate.ref);
	return targetFromRange(range, refs);
}

function resolveExplicitTarget(event: any, player: any, card: any, step: any, pool: CandidateTarget[], runtime?: ActionCandidateRuntime, cardInfo?: any): ActionTargetMeta | undefined {
	const range = inspectStepRange(step.select ?? event.selectTarget ?? 1, `decision=${event.name} card=${card?.name ?? "unknown"} source=${step.id}.selectTarget`);
	const directLiveness = { deadTarget: !!(event.deadTarget || cardInfo?.deadTarget), includeOut: !!(event.includeOut || cardInfo?.includeOut), chessForceAll: !!(event.chessForceAll || cardInfo?.chessForceAll) };
	const scopedPool = Array.isArray(step.items) ? pool.filter(candidate => step.items.some((item: any) => item === candidate.player || item?.player === candidate.player || item === candidate.ref || item?.ref === candidate.ref)) : pool;
	const refs = scopedPool.filter(candidate => (!runtime || isActionTargetCurrent(event, candidate.player, runtime, directLiveness)) && strictTargetFilter(step, undefined, event, card, player, candidate.player)).map(candidate => candidate.ref);
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
