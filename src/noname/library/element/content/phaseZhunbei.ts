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

export const phaseZhunbeiContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
	async phaseZhunbei(event, trigger, player) {
		game.log(player, "进入了准备阶段");
		await event.trigger(event.name);
	},
	phaseJudge: [
		async (event, trigger, player) => {
			game.log(player, "进入了判定阶段");
			event.cards = player.getCards("j");
		},
		async (event, trigger, player) => {
			if (!event.cards.length) {
				event.finish();
				return;
			}
			const card = event.cards.shift();
			if (!card) {
				event.finish();
				return;
			}
			event.card = card;
			const cardName = card.name;
			const cardInfo = lib.card[cardName];
			const cardSymbol = card.cardSymbol;
			const VJudge = cardSymbol === undefined ? undefined : card[cardSymbol];
			if (cardInfo.noEffect || !player.getCards("j").includes(card)) {
				event.redo();
			} else {
				await player.lose(card, "visible", ui.ordering);
				player.$phaseJudge(card);
				event.cancelled = false;
				await event.trigger("phaseJudge");
				player.popup(cardName, "thunder");
				if (!cardInfo.effect) {
					await game.delay();
					event.redo();
				} else if (!cardInfo.judge) {
					await game.delay();
					event.nojudge = true;
				} else {
					event.nojudge = false;
				}
			}
		},
		async (event, trigger, player) => {
			if (!event.cancelled && !event.nojudge) {
				const card = event.card;
				if (!(card instanceof lib.element.Card)) {
					return;
				}
				event.result = await player.judge({ card }).set("type", "phase").forResult();
			}
		},
		async (event, trigger, player) => {
			const name = event.card.name;
			const cardSymbol = event.card.cardSymbol;
			const VJudge = cardSymbol === undefined ? undefined : event.card[cardSymbol];
			if (event.excluded) {
				delete event.excluded;
			} else if (event.cancelled && !event.direct) {
				if (lib.card[name].cancel) {
					const next = game.createEvent(`${name}Cancel`);
					next.setContent(lib.card[name].cancel);
					next.card = VJudge;
					next.cards = VJudge?.cards ?? [];
					next.player = player;
					await next;
				}
			} else {
				const next = game.createEvent(name);
				next.setContent(lib.card[name].effect);
				next._result = event.result;
				next.card = VJudge;
				next.cards = VJudge?.cards ?? [];
				next.player = player;
				await next;
			}
			ui.clear();
			event.goto(1);
		},
	],
	phaseDraw: [
		async event => {
			game.log(event.player, "进入了摸牌阶段");
			await event.trigger("phaseDrawBegin1");
		},
		async event => {
			await event.trigger("phaseDrawBegin2");
		},
		async (event, trigger, player) => {
			if (game.modPhaseDraw) {
				return game.modPhaseDraw(player, event.num);
			} else {
				const eventNum = Number(event.num);
				if (eventNum > 0) {
					let num = eventNum;

					if (event.attachDraw) {
						for (const card of event.attachDraw) {
							ui.cardPile.insertBefore(card, ui.cardPile.firstChild);
						}
						num += event.attachDraw.length;
					}

					const next = player.draw(num);
					if (event.attachDraw) {
						next.minnum = event.attachDraw.length;
					}
					return next.forResult();
				}
			}
		},
		async (event, trigger, player, result) => {
			if (result.bool && result.cards) {
				event.cards = result.cards;
			}
		},
	],
	phaseUse: [
		async (event, trigger, player) => {
			const stat = player.getStat();
			for (const skill in stat.skill) {
				let bool = false;
				const info = getRegisteredSkill(lib.skill, skill);
				if (!info) {
					continue;
				}
				if (info.enable != undefined) {
					if (typeof info.enable == "string" && info.enable == "phaseUse") {
						bool = true;
					} else if (typeof info.enable == "object" && info.enable.includes("phaseUse")) {
						bool = true;
					}
				}
				if (bool) {
					stat.skill[skill] = 0;
				}
			}
			for (const card in stat.card) {
				const bool = false;
				const info = lib.card[card];
				if (!info) {
					continue;
				}
				if (info.updateUsable == "phaseUse") {
					stat.card[card] = 0;
				}
			}
		},
		async (event, trigger, player) => {
			await event.trigger("phaseUseBefore");
		},
		async (event, trigger, player) => {
			await event.trigger("phaseUseBegin");
		},
		async (event, trigger, player) => {
			if (!event.logged) {
				game.log(player, "进入了出牌阶段");
				event.logged = true;
			}
			const next = player.chooseToUse();
			if (!lib.config.show_phaseuse_prompt) {
				next.set("prompt", false);
			}
			next.set("type", "phase");
			return next.forResult();
		},
		async (event, trigger, player, result) => {
			if (result.bool && !event.skipped) {
				event.goto(3);
			}
			game.broadcastAll(() => {
				if (ui.tempnowuxie) {
					ui.tempnowuxie.close();
					delete ui.tempnowuxie;
				}
			});
		},
		async (event, trigger, player) => {
			await event.trigger("phaseUseEnd");
		},
		async (event, trigger, player) => {
			await event.trigger("phaseUseAfter");
		},
	],
	phaseDiscard: [
		async (event, trigger, player) => {
			game.log(player, "进入了弃牌阶段");
			event.num = player.needsToDiscard();
			if (event.num <= 0) {
				event.finish();
				return;
			} else {
				game.broadcastAll(player => {
					if (lib.config.show_phase_prompt) {
						player.popup("弃牌阶段", undefined, false);
					}
				}, player);
			}
			await event.trigger("phaseDiscard");
		},
		async (event, trigger, player) => {
			const num = Number(event.num);
			return player.chooseToDiscard({ selectCard: [num, num], forced: true, useCache: true, allowChooseAll: true }).forResult();
		},
		async (event, trigger, player, result) => {
			if (result.bool && result.cards) {
				event.cards = result.cards;
			}
		},
	],
	async phaseJieshu(event, trigger, player) {
		game.log(player, "进入了结束阶段");
		await event.trigger(event.name);
	},
};
