const INSPECT_DISCARD_PILE_TOOL = "inspect_discard_pile";
const STATIC_PASS_DESCRIPTION = "放弃、跳过或取消当前可选操作（仅在非强制且本步允许时可调用）。";
function buildTools(decisionPoint, candidates, stage, forced = false, options) {
  const baseTools = buildBaseTools(decisionPoint, candidates, stage, forced);
  if (!baseTools.length) return [];
  if (options?.allowInspectDiscard) return [...baseTools, inspectDiscardTool()];
  return baseTools;
}
function resolveAllowedToolNames(decisionPoint, candidates, stage, forced = false, options) {
  return buildTools(decisionPoint, candidates, stage, forced, options).map((tool) => tool.type === "function" ? tool.function?.name : void 0).filter((name) => typeof name === "string" && name.length > 0);
}
function formatAllowedToolsLine(toolNames) {
  return toolNames.length ? `## 本步允许工具：${toolNames.join(", ")}` : "";
}
function buildBaseTools(decisionPoint, candidates, stage, forced = false) {
  if (stage) return optionalPass([buildSelectionTool(stage.type)], forced, STATIC_PASS_DESCRIPTION);
  switch (decisionPoint) {
    case "chooseToUse":
      return buildChooseToUseTools(candidates, forced);
    case "chooseToRespond":
      return optionalPass([cardTool("respond_card", "使用一张候选牌响应。", false), ...candidates.skills.length ? [skillTool()] : []], forced, STATIC_PASS_DESCRIPTION);
    case "chooseToDiscard":
      return optionalPass([cardsTool("discard_cards", "弃置候选牌；数量必须满足当前弃牌要求。")], forced, STATIC_PASS_DESCRIPTION);
    case "chooseBool":
      return [boolTool("yes", "选择“是”。"), boolTool("no", "选择“否”。")];
    default:
      return [];
  }
}
function buildChooseToUseTools(candidates, forced) {
  const tools = [cardTool("use_card", "使用一张候选牌。", true)];
  if (candidates.skills.length) {
    tools.splice(1, 0, skillTool());
  }
  if (!forced) tools.push(passTool(STATIC_PASS_DESCRIPTION));
  return tools;
}
function skillTool() {
  return {
    type: "function",
    function: {
      name: "use_skill",
      description: "发动候选主动技能。需要选牌或目标时，先传 skill_name，随后严格按下一轮选择工具完成。",
      parameters: object(
        {
          skill_name: string("候选技能 ID"),
          card_refs: strings("可选：已选卡牌短引用 c0/c1"),
          target_refs: strings("可选：已选目标短引用 p0/p1")
        },
        ["skill_name"]
      )
    }
  };
}
function optionalPass(tools, forced, description) {
  if (!forced) tools.push(passTool(description));
  return tools;
}
function cardTool(name, description, withTargets) {
  const properties = {
    card_ref: string("候选卡牌短引用，例如 c0")
  };
  if (withTargets) {
    properties.target_refs = strings("目标短引用，例如 p0；无目标传 []");
  }
  return { type: "function", function: { name, description, parameters: object(properties) } };
}
function cardsTool(name, description) {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: object({ card_refs: strings("候选卡牌短引用数组") })
    }
  };
}
function buildSelectionTool(type) {
  if (type === "move")
    return {
      type: "function",
      function: {
        name: "move_cards",
        description: "一次提交所有分堆和牌序，每张 m 引用恰好出现一次。",
        parameters: object({ piles: { type: "array", items: { type: "array", items: { type: "string" } }, description: "按堆编号提交，每堆按从左到右的牌序排列" } }, ["piles"])
      }
    };
  const names = {
    button: "select_buttons",
    card: "select_cards",
    target: "select_targets",
    control: "select_controls",
    number: "select_numbers"
  };
  const refsKey = `${type}_refs`;
  return {
    type: "function",
    function: {
      name: names[type],
      description: `完成 ${type} 选择；step_id 必须严格填写当前选择步骤给出的 step_id，只能使用当前候选中的短引用。`,
      parameters: object({ step_id: string("当前选择步骤给出的 step_id"), [refsKey]: array(`选择的 ${type} 短引用数组`, { type: "string" }) }, ["step_id", refsKey])
    }
  };
}
function passTool(description) {
  return { type: "function", function: { name: "pass", description, parameters: object({}) } };
}
function boolTool(name, description) {
  return { type: "function", function: { name, description, parameters: object({}) } };
}
function inspectDiscardTool() {
  return {
    type: "function",
    function: {
      name: INSPECT_DISCARD_PILE_TOOL,
      description: "查看当前弃牌堆全部卡牌明细（花色、点数、入堆先后顺序）及按花色和牌名的数量统计。单次决策最多调用 1 次，不消耗动作步数。",
      parameters: object({})
    }
  };
}
const STATIC_DECISION_TOOLS = Object.freeze([
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
  buildSelectionTool("move")
]);
const STATIC_DECISION_TOOL_NAMES = Object.freeze(
  STATIC_DECISION_TOOLS.map((tool) => tool.type === "function" ? tool.function.name : "")
);
function object(properties, required = []) {
  return {
    type: "object",
    properties: {
      reason: { type: "string", description: "简要说明选择原因。", minLength: 1, maxLength: 200 },
      ...properties
    },
    required: ["reason", ...required],
    additionalProperties: false
  };
}
function string(description) {
  return { type: "string", description };
}
function strings(description) {
  return array(description, { type: "string" });
}
function array(description, items) {
  return { type: "array", items, description };
}
export {
  INSPECT_DISCARD_PILE_TOOL,
  STATIC_DECISION_TOOLS,
  STATIC_DECISION_TOOL_NAMES,
  buildTools,
  formatAllowedToolsLine,
  resolveAllowedToolNames
};
