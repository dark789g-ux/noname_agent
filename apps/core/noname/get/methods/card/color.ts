import { game, lib, _status, ui } from "noname";
import { get } from "../../dependencies.js";

export const cardColorMethods = {
	/**
	 * 返回牌的颜色
	 * @param {Card | VCard | CardBaseUIData | Card[] | VCard[] | CardBaseUIData[] | undefined} card
	 * @param {false | Player} [player]
	 * @returns {string | undefined}
	 */
	color(card: Card | VCard | CardBaseUIData | Card[] | VCard[] | CardBaseUIData[] | undefined, player: false | Player | undefined) {
		if (typeof card !== "object") {
			return;
		}
		if (Array.isArray(card)) {
			if (!card.length) {
				return "none";
			}
			const cards = card.slice();
			const firstCard = cards.shift();
			if (!firstCard) {
				return "none";
			}
			const color = get.color(firstCard, player);
			for (const anotherCard of cards) {
				if (get.color(anotherCard, player) != color) {
					return "none";
				}
			}
			return color;
		} else if ("color" in card && (card.color === "unsure" || (typeof card.color == "string" && Object.keys(lib.color).includes(card.color)))) {
			return card.color;
		} else if ("cards" in card && Array.isArray(card.cards) && (!("suit" in card) || typeof card.suit != "string" || !lib.suit.includes(card.suit))) {
			return get.color(card.cards, player);
		} else {
			const suit = get.suit(card, player);
			if (typeof suit != "string") {
				return "none";
			}
			for (const entry of Object.entries(lib.color)) {
				if (entry[1].includes(suit)) {
					return entry[0];
				}
			}
			return "none";
		}
	},

	/**
	 * 返回牌的点数
	 * @param {Card | VCard | CardBaseUIData | Card[] | VCard[] | CardBaseUIData[] | undefined} card
	 * @param {false | Player} [player]
	 * @returns {number | "unsure" | null | undefined}
	 */
	number(card: Card | VCard | CardBaseUIData | Card[] | VCard[] | CardBaseUIData[] | undefined, player: false | Player | undefined) {
		if (typeof card !== "object") {
			return;
		}
		if (Array.isArray(card)) {
			if (card.length == 1) {
				return get.number(card[0], player);
			}
			return null;
		}
		//狗卡你是真敢出啊
		/** @type {number | "unsure" | null | undefined} */
		let number: number | "unsure" | null | undefined = null;
		if ("number" in card) {
			number = card.number;
			if (typeof number == "string") {
				if (number === "unsure") {
					return number;
				}
				number = null;
			} else if (typeof number != "number") {
				number = null;
			}
		} else {
			if ("cards" in card && Array.isArray(card.cards) && card.cards.length == 1) {
				number = get.number(card.cards[0], false);
			}
		}
		if (number === "unsure" || number === undefined) {
			return number;
		}
		if (player !== false) {
			let owner = player || get.owner(card);
			if (owner) {
				return game.checkMod(card, owner, number, "cardnumber", owner);
			}
		}
		return number;
	},

	/**
	 * 返回一张杀的属性。如有多种属性则用`lib.natureSeparator`分割开来。例：火雷【杀】的返回值为`fire|thunder`
	 * @param {string | string[] | Card | VCard | CardBaseUIData} card
	 * @param {false | Player} [player]
	 * @returns {string | boolean | null | undefined}
	 */
	nature(card: string | Card | VCard | CardBaseUIData | string[], player: false | Player | undefined) {
		if (typeof card == "string") {
			return card.split(lib.natureSeparator).sort(lib.sort.nature).join(lib.natureSeparator);
		}
		if (Array.isArray(card)) {
			return card.sort(lib.sort.nature).join(lib.natureSeparator);
		}
		let nature = card.nature;
		if (typeof nature == "boolean") {
			return nature;
		}
		if (get.itemtype(player) == "player" || (player !== false && get.position(card, undefined) == "h")) {
			let owner = get.owner(card);
			if (owner) {
				return game.checkMod(card, owner, nature, "cardnature", owner);
			}
		}
		return nature;
	},

	/**
	 * 返回包含所有属性的数组
	 * @param {string[] | string | Card | VCard | CardBaseUIData} card
	 * @param {false | Player} [player]
	 * @returns {string[]}
	 */
	natureList(card: string | Card | VCard | CardBaseUIData | string[], player: false | Player | undefined) {
		if (!card) {
			return [];
		}
		if (typeof card == "string" && get.itemtype(card) == "natures") {
			return card.split(lib.natureSeparator);
		}
		if (typeof card == "string" && get.itemtype(card) == "nature") {
			return [card];
		}
		const natures = get.nature(card, player);
		if (typeof natures != "string") {
			return [];
		}
		return natures.split(lib.natureSeparator);
	},

	/**
	 * 返回如何响应此牌的一个数组，其中包含字符串或者函数，具体用法可见player.canRespond
	 * @param {string | Card | VCard | CardBaseUIData } card（也支持一些标签，如trick，damage和all）
	 * @param {false | Player} [player]
	 * @returns {(string | ((card: Card | VCard | CardBaseUIData, player: Player) => boolean))[]}
	 */
	canRespond(card: string | Card | VCard | CardBaseUIData, player: false | Player | undefined) {
		let name;
		if (typeof card == "object") {
			name = get.name(card, player);
		} else {
			name = card;
		}
		if (typeof name != "string") {
			return [];
		}
		const filter = lib.respondMap[name];
		if (Array.isArray(filter)) {
			return filter;
		}
		if (typeof filter == "function") {
			return [filter];
		}
		return [];
	},

	/**
	 * 返回牌堆顶的牌
	 * @param { number } [num = 1] 默认为1
	 * @param { boolean } [putBack] 是否放回牌堆顶
	 * @returns { Card[] }
	 */
	cards(num: number | undefined, putBack: boolean | undefined) {
		if (_status.waitingForCards) {
			ui.create.cards.apply(ui.create, _status.waitingForCards);
			delete _status.waitingForCards;
		}
		let list: any[] = [];
		if (typeof num != "number") {
			num = 1;
		}
		if (num <= 0) {
			return [];
		}
		while (num--) {
			if (ui.cardPile.hasChildNodes() == false) {
				game.washCard();
			}
			if (ui.cardPile.hasChildNodes() == false) {
				game.over("平局");
				return [];
			}
			const cardx = ui.cardPile.firstChild;
			if (!(cardx instanceof lib.element.Card)) {
				throw new TypeError("card pile contains a non-card node");
			}
			ui.cardPile.removeChild(cardx);
			cardx.original = "c";
			list.push(cardx);
		}
		if (putBack) {
			for (let i = list.length - 1; i >= 0; i--) {
				ui.cardPile.insertBefore(list[i], ui.cardPile.firstChild);
			}
		}
		game.updateRoundNumber();
		return list;
	},

	judge(card) {
		const cardInfo = card.viewAs ? lib.card[card.viewAs] : get.info(card);
		return cardInfo && cardInfo.judge ? cardInfo.judge : () => 0;
	},

	judge2(card) {
		return card.viewAs ? lib.card[card.viewAs].judge2 : get.info(card).judge2;
	},

	/**
	 * @deprecated
	 */
	_autoViewAs(card, cards) {
		let info = get.info(card);
		if (info.autoViewAs) {
			if (cards === false) {
				return {
					name: info.autoViewAs,
				};
			} else if (Array.isArray(cards)) {
				return {
					name: info.autoViewAs,
					cards: cards.slice(0),
				};
			} else if (get.itemtype(card) == "card") {
				return {
					name: info.autoViewAs,
					cards: [card],
				};
			} else {
				return {
					name: info.autoViewAs,
					suit: card.suit,
					number: card.number,
					nature: card.nature,
				};
			}
		} else {
			if (card.isCard || get.itemtype(card) == "card") {
				let next = {
					name: get.name(card),
					suit: get.suit(card),
					number: get.number(card),
					nature: get.nature(card),
					isCard: true,
					cardid: card.cardid,
					wunature: card.wunature,
					storage: get.copy(card.storage),
					cards: get.copy(card.cards),
				};
				if (get.itemtype(cards) == "cards" && !card.cards) {
					next.cards = cards.slice(0);
				} else if (get.itemtype(card) == "card") {
					next.cards = [card];
				}
				return next;
			} else if (get.is.object(card) && get.itemtype(cards) == "cards" && !card.cards) {
				card = get.copy(card);
				card.cards = cards.slice(0);
			}
			return card;
		}
	},

	/**
	 * 获取一张装备牌的兵主
	 * @param { string | Card | VCard  } name
	 * @returns {String[]}
	 */
	bingzhu(name: string | Card | VCard) {
		const cardName = typeof name == "string" ? name : get.name(name);
		const propertyName = `${cardName}`;
		const list: any[] = [],
			info = lib.card[propertyName];
		if (lib.cardBingzhu[propertyName]) {
			list.addArray(lib.cardBingzhu[propertyName]);
		}
		if (info.derivation) {
			const names = get.characterSurname(info.derivation).map(list => list.join(""));
			list.addArray(names);
		}
		if (info.bingzhu) {
			list.addArray(info.bingzhu);
		}
		return list.filter(surname => surname !== "某");
	},
};
