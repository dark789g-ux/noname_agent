import { _status, game, get, lib } from "noname";
import type { Card, Player } from "../../index.js";
import "../contracts/cardContract.js";

export const cardAiEstimationMethods = {
	addExpose(this: Player, num: number): Player {
		if (typeof this.ai.shown == "number" && !this.identityShown && this.ai.shown < 1) {
			this.ai.shown += num;
			if (this.ai.shown > 0.95) {
				this.ai.shown = 0.95;
			}
		}
		return this;
	},
	attitudeTo(this: Player, target: Player): number {
		if (typeof get.attitude == "function") {
			return get.attitude(this, target);
		}
		return 0;
	},
	hasFriend(this: Player): boolean {
		for (let i = 0; i < game.players.length; i++) {
			if (game.players[i].isOut()) {
				continue;
			}
			if (game.players[i] != this && get.attitude(game.players[i], this) > 0) {
				return true;
			}
		}
		return false;
	},
	hasUnknown(this: Player, num?: number): boolean {
		const mode = get.mode();
		if (typeof num != "number") {
			num = 0;
		}
		if (mode == "identity" || mode == "guozhan") {
			for (let i = 0; i < game.players.length; i++) {
				if (game.players[i].ai.shown == 0 && game.players[i] != this) {
					num--;
					if (num <= 0) {
						return true;
					}
				}
			}
		}
		return false;
	},
	isUnknown(this: Player, player?: Player): boolean {
		const mode = get.mode();
		if (mode == "identity" || mode == "guozhan") {
			if (this.ai.shown == 0 && this != player) {
				return true;
			}
		}
		return false;
	},
	hasWuxie(this: Player, info?: unknown): boolean {
		if (this.countCards("hs", "wuxie")) {
			return true;
		}
		const skills = this.getSkills("invisible").concat(lib.skill.global);
		game.expandSkills(skills);
		for (let i = 0; i < skills.length; i++) {
			const ifo = get.info(skills[i]);
			if (!ifo) {
				continue;
			}
			if (ifo.hiddenWuxie && info) {
				if (typeof ifo.hiddenWuxie == "function" && ifo.hiddenWuxie(this, info)) {
					return true;
				}
			} else if (typeof ifo.viewAs == "object" && ifo.viewAs !== null && !Array.isArray(ifo.viewAs) && ifo.viewAs.name == "wuxie") {
				if (!ifo.viewAsFilter || ifo.viewAsFilter(this)) {
					return true;
				}
			} else {
				const hiddenCard = ifo.hiddenCard;
				if (typeof hiddenCard == "function" && hiddenCard(this, "wuxie")) {
					return true;
				}
			}
		}
		return false;
	},
	hasSha(this: Player, respond?: string | boolean, noauto?: boolean): boolean {
		if (this.countCards("hs", "sha")) {
			return true;
		}
		if (this.countCards("hs", "hufu")) {
			return true;
		}
		if (!noauto && this.countCards("hs", "yuchanqian")) {
			return true;
		}
		if (typeof respond !== "string") {
			respond = respond ? "all" : "use";
		}
		if (this.hasSkillTag("respondSha", true, respond, true)) {
			return true;
		}
		return this.hasUsableCard("sha", respond);
	},
	hasShan(this: Player, respond?: string | boolean): boolean {
		if (this.countCards("hs", "shan")) {
			return true;
		}
		if (this.countCards("hs", "hufu")) {
			return true;
		}
		if (typeof respond !== "string") {
			respond = respond ? "all" : "use";
		}
		if (this.hasSkillTag("respondShan", true, respond, true)) {
			return true;
		}
		return this.hasUsableCard("shan", respond);
	},
	mayHaveSha(this: Player, viewer?: Player | null, type?: "use" | "respond", ignore?: Card[] | Card | null, rvt?: "bool" | "count" | "odds"): boolean | number {
		let count = 0;
		if ((Number(this.hp) > 2 || (!this.isZhu && Number(this.hp) > 1)) && this.hasSkillTag("respondSha", true, type, true)) {
			if (rvt === "count") {
				count++;
			} else if (rvt === "odds") {
				return 1;
			} else {
				return true;
			}
		}
		if (get.itemtype(viewer) !== "player") {
			viewer = _status.event.player;
		}
		let cards: Card[],
			selected: Card[] = [];
		if (Array.isArray(ignore)) {
			selected.addArray(ignore);
		} else if (typeof ignore == "object" && ignore !== null) {
			selected.add(ignore);
		}
		if (this === viewer || get.itemtype(viewer) == "player") {
			cards = this.getKnownCards(viewer);
		} else {
			cards = this.getShownCards();
		}
		count += cards.filter(card => {
			if (selected.includes(card)) {
				return false;
			}
			let name = get.name(card, this);
			if (name == "sha" || name == "hufu" || name == "yuchanqian") {
				if (type === "use") {
					return lib.filter.cardEnabled(card, this);
				}
				if (type === "respond") {
					return lib.filter.cardRespondable(card, this);
				}
				return true;
			}
			return false;
		}).length;
		if (count && rvt !== "count") {
			return rvt === "odds" ? 1 : true;
		}
		let hs = this.getCards("hs").filter(i => !cards.includes(i) && !selected.includes(i)).length;
		if (!hs) {
			if (rvt === "count") {
				return count;
			} else if (rvt === "odds") {
				return 0;
			}
			return false;
		}
		if (rvt === "count") {
			if (this.isPhaseUsing()) {
				return count + hs / 4;
			}
			return count + hs / 4.8;
		}
		if (hs > 9 || this.isPhaseUsing()) {
			count += Math.pow(2 + hs, 2) / 40;
		} else {
			count += -1.5 * Math.log(1 - hs / 10);
		}
		if (rvt === "odds") {
			return Math.min(1, count);
		}
		return count > _status.event.getRand("mayHaveSha" + hs + this.playerid);
	},
	mayHaveShan(this: Player, viewer?: Player | null, type?: "use" | "respond", ignore?: Card[] | Card | boolean | null, rvt?: "bool" | "count" | "odds"): boolean | number {
		let count = 0;
		if ((Number(this.hp) > 2 || (!this.isZhu && Number(this.hp) > 1)) && this.hasSkillTag("respondShan", true, type, true)) {
			if (rvt === "count") {
				count++;
			} else if (rvt === "odds") {
				return 1;
			} else {
				return true;
			}
		}
		if (get.itemtype(viewer) !== "player") {
			viewer = _status.event.player;
		}
		let cards: Card[],
			selected: Card[] = [];
		if (Array.isArray(ignore)) {
			selected.addArray(ignore);
		} else if (typeof ignore == "object" && ignore !== null) {
			selected.add(ignore);
		}
		if (this === viewer || get.itemtype(viewer) == "player") {
			cards = this.getKnownCards(viewer);
		} else {
			cards = this.getShownCards();
		}
		count += cards.filter(card => {
			if (selected.includes(card)) {
				return false;
			}
			let name = get.name(card, this);
			if (name === "shan" || name === "hufu") {
				if (type === "use") {
					return lib.filter.cardEnabled(card, this, "forceEnable");
				}
				if (type === "respond") {
					return lib.filter.cardRespondable(card, this);
				}
				return true;
			}
			return false;
		}).length;
		if (count && rvt !== "count") {
			return rvt === "odds" ? 1 : true;
		}
		let hs = this.getCards("hs").filter(i => !cards.includes(i) && !selected.includes(i)).length;
		if (!hs) {
			if (rvt === "count") {
				return count;
			} else if (rvt === "odds") {
				return 0;
			}
			return false;
		}
		if (rvt === "count") {
			if (this.isPhaseUsing()) {
				return count + hs / 6;
			}
			return count + hs / 3.5;
		}
		if (this.isPhaseUsing()) {
			count += -1.5 * Math.log(1 - hs / 10);
		} else {
			count += (2 * hs) / (5 + hs);
		}
		if (rvt === "odds") {
			return Math.min(1, count);
		}
		return count > _status.event.getRand("mayHaveShan" + hs + this.playerid);
	},
};
