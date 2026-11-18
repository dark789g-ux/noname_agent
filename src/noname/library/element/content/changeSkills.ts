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

export const changeSkillsContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
	//变更技能
	async changeSkills(event, trigger, player) {
		//获取玩家当前已有的技能
		const ownedSkills = player.getSkills(true, false, false);
		//去重检查
		event.addSkill.unique();
		event.removeSkill.unique();
		//避免失去还没拥有的技能
		event.removeSkill = event.removeSkill.filter(skill => ownedSkills.includes(skill));
		const duplicatedSkills = event.addSkill.filter(skill => event.removeSkill.includes(skill));
		if (duplicatedSkills.length) {
			event.addSkill.removeArray(duplicatedSkills);
			event.removeSkill.removeArray(duplicatedSkills);
		}
		//if (!event.addSkill.length&&!event.removeSkill.length) return;
		//手动触发时机
		await event.trigger("changeSkillsBefore");
		await event.trigger("changeSkillsBegin");
		//处理失去和获得的技能
		if (event.$handle) {
			event.$handle(player, event.addSkill, event.removeSkill, event);
		} else {
			if (event.addSkill.length) {
				player.addSkill(event.addSkill);
				game.log(
					player,
					"获得了技能",
					...event.addSkill
						.filter(i => i in lib.translate)
						.map(i => {
							if (event.popup) {
								player.popup(i);
							}
							return `#g【${get.translation(i)}】`;
						})
				);
			}
			if (event.removeSkill.length) {
				player.removeSkill(event.removeSkill);
				game.log(
					player,
					"失去了技能",
					...event.removeSkill
						.filter(i => i in lib.translate)
						.map(i => {
							if (event.popup) {
								player.popup(i);
							}
							return `#g【${get.translation(i)}】`;
						})
				);
			}
		}
		//手动触发时机
		await event.trigger("changeSkillsEnd");
		await event.trigger("changeSkillsAfter");
	},
	//连接牌
	async connectCards(event, trigger, player) {
		const { source, cards, log } = event;
		const shown = cards.filter(card => get.is.connectedCard(card));
		const hidden = cards.filter(card => !shown.includes(card));
		event.shownCards = shown;
		event.hiddenCards = hidden;
		game.addConnectedCards(cards);
		if (log) {
			game.log(source, `连接了<span class="bluetext">${player == source ? "自己" : get.translation(player)}</span>的`, event.cards);
		}
	},
	//重置连接牌
	async resetConnectedCards(event, trigger, player) {
		const { source, cards, log } = event;
		game.removeConnectedCards(cards);
		if (log) {
			game.log(source, `重置了<span class="bluetext">${player == source ? "自己" : get.translation(player)}</span>的连接牌（`, event.cards, "）");
		}
	},
	//增加明置手牌
	async addShownCards(event, _trigger, player) {
		const hs = player.getCards("h");
		const showingCards = event.cards.filter(showingCard => hs.includes(showingCard));
		const shown = player.getShownCards();

		for (const tag of event.gaintag) {
			player.addGaintag(showingCards, tag);
		}

		event.cards = showingCards.filter(showingCard => !shown.includes(showingCard));
		if (!event.cards.length) {
			return;
		}

		game.log(player, "明置了", event.cards);
		//if (event.animate != false) player.$give(event.cards, player, false);
		await event.trigger("addShownCardsAfter");
	},
	//隐藏明置手牌
	async hideShownCards(event, _trigger, player) {
		const shown = player.getShownCards();
		const hidingCards = event.cards.filter(hidingCard => shown.includes(hidingCard));

		if (!hidingCards.length) {
			return;
		}

		if (event.gaintag.length) {
			for (const tag of event.gaintag) {
				player.removeGaintag(tag, hidingCards);
			}
		} else {
			const map = new Map();
			for (const hidingCard of hidingCards) {
				for (const tag of hidingCard.gaintag) {
					if (tag.startsWith("eternal_") && !tag.slice(8).startsWith("visible_")) {
						continue;
					}
					if (!tag.startsWith("visible_")) {
						continue;
					}

					if (!map.has(tag)) {
						map.set(tag, []);
					}

					map.get(tag).push(hidingCard);
				}
			}

			for (const [tag, card] of map) {
				player.removeGaintag(tag, card);
			}
		}

		hidingCards.removeArray(player.getShownCards());
		if (!hidingCards.length) {
			return;
		}
		event.cards = hidingCards;
		game.log(player, "取消明置了", event.cards);
		//if (event.animate != false) player.$give(hidingCards, player, false);
		await event.trigger("hideShownCardsAfter");
	},
	//Execute the delay card effect
	//执行延时锦囊牌效果
	//TODO: 修改此处的虚拟牌/实体牌判断
	async executeDelayCardEffect(event, trigger, player) {
		const { card } = event;
		const target = event.getTarget();

		target.$phaseJudge(card);
		event.cancelled = false;
		event.cardName = card.viewAs || card.name;
		target.popup(event.cardName, "thunder");

		if (!lib.card[event.cardName].effect) {
			await game.delay();
			return;
		} else if (!lib.card[event.cardName].judge) {
			await game.delay();
			event.nojudge = true;
		}

		await event.trigger("executeDelayCardEffect");
		if (event.cancelled || event.nojudge) {
			return;
		}

		const judgeEvent = player.judge({ card });
		const judge = event.judge;
		const judge2 = event.judge2;
		if (typeof judge === "function") {
			judgeEvent.judge = judge;
		}
		if (typeof judge2 === "function") {
			judgeEvent.judge2 = judge2;
		}

		const result = await judgeEvent.forResult();

		if (event.excluded) {
			delete event.excluded;
		} else {
			const cardName = event.cardName;
			if (event.cancelled && !event.direct) {
				const cardCancel = lib.card[cardName].cancel;
				if (cardCancel) {
					const next = game.createEvent(`${cardName}Cancel`);
					next.setContent(cardCancel);
					next.cards = card instanceof lib.element.Card ? [card] : (card.cards ?? []);
					if (!card.viewAs) {
						const autoViewAs = get.autoViewAs(card);
						next.card = autoViewAs;
						autoViewAs.expired = card.expired;
					} else {
						const autoViewAs = get.autoViewAs(
							{
								name: cardName,
							},
							next.cards
						);
						next.card = autoViewAs;
						autoViewAs.expired = card.expired;
					}
					next.player = player;

					await next;
				}
			} else {
				const next = game.createEvent(cardName);
				next.setContent(lib.card[cardName].effect);
				next._result = result;
				next.cards = card instanceof lib.element.Card ? [card] : (card.cards ?? []);
				if (!card.viewAs) {
					const autoViewAs = get.autoViewAs(card);
					next.card = autoViewAs;
					autoViewAs.expired = card.expired;
				} else {
					const autoViewAs = get.autoViewAs(
						{
							name: cardName,
						},
						next.cards
					);
					next.card = autoViewAs;
					autoViewAs.expired = card.expired;
				}
				next.player = player;
				await next;
			}
		}

		ui.clear();
		if (card instanceof lib.element.Card) {
			card.delete();
		}
	},
	//Gift
	//赠予
	async gift(event, trigger, player) {
		const { cards } = event;
		const target = event.getTarget();

		for (const card of cards) {
			event.card = card;
			await event.trigger("gift");

			if (event.deniedGifts.includes(card)) {
				game.log(target, "拒绝了", player, "赠予的", card);
				await event.trigger("giftDeny");

				const next = player.loseToDiscardpile({ cards: [card] });
				next.log = false;
				await next;

				await event.trigger("giftDenied");

				continue;
			}

			game.log(player, "将", card, "赠予了", target);
			player.$give(card, target, false);

			await game.delay(0.5);
			await event.trigger("giftAccept");

			if (get.type(card) == "equip") {
				const next = target.equip(card);
				next.log = false;
				await next;
			} else {
				const next = target.gain({ cards: [card], source: player });
				next.visible = true;
				await next;
			}

			await event.trigger("giftAccepted");
		}

		await game.delayx();
	},
	//Recast
	//重铸
	async recast(event, trigger, player) {
		const { cards } = event;

		game.log(player, "重铸了", cards);
		if (typeof event.recastingLose === "function") {
			const lose = event.trigger("recastingLose");
			const recast = event.recastingLose(player, cards);
			const lost = event.trigger("recastingLost");
			// ?
			event.recastingLosingEvents.push(...event.next.filter(value => value.name != "arrangeTrigger"));
			await lose;
			await recast;
			await lost;
		}

		await event.trigger("recast");

		if (typeof event.recastingGain === "function") {
			const gain = event.trigger("recastingGain");
			const recast = event.recastingGain(player, cards);
			const gained = event.trigger("recastingGained");
			// ?
			event.recastingGainingEvents.push(...event.next.filter(value => value.name != "arrangeTrigger"));
			await gain;
			await recast;
			await gained;
		}
	},
	//装备栏相关
	async disableEquip(event, trigger, player) {
		const cards: Card[] = [];
		event.cards = cards;
		const slots: string[] = [];
		if (get.is.mountCombined()) {
			for (const slot of event.slots) {
				if (slot == "equip3" || slot == "equip4") {
					slots.add("equip3_4");
				} else {
					slots.add(slot);
				}
			}
		} else {
			slots.addArray(event.slots);
		}

		slots.sort();
		if (!slots.length) {
			return;
		}

		for (const slot of slots) {
			const left = player.countEnabledSlot(slot);

			let slot_key = slot;
			let lose: number;
			if (slot == "equip3_4") {
				lose = Math.min(left, Math.max(get.numOf(event.slots, "equip3"), get.numOf(event.slots, "equip4")));
				slot_key = "equip3";
			} else {
				lose = Math.min(left, get.numOf(event.slots, slot));
			}

			if (lose > 0) {
				game.log(player, `废除了${get.cnNumber(lose)}个`, `#g${get.translation(slot)}栏`);
				player.disabledSlots ??= {};
				player.disabledSlots[slot_key] ??= 0;
				player.disabledSlots[slot_key] += lose;

				const discardingCards = player.getCards("e", card => {
					if (event.cards.includes(card)) {
						return false;
					}
					if (slot == "equip3_4") {
						return get.subtypes(card).some(subtype => subtype == "equip3" || subtype == "equip4");
					}
					return get.subtypes(card).includes(slot);
				});
				if (discardingCards.length < 0) {
					continue;
				}

				let result: EventResult;
				if (lose < left) {
					let source = event.source;
					const num = cards.length - (left - lose);
					if (!source || !source.isIn()) {
						source = player;
					}

					const selectedResult = await source
						.chooseButton({
							createDialog: [`选择${player == source ? "你" : get.translation(player)}的${get.cnNumber(num)}张${get.translation(slot)}牌置入弃牌堆`, cards],
							forced: true,
							selectButton: [1, num],
						})
						.set("filterOk", () => {
							const evt = get.event();

							let result = 0;
							for (const button of ui.selected.buttons) {
								if (evt.slot == "equip3_4") {
									result += Math.max(get.numOf(getButtonSubtypes("link" in button ? button.link : undefined), "equip3"), get.numOf(getButtonSubtypes("link" in button ? button.link : undefined), "equip4"));
								} else {
									result += get.numOf(getButtonSubtypes("link" in button ? button.link : undefined), evt.slot);
								}
							}

							return result === evt.required;
						})
						.set("required", num)
						.set("slot", slot)
						.forResult();
					result = normalizeSelectionResult(selectedResult);
				} else {
					result = { bool: true, links: discardingCards };
				}

				if (typeof result !== "string" && result.bool && isCardLinks(result.links)) {
					cards.addArray(result.links);
				}
			}
		}

		player.$syncDisable();
		if (cards.length > 0) {
			await player.loseToDiscardpile({ cards });
		}
	},
	async enableEquip(event, trigger, player) {
		const { slots } = event;
		if (!slots.length) {
			return;
		}

		const slotsx: string[] = [...new Set<string>(slots)].sort();
		for (const slot of slotsx) {
			const lost = player.countDisabledSlot(slot);
			const gain = Math.min(lost, get.numOf(slots, slot));
			if (lost <= 0) {
				continue;
			}

			game.log(player, `恢复了${get.cnNumber(gain)}个`, `#g${get.translation(slot)}栏`);
			player.disabledSlots ??= {};
			player.disabledSlots[slot] ??= 0;
			player.disabledSlots[slot] -= gain;
		}

		player.$syncDisable();
	},
};
