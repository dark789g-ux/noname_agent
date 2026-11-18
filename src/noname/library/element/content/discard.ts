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

export const discardContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
	async discard(event, trigger, player) {
		const { cards } = event;
		game.log(player, "弃置了", cards);
		event.done = player.lose({ cards, position: event.position, visible: true });
		event.done.type = "discard";
		if (event.discarder) {
			event.done.discarder = event.discarder;
		}
		await event.done;
		await event.trigger("discard");
	},
	async loseToDiscardpile(event, trigger, player) {
		const { cards } = event;
		if (event.log != false) {
			game.log(player, "将", cards, "置入了弃牌堆");
		}
		const next = player.lose({ cards, position: event.position });
		if (event.insert_index) {
			next.insert_index = event.insert_index;
		}
		if (event.insert_card) {
			next.insert_card = true;
		}
		if (!event.blank) {
			next.visible = true;
		}
		next.type = "loseToDiscardpile";
		event.done = next;
		await next;
		await event.trigger("loseToDiscardpile");
	},
	respond: [
		async (event, trigger, player) => {
			const { cards, card } = event;
			let cardaudio = true;
			if (event.skill) {
				const skill = requireRegisteredSkill(lib.skill, event.skill);
				if (skill.audio) {
					cardaudio = false;
				}
				if (skill.log != false) {
					const logAudioArgs: Video["content"] = [event, event.player];
					player.logSkill(event.skill, false, null, null, logAudioArgs);
				}
				/*if (get.info(event.skill).popname) {
					player.tryCardAnimate(event.card, event.card.name, "metal", true);
				}*/
				player.checkShow(event.skill, true);
				const onrespond = skill.onrespond;
				if (typeof onrespond == "function" && !game.online) {
					onrespond.call(skill, event, player);
				}
			} else if (!event.nopopup) {
				if (event.card && typeof event.card.name == "string") {
					const card = event.card instanceof lib.element.Card || event.card instanceof lib.element.VCard ? event.card : new lib.element.VCard(event.card);
					player.tryCardAnimate(card, card.name, "wood");
				}
			}
			if (cardaudio && event.getParent(3).name == "useCard") {
				game.broadcastAll(
					(player, card) => {
						game.playCardAudio(card, player);
					},
					player,
					event.card
				);
			}
			if (event.skill && event.addSkillCount !== false) {
				if (player.stat[player.stat.length - 1].skill[event.skill] == undefined) {
					player.stat[player.stat.length - 1].skill[event.skill] = 1;
				} else {
					player.stat[player.stat.length - 1].skill[event.skill]++;
				}
				const sourceSkill = get.info(event.skill).sourceSkill;
				if (sourceSkill) {
					if (player.stat[player.stat.length - 1].skill[sourceSkill] == undefined) {
						player.stat[player.stat.length - 1].skill[sourceSkill] = 1;
					} else {
						player.stat[player.stat.length - 1].skill[sourceSkill]++;
					}
				}
			}
			if (cards.length && (cards.length > 1 || cards[0].name != event.card.name)) {
				game.log(player, "打出了", event.card, "（", cards, "）");
			} else {
				game.log(player, "打出了", event.card);
			}
			player.actionHistory[player.actionHistory.length - 1].respond.push(event);
			const loseMap: Record<string, Card[]> = { noowner: [] };
			event.lose_map = loseMap;
			if (typeof player.playerid == "string") {
				loseMap[player.playerid] = [];
			}
			const cards_ow = event.cards.slice();
			while (cards_ow.length) {
				const owner = get.owner(cards_ow[0]);
				if (owner) {
					const id = owner.playerid;
					const Cards_card = cards.filter(card => get.owner(card) == owner);
					cards_ow.removeArray(Cards_card);
					owner.getCards("ej").forEach(card => {
						const cardSymbol = card.cardSymbol;
						const cardsx = cardSymbol !== undefined ? card[cardSymbol]?.cards?.filter(cardx => cards.includes(cardx)) : undefined;
						if (!cardsx?.length) {
							return;
						}
						event.cards.removeArray(cardsx);
						event.cards.add(card);
					});
					if (typeof id == "string") {
						loseMap[id] ??= [];
						loseMap[id].addArray(Cards_card);
					} else {
						loseMap.noowner.addArray(Cards_card);
					}
				} else {
					const noownerCard = cards_ow.shift();
					if (noownerCard) {
						loseMap.noowner.add(noownerCard);
					}
				}
			}
			player.respondAnimateBefore?.(event, trigger, player);
			if (event.animate != false && event.throw !== false) {
				let throw_cards = cards;
				let virtualCard_str = "";
				for (const id in loseMap) {
					if (id == "noowner") {
						continue;
					}
					const owner = (_status.connectMode ? lib.playerOL : game.playerMap)[id];
					const throws = loseMap[id];
					if (owner == player) {
						if (!throw_cards.length && lib.config.card_animation_info) {
							const virtualCard = ui.create.card(undefined, undefined, undefined);
							virtualCard._destroy = true;
							virtualCard.expired = true;
							const info = lib.card[card.name];
							const number = card.number;
							virtualCard.init([get.suit(card), typeof number == "number" ? number : "虚拟", card.name, card.nature]);
							const infoNode = virtualCard.querySelector(".info");
							if (infoNode instanceof HTMLElement) {
								virtualCard_str = infoNode.innerHTML;
							}
							throw_cards = [virtualCard];
							throws.add(virtualCard);
						}
						if (lib.config.card_animation_info) {
							throws.addArray(loseMap.noowner);
						}
					}
					if (throws.length) {
						owner.$throw(throws);
					}
				}
				if (loseMap.noowner.length && !lib.config.card_animation_info) {
					for (const card of loseMap.noowner) {
						game.broadcastAll(
							(player, card, cardid) => {
								let event;
								if (game.online) {
									event = {};
								} else {
									event = _status.event;
								}
								if (game.chess) {
									event.node = card.copy("thrown", "center", ui.arena).addTempClass("start");
								} else {
									event.node = player.$throwordered(card.copy(), true);
								}
								if (lib.cardOL) {
									lib.cardOL[cardid] = event.node;
								}
								event.node.cardid = cardid;
								event.node.classList.add("thrownhighlight");
							},
							player,
							card,
							get.id()
						);
					}
				}
				if (lib.config.card_animation_info) {
					game.broadcastAll(
						(cards, card, card_cards, str, judgeing) => {
							for (const nodex of cards) {
								const node = nodex.clone;
								if (nodex._tempName) {
									nodex._tempName.delete();
									delete nodex._tempName;
								}
								if (!node) {
									continue;
								}
								if (str) {
									const infoNode = node.querySelector(".info");
									if (infoNode instanceof HTMLElement) {
										infoNode.innerHTML = str;
									}
								}
								if ((cards.length > 1 || !card.isCard || card.name != node.name || card.nature != node.nature || !card.cards?.length) && !judgeing) {
									ui.create.cardTempName(card, node);
									if (node._tempName && card_cards?.length <= 0) {
										node._tempName.innerHTML = node._tempName.innerHTML.slice(0, node._tempName.innerHTML.indexOf("<span", -1));
										node._tempName.innerHTML += "<span style='color:black'>虚拟</span></span>";
									}
								}
							}
						},
						throw_cards,
						event.card,
						event.cards,
						virtualCard_str,
						Boolean(event.highlight)
					);
				}
				if (event.highlight) {
					for (const card of throw_cards) {
						if (card.clone) {
							card.clone.classList.add("thrownhighlight");
							game.addVideo("highlightnode", player, get.cardInfo(card));
						}
					}
				}
				if (event.highlight) {
					game.broadcast(cards => {
						for (const card of cards) {
							if (card.clone) {
								card.clone.classList.add("thrownhighlight");
							}
						}
					}, throw_cards);
				}
			}
			if (cards.length) {
				const ownerCards = cards.filter(card => get.owner(card));
				const directDiscard = cards.filter(card => !get.owner(card));
				if (ownerCards.length) {
					let ownerx: Player | undefined;
					for (const card of ownerCards) {
						const owner = get.owner(card);
						if (!owner) {
							continue;
						}
						ownerx = owner;
						break;
					}
					if (
						cards.some(card => {
							const owner = get.owner(card);
							return owner != ownerx;
						})
					) {
						await game.loseAsync({ player: player, cards: ownerCards }).setContent(async (event, trigger, player) => {
							const cards = event.cards;
							const cards_noowner: Card[] = [];
							while (cards.length) {
								const owner = get.owner(cards[0]);
								if (!owner) {
									const noownerCard = cards.shift();
									if (noownerCard) {
										cards_noowner.add(noownerCard);
									}
								} else {
									const id = owner.playerid;
									const onLoseCards = cards.filter(card => get.owner(card) == owner);
									event.cards.removeArray(onLoseCards);
									await owner.lose(onLoseCards, "visible", ui.ordering).set("relatedEvent", event.getParent()).set("getlx", false).set("type", "use");
								}
							}
							if (cards_noowner.length) {
								const ordering = game.cardsGotoOrdering(cards_noowner);
								if (ordering) {
									await ordering.set("relatedEvent", event.getParent());
								}
							}
						});
					} else {
						if (ownerx) {
							await ownerx.lose({ cards: ownerCards, position: ui.ordering, visible: true }).set("type", "use");
						}
					}
				}
				if (directDiscard.length) {
					loseMap.noowner.addArray(directDiscard);
					await game.cardsGotoOrdering(directDiscard);
				}
			}
			await event.trigger("respond");
			await game.delayx(0.5);
		},
	],
	async swapHandcards(event, trigger, player) {
		const target = event.getTarget();

		event.cards1 = event.cards1 || player.getCards("h");
		event.cards2 = event.cards2 || target.getCards("h");
		await game
			.loseAsync({
				player: player,
				target: target,
				cards1: event.cards1,
				cards2: event.cards2,
			})
			.setContent("swapHandcardsx");
		await game
			.loseAsync({
				gain_list: [
					[player, event.cards2.filterInD()],
					[target, event.cards1.filterInD()],
				],
			})
			.setContent("gaincardMultiple");
		await game.delayx();
	},
	async swapHandcardsx(event, trigger, player) {
		const target = event.getTarget();
		const { cards1, cards2 } = event;

		player.$giveAuto(cards1, target);
		target.$giveAuto(cards2, player);

		let delayed = false;

		let cards = cards1;
		const next1 = player.lose(cards, ui.ordering);
		next1.getlx = false;
		next1.relatedEvent = event.getParent();
		if (player == game.me) {
			delayed = true;
		} else {
			next1.delay = false;
		}

		await next1;

		cards = event.cards2;
		const next2 = target.lose(cards, ui.ordering);
		next2.getlx = false;
		next2.relatedEvent = event.getParent();
		if (target == game.me) {
			delayed = true;
		} else {
			next2.delay = false;
		}

		await next2;

		if (!delayed) {
			await game.delay();
		}
	},
	async gainMultiple(event, trigger, player) {
		const targets = [...event.getTargets()].sortBySeat();
		const map = new Map<Player, Card[]>();

		for (const target of targets.sortBySeat()) {
			const next = player.gainPlayerCard({ target, position: event.position, forced: true }).set("boolline", false).set("delay", false);
			next.gaintag.addArray(event.gaintag);
			const result = await next.forResult();
			if (typeof result !== "string" && result.bool && Array.isArray(result.cards) && result.cards.length) {
				map.set(target, result.cards);
			}
		}

		event.cards = Array.from(map.values()).flat();
		event.result = {
			bool: true,
			cards: event.cards,
			targets: targets,
			gain_map: map,
		};

		await game.delay();
	},
};
