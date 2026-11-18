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

export const expandEquipContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
	async expandEquip(event, trigger, player) {
		const { slots } = event;

		if (!slots.length) {
			return;
		}

		const slotsx: string[] = [];
		if (get.is.mountCombined()) {
			for (const slot of slots) {
				if (slot == "equip3" || slot == "equip4") {
					slotsx.add("equip3_4");
				} else {
					slotsx.add(slot);
				}
			}
		} else {
			slotsx.addArray(slots);
		}
		slotsx.sort();

		for (const slot of slotsx) {
			let expand = get.numOf(slots, slot);
			let slot_key = slot;
			if (slot == "equip3_4") {
				expand = Math.max(get.numOf(slots, "equip3"), get.numOf(slots, "equip4"));
				slot_key = "equip3";
			}
			game.log(player, `获得了${get.cnNumber(expand)}个额外的`, `#g${get.translation(slot)}栏`);

			player.expandedSlots ??= {};
			player.expandedSlots[slot_key] ??= 0;
			player.expandedSlots[slot_key] += expand;
		}

		player.$syncExpand();
	},
	//选择顶装备要顶的牌
	async replaceEquip(event, trigger, player) {
		const vcards: VCard[] = [];
		const cardSymbol = event.card.cardSymbol;
		const vcard = cardSymbol !== undefined ? event.card[cardSymbol] : undefined;
		vcards.push(vcard || get.autoViewAs(event.card, void 0, false));
		const specializedVCards: VCard[] = [];
		const normalVCards: VCard[] = [];
		const replacedCards: VCard[] = [];
		vcards.forEach(card => {
			const info = get.info(card, false);
			(info?.customSwap ? specializedVCards : normalVCards).push(card);
		});
		specializedVCards.forEach(card => {
			const info = get.info(card, false);
			replacedCards.addArray(player.getVCards("e", card => info.customSwap(card)));
		});
		const types = normalVCards.reduce<string[]>((types, card) => types.concat(get.subtypes(card, false)), []);
		if (types.length > 0) {
			const slots = types;
			const slotsx: string[] = [];
			if (get.is.mountCombined()) {
				slots.forEach(type => {
					if (type == "equip3" || type == "equip4") {
						slotsx.add("equip3_4");
					} else {
						slotsx.add(type);
					}
				});
			} else {
				slotsx.addArray(slots);
			}
			slotsx.sort();
			for (const slot of slotsx) {
				const left = player.countEquipableSlot(slot);
				let lose;
				if (slot == "equip3_4") {
					lose = Math.min(left, Math.max(get.numOf(slots, "equip3"), get.numOf(slots, "equip4")));
				} else {
					lose = Math.min(left, get.numOf(slots, slot));
				}
				let result: EventResult | undefined;
				if (lose <= 0) {
					continue;
				} else {
					const cards = player.getVEquips(slot).filter(card => !replacedCards.includes(card) && lib.filter.canBeReplaced(card, player));
					if (cards.length > 0) {
						if (lose >= left) {
							result = { bool: true, links: cards };
						} else if (cards.length > left - lose) {
							let source = event.source;
							const num = cards.length - (left - lose);
							if (!source || !source.isIn()) {
								source = player;
							}
							const chooseEvent = source
								.chooseButton({
									createDialog: [`选择替换掉${get.cnNumber(num)}张${get.translation(slot)}装备牌`, [cards, "vcard"]],
									forced: true,
									selectButton: [1, num],
								})
								.set("filterOk", () => {
									const evt = _status.event;
									return (
										ui.selected.buttons.reduce((num, button) => {
											if (evt.slot == "equip3_4") {
												return num + Math.max(get.numOf(getButtonSubtypes("link" in button ? button.link : undefined), "equip3"), get.numOf(getButtonSubtypes("link" in button ? button.link : undefined), "equip4"));
											}
											return num + get.numOf(getButtonSubtypes("link" in button ? button.link : undefined), evt.slot);
										}, 0) == evt.required
									);
								})
								.set("required", num)
								.set("slot", slot);
							result = normalizeSelectionResult(await chooseEvent.forResult());
						}
					}
				}
				if (typeof result !== "string" && isVCardLinks(result?.links)) {
					replacedCards.addArray(result.links);
				}
			}
		}
		event.result = {
			vcards: replacedCards,
			cards: player.getCards("e", i => {
				const cardSymbol = i.cardSymbol;
				return cardSymbol !== undefined && replacedCards.includes(i[cardSymbol]);
			}),
		};
	},
	//装备牌
	async equip(event, trigger, player) {
		event.visible = true;
		//先确定这次的cards是什么成分也防止有人在equipBegin之类的时机往里面塞垃圾
		if (event.cards.length > 1 && event.cards.some(cardx => cardx.isViewAsCard)) {
			//实体牌数大于1且里面有虚拟假牌，终止此事件
			event.untrigger();
			return;
		}
		//进行第一轮先行判断，让所有装备牌的原主失去装备牌
		const loseCards: Card[] = [];
		//判断card是不是假牌，如果是改为失去假牌
		if (event.card.isViewAsCard) {
			loseCards.add(event.card);
		} else {
			loseCards.addArray(event.cards);
		}
		if (loseCards.length) {
			type LoseMap = { [playerid: string]: [Card[], Card[], Card[]] };
			const map: LoseMap = {};
			for (const i of loseCards) {
				const owner = get.owner(i, "judge");
				if (owner && (owner != player || get.position(i) != "e")) {
					const id = owner.playerid;
					if (typeof id !== "string") {
						continue;
					}
					if (!map[id]) {
						map[id] = [[], [], []];
					}
					map[id][0].push(i);
					const position = get.position(i);
					if (position == "h") {
						map[id][1].push(i);
					} else {
						map[id][2].push(i);
					}
				} else if (!event.updatePile && get.position(i) == "c") {
					event.updatePile = true;
				}
				if (event.visible) {
					i.addKnower("everyone");
				}
			}
			event.losing_map = map;
			for (const i in map) {
				const owner = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
				const next = owner.lose({ cards: map[i][0], position: ui.special }).set("type", "equip").set("forceDie", true).set("getlx", false);
				if (event.visible == true) {
					next.visible = true;
				}
				await next;
				event.relatedLose = next;
			}
			for (const [key, value] of lib.commonArea) {
				const list = (_status[value.areaStatusName] || []).filter(card => loseCards.includes(card));
				if (event[value.fromName] || list.length) {
					const next = initializeEvent(game.createEvent(`from_${value.fromName}`), { cards: list });
					next.setContent(value.removeHandeler);
					next.player = player;
					next.type = event.name;
					await next;
				}
			}
		}
		player.equiping = true;
		const handleEquip = async card => {
			const cards = event.cards;
			const cardInfo = get.info(card, false);
			if (player.isMin() || !player.canEquip(card)) {
				await game.cardsDiscard(cards);
				delete player.equiping;
				return;
			}
			let audioSubtype = get.subtype(card);
			if (audioSubtype == "equip6") {
				audioSubtype = "equip3";
			}
			game.broadcastAll(type => {
				if (lib.config.background_audio) {
					game.playAudio("effect", type);
				}
			}, audioSubtype);
			player.addVirtualEquip(card, cards);
			//player.$equip(card);
			//game.addVideo("equip", player, get.cardInfo(card));
			if (event.log != false) {
				const isViewAsCard = cards.length !== 1 || cards[0].name !== card.name;
				if (isViewAsCard && cards.length) {
					game.log(player, `装备了<span class="yellowtext">${get.translation(card)}</span>（`, cards, "）");
				} else {
					game.log(player, "装备了", card);
				}
			}
			if (cardInfo.onEquip && (!cardInfo.filterEquip || cardInfo.filterEquip(card, player))) {
				if (Array.isArray(cardInfo.onEquip)) {
					for (const onEquip of cardInfo.onEquip) {
						const next = game.createEvent(`equip_${card.name}`);
						next.setContent(onEquip);
						next.player = player;
						next.card = event.vcards[0];
						await next;
					}
				} else {
					const next = game.createEvent(`equip_${card.name}`);
					next.setContent(cardInfo.onEquip);
					next.player = player;
					next.card = event.vcards[0];
					await next;
				}
				if (cardInfo.equipDelay != false) {
					await game.delayx();
				}
			}
			delete player.equiping;
			if (event.delay) {
				await game.delayx();
			}
		};
		//检查实体牌会不会被销毁
		let stop = false;
		const list: Card[] = [];
		for (const cardx of event.cards) {
			if (cardx.willBeDestroyed("equip", player, event)) {
				cardx.selfDestroy(event);
				stop = true;
			} else if ("hejx".includes(get.position(cardx, true))) {
				stop = true;
			} else {
				list.add(cardx);
			}
		}
		if (stop) {
			if (list.length) {
				await game.cardsDiscard(list);
			}
			return;
		}

		event.vcards = [];
		const card = event.card;
		if (get.itemtype(card) === "card" && !card.isViewAsCard) {
			//cards = [card];
			event.card = card.cardSymbol ? card[card.cardSymbol] : get.autoViewAs(card, void 0, false);
			event.vcards.push(event.card);
		} else {
			if (get.itemtype(card) === "card" && card.isViewAsCard) {
				const cardSymbol = card.cardSymbol;
				const cardSymbolKey = cardSymbol === undefined ? "undefined" : cardSymbol;
				event.vcards.push(card[cardSymbolKey]);
			} else {
				event.vcards.push(card);
			}
		}
		//准备上装备时的处理
		const cardInfo = get.info(event.card, false);
		if (cardInfo.prepareEquip && (!cardInfo.filterEquip || cardInfo.filterEquip(event.card, player))) {
			const next = game.createEvent(`prepare_${event.card.name}`);
			next.setContent(cardInfo.prepareEquip);
			next.player = player;
			next.card = event.card;
			await next;
		}
		//同时播放所有装备牌的装备动画
		if (event.cards.length) {
			if (event.draw) {
				player.$draw(event.cards);
				await game.delay(0, 300);
			} else {
				game.broadcast(
					(cards, player) => {
						cards.forEach(card => {
							if (card.clone) {
								card.clone.moveDelete(player);
							}
						});
					},
					event.cards,
					player
				);
				event.cards.forEach(card => {
					if (card.clone) {
						card.clone.moveDelete(player);
						game.addVideo("gain2", player, get.cardsInfo([card.clone]));
					}
				});
			}
		}
		//将多张装备牌的牌替换事件合并为一个，废弃卡牌的replaceEquip自定义事件属性（反正没人用）
		const replaceEquipEvent = game.createEvent("replaceEquip");
		replaceEquipEvent.player = player;
		replaceEquipEvent.card = event.card;
		replaceEquipEvent.setContent("replaceEquip");
		const result = await replaceEquipEvent.forResult();
		if (typeof result !== "string" && Array.isArray(result.cards) && get.itemtype(result.cards) == "cards") {
			event.swapped = true;
			const loseEvent = player.lose({ cards: result.cards, visible: true }).set("type", "equip").set("getlx", false);
			loseEvent.swapEquip = true;
			if (get.info(event.card, false)?.loseThrow) {
				player.$throw(result.cards, 1000);
			}
			await loseEvent;
			for (const card of result.cards) {
				if (card.willBeDestroyed("discardPile", player, event)) {
					card.selfDestroy(event);
				}
			}
		}
		//就算是vcard也应该用lose处理
		/*result?.vcards?.forEach(card => {
			player.removeVirtualEquip(card);
		});*/
		//然后处理每一张装备牌的装备
		await handleEquip(event.card);
		//如果event.card是实体牌，改为虚拟牌
		if (event.card instanceof lib.element.Card) {
			const cardSymbol = event.card.cardSymbol;
			if (cardSymbol !== undefined) {
				const virtualCard = event.card[cardSymbol];
				if (virtualCard instanceof lib.element.VCard) {
					event.card = virtualCard;
				}
			}
		}
		if (event.updatePile) {
			game.updateRoundNumber();
		}
	},
	//装备栏 END
	async changeGroup(event, trigger, player) {
		event.originGroup = player.group;
		event.group ??= player.group;

		const group = event.group;
		game.addVideo("changeGroup", player, group);
		player.getHistory("custom").push(event);

		if (event.broadcast !== false) {
			game.broadcast(
				(player, group) => {
					player.group = group;
					player.node.name.dataset.nature = get.groupnature(group);
				},
				player,
				group
			);
		}

		player.group = group;
		player.node.name.dataset.nature = get.groupnature(group);

		if (event.log !== false) {
			game.log(player, "将势力变为了", `#y${get.translation(group + 2)}`);
		}
	},
};
