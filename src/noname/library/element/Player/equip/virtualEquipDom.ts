import { _status, game, get, lib, ui } from "noname";
import type { Card, GameEvent, Player, VCard } from "../../index.js";

type ExtraEquipSourceInfo = Player["extraEquip"][number];
type ExtraEquipRenderEntry = [info: ExtraEquipSourceInfo, label: string, subtype: string];

type ExtraEquipCardDom = Omit<Card, "extraEquip"> & {
	extraEquip?: ExtraEquipSourceInfo;
};

type DestroyedRule = boolean | string | ((card: Card, id: string, player: Player, event: GameEvent) => boolean | undefined);

type VirtualEquipCardDom = Omit<Card, "_destroyed_Virtua"> & {
	destroyLog?: boolean;
	destroyed?: DestroyedRule;
	_destroyed_Virtua?: DestroyedRule;
	suit?: string | null;
	number?: number | string | null;
};

type MaterialCardDom = Card & {
	goto: (target: HTMLElement | DocumentFragment) => void;
	destiny?: HTMLElement;
};

export const virtualEquipDomMethods = {
	removeVirtualEquip(this: Player, VCard: VCard): void {
		const player = this;
		game.addVideo("removeVirtualEquip", player, get.vcardInfo(VCard));
		game.broadcast(
			(VCard, player) => {
				const cards = player.vcardsMap?.equips;
				if (cards && cards.includes(VCard)) {
					cards.remove(VCard);
				}
			},
			VCard,
			player
		);
		const cards = player.vcardsMap?.equips;
		if (cards && cards.includes(VCard)) {
			player.removeEquipTrigger(VCard, true);
			cards.remove(VCard);
		}
		player.$handleEquipChange();
	},

	$handleEquipChange(this: Player): void {
		const player = this;
		const cards = Array.from(player.node.equips.children).filter((node): node is Card => node instanceof lib.element.Card) as unknown as ExtraEquipCardDom[];
		const cardsResume = cards.slice(0);
		const extraEquip: ExtraEquipRenderEntry[] = [];
		player.extraEquip.forEach(info => {
			if (player.hiddenSkills.includes(info[0])) {
				return;
			}
			const extra = `${get.translation(info[0])} ${get.translation(info[1])}`;
			const subtype = get.subtype(info[1]) as string;
			const preserve = info[2] && !info[2](player);
			if (!preserve && !extraEquip.map(entry => entry[1]).includes(info[1])) {
				extraEquip.add([info, extra, subtype]);
			}
		});
		cards.forEach(card => {
			const cardNode = card as unknown as Card;
			const num = get.equipNum(cardNode);
			let remove: boolean | number = false;
			if (card.name.indexOf("empty_equip") == 0) {
				if ((num == 4 || num == 3) && get.is.mountCombined()) {
					remove = !player.hasEmptySlot("equip3_4") || player.getEquips("equip3_4").length;
				} else if (!player.hasEmptySlot(num) || player.getEquips(num).length) {
					remove = true;
				}
				if (remove) {
					player.node.equips.removeChild(cardNode);
					cardsResume.remove(card);
				}
			}
			if (card.extraEquip && !remove) {
				const info = card.extraEquip,
					disable = card.classList.contains("feichu");
				const extra = extraEquip.find(infox => infox.every(item => (info as readonly unknown[]).includes(item)));
				if (!extra) {
					if (disable) {
						card.node.name2.innerHTML = get.translation("equip" + num) + " 已废除";
						delete card.extraEquip;
					} else {
						player.node.equips.removeChild(cardNode);
						cardsResume.remove(card);
					}
				} else {
					extraEquip.remove(extra);
				}
			} else if (card.classList.contains("feichu")) {
				const extra = extraEquip.find(info => info[2].includes("equip" + num));
				if (extra) {
					card.node.name2.innerHTML = extra[1];
					card.extraEquip = extra[0];
					extraEquip.remove(extra);
				}
			}
		});
		for (let i = 1; i <= 5; i++) {
			let add = false;
			if ((i == 4 || i == 3) && get.is.mountCombined()) {
				add = player.hasEmptySlot("equip3_4") && !player.getEquips("equip3_4").length;
			} else {
				add = player.hasEmptySlot(i) && !player.getEquips(i).length;
			}
			if (
				add &&
				!cardsResume.some(card => {
					const num = get.equipNum(card as unknown as Card);
					if ((i == 4 || i == 3) && get.is.mountCombined()) {
						return num == 4 || num == 3;
					} else {
						return num == i;
					}
				})
			) {
				const card = game.createCard("empty_equip" + i, "", "");
				card.fix();
				card.style.transform = "";
				card.classList.remove("drawinghidden");
				card.classList.add("emptyequip");
				card.classList.add("hidden");
				delete card._transform;
				const equipNum = get.equipNum(card);
				let equipped = false;
				for (const node of player.node.equips.children) {
					if (!(node instanceof lib.element.Card)) {
						continue;
					}
					if (get.equipNum(node) >= equipNum) {
						player.node.equips.insertBefore(card, node);
						equipped = true;
						break;
					}
				}
				if (!equipped) {
					player.node.equips.appendChild(card);
					if (_status.discarded) {
						_status.discarded.remove(card);
					}
				}
			}
		}
		extraEquip.forEach(info => {
			if (player.hasEmptySlot(info[2])) {
				const card = game.createCard("empty_" + info[2], "", "") as unknown as ExtraEquipCardDom;
				const cardNode = card as unknown as Card;
				card.fix();
				card.style.transform = "";
				card.classList.remove("drawinghidden");
				card.classList.add("emptyequip");
				card.node.name2.innerHTML = info[1];
				card.extraEquip = info[0];
				delete card._transform;
				const equipNum = get.equipNum(cardNode);
				let equipped = false;
				for (const node of player.node.equips.children) {
					if (!(node instanceof lib.element.Card)) {
						continue;
					}
					const equipNode = node as unknown as ExtraEquipCardDom;
					if (get.equipNum(node) == (info[2].at(-1) as any) && info && node.classList.contains("emptyequip") && !equipNode.extraEquip) {
						equipNode.node.name2.innerHTML = info[1];
						equipNode.extraEquip = info[0];
						equipNode.classList.remove("hidden");
						equipped = true;
						break;
					}
					if (get.equipNum(node) >= equipNum) {
						player.node.equips.insertBefore(cardNode, node);
						equipped = true;
						break;
					}
				}
				if (!equipped) {
					player.node.equips.appendChild(cardNode);
					if (_status.discarded) {
						_status.discarded.remove(cardNode);
					}
				}
			}
		});
	},

	addVirtualEquip(this: Player, card: Card | VCard, cards: Card[]): void {
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
				player.addVirtualEquip(card, cards);
			},
			player,
			card,
			cards
		);
		game.addVideo("addVirtualEquip", player, [get.vcardInfo(cardx), get.cardsInfo(cards)]);
		player.vcardsMap?.equips.push(cardx);
		player.vcardsMap?.equips.sort((a, b) => {
			return get.equipNum(a) - get.equipNum(b);
		});
		player.$addVirtualEquip(card, cards);
		player.addEquipTrigger(card);
	},

	$addVirtualEquip(this: Player, card: Card | VCard, cards: Card[]): void {
		if (game.online) {
			return;
		}
		const player = this;
		const isViewAsCard = cards.length !== 1 || cards[0].name !== card.name || !card.isCard,
			info = get.info(card, false);
		let cardShownName = get.translation(card.name);
		if (info.subtype === "equip3") {
			cardShownName += "+";
		} else if (info.subtype === "equip4") {
			cardShownName += "-";
		}
		let cardx: VirtualEquipCardDom;
		if (get.itemtype(card) == "card" && card.isViewAsCard) {
			cardx = card as unknown as VirtualEquipCardDom;
		} else {
			cardx = (isViewAsCard ? game.createCard(card.name, cards.length == 1 ? get.suit(cards[0]) : "none", cards.length == 1 ? get.number(cards[0]) : 0) : cards[0]) as unknown as VirtualEquipCardDom;
		}
		game.broadcastAll(
			(player: Player, cardx: VirtualEquipCardDom, isViewAsCard: boolean, card: Card | VCard, cards: MaterialCardDom[], cardShownName: string) => {
				cardx.fix();
				if (!cardx.isViewAsCard) {
					const cardSymbol = Symbol("card");
					cardx.cardSymbol = cardSymbol;
					cardx[cardSymbol] = card;
				}
				const cardWithSubtypes = card as Card | (VCard & { subtypes?: string[] });
				if (cardWithSubtypes.subtypes) {
					cardx.subtypes = cardWithSubtypes.subtypes;
				}
				cardx.style.transform = "";
				cardx.classList.remove("drawinghidden");
				delete cardx._transform;
				if (isViewAsCard && !cardx.isViewAsCard) {
					cardx.isViewAsCard = true;
					cardx.destroyLog = false;
					for (const i of cards) {
						i.goto(ui.special);
						i.destiny = player.node.equips;
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
						if (id != "equip") {
							return true;
						}
					};
				}
				const suit = get.translation(cardx.suit),
					number = get.strNumber(cardx.number as number);
				if (isViewAsCard) {
					cardx.cards = cards || [];
					cardx.viewAs = card.name;
					cardx.node.name2.innerHTML = `${suit}${number} [${cardShownName}]`;
					cardx.classList.add("fakeequip");
				} else {
					delete cardx.viewAs;
					cardx.node.name2.innerHTML = `${suit}${number} ${cardShownName}`;
					cardx.classList.remove("fakeequip");
				}
				const domCard = cardx as unknown as Card;
				let equipped = false;
				const equipNum = get.equipNum(domCard);
				if (player.node.equips.childNodes.length) {
					for (let i = 0; i < player.node.equips.childNodes.length; i++) {
						if (get.equipNum(player.node.equips.childNodes[i]) >= equipNum) {
							equipped = true;
							player.node.equips.insertBefore(domCard, player.node.equips.childNodes[i]);
							break;
						}
					}
				}
				if (equipped === false) {
					player.node.equips.appendChild(domCard);
					if (cards?.length && _status.discarded) {
						_status.discarded.removeArray(cards);
					}
				}
			},
			player,
			cardx,
			isViewAsCard,
			card,
			cards as MaterialCardDom[],
			cardShownName
		);
	},

	$equip(this: Player, card: Card): Player {
		game.broadcast(
			function (player, card) {
				player.$equip(card);
			},
			this,
			card
		);
		card.fix();
		card.style.transform = "";
		card.classList.remove("drawinghidden");
		delete card._transform;
		const player = this;
		const equipNum = get.equipNum(card);
		let equipped = false;
		for (let i = 0; i < player.node.equips.childNodes.length; i++) {
			if (get.equipNum(player.node.equips.childNodes[i]) >= equipNum) {
				player.node.equips.insertBefore(card, player.node.equips.childNodes[i]);
				equipped = true;
				break;
			}
		}
		if (!equipped) {
			player.node.equips.appendChild(card);
			if (_status.discarded) {
				_status.discarded.remove(card);
			}
		}
		const info = get.info(card);
		if (info.skills) {
			for (let i = 0; i < info.skills.length; i++) {
				player.addSkillTrigger(info.skills[i]);
			}
		}
		return player;
	},
};
