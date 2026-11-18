import { lib } from "noname";
import { get } from "../../dependencies.js";

import type { GameEvent } from "@/library/element/gameEvent.js";

export const utilityDynamicVariableMethods = {
	/**
	 * 获取动态变量的实际值。
	 *
	 * 当source为函数时，使用剩余参数执行该函数并返回结果；否则直接返回source。
	 *
	 * > 在我看到本体的用法时，我似乎理解了为什么有这种API
	 * > 但还是很神金，而且命名也有问题
	 *
	 * @template T
	 * @template { any[] } U
	 * @param { T | ((...args: U) => T) } source 动态变量或用于计算动态变量的函数
	 * @param { U } args 传给source函数的参数
	 * @returns { T } source为函数时返回函数执行结果，否则返回source本身
	 */
	dynamicVariable<T, U extends any[]>(source: T | ((...args: U) => T), ...args: U): T {
		if (typeof source === "function") {
			return (source as (...args: U) => T)(...args);
		}
		return source;
	},

	difficulty() {
		switch (get.config("difficulty", undefined)) {
			case "easy":
				return 1;
			case "normal":
				return 2;
			case "hard":
				return 3;
			default:
				return 1;
		}
	},

	time() {
		if (lib.status.dateDelaying) {
			return lib.getUTC(lib.status.dateDelaying) - lib.getUTC(lib.status.date) - lib.status.dateDelayed;
		} else {
			return lib.getUTC(new Date()) - lib.getUTC(lib.status.date) - lib.status.dateDelayed;
		}
	},

	utc() {
		return new Date().getTime();
	},

	xyDistance(from, to) {
		return Math.sqrt((from[0] - to[0]) * (from[0] - to[0]) + (from[1] - to[1]) * (from[1] - to[1]));
	},

	/**
	 * @overload
	 * @param { any } obj
	 * @returns { 'position' | 'natures' | 'nature' | 'players' | 'cards' | 'vcards' | 'select' | 'divposition' | 'button' | 'card' | 'vcard' | 'player' | 'dialog' | 'event' | void }
	 *
	 * @overload
	 * @param { string } obj
	 * @returns { 'position' | 'natures' | 'nature' }
	 *
	 * @overload
	 * @param { Player[] } obj
	 * @returns { 'players' }
	 *
	 * @overload
	 * @param { Card[] } obj
	 * @returns { 'cards' }
	 *
	 * @overload
	 * @param { [number, number] } obj
	 * @returns { 'select' }
	 *
	 * @overload
	 * @param { [number, number, number, number] } obj
	 * @returns { 'divposition' }
	 *
	 * @overload
	 * @param { Button } obj
	 * @returns { 'button' }
	 *
	 * @overload
	 * @param { Card } obj
	 * @returns { 'card' }
	 *
	 * @overload
	 * @param { VCard } obj
	 * @returns { 'vcard' }
	 *
	 * @overload
	 * @param { Player } obj
	 * @returns { 'player' }
	 *
	 * @overload
	 * @param { Dialog } obj
	 * @returns { 'dialog' }
	 *
	 * @overload
	 * @param { GameEvent } obj
	 * @returns { 'event' }
	 */
	itemtype(obj) {
		if (typeof obj == "string") {
			if (obj.length <= 5) {
				let bool = true;
				for (let i = 0; i < obj.length; i++) {
					if (/h|e|j|s|x/.test(obj[i]) == false) {
						bool = false;
						break;
					}
				}
				if (bool) {
					return "position";
				}
			}
			if (obj.includes(lib.natureSeparator) && obj.split(lib.natureSeparator).every((n: string) => lib.nature.has(n))) {
				return "natures";
			}
			if (lib.nature.has(obj)) {
				return "nature";
			}
		}
		if (Array.isArray(obj) && obj.length > 0) {
			if (obj.every(p => p instanceof lib.element.Player)) {
				return "players";
			}
			if (obj.every(p => p instanceof lib.element.Card)) {
				return "cards";
			}
			if (obj.every(p => p instanceof lib.element.VCard || (get.is.object(p) && p.name && p.name in lib.card))) {
				return "vcards";
			}
			if (obj.length == 2) {
				if (typeof obj[0] == "number" && typeof obj[1] == "number") {
					if (obj[0] <= obj[1] || obj[1] <= -1) {
						return "select";
					}
				}
			}
			if (obj.length == 4) {
				if (obj.every(p => typeof p == "number")) {
					return "divposition";
				}
			}
		}
		if (obj instanceof lib.element.Button || (obj instanceof HTMLDivElement && obj.classList.contains("button"))) {
			return "button";
		}
		if (obj instanceof lib.element.Card) {
			return "card";
		}
		if (obj instanceof lib.element.VCard || (get.is.object(obj) && obj.name && obj.name in lib.card)) {
			return "vcard";
		}
		if (obj instanceof lib.element.Player) {
			return "player";
		}
		if (obj instanceof lib.element.Dialog) {
			return "dialog";
		}
		if (obj instanceof lib.element.GameEvent) {
			return "event";
		}

		if (typeof obj !== "object" || obj === null) {
			return;
		}

		if (lib.experimental.symbol.itemType in obj) {
			return obj[lib.experimental.symbol.itemType];
		}
	},

	/**
	 * 返回对象的实际类型
	 * @overload
	 * @param { Array } obj
	 * @returns { 'array' }
	 *
	 * @overload
	 * @param { Object } obj
	 * @returns { 'object' }
	 *
	 * @overload
	 * @param { HTMLDivElement } obj
	 * @returns { 'div' }
	 *
	 * @overload
	 * @param { HTMLTableElement } obj
	 * @returns { 'table' }
	 *
	 * @overload
	 * @param { HTMLTableRowElement } obj
	 * @returns { 'tr' }
	 *
	 * @overload
	 * @param { HTMLTableCellElement } obj
	 * @returns { 'td' }
	 *
	 * @overload
	 * @param { HTMLBodyElement } obj
	 * @returns { 'td' }
	 *
	 * @overload
	 * @param { DocumentFragment } obj
	 * @returns { 'fragment' }
	 */
	objtype(obj) {
		if (Object.prototype.toString.call(obj) === "[object Array]") {
			return "array";
		}
		if (Object.prototype.toString.call(obj) === "[object Object]") {
			return "object";
		}
		if (Object.prototype.toString.call(obj) === "[object HTMLDivElement]") {
			return "div";
		}
		if (Object.prototype.toString.call(obj) === "[object HTMLTableElement]") {
			return "table";
		}
		if (Object.prototype.toString.call(obj) === "[object HTMLTableRowElement]") {
			return "tr";
		}
		if (Object.prototype.toString.call(obj) === "[object HTMLTableCellElement]") {
			return "td";
		}
		if (Object.prototype.toString.call(obj) === "[object HTMLBodyElement]") {
			return "td";
		}
		if (Object.prototype.toString.call(obj) === "[object DocumentFragment]") {
			return "fragment";
		}
	},

	numOf(obj, item) {
		return obj.filter(element => element == item).length;
	},

	id() {
		return Math.floor(1000000 + 9000000 * Math.random()).toString() + (10 + lib.status.globalId++);
	},

	/**
	 * 判定数字的正负，若num大于0，返回1，若num小于0，返回-1，若num等于0，返回0
	 * @param { number } num
	 * @returns { 1 | -1 | 0 }
	 */
	sgn(num: number) {
		if (num > 0) {
			return 1;
		}
		if (num < 0) {
			return -1;
		}
		return 0;
	},

	/**
	 * 生成随机数，若存在num2，返回num到num2之间的随机数，否则返回0到num之间的随机数
	 * @param { number } num
	 * @param { number } [num2]
	 * @returns { number }
	 */
	rand(num: number, num2: number | undefined) {
		if (typeof num2 == "number") {
			return num + Math.floor(Math.random() * (num2 - num + 1));
		} else {
			return Math.floor(Math.random() * num);
		}
	},

	sort(arr, method, arg) {
		return method == "seat" ? arr.sortBySeat(arg) : void 0;
	},

	/**
	 * 返回一个按座次排序的玩家数组
	 * @param { Player[] } arr
	 * @param { Player } target
	 * @returns { Player[] }
	 */
	sortSeat(arr: Player[], target: Player) {
		return arr.sortBySeat(target);
	},

	delayx(num, max) {
		if (typeof num != "number") {
			num = 1;
		}
		if (typeof max != "number") {
			max = Infinity;
		}
		switch (lib.config.game_speed) {
			case "vslow":
				return Math.min(max, 2.5 * num);
			case "slow":
				return Math.min(max, 1.5 * num);
			case "fast":
				return Math.min(max, 0.7 * num);
			case "vfast":
				return Math.min(max, 0.4 * num);
			case "vvfast":
				return Math.min(max, 0.2 * num);
			default:
				return Math.min(max, num);
		}
	},

	round(num, f) {
		let round = Math.pow(10, f);
		return Math.round(num * round) / round;
	},

	benchmark(func1, func2, iteration, arg) {
		// Function-scoped bindings intentionally remain shared across legacy branches.
		let i;

		let tic, toc;
		let key1, key2;
		if (!arg) {
			arg = [];
		}
		if (Array.isArray(func2)) {
			key1 = func2[0];
			key2 = func2[1];
		} else if (typeof func2 == "string") {
			key1 = func2;
			func2 = iteration || 100;
		} else if (typeof func2 == "number") {
			arg = iteration || arg;
			iteration = func2;
		}
		tic = get.utc();
		for (i = 0; i < iteration; i++) {
			if (key1) {
				func1[key1](arg.randomGet());
			} else {
				func1(arg.randomGet());
			}
		}
		toc = get.utc();
		if (typeof func2 == "number") {
			return toc - tic;
		}
		console.log("time1: " + (toc - tic));
		tic = get.utc();
		for (i = 0; i < iteration; i++) {
			if (key2) {
				func1[key2](arg.randomGet());
			} else {
				func2(arg.randomGet());
			}
		}
		toc = get.utc();
		console.log("time2: " + (toc - tic));
	},
};
