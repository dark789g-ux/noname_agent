import { _status, game, get } from "noname";
import type { Card, GameEvent, Player } from "../../index.js";

type EquipSlotEvent = GameEvent & {
	slots: string[];
};

type ChooseToDisableEvent = GameEvent & {
	horse?: boolean;
};

export const equipSlotControlMethods = {
	/**
	 * 新的废除装备区
	 *
	 * 参数：废除来源角色（不写默认当前事件角色），废除区域（数字/区域字符串/数组，可以写多个，重复废除）
	 */
	disableEquip(this: Player, params?: any): GameEvent {
		const next = game.createEvent("disableEquip") as EquipSlotEvent;
		next.player = this;
		next.slots = [];

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		if (args.length === 1 && typeof params === "object" && !Array.isArray(params) && params !== null && get.itemtype(params) == null) {
			Object.assign(next, params);
		} else {
			for (const arg of args) {
				if (get.itemtype(arg) == "player") {
					next.source = arg;
				} else if (Array.isArray(arg)) {
					for (const slot of arg) {
						if (typeof slot == "string") {
							if (slot.startsWith("equip") && parseInt(slot.slice(5)) > 0) {
								next.slots.push(slot);
							}
						} else if (typeof slot == "number") {
							next.slots.push("equip" + slot);
						}
					}
				} else if (typeof arg == "string") {
					if (arg.startsWith("equip") && parseInt(arg.slice(5)) > 0) {
						next.slots.push(arg);
					}
				} else if (typeof arg == "number") {
					next.slots.push("equip" + arg);
				}
			}
		}
		if (!next.source) {
			next.source = _status.event.player;
		}
		if (!next.slots.length) {
			_status.event.next.remove(next);
			next.resolve();
		}
		next.setContent("disableEquip");
		return next;
	},

	/**
	 * 新的恢复装备区
	 *
	 * 参数：恢复来源角色（不写默认当前事件角色），恢复区域（数字/区域字符串/数组，可以写多个，重复恢复）
	 */
	enableEquip(this: Player, params?: any): GameEvent {
		const next = game.createEvent("enableEquip") as EquipSlotEvent;
		next.player = this;
		next.slots = [];

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		if (args.length === 1 && typeof params === "object" && !Array.isArray(params) && params !== null && get.itemtype(params) == null) {
			Object.assign(next, params);
		} else {
			for (const arg of args) {
				if (get.itemtype(arg) == "player") {
					next.source = arg;
				} else if (Array.isArray(arg)) {
					for (const slot of arg) {
						if (typeof slot == "string") {
							if (slot.startsWith("equip") && parseInt(slot.slice(5)) > 0) {
								next.slots.push(slot);
							}
						} else if (typeof slot == "number") {
							next.slots.push("equip" + slot);
						}
					}
				} else if (typeof arg == "string") {
					if (arg.startsWith("equip") && parseInt(arg.slice(5)) > 0) {
						next.slots.push(arg);
					}
				} else if (typeof arg == "number") {
					next.slots.push("equip" + arg);
				}
			}
		}
		if (!next.source) {
			next.source = _status.event.player;
		}
		if (!next.slots.length) {
			_status.event.next.remove(next);
			next.resolve();
		}
		next.setContent("enableEquip");
		return next;
	},

	/**
	 * 新的扩展装备区
	 *
	 * 参数：扩展来源角色（不写默认当前事件角色），扩展区域（数字/区域字符串/数组，可以写多个，重复扩展）
	 */
	expandEquip(this: Player, params?: any): GameEvent {
		const next = game.createEvent("expandEquip") as EquipSlotEvent;
		next.player = this;
		next.slots = [];

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		if (args.length === 1 && typeof params === "object" && !Array.isArray(params) && params !== null && get.itemtype(params) == null) {
			Object.assign(next, params);
		} else {
			for (const arg of args) {
				if (get.itemtype(arg) == "player") {
					next.source = arg;
				} else if (Array.isArray(arg)) {
					for (const slot of arg) {
						if (typeof slot == "string") {
							if (slot.startsWith("equip") && parseInt(slot.slice(5)) > 0) {
								next.slots.push(slot);
							}
						} else if (typeof slot == "number") {
							next.slots.push("equip" + slot);
						}
					}
				} else if (typeof arg == "string") {
					if (arg.startsWith("equip") && parseInt(arg.slice(5)) > 0) {
						next.slots.push(arg);
					}
				} else if (typeof arg == "number") {
					next.slots.push("equip" + arg);
				}
			}
		}
		if (!next.source) {
			next.source = _status.event.player;
		}
		if (!next.slots.length) {
			_status.event.next.remove(next);
			next.resolve();
		}
		next.setContent("expandEquip");
		return next;
	},

	/**
	 * 同步显示扩展装备区状态
	 */
	$syncExpand(this: Player, map?: Record<string, number>): void {
		if (!map) {
			map = this.expandedSlots || {};
		}
		game.addVideo("$syncExpand", this, get.copy(map));
		game.broadcast(
			function (player, map) {
				player.expandedSlots = map;
				player.$syncExpand(map);
			},
			this,
			map
		);
		this.markSkill("expandedSlots");
	},

	/**
	 * 同步装备区废除牌显示状态
	 */
	$syncDisable(this: Player, map?: Record<string, number>): void {
		//TODO:虚拟装备牌的添加暂时没有考虑到废除装备栏的情况，会出现排序错误的问题。需要手动设置排序。
		const suits: Record<string, string> = { equip3: "+1马栏", equip4: "-1马栏", equip6: "特殊栏" };
		if (get.is.mountCombined()) {
			suits.equip3 = "坐骑栏";
		}
		if (!map) {
			map = this.disabledSlots || {};
		}
		game.addVideo("$syncDisable", this, get.copy(map));
		game.broadcast(
			function (player, map) {
				player.disabledSlots = map;
				player.$syncDisable(map);
			},
			this,
			map
		);
		const map2 = get.copy(map);
		const cards = Array.from(this.node.equips.childNodes) as Card[];
		for (const card of cards) {
			if (card.name.startsWith("feichu_")) {
				const index = card.name.slice(7);
				if (!map2[index]) {
					map2[index] = 0;
				}
				map2[index]--;
			}
		}
		for (const index in map2) {
			if (!index.startsWith("equip") || !(parseInt(index.slice(5)) > 0)) {
				continue;
			}
			const num = map2[index];
			if (num > 0) {
				for (let i = 0; i < num; i++) {
					const card = game.createCard("feichu_" + index, suits[index] || get.translation(index) + "栏", "");
					card.fix();
					card.style.transform = "";
					card.classList.remove("drawinghidden");
					card.classList.add("feichu");
					delete card._transform;
					const equipNum = get.equipNum(card);
					let equipped = false;
					for (let j = 0; j < this.node.equips.childNodes.length; j++) {
						if (get.equipNum(this.node.equips.childNodes[j]) >= equipNum) {
							this.node.equips.insertBefore(card, this.node.equips.childNodes[j]);
							equipped = true;
							break;
						}
					}
					if (!equipped) {
						this.node.equips.appendChild(card);
						if (_status.discarded) {
							_status.discarded.remove(card);
						}
					}
				}
			} else if (num < 0) {
				for (let i = 0; i > num; i--) {
					const card = cards.find(card => card.name == "feichu_" + index);
					if (card) {
						this.node.equips.removeChild(card);
						cards.remove(card);
					}
				}
			}
		}
	},

	/**
	 * 令玩家选择恢复一个已废除的装备栏
	 */
	chooseToEnable(this: Player, params?: any): GameEvent {
		const next = game.createEvent("chooseToEnable");

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		if (args.length === 1 && typeof params === "object" && params !== null && get.itemtype(params) == null) {
			Object.assign(next, params);
			if (typeof next.selectButton === "number") {
				next.selectButton = [next.selectButton, next.selectButton];
			}
		} else {
			for (const arg of args) {
				if (get.itemtype(arg) == "player") {
					next.source = arg;
				} else if (get.itemtype(arg) == "select") {
					next.selectButton = arg;
				} else if (typeof arg == "number") {
					next.selectButton = [arg, arg];
				}
			}
		}
		if (next.source == undefined) {
			next.source = this;
		}
		next.player = this;
		next.setContent("chooseToEnable");
		return next;
	},

	/**
	 * 令玩家选择废除一个未废除的装备栏
	 */
	chooseToDisable(this: Player, params?: any): GameEvent {
		const next = game.createEvent("chooseToDisable") as ChooseToDisableEvent;

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		if (args.length === 1 && typeof params === "object" && params !== null && get.itemtype(params) == null) {
			Object.assign(next, params);
			if (typeof next.selectButton === "number") {
				next.selectButton = [next.selectButton, next.selectButton];
			}
		} else {
			for (const arg of args) {
				if (get.itemtype(arg) == "player") {
					next.source = arg;
				} else if (typeof arg == "boolean") {
					next.horse = arg;
				} else if (get.itemtype(arg) == "select") {
					next.selectButton = arg;
				} else if (typeof arg == "number") {
					next.selectButton = [arg, arg];
				}
			}
		}
		if (next.horse == undefined) {
			next.horse = false;
		}
		if (next.source == undefined) {
			next.source = this;
		}
		next.player = this;
		next.setContent("chooseToDisable");
		return next;
	},
};
