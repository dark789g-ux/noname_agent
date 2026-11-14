import { _status, game, get, lib, ui } from "noname";
import type { Card, GameEvent, Player, VCard } from "../../index.js";

type DestroyedRule = boolean | string | ((card: Card, id: string, player: Player, event: GameEvent) => boolean | undefined);

type VirtualJudgeCardDom = Omit<Card, "_destroyed_Virtua"> & {
	destroyLog?: boolean;
	destroyed?: DestroyedRule;
	_destroyed_Virtua?: DestroyedRule;
};

type MaterialCardDom = Card & {
	goto: (target: HTMLElement | DocumentFragment) => void;
	destiny?: HTMLElement;
};

export const virtualJudgeAndTriggerMethods = {
	addEquipTrigger(this: Player, card?: Card | VCard): Player {
		if (card) {
			const skills = get.skillsFromEquips([card] as Card[] | VCard[]);
			if (skills?.length) {
				skills.forEach(i => this.addSkillTrigger(i));
			}
		} else {
			const es = this.getVCards("e");
			for (let i = 0; i < es.length; i++) {
				this.addEquipTrigger(es[i]);
			}
		}
		_status.event.clearStepCache();
		return this;
	},

	removeVirtualJudge(this: Player, VCard: VCard): void {
		const player = this;
		game.addVideo("removeVirtualJudge", player, get.vcardInfo(VCard));
		game.broadcast(
			(VCard, player) => {
				const cards = player.vcardsMap?.judges;
				if (cards && cards.includes(VCard)) {
					cards.remove(VCard);
				}
			},
			VCard,
			player
		);
		const cards = player.vcardsMap?.judges;
		if (cards && cards.includes(VCard)) {
			cards.remove(VCard);
		}
		if (VCard.storage.equipEnable && VCard.cards?.some(card => get.type(card) == "equip")) {
			const es = player.getVCards("e"),
				equips = VCard.cards;
			if (equips.length) {
				const keepSkills = Object.values(player.additionalSkills).flat().concat(get.skillsFromEquips(es)),
					skills = get.skillsFromEquips(equips).removeArray(keepSkills);
				if (skills.length) {
					player.removeSkill(skills);
				}
			}
		}
	},

	removeEquipTrigger(this: Player, card?: Card | VCard, hasMove?: boolean): Player | undefined {
		if (_status.video) {
			return;
		}
		if (card) {
			const info = get.info(card, false);
			const skills = this.getSkills(null, false);
			const VEquips = this.getVCards("e");
			const equip = VEquips.find(current => current === card);
			if (equip) {
				VEquips.remove(equip);
			}
			skills.addArray(get.skillsFromEquips(VEquips));
			const cards = this.vcardsMap?.equips;
			const mappedEquip = cards?.find(current => current === card);
			if (mappedEquip && hasMove !== true) {
				cards?.remove(mappedEquip);
			}
			if (info.skills) {
				for (let j = 0; j < info.skills.length; j++) {
					if (skills.includes(info.skills[j])) {
						continue;
					}
					this.removeSkillTrigger(info.skills[j]);
				}
			}
			if (info.clearLose && typeof info.onLose == "function") {
				const next = game.createEvent("lose_" + card.name);
				next.setContent(info.onLose);
				next.player = this;
				next.card = card;
			}
		} else {
			const es = this.getVCards("e");
			for (let i = 0; i < es.length; i++) {
				this.removeEquipTrigger(es[i], hasMove);
			}
		}
		_status.event.clearStepCache();
		return this;
	},

	addVirtualJudge(this: Player, card: Card | VCard, cards: Card[]): void {
		let cardx: VCard;
		if (get.itemtype(card) == "card" && card.isViewAsCard && card.cardSymbol !== undefined) {
			cardx = card[card.cardSymbol];
		} else {
			cardx = card as VCard;
		}
		cardx.initID();
		const player = this;
		game.broadcast(
			(player, card, cards) => {
				player.addVirtualJudge(card, cards);
			},
			player,
			card,
			cards
		);
		game.addVideo("addVirtualJudge", player, [get.vcardInfo(cardx), get.cardsInfo(cards)]);
		player.vcardsMap?.judges.push(cardx);
		if (_status.discarded) {
			_status.discarded.removeArray(cards);
		}
		player.$addVirtualJudge(card, cards);
		if (cardx.storage.equipEnable && (cardx.cards || cards).some(card => get.type(card) == "equip")) {
			const equips = (cardx.cards || cards).filter(card => get.type(card) == "equip");
			if (equips.length) {
				const skills = get.skillsFromEquips(equips);
				if (skills.length) {
					player.addSkill(skills);
				}
			}
			game.addGlobalSkill("equipEnableSkill");
		}
	},

	$addVirtualJudge(this: Player, VCard: Card | VCard, cards: Card[]): void {
		if (game.online) {
			return;
		}
		const player = this,
			card = VCard;
		const isViewAsCard = cards.length !== 1 || cards[0].name !== VCard.name || !card.isCard;
		let cardx: VirtualJudgeCardDom;
		if (get.itemtype(card) == "card" && card.isViewAsCard) {
			cardx = card as unknown as VirtualJudgeCardDom;
		} else {
			cardx = (isViewAsCard ? game.createCard(card.name, cards.length == 1 ? get.suit(cards[0]) : "none", cards.length == 1 ? get.number(cards[0]) : 0) : cards[0]) as unknown as VirtualJudgeCardDom;
		}
		game.broadcastAll(
			(player: Player, cardx: VirtualJudgeCardDom, isViewAsCard: boolean, VCard: Card | VCard, cards: MaterialCardDom[]) => {
				cardx.fix();
				if (!cardx.isViewAsCard) {
					const cardSymbol = Symbol("card");
					cardx.cardSymbol = cardSymbol;
					cardx[cardSymbol] = VCard;
				}
				cardx.style.transform = "";
				cardx.classList.remove("drawinghidden");
				delete cardx._transform;
				if (isViewAsCard && !cardx.isViewAsCard) {
					cardx.isViewAsCard = true;
					cardx.destroyLog = false;
					for (const i of cards) {
						i.goto(ui.special);
						i.destiny = player.node.judges;
					}
					if (cardx.destroyed) {
						cardx._destroyed_Virtua = cardx.destroyed;
					}
					cardx.destroyed = function (card: any, id: string, player: Player, event: GameEvent) {
						if (card._destroyed_Virtua) {
							if (typeof card._destroyed_Virtua == "function") {
								const bool = card._destroyed_Virtua(card, id, player, event);
								if (bool === true) {
									return true;
								}
							} else if (lib.skill[card._destroyed_Virtua]) {
								if (player) {
									if (player.hasSkill(card._destroyed_Virtua)) {
										delete card._destroyed_Virtua;
										return false;
									}
								}
								return true;
							} else if (typeof card._destroyed_Virtua == "string") {
								return card._destroyed_Virtua == id;
							} else if (card._destroyed_Virtua === true) {
								return true;
							}
						}
						if (id == "ordering" && ["phaseJudge", "executeDelayCardEffect"].includes(event.getParent().name as string)) {
							return false;
						}
						if (id != "judge") {
							return true;
						}
					};
				}
				cardx.classList.add("drawinghidden");
				if (isViewAsCard) {
					cardx.cards = cards || [];
					cardx.viewAs = VCard.name;
					if (cardx.classList.contains("fullskin") || cardx.classList.contains("fullborder") || cardx.classList.contains("fullimage")) {
						cardx.classList.add("fakejudge");
						if (cardx.classList.contains("fullimage")) {
							cardx.classList.remove("fullimage");
							cardx.classList.add("fullskin");
							cardx.style.backgroundImage = "";
						}
						cardx.node.background.innerHTML = lib.translate[cardx.viewAs + "_bg"] || get.translation(cardx.viewAs)[0];
					}
				} else {
					delete cardx.viewAs;
					cardx.classList.remove("fakejudge");
				}
				const domCard = cardx as unknown as Card;
				player.node.judges.insertBefore(domCard, player.node.judges.firstChild);
				ui.updatej(player);
			},
			player,
			cardx,
			isViewAsCard,
			VCard,
			cards as MaterialCardDom[]
		);
	},
};
