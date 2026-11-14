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

export const chooseToMove_newContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
	async chooseToMove_new(event, trigger, player) {
		//联机时间
		if (player.isUnderControl()) {
			game.swapPlayerAuto(player);
		}
		if (event.chooseTime && _status.connectMode && !game.online) {
			event.time = lib.configOL.choose_timeout;
			game.broadcastAll(time => {
				lib.configOL.choose_timeout = time;
			}, event.chooseTime);
		}

		let result: EventResult | null;
		if (event.isMine()) {
			const { promise, resolve } = Promise.withResolvers<EventResult>();
			const animationDuration = lib.config.animation_choose_to_move ? 300 : 0;
			//自动选择
			event.switchToAuto = () => {
				if (!event.filterOk(event.moved)) {
					if (!event.forced) {
						event._result = { bool: false };
					} else {
						event._result = "ai";
					}
				} else {
					event._result = {
						bool: true,
						moved: event.moved,
					};
				}
				event.dialog.close();
				if (ui.confirm) {
					ui.confirm.close();
				}
				game.resume();
				_status.imchoosing = false;
				setTimeout(() => {
					ui.arena.classList.remove("choose-to-move");
				}, 500);
				resolve(normalizeSelectionResult(event._result));
			};
			//创造dialog
			event.dialog = ui.create.dialog();
			event.dialog.addNewRow(event.prompt || "请选择要操作的牌");
			event.dialog.selectedCard = null;
			event.dialog.isBusy = false;
			event.dialog.classList.add("scroll1");
			event.dialog.classList.add("scroll2");
			event.dialog.classList.add("fullwidth");
			if (get.is.phoneLayout() || event.list.length > 2) {
				ui.arena.classList.add("choose-to-move");
				event.dialog.classList.add("fullheight");
			}
			//刷新，确认是否返回结果
			function updateButtons() {
				event.moved = Array.from({
					length: event.list.slice().reduce((sum, currentList) => {
						if (!Array.isArray(currentList[0])) {
							currentList = [currentList];
						}
						return (sum += currentList.length);
					}, 0),
				}).map((_, i) => {
					const num = 2 * (i + 1);
					const container = event.dialog.itemContainers[num];
					if (!(container instanceof HTMLDivElement)) {
						throw new TypeError("Move dialog item container is not initialized");
					}
					return Array.from(container.children).map(child => ("link" in child ? child.link : undefined));
				});
				if (event.filterOk(event.moved)) {
					ui.create.confirm("o");
				} else {
					if (!event.forced) {
						ui.create.confirm("c");
					} else if (ui.confirm) {
						ui.confirm.close();
					}
				}
			}
			//点击每个卡的事件
			function clickItem(card, container, allContainers) {
				if (event.dialog.isBusy) {
					return;
				}
				if (event.dialog.selectedCard) {
					if (card !== event.dialog.selectedCard && event.filterMove(event.dialog.selectedCard, card, event.moved)) {
						event.dialog.isBusy = true;
						game.$swapElement(card, event.dialog.selectedCard, animationDuration).then(() => {
							event.dialog.isBusy = false;
							updateButtons();
						});
					}
					event.dialog.selectedCard.classList.remove("selected");
					event.dialog.selectedCard = null;
				} else {
					event.dialog.selectedCard = card;
					card.classList.add("selected");
				}
			}
			//点击容器的事件回调
			function clickItemContainer(itemContainer, i, allContainers) {
				if (event.dialog.isBusy || !event.dialog.selectedCard) {
					return;
				}
				if (itemContainer.contains(event.dialog.selectedCard)) {
					return;
				}
				const index = Array.from(event.dialog.itemContainers).indexOf(itemContainer) / 2 - 1;
				if (event.filterMove(event.dialog.selectedCard, index, event.moved)) {
					event.dialog.isBusy = true;
					game.$elementGoto(event.dialog.selectedCard, itemContainer, undefined, animationDuration).then(() => {
						event.dialog.isBusy = false;
						updateButtons();
					});
				}
				event.dialog.selectedCard.classList.remove("selected");
				event.dialog.selectedCard = null;
			}
			//框的部分属性
			const itemContainerCss = event.itemContainerCss || {
				justifyContent: "center",
				minHeight: "100px",
			};
			for (const item of event.list) {
				let currentList = item.slice();
				if (!Array.isArray(currentList[0])) {
					currentList = [currentList];
				}
				event.dialog.addNewRow(
					...currentList
						.slice()
						.map(listx => [{ item: listx[0], ratio: 1 }, listx[1]?.length ? { item: listx[1], ratio: 6 / currentList.length, itemContainerCss, clickItem, clickItemContainer } : { item: listx[1], ratio: 6 / currentList.length, itemContainerCss, clickItemContainer }])
						.flat()
				);
			}
			event.dialog.open();
			updateButtons();
			//获取结果
			event.custom.replace.confirm = bool => {
				let result;
				if (bool) {
					result = {
						bool: true,
						moved: event.moved,
					};
				} else {
					result = { bool: false };
				}
				event.dialog.close();
				if (ui.confirm) {
					ui.confirm.close();
				}
				_status.imchoosing = false;
				setTimeout(() => {
					ui.arena.classList.remove("choose-to-move");
				}, 500);
				resolve(result);
			};
			//开搞
			game.countChoose();
			event.choosing = true;
			result = await promise;
		} else if (event.isOnline()) {
			const remoteResult = await event.sendAsync();
			result = normalizeSelectionResult(remoteResult);
		} else {
			result = "ai";
			if (await applyLLMDecision(event)) result = normalizeSelectionResult(event.result);
		}
		//时间限制
		if (event.time) {
			game.broadcastAll(time => {
				lib.configOL.choose_timeout = time;
			}, event.time);
		}
		//结果获取
		const resultBool = typeof result == "string" ? undefined : result?.bool;
		if ((!result || result == "ai" || (event.forced && !resultBool)) && event.processAI) {
			const moved = event.processAI(event.list);
			if (moved) {
				result = {
					bool: true,
					moved: moved,
				};
			} else {
				result = { bool: false };
			}
		}
		event.result = result ?? "cancelled";
	},
};
