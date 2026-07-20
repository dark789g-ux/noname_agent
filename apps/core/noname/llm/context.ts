import { game, get, _status } from "noname";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import type { CandidateCard, CandidateTarget } from "./candidates.js";

/**
 * 决策点的人类可读描述映射
 */
const DECISION_DESCRIPTIONS: Record<string, string> = {
	chooseToUse: "出牌阶段/需要出牌",
	chooseToRespond: "需要响应别人的牌",
	chooseToDiscard: "弃牌阶段/需要弃牌",
	chooseBool: "是否选择",
};

/**
 * 构造发送给 LLM 的上下文消息。
 * 返回 { messages } 数组，包含 system prompt 和 user message（场面快照）。
 */
export function buildContext(
	event: any,
	candidates: { cards: CandidateCard[]; skills: string[]; targets?: CandidateTarget[] },
): { messages: ChatCompletionMessageParam[] } {
	const decisionPoint = event.name || "unknown";
	const player = event.player;
	const messages: ChatCompletionMessageParam[] = [];

	// System message
	messages.push({
		role: "system",
		content: "你是三国杀的 AI 玩家。根据当前场面从可用 tools 中选择最优动作。只返回一个 tool_call。",
	});

	// User message: 场面快照
	const snapshot = buildSnapshot(decisionPoint, event, player, candidates);
	messages.push({
		role: "user",
		content: snapshot,
	});

	return { messages };
}

function buildSnapshot(
	decisionPoint: string,
	event: any,
	player: any,
	candidates: { cards: CandidateCard[]; skills: string[]; targets?: CandidateTarget[] },
): string {
	const lines: string[] = [];

	// 决策点
	lines.push(`## 决策类型：${DECISION_DESCRIPTIONS[decisionPoint] || decisionPoint}`);

	// 事件提示
	if (event.prompt) {
		lines.push(`## 提示：${event.prompt}`);
	}
	if (event.dialog && typeof event.dialog === "string") {
		lines.push(`## 对话：${event.dialog}`);
	}

	// 当前玩家信息
	if (player) {
		const name = get.translation(player) || player.name || "未知";
		const hp = player.getHp ? player.getHp() : (player.hp ?? "?");
		const maxHp = player.maxHp ?? "?";
		const handCount = player.getCards ? player.getCards("h").length : "?";

		lines.push(`\n## 当前玩家：${name}`);
		lines.push(`- 体力：${hp}/${maxHp}`);
		lines.push(`- 手牌数：${handCount}`);

		// 装备
		try {
			const equips = player.getCards("e");
			if (equips.length > 0) {
				const equipNames = equips.map((e: any) => get.translation(e)).join(", ");
				lines.push(`- 装备：${equipNames}`);
			}
		} catch {
			// 忽略
		}

		// 技能
		try {
			const skills = player.getSkills ? player.getSkills(true) : [];
			if (skills.length > 0) {
				lines.push(`- 技能：${skills.join(", ")}`);
			}
		} catch {
			// 忽略
		}
	}

	// 其它玩家信息
	try {
		const allPlayers = Array.from(game.players);
		if (allPlayers.length > 1) {
			lines.push("\n## 其它玩家：");
			allPlayers.forEach((p: any, idx: number) => {
				if (p === player) return;
				const pName = get.translation(p) || p.name || "未知";
				const pHp = p.getHp ? p.getHp() : (p.hp ?? "?");
				const pMaxHp = p.maxHp ?? "?";
				const pHand = p.getCards ? p.getCards("h").length : "?";
				let line = `- [${idx}] ${pName}：体力 ${pHp}/${pMaxHp}，手牌 ${pHand}`;

				// 装备
				try {
					const pEquips = p.getCards("e");
					if (pEquips.length > 0) {
						line += `，装备：${pEquips.map((e: any) => get.translation(e)).join(", ")}`;
					}
				} catch {
					// 忽略
				}

				// 已知手牌
				try {
					if (player && p.getKnownCards) {
						const known = p.getKnownCards(player);
						if (known.length > 0) {
							line += `，已知手牌：${known.map((c: any) => get.translation(c)).join(", ")}`;
						}
					}
				} catch {
					// 忽略
				}

				lines.push(line);
			});
		}
	} catch {
		// 忽略
	}

	// 候选卡牌
	if (candidates.cards.length > 0) {
		lines.push("\n## 可用卡牌：");
		candidates.cards.forEach((c, idx) => {
		const scopes = [c.cardAction ? "直接使用" : "", ...(c.skills || []).map(skill => `技能:${skill}`)].filter(Boolean).join("，");
		lines.push(`- ${c.ref}: ${c.name}（旧 ID: ${c.id}${scopes ? `；${scopes}` : ""}）`);
		});
	} else {
		lines.push("\n## 可用卡牌：无");
	}

	// 候选技能
	if (candidates.skills.length > 0) {
		lines.push("\n## 可用技能：");
		candidates.skills.forEach(s => {
			const translated = get.skillTranslation ? get.skillTranslation(s) : get.translation(s) || s;
			const info = cleanSkillDescription(get.skillInfoTranslation ? get.skillInfoTranslation(s) : get.translation(`${s}_info`));
			lines.push(`- ${s}（${translated}）：${info || "无可用规则描述"}`);
		});
	}

	if (candidates.targets?.length) {
		lines.push("\n## 当前可选目标：");
		for (const target of candidates.targets) lines.push(`- ${target.ref}: ${target.name}`);
	}

	// 弃牌数量提示
	if (decisionPoint === "chooseToDiscard" && event.selectCard) {
		const sel = event.selectCard;
		if (Array.isArray(sel)) {
			lines.push(`\n## 弃牌要求：最少 ${sel[0]} 张，最多 ${sel[1]} 张`);
		} else if (typeof sel === "number") {
			lines.push(`\n## 弃牌要求：${sel} 张`);
		}
	}

	return lines.join("\n");
}

/** 技能 info 常含 HTML、换行和动态标记；prompt 只发送有限的纯文本。 */
export function cleanSkillDescription(value: unknown): string {
	return String(value || "")
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 600);
}
