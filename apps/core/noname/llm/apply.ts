import { game } from "noname";
import type { CandidateCard } from "./candidates.js";
import type { ToolCallResult } from "./client.js";
import { getCandidateTargets, findCardById } from "./candidates.js";

/**
 * 将 LLM 返回的 tool_call 翻译为引擎期望的结果格式。
 * 返回的对象格式与 content.ts 中各 step 消费的 Result 一致。
 */
export function translateResult(
	event: any,
	toolCall: ToolCallResult,
	candidates: { cards: CandidateCard[]; skills: string[] },
): any {
	const { name, arguments: args } = toolCall;

	switch (name) {
		case "use_card": {
			return translateUseCard(event, args, candidates);
		}
		case "respond_card": {
			return translateRespondCard(event, args, candidates);
		}
		case "use_skill": {
			return translateUseSkill(args, candidates);
		}
		case "discard_cards": {
			return translateDiscardCards(args, candidates);
		}
		case "end_phase":
		case "pass": {
			return { bool: false };
		}
		case "yes": {
			return { bool: true };
		}
		case "no": {
			return { bool: false };
		}
		default: {
			const err = new Error(`Unknown tool name: ${name}`);
			(err as any).stage = "translate";
			throw err;
		}
	}
}

function translateUseCard(
	event: any,
	args: Record<string, any>,
	candidates: { cards: CandidateCard[] },
): any {
	const cardId = args.card_id;
	if (!cardId) {
		const err = new Error("use_card: missing card_id");
		(err as any).stage = "translate";
		throw err;
	}

	const found = findCardById(candidates.cards, cardId);
	if (!found) {
		const err = new Error(`use_card: card_id "${cardId}" not found in candidates`);
		(err as any).stage = "translate";
		throw err;
	}

	const player = event.player;
	const card = found.card;
	const targetIds: number[] = Array.isArray(args.target_ids) ? args.target_ids : [];

	// 构造目标列表
	const targets: any[] = [];
	if (targetIds.length > 0) {
		try {
			const allPlayers = Array.from(game.players);
			for (const idx of targetIds) {
				if (idx >= 0 && idx < allPlayers.length) {
					// 用 filterTarget 验证目标合法性
					if (event.filterTarget && event.filterTarget(card, player, allPlayers[idx])) {
						targets.push(allPlayers[idx]);
					}
				}
			}
		} catch {
			// 忽略
		}
	}

	return {
		bool: true,
		card,
		cards: [card],
		targets,
	};
}

function translateRespondCard(
	event: any,
	args: Record<string, any>,
	candidates: { cards: CandidateCard[] },
): any {
	const cardId = args.card_id;
	if (!cardId) {
		const err = new Error("respond_card: missing card_id");
		(err as any).stage = "translate";
		throw err;
	}

	const found = findCardById(candidates.cards, cardId);
	if (!found) {
		const err = new Error(`respond_card: card_id "${cardId}" not found in candidates`);
		(err as any).stage = "translate";
		throw err;
	}

	return {
		bool: true,
		card: found.card,
		cards: [found.card],
	};
}

function translateUseSkill(
	args: Record<string, any>,
	candidates: { skills: string[] },
): any {
	const skillName = args.skill_name;
	if (!skillName) {
		const err = new Error("use_skill: missing skill_name");
		(err as any).stage = "translate";
		throw err;
	}

	if (!candidates.skills.includes(skillName)) {
		const err = new Error(`use_skill: skill "${skillName}" not in candidates`);
		(err as any).stage = "translate";
		throw err;
	}

	return {
		bool: true,
		skill: skillName,
	};
}

function translateDiscardCards(
	args: Record<string, any>,
	candidates: { cards: CandidateCard[] },
): any {
	const cardIds: string[] = Array.isArray(args.card_ids) ? args.card_ids : [];

	if (cardIds.length === 0) {
		const err = new Error("discard_cards: empty card_ids");
		(err as any).stage = "translate";
		throw err;
	}

	const cards: any[] = [];
	for (const id of cardIds) {
		const found = findCardById(candidates.cards, id);
		if (!found) {
			const err = new Error(`discard_cards: card_id "${id}" not found in candidates`);
			(err as any).stage = "translate";
			throw err;
		}
		cards.push(found.card);
	}

	return {
		bool: true,
		cards,
	};
}
