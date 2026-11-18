import { game, lib, _status } from "noname";
import { get } from "../../dependencies.js";

import type { YingbianCard, OwnerQueryCard } from "../../contracts/types.js";

export const cardSkillsFromEquipsMethods = {
	/**
	 * 获取装备牌对应的技能
	 * @param { Card[]|VCard[] } cards
	 * @returns { any[] }
	 */
	skillsFromEquips(cards: Card[] | VCard[]) {
		return cards.reduce((skills: never[], card: Card | VCard) => {
			// @ts-expect-error ignore
			if (Array.isArray(card.skills)) {
				// @ts-expect-error ignore
				skills.addArray(card.skills);
				return skills;
			}
			const info = get.info(card, false);
			if (info.skills) {
				skills.addArray(info.skills);
			}
			return skills;
		}, []);
	},

	/**
	 * 返回 VCard[] 形式的所有牌，用于印卡将遍历
	 * @param {Function} [filter]
	 * @returns {string[][]}
	 */
	inpileVCardList(filter: Function | undefined) {
		let list: any[] = [];
		for (const name of lib.inpile) {
			const type = get.type(name);
			const info = [type, "", name];
			if (!filter || filter(info)) {
				list.push(info);
			}
			if (name == "sha") {
				for (const nature of lib.inpile_nature) {
					const info = [type, "", name, nature];
					if (!filter || filter(info)) {
						list.push(info);
					}
				}
			}
		}
		return list;
	},

	/**
	 * Get the card name length
	 *
	 * 获取此牌的字数
	 * @param { Card } card
	 * @param { Player } [player]
	 * @returns { number }
	 */
	cardNameLength(card: Card, player: Player | undefined) {
		const actualCardName = lib.actualCardName,
			name = get.translation(typeof card == "string" ? card : get.name(card, player)),
			actualName = actualCardName.get(name);
		return (actualName === undefined ? name : actualName).length;
	},

	//Yingbian
	//应变
	/**
	 * Get the Yingbian conditions (of the card)
	 *
	 * 获取（此牌的）应变条件
	 */
	yingbianConditions(card) {
		return get.complexYingbianConditions(card).concat(get.simpleYingbianConditions(card));
	},

	complexYingbianConditions(card) {
		const complexYingbianConditions = Array.from(lib.yingbian.condition.complex.keys());
		return card ? complexYingbianConditions.filter((value: string) => get.cardtag(card, `yingbian_${value}`)) : complexYingbianConditions;
	},

	simpleYingbianConditions(card) {
		const simpleYingbianConditions = Array.from(lib.yingbian.condition.simple.keys());
		return card ? simpleYingbianConditions.filter((value: string) => get.cardtag(card, `yingbian_${value}`)) : simpleYingbianConditions;
	},

	/**
	 * Get the Yingbian effects (of the card)
	 *
	 * 获取（此牌的）应变效果
	 */
	yingbianEffects(card) {
		const yingbianEffects = Array.from(lib.yingbian.effect.keys());
		return card ? yingbianEffects.filter((value: string) => get.cardtag(card, `yingbian_${value}`)) : yingbianEffects;
	},

	/**
	 * Get the default Yingbian effect of the card
	 *
	 * 获取此牌的默认应变效果
	 */
	defaultYingbianEffect(card) {
		const info = get.info(card);
		return (info && info.defaultYingbianEffect) || null;
	},

	/**
	 * 新装备栏相关
	 *
	 * 获取一张装备牌实际占用的装备栏(君曹操六龙)
	 *
	 * 用法同{@link subtype}，返回数组
	 *
	 * @param { string | ((Card | VCard | CardBaseUIData) & { subtypes?: string[] }) } obj
	 * @param { false | Player } [player]
	 * @returns { string[] }
	 */
	subtypes(obj: string | ((Card | VCard | CardBaseUIData) & { subtypes?: string[] }), player: false | Player | undefined) {
		if (typeof obj == "string") {
			obj = { name: obj };
		}
		if (typeof obj != "object" || obj === null) {
			return [];
		}
		if (Array.isArray(obj.subtypes)) {
			return get.copy(obj.subtypes);
		}
		let name = get.name(obj, player);
		if (!lib.card[name]) {
			return [];
		}
		if (lib.card[name].subtypes) {
			const subtypes = get.copy(lib.card[name].subtypes);
			return subtypes;
		} else if (lib.card[name].subtype) {
			const subtype = lib.card[name].subtype;
			return [subtype];
		}
		return [];
	},

	position(card, ordering) {
		//哪个大聪明在返回牌位置的函数写返回玩家位置的功能
		if (get.itemtype(card) == "player") {
			return parseInt(card.dataset.position);
		}
		if (!card) {
			return null;
		}
		if (get.itemtype(card) == "vcard") {
			if (card.cards) {
				return get.position(card.cards[0], ordering);
			}
			return null;
		}
		if (card.timeout && card.destiny && card.destiny.classList) {
			if (card.destiny.classList.contains("equips")) {
				return "e";
			}
			if (card.destiny.classList.contains("judges")) {
				return "j";
			}
			if (card.destiny.classList.contains("expansions")) {
				return "x";
			}
			if (card.destiny.classList.contains("handcards")) {
				return card.classList.contains("glows") ? "s" : "h";
			}
			if (card.destiny.id == "cardPile") {
				return "c";
			}
			if (card.destiny.id == "discardPile") {
				return "d";
			}
			if (card.destiny.id == "special") {
				return "s";
			}
			if (card.destiny.id == "ordering") {
				return ordering ? "o" : "d";
			}
			return null;
		}
		if (!card.parentNode || !card.parentNode.classList) {
			return;
		}
		if (card.parentNode.classList.contains("equips")) {
			return "e";
		}
		if (card.parentNode.classList.contains("judges")) {
			return "j";
		}
		if (card.parentNode.classList.contains("expansions")) {
			return "x";
		}
		if (card.parentNode.classList.contains("handcards")) {
			return card.classList.contains("glows") ? "s" : "h";
		}
		if (card.parentNode.id == "cardPile") {
			return "c";
		}
		if (card.parentNode.id == "discardPile") {
			return "d";
		}
		if (card.parentNode.id == "special") {
			return "s";
		}
		if (card.parentNode.id == "ordering") {
			return ordering ? "o" : "d";
		}
		return null;
	},

	/**
	 * 返回玩家本回合牌的使用次数
	 * @overload
	 * @param { true } card
	 * @param { Player } [player = _status.event.player]
	 * @returns { number }
	 *
	 * @overload
	 * @param { Card } card
	 * @param { Player } [player = _status.event.player]
	 * @returns { number }
	 *
	 * @overload
	 * @param { string } card 牌名
	 * @param { Player } [player = _status.event.player]
	 * @returns { number }
	 */
	cardCount(card, player) {
		let num;
		if (player == undefined) {
			player = _status.event.player;
		}
		if (card == true) {
			num = 0;
			let stat = player.getStat("card");
			for (let i in stat) {
				if (typeof stat[i] == "number") {
					num += stat[i];
				}
			}
			return num;
		}
		if (typeof card == "object") {
			card = card.name;
		}
		num = player.getStat("card")[card];
		if (num == undefined) {
			return 0;
		}
		return num;
	},

	/**
	 * 返回牌的所有者
	 * @param { OwnerQueryCard } card
	 * @param { 'judge' } [method]
	 * @returns { Player | undefined }
	 */
	owner(card: OwnerQueryCard, method: "judge" | undefined) {
		function removingFromHand() {
			const classList = card.classList;
			if (!classList) throw new TypeError("A card in a hand zone requires classList");
			const contains = classList.contains;
			if (typeof contains !== "function") throw new TypeError("A card in a hand zone requires classList.contains");
			return contains.call(classList, "removing");
		}
		/** @param {...string} names */
		function hasClasses(...names: string[]) {
			const contains = card.classListContains;
			if (typeof contains !== "function") throw new TypeError("A card in this zone requires classListContains");
			return contains.call(card, ...names);
		}
		return game.players.concat(game.dead).find((current: Player) => {
			if (current.judging[0] == card && method != "judge") {
				return true;
			}
			if (card.timeout && card.destiny) {
				const destiny = card.destiny;
				if (destiny == current.node.handcards1 || destiny == current.node.handcards2) {
					return !removingFromHand();
				} else if (destiny == current.node.equips) {
					return !hasClasses("removing", "feichu", "emptyequip");
				} else if (destiny == current.node.judges) {
					return !hasClasses("removing", "feichu");
				} else if (destiny == current.node.expansions) {
					return !hasClasses("removing");
				}
			}
			let parent = card.parentNode;
			if (parent == current.node.handcards1 || parent == current.node.handcards2) {
				return !removingFromHand();
			} else if (parent == current.node.equips) {
				return !hasClasses("removing", "feichu", "emptyequip");
			} else if (parent == current.node.judges) {
				return !hasClasses("removing", "feichu");
			} else if (parent == current.node.expansions) {
				return !hasClasses("removing");
			}
			return false;
		});
		//return game.players.concat(game.dead).find(current =>
		//	current.getCards("hejsx").includes(card) || (current.judging[0] == card && method != "judge"));
	},

	/**
	 * @param { YingbianCard } item
	 * @param { string } tag
	 */
	cardtag(item: YingbianCard, tag: string) {
		return (item.cardid && (get.itemtype(item) == "card" || !item.cards || !item.cards.length || item.name == item.cards[0].name) && _status.cardtag && _status.cardtag[tag] && _status.cardtag[tag].includes(item.cardid)) || (item.cardtags && item.cardtags.includes(tag));
	},

	tag(item, tag, item2, bool) {
		let result;
		if (get.info(item, bool) && get.info(item, bool).ai && get.info(item, bool).ai.tag) {
			result = get.info(item, bool).ai.tag[tag];
		}
		if (typeof result == "function") {
			return result(item, item2);
		}
		return result;
	},

	sortCard(sort) {
		let func;
		if (sort == "type_sort") {
			func = function (card) {
				let type = get.type(card, null, false);
				let subtype = get.subtype(card, false);
				if (lib.cardType[subtype]) {
					return lib.cardType[subtype];
				}
				if (lib.cardType[type]) {
					return lib.cardType[type];
				}
				switch (type) {
					case "basic":
						return 2;
					case "chess":
						return 1.5;
					case "trick":
						return -1;
					case "delay":
						return -2;
					case "equip":
						return -3;
					default:
						return -4;
				}
			};
		} else if (sort == "suit_sort") {
			func = function (card) {
				if (get.suit(card) == "heart") {
					return 2;
				}
				if (get.suit(card) == "diamond") {
					return 1;
				}
				if (get.suit(card) == "spade") {
					return -1;
				}
				if (get.suit(card) == "club") {
					return -2;
				}
			};
		} else if (sort == "number_sort") {
			func = function (card) {
				return Number(get.number(card)) - 7 + 0.5;
			};
		}
		return func;
	},

	equipNum(card) {
		const subtypes = get.subtypes(card);
		if (subtypes.length) {
			return parseInt(subtypes[0].slice(5));
		}
		return 0;
	},

	groups() {
		return ["wei", "shu", "wu", "qun", "jin", "western", "key"];
	},
};
