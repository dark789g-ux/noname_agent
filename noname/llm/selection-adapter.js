import { evalFilterTargetValue } from "./generic-skill-plan.js";
import { matchesSelectionFilter } from "./selection-filter.js";
function resolveSelectionSpec(selectionSpec, event, player) {
  const value = typeof selectionSpec === "function" ? selectionSpec(event, player) : selectionSpec;
  if (value === true) return {};
  if (value && typeof value === "object") return value;
  return void 0;
}
function deriveSimpleSteps(info) {
  const steps = [];
  if (info.selectCard !== void 0 || info.filterCard || info.viewAs) steps.push({ type: "card" });
  if (info.selectTarget !== void 0 || info.filterTarget) steps.push({ type: "target" });
  return steps;
}
function normalizeRange(select) {
  if (typeof select === "number") return [select, select];
  if (Array.isArray(select) && typeof select[0] === "number" && typeof select[1] === "number") return [select[0], select[1]];
  return [1, 1];
}
function numberOptions(item) {
  if (Array.isArray(item)) {
    if (["asc", "sort"].includes(item[0])) return item.slice(1).sort((left, right) => left - right);
    if (item[0] === "desc") return item.slice(1).sort((left, right) => right - left);
    return item.filter((value) => typeof value === "number");
  }
  if (!item || typeof item !== "object") return [];
  const min = Number(item.min || 0);
  const max = Number(item.max ?? 9);
  const base = Number(item.base || 1);
  const values = [];
  for (let value = min; value <= max; value += base) values.push(value);
  return values;
}
function dialogButtons(event) {
  const buttons = event.dialog?.buttons;
  if (!Array.isArray(buttons) || !buttons.length || buttons.some((button) => !("link" in button))) fail("unsupported chooseButton: dialog buttons are unavailable");
  return buttons;
}
function numberStepDefinitions(event, selectedNumbers) {
  if (!Array.isArray(event.list) || !event.list.length) return [];
  return event.list.map((item, index) => ({
    id: `number:${index}`,
    type: "number",
    select: 1,
    items: numberOptions(item),
    filter: (value) => event.filterSelect?.(value, index, { ...event, numbers: selectedNumbers() }) !== false
  }));
}
function directSelectionDefinition(event, eventSpec, callbacks) {
  if (event?.selectionSpec === false) return void 0;
  const player = event.player;
  const cardMode = event.complexSelect || event.complexCard ? "sequential" : void 0;
  const targetMode = event.complexSelect || event.complexTarget ? "sequential" : void 0;
  const isSingleSelect = (select) => {
    if (typeof select === "function") return false;
    const range = normalizeRange(select);
    return range[0] === 1 && range[1] === 1;
  };
  const card = {
    type: "card",
    selectionMode: cardMode,
    select: event.selectCard,
    required: event.cardRequired ? true : void 0,
    filter: (value) => callbacks.isCardOwned(value) && matchesSelectionFilter(event.filterCard, value, player, event, callbacks.normalizeFilter, event)
  };
  const target = {
    type: "target",
    selectionMode: targetMode,
    select: event.selectTarget,
    required: event.targetRequired ? true : void 0,
    filter: (value) => callbacks.isTargetCurrent(value) && evalFilterTargetValue(event.filterTarget, callbacks.selectedCard(), player, value)
  };
  let steps = eventSpec?.steps?.slice();
  if (!steps?.length)
    switch (event.name) {
      case "chooseCard":
        steps = [card];
        break;
      case "chooseTarget":
        steps = [target];
        break;
      case "chooseCardTarget": {
        const precheckCard = !cardMode && isSingleSelect(event.selectCard) && callbacks.hasLegalDirectTarget;
        steps = [precheckCard ? { ...card, filter: (value) => card.filter(value) && callbacks.hasLegalDirectTarget(value, "card") } : card, target];
        break;
      }
      case "chooseToGive":
        steps = [card];
        break;
      case "chooseButton":
        steps = [{ type: "button", selectionMode: event.complexSelect ? "sequential" : void 0, select: event.selectButton, items: dialogButtons(event), filter: (button) => event.filterButton?.(button, player) !== false }];
        break;
      case "choosePlayerCard":
      case "gainPlayerCard":
      case "discardPlayerCard":
        steps = [
          {
            type: "button",
            selectionMode: event.complexSelect ? "sequential" : void 0,
            select: event.selectButton,
            items: dialogButtons(event),
            filter: (button) => {
              const target2 = event.getTarget();
              const cards = event.name === "gainPlayerCard" ? target2.getGainableCards(player, event.position) : event.name === "discardPlayerCard" ? target2.getDiscardableCards(player, event.position) : target2.getCards(event.position);
              return callbacks.isTargetCurrent(target2) && cards.includes(button.link) && event.dialog.buttons.includes(button) && event.filterButton?.(button, player) !== false;
            }
          }
        ];
        break;
      case "chooseButtonTarget": {
        const precheckButton = !event.complexSelect && isSingleSelect(event.selectButton) && callbacks.hasLegalDirectTarget;
        steps = [
          {
            type: "button",
            selectionMode: event.complexSelect ? "sequential" : void 0,
            select: event.selectButton,
            items: dialogButtons(event),
            filter: (button) => event.filterButton?.(button, player) !== false && (!precheckButton || callbacks.hasLegalDirectTarget(button, "button"))
          },
          target
        ];
        break;
      }
      case "chooseControl":
        steps = [{ type: "control", select: 1, items: Array.isArray(event.controls) ? event.controls : [] }];
        break;
      case "chooseNumbers":
        return { kind: event.name, steps: numberStepDefinitions(event, callbacks.selectedNumbers), filterOk: () => event.filterOk?.({ ...event, numbers: callbacks.selectedNumbers() }) !== false };
      default:
        return void 0;
    }
  steps = (steps || []).map((step, index) => ({
    ...step,
    id: step.id || `direct:${event.name}:${step.type}:${index}`
  }));
  return { kind: event.name, steps };
}
function labelFor(value, translate) {
  if (value?.classList?.contains("blank")) return "未知牌（匿名引用）";
  if (value && typeof value === "object" && "link" in value) return labelFor(value.link, translate);
  try {
    const label = translate?.(value) || value?.name || String(value);
    return value && typeof value === "object" && typeof value.suit === "string" ? `${label} ${value.suit} ${value.number ?? ""}`.trim() : label;
  } catch {
    return String(value);
  }
}
function shortRefPrefix(type) {
  return { button: "b", card: "c", target: "p", control: "o", number: "n" }[type];
}
function fail(message) {
  const error = new Error(message);
  error.stage = "translate";
  throw error;
}
function actionResolution(message) {
  const error = new Error(message);
  error.stage = "translate/action-resolution";
  throw error;
}
function formatSelectionFailure(outcome, fallbackInspection) {
  const reason = outcome?.reason || outcome?.status || "invalid";
  if (reason === "unavailable" || reason === "duplicate") {
    const value = outcome?.value !== void 0 ? String(outcome.value) : "unknown";
    if (reason === "duplicate") return `selection: duplicate (${value} 重复选择)`;
    const entries = Array.isArray(fallbackInspection?.entries) ? fallbackInspection.entries : Array.isArray(outcome?.inspection?.entries) ? outcome.inspection.entries : [];
    const availableRefs = entries.filter((entry) => entry.available).map((entry) => entry.item);
    return `selection: unavailable (${value} 不可选；当前可选: ${availableRefs.length ? availableRefs.join(", ") : "无"})`;
  }
  if ((reason === "too_few" || reason === "too_many") && Array.isArray(outcome?.inspection?.range)) {
    const [min, max] = outcome.inspection.range;
    const actual = Array.isArray(outcome.inspection.selected) ? outcome.inspection.selected.length : Array.isArray(outcome.value) ? outcome.value.length : 0;
    return `selection: ${reason} (需选 ${min}..${max < 0 ? "不限" : String(max)} 项，实际 ${actual} 项)`;
  }
  return `selection: ${reason}`;
}
export {
  actionResolution,
  deriveSimpleSteps,
  dialogButtons,
  directSelectionDefinition,
  fail,
  formatSelectionFailure,
  labelFor,
  normalizeRange,
  numberOptions,
  numberStepDefinitions,
  resolveSelectionSpec,
  shortRefPrefix
};
