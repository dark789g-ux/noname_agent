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

export const chooseToCompareMeanwhileContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
	chooseToCompareMeanwhile: [
		async (event, trigger, player) => {
			const targets = event.getTargets();
			const fixedResultFor = (current: Player): Card | undefined => {
				const playerid = current.playerid;
				return playerid === undefined ? undefined : event.fixedResult?.[playerid];
			};
			if (player.countCards("h") == 0 && !fixedResultFor(player)) {
				event.result = { cancelled: true, bool: false };
				event.finish();
				return;
			}
			for (const target of targets) {
				if (target.countCards("h") == 0 && !fixedResultFor(target)) {
					event.result = { cancelled: true, bool: false };
					event.finish();
					return;
				}
			}
			if (!event.multitarget) {
				targets.sort(lib.sort.seat);
			}
			game.log(player, "对", targets, "发起了共同拼点");
			event.compareMeanwhile = true;
			event.filterCard ??= lib.filter.all;
		},
		async (event, trigger, player) => {
			const targets = event.getTargets();
			const fixedResultFor = (current: Player): Card | undefined => {
				const playerid = current.playerid;
				return playerid === undefined ? undefined : event.fixedResult?.[playerid];
			};
			event._result = [];
			event.list = targets.filter(current => !fixedResultFor(current));
			if (event.list.length || !fixedResultFor(player)) {
				if (!fixedResultFor(player)) {
					event.list.unshift(player);
				}
				player.chooseCardOL(event.list, "请选择拼点牌", true).set("filterCard", event.filterCard).set("type", "compare").set("ai", event.ai).set("source", player).aiCard = target => {
					const hs = target.getCards("h");
					const event: GameEvent = _status.event;
					event.player = target;
					const compareAi = event.ai;
					if (typeof compareAi == "function") {
						hs.sort((a, b) => compareAi(b) - compareAi(a));
					}
					delete event.player;
					return { bool: true, cards: [hs[0]] };
				};
			}
		},
		async (event, trigger, player, result: Partial<Result> | Partial<Result>[]) => {
			type CompareResult = Pick<Partial<Result>, "bool" | "skill"> & { cards: Card[] };
			const isCompareResult = (value: Partial<Result>): value is CompareResult => Array.isArray(value.cards) && (value.skill === undefined || typeof value.skill == "string");
			if (!Array.isArray(result) || !result.every(isCompareResult)) {
				return;
			}
			const cards: Card[] = [];
			const lose_list: [Player, Card[]][] = [];
			const fixedResultFor = (current: Player): Card | undefined => {
				const playerid = current.playerid;
				return playerid === undefined ? undefined : event.fixedResult?.[playerid];
			};
			const playerFixedCard = fixedResultFor(player);
			if (playerFixedCard) {
				event.list.unshift(player);
				result.unshift({ bool: true, cards: [playerFixedCard] });
				lose_list.push([player, [playerFixedCard]]);
			} else {
				const skill = result[0].skill;
				const onCompare = skill ? getRegisteredSkill(lib.skill, skill)?.onCompare : undefined;
				if (skill !== undefined && typeof onCompare == "function") {
					player.logSkill(skill);
					result[0].cards = onCompare(player);
				} else {
					lose_list.push([player, result[0].cards]);
				}
			}
			const targets = event.getTargets();
			for (const target of targets) {
				if (event.list.includes(target)) {
					const i = event.list.indexOf(target);
					const skill = result[i].skill;
					const onCompare = skill ? getRegisteredSkill(lib.skill, skill)?.onCompare : undefined;
					if (skill !== undefined && typeof onCompare == "function") {
						event.list[i].logSkill(skill);
						result[i].cards = onCompare(event.list[i]);
					} else {
						lose_list.push([target, result[i].cards]);
					}
					cards.push(result[i].cards[0]);
				} else {
					const fixedCard = fixedResultFor(target);
					if (fixedCard) {
						cards.push(fixedCard);
						lose_list.push([target, [fixedCard]]);
					}
				}
			}
			if (lose_list.length) {
				game.loseAsync({
					lose_list: lose_list,
				}).setContent("chooseToCompareLose");
			}
			event.lose_list = lose_list;
			event.getNum = card => {
				for (const i of event.lose_list) {
					if (i[1].includes && i[1].includes(card)) {
						return get.number(card, i[0]);
					}
				}
				return get.number(card, false);
			};
			event.cardlist = cards;
			event.cards = cards;
			event.card1 = result[0].cards[0];
			event.num1 = event.getNum(event.card1);
			event.iwhile = 0;
			event.winner = null;
			event.maxNum = -1;
			event.tempplayer = event.player;
			event.result = {
				winner: null,
				player: event.card1,
				targets: event.cardlist.slice(0),
				num1: [],
				num2: [],
			};
		},
		async (event, trigger, player) => {
			event.trigger("compareCardShowBefore");
		},
		async (event, trigger, player) => {
			const { cards } = event;
			const targets = event.getTargets();
			player.$compareMultiple(event.card1, targets, cards);
			game.log(player, "的拼点牌为", event.card1);
			await player.showCards(event.card1).set("triggeronly", true);
			const func = async (card, index) => {
				game.log(targets[index], "的拼点牌为", card);
				await targets[index].showCards(card).set("triggeronly", true);
			};
			await game.doAsyncInOrder(event.cardlist, func, () => 1);
			player.addTempClass("target");
			game.delay(0, lib.config.game_speed == "vvfast" ? 4000 : 1000);
		},
		async (event, trigger, player) => {
			event.target = null;
			event.trigger("compare");
		},
		async (event: GameEvent, trigger, player) => {
			const targets = event.getTargets();
			if (event.iwhile < targets.length) {
				event.target = targets[event.iwhile];
				event.target.addTempClass("target");
				event.card2 = event.cardlist[event.iwhile];
				event.num2 = event.getNum(event.card2);
				delete event.player;
				event.trigger("compare");
			} else {
				event.iwhile = 0;
				game.delay(0, 1000);
				event.goto(9);
			}
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			event.result.num1[event.iwhile] = event.num1;
			event.result.num2[event.iwhile] = event.num2;
			const list = [
				[event.tempplayer, event.num1],
				[event.target, event.num2],
			];
			for (const i of list) {
				if (i[1] > event.maxNum) {
					event.maxNum = i[1];
					event.winner = i[0];
				} else if (event.winner && i[1] == event.maxNum && i[0] != event.winner) {
					event.winner = null;
				}
			}
		},
		async (event, trigger, player) => {
			event.iwhile++;
			event.goto(6);
		},
		async (event, trigger, player) => {
			event.player = event.tempplayer;
			event.trigger("compareFixing");
		},
		async (event: GameEvent, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			if (event.player) {
				delete event.player;
			}
			const targets = event.getTargets();
			if (event.iwhile < targets.length) {
				event.target = targets[event.iwhile];
				event.card2 = event.cardlist[event.iwhile];
				event.num2 = event.result.num2[event.iwhile];
				event.trigger("compareFixing");
			} else {
				event.goto(12);
			}
		},
		async (event, trigger, player) => {
			event.iwhile++;
			event.goto(10);
		},
		async (event, trigger) => {
			if (typeof event.result === "string") event.result = {};
			const targets = event.getTargets();
			const player = (event.player = event.tempplayer);
			delete event.tempplayer;
			event.str = "无人拼点成功";
			const winner = event.forceWinner || event.winner;
			if (winner) {
				event.result.winner = winner;
				event.str = `${get.translation(winner)}拼点成功`;
				game.log(winner, "拼点成功");
				winner.popup("胜");
			} else {
				game.log("#b无人", "拼点成功");
			}
			const list = [player].addArray(targets);
			list.remove(winner);
			for (const i of list) {
				i.popup("负");
			}
		},
		async (event, trigger, player) => {
			if (event.str) {
				game.broadcastAll(str => {
					const dialog = ui.create.dialog(str);
					dialog.classList.add("center");
					setTimeout(() => {
						dialog.close();
					}, 1000);
				}, event.str);
			}
			game.delay(3);
		},
		async (event, trigger, player) => {
			game.broadcastAll(ui.clear);
		},
		async (event, trigger, player) => {
			event.cards.add(event.card1);
		},
	],
};
