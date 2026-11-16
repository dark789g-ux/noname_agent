import type { ChatCompletionTool } from "openai/resources/chat/completions.js";
import type { CandidateCard } from "./candidates.js";

export type SelectionToolType = "button" | "card" | "target" | "control" | "number" | "move";

export const INSPECT_DISCARD_PILE_TOOL = "inspect_discard_pile";

export interface BuildToolsOptions {
	allowInspectDiscard?: boolean;
}

const STATIC_PASS_DESCRIPTION = "放弃、跳过或取消当前可选操作（仅在非强制且本步允许时可调用）。";

/** 构造当前选择阶段可调用的工具（用于计算本步允许工具及兼容单测）。 */
export function buildTools(decisionPoint: string, candidates: { cards: CandidateCard[]; skills: string[] }, stage?: { id: string; type: SelectionToolType }, forced = false, options?: BuildToolsOptions): ChatCompletionTool[] {
	const baseTools = buildBaseTools(decisionPoint, candidates, stage, forced);
	if (!baseTools.length) return [];
	if (options?.allowInspectDiscard) return [...baseTools, inspectDiscardTool()];
	return baseTools;
}

/** 解析当前决策步骤真正允许调用的工具名列表。 */
export function resolveAllowedToolNames(decisionPoint: string, candidates: { cards: CandidateCard[]; skills: string[] }, stage?: { id: string; type: SelectionToolType }, forced = false, options?: BuildToolsOptions): string[] {
	return buildTools(decisionPoint, candidates, stage, forced, options)
		.map(tool => (tool.type === "function" ? tool.function?.name : undefined))
		.filter((name): name is string => typeof name === "string" && name.length > 0);
}

/** 格式化单步允许工具提示行。 */
export function formatAllowedToolsLine(toolNames: readonly string[]): string {
	return toolNames.length ? `## 本步允许工具：${toolNames.join(", ")}` : "";
}

function buildBaseTools(decisionPoint: string, candidates: { cards: CandidateCard[]; skills: string[] }, stage?: { id: string; type: SelectionToolType }, forced = false): ChatCompletionTool[] {
	if (stage) return optionalPass([buildSelectionTool(stage.type)], forced, STATIC_PASS_DESCRIPTION);
	switch (decisionPoint) {
		case "chooseToUse":
			return buildChooseToUseTools(candidates, forced);
		case "chooseToRespond":
			return optionalPass([cardTool("respond_card", "使用一张候选牌响应。", false), ...(candidates.skills.length ? [skillTool()] : [])], forced, STATIC_PASS_DESCRIPTION);
		case "chooseToDiscard":
			return optionalPass([cardsTool("discard_cards", "弃置候选牌；数量必须满足当前弃牌要求。")], forced, STATIC_PASS_DESCRIPTION);
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
	if (!forced) tools.push(passTool(STATIC_PASS_DESCRIPTION));
	return tools;
}

function skillTool(): ChatCompletionTool {
	return {
		type: "function",
		function: {
			name: "use_skill",
			description: "发动候选主动技能。需要选牌或目标时，先传 skill_name，随后严格按下一轮选择工具完成。",
			parameters: object(
				{
					skill_name: string("候选技能 ID"),
					card_refs: strings("可选：已选卡牌短引用 c0/c1"),
					target_refs: strings("可选：已选目标短引用 p0/p1"),
				},
				["skill_name"]
			),
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
	};
	if (withTargets) {
		properties.target_refs = strings("目标短引用，例如 p0；无目标传 []");
	}
	return { type: "function", function: { name, description, parameters: object(properties) } };
}

function cardsTool(name: string, description: string): ChatCompletionTool {
	return {
		type: "function",
		function: {
			name,
			description,
			parameters: object({ card_refs: strings("候选卡牌短引用数组") }),
		},
	};
}

function buildSelectionTool(type: SelectionToolType): ChatCompletionTool {
	if (type === "move")
		return {
			type: "function",
			function: {
				name: "move_cards",
				description: "一次提交所有分堆和牌序，每张 m 引用恰好出现一次。",
				parameters: object({ piles: { type: "array", items: { type: "array", items: { type: "string" } }, description: "按堆编号提交，每堆按从左到右的牌序排列" } }, ["piles"]),
			},
		};
	const names: Record<Exclude<SelectionToolType, "move">, string> = {
		button: "select_buttons",
		card: "select_cards",
		target: "select_targets",
		control: "select_controls",
		number: "select_numbers",
	};
	const refsKey = `${type}_refs`;
	return {
		type: "function",
		function: {
			name: names[type],
			description: `完成 ${type} 选择；step_id 必须严格填写当前选择步骤给出的 step_id，只能使用当前候选中的短引用。`,
			parameters: object({ step_id: string("当前选择步骤给出的 step_id"), [refsKey]: array(`选择的 ${type} 短引用数组`, { type: "string" }) }, ["step_id", refsKey]),
		},
	};
}

function passTool(description: string): ChatCompletionTool {
	return { type: "function", function: { name: "pass", description, parameters: object({}) } };
}

function boolTool(name: string, description: string): ChatCompletionTool {
	return { type: "function", function: { name, description, parameters: object({}) } };
}

function inspectDiscardTool(): ChatCompletionTool {
	return {
		type: "function",
		function: {
			name: INSPECT_DISCARD_PILE_TOOL,
			description: "查看当前弃牌堆全部卡牌明细（花色、点数、入堆先后顺序）及按花色和牌名的数量统计。单次决策最多调用 1 次，不消耗动作步数。",
			parameters: object({}),
		},
	};
}

/** 供 OpenAI Prefix Cache 与常驻 CLI 系统手册复用的全量 14 工具不可变定义。 */
export const STATIC_DECISION_TOOLS: readonly ChatCompletionTool[] = Object.freeze([
	cardTool("use_card", "使用一张候选牌。", true),
	cardTool("respond_card", "使用一张候选牌响应。", false),
	cardsTool("discard_cards", "弃置候选牌；数量必须满足当前弃牌要求。"),
	skillTool(),
	passTool(STATIC_PASS_DESCRIPTION),
	boolTool("yes", "选择“是”。"),
	boolTool("no", "选择“否”。"),
	inspectDiscardTool(),
	buildSelectionTool("button"),
	buildSelectionTool("card"),
	buildSelectionTool("target"),
	buildSelectionTool("control"),
	buildSelectionTool("number"),
	buildSelectionTool("move"),
]);

/** 全量静态决策工具名称列表（与 STATIC_DECISION_TOOLS 顺序一致）。 */
export const STATIC_DECISION_TOOL_NAMES: readonly string[] = Object.freeze(
	STATIC_DECISION_TOOLS.map(tool => (tool.type === "function" ? tool.function.name : ""))
);

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
