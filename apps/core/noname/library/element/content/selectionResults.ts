import { _status, game, get, lib, ui, ai } from "noname";
import { GameEvent, initializeEvent, type RawGameDrawEvent } from "../gameEvent.js";
import { Player } from "../player.js";
import type { LegacyChooseButtonCreateDialog } from "../Player/legacyParams";
import { delay } from "@/util/index.js";
import { tryLLMDecide } from "@/llm/index.js";
import { forwardEventLogSkill, getLogSkillName } from "../GameEvent/logSkill.js";
import { getButtonSubtypes } from "../GameEvent/buttonSubtypes.js";
import { isImportModePayload, isSelectionResultObject as isBoundarySelectionResultObject, normalizeSelectionResult as normalizeBoundarySelectionResult, type SelectionResultRuntime } from "../GameEvent/resultBoundary.js";
import { getRegisteredSkill, requireRegisteredSkill } from "../../skillRegistry.js";

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const selectionResultRuntime: SelectionResultRuntime = {
	isCard(value): value is Card {
		return value instanceof lib.element.Card;
	},
	isPlayer(value): value is Player {
		return value instanceof lib.element.Player;
	},
	isVCard(value): value is VCard {
		return value instanceof lib.element.VCard;
	},
	isSelectableButton(value): value is SelectableResultButton {
		return typeof HTMLDivElement !== "undefined" && value instanceof HTMLDivElement;
	},
};

export function isAIResult(value: GameEventResult): boolean {
	return value == "ai";
}

export function isSelectionResultObject(value: unknown): value is Partial<Result> {
	return isBoundarySelectionResultObject(value, selectionResultRuntime);
}

export function normalizeSelectionResult(value: unknown): EventResult {
	return normalizeBoundarySelectionResult(value, selectionResultRuntime);
}

export function isCardLinks(value: unknown): value is Card[] {
	return Array.isArray(value) && value.every(link => link instanceof lib.element.Card);
}

export function isVCardLinks(value: unknown): value is VCard[] {
	return Array.isArray(value) && value.every(link => link instanceof lib.element.VCard);
}

export function isCardMatrix(value: unknown): value is Card[][] {
	return Array.isArray(value) && value.every(isCardLinks);
}

export function normalizeChooseButtonTargetResult(value: unknown): EventResult {
	const result = normalizeSelectionResult(value);
	if (typeof result !== "string" && Array.isArray(result.targets) && !result.targets.every(target => target instanceof lib.element.Player)) {
		return "cancelled";
	}
	return result;
}

/**
 * Replace a local AI result only when LLM translation completed. Returning
 * false deliberately preserves event.result === "ai" for the legacy AI.
 */
export async function applyLLMDecision(event) {
	const decision = await tryLLMDecide(event);
	if (!decision?.handled || !decision.result) {
		return false;
	}
	event.result = decision.result;
	game.uncheck();
	return true;
}

/**
 * A child chooseButton owns an explicit headless final predicate only when its
 * UI filter is the default accept-all predicate or the skill supplied an
 * adapter. A legacy filterOk may read ui.selected, so omitting the contract
 * intentionally makes LLM validation fall back instead of accepting it.
 */
export function attachChooseButtonSelectionSpec(next, skill, event, player) {
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
	const source = rawSpec === true ? undefined : typeof rawSpec === "function" ? rawSpec(event, player) : rawSpec;
	if (source && typeof source.finalPredicate === "function") {
		next.set("selectionSpec", { finalPredicate: source.finalPredicate });
	}
}

/** Pure equivalent of chooseUseTarget's built-in target callback. */
export function useTargetSelectionSpec(event, player): SelectionSpec {
	const card = event._get_card ?? event.card;
	const info = get.info(card);
	if (event.complexTarget || event.filterAddedTarget || info?.complexTarget || info?.complexSelect || info?.filterAddedTarget || info?.changeTarget) throw new Error("chooseUseTarget requires a reviewed complex-target contract");
	return {
		steps: [
			{
				type: "target",
				select: () => (event.selectTarget === lib.filter.selectTarget ? lib.filter.selectTarget(card, player) : get.select(event.selectTarget)),
				filter: target => event.getTargets().includes(target) && (event.nodistance || lib.filter.targetInRange(card, player, target)) && !!lib.filter.targetEnabledx(card, player, target),
			},
		],
	};
}
