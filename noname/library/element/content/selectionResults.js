import "../../../../noname.js";
import "../../../llm/index.js";
import { isSelectionResultObject as isSelectionResultObject$1, normalizeSelectionResult as normalizeSelectionResult$1 } from "../GameEvent/resultBoundary.js";
import { lib } from "../../index.js";
import { tryLLMDecide } from "../../../llm/decide.js";
import { game } from "../../../game/index.js";
import { get } from "../../../get/binding.js";
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const selectionResultRuntime = {
  isCard(value) {
    return value instanceof lib.element.Card;
  },
  isPlayer(value) {
    return value instanceof lib.element.Player;
  },
  isVCard(value) {
    return value instanceof lib.element.VCard;
  },
  isSelectableButton(value) {
    return typeof HTMLDivElement !== "undefined" && value instanceof HTMLDivElement;
  }
};
function isAIResult(value) {
  return value == "ai";
}
function isSelectionResultObject(value) {
  return isSelectionResultObject$1(value, selectionResultRuntime);
}
function normalizeSelectionResult(value) {
  return normalizeSelectionResult$1(value, selectionResultRuntime);
}
function isCardLinks(value) {
  return Array.isArray(value) && value.every((link) => link instanceof lib.element.Card);
}
function isVCardLinks(value) {
  return Array.isArray(value) && value.every((link) => link instanceof lib.element.VCard);
}
function isCardMatrix(value) {
  return Array.isArray(value) && value.every(isCardLinks);
}
function normalizeChooseButtonTargetResult(value) {
  const result = normalizeSelectionResult(value);
  if (typeof result !== "string" && Array.isArray(result.targets) && !result.targets.every((target) => target instanceof lib.element.Player)) {
    return "cancelled";
  }
  return result;
}
async function applyLLMDecision(event) {
  const decision = await tryLLMDecide(event);
  if (!decision?.handled || !decision.result) {
    return false;
  }
  event.result = decision.result;
  game.uncheck();
  return true;
}
function attachChooseButtonSelectionSpec(next, skill, event, player) {
  const chooseButton = skill.chooseButton;
  if (chooseButton.selectionSpec === false || skill.selectionSpec === false) {
    next.set("selectionSpec", false);
    return;
  }
  if (typeof chooseButton.filterOk !== "function") {
    next.set("selectionSpec", { finalPredicate: () => true });
    return;
  }
  const rawSpec = chooseButton.selectionSpec ?? skill.selectionSpec;
  const source = rawSpec === true ? void 0 : typeof rawSpec === "function" ? rawSpec(event, player) : rawSpec;
  if (source && typeof source.finalPredicate === "function") {
    next.set("selectionSpec", { finalPredicate: source.finalPredicate });
  }
}
function useTargetSelectionSpec(event, player) {
  const card = event._get_card ?? event.card;
  const info = get.info(card);
  if (event.complexTarget || event.filterAddedTarget || info?.complexTarget || info?.complexSelect || info?.filterAddedTarget || info?.changeTarget) throw new Error("chooseUseTarget requires a reviewed complex-target contract");
  return {
    steps: [
      {
        type: "target",
        select: () => event.selectTarget === lib.filter.selectTarget ? lib.filter.selectTarget(card, player) : get.select(event.selectTarget),
        filter: (target) => event.getTargets().includes(target) && (event.nodistance || lib.filter.targetInRange(card, player, target)) && !!lib.filter.targetEnabledx(card, player, target)
      }
    ]
  };
}
export {
  applyLLMDecision,
  attachChooseButtonSelectionSpec,
  isAIResult,
  isCardLinks,
  isCardMatrix,
  isRecord,
  isSelectionResultObject,
  isVCardLinks,
  normalizeChooseButtonTargetResult,
  normalizeSelectionResult,
  selectionResultRuntime,
  useTargetSelectionSpec
};
