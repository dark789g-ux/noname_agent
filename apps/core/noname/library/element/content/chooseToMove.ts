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
import { isRecord, isAIResult, isSelectionResultObject, normalizeSelectionResult, isCardLinks, isVCardLinks, isCardMatrix, normalizeChooseButtonTargetResult, applyLLMDecision, attachChooseButtonSelectionSpec } from "./selectionResults.js";
import { showMoveDialog } from "./moveDialog.js";

export const chooseToMoveContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
	async chooseToMove(event, trigger, player) {
		if (event.chooseTime && _status.connectMode && !game.online) {
			event.time = lib.configOL.choose_timeout;
			game.broadcastAll(time => {
				lib.configOL.choose_timeout = time;
			}, event.chooseTime);
		}

		let result;
		if (event.isMine()) {
			result = await showMoveDialog(event);

			delete ui.selected.guanxing_button;
			delete ui.selected.guanxing_buttons;
		} else if (event.isOnline()) {
			result = normalizeSelectionResult(await event.sendAsync());
		} else {
			result = "ai";
			if (await applyLLMDecision(event)) result = event.result;
		}

		if (event.time) {
			game.broadcastAll(time => {
				lib.configOL.choose_timeout = time;
			}, event.time);
		}

		if ((!result || result == "ai" || (event.forced && !result.bool)) && event.processAI) {
			const moved = event.processAI(event.list);
			if (moved) {
				result = {
					bool: true,
					moved,
				};
			} else {
				result = { bool: false };
			}
		}

		event.result = result;
	},
};
