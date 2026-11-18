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

export const loseContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
	lose: [
		async (event, trigger, player) => {
			const { cards } = event;
			const evt = event.getParent(undefined, true);
			if (!evt || ((evt.name != "discard" || event.type != "discard") && (evt.name != "loseToDiscardpile" || event.type != "loseToDiscardpile"))) {
				event.delay = false;
				return;
			}
			if (evt.delay === false) {
				event.delay = false;
			}
			if (evt.animate != false) {
				evt.discardid = lib.status.videoId++;
				game.broadcastAll(
					(player, cards, id, visible) => {
						const cardx = cards
							.slice()
							.map(i => (i.cards ? i.cards : [i]))
							.flat();
						player.$throw(cardx, null, "nobroadcast");
						const cardnodes: CardNodeList = [];
						cardnodes._discardtime = get.time();
						for (const card of cardx) {
							if (card.clone) {
								cardnodes.push(card.clone);
								if (!visible) {
									card.clone.classList.add("infohidden");
									card.clone.classList.add("infoflip");
								}
							}
						}
						ui.todiscard[id] = cardnodes;
					},
					player,
					cards,
					evt.discardid,
					event.visible
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
					} else if (evt.getParent(undefined, true)?.discardTransition) {
						const parent = evt.getParent(undefined, true);
						if (!parent) {
							return;
						}
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
		},
		async (event, trigger, player) => {
			const { cards } = event;
			event.vcards = {
				//这玩意拿来存储假牌
				cards: [],
				es: [],
				js: [],
			};
			//这个拿来存储虚拟牌对应的实体牌
			event.vcard_cards = [];
			event.gaintag_map = {};
			const hs: Card[] = [];
			const es: Card[] = [];
			const js: Card[] = [];
			const ss: Card[] = [];
			const xs: Card[] = [];
			const unmarks: string[] = [];
			if (event.insert_card && event.position == ui.cardPile) {
				event.cards.reverse();
			}
			const hej = player.getCards("hejsx");
			event.stockcards = cards.slice(0);
			for (let i = 0; i < cards.length; i++) {
				const cardx = [cards[i]];
				if (!hej.includes(cards[i])) {
					cards.splice(i--, 1);
					continue;
				} else if (cards[i].parentElement) {
					const parent = cards[i].parentElement;
					if (!parent) {
						continue;
					}
					if (parent.classList.contains("equips")) {
						cards[i].original = "e";
						const cardSymbol = cards[i].cardSymbol;
						const VEquip = cardSymbol === undefined ? undefined : cards[i][cardSymbol];
						if (VEquip && cards[i].isViewAsCard) {
							//判断是否是假牌
							const loseCards = VEquip.cards;
							//解体！
							cardx.addArray(loseCards);
							event.vcard_cards.addArray(loseCards);
							loseCards.forEach(cardi => {
								cardi.original = "e";
								delete cardi.destiny;
								es.push(cardi);
								event.vcard_map.set(cardi, VEquip || get.autoViewAs(cards[i], void 0, false));
							});
						} else {
							es.push(cards[i]);
							event.vcard_map.set(cards[i], VEquip || get.autoViewAs(cards[i], void 0, false));
							event.vcard_cards.add(cards[i]);
						}
						event.vcards.cards.push(cards[i]);
						event.vcards.es.push(cards[i]);
					} else if (parent.classList.contains("judges")) {
						cards[i].original = "j";
						const cardSymbol = cards[i].cardSymbol;
						const VJudge = cardSymbol === undefined ? undefined : cards[i][cardSymbol];
						if (VJudge && cards[i].isViewAsCard) {
							//判断是否是假牌
							const loseCards = VJudge.cards;
							//解体！
							cardx.addArray(loseCards);
							event.vcard_cards.addArray(loseCards);
							loseCards.forEach(cardi => {
								cardi.original = "j";
								delete cardi.destiny;
								js.push(cardi);
								event.vcard_map.set(cardi, VJudge || get.autoViewAs(cards[i], void 0, false));
							});
						} else {
							js.push(cards[i]);
							event.vcard_map.set(cards[i], VJudge || get.autoViewAs(cards[i], void 0, false));
							event.vcard_cards.add(cards[i]);
						}
						event.vcards.cards.push(cards[i]);
						event.vcards.js.push(cards[i]);
					} else if (parent.classList.contains("expansions")) {
						cards[i].original = "x";
						xs.push(cards[i]);
						event.vcard_map.set(cards[i], get.autoViewAs(cards[i], void 0, false));
						if (cards[i].gaintag && cards[i].gaintag.length) {
							unmarks.addArray(cards[i].gaintag);
						}
					} else if (parent.classList.contains("handcards")) {
						if (cards[i].classList.contains("glows")) {
							cards[i].original = "s";
							ss.push(cards[i]);
							event.vcard_map.set(cards[i], get.autoViewAs(cards[i], void 0, false));
						} else {
							cards[i].original = "h";
							hs.push(cards[i]);
							event.vcard_map.set(cards[i], get.autoViewAs(cards[i], void 0, player));
						}
					} else {
						Object.assign(cards[i], { original: null });
					}
				}
				for (const card of cardx) {
					if (card.gaintag && card.gaintag.length) {
						if (card.cardid !== undefined) {
							event.gaintag_map[card.cardid] = card.gaintag.slice(0);
						}
						//仅移除非永久标记
						const tags = card.gaintag.filter(tag => !tag.startsWith("eternal_"));
						tags.forEach(tag => card.removeGaintag(tag));
					}

					card.style.transform += " scale(0.2)";
					card.classList.remove("glow");
					card.classList.remove("glows");
					card.recheck();

					const info = lib.card[card.name];
					if ("_destroy" in card) {
						if (card._destroy) {
							card.delete();
							card.destroyed = card._destroy;
							continue;
						}
					} else if (event.position && card.willBeDestroyed(event.position.id, null, event)) {
						card.selfDestroy(event);
						continue;
					} else if (info.destroy) {
						card.delete();
						card.destroyed = info.destroy;
						continue;
					}
					/*else if ("destroyed" in cardx[j]) {
						
					}*/
					if (event.position) {
						if (_status.discarded) {
							if (event.position == ui.discardPile) {
								_status.discarded.add(card);
							} else {
								_status.discarded.remove(card);
							}
						}
						if (event.insert_index) {
							card.fix();
							event.position.insertBefore(card, event.insert_index(event, card));
						} else if (event.insert_card) {
							card.fix();
							event.position.insertBefore(card, event.position.firstChild);
						} else if (event.position == ui.cardPile) {
							card.fix();
							event.position.appendChild(card);
						} else {
							card.goto(event.position);
						}
					} else {
						card.remove();
					}
					//if(ss.includes(cardx[j])) cards.splice(i--,1);
				}
			}
			if (player == game.me) {
				ui.updatehl();
			}
			ui.updatej(player);
			game.broadcast(
				(player, cards, num) => {
					for (const card of cards) {
						//cards[i].removeGaintag(true);
						//仅移除非永久标记
						const tags = card.gaintag.filter(tag => !tag.startsWith("eternal_"));
						tags.forEach(tag => card.removeGaintag(tag));
						card.classList.remove("glow");
						card.classList.remove("glows");
						card.fix();
						card.remove();
					}
					if (player == game.me) {
						ui.updatehl();
					}
					ui.updatej(player);
					_status.cardPileNum = num;
				},
				player,
				cards.slice(),
				ui.cardPile.childNodes.length
			);
			game.addVideo("lose", player, [get.cardsInfo(hs), get.cardsInfo(es), get.cardsInfo(js), get.cardsInfo(ss)]);
			event.cards2 = hs.concat(es);
			cards.removeArray(event.vcards.cards);
			cards.addArray(event.vcard_cards);
			player.getHistory("lose").push(event);
			game.getGlobalHistory().cardMove.push(event);
			player.update();
			game.addVideo("loseAfter", player);
			event.num = 0;
			if (event.position == ui.ordering) {
				const evt = event.relatedEvent || event.getParent();
				if (!evt.orderingCards) {
					evt.orderingCards = [];
				}
				if (!evt.noOrdering && !evt.cardsOrdered) {
					evt.cardsOrdered = true;
					const next = game.createEvent("orderingDiscard", false);
					event.next.remove(next);
					evt.after.push(next);
					next.relatedEvent = evt;
					next.setContent("orderingDiscard");
				}
				if (!evt.noOrdering) {
					evt.orderingCards.addArray(cards);
				}
			} else if (event.position == ui.cardPile) {
				game.updateRoundNumber();
			}
			if (unmarks.length) {
				for (const i of unmarks) {
					const skill = getRegisteredSkill(lib.skill, i);
					player[(skill && skill.mark) || player.hasCard(card => card.hasGaintag(i), "x") ? "markSkill" : "unmarkSkill"](i);
				}
			}
			event.hs = hs;
			event.es = es;
			event.js = js;
			event.ss = ss;
			event.xs = xs;
			game.clearCardKnowers(hs);
			if (hs.length && !event.visible) {
				player.getCards("h").forEach(hcard => {
					hcard.clearKnowers();
				});
			}
		},
		async (event, trigger, player) => {
			// 虚拟装备列表由前序步骤构建为普通数组；游标未初始化时
			// Number 仍使访问落在不存在的 NaN 属性上，不会伪造第 0 项。
			const num = Number(event.num);
			if (num < event.vcards.cards.length) {
				if (event.vcards.es.includes(event.vcards.cards[num])) {
					event.loseEquip = true;
					const VEquip = event.vcards.cards[num][event.vcards.cards[num].cardSymbol];
					if (VEquip) {
						player.removeVirtualEquip(VEquip);
						//player.removeEquipTrigger(cards[num]);
						const info = get.info(VEquip, false);
						if (info.onLose && (!info.filterLose || info.filterLose(VEquip, player))) {
							event.goto(3);
							event.currentVEquip = VEquip;
							return;
						}
					}
				} else if (event.vcards.js.includes(event.vcards.cards[num])) {
					const VJudge = event.vcards.cards[num][event.vcards.cards[num].cardSymbol];
					if (VJudge) {
						player.removeVirtualJudge(VJudge);
					}
				}
				event.num = Number(event.num) + 1;
				event.redo();
			} else {
				if (event.loseEquip) {
					player.addEquipTrigger();
				}
				event.goto(4);
			}
		},
		async (event, trigger, player) => {
			const VEquip = event.currentVEquip;
			const info = get.info(VEquip, false);
			if (info.loseDelay != false && (player.isAlive() || info.forceDie)) {
				player.popup(VEquip.name);
				game.delayx();
			}
			if (Array.isArray(info.onLose)) {
				for (const onLose of info.onLose) {
					const next = game.createEvent(`lose_${VEquip.name}`);
					next.setContent(onLose);
					if (info.forceDie) {
						next.forceDie = true;
					}
					next.player = player;
					next.card = VEquip;
					next.cards = VEquip.cards;
				}
			} else {
				const next = game.createEvent(`lose_${VEquip.name}`);
				next.setContent(info.onLose);
				next.player = player;
				if (info.forceDie) {
					next.forceDie = true;
				}
				next.card = VEquip;
				next.cards = VEquip.cards;
			}
			event.num = Number(event.num) + 1;
			event.goto(2);
		},
		async (event, trigger, player) => {
			const { cards } = event;
			event.cards = cards.map(i => (i.cards ? i.cards : [i])).flat();
			for (const [key, value] of lib.commonArea) {
				if (event[value.toName]) {
					const next = initializeEvent(game.createEvent(`lose_${value.toName}`), { cards });
					next.setContent(value.addHandeler);
					next.player = player;
					next.relatedEvent = event;
					next.type = event.name;
					await next;
				}
			}
		},
		async (event, trigger, player) => {
			const evt = event.getParent();
			if (evt.name != "discard" && event.type != "discard" && evt.name != "loseToDiscardpile" && event.type != "loseToDiscardpile") {
				return;
			}
			if (event.animate === false || event.delay === false) {
				return;
			}
			if (evt.delay != false) {
				if (evt.waitingForTransition) {
					_status.waitingForTransition = evt.waitingForTransition;
					game.pause();
				} else {
					game.delayx();
				}
			}
		},
	],
};
