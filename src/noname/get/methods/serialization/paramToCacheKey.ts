import { game, lib, ui } from "noname";
import { security, CodeSnippet, ErrorManager, get, TYPE_KEY } from "../../dependencies.js";

import type { GameEvent } from "@/library/element/gameEvent.js";

export const serializationParamToCacheKeyMethods = {
	/**
	 * 用于将参数转换为字符串，作为缓存的key。
	 */
	paramToCacheKey() {
		let str = "";
		// Keep the original Arguments iterator protocol when computing cache keys.
		// eslint-disable-next-line prefer-rest-params
		for (let arg of arguments) {
			if (arg === null || arg === undefined) {
				str += arg + "-";
				continue;
			}
			if (arg.playerid) {
				str += "p:" + arg.playerid;
			} else if (arg.cardid) {
				str += "c:" + arg.cardid;
			} else if (arg.name) {
				str += "n:" + arg.name;
			} else {
				str += "s:" + arg;
			}
			str += "-";
		}
		return str;
	},

	infoCardOL(info) {
		if (!lib.cardOL) {
			return info;
		}
		let card;
		try {
			info = JSON.parse(info.slice(13));
			let id = info.shift();
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
			} else if (game.online) {
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

	cardsInfoOL(cards) {
		return Array.from(cards || []).map(get.cardInfoOL);
	},

	infoCardsOL(infos) {
		return Array.from(infos || []).map(get.infoCardOL);
	},

	playerInfoOL(player) {
		return "_noname_player:" + player.playerid;
	},

	infoPlayerOL(info) {
		return lib.playerOL ? lib.playerOL[info.slice(15)] || info : info;
	},

	playersInfoOL(players) {
		return Array.from(players || []).map(get.playerInfoOL);
	},

	infoPlayersOL(infos) {
		return Array.from(infos || []).map(get.infoPlayerOL);
	},

	/**
	 * ```plain
	 * 测试一段代码是否为函数参数列表
	 * ```
	 *
	 * @param {string} paramstr
	 * @returns { boolean }
	 */
	isFunctionParam(paramstr: string) {
		if (paramstr.length == 0) {
			return true;
		}
		const canCreateFunction = security.isSandboxRequired() && security.importSandbox().Marshal.canCreateFunction;
		if (canCreateFunction) {
			return canCreateFunction(paramstr, "");
		}
		try {
			new Function(paramstr, "");
			return true;
		} catch (e) {
			return false;
		}
	},

	funcInfoOL(func) {
		if (typeof func == "function") {
			if (func._filter_args) {
				return "_noname_func:" + JSON.stringify(get.stringifiedResult(func._filter_args, 3, undefined));
			}
			// 沙盒在封装函数时，为了保存源代码会另外存储函数的源代码
			/** @type {(func: Function) => string} */
			const decompileFunction: (func: Function) => string = security.isSandboxRequired() ? security.importSandbox().Marshal.decompileFunction : Function.prototype.call.bind(Function.prototype.toString);
			const str = decompileFunction(func);
			// js内置的函数
			if (/\{\s*\[native code\]\s*\}/.test(str)) {
				return "_noname_func:function () {}";
			}
			return "_noname_func:" + get.pureFunctionStr(str);
		}
		return "";
	},

	infoFuncOL(info) {
		let func;
		if ("sandbox" in window) {
			console.log("[infoFuncOL] info:", info);
		}
		const str = get.pureFunctionStr(info.slice(13), true); // 清洗函数并阻止注入
		if ("sandbox" in window) {
			console.log("[infoFuncOL] pured:", str);
		}
		try {
			// js内置的函数
			if (/\{\s*\[native code\]\s*\}/.test(str)) {
				return function () {};
			}
			if (security.isSandboxRequired()) {
				const loadStr = `return (${str});`;
				const box = security.currentSandbox();
				if (!box) {
					throw new ReferenceError("没有找到当前沙盒");
				}
				func = box.exec(loadStr);
				ErrorManager.setCodeSnippet(func, new CodeSnippet(str, 5));
			} else {
				func = security.exec(`return (${str});`);
				ErrorManager.setCodeSnippet(func, new CodeSnippet(str, 3));
			}
		} catch (e) {
			console.error(`${e} in \n${str}`);
			return function () {};
		}
		if (Array.isArray(func)) {
			func = get.filter.apply(this, get.parsedResult(func));
		}
		return func;
	},

	eventInfoOL(item, level, noMore) {
		return get.itemtype(item) == "event"
			? `_noname_event:${JSON.stringify(
					Object.entries(item).reduce((stringifying: NonNullable<unknown>, entry: [string, any]) => {
						const key = entry[0];
						if (key == "_trigger") {
							if (noMore !== false) {
								stringifying[key] = get.eventInfoOL(entry[1], null, false);
							}
						} else if (!lib.element.GameEvent.prototype[key] && key != "content" && get.itemtype(entry[1]) != "event") {
							stringifying[key] = get.stringifiedResult(entry[1], null, false);
						}
						return stringifying;
					}, {})
				)}`
			: "";
	},

	/**
	 * @param {string} item
	 */
	infoEventOL(item: string) {
		const evt = new lib.element.GameEvent();
		try {
			Object.entries(JSON.parse(item.slice(14))).forEach((entry: [string, any]) => {
				const key = entry[0];
				if (typeof evt[key] != "function") {
					evt[key] = get.parsedResult(entry[1]);
				}
			});
		} catch (error) {
			console.log(error);
		}
		return evt || item;
	},

	vcardInfoOL(item) {
		return (
			"_noname_vcard:" +
			JSON.stringify(
				Object.entries(item).reduce((stringifying: NonNullable<unknown>, entry: [string, any]) => {
					const key = entry[0];
					stringifying[key] = get.stringifiedResult(entry[1], undefined, undefined);
					return stringifying;
				}, {})
			)
		);
	},

	vcardsInfoOL(cards) {
		return Array.from(cards || []).map(get.vcardInfoOL);
	},

	infoVCardOL(item) {
		const rawCard = JSON.parse(item.slice(14));
		/**
		 * Object.entries 在旧实现中接受数组和字符串，但对 null 或 undefined 抛出。
		 * 保持该输入边界，同时让 reduce 的输出成为明确的外部数据容器。
		 * @param {unknown} value
		 * @returns {[string, unknown][]}
		 */
		const getWireEntries = (value: unknown) => {
			if (value === null || value === undefined) {
				throw new TypeError("Cannot convert undefined or null to object");
			}
			return Object.entries(value);
		};
		/**
		 * 在受支持的解码值域内保留属性键转换。每次缓存操作各调用一次，
		 * 以保留旧 `in` 与索引访问的转换次数。
		 * @param {unknown} value
		 * @returns {string | symbol}
		 */
		const getVCardCacheKey = (value: unknown) => (typeof value === "symbol" ? value : String(value));
		/** @type {Record<string, unknown>} */
		const datas: Record<string, unknown> = getWireEntries(rawCard).reduce((vcard: NonNullable<unknown>, entry: [string, unknown]) => {
			const key = entry[0];
			vcard[key] = get.parsedResult(entry[1]);
			return vcard;
		}, {});

		const vid = datas.vcardID;
		if (!vid || !lib.vcardOL) {
			return new lib.element.VCard(datas);
		}
		if (getVCardCacheKey(vid) in lib.vcardOL) {
			const vcard = lib.vcardOL[getVCardCacheKey(vid)];
			//TODO: 这里暂时偷懒 直接用了delete和直接赋值 不妥
			Object.keys(vcard).forEach((entry: string) => {
				delete vcard[entry];
			});
			Object.keys(datas).forEach((key: string) => {
				const value = datas[key];
				if (Array.isArray(value)) {
					vcard[key] = value.slice();
				}
				vcard[key] = value;
			});
			return vcard;
		} else {
			const card = new lib.element.VCard(datas);
			lib.vcardOL[getVCardCacheKey(vid)] = card;
			return card;
		}
	},

	infoVCardsOL(infos) {
		return Array.from(infos || []).map(get.infoVCardOL);
	},

	/**
	 * @param {Map} map 要序列化的Map
	 * @param {number} [level] 最大的序列化嵌套层级
	 * @param {false | null} [nomore] 传递false取消内部事件的序列化
	 */
	mapInfoOL(map: Map<any, any>, level: number | undefined, nomore: false | null | undefined) {
		const info = {};

		for (const [key, value] of map.entries()) {
			Array.prototype.push.call(info, [get.stringifiedResult(key, level, nomore), get.stringifiedResult(value, level, nomore)]);
		}

		info[TYPE_KEY] = "map";
		return info;
	},

	/**
	 * @param {Set} set 要序列化的Set
	 * @param {number} [level] 最大的序列化嵌套层级
	 * @param {false | null} [nomore] 传递false取消内部事件的序列化
	 */
	setInfoOL(set: Set<any>, level: number | undefined, nomore: false | null | undefined) {
		const info = {};

		for (const value of set) {
			Array.prototype.push.call(info, get.stringifiedResult(value, level, nomore));
		}

		info[TYPE_KEY] = "set";
		return info;
	},

	infoMapOL(item) {
		const map = new Map();

		for (const index in item) {
			if (!isFinite(Number(index))) {
				break;
			}

			const pair = item[index];

			if (!Array.isArray(pair) || pair.length !== 2) {
				continue;
			}

			map.set(get.parsedResult(pair[0]), get.parsedResult(pair[1]));
		}

		return map;
	},

	infoSetOL(item) {
		const set = new Set();

		for (const index in item) {
			if (!isFinite(Number(index))) {
				break;
			}

			set.add(get.parsedResult(item[index]));
		}

		return set;
	},
};
