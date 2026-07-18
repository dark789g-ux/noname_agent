import { game, get, lib } from "noname";

export interface CandidateCard {
	card: any;
	id: string;
	name: string;
}

/**
 * 获取当前决策事件中可用出牌候选。
 * 通过 event.filterCard 过滤，不依赖 DOM。
 */
export function getCandidateCards(event: any, player: any): CandidateCard[] {
	if (!event.filterCard) return [];
	// position 默认 "hs"（手牌+装备），与引擎 chooseToUse 默认一致
	const position = event.position || "hs";
	const cards = player.getCards(position);
	return cards
		.filter((c: any) => {
			try {
				return event.filterCard(c, player);
			} catch {
				return false;
			}
		})
		.map((c: any) => ({
			card: c,
			id: cardToId(c),
			name: get.translation(c),
		}));
}

/**
 * 获取当前决策事件中可用的主动技能候选。
 * 保守策略：仅列出 enable 或 usable 有定义的技能，排除 _aiexclude。
 */
export function getCandidateSkills(event: any, player: any): string[] {
	try {
		const excluded: string[] = Array.isArray(event._aiexclude) ? event._aiexclude : [];
		const skills = player.getSkills(true);
		return skills.filter((s: string) => {
			if (excluded.includes(s)) return false;
			const info = lib.skill[s];
			if (!info) return false;
			// 技能必须有 enable 或 usable 标记表示可主动发动
			return info.enable || info.usable !== undefined;
		});
	} catch {
		return [];
	}
}

/**
 * 获取当前决策事件中某张牌的可用目标候选。
 * 通过 event.filterTarget 过滤，不依赖 DOM。
 */
export function getCandidateTargets(event: any, player: any, card: any): any[] {
	if (!event.filterTarget) return [];
	try {
		const all = Array.from(game.players);
		if (event.deadTarget) all.push(...game.dead);
		return all.filter((t: any) => event.filterTarget(card, player, t));
	} catch {
		return [];
	}
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
	return candidates.find(c => c.id === id);
}
