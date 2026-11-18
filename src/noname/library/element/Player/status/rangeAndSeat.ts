import { _status, game, get, ui } from "noname";
import type { Card, Player, VCard } from "../../index.js";
import "../contracts/statusContract.js";

export const rangeAndSeatMethods = {
	setSeatNum(this: Player, num: number): void {
		_status.seatNumSettled = true;
		game.broadcastAll(
			function (player: Player, num: number) {
				player.seatNum = num;
				ui?.updateLLMLogButton?.(player);
			},
			this,
			num
		);
	},
	getSeatNum(this: Player): number {
		if (typeof this.seatNum == "number") {
			return this.seatNum;
		}
		return 0;
	},
	inRange(this: Player, to: Player): boolean {
		const from = this;
		if (from == to || from.hasSkill("undist") || to.hasSkill("undist")) {
			return false;
		}
		if (!game.players.includes(from) && !game.dead.includes(from)) {
			return false;
		}
		if (!game.players.includes(to) && !game.dead.includes(to)) {
			return false;
		}
		const mod1 = game.checkMod(from, to, "unchanged", "inRange", from);
		if (typeof mod1 == "boolean") {
			return mod1;
		}
		const mod2 = game.checkMod(from, to, "unchanged", "inRangeOf", to);
		if (typeof mod2 == "boolean") {
			return mod2;
		}
		const range = from.getAttackRange();
		if (range < 1) {
			return false;
		}
		let player: Player = from;
		let m: number;
		let n = 1;
		if (game.chess) {
			const fxy = from.getXY();
			const txy = to.getXY();
			n = Math.abs(fxy[0] - txy[0]) + Math.abs(fxy[1] - txy[1]);
		} else if (to.isMin(true) || from.isMin(true)) {
			/* empty */
		} else {
			let length = game.players.length;
			const totalPopulation = game.players.length + game.dead.length + 1;
			for (let iwhile = 0; iwhile < totalPopulation; iwhile++) {
				if (player.nextSeat != to) {
					player = player.nextSeat;
					if (player.isAlive() && !player.isOut() && !player.hasSkill("undist") && !player.isMin(true)) {
						n++;
					}
				} else {
					break;
				}
			}
			for (let i = 0; i < game.players.length; i++) {
				if (game.players[i].isOut() || game.players[i].hasSkill("undist") || game.players[i].isMin(true)) {
					length--;
				}
			}
			if (from.isDead()) {
				length++;
			}
			if (to.isDead()) {
				length++;
			}
			const left = from.hasSkillTag("left_hand");
			const right = from.hasSkillTag("right_hand");
			if (left === right) {
				n = Math.min(n, length - n);
			} else if (left == true) {
				n = length - n;
			}
		}
		n = game.checkMod(from, to, n, "globalFrom", from);
		n = game.checkMod(from, to, n, "globalTo", to);
		m = n;
		m = game.checkMod(from, to, m, "attackFrom", from);
		m = game.checkMod(from, to, m, "attackTo", to);
		const equips1 = from.getVCards("e", function (card) {
			return !card.cards?.some(card => {
				return ui.selected.cards?.includes(card);
			});
		});
		const equips2 = to.getVCards("e", function (card) {
			return !card.cards?.some(card => {
				return ui.selected.cards?.includes(card);
			});
		});
		for (let i = 0; i < equips1.length; i++) {
			const info = get.info(equips1[i]).distance;
			if (!info) {
				continue;
			}
			if (info.globalFrom) {
				m += info.globalFrom;
				n += info.globalFrom;
			}
		}
		for (let i = 0; i < equips2.length; i++) {
			const info = get.info(equips2[i]).distance;
			if (!info) {
				continue;
			}
			if (info.globalTo) {
				m += info.globalTo;
				n += info.globalTo;
			}
			if (info.attackTo) {
				m += info.attackTo;
			}
		}
		return m <= range;
	},
	inRangeOf(this: Player, source: Player): boolean {
		return source.inRange(this);
	},
	getNext(this: Player): Player | null {
		if (this.hasSkill("undist")) {
			return null;
		}
		let target: Player = this;
		for (let i = 0; i < game.players.length - 1; i++) {
			target = target.next;
			if (!target.hasSkill("undist")) {
				return target;
			}
		}
		return null;
	},
	getPrevious(this: Player): Player | null {
		if (this.hasSkill("undist")) {
			return null;
		}
		let target: Player = this;
		for (let i = 0; i < game.players.length - 1; i++) {
			target = target.previous;
			if (!target.hasSkill("undist")) {
				return target;
			}
		}
		return null;
	},
	getAttackRange(this: Player, raw?: boolean): number {
		const player = this;
		let range = 0;
		if (raw) {
			range = game.checkMod(player, player, range, "globalFrom", player);
			range = game.checkMod(player, player, range, "attackFrom", player);
			const equips = player.getVCards("e", function (card) {
				return !card.cards?.some(card => {
					return ui.selected.cards?.includes(card);
				});
			});
			equips.forEach(card => {
				const info = get.info(card, false).distance;
				if (info && info.globalFrom) {
					range += info.globalFrom;
				}
			});
			return player.getEquipRange() - range;
		}
		const base = game.checkMod(player, "unchanged", "attackRangeBase", player);
		if (base != "unchanged") {
			range = base as number;
		} else {
			range = player.getEquipRange();
		}
		range = game.checkMod(player, range, "attackRange", player);
		range = game.checkMod(player, range, "attackRangeFinal", player);
		return range;
	},
	getEquipRange(this: Player, cards?: (Card | VCard)[]): number {
		const player = this;
		if (!cards) {
			cards = player.getVCards("e", function (card) {
				return !card.cards?.some(card => {
					return ui.selected.cards?.includes(card);
				});
			});
		}
		let range: number | false = false;
		const length = cards.length;
		for (let index = 0; index < length; index++) {
			if (!(index in cards)) {
				continue;
			}
			const card = cards[index];
			let newRange: number | false = false;
			const info = get.info(card, false);
			if (info.distance) {
				if (typeof info.distance.attackRange == "function") {
					newRange = info.distance.attackRange(card, player);
				} else if (typeof info.distance.attackFrom == "number") {
					newRange = 1 - info.distance.attackFrom;
				}
			}
			if (typeof range == "number" && typeof newRange == "number") {
				range = Math.max(range, newRange);
			} else if (typeof range != "number") {
				range = newRange;
			}
		}
		return typeof range == "number" ? range : 1;
	},
	getGlobalFrom(this: Player): number {
		const player = this;
		let range = 0;
		range = game.checkMod(player, player, range, "globalFrom", player);
		const equips = player.getVCards("e", function (card) {
			return !card.cards?.some(card => {
				return ui.selected.cards?.includes(card);
			});
		});
		for (let i = 0; i < equips.length; i++) {
			const info = get.info(equips[i]).distance;
			if (!info) {
				continue;
			}
			if (info.globalFrom) {
				range += info.globalFrom;
			}
		}
		return -range;
	},
	getGlobalTo(this: Player): number {
		const player = this;
		let range = 0;
		range = game.checkMod(player, player, range, "globalTo", player);
		const equips = player.getVCards("e", function (card) {
			return !card.cards?.some(card => {
				return ui.selected.cards?.includes(card);
			});
		});
		for (let i = 0; i < equips.length; i++) {
			const info = get.info(equips[i]).distance;
			if (!info) {
				continue;
			}
			if (info.globalTo) {
				range += info.globalTo;
			}
		}
		return range;
	},
	distanceTo(this: Player, target: Player, method?: string): number {
		return get.distance(this, target, method);
	},
	distanceFrom(this: Player, target: Player, method?: string): number {
		return get.distance(target, this, method);
	},
};
