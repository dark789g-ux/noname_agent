import type { ChatCompletionTool } from "openai/resources/chat/completions.js";
import type { CandidateCard } from "./candidates.js";

export type SelectionToolType = "button" | "card" | "target" | "control" | "number";

/** 构造当前选择阶段可调用的工具。 */
export function buildTools(
	decisionPoint: string,
	candidates: { cards: CandidateCard[]; skills: string[] },
	stage?: { id: string; type: SelectionToolType },
	forced = false,
): ChatCompletionTool[] {
	if (stage) return [buildSelectionTool(stage)];
	switch (decisionPoint) {
		case "chooseToUse":
			return buildChooseToUseTools(candidates, forced);
		case "chooseToRespond":
			return optionalPass([cardTool("respond_card", "使用一张候选牌响应。", false), ...(candidates.skills.length ? [skillTool()] : [])], forced, "不响应，放弃出牌。");
		case "chooseToDiscard":
			return optionalPass([cardsTool("discard_cards", "弃置候选牌；数量必须满足当前弃牌要求。")], forced, "跳过弃牌。");
		case "chooseBool":
			return [boolTool("yes", "选择“是”。"), boolTool("no", "选择“否”。")];
		default:
			return [];
	}
}

function buildChooseToUseTools(candidates: { cards: CandidateCard[]; skills: string[] }, forced: boolean): ChatCompletionTool[] {
	const tools = [cardTool("use_card", "使用一张候选牌。", true)];
	if (candidates.skills.length) {
		tools.splice(1, 0, skillTool());
	}
	if (!forced) tools.push(passTool("跳过当前操作，不使用任何卡牌或技能。"));
	return tools;
}

function skillTool(): ChatCompletionTool {
	return {
		type: "function",
		function: {
			name: "use_skill",
			description: "发动候选主动技能。需要选牌或目标时，先传 skill_name，随后严格按下一轮选择工具完成。",
			parameters: object({
				skill_name: string("候选技能 ID"),
				card_refs: strings("可选：已选卡牌短引用 c0/c1"),
				target_refs: strings("可选：已选目标短引用 p0/p1"),
				card_ids: strings("兼容旧协议的牌 ID"),
				target_ids: array("兼容旧协议的目标数组", { type: "integer" }),
			}, ["skill_name"]),
		},
	};
}

function optionalPass(tools: ChatCompletionTool[], forced: boolean, description: string): ChatCompletionTool[] {
	if (!forced) tools.push(passTool(description));
	return tools;
}

function cardTool(name: string, description: string, withTargets: boolean): ChatCompletionTool {
	const properties: Record<string, any> = {
		card_ref: string("候选卡牌短引用，例如 c0"),
		card_id: string("兼容旧协议的卡牌 ID"),
	};
	if (withTargets) {
		properties.target_refs = strings("目标短引用，例如 p0；无目标传 []");
		properties.target_ids = array("兼容旧协议的目标下标数组", { type: "integer" });
	}
	return { type: "function", function: { name, description, parameters: object(properties) } };
}

function cardsTool(name: string, description: string): ChatCompletionTool {
	return {
		type: "function",
		function: {
			name,
			description,
			parameters: object({ card_refs: strings("候选卡牌短引用数组"), card_ids: strings("兼容旧协议的卡牌 ID 数组") }),
		},
	};
}

function buildSelectionTool(stage: { id: string; type: SelectionToolType }): ChatCompletionTool {
	const names: Record<SelectionToolType, string> = {
		button: "select_buttons",
		card: "select_cards",
		target: "select_targets",
		control: "select_controls",
		number: "select_numbers",
	};
	const refsKey = `${stage.type}_refs`;
	return {
		type: "function",
		function: {
			name: names[stage.type],
			description: `完成 ${stage.type} 选择。step_id 必须为 ${stage.id}，只能使用当前候选中的短引用。`,
			parameters: object({ step_id: string(`当前步骤 ID：${stage.id}`), [refsKey]: array(`选择的 ${stage.type} 短引用数组`, { type: "string" }) }, ["step_id", refsKey]),
		},
	};
}

function passTool(description: string): ChatCompletionTool {
	return { type: "function", function: { name: "pass", description, parameters: object({}) } };
}

function boolTool(name: string, description: string): ChatCompletionTool {
	return { type: "function", function: { name, description, parameters: object({}) } };
}

function object(properties: Record<string, any>, required: string[] = []): any {
	return {
		type: "object",
		properties: {
			reason: { type: "string", description: "简要说明选择原因。", minLength: 1, maxLength: 200 },
			...properties,
		},
		required: ["reason", ...required],
		additionalProperties: false,
	};
}

function string(description: string): any {
	return { type: "string", description };
}

function strings(description: string): any {
	return array(description, { type: "string" });
}

function array(description: string, items: any): any {
	return { type: "array", items, description };
}
