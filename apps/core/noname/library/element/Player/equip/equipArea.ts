import { _status, game, get, lib, ui } from "noname";
import type { Card, GameEvent, Player, VCard } from "../../index.js";

type LoseHistoryRecord = {
	player: Player;
	hs: Card[];
	es: Card[];
	js: Card[];
	ss: Card[];
	xs: Card[];
	cards: Card[];
	cards2: Card[];
	gaintag_map: Record<string, string[]>;
	vcard_map: Map<Card, VCard>;
};

type EquipEventDraft = GameEvent & {
	cards: Card[];
	vcard?: VCard;
	draw?: boolean;
	getd: (this: GameEvent, player?: Player, key?: string, position?: HTMLElement | DocumentFragment) => Card[];
	getl: (this: GameEvent, player: Player) => LoseHistoryRecord;
	getg: (player?: Player) => Card[];
};

export const equipAreaMethods = {
	/**
	 * 获取一名角色装备区内某种类型的装备牌
	 *
	 * 参数可以为数字/区域字符串/实体牌/虚拟牌/牌名
	 */
	getEquips(this: Player, subtype: number | string | Card | VCard): Card[] {
		const VEquips = this.getVEquips(subtype);
		return VEquips.reduce<Card[]>((cards, vcard) => {
			cards.addArray(vcard.cards || []);
			return cards;
		}, []);
	},

	/**
	 * 获取一名角色装备区内某种类型的虚拟牌
	 *
	 * 参数可以为数字/区域字符串/实体牌/虚拟牌/牌名
	 */
	getVEquips(this: Player, subtype: number | string | Card | VCard): VCard[] {
		let normalizedSubtype: string | undefined;
		switch (typeof subtype) {
			case "string":
				normalizedSubtype = subtype;
				if (subtype == "equip3_4") {
					const cards: VCard[] = [];
					cards.addArray(this.getVEquips(3));
					cards.addArray(this.getVEquips(4));
					return cards;
				} else if (subtype.startsWith("equip") && parseInt(subtype.slice(5)) > 0) {
					break;
				} else if (lib.card[subtype]) {
					return this.getVCards("e", card => card.name == subtype);
				} else {
					return [];
				}
			case "number":
				normalizedSubtype = "equip" + subtype;
				break;
			case "object":
				normalizedSubtype = get.subtype(subtype, false);
				break;
			default:
				return [];
		}
		if (!normalizedSubtype) {
			return [];
		}
		return this.getVCards("e", card => {
			return get.subtypes(card, false).includes(normalizedSubtype);
		});
	},

	/**
	 * 判断角色是否能够装备指定的牌
	 */
	canEquip(this: Player, name: string | Card | VCard | CardBaseUIData, replace?: boolean): boolean {
		const ranges = get.subtypes(name),
			rangex: string[] = [],
			combined = get.is.mountCombined();
		if (combined) {
			ranges.forEach(type => {
				if (type == "equip3" || type == "equip4") {
					rangex.add("equip3_4");
				} else {
					rangex.add(type);
				}
			});
		} else {
			rangex.push(...new Set(ranges));
		}
		if (name instanceof lib.element.Card) {
			const owner = get.owner(name, "judge");
			if (owner && !lib.filter.canBeGained(name, this, owner)) {
				return false;
			}
		}
		for (const range of rangex) {
			let num = this.countEquipableSlot(range);
			const num2 = get.numOf(rangex, range);
			if (!replace) {
				num -= this.getVEquips(range).filter(card => lib.filter.canBeReplaced(card, this)).length;
			}
			if (num < num2) {
				return false;
			}
		}
		return true;
	},

	/**
	 * 与target交换装备区里的牌
	 */
	swapEquip(this: Player, target: Player): GameEvent {
		const next = game.createEvent("swapEquip");
		next.player = this;
		next.target = target;
		next.setContent("swapEquip");
		return next;
	},

	equip(this: Player, card: Card | VCard | CardBaseUIData, draw?: boolean): GameEvent {
		const next = game.createEvent("equip") as EquipEventDraft;
		next.player = this;
		next.setContent(lib.element.content.equip as any);
		const itemtype = get.itemtype(card);
		if (itemtype === "card") {
			next.cards = [card as Card];
		} else {
			next.cards = (card?.cards || []) as Card[];
		}
		if ("isViewAsCard" in card && card.isViewAsCard && card.cardSymbol !== undefined) {
			next.card = card as Card | VCard;
			next.cards = card[card.cardSymbol].cards as Card[];
			next.vcard = card[card.cardSymbol];
		} else {
			next.card = card as Card | VCard;
		}
		if (draw) {
			next.draw = true;
		}
		//检查card合法性
		if ((next.cards.length > 1 && (next.cards as Card[]).some(cardx => cardx.isViewAsCard)) || !next.card.name) {
			//装备牌的实体牌数大于1时需要全部都为真实卡牌
			_status.event.next.remove(next);
			next.resolve();
		}
		next.getd = function (player, key, position) {
			if (!position) {
				position = ui.discardPile;
			}
			if (!key) {
				key = "cards";
			}
			const cards: Card[] = [],
				event = this;
			game.checkGlobalHistory("cardMove", function (evt: any) {
				if (evt.name != "lose" || evt.position != position || evt.getParent() != event) {
					return;
				}
				if (player && player != evt.player) {
					return;
				}
				cards.addArray(evt[key]);
			});
			return cards;
		};
		next.getl = function (player) {
			const that = this;
			const map: LoseHistoryRecord = {
				player: player,
				hs: [],
				es: [],
				js: [],
				ss: [],
				xs: [],
				cards: [],
				cards2: [],
				gaintag_map: {},
				vcard_map: new Map(),
			};
			player.checkAllHistory("lose", function (evt: any) {
				if (evt.parent == that) {
					map.hs.addArray(evt.hs);
					map.es.addArray(evt.es);
					map.js.addArray(evt.js);
					map.ss.addArray(evt.ss);
					map.xs.addArray(evt.xs);
					map.cards.addArray(evt.cards);
					map.cards2.addArray(evt.cards2);
					for (const key in evt.gaintag_map) {
						if (!map.gaintag_map[key]) {
							map.gaintag_map[key] = [];
						}
						map.gaintag_map[key].addArray(evt.gaintag_map[key]);
					}
					evt.vcard_map.forEach((value: VCard, key: Card) => {
						map.vcard_map.set(key, value);
					});
				}
			});
			return map;
		};
		next.getg = function (player) {
			return [];
		};
		return next;
	},

	getVEquip(this: Player, name: number | string | Card | VCard | CardBaseUIData): VCard | null {
		const es = this.getVCards("e");
		let target: number | string | undefined;
		if (typeof name == "object" && name !== null && get.info(name)) {
			const subtype = get.info(name).subtype;
			if (subtype) {
				target = parseInt(subtype[5]);
			}
		} else if (typeof name == "string" && name.startsWith("equip") && name.length == 6) {
			target = parseInt(name[5]);
		} else if (typeof name == "number" || typeof name == "string") {
			target = name;
		}
		if (!target) {
			return null;
		}
		for (let i = 0; i < es.length; i++) {
			if (typeof target === "number") {
				if (get.info(es[i]).subtype === "equip" + target) {
					return es[i];
				}
			} else {
				if (es[i].name === target) {
					return es[i];
				}
				const source = get.info(es[i]).source;
				if (Array.isArray(source) && source.includes(target)) {
					return es[i];
				}
			}
		}
		return null;
	},

	getEquip(this: Player, name: number | string | Card | VCard | CardBaseUIData): Card | null {
		const es = this.getCards("e");
		let target: number | string | undefined;
		if (typeof name == "object" && name !== null && get.info(name)) {
			const subtype = get.info(name).subtype;
			if (subtype) {
				target = parseInt(subtype[5]);
			}
		} else if (typeof name == "string" && name.startsWith("equip") && name.length == 6) {
			target = parseInt(name[5]);
		} else if (typeof name == "number" || typeof name == "string") {
			target = name;
		}
		if (!target) {
			return null;
		}
		for (let i = 0; i < es.length; i++) {
			if (typeof target === "number") {
				if (get.info(es[i]).subtype === "equip" + target) {
					return es[i];
				}
			} else {
				if (es[i].name === target) {
					return es[i];
				}
				const source = get.info(es[i]).source;
				if (Array.isArray(source) && source.includes(target)) {
					return es[i];
				}
			}
		}
		return null;
	},
};
