import { matchesSelectionFilter } from "./selection-filter.js";
import type { HeadlessSelectionSpec } from "./selection-adapter.js";

export interface SkillSemanticRuntime {
	getCardInfo?: (card: any) => any;
	autoViewAs?: (definition: any, cards: any[]) => any;
	normalizeFilter?: (filter: any) => Function;
	checkCardEnabled2?: (card: any, player: any) => boolean | "unchanged";
	isCardDiscardable?: (card: any, player: any) => boolean;
	isCardRespondable?: (card: any, player: any) => boolean;
}

export interface TargetLivenessFlags {
	deadTarget: boolean;
	includeOut: boolean;
	chessForceAll: boolean;
}

export interface EffectiveSkillSemantics {
	baseEvent: any;
	hasViewAs: boolean;
	viewAsSource: any;
	position: string;
	hasExplicitStepCardFilter: boolean;
	hasExplicitStepTargetFilter: boolean;
	hasCardFilterRule: boolean;
	effectiveFilterCard: any;
	filterCardReceiver: any;
	effectiveSelectCard: any;
	complexCard: boolean;
	complexTarget: boolean;
	complexSelect: boolean;
	effectiveFilterTarget: any;
	effectiveSelectTarget: any;
	resolveActiveCard: (selectedCards?: any[]) => any;
	resolveTargetLiveness: (selectedCards?: any[]) => TargetLivenessFlags;
	isMaterialCardGuardEligible: (card: any) => boolean;
	isMaterialCardEligible: (card: any, evalEvent?: any) => boolean;
	isSkillTargetFilterMatch: (target: any, selectedCards?: any[], step?: any, context?: any, selected?: string[]) => boolean;
	resolveFinalOk: (selectedCards: any[], activeCard: any, context?: any, evalEvent?: any) => boolean;
	eventOverrides: Record<string, any>;
}

/** 还原 GameEvent.backup 前的外层事件基线快照，避免虚拟桥接覆写 event 字段时污染基线回调。 */
export function resolveBaseEvent(event: any): any {
	if (!event || typeof event !== "object") return event;
	if (event.skill && event._backup && typeof event._backup === "object") {
		return { ...event, ...event._backup };
	}
	return { ...event };
}

/** 将静态或字符串简写 viewAs 定义规整为可用于 `autoViewAs` / `get.info` 的卡牌定义。 */
export function normalizeViewAsDefinition(definition: any): any {
	return typeof definition === "string" ? { name: definition } : definition;
}

/** 汇总候选集（事件基线、候选牌、候选/当前技能及静态 viewAs）所需的最大目标存活放宽标记，供池校验使用。 */
export function resolvePoolTargetFlags(params: {
	event: any;
	cards: Iterable<{ card: any }>;
	skills: string[];
	activeSkill?: string;
	activeSpec?: HeadlessSelectionSpec;
	activeSemantics?: EffectiveSkillSemantics;
	selectedCards?: any[];
	runtime: SkillSemanticRuntime & { getSkillInfo?: (skill: string) => any };
}): { deadTarget: boolean; includeOut: boolean; chessForceAll: boolean } {
	const { event, cards, skills, activeSkill, activeSpec, activeSemantics, selectedCards = [], runtime } = params;
	const baseEvent = resolveBaseEvent(event);
	let deadTarget = !!baseEvent?.deadTarget;
	let includeOut = !!baseEvent?.includeOut;
	const inspectCard = (card: any) => {
		const cardInfo = card ? runtime.getCardInfo?.(card) : undefined;
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
		const viewAs = (skill === activeSkill ? activeSpec?.viewAs : undefined) ?? info.viewAs;
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

function evalTargetFilter(filterTarget: any, card: any, player: any, target: any, normalize?: (filter: any) => Function): boolean {
	if (filterTarget === true || filterTarget == null) return true;
	if (filterTarget === false) return false;
	if (typeof filterTarget === "function") return !!filterTarget(card, player, target);
	if (typeof filterTarget === "object" && !Array.isArray(filterTarget) && normalize) {
		return !!normalize(filterTarget)(card, player, target);
	}
	return false;
}

function normalizeEventFilter(filter: any, normalize?: (value: any) => Function): any {
	if (typeof filter === "boolean") return () => filter;
	if (typeof filter === "object" && filter !== null && !Array.isArray(filter) && normalize) return normalize(filter);
	return filter;
}

/**
 * 按原生 `GameEvent.backup` 语义计算技能（及 backup 子事件）在四阶段决策中的有效规则投影：
 * - 存在 `viewAs`：对外层 `baseEvent` 做增量覆写；
 * - 无 `viewAs`：对材料/目标/复杂标记/`filterOk` 做全量替换，不继承外层事件规则。
 */
export function resolveEffectiveSkillSemantics(params: {
	event: any;
	player: any;
	skill?: string;
	info: any;
	spec?: HeadlessSelectionSpec;
	runtime?: SkillSemanticRuntime;
}): EffectiveSkillSemantics {
	const { event, player, info, spec, runtime = {} } = params;
	const baseEvent = resolveBaseEvent(event);
	const viewAsSource = spec?.viewAs ?? info?.viewAs;
	const hasViewAs = Boolean(viewAsSource);
	const cardStep = spec?.steps?.find(step => step.type === "card");
	const targetStep = spec?.steps?.find(step => step.type === "target");
	const hasExplicitStepCardFilter = typeof cardStep?.filter === "function";
	const hasExplicitStepTargetFilter = typeof targetStep?.filter === "function";

	const position = hasViewAs ? (info?.position ?? baseEvent?.position ?? "hs") : (info?.position ?? "h");
	const complexSelect = hasViewAs ? Boolean(info?.complexSelect ?? baseEvent?.complexSelect) : Boolean(info?.complexSelect);
	const complexCard = hasViewAs ? Boolean(info?.complexCard ?? baseEvent?.complexCard) : Boolean(info?.complexCard);
	const complexTarget = hasViewAs ? Boolean(info?.complexTarget ?? baseEvent?.complexTarget) : Boolean(info?.complexTarget);

	const inheritsBaseFilterCard = hasViewAs && info?.filterCard === undefined;
	const effectiveFilterCard = hasExplicitStepCardFilter ? cardStep!.filter : inheritsBaseFilterCard ? baseEvent?.filterCard : info?.filterCard;
	const filterCardReceiver = inheritsBaseFilterCard ? baseEvent : info;
	const hasCardFilterRule = hasExplicitStepCardFilter || (effectiveFilterCard !== undefined && effectiveFilterCard !== false && effectiveFilterCard !== null);
	const effectiveSelectCard = cardStep?.select ?? (hasViewAs ? (info?.selectCard ?? baseEvent?.selectCard) : info?.selectCard);

	const effectiveFilterTarget = hasExplicitStepTargetFilter ? targetStep!.filter : hasViewAs ? (info?.filterTarget !== undefined ? info.filterTarget : baseEvent?.filterTarget) : info?.filterTarget;
	const effectiveSelectTarget = targetStep?.select ?? (hasViewAs ? info?.selectTarget : info?.selectTarget);

	const checkModCardEnabled2 = (card: any): boolean | "unchanged" => {
		if (!(hasViewAs && info?.filterCard !== undefined && !info?.ignoreMod && player && runtime.checkCardEnabled2)) {
			return "unchanged";
		}
		return runtime.checkCardEnabled2(card, player);
	};

	const isMaterialCardGuardEligible = (card: any): boolean => {
		if (typeof player?.isOut === "function" && player.isOut()) return false;
		if (runtime.isCardRespondable && !runtime.isCardRespondable(card, player)) return false;
		if (!hasViewAs && hasCardFilterRule && info?.discard !== false && info?.lose !== false && runtime.isCardDiscardable) {
			if (!runtime.isCardDiscardable(card, player)) return false;
		}
		const mod = checkModCardEnabled2(card);
		if (mod !== "unchanged") return !!mod;
		return true;
	};

	const isMaterialCardEligible = (card: any, evalEvent: any = event): boolean => {
		if (typeof player?.isOut === "function" && player.isOut()) return false;
		if (runtime.isCardRespondable && !runtime.isCardRespondable(card, player)) return false;
		if (!hasViewAs && hasCardFilterRule && info?.discard !== false && info?.lose !== false && runtime.isCardDiscardable) {
			if (!runtime.isCardDiscardable(card, player)) return false;
		}
		const mod = checkModCardEnabled2(card);
		if (mod !== "unchanged") return !!mod;
		if (hasExplicitStepCardFilter) return !!cardStep!.filter!(card, player, evalEvent, []);
		if (effectiveFilterCard == null || effectiveFilterCard === false) return false;
		return matchesSelectionFilter(effectiveFilterCard, card, player, filterCardReceiver, runtime.normalizeFilter, evalEvent);
	};

	const resolveActiveCard = (selectedCards: any[] = []): any => {
		if (hasViewAs) {
			const rawDef = typeof viewAsSource === "function" ? viewAsSource(selectedCards, player) : viewAsSource;
			if (!rawDef) return undefined;
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

	const resolveTargetLiveness = (selectedCards: any[] = []): TargetLivenessFlags => {
		const canInspectViewAs = !hasViewAs || typeof viewAsSource !== "function" || selectedCards.length > 0 || !hasCardFilterRule;
		const activeCard = canInspectViewAs ? resolveActiveCard(selectedCards) : undefined;
		const cardInfo = activeCard && runtime.getCardInfo ? runtime.getCardInfo(activeCard) || {} : {};
		return {
			deadTarget: Boolean((hasViewAs || targetStep?.items !== undefined ? (info?.deadTarget ?? baseEvent?.deadTarget) : info?.deadTarget) || cardInfo.deadTarget),
			includeOut: Boolean(baseEvent?.includeOut || info?.includeOut || cardInfo.includeOut),
			chessForceAll: Boolean((hasViewAs ? (info?.chessForceAll ?? baseEvent?.chessForceAll) : info?.chessForceAll) || cardInfo.chessForceAll),
		};
	};

	const isSkillTargetFilterMatch = (target: any, selectedCards: any[] = [], step?: any, context?: any, selected?: string[]): boolean => {
		const stepFilter = step?.filter;
		if (typeof stepFilter === "function") {
			return !!stepFilter(target, player, context ?? Object.freeze({ selected: Object.freeze({ card: [], target: [] }) }), selected ?? []);
		}
		const activeCard = resolveActiveCard(selectedCards);
		if (hasViewAs) {
			const filter = info?.filterTarget !== undefined ? info.filterTarget : baseEvent?.filterTarget;
			return evalTargetFilter(filter, activeCard, player, target, runtime.normalizeFilter);
		}
		if (info?.filterTarget !== undefined) {
			return evalTargetFilter(info.filterTarget, activeCard, player, target, runtime.normalizeFilter);
		}
		return true;
	};

	const resolveFinalOk = (selectedCards: any[], activeCard: any, context?: any, evalEvent: any = event): boolean => {
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

	const eventOverrides: Record<string, any> = {};
	if (hasViewAs) {
		if (info?.filterButton !== undefined) eventOverrides.filterButton = normalizeEventFilter(info.filterButton, runtime.normalizeFilter);
		if (info?.selectButton !== undefined) eventOverrides.selectButton = info.selectButton;
		if (info?.filterTarget !== undefined) eventOverrides.filterTarget = normalizeEventFilter(info.filterTarget, runtime.normalizeFilter);
		if (info?.selectTarget !== undefined) eventOverrides.selectTarget = info.selectTarget;
		if (info?.deadTarget !== undefined) eventOverrides.deadTarget = info.deadTarget;
		if (info?.chessForceAll !== undefined) eventOverrides.chessForceAll = info.chessForceAll;
		if (info?.filterCard !== undefined) {
			if (info.ignoreMod) eventOverrides.ignoreMod = true;
			eventOverrides.filterCard = (card: any, _p: any, evtArg?: any) => isMaterialCardEligible(card, evtArg || event);
		}
		if (info?.selectCard !== undefined) eventOverrides.selectCard = info.selectCard;
		if (info?.position !== undefined) eventOverrides.position = info.position;
		if (info?.allowChooseAll !== undefined) eventOverrides.allowChooseAll = info.allowChooseAll;
		if (info?.complexSelect !== undefined) eventOverrides.complexSelect = info.complexSelect;
		if (info?.complexCard !== undefined) eventOverrides.complexCard = info.complexCard;
		if (info?.complexTarget !== undefined) eventOverrides.complexTarget = info.complexTarget;
	} else {
		eventOverrides.filterButton = info?.filterButton ? normalizeEventFilter(info.filterButton, runtime.normalizeFilter) : undefined;
		eventOverrides.selectButton = info?.selectButton;
		eventOverrides.filterTarget = info?.filterTarget !== undefined ? normalizeEventFilter(info.filterTarget, runtime.normalizeFilter) : undefined;
		eventOverrides.selectTarget = info?.selectTarget;
		eventOverrides.deadTarget = info?.deadTarget;
		eventOverrides.chessForceAll = info?.chessForceAll;
		eventOverrides.filterCard = info?.filterCard !== undefined ? (card: any, _p: any, evtArg?: any) => isMaterialCardEligible(card, evtArg || event) : undefined;
		eventOverrides.selectCard = info?.selectCard;
		eventOverrides.position = info?.position;
		eventOverrides.allowChooseAll = info?.allowChooseAll;
		eventOverrides.complexSelect = info?.complexSelect;
		eventOverrides.complexCard = info?.complexCard;
		eventOverrides.complexTarget = info?.complexTarget;
		eventOverrides.filterOk = info?.filterOk;
	}
	if (info?.ai1 !== undefined) eventOverrides.ai1 = info.ai1;
	if (info?.ai2 !== undefined) eventOverrides.ai2 = info.ai2;

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
		eventOverrides,
	};
}
