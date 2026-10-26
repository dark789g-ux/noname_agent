import { game, get, lib } from "noname";
import { getRegisteredSkill } from "../library/skillRegistry.js";

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

/**
 * 获取当前决策事件中可用出牌候选。
 * 通过 event.filterCard 过滤，不依赖 DOM。
 */
export function getCandidateCards(event: any, player: any, skills: string[] = []): CandidateCard[] {
	const records = new Map<any, { cardAction: boolean; skills: string[] }>();
	for (const card of player.getCards(event.position || "hs")) {
		if (event.filterCard?.(card, player) === true) records.set(card, { cardAction: true, skills: [] });
	}
	for (const skill of skills) {
		const info = getRegisteredSkill(lib.skill, skill);
		for (const card of player.getCards(info?.position || event.position || "hs")) {
			const filterCard = info?.filterCard;
			if (filterCard != null && filterCard !== true && typeof filterCard !== "function") {
				throw new TypeError("Headless card candidates require a callable filterCard or true");
			}
			const eligible = filterCard === true || filterCard?.call(info, card, player) === true;
			if (!eligible) continue;
			const record = records.get(card) || { cardAction: false, skills: [] };
			record.skills.push(skill);
			records.set(card, record);
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
	return skills.filter((skill: string) => !excluded.some(item => typeof item === "string" && item === skill) && isSkillEligible(event, player, skill));
}

/** 与 UI game.check 使用同一个引擎权威入口，并限制为已声明 headless 契约的技能。 */
export function isSkillEligible(event: any, player: any, skill: string): boolean {
	return !!getRegisteredSkill(lib.skill, skill)?.selectionSpec && lib.filter.filterEnable(event, player, skill);
}

/**
 * 获取当前决策事件中某张牌的可用目标候选。
 * 通过 event.filterTarget 过滤，不依赖 DOM。
 */
export function getCandidateTargets(event: any, player: any, card: any): any[] {
	if (!event.filterTarget) return [];
	const all = Array.from(game.players);
	if (event.deadTarget) all.push(...game.dead);
	return all.filter((t: any) => event.filterTarget(card, player, t));
}

/**
 * 返回本次决策可见的座位引用。引用只在单个 DecisionSession 内有效，
 * 避免把不稳定的数组下标直接暴露给模型。
 */
export function getCandidateTargetRefs(event: any, player: any, card?: any): CandidateTarget[] {
	const players = Array.from(game.players);
	if (event.deadTarget) players.push(...game.dead);
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
