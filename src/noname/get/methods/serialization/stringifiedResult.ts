import { game, lib, ui } from "noname";
import { copyValue, get, TYPE_KEY } from "../../dependencies.js";

export const serializationStringifiedResultMethods = {
	stringifiedResult(item, level, nomore) {
		if (!item) {
			return item;
		}
		if (typeof item == "function") {
			return get.funcInfoOL(item);
		} else if (typeof item == "object") {
			switch (get.itemtype(item)) {
				case "card":
					return get.cardInfoOL(item);
				case "cards":
					return get.cardsInfoOL(item);
				case "vcard":
					return get.vcardInfoOL(item);
				case "vcards":
					return get.vcardsInfoOL(item);
				case "player":
					return get.playerInfoOL(item);
				case "players":
					return get.playersInfoOL(item);
				case "event":
					if (nomore === false) {
						return "";
					}
					return get.eventInfoOL(item, undefined, undefined);
				default:
					if (typeof level != "number") {
						level = 8;
					}
					if (Array.isArray(item)) {
						if (level == 0) {
							return [];
						}
						const result: any[] = [];
						for (let i = 0; i < item.length; i++) {
							result.push(get.stringifiedResult(item[i], level - 1, nomore));
						}
						return result;
					} else {
						if (level == 0) {
							return {};
						}

						const type = Object.prototype.toString.call(item).slice(8, -1);

						switch (type) {
							case "Map":
								return get.mapInfoOL(item, level - 1, nomore);
							case "Set":
								return get.setInfoOL(item, level - 1, nomore);
							case "Object": {
								const result = {};
								for (const i in item) {
									result[i] = get.stringifiedResult(item[i], level - 1, nomore);
								}
								return result;
							}
							default:
								return {};
						}
					}
			}
		} else if (item === Infinity) {
			return "_noname_infinity";
		} else {
			return item;
		}
	},

	parsedResult(item) {
		if (!item) {
			return item;
		}
		if (typeof item == "string") {
			if (item.startsWith("_noname_func:")) {
				return get.infoFuncOL(item);
			} else if (item.startsWith("_noname_card:")) {
				return get.infoCardOL(item);
			} else if (item.startsWith("_noname_vcard:")) {
				return get.infoVCardOL(item);
			} else if (item.startsWith("_noname_player:")) {
				return get.infoPlayerOL(item);
			} else if (item.startsWith("_noname_event:")) {
				return get.infoEventOL(item);
			} else if (item == "_noname_infinity") {
				return Infinity;
			} else {
				return item;
			}
		} else if (Array.isArray(item)) {
			const result: any[] = [];
			for (let i = 0; i < item.length; i++) {
				result.push(get.parsedResult(item[i]));
			}
			return result;
		} else if (typeof item == "object") {
			if (TYPE_KEY in item) {
				switch (item[TYPE_KEY]) {
					case "map":
						return get.infoMapOL(item);
					case "set":
						return get.infoSetOL(item);
				}
			}
			const result = {};
			for (const i in item) {
				result[i] = get.parsedResult(item[i]);
			}
			return result;
		} else {
			return item;
		}
	},

	/**
	 * 此方法仅用作将技能/卡牌代码转为字符串，返回值无法直接进行反序列化
	 * @param { any } obj
	 * @param { number } [level = 0]
	 */
	stringify(obj, level: number | undefined = 0) {
		let indent = "";
		for (let i = 0; i < level; i++) {
			indent += "    ";
		}
		try {
			if (get.objtype(obj) === "object" /*  || obj instanceof lib.element.GameEvent */) {
				let str = "{\n";
				for (const key in obj) {
					let keyString = (/[^a-zA-Z]/.test(key) ? `"${key}"` : key) + ": ";
					const valueString = get.stringify(obj[key], level + 1);
					if (get.is.functionMethod(obj, key)) {
						keyString = "";
					}
					str += indent + "    " + keyString + valueString + ",\n";
				}
				str += indent + "}";
				return str;
			} else if (typeof obj === "function") {
				let str = obj.toString().replace(/\t/g, "    ");
				let lastLine = str.slice(str.lastIndexOf("\n"));
				let originIndent = Math.floor((/\S/.exec(lastLine)?.index ?? lastLine.length) / 4);
				for (let i = 0; i < Math.abs(originIndent - level); i++) {
					if (originIndent >= level) {
						str = str.replace(/\n {4}/g, "\n");
					} else {
						str = str.replace(/\n/g, "\n    ");
					}
				}
				return str;
			} else if (Array.isArray(obj)) {
				const rand = parseInt(get.id());
				obj = obj.map(i => (i === Infinity ? rand : i === -Infinity ? -rand : i));
				return JSON.stringify(obj).replace(new RegExp(rand.toString(), "g"), "Infinity");
			} else {
				if (obj === Infinity) {
					return "Infinity";
				}
				if (obj === -Infinity) {
					return "-Infinity";
				}
				return JSON.stringify(obj);
			}
		} catch (e) {
			return "";
		}
	},

	/**
	 * 深拷贝函数（虽然只处理了部分情况）
	 *
	 * 除了普通的Object和NullObject，均不考虑自行赋值的数据，但会原样将Symbol复制过去
	 *
	 * @template T
	 * @overload
	 * @param {T} obj - 要复制的对象，若不是对象则直接返回原值
	 * @param {boolean} [copyKeyDeep = false] - 是否深复制`Map`的`key`
	 * @returns {T} - 深拷贝后的对象，若传入值不是对象则为传入值
	 */
	/**
	 * @param {unknown} obj
	 * @param {boolean} [copyKeyDeep = false]
	 * @param {WeakMap<object, unknown>} [map] - 拷贝用的临时存储，用于处理循环引用（请勿自行赋值）
	 * @returns {unknown}
	 */
	copy(obj: unknown, copyKeyDeep: boolean | undefined = false, map: WeakMap<any, unknown> | undefined = new WeakMap()) {
		return copyValue(obj, copyKeyDeep, map);
	},

	/**
	 * 获取联机可用武将列表
	 * @param { (name: string) => boolean } [func] 自定义筛选方法，符合条件的排除
	 * @returns { string[] }
	 */
	charactersOL(func: ((name: string) => boolean) | undefined) {
		let list: any[] = [];
		/** @type {Record<string, Character>} */
		let libCharacter: Record<string, Character> = {};
		for (let i = 0; i < lib.configOL.characterPack.length; i++) {
			const pack = lib.characterPack[lib.configOL.characterPack[i]];
			for (let j in pack) {
				if (typeof func == "function" && func(j)) {
					continue;
				}
				if (lib.connectBanned.includes(j)) {
					continue;
				}
				if (lib.character[j]) {
					libCharacter[j] = pack[j];
				}
			}
		}
		for (let i in libCharacter) {
			if (lib.filter.characterDisabled(i, libCharacter)) {
				continue;
			}
			list.push(i);
		}
		return list;
	},

	targetsInfo(targets) {
		let info: any[] = [];
		for (let i = 0; i < targets.length; i++) {
			info.push(targets[i].dataset.position);
		}
		return info;
	},

	infoTargets(infos) {
		return Array.from(infos || []).map(info => game.playerMap[info as string]);
	},

	/**
	 * @param {Card} card
	 * @returns {CardInfoTuple}
	 */
	cardInfo(card: Card) {
		return [card.suit, card.number, card.name, card.nature, card.cardid];
	},

	cardsInfo(cards: any[] = []) {
		return Array.from(cards).map(get.cardInfo);
	},

	infoCard(info) {
		if (!lib.cardOL) {
			lib.cardOL = {};
		}
		let card;
		try {
			const id = info[4];
			if (!id) {
				card = ui.create.card();
				if (info && info[2]) {
					card.init(info);
				}
			} else if (lib.cardOL[id]) {
				if (lib.cardOL[id].name != info[2]) {
					if (info && info[2]) {
						lib.cardOL[id].init(info);
					}
				}
				card = lib.cardOL[id];
			} else {
				card = ui.create.card();
				card.cardid = id;
				if (info && info[2]) {
					card.init(info);
				}
				lib.cardOL[id] = card;
			}
		} catch (e) {
			console.log(e);
		}
		return card || info;
	},

	infoCards(infos) {
		return Array.from(infos || []).map(get.infoCard);
	},

	vcardInfo(card) {
		return Object.entries(card).reduce((stringifying: NonNullable<unknown>, entry: [string, any]) => {
			const key = entry[0];
			/*if (key === "cards") stringifying[key] = get.cardsInfo(entry[1]);
else if (entry[1] !== void 0) stringifying[key] = JSON.stringify(entry[1]);*/
			if (entry[1] !== void 0) {
				stringifying[key] = JSON.stringify(get.stringifiedResult(entry[1], undefined, undefined));
			}
			return stringifying;
		}, {});
	},

	vcardsInfo(cards: any[] = []) {
		return Array.from(cards).map(get.vcardInfo);
	},

	infoVCard(card) {
		if (!lib.vcardOL) {
			lib.vcardOL = {};
		}
		const datas = Object.entries(card).reduce((vcard: NonNullable<unknown>, entry: [string, any]) => {
			const key = entry[0];
			if (key === "cards") {
				vcard[key] = get.infoCards(entry[1]);
			} else if (entry[1] !== void 0) {
				vcard[key] = JSON.parse(entry[1]);
			}
			return vcard;
		}, {});
		// @ts-expect-error ignore
		const vid = datas.vcardID;
		if (!vid || !lib.vcardOL) {
			return new lib.element.VCard(datas);
		}
		if (vid in lib.vcardOL) {
			const vcard = lib.vcardOL[vid];
			//TODO: 这里暂时偷懒 直接用了delete和直接赋值 不妥
			Object.keys(vcard).forEach((entry: string) => {
				delete vcard[entry];
			});
			Object.keys(datas).forEach((key: string) => {
				const value = datas[key];
				if (Array.isArray(value)) {
					vcard[key] = value.slice();
				} else {
					vcard[key] = value;
				}
			});
			return vcard;
		} else {
			const card = new lib.element.VCard(datas);
			lib.vcardOL[vid] = card;
			return card;
		}
	},

	infoVCards(infos) {
		return Array.from(infos || []).map(get.infoVCard);
	},

	cardInfoOL(card) {
		return "_noname_card:" + JSON.stringify([card.cardid, card.suit, card.number, card.name, card.nature]);
	},
};
