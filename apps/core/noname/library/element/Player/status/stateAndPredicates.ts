import { _status, game, get, lib } from "noname";
import type { GameEvent, Player } from "../../index.js";
import type { TempSkillExpire } from "../contracts/instanceFieldsContract.js";
import type { RestStateRecord } from "../contracts/statusContract.js";
import "../contracts/statusContract.js";

function comparePlayerMetric(
	self: Player,
	only: boolean | undefined,
	filter: ((player: Player) => boolean) | undefined,
	mode: "max" | "min",
	metric: (player: Player) => number,
	eagerSelf = false
): boolean {
	const resolvedFilter = typeof filter === "function" ? filter : lib.filter.all;
	const cachedSelf = eagerSelf ? metric(self) : 0;
	return game.filterPlayer(resolvedFilter).every(value => {
		if (value.isOut() || value == self) {
			return true;
		}
		const targetMetric = eagerSelf ? cachedSelf : metric(self);
		const otherMetric = metric(value);
		if (mode === "max") {
			return only ? otherMetric < targetMetric : otherMetric <= targetMetric;
		}
		return only ? otherMetric > targetMetric : otherMetric >= targetMetric;
	});
}

export const stateAndPredicatesMethods = {
	isMad(this: Player): boolean {
		return this.hasSkill("mad");
	},
	goMad(this: Player, end?: TempSkillExpire): void {
		if (end) {
			this.addTempSkill("mad", end);
		} else {
			this.addSkill("mad");
		}
		game.log(this, "进入混乱状态");
	},
	unMad(this: Player): void {
		this.removeSkill("mad");
	},
	tempHide(this: Player): void {
		this.addTempSkill("qianxing", { player: "phaseBeginStart" });
	},
	turnOver(this: Player, bool?: boolean): GameEvent {
		const next = game.createEvent("turnOver");
		next.player = this;
		next.includeOut = true;
		next.setContent("turnOver");
		if (typeof bool == "boolean") {
			if (bool) {
				if (this.isTurnedOver()) {
					_status.event.next.remove(next);
					next.resolve();
				}
			} else {
				if (!this.isTurnedOver()) {
					_status.event.next.remove(next);
					next.resolve();
				}
			}
		}
		return next;
	},
	out(this: Player, skill?: number | string): void {
		if (typeof skill == "number") {
			this.outCount += skill;
		} else if (typeof skill == "string") {
			if (!this.outSkills) {
				this.outSkills = [];
			}
			this.outSkills.add(skill);
		} else {
			this.outCount++;
		}
		if (!this.classList.contains("out")) {
			this.classList.add("out");
			game.log(this, "离开游戏");
		}
		if (!game.countPlayer()) {
			game.over();
		}
	},
	in(this: Player, skill?: number | string | boolean): void {
		if (this.isOut()) {
			if (typeof skill == "string") {
				if (this.outSkills) {
					this.outSkills.remove(skill);
					if (!this.outSkills.length) {
						delete this.outSkills;
					}
				}
			} else if (typeof skill == "number") {
				this.outCount -= skill;
			} else {
				if (skill === true) {
					delete this.outSkills;
				}
				this.outCount = 0;
			}
			if (this.outCount <= 0 && !this.outSkills) {
				this.outCount = 0;
				this.classList.remove("out");
				game.log(this, "进入游戏");
			}
		}
	},
	link(this: Player, bool?: boolean): GameEvent {
		const next = game.createEvent("link");
		next.player = this;
		next.setContent("link");
		if (typeof bool == "boolean") {
			if (bool) {
				if (this.isLinked()) {
					_status.event.next.remove(next);
					next.resolve();
				}
			} else {
				if (!this.isLinked()) {
					_status.event.next.remove(next);
					next.resolve();
				}
			}
		}
		return next;
	},
	addLink(this: Player): void {
		if (get.is.linked2(this)) {
			this.classList.add("linked2");
		} else {
			this.classList.add("linked");
		}
	},
	removeLink(this: Player): void {
		if (get.is.linked2(this)) {
			this.classList.remove("linked2");
		} else {
			this.classList.remove("linked");
		}
	},
	isAlive(this: Player): boolean {
		return this.classList.contains("dead") == false;
	},
	isDead(this: Player): boolean {
		return this.classList.contains("dead");
	},
	isRest(this: Player): false | RestStateRecord | undefined {
		if (!this.isAlive() || !this.isOut()) {
			return false;
		}
		const restReturn = _status._rest_return;
		if (restReturn === undefined) {
			throw new TypeError("Rest state has not been initialized");
		}
		return restReturn[String(this.playerid)];
	},
	isDying(this: Player): boolean {
		return _status.dying.includes(this) && Number(this.hp) <= 0 && this.isAlive();
	},
	isDamaged(this: Player): boolean {
		return (this.hp as any) < (this.maxHp as any) && !this.storage.nohp;
	},
	isHealthy(this: Player): boolean {
		return (this.hp as any) >= (this.maxHp as any) || this.storage.nohp;
	},
	isMaxMaxHp(this: Player, only?: boolean, filter?: (player: Player) => boolean): boolean {
		return comparePlayerMetric(this, only, filter, "max", player => Number(player.maxHp));
	},
	isMinMaxHp(this: Player, only?: boolean, filter?: (player: Player) => boolean): boolean {
		return comparePlayerMetric(this, only, filter, "min", player => Number(player.maxHp));
	},
	isMaxHp(this: Player, only?: boolean, raw?: boolean, filter?: (player: Player) => boolean): boolean {
		return comparePlayerMetric(this, only, filter, "max", player => Number(player.getHp(raw)));
	},
	isMinHp(this: Player, only?: boolean, raw?: boolean, filter?: (player: Player) => boolean): boolean {
		return comparePlayerMetric(this, only, filter, "min", player => Number(player.getHp(raw)));
	},
	isMaxCard(this: Player, only?: boolean, filter?: (player: Player) => boolean): boolean {
		return comparePlayerMetric(this, only, filter, "max", player => player.countCards("he"), true);
	},
	isMinCard(this: Player, only?: boolean, filter?: (player: Player) => boolean): boolean {
		return comparePlayerMetric(this, only, filter, "min", player => player.countCards("he"), true);
	},
	isMaxHandcard(this: Player, only?: boolean, filter?: (player: Player) => boolean): boolean {
		return comparePlayerMetric(this, only, filter, "max", player => player.countCards("h"), true);
	},
	isMinHandcard(this: Player, only?: boolean, filter?: (player: Player) => boolean): boolean {
		return comparePlayerMetric(this, only, filter, "min", player => player.countCards("h"), true);
	},
	isMaxEquip(this: Player, only?: boolean, filter?: (player: Player) => boolean): boolean {
		return comparePlayerMetric(this, only, filter, "max", player => player.countCards("e"), true);
	},
	isMinEquip(this: Player, only?: boolean, filter?: (player: Player) => boolean): boolean {
		return comparePlayerMetric(this, only, filter, "min", player => player.countCards("e"), true);
	},
	isLinked(this: Player): boolean {
		if (get.is.linked2(this)) {
			return this.classList.contains("linked2");
		}
		return this.classList.contains("linked");
	},
	isTurnedOver(this: Player): boolean {
		return this.classList.contains("turnedover");
	},
	isOut(this: Player): boolean {
		return this.classList.contains("out");
	},
	isMin(this: Player, distance?: boolean): boolean {
		if (distance && lib.config.mode != "stone") {
			return false;
		}
		if (this.forcemin) {
			return true;
		}
		return this.classList.contains("minskin") && !game.chess;
	},
	isIn(this: Player): boolean {
		return this.classList.contains("dead") == false && this.classList.contains("out") == false && !this.removed;
	},
	isUnseen(this: Player, num?: number): boolean {
		switch (num) {
			case 0:
				return this.classList.contains("unseen");
			case 1:
				return this.classList.contains("unseen2");
			case 2:
				return this.classList.contains("unseen") || this.classList.contains("unseen2");
			default:
				return this.classList.contains("unseen") && (!this.name2 || this.classList.contains("unseen2"));
		}
	},
	isUnderControl(this: Player, self?: boolean, me?: Player | null): boolean {
		me = me || game.me;
		const that = this._trueMe || this;
		if (that.isMad() || game.notMe) {
			return false;
		}
		if (this === me) {
			if (self) {
				return true;
			}
			return false;
		}
		if (that === me || this == me?._trueMe) {
			return true;
		}
		if (_status.connectMode) {
			return false;
		}
		if (lib.config.mode == "versus") {
			if (_status.mode == "three") {
				return this.side == me!.side;
			}
			if (_status.mode == "standard") {
				return Boolean(lib.storage.single_control) && this.side == me!.side;
			}
			if (_status.mode == "four") {
				return get.config("four_phaseswap") && this.side == me!.side;
			}
			if (_status.mode == "two") {
				return get.config("two_phaseswap") && this.side == me!.side;
			}
			return false;
		} else if (lib.config.mode == "boss") {
			if (me!.side) {
				return false;
			}
			return this.side == me!.side && get.config("single_control");
		} else if (game.chess) {
			if (lib.config.mode == "chess") {
				if (_status.mode == "combat" && !get.config("single_control")) {
					return false;
				}
			}
			return this.side == me!.side;
		}
		return false;
	},
	isMine(this: Player): boolean {
		return this == game.me && !_status.auto && !(_status as { llmSelfControlledAtGameStart?: boolean }).llmSelfControlledAtGameStart && !this.isMad() && !game.notMe;
	},
	isOnline(this: Player): boolean {
		if (this.ws && lib.node && !this.ws.closed && this.ws.inited && !this.isAuto) {
			return true;
		}
		return false;
	},
	isOnline2(this: Player): boolean {
		if (this.ws && lib.node && !this.ws.closed) {
			return true;
		}
		return false;
	},
	isOffline(this: Player): boolean {
		if (this.ws && lib.node && this.ws.closed) {
			return true;
		}
		return false;
	},
};
