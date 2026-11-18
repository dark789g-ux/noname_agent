import { _status, game, get, lib } from "noname";
import type { Player } from "../../index.js";
import "../contracts/statusContract.js";

export const formationAndMajorMethods = {
	isMajor(this: Player): boolean {
		if (get.mode() == "guozhan") {
			if (this.identity == "unknown") {
				return false;
			}
			const list = game.filterPlayer(function (current) {
				return current.identity != "unknown" && current.hasSkillTag("forceMajor");
			});
			if (list.length) {
				for (const i of list) {
					if (i.isFriendOf(this)) {
						return true;
					}
				}
				return false;
			}
			const map: Record<string, Player[]> = {};
			const sides: (string | undefined)[] = [];
			const pmap = _status.connectMode ? lib.playerOL : game.playerMap;
			let player: string | undefined;
			for (const i of game.players) {
				if (i.identity == "unknown") {
					continue;
				}
				let added = false;
				for (const j of sides) {
					if (i.isFriendOf(pmap[String(j)])) {
						added = true;
						map[String(j)].push(i);
						if (i == this) {
							player = j;
						}
						break;
					}
				}
				if (!added) {
					const key = i.playerid as string;
					map[key] = [i];
					sides.push(i.playerid);
					if (i == this) {
						player = i.playerid;
					}
				}
			}
			if (!player || map[player].length < 2) {
				return false;
			}
			for (const i in map) {
				if (map[i].length > map[player].length) {
					return false;
				}
			}
			return true;
		} else {
			const list = game.filterPlayer(function (current) {
				return current.hasSkillTag("forceMajor");
			});
			if (list.length) {
				for (const i of list) {
					if (i.group == this.group) {
						return true;
					}
				}
				return false;
			}
			const map: Record<string, Player[]> = {};
			for (const i of game.players) {
				const groupKey = i.group as string;
				if (!map[groupKey]) {
					map[groupKey] = [];
				}
				map[groupKey].push(i);
			}
			const selfGroup = this.group as string;
			for (const i in map) {
				if (map[i].length > map[selfGroup].length) {
					return false;
				}
			}
			return true;
		}
	},
	isNotMajor(this: Player): boolean {
		for (let i = 0; i < game.players.length; i++) {
			if (game.players[i].isMajor()) {
				return !this.isMajor();
			}
		}
		return false;
	},
	isMinor(this: Player, nomajor?: boolean): boolean {
		if (get.mode() == "guozhan") {
			if (this.identity == "unknown" || (!nomajor && this.isMajor())) {
				return false;
			}
			if (
				!nomajor &&
				!game.hasPlayer(function (current) {
					return current.isMajor();
				})
			) {
				return false;
			}
			const map: Record<string, Player[]> = {};
			const sides: (string | undefined)[] = [];
			const pmap = _status.connectMode ? lib.playerOL : game.playerMap;
			let player: string | undefined;
			for (const i of game.players) {
				if (i.identity == "unknown") {
					continue;
				}
				let added = false;
				for (const j of sides) {
					if (i.isFriendOf(pmap[String(j)])) {
						added = true;
						map[String(j)].push(i);
						if (i == this) {
							player = j;
						}
						break;
					}
				}
				if (!added) {
					const key = i.playerid as string;
					map[key] = [i];
					sides.push(i.playerid);
					if (i == this) {
						player = i.playerid;
					}
				}
			}
			const selfKey = player as string;
			for (const i in map) {
				if (map[i].length < map[selfKey].length) {
					return false;
				}
			}
			return true;
		} else {
			if (!nomajor && this.isMajor()) {
				return false;
			}
			if (
				!nomajor &&
				!game.hasPlayer(function (current) {
					return current.isMajor();
				})
			) {
				return false;
			}
			const map: Record<string, Player[]> = {};
			for (const i of game.players) {
				const groupKey = i.group as string;
				if (!map[groupKey]) {
					map[groupKey] = [];
				}
				map[groupKey].push(i);
			}
			const selfGroup = this.group as string;
			for (const i in map) {
				if (map[i].length < map[selfGroup].length) {
					return false;
				}
			}
			return true;
		}
	},
	siege(this: Player, player?: Player): boolean {
		if (this.identity == "unknown" || this.hasSkill("undist")) {
			return false;
		}
		if (!player) {
			const next = this.getNext();
			if (next && next.sieged()) {
				return true;
			}
			const previous = this.getPrevious();
			if (previous && previous.sieged()) {
				return true;
			}
			return false;
		} else {
			return player.sieged() && (player.getNext() == this || player.getPrevious() == this);
		}
	},
	sieged(this: Player, player?: Player): boolean {
		if (this.identity == "unknown") {
			return false;
		}
		if (player) {
			return player.siege(this);
		} else {
			const next = this.getNext();
			const previous = this.getPrevious();
			if (next && previous && next != previous) {
				if (next.identity == "unknown" || next.isFriendOf(this)) {
					return false;
				}
				return next.isFriendOf(previous);
			}
			return false;
		}
	},
	inline(this: Player, ...args: Player[]): boolean {
		if (["unknown", "ye"].includes(this.identity) || this.hasSkill("undist")) {
			return false;
		}
		let next: Player | null = this;
		let previous: Player | null = this;
		const list: Player[] = [];
		for (let i = 0; next || previous; i++) {
			if (next) {
				next = next.getNext();
				if (!next || !next.isFriendOf(this) || next == this) {
					next = null;
				} else {
					list.add(next);
				}
			}
			if (previous) {
				previous = previous.getPrevious();
				if (!previous || !previous.isFriendOf(this) || previous == this) {
					previous = null;
				} else {
					list.add(previous);
				}
			}
		}
		if (!list.length) {
			return false;
		}
		for (const arg of args) {
			if (!list.includes(arg) && arg != this) {
				return false;
			}
		}
		return true;
	},
};
