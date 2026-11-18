import { _status, game, get, lib, ui } from "noname";
import { Player, Card, Button } from "../index.js";
import type { GameEvent } from "../gameEvent.js";
import { requireRegisteredSkill } from "../../skillRegistry.js";
import type { triggerSkillTodo, triggerPlayerTodo, GameEventNumberValue, GameEventCustomCallbacks, GameEventSetValue, EventSelectionRange, EventButtonFilter, EventCardFilter, EventTargetFilter, LegacySelectionCallback, EventFinalFilter, LegacySelectionChoice, EventSelectionState, EventSelectionBackup, GameEventHandlerKey, GameEventDefaultHandlerKey, GameEventHandler, GameEventSetEntry, GameEventParentFallback, EventExecution, EventCreationFields, GameEventSetFields, EventCreationFieldInput, GameDrawNumber, GameDrawNumberValue, GameDrawSupportFields, RawGameDrawEvent, GameDrawFields, GameDrawEvent, GameDrawEventDraft, EventContentFieldRequirements, EventContentNameFor } from "./eventContracts.js";

export const stateMethods = {
	getParent<E extends GameEvent<GameEventNumberValue>>(this: E, level: number | string | ((evt: GameEvent<GameEventNumberValue>) => boolean) = 1, forced?: boolean, includeSelf?: boolean): GameEvent<GameEventNumberValue> | GameEventParentFallback | undefined {
		let event: GameEvent<GameEventNumberValue> | undefined = this;
		let i = 0;
		const toreturn: GameEventParentFallback | undefined = forced ? undefined : {};
		const historys: GameEvent<GameEventNumberValue>[] = [];
		const filter = typeof level === "function" ? level : typeof level === "number" ? evt => i === level : evt => evt.name === level;
		while (true) {
			if (!event) {
				return toreturn;
			}
			historys.push(event);
			if (filter(event) && (includeSelf || i !== 0)) {
				return event;
			}
			if (game.online && event._modparent) {
				event = event._modparent;
			} else {
				event = event.parent;
			}
			if (event && historys.includes(event)) {
				return toreturn;
			}
			i++;
		}
	},
	async checkSkipped<E extends GameEvent<GameEventNumberValue>>(this: E): Promise<boolean> {
		if (!this.player || (!this.player.skipList.includes(this.name) && !this.isSkipped)) {
			return false;
		}
		this.player.skipList.remove(this.name);
		if (lib.phaseName.includes(this.name)) {
			this.player.getHistory("skipped").add(this.name);
		}
		this.finish();
		await this.trigger(this.name + "Skipped");
		return true;
	},
	finish<E extends GameEvent<GameEventNumberValue>>(this: E) {
		this.finished = true;
	},
	// @todo 奇怪的参数
	cancel<E extends GameEvent<GameEventNumberValue>>(this: E, all?: any, player?: any, notrigger?: any) {
		this.untrigger(all, player);
		let next;
		if (!notrigger) {
			if (this.player && lib.phaseName.includes(this.name)) {
				this.player.getHistory("skipped").add(this.name);
			}
			this._cancelled = true;
			next = this.trigger(this.name + "Cancelled");
		}
		this.finish();
		return next;
	},
	async neutralize<E extends GameEvent<GameEventNumberValue>>(this: E, event = _status.event) {
		if (this._neutralized) {
			return this._triggering;
		}
		this._neutralized = true;
		this._neutralize_event = event;
		const next = this.trigger("eventNeutralized");
		if (next) {
			next.filterStop = function () {
				if (!this._neutralized) {
					delete this.filterStop;
					return true;
				}
				return false;
			};
		}
		await next;
		if (this._neutralized == true) {
			this.untrigger();
			this.finish();
		}
	},
	unneutralize<E extends GameEvent<GameEventNumberValue>>(this: E) {
		if (!this._neutralized) {
			return;
		}
		this._neutralized = false;
		if (this.type == "card" && this.card && this.name == "sha") {
			this.directHit = true;
		}
	},
	goto<E extends GameEvent<GameEventNumberValue>>(this: E, step: number) {
		this.step = step;
		return this;
	},
	redo<E extends GameEvent<GameEventNumberValue>>(this: E) {
		this.goto(this.step);
		return this;
	},
	getPlayer<E extends GameEvent<GameEventNumberValue>>(this: E) {
		const player = this.player;
		if (!player) {
			throw new Error(`${this.name || "unnamed"} event requires a player`);
		}
		return player;
	},
	getPlayers<E extends GameEvent<GameEventNumberValue>>(this: E) {
		const players = this.players;
		if (!players) {
			throw new Error(`${this.name || "unnamed"} event requires players`);
		}
		return players;
	},
	getTarget<E extends GameEvent<GameEventNumberValue>>(this: E) {
		const target = this.target;
		if (!target || target === "cardPile") {
			throw new Error(`${this.name || "unnamed"} event requires a target`);
		}
		return target;
	},
	getTargets<E extends GameEvent<GameEventNumberValue>>(this: E) {
		const targets = this.targets;
		if (!targets) {
			throw new Error(`${this.name || "unnamed"} event requires targets`);
		}
		return targets;
	},
	changeToZero<E extends GameEvent<GameEventNumberValue>>(this: E): E {
		Object.assign(this, { num: 0, numFixed: true });
		return this;
	},
	setHiddenSkill<E extends GameEvent<GameEventNumberValue>>(this: E, skill: string) {
		if (!this.player) {
			return this;
		}
		const hidden = this.player.hiddenSkills.slice(0);
		game.expandSkills(hidden);
		if (hidden.includes(skill)) {
			this.set("hsskill", skill);
		}
		return this;
	},
	getLogv<E extends GameEvent<GameEventNumberValue>>(this: E) {
		for (let i = 1; i <= 3; i++) {
			const event = this.getParent(i);
			if (event && event.logvid) {
				return event.logvid;
			}
		}
		return null;
	},
	getRand<E extends GameEvent<GameEventNumberValue>>(this: E, name?: string) {
		if (name) {
			if (!this._rand_map) {
				this._rand_map = {};
			}
			if (!this._rand_map[name]) {
				this._rand_map[name] = Math.random();
			}
			return this._rand_map[name];
		}
		if (!this._rand) {
			this._rand = Math.random();
		}
		return this._rand;
	},
	isMine<E extends GameEvent<GameEventNumberValue>>(this: E) {
		return this.player?.isMine();
	},
	isOnline<E extends GameEvent<GameEventNumberValue>>(this: E) {
		return this.player?.isOnline();
	},
	notLink<E extends GameEvent<GameEventNumberValue>>(this: E) {
		return this.getParent().name != "_lianhuan" && this.getParent().name != "_lianhuan2";
	},
	isPhaseUsing<E extends GameEvent<GameEventNumberValue>>(this: E, player) {
		const evt = this.getParent("phaseUse");
		if (!evt || evt.name != "phaseUse") {
			return false;
		}
		return !player || player == evt.player;
	},
	putStepCache<E extends GameEvent<GameEventNumberValue>>(this: E, key: string, value: unknown) {
		if (!this._stepCache) {
			this._stepCache = {};
		}
		this._stepCache[key] = value;
		return this;
	},
	getStepCache<E extends GameEvent<GameEventNumberValue>>(this: E, key: string): unknown {
		if (!this._stepCache) {
			return undefined;
		}
		return this._stepCache[key];
	},
	clearStepCache<E extends GameEvent<GameEventNumberValue>>(this: E, key?: string | null) {
		if (key !== undefined && key !== null) {
			const cache = this._stepCache;
			if (!cache) {
				// The prior direct property delete throws here as well; do not turn a
				// missing lifecycle cache into a successful clear.
				throw new TypeError("Cannot clear an uninitialized step cache");
			}
			delete cache[key];
		}
		delete this._stepCache;
		return this;
	},
	callFuncUseStepCache<E extends GameEvent<GameEventNumberValue>>(this: E, prefix: string, func: unknown, params: unknown[]): unknown {
		if (typeof func != "function") {
			return;
		}
		if (_status.closeStepCache) {
			return func.apply(null, params);
		}
		const cacheKey = "[" + prefix + "]" + get.paramToCacheKey.apply(null, params);
		let ret = this.getStepCache(cacheKey);
		if (ret === undefined || ret === null) {
			ret = func.apply(null, params);
			this.putStepCache(cacheKey, ret);
		}
		return ret;
	},
	putTempCache<E extends GameEvent<GameEventNumberValue>>(this: E, key1: string, key2: string, value: unknown): unknown {
		if (!this._tempCache) {
			this._tempCache = {};
		}
		if (!this._tempCache[key1]) {
			this._tempCache[key1] = {};
		}
		this._tempCache[key1][key2] = value;
		return value;
	},
	getTempCache<E extends GameEvent<GameEventNumberValue>>(this: E, key1: string, key2: string): unknown {
		if (!this._tempCache) {
			return undefined;
		}
		if (!this._tempCache[key1]) {
			return undefined;
		}
		return this._tempCache[key1][key2];
	},
};

export type StateMethods = typeof stateMethods;
