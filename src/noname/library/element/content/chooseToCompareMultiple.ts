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

export const chooseToCompareMultipleContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
	chooseToCompareMultiple: [
		async (event, trigger, player) => {
			const targets = event.getTargets();
			const fixedResultFor = (current: Player): Card | undefined => {
				const playerid = current.playerid;
				return playerid === undefined ? undefined : event.fixedResult?.[playerid];
			};
			if (!fixedResultFor(player) && player.countCards("h") == 0) {
				event.result = { cancelled: true, bool: false };
				event.finish();
				return;
			}
			for (const target of targets) {
				if (!fixedResultFor(target) && target.countCards("h") == 0) {
					event.result = { cancelled: true, bool: false };
					event.finish();
					return;
				}
			}
			if (!event.multitarget) {
				targets.sort(lib.sort.seat);
			}
			game.log(player, "对", targets, "发起拼点");
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
			const isCompareResult = (value: Partial<Result>): value is CompareResult => Array.isArray(value.cards) && value.cards.length > 0 && (value.skill === undefined || typeof value.skill == "string");
			if (!Array.isArray(result) || !result.every(isCompareResult) || result.length < event.list.length) {
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
			event.result = {
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
			game.log(player, "的拼点牌为", event.card1);
			player.showCards(event.card1).set("triggeronly", true);
		},
		async (event, trigger, player) => {
			const targets = event.getTargets();
			if (event.iwhile < targets.length) {
				event.target = targets[event.iwhile];
				event.target.addTempClass("target");
				player.addTempClass("target");
				event.card2 = event.cardlist[event.iwhile];
				event.num2 = event.getNum(event.card2);
				game.log(event.target, "的拼点牌为", event.card2);
				player.line(event.target);
				player.$compare(event.card1, event.target, event.card2);
				event.target.showCards(event.card2).set("triggeronly", true);
			} else {
				event.goto(12);
			}
		},
		async (event, trigger, player) => {
			await game.delay(0, lib.config.game_speed == "vvfast" ? 4000 : 1500);
			await event.trigger("compare");
		},
		async (event, trigger, player) => {
			event.iiwhile = event.iwhile;
			delete event.iwhile;
			event.trigger("compareFixing");
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			const target = event.getTarget();
			event.result.num1[event.iiwhile] = event.num1;
			event.result.num2[event.iiwhile] = event.num2;
			if (event.forceWinner === player || (event.forceWinner !== target && event.num1 > event.num2)) {
				event.winner = player;
				event.str = `${get.translation(player)}拼点成功`;
				player.popup("胜");
				target.popup("负");
			} else {
				event.str = `${get.translation(player)}拼点失败`;
				if (event.forceWinner !== target && event.num1 == event.num2) {
					player.popup("平");
					target.popup("平");
				} else {
					event.winner = target;
					player.popup("负");
					target.popup("胜");
				}
			}
		},
		async (event, trigger, player) => {
			game.broadcastAll(str => {
				const dialog = ui.create.dialog(str);
				dialog.classList.add("center");
				setTimeout(() => dialog.close(), 1000);
			}, event.str);
			game.delay(2);
		},
		async (event, trigger, player) => {
			if (event.callback) {
				game.broadcastAll(
					(card1, card2) => {
						if (card1.clone) {
							card1.clone.style.opacity = 0.5;
						}
						if (card2.clone) {
							card2.clone.style.opacity = 0.5;
						}
					},
					event.card1,
					event.card2
				);
				const next = game.createEvent("compareMultiple");
				next.player = player;
				next.target = event.target;
				next.card1 = event.card1;
				next.card2 = event.card2;
				next.num1 = event.num1;
				next.num2 = event.num2;
				next.winner = event.winner;
				next.setContent(event.callback);
				event.compareMultiple = true;
			}
		},
		async (event, trigger, player) => {
			game.broadcastAll(ui.clear);
			delete event.winner;
			delete event.forceWinner;
			event.iwhile = event.iiwhile + 1;
			event.goto(5);
		},
		async (event, trigger, player) => {
			event.cards.add(event.card1);
		},
	],
};
