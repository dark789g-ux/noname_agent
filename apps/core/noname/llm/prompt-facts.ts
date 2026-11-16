import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import {
	buildDecisionSnapshotParts,
	formatPlayerProfiles,
	formatPlayerStates,
	type PromptPlayerProfile,
	type PromptPlayerState,
	type PromptSnapshotCandidates,
} from "./prompt-format.js";
import {
	formatPileOverview,
	formatRoundHistory,
	type PileOverviewInput,
	type RoundHistoryInput,
} from "./prompt-history.js";

export const LLM_SYSTEM_PROMPT_PREFIX =
	"你是三国杀的 AI 玩家。根据当前场面从可用工具中选择最优动作，只返回一个工具调用。重要要求：你的整个内部思考过程（reasoning_content）与工具参数中的原因说明（reason），除了必要的短引用代号与工具名外，必须全程使用简体中文。";

export const LLM_USER_CHINESE_REMINDER =
	"请务必全程使用简体中文进行内部思考（reasoning_content）并填写中文原因（reason）。";

export interface PromptFacts {
	decisionPoint: string;
	profiles: PromptPlayerProfile[];
	states: PromptPlayerState[];
	pileOverview: PileOverviewInput;
	roundHistory: RoundHistoryInput;
	decisionHeaderText: string;
	decisionChoicesText: string;
	refLabels: Record<string, string>;
}

/** 从候选与状态中提取 c0/p0 等短引用到人类可读标签的映射，供时间线 UI 展示。 */
export function buildRefLabels(candidates: PromptSnapshotCandidates, states: PromptPlayerState[]): Record<string, string> {
	const labels: Record<string, string> = {};
	for (const card of candidates.cards || []) {
		if (card.ref && card.name) labels[card.ref] = card.name;
	}
	for (const target of candidates.targets || []) {
		if (target.ref && target.name) labels[target.ref] = target.name;
	}
	for (const state of states || []) {
		if (state.ref && state.name) {
			labels[state.ref] = state.seat > 0 ? `${state.name}[座位${state.seat}]` : state.name;
		}
	}
	return labels;
}

/** 根据结构化事实渲染无状态全量对话消息，保持与历史 buildContext 输出逐字一致。 */
export function renderStatelessContextMessages(facts: PromptFacts): ChatCompletionMessageParam[] {
	const pileOverviewText = formatPileOverview(facts.pileOverview);
	const roundHistoryText = formatRoundHistory(facts.roundHistory);
	const lines: string[] = [facts.decisionHeaderText];
	if (pileOverviewText) lines.push("", pileOverviewText);
	lines.push("", formatPlayerStates(facts.states));
	if (roundHistoryText) lines.push("", roundHistoryText);
	if (facts.decisionChoicesText) lines.push(facts.decisionChoicesText);
	return [
		{
			role: "system",
			content: `${LLM_SYSTEM_PROMPT_PREFIX}\n\n${formatPlayerProfiles(facts.profiles)}`,
		},
		{
			role: "user",
			content: `${lines.join("\n")}\n\n${LLM_USER_CHINESE_REMINDER}`,
		},
	];
}

export function buildFactsSnapshotParts(
	decisionPoint: string,
	event: any,
	candidates: PromptSnapshotCandidates,
	options: {
		decisionDescriptions: Record<string, string>;
		getSkillName(skill: string): string;
		getSkillDescription(skill: string): string;
		getCardLabel?(card: any): string;
		getPlayerLabel?(player: any): string;
	}
) {
	return buildDecisionSnapshotParts(decisionPoint, event, candidates, options);
}
