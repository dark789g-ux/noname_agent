import { game, lib, _status } from "noname";
import { CacheContext, get } from "../../dependencies.js";

export const aiSgnAttitudeMethods = {
	/**
	 * @param {Parameters<typeof get.attitude>} args
	 */
	sgnAttitude(...args: [from?: any, to?: any, ...any[]]) {
		return get.sgn(get.attitude.apply(this, args as Parameters<typeof get.attitude>));
	},

	useful_raw(card, player) {
		if (get.position(card, undefined) == "j") {
			return -1;
		}
		if (get.position(card, undefined) == "e") {
			return get.equipValue(card, undefined);
		}
		if (card._modUseful) {
			return card._modUseful();
		}
		let i = 0;
		if (!player) {
			player = _status.event.player;
		}
		if (player) {
			if (_status.event.useCache) {
				i = game
					.callFuncUseStepCache(
						"player.getCardsInUseful",
						function (player, position, cardname) {
							return player.getCards(position, cardname);
						},
						[player, "h", card.name]
					)
					.indexOf(card);
			} else {
				i = player.getCards("h", card.name).indexOf(card);
			}
			if (i < 0) {
				i = 0;
			}
		}
		let aii = get.info(card).ai;
		let useful;
		if (aii && aii.useful) {
			useful = aii.useful;
		} else if (aii && aii.basic) {
			useful = aii.basic.useful;
		}
		let result;
		if (useful == undefined) {
			result = -1;
		} else if (typeof useful == "function") {
			result = useful(card, i);
		} else if (typeof useful == "number") {
			result = useful;
		} else if (i < useful.length) {
			result = useful[i];
		} else {
			result = useful[useful.length - 1];
		}
		if (Array.isArray(result)) {
			result = i < result.length ? result[i] : result[result.length - 1];
		}
		if (typeof result != "number") {
			result = -1;
		}
		result = game.checkMod(player, card, result, "aiUseful", player);
		return result;
	},

	useful(card, player) {
		if (_status.event.useCache) {
			return game.callFuncUseStepCache("get.useful_raw", get.useful_raw, [card, player]);
		}
		return get.useful_raw(card, player);
	},

	unuseful(card) {
		return -get.useful(card, undefined);
	},

	unuseful2(card) {
		return 10 - get.useful(card, undefined);
	},

	unuseful3(card) {
		if (card.name == "du") {
			return 20;
		}
		return 10 - get.useful(card, undefined);
	},

	value(card, player, method) {
		let result = 0;
		let value;
		if (Array.isArray(card)) {
			if (!card.length) {
				return 0;
			}
			value = 0;
			for (let i = 0; i < card.length; i++) {
				value += get.value(card[i], player, method);
			}
			return value / Math.sqrt(card.length);
		}
		if (card._modValue) {
			return card._modValue(player, method);
		}
		let aii = get.info(card).ai;
		if (aii && aii.value) {
			value = aii.value;
		} else if (aii && aii.basic) {
			value = aii.basic.value;
		}
		if (player == undefined || get.itemtype(player) != "player") {
			player = _status.event.player;
		}
		let geti = function () {
			return player.getCardIndex("hs", card.name, card, 5);
		};
		if (typeof value == "function") {
			result = value(card, player, geti(), method);
		}
		if (typeof value == "number") {
			result = value;
		}
		if (Array.isArray(value)) {
			if (method == "raw") {
				result = value[0];
			}
			let num = geti();
			if (num < value.length) {
				result = value[Math.max(0, num)];
			} else {
				result = value[value.length - 1];
			}
		}
		result = game.checkMod(player, card, result, "aiValue", player);
		return result;
	},

	equipResult(player, target, name) {
		let card = name;
		if (typeof name === "string") {
			card = { name };
		} else {
			const itemtype = get.itemtype(card);
			if (itemtype !== "card" && itemtype !== "vcard") {
				card = get.card(undefined);
			}
		}
		let value1 = get.equipValue(card, target),
			value2 = 0;
		if (!target.canEquip(card)) {
			if (!target.canEquip(card, true)) {
				return 0;
			}
			let current = target.getVEquip(card);
			if (current && current != card) {
				value2 = get.equipValue(current, target);
				if (value2 > 0 && !target.needsToDiscard() && !get.tag(card, "valueswap", undefined, undefined)) {
					return 0;
				}
			}
		}
		return Math.max(0, value1 - value2) / 5;
	},

	equipValue(card, player) {
		player = player ?? get.owner(card) ?? get.player();
		if (get.itemtype(card) === "card") {
			card = player.getVCards("e").find(vcard => vcard.cards?.includes(card)) ?? card;
		}
		let info = get.info(card, false);
		if (!info.ai) {
			return 0;
		}
		let value = info.ai.equipValue;
		if (value == undefined) {
			if (info.ai.basic && info.ai.basic.equipValue != undefined) {
				value = info.ai.basic.equipValue;
			} else {
				return 0;
			}
		}
		if (typeof value == "number") {
			return value;
		}
		//此处是否需要将实体牌改为虚拟牌呢？暂时不确定
		if (typeof value == "function") {
			return value(card, player, null, "raw2");
		}
		return 0;
	},

	equipValueNumber(card) {
		let info = get.info(card);
		if (info.ai) {
			if (typeof info.ai.equipValue == "number") {
				return info.ai.equipValue;
			}
			if (info.ai.basic && typeof info.ai.basic.equipValue == "number") {
				return info.ai.basic.equipValue;
			}
		}
		return 0;
	},

	disvalue(card, player) {
		return -get.value(card, player, undefined);
	},

	disvalue2(card, player) {
		return -get.value(card, player, "raw");
	},

	skillthreaten(skill, player, target) {
		if (!lib.skill[skill]) {
			return 1;
		}
		if (!lib.skill[skill].ai) {
			return 1;
		}
		let threaten = lib.skill[skill].ai.threaten;
		if (typeof threaten == "number") {
			return threaten;
		}
		if (typeof threaten == "function") {
			player = player || _status.event.player;
			target = target || player;
			return threaten(player, target);
		}
		return 1;
	},

	cacheOrder(item) {
		let cache = CacheContext.requireCacheContext();
		return cache.get.order(item);
	},

	/**
	 * @returns { number }
	 */
	order(item, player: Player | null | undefined = get.player() || game.me) {
		let cache = CacheContext.requireCacheContext();
		let info = get.info(item);
		if (!info) {
			return -1;
		}
		let aii = info.ai;
		let order;
		if (aii && aii.order) {
			order = aii.order;
		} else if (aii && aii.basic) {
			order = aii.basic.order;
		}
		if (order == undefined) {
			return -1;
		}
		let num;
		if (typeof order == "function") {
			num = order(item, player);
		} else {
			num = order;
		}
		if (typeof num != "number") {
			num = -1;
		}
		if (typeof item == "object" && player) {
			num = game.checkMod(player, item, num, "aiOrder", player);
		}
		return num;
	},

	/**
	 * @param {AIResultItem} item
	 * @param {string | null} [skill]
	 * @returns {AIResultConfig | number}
	 */
	result(item: AIResultItem, skill: string | null | undefined) {
		/** @type {AIResultDefinition | null | undefined} */
		let result;
		let info = get.info(item);
		if (!info) throw new TypeError("AI result evaluation requires item information");
		if (info.ai) {
			result = get.copy(info.ai.result);
		}
		if (typeof result == "function") {
			result = result(item);
		}
		if (!result) {
			result = {};
		}
		if (skill) {
			let info2 = get.info(skill);
			if (info2.ai) {
				const skillResult = info2.ai.result;
				if (typeof skillResult !== "number") {
					for (let i in skillResult) {
						const value = skillResult[i];
						if (typeof result === "number") throw new TypeError("Cannot write skill result fields onto a numeric result");
						result[i] = value;
					}
				}
			}
		}
		return result;
	},

	cacheEffectUse(target, card, player, player2, isLink) {
		let cache = CacheContext.requireCacheContext();
		return cache.get.effect_use(target, card, player, player2, isLink);
	},

	coinCoeff(list) {
		let num = 0;
		for (let i = 0; i < list.length; i++) {
			let rank = get.rank(list[i]);
			switch (rank) {
				case "sp":
					return 0.1;
				case "s":
					num += 0.4;
					break;
				case "ap":
					num += 0.6;
					break;
				case "a":
					num += 0.8;
					break;
				case "am":
					num += 0.95;
					break;
				case "bp":
					num += 1.05;
					break;
				case "b":
					num += 1.2;
					break;
				case "bm":
					num += 1.4;
					break;
				case "c":
					num += 1.6;
					break;
				case "d":
					num += 1.8;
					break;
			}
		}
		return num / list.length;
	},
};
