import type { ChatCompletionTool } from "openai/resources/chat/completions.js";
import type { CandidateCard } from "./candidates.js";

/**
 * 构造 OpenAI tool 格式的 tools 数组。
 * 根据 decisionPoint 返回不同的可用动作集。
 */
export function buildTools(
	decisionPoint: string,
	candidates: { cards: CandidateCard[]; skills: string[] },
): ChatCompletionTool[] {
	switch (decisionPoint) {
		case "chooseToUse":
			return buildChooseToUseTools(candidates);
		case "chooseToRespond":
			return buildChooseToRespondTools(candidates);
		case "chooseToDiscard":
			return buildChooseToDiscardTools(candidates);
		case "chooseBool":
			return buildChooseBoolTools();
		default:
			return [];
	}
}

function buildChooseToUseTools(candidates: { cards: CandidateCard[]; skills: string[] }): ChatCompletionTool[] {
	const tools: ChatCompletionTool[] = [];

	tools.push({
		type: "function",
		function: {
			name: "use_card",
			description: "使用一张卡牌。card_id 必须在候选列表中，target_ids 为目标玩家的编号列表（从0开始），如无需目标则传空数组。",
			parameters: {
				type: "object",
				properties: {
					card_id: {
						type: "string",
						description: "要使用的卡牌 ID",
					},
					target_ids: {
						type: "array",
						items: { type: "integer" },
						description: "目标玩家编号数组（从 0 开始），无目标传 []",
					},
				},
				required: ["card_id", "target_ids"],
			},
		},
	});

	if (candidates.skills.length > 0) {
		tools.push({
			type: "function",
			function: {
				name: "use_skill",
				description: "发动一个主动技能。skill_name 必须在可用技能列表中。",
				parameters: {
					type: "object",
					properties: {
						skill_name: {
							type: "string",
							description: "要发动的技能名",
						},
					},
					required: ["skill_name"],
				},
			},
		});
	}

	tools.push({
		type: "function",
		function: {
			name: "pass",
			description: "跳过当前操作，不使用任何卡牌或技能。",
			parameters: {
				type: "object",
				properties: {},
			},
		},
	});

	return tools;
}

function buildChooseToRespondTools(candidates: { cards: CandidateCard[] }): ChatCompletionTool[] {
	return [
		{
			type: "function",
			function: {
				name: "respond_card",
				description: "使用一张卡牌来响应。card_id 必须在候选列表中。",
				parameters: {
					type: "object",
					properties: {
						card_id: {
							type: "string",
							description: "要使用的卡牌 ID",
						},
					},
					required: ["card_id"],
				},
			},
		},
		{
			type: "function",
			function: {
				name: "pass",
				description: "不响应，放弃出牌。",
				parameters: {
					type: "object",
					properties: {},
				},
			},
		},
	];
}

function buildChooseToDiscardTools(candidates: { cards: CandidateCard[] }): ChatCompletionTool[] {
	return [
		{
			type: "function",
			function: {
				name: "discard_cards",
				description: "弃置指定卡牌。card_ids 必须在候选列表中，数量需满足弃牌要求。",
				parameters: {
					type: "object",
					properties: {
						card_ids: {
							type: "array",
							items: { type: "string" },
							description: "要弃置的卡牌 ID 数组",
						},
					},
					required: ["card_ids"],
				},
			},
		},
		{
			type: "function",
			function: {
				name: "pass",
				description: "跳过弃牌（仅在非强制时可选择）。",
				parameters: {
					type: "object",
					properties: {},
				},
			},
		},
	];
}

function buildChooseBoolTools(): ChatCompletionTool[] {
	return [
		{
			type: "function",
			function: {
				name: "yes",
				description: "选择\"是\"。",
				parameters: {
					type: "object",
					properties: {},
				},
			},
		},
		{
			type: "function",
			function: {
				name: "no",
				description: "选择\"否\"。",
				parameters: {
					type: "object",
					properties: {},
				},
			},
		},
	];
}
