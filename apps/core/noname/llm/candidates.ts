import { _status, game, get, lib, ui } from "noname";
import { getRegisteredSkill } from "../library/skillRegistry.js";
import { matchesSelectionFilter } from "./selection-filter.js";
import { resolveSelectionSpec } from "./selection-adapter.js";
import { evaluateSelectionSpec } from "./generic-skill-plan.js";
import { withVirtualSelection } from "./legacy-bridge.js";
import { resolveBaseEvent, resolveEffectiveSkillSemantics, type SkillSemanticRuntime } from "./skill-backup-semantics.js";

export interface CandidateCard {
	card: any;
	/** 会话内短引用，供 LLM tool 参数使用。 */
	ref: string;
	id: string;
	name: string;
	cardAction?: boolean;
	skills?: string[];
}

export interface CandidateTarget {
	player: any;
	ref: string;
	id: string;
	name: string;
}

function createCandidatesSemanticRuntime(): SkillSemanticRuntime {
	return {
		getCardInfo: card => (typeof get?.info === "function" ? get.info(card) || {} : card?.info || {}),
		autoViewAs: (definition, selected) => (typeof get?.autoViewAs === "function" ? get.autoViewAs(definition, selected) : { ...definition, cards: selected }),
		normalizeFilter: value => get.filter(value),
		checkCardEnabled2: (card, current) => (typeof game?.checkMod === "function" ? game.checkMod(card, current, "unchanged", "cardEnabled2", current) : "unchanged"),
		isCardDiscardable: (card, current) => (typeof lib?.filter?.cardDiscardable === "function" ? !!lib.filter.cardDiscardable(card, current) : true),
		isCardRespondable: (card, current) => (typeof lib?.filter?.cardRespondable === "function" ? !!lib.filter.cardRespondable(card, current) : true),
	};
}

function resolveMinCardSelect(select: any): number {
	const raw = typeof select === "function" ? select() : select;
	if (raw === undefined) return 1;
	if (typeof raw === "number") return raw < 0 ? 0 : raw;
	if (Array.isArray(raw) && typeof raw[0] === "number") return raw[0] < 0 ? 0 : raw[0];
	return 1;
}

/**
 * 获取当前决策事件中可用出牌候选。
 * 通过 event.filterCard 与技能语义投影过滤，不依赖 DOM。
 */
export function getCandidateCards(event: any, player: any, skills: string[] = []): CandidateCard[] {
	const records = new Map<any, { cardAction: boolean; skills: string[] }>();
	const semanticRuntime = createCandidatesSemanticRuntime();
	const backupSkillInfo = event?.skill && !skills.length ? getRegisteredSkill(lib.skill, event.skill) : undefined;
	const targetSkills = backupSkillInfo ? [event.skill] : skills;
	if (!event?.skill || !backupSkillInfo) {
		const eventSpec = resolveSelectionSpec(event.selectionSpec, event, player);
		const eventFilter = eventSpec?.steps?.find(step => step.type === "card")?.filter ?? event.filterCard;
		withVirtualSelection({ ui, status: _status }, { event, player, cards: [], targets: [], buttons: [] }, () => {
			if (typeof player?.isOut === "function" && player.isOut()) return;
			for (const card of player.getCards(event.position || "hs")) {
				if (semanticRuntime.isCardRespondable && !semanticRuntime.isCardRespondable(card, player)) continue;
				if (eventFilter != null && matchesSelectionFilter(eventFilter, card, player, event, value => get.filter(value), event)) {
					records.set(card, { cardAction: !event?.skill, skills: event?.skill ? [event.skill] : [] });
				}
			}
		});
	}
	for (const skill of targetSkills) {
		const info = getRegisteredSkill(lib.skill, skill);
		if (!info) continue;
		const evaluated = evaluateSelectionSpec(info.selectionSpec, event, player, skill, message => {
			throw new Error(message);
		});
		if (evaluated.mode === "disabled") continue;
		const spec = evaluated.mode === "explicit" ? evaluated.spec : undefined;
		const semantics = resolveEffectiveSkillSemantics({ event, player, skill, info, spec, runtime: semanticRuntime });
		const collectSkillCards = () => {
			if (typeof player?.isOut === "function" && player.isOut()) return;
			const pool = player.getCards(semantics.position) || [];
			const addSkillCard = (card: any) => {
				const record = records.get(card) || { cardAction: false, skills: [] };
				if (!record.skills.includes(skill)) record.skills.push(skill);
				records.set(card, record);
			};
			if (semantics.complexCard || semantics.complexSelect) {
				if (!semantics.hasCardFilterRule) return;
				const minSelect = resolveMinCardSelect(semantics.effectiveSelectCard);
				const hasStarter = minSelect <= 0 || pool.some((card: any) => semantics.isMaterialCardEligible(card, event));
				if (!hasStarter) return;
				for (const card of pool) {
					if (semantics.isMaterialCardGuardEligible(card)) addSkillCard(card);
				}
				return;
			}
			for (const card of pool) {
				if (semantics.isMaterialCardEligible(card, event)) addSkillCard(card);
			}
		};
		const runWithBridge = () =>
			withVirtualSelection(
				{ ui, status: _status },
				{ event, player, skill, cards: [], targets: [], buttons: [], synthesizeBackup: true, eventOverrides: semantics.eventOverrides },
				collectSkillCards
			);
		if (evaluated.mode === "explicit") runWithBridge();
		else {
			try {
				runWithBridge();
			} catch {
				// 通用推理技能的 filterCard 异常时单条隔离，避免拖垮其他候选。
			}
		}
	}
	return Array.from(records, ([card, scopes], index) => ({ card, ref: `c${index}`, id: cardToId(card), name: get.translation(card), ...scopes }));
}

/**
 * 获取当前决策事件中可用的主动技能候选。
 * 保守策略：仅列出 enable 或 usable 有定义的技能，排除 _aiexclude。
 */
export function getCandidateSkills(event: any, player: any): string[] {
	const excluded: (string | Card)[] = Array.isArray(event._aiexclude) ? event._aiexclude : [];
	const skills = game.expandSkills(player.getSkills("invisible").concat(lib.skill.global));
	return skills.filter((skill: string) => {
		const info = getRegisteredSkill(lib.skill, skill);
		return !excluded.some(item => typeof item === "string" && (item === skill || (typeof info?.sourceSkill === "string" && item === info.sourceSkill))) && isSkillEligible(event, player, skill);
	});
}

/** 与 UI game.check 使用同一个引擎权威入口；保持未 backup 时的原生求值上下文，不提前注入 skill/_backup。 */
export function isSkillEligible(event: any, player: any, skill: string): boolean {
	const info = getRegisteredSkill(lib.skill, skill);
	if (!info) return false;
	const evaluated = evaluateSelectionSpec(info.selectionSpec, event, player, skill, message => {
		throw new Error(message);
	});
	if (evaluated.mode === "disabled") return false;
	const check = () =>
		withVirtualSelection(
			{ ui, status: _status },
			{ event, player, cards: [], targets: [], buttons: [] },
			() => !!lib.filter.filterEnable(event, player, skill)
		);
	if (evaluated.mode === "explicit") return check();
	try {
		return check();
	} catch {
		return false;
	}
}

/**
 * 获取当前决策事件中某张牌的可用目标候选。
 * 通过 event.filterTarget 过滤，不依赖 DOM。
 */
export function getCandidateTargets(event: any, player: any, card: any): any[] {
	if (!event.filterTarget) return [];
	const baseEvent = resolveBaseEvent(event);
	const cardInfo = card && typeof get?.info === "function" ? get.info(card) : undefined;
	const all = Array.from(game.players);
	if (event.deadTarget || baseEvent?.deadTarget || cardInfo?.deadTarget) all.push(...game.dead);
	return all.filter((t: any) => event.filterTarget(card, player, t));
}

/**
 * 返回本次决策可见的座位引用。引用只在单个 DecisionSession 内有效，
 * 避免把不稳定的数组下标直接暴露给模型。
 */
export function getCandidateTargetRefs(event: any, player: any, card?: any): CandidateTarget[] {
	const baseEvent = resolveBaseEvent(event);
	const cardInfo = card && typeof get?.info === "function" ? get.info(card) : undefined;
	const players = Array.from(game.players);
	if (event.deadTarget || baseEvent?.deadTarget || cardInfo?.deadTarget) players.push(...game.dead);
	return players
		.filter((target: any) => {
			if (!event.filterTarget || !card) return true;
			return event.filterTarget(card, player, target);
		})
		.map((target: any, index: number) => ({
			player: target,
			ref: `p${index}`,
			id: target.playerid || String(index),
			name: get.translation(target) || target.name || "未知",
		}));
}

/**
 * 将 Card 对象序列化为 LLM 可读的 id（也用于 apply 时反查）。
 * 使用 name_suit_number 格式，方便 LLM 理解和选择。
 */
export function cardToId(card: any): string {
	const name = card.name || "";
	const suit = card.originalSuit || card.suit || "";
	const num = card.originalNumber || card.number || "";
	return `${name}_${suit}_${num}`;
}

/**
 * 从候选列表中按 id 反查 Card 对象。
 */
export function findCardById(candidates: CandidateCard[], id: string): CandidateCard | undefined {
	const matches = candidates.filter(candidate => candidate.id === id);
	return matches.length === 1 ? matches[0] : undefined;
}
