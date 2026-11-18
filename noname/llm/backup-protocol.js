import { assistantToolMessage } from "./protocol.js";
import { resolveBaseEvent, normalizeViewAsDefinition } from "./skill-backup-semantics.js";
function resolveCardTargetSelect(card, player, getCardInfo) {
  const info = getCardInfo(card) || {};
  if (info.notarget === true) return [0, 0];
  return typeof info.selectTarget === "function" ? info.selectTarget(card, player) : info.selectTarget ?? 1;
}
function targetRangeAllowsSelection(select) {
  if (typeof select === "number") return select !== 0;
  if (Array.isArray(select)) return select[1] !== 0;
  return true;
}
function mergeBackupSelectionSpecs(infoSpec, eventSpec) {
  return {
    ...infoSpec,
    ...eventSpec,
    steps: eventSpec?.steps ?? infoSpec?.steps,
    viewAs: eventSpec?.viewAs ?? infoSpec?.viewAs,
    finalPredicate: eventSpec?.finalPredicate ?? infoSpec?.finalPredicate
  };
}
function resolveViewAs(spec, info, cards, player) {
  const source = getViewAsSource(spec, info);
  return {
    source,
    definition: typeof source === "function" ? source(cards, player) : source
  };
}
function getViewAsSource(spec, info) {
  return spec?.viewAs ?? info?.viewAs;
}
function buildBackupStepDefinitions(event, info, spec, callbacks) {
  const baseEvent = resolveBaseEvent(event);
  const viewAs = getViewAsSource(spec, info);
  const hasViewAs = Boolean(viewAs);
  const cardSelect = info?.selectCard !== void 0 ? info.selectCard : hasViewAs ? baseEvent.selectCard ?? 1 : void 0;
  const cardMode = info?.complexCard || info?.complexSelect || hasViewAs && (baseEvent.complexCard || baseEvent.complexSelect) ? "sequential" : void 0;
  const targetMode = info?.complexTarget || info?.complexSelect || hasViewAs && (baseEvent.complexTarget || baseEvent.complexSelect) ? "sequential" : void 0;
  const initialTargetSelect = callbacks.deferTarget ? void 0 : callbacks.targetSelect();
  const targetSelect = () => callbacks.targetSelect();
  const steps = spec.steps?.map((step) => {
    if (step.type === "card") return { ...step, select: step.select ?? cardSelect, filter: step.filter ?? callbacks.cardFilter };
    if (step.type === "target") return { ...step, select: step.select ?? targetSelect, filter: step.filter ?? callbacks.targetFilter };
    return { ...step };
  }) ?? [];
  const hasCardRule = cardSelect !== void 0 || typeof info?.filterCard === "function" || info?.filterCard === true || hasViewAs && (typeof baseEvent.filterCard === "function" || baseEvent.filterCard === true || Boolean(viewAs));
  if (!steps.some((step) => step.type === "card") && hasCardRule) {
    steps.push({ id: `backup:${event.skill}:card`, type: "card", selectionMode: cardMode, select: cardSelect ?? 1, required: event.cardRequired ? true : void 0, filter: callbacks.cardFilter });
  }
  const hasOwnTargetRule = typeof info?.filterTarget === "function" || info?.filterTarget === true || info?.selectTarget !== void 0;
  const hasOuterTargetRule = hasViewAs && (typeof baseEvent.filterTarget === "function" || baseEvent.filterTarget === true || baseEvent.selectTarget !== void 0 || baseEvent.targetRequired);
  if ((event.name === "chooseToUse" || hasOwnTargetRule) && !steps.some((step) => step.type === "target") && targetRangeAllowsSelection(initialTargetSelect) && (hasOwnTargetRule || hasOuterTargetRule)) {
    if (info?.singleCard && typeof info?.filterAddedTarget === "function") {
      steps.push({ id: `backup:${event.skill}:target:0`, type: "target", selectionMode: targetMode, select: targetSelect, role: "primary", filter: callbacks.targetFilter, deferredFromCards: !!(viewAs || targetMode) });
      steps.push({ id: `backup:${event.skill}:target:1`, type: "target", select: 1, role: "added", addedTargetFilter: true, required: true });
    } else {
      steps.push({ id: `backup:${event.skill}:target`, type: "target", selectionMode: targetMode, select: targetSelect, required: event.targetRequired ? true : void 0, filter: callbacks.targetFilter, deferredFromCards: !!(viewAs || targetMode) });
    }
  }
  return steps;
}
function materializeViewAsResult(skill, definition, cards, targets, createCard) {
  const normalized = normalizeViewAsDefinition(definition);
  if (!normalized) return { bool: true, skill, cards, targets };
  const card = createCard(normalized, cards);
  if (!card) throw new Error(`backup ${skill} did not materialize a card`);
  return { bool: true, skill, card, cards, targets };
}
function describeDecisionStage(stage) {
  return `## 当前选择步骤
- step_id: ${stage.id}
- 类型: ${stage.type}
- 数量: ${stage.range[0]}..${stage.range[1]}
${stage.instruction || ""}
${stage.piles?.map((pile) => `堆 ${pile.index}: ${pile.title}`).join("\n") || ""}
- 候选:
${stage.items.map((item) => `  - ${item.ref}: ${item.label}`).join("\n")}`;
}
function appendPendingHistory(history, toolCall, pending) {
  history.push(assistantToolMessage(toolCall), { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ accepted: true, next_step: pending }) }, { role: "user", content: describeDecisionStage(pending) });
}
function appendRejectedHistory(history, toolCall, error, currentStage) {
  history.push(
    assistantToolMessage(toolCall),
    { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ accepted: false, error, retry_stage: currentStage ?? null }) },
    {
      role: "user",
      content: currentStage ? `上一步选择未通过规则校验（${error}）。请重新提交：
${describeDecisionStage(currentStage)}` : `上一步选择未通过规则校验（${error}）。请重新选择合法动作或 pass。`
    }
  );
}
function appendInspectDiscardHistory(history, toolCall, report, currentStage) {
  history.push(
    assistantToolMessage(toolCall),
    { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ accepted: true, discard_pile: report }) },
    {
      role: "user",
      content: currentStage ? `已返回当前弃牌堆明细。请继续完成当前选择步骤：
${describeDecisionStage(currentStage)}` : "已返回当前弃牌堆明细。请结合牌面与弃牌信息继续选择当前最优动作。"
    }
  );
}
export {
  appendInspectDiscardHistory,
  appendPendingHistory,
  appendRejectedHistory,
  buildBackupStepDefinitions,
  describeDecisionStage,
  getViewAsSource,
  materializeViewAsResult,
  mergeBackupSelectionSpecs,
  resolveCardTargetSelect,
  resolveViewAs,
  targetRangeAllowsSelection
};
