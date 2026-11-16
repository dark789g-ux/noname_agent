import { game, get, lib } from "noname";
import { getRegisteredSkill } from "../library/skillRegistry.js";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import type { CandidateCard, CandidateTarget } from "./candidates.js";
import type { DecisionCandidateSnapshot } from "./action-candidates.js";
import {
	buildFactsSnapshotParts,
	buildRefLabels,
	renderStatelessContextMessages,
	type PromptFacts,
} from "./prompt-facts.js";
import {
	cleanPromptText,
	collectPromptPlayers,
	promptTranslation,
	selectPromptDescription,
	translatePromptValue,
	type PromptRuntime,
} from "./prompt-format.js";
import {
	getCurrentRoundNumber,
	getDiscardPileCount,
	getDrawPileCount,
	getPromptHistorySnapshot,
	getShuffleCount,
} from "./round-history.js";

/** 决策点的人类可读描述映射。 */
const DECISION_DESCRIPTIONS: Record<string, string> = {
	chooseToUse: "出牌阶段/需要出牌",
	chooseToRespond: "需要响应别人的牌",
	chooseToDiscard: "弃牌阶段/需要弃牌",
	chooseBool: "是否选择",
};

/**
 * 采集当前决策的结构化牌局事实（供 Harness 与无状态渲染共用）。
 */
export function collectDecisionPromptFacts(
	event: any,
	candidates: DecisionCandidateSnapshot | { cards: CandidateCard[]; skills: string[]; targets?: CandidateTarget[] },
	options?: { canInspectDiscard?: boolean }
): PromptFacts {
	const decisionPoint = event.name || "unknown";
	const runtime = createPromptRuntime();
	const referencedPlayers = "targetPool" in candidates ? candidates.targetPool.map(target => target.player) : undefined;
	const snapshot = collectPromptPlayers(runtime, event.player, referencedPlayers);
	const states = "targetPool" in candidates ? snapshot.states.map((state, index) => ({ ...state, ref: candidates.targetPool[index]?.ref })) : snapshot.states;
	const normalizedCandidates = {
		...candidates,
		targets: "targetPool" in candidates && candidates.actions.length ? candidates.targetPool : (candidates as any).targets,
	};
	const roundHistory = getPromptHistorySnapshot();
	const roundNumber = roundHistory.currentRound || getCurrentRoundNumber();
	const parts = buildFactsSnapshotParts(decisionPoint, event, normalizedCandidates, {
		decisionDescriptions: DECISION_DESCRIPTIONS,
		getSkillName: skillName,
		getSkillDescription: skill => engineSkillDescription(skill, undefined),
		getCardLabel: card => `${get.translation(card)} ${get.suit(card)} ${get.number(card)}`,
		getPlayerLabel: player => displayText(get.translation(player) || player.name),
	});
	return {
		decisionPoint,
		profiles: snapshot.profiles,
		states,
		pileOverview: {
			roundNumber,
			drawPileCount: getDrawPileCount(),
			discardPileCount: getDiscardPileCount(),
			shuffleNumber: getShuffleCount(),
			canInspectDiscard: options?.canInspectDiscard,
		},
		roundHistory,
		decisionHeaderText: parts.headerText,
		decisionChoicesText: parts.choicesText,
		refLabels: buildRefLabels(normalizedCandidates, states),
	};
}

/**
 * 构造发送给 LLM 的上下文消息。
 * 返回 { messages } 数组，包含 system prompt 和 user message（场面快照）。
 */
export function buildContext(
	event: any,
	candidates: DecisionCandidateSnapshot | { cards: CandidateCard[]; skills: string[]; targets?: CandidateTarget[] },
	options?: { canInspectDiscard?: boolean }
): { messages: ChatCompletionMessageParam[] } {
	const facts = collectDecisionPromptFacts(event, candidates, options);
	return { messages: renderStatelessContextMessages(facts) };
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
