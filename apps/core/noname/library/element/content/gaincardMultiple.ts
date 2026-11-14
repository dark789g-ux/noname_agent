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

export const gaincardMultipleContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
	async gaincardMultiple(event, trigger, player) {
		const { cards } = event;
		event.type = "gain";
		if (event.animate == "give" || event.animate == "gain2") {
			event.visible = true;
		}
		if (player && cards) {
			event._lose = true;
			await player.lose({ cards: cards.slice(), position: ui.special }).set("type", "gain").set("forceDie", true).set("getlx", false);
		}

		let delay;
		const animate = event.animate;
		switch (animate) {
			case "draw":
				for (const pair of event.gain_list) {
					if (get.itemtype(pair[1]) == "card") {
						pair[1] = [pair[1]];
					}
					if (event._lose) {
						pair[1] = pair[1].filter(card => !cards.includes(card) || !player.getCards("hejsx").includes(card));
					}
					if (pair[1].length > 0) {
						pair[0].$draw(pair[1].length);
					}
				}
				delay = game.delay(0, get.delayx(500, 500));
				break;
			case "gain":
				for (const pair of event.gain_list) {
					if (get.itemtype(pair[1]) == "card") {
						pair[1] = [pair[1]];
					}
					if (event._lose) {
						pair[1] = pair[1].filter(card => !cards.includes(card) || !player.getCards("hejsx").includes(card));
					}
					if (pair[1].length > 0) {
						pair[0].$gain(pair[1].length);
					}
				}
				delay = game.delay(0, get.delayx(700, 700));
				break;
			case "gain2":
			case "draw2":
				for (const pair of event.gain_list) {
					if (get.itemtype(pair[1]) == "card") {
						pair[1] = [pair[1]];
					}
					if (event._lose) {
						pair[1] = pair[1].filter(card => !cards.includes(card) || !player.getCards("hejsx").includes(card));
					}
					if (pair[1].length > 0) {
						pair[0].$gain2(pair[1]);
					}
				}
				delay = game.delay(0, get.delayx(500, 500));
				break;
			case "give":
			case "giveAuto": {
				if (!player) {
					break;
				}
				const evt = event.getl(player);
				for (const pair of event.gain_list) {
					if (get.itemtype(pair[1]) == "card") {
						pair[1] = [pair[1]];
					}
					if (event._lose) {
						pair[1] = pair[1].filter(card => !cards.includes(card) || !player.getCards("hejsx").includes(card));
					}
					const shown = pair[1].slice(0);
					const hidden: Card[] = [];
					if (event.animate == "giveAuto") {
						for (const card of pair[1]) {
							if (evt.hs.includes(card)) {
								shown.remove(card);
								hidden.push(card);
							}
						}
					}
					if (shown.length > 0) {
						player.$give(shown, pair[0]);
					}
					if (hidden.length > 0) {
						player.$giveAuto(hidden, pair[0]);
					}
				}
				delay = game.delay(0, get.delayx(500, 500));
				break;
			}
			default: {
				if (typeof animate === "function") {
					const animateResult = animate(event);
					if (typeof animateResult === "number") {
						delay = game.delay(0, get.delayx(animateResult, animateResult));
					} else {
						animateResult.finally(() => void game.resume());
						delay = game.pause();
					}
				}
				break;
			}
		}
		const nexts: GameEvent[] = [];
		for (const pair of event.gain_list) {
			if (pair[1].length > 0) {
				const next = pair[0].gain(pair[1]);
				next.getlx = false;
				if (event.visible) {
					next.visible = true;
				}
				if (event.giver) {
					next.giver = event.giver;
				}
				if (event.gaintag) {
					next.gaintag.addArray(event.gaintag);
				}
				nexts.push(next);
			}
		}
		await delay;
		await Promise.all(nexts);
		await game.delayx();
	},
	async discardMultiple(event, trigger, player) {
		event.type = "discard";
		event.visible = true;
		if (!event.position) {
			event.position = ui.discardPile;
		}

		const allCards: Card[] = [];
		const events: GameEvent[] = [];
		event.cards = allCards;
		for (const [target, cards] of event.lose_list) {
			const next = target.lose(cards, event.position);
			game.log(target, "弃置了", cards);
			next.type = "discard";
			next.animate = false;
			next.delay = false;
			allCards.addArray(cards);
			next.getlx = false;

			events.push(next);
		}

		const evt = event;
		const { cards } = event;
		if (evt.animate != false) {
			evt.discardid = lib.status.videoId++;
			game.broadcastAll(
				(list, id, cards) => {
					for (const item of list) {
						for (const j of item[1]) {
							j.classList.remove("glow");
							j.classList.remove("glows");
						}
						item[0].$throw(item[1], null, "nobroadcast");
					}
					const cardnodes: Card[] & { _discardtime?: number } = [];
					cardnodes._discardtime = get.time();
					for (const ix of list) {
						const card = ix[1];
						for (const card of cards) {
							if (card.clone) {
								cardnodes.push(card.clone);
							}
						}
					}
					ui.todiscard[id] = cardnodes;
				},
				event.lose_list,
				evt.discardid,
				cards
			);
			if (lib.config.sync_speed && cards[0] && cards[0].clone) {
				if (evt.delay != false) {
					const waitingForTransition = get.time();
					evt.waitingForTransition = waitingForTransition;
					cards[0].clone.listenTransition(() => {
						if (_status.waitingForTransition == waitingForTransition && _status.paused) {
							game.resume();
						}
						delete evt.waitingForTransition;
					});
				} else {
					const parent = evt.getParent(undefined, true);
					if (parent?.discardTransition) {
						delete parent.discardTransition;
						const waitingForTransition = get.time();
						parent.waitingForTransition = waitingForTransition;
						cards[0].clone.listenTransition(() => {
							if (_status.waitingForTransition == waitingForTransition && _status.paused) {
								game.resume();
							}
							const currentParent = evt.getParent(undefined, true);
							if (currentParent) {
								delete currentParent.waitingForTransition;
							}
						});
					}
				}
			}
		}

		await Promise.all(events);

		if (event.delay != false) {
			if (event.waitingForTransition) {
				_status.waitingForTransition = event.waitingForTransition;
				await game.pause();
			} else {
				await game.delayx();
			}
		}
	},
};
