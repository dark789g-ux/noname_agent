import { game, get, lib } from "noname";
import { getRegisteredSkill } from "../library/skillRegistry.js";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import type { CandidateCard, CandidateTarget } from "./candidates.js";
import type { DecisionCandidateSnapshot } from "./action-candidates.js";
import { buildDecisionSnapshot, cleanPromptText, collectPromptPlayers, formatPlayerProfiles, promptTranslation, selectPromptDescription, translatePromptValue, type PromptRuntime } from "./prompt-format.js";
import { formatPileOverview, formatRoundHistory } from "./prompt-history.js";
import { getCurrentRoundNumber, getDiscardPileCount, getDrawPileCount, getPromptHistorySnapshot, getShuffleCount } from "./round-history.js";

/** 决策点的人类可读描述映射。 */
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
export function buildContext(event: any, candidates: DecisionCandidateSnapshot | { cards: CandidateCard[]; skills: string[]; targets?: CandidateTarget[] }, options?: { canInspectDiscard?: boolean }): { messages: ChatCompletionMessageParam[] } {
	const decisionPoint = event.name || "unknown";
	const runtime = createPromptRuntime();
	const referencedPlayers = "targetPool" in candidates ? candidates.targetPool.map(target => target.player) : undefined;
	const snapshot = collectPromptPlayers(runtime, event.player, referencedPlayers);
	const states = "targetPool" in candidates ? snapshot.states.map((state, index) => ({ ...state, ref: candidates.targetPool[index]?.ref })) : snapshot.states;
	const historySnapshot = getPromptHistorySnapshot();
	const roundNumber = historySnapshot.currentRound || getCurrentRoundNumber();
	const pileOverviewText = formatPileOverview({
		roundNumber,
		drawPileCount: getDrawPileCount(),
		discardPileCount: getDiscardPileCount(),
		shuffleNumber: getShuffleCount(),
		canInspectDiscard: options?.canInspectDiscard,
	});
	const roundHistoryText = formatRoundHistory(historySnapshot);
	return {
		messages: [
			{
				role: "system",
				content: `你是三国杀的 AI 玩家。根据当前场面从可用工具中选择最优动作，只返回一个工具调用。重要要求：你的整个内部思考过程（reasoning_content）与工具参数中的原因说明（reason），除了必要的短引用代号与工具名外，必须全程使用简体中文。\n\n${formatPlayerProfiles(snapshot.profiles)}`,
			},
			{
				role: "user",
				content: `${buildDecisionSnapshot(
					decisionPoint,
					event,
					{
						...candidates,
						targets: "targetPool" in candidates && candidates.actions.length ? candidates.targetPool : (candidates as any).targets,
					},
					states,
					{
						decisionDescriptions: DECISION_DESCRIPTIONS,
						getSkillName: skillName,
						getSkillDescription: skill => engineSkillDescription(skill, undefined),
						getCardLabel: card => `${get.translation(card)} ${get.suit(card)} ${get.number(card)}`,
						getPlayerLabel: player => displayText(get.translation(player) || player.name),
						pileOverviewText,
						roundHistoryText,
					}
				)}\n\n请务必全程使用简体中文进行内部思考（reasoning_content）并填写中文原因（reason）。`,
			},
		],
	};
}

function createPromptRuntime(): PromptRuntime {
	return {
		players: Array.from(game.players || []),
		globalSkills: lib.skill.global || [],
		translate: translateId,
		getPlayerName: player => displayText(get.translation(player) || player.name),
		getSkillName: skillName,
		getSkillDescription: engineSkillDescription,
		getSkillMeta: skill => getRegisteredSkill(lib.skill, skill),
		isZhuanhuanji: (skill, player) => Boolean(get.is?.zhuanhuanji?.(skill, player)),
		isCardKnown: (card, observer) => Boolean(card?.isKnownBy?.(observer)),
		getEquipmentSkills: card => Array.from(get.skillsFromEquips?.([card]) || []),
		isEquipmentCard: card => get.info(card, false)?.type === "equip",
		getCardName: card => displayText(get.translation(card) || translateId(viewAsName(card) || card.name)),
		getCardProperties: (card, owner) => ({
			suit: translateId(get.suit(card, owner)),
			number: get.number(card, owner) ?? "未知",
			color: translateId(get.color(card, owner)),
		}),
		getCardDescription: engineCardDescription,
		getViewedAsDescription: engineViewedAsDescription,
	};
}

function engineSkillDescription(skill: string, player: any): string {
	let dynamicDescription = "";
	try {
		dynamicDescription = cleanPromptText(get.skillInfoTranslation?.(skill, player));
	} catch {
		// 动态翻译异常时回退到翻译表或装备说明。
	}
	return selectPromptDescription(dynamicDescription, promptTranslation(lib.translate, `${skill}_info`));
}

function engineCardDescription(card: any, owner: any): string {
	let description = "";
	try {
		description = get.cardDescription(card, owner);
	} catch {
		// 继续使用动态 cardPrompt 或翻译表。
	}
	let prompt = "";
	try {
		prompt = get.info(card, false)?.cardPrompt?.(card, owner);
	} catch {
		// 动态 cardPrompt 异常时回退官方静态说明。
	}
	return selectPromptDescription(description, prompt, promptTranslation(lib.translate, `${card.name}_info`));
}

function engineViewedAsDescription(card: any, effectiveId: string, owner: any): string {
	let prompt = "";
	try {
		prompt = lib.card[effectiveId]?.cardPrompt?.(card, owner);
	} catch {
		// 动态 cardPrompt 异常时回退官方静态说明。
	}
	return selectPromptDescription(prompt, promptTranslation(lib.translate, `${effectiveId}_info`));
}

function translateId(value: unknown): string {
	return translatePromptValue(value, get.translation);
}

function displayText(value: unknown): string {
	return cleanPromptText(value) || "未知";
}

function skillName(skill: string): string {
	const translated = displayText(get.skillTranslation?.(skill));
	if (translated !== "未知" && translated !== skill) return translated;
	const fallback = translateId(skill);
	return fallback === skill ? "" : fallback;
}

function viewAsName(card: any): string | undefined {
	if (typeof card?.viewAs === "string") return card.viewAs;
	if (card?.viewAs && typeof card.viewAs.name === "string") return card.viewAs.name;
	return undefined;
}

/** 保留原导出，供候选技能描述及外部调用使用。 */
export function cleanSkillDescription(value: unknown): string {
	return cleanPromptText(value);
}
