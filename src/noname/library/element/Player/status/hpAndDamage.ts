import { _status, game, get, lib } from "noname";
import type { GameEvent, Player } from "../../index.js";
import type { EventDamageParams, EventGainMaxHpParams, EventLoseMaxHpParams, EventRecoverParams, EventRecoverToParams } from "../type.js";
import "../contracts/statusContract.js";

type DamageEvent = GameEvent & {
	nosource?: boolean;
	nocard?: boolean;
	nohujia?: boolean;
	change_history: number[];
	hasNature(this: DamageEvent, nature?: string): boolean;
};

type RecoverEvent = GameEvent & {
	nocard?: boolean;
	nosource?: boolean;
};

type ChangeHpEvent = GameEvent & {
	originalHp?: number;
};

export const hpAndDamageMethods = {
	getHp(this: Player, raw?: boolean): number | undefined {
		return raw ? this.hp : Math.max(0, this.hp as any);
	},
	getDamagedHp(this: Player, raw?: boolean): number {
		if (this.getHp(raw) == Infinity) {
			return 0;
		}
		return (this.maxHp as any) - (this.getHp(raw) as any);
	},
	damage(this: Player, params?: EventDamageParams): GameEvent {
		const next = game.createEvent("damage") as DamageEvent;
		next.player = this;
		let noCard = false;
		let noSource = false;
		const event = _status.event;

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		if (args.length === 1 && typeof params == "object" && params !== null && get.itemtype(params) == null) {
			Object.assign(next, params);
			if (params.nosource) {
				noSource = true;
				delete next.nosource;
			}
			if (params.nocard) {
				noCard = true;
				delete next.nocard;
			}
			if (params.notrigger) {
				next._triggered = null;
			}
		} else {
			for (const arg of args) {
				if (get.itemtype(arg) == "cards") {
					next.cards = arg.slice();
				} else if (get.itemtype(arg) == "card") {
					next.card = arg;
				} else if (typeof arg == "number") {
					next.num = arg;
				} else if (get.itemtype(arg) == "player") {
					next.source = arg;
				} else if (arg && typeof arg == "object" && arg.name) {
					next.card = arg;
				} else if (arg == "nocard") {
					noCard = true;
				} else if (arg == "nosource") {
					noSource = true;
				} else if (arg == "notrigger") {
					next._triggered = null;
					next.notrigger = true;
				} else if (arg == "unreal") {
					next.unreal = true;
				} else if (arg == "nohujia") {
					next.nohujia = true;
				} else if (get.itemtype(arg) == "nature" && arg != "stab") {
					next.nature = arg;
				} else if (get.itemtype(arg) == "natures") {
					const natures = arg.split(lib.natureSeparator).remove("stab");
					if (natures.length) {
						next.nature = natures.join(lib.natureSeparator);
					}
				}
			}
		}
		if (!next.card && !noCard) {
			next.card = event.card;
		}
		if (!next.cards && !noCard) {
			next.cards = event.cards;
		}
		if (!next.source && !noSource) {
			const source = event.customSource || event.player;
			if (source && !source.isDead()) {
				next.source = source;
			}
		}
		if (typeof next.num != "number") {
			next.num = (event.baseDamage || 1) + (event.extraDamage || 0);
		}
		next.original_num = next.num;
		next.change_history = [];
		next.hasNature = function (nature) {
			if (!nature) {
				return Boolean(this.nature && this.nature.length > 0);
			}
			const natures = get.natureList(nature);
			const naturesx = get.natureList(this.nature);
			if (nature == "linked") {
				return naturesx.some(n => lib.linked.includes(n));
			}
			return get.is.sameNature(natures, naturesx);
		};
		if (next.hasNature("poison")) {
			delete next._triggered;
		} else if (next.unreal) {
			next._triggered = 2;
		}
		next.setContent("damage");
		next.filterStop = function () {
			if (this.source && this.source.isDead()) {
				delete this.source;
			}
			let num = this.original_num;
			// @ts-expect-error change_history is initialized on damage events
			for (const i of this.change_history) {
				num += i;
			}
			if (num != this.num) {
				// @ts-expect-error change_history is initialized on damage events
				this.change_history.push(Number(this.num) - num);
			}
			if (Number(this.num) <= 0) {
				delete this.filterStop;
				this.trigger("damageZero");
				this.finish();
				this._triggered = null;
				return true;
			}
			return false;
		};
		return next;
	},
	recover(this: Player, params?: EventRecoverParams): GameEvent {
		const next: RecoverEvent = game.createEvent("recover");
		next.player = this;
		let nocard = false;
		let nosource = false;

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		const event = _status.event;
		if (args.length === 1 && typeof params == "object" && params !== null && get.itemtype(params) == null) {
			Object.assign(next, params);
			if (params.nocard != null) {
				delete next.nocard;
				nocard = true;
			}
			if (params.nosource != null) {
				delete next.nosource;
				nosource = true;
			}
		} else {
			for (const arg of args) {
				if (get.itemtype(arg) == "cards") {
					next.cards = arg.slice(0);
				} else if (get.itemtype(arg) == "card") {
					next.card = arg;
				} else if (get.itemtype(arg) == "player") {
					next.source = arg;
				} else if (typeof arg == "object" && arg && arg.name) {
					next.card = arg;
				} else if (typeof arg == "number") {
					next.num = arg;
				} else if (arg == "nocard") {
					nocard = true;
				} else if (arg == "nosource") {
					nosource = true;
				}
			}
		}
		if (next.card == undefined && !nocard) {
			next.card = event.card;
		}
		if (next.cards == undefined && !nocard) {
			next.cards = event.cards;
		}
		if (next.source == undefined && !nosource) {
			next.source = event.customSource || event.player;
		}
		if (next.num == undefined) {
			next.num = (event.baseDamage || 1) + (event.extraDamage || 0);
		}
		next.filterStop = function () {
			if (Number(this.num) <= 0 || this.getPlayer().isHealthy()) {
				delete this.filterStop;
				this.finish();
				this._triggered = null;
				return true;
			}
		};
		next.setContent("recover");
		return next;
	},
	recoverTo(this: Player, num?: number, args?: EventRecoverToParams | any[]): GameEvent {
		const num2 = Number(num) - Number(this.getHp(true));

		if (Array.isArray(args)) {
			return this.recover(num2, ...args);
		}

		return this.recover({
			num: num2,
			...args,
		});
	},
	loseHp(this: Player, num?: number): GameEvent {
		const next = game.createEvent("loseHp");
		next.num = num ?? 1;
		next.player = this;
		next.setContent("loseHp");
		next.filterStop = function () {
			if (Number(this.num) <= 0) {
				delete this.filterStop;
				this.finish();
				this._triggered = null;
				return true;
			}
		};
		return next;
	},
	loseMaxHp(this: Player, params?: EventLoseMaxHpParams): GameEvent {
		const next = game.createEvent("loseMaxHp");
		next.player = this;
		next.num = 1;

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		if (args.length === 1 && typeof params == "object" && params !== null && get.itemtype(params) == null) {
			Object.assign(next, params);
		} else {
			for (const arg of args) {
				if (typeof arg === "number") {
					next.num = arg;
				} else if (typeof arg === "boolean") {
					next.forced = arg;
				}
			}
		}
		next.setContent("loseMaxHp");
		return next;
	},
	gainMaxHp(this: Player, params?: EventGainMaxHpParams): GameEvent {
		const next = game.createEvent("gainMaxHp");
		next.player = this;
		next.num = 1;

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		if (args.length === 1 && typeof params == "object" && params !== null && get.itemtype(params) == null) {
			Object.assign(next, params);
		} else {
			for (const arg of args) {
				if (typeof arg === "number") {
					next.num = arg;
				} else if (typeof arg === "boolean") {
					next.forced = arg;
				}
			}
		}
		next.setContent("gainMaxHp");
		return next;
	},
	changeHp(this: Player, num: number, popup?: boolean): GameEvent {
		const next: ChangeHpEvent = game.createEvent("changeHp");
		next.num = num;
		if (popup != undefined) {
			next.popup = popup;
		}
		next.player = this;
		next.originalHp = this.hp;
		next.setContent("changeHp");
		return next;
	},
	changeHujia(this: Player, num?: number, type?: "gain" | "lose" | "damage" | "null" | string, limit?: number | boolean): GameEvent {
		const next = game.createEvent("changeHujia");
		if (typeof num != "number") {
			num = 1;
		}
		if (limit === true) {
			limit = 5;
		}
		if (typeof limit == "number" && (this.hujia as any) + num > parseInt(String(limit), 10)) {
			num = Math.max(0, parseInt(String(limit), 10) - (this.hujia as any));
		}
		if (typeof type != "string") {
			if (num > 0) {
				type = "gain";
			} else if (num < 0) {
				type = "lose";
			} else {
				type = "null";
			}
		}
		next.num = num;
		next.player = this;
		next.type = type;
		next.setContent("changeHujia");
		return next;
	},
};
