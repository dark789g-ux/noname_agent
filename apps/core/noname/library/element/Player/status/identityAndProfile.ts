import { _status, game, get, lib } from "noname";
import type { GameEvent, Player } from "../../index.js";
import "../contracts/statusContract.js";

type ChangeGroupEvent = GameEvent & {
	group?: string;
	log?: boolean;
	broadcast?: boolean;
};

export const identityAndProfileMethods = {
	getName(this: Player, forDialog = false): string {
		const { name } = this;
		let playername: string;
		let hasTempTranslate = false;
		if (this._tempTranslate) {
			playername = this._tempTranslate;
			hasTempTranslate = true;
		} else {
			const abbreviation = lib.translate[`${name}_ab`];
			playername = abbreviation || get.translation(name);
		}
		if (!forDialog) {
			return playername;
		}
		const SeatNum = this.getSeatNum();
		const addSeat = game.hasPlayer2(current => current != this && current.getName() == playername, true) && typeof SeatNum == "number";
		const border = get.groupnature(get.bordergroup(name as string));
		return `<span style="font-weight:560"><span data-nature=${border}><span style="letter-spacing:0.1em">${!hasTempTranslate ? get.slimName(name as string) : playername}${addSeat ? `[${SeatNum}]` : ""}</span></span><br/><span style="color:#FFD700">`;
	},
	getClans(this: Player, unseen?: boolean): string[] {
		const clans: string[] = [];
		if (unseen || !this.isUnseen(0)) {
			const info = lib.character[String(this.name1)] as { clans?: string[] } | undefined;
			if (info && info.clans) {
				clans.addArray(info.clans);
			}
		}
		if (this.name2 && (unseen || !this.isUnseen(1))) {
			const info = lib.character[this.name2] as { clans?: string[] } | undefined;
			if (info && info.clans) {
				clans.addArray(info.clans);
			}
		}
		return clans;
	},
	hasClan(this: Player, clan: string, unseen?: boolean): boolean {
		return this.getClans(unseen).includes(clan);
	},
	hasSex(this: Player, sex: string): boolean {
		if (this.sex == "unknown") {
			return false;
		}
		if (this.sex == "double") {
			return true;
		}
		return this.sex == sex;
	},
	sameSexAs(this: Player, target: Player): boolean {
		const sex1 = this.sex;
		const sex2 = target.sex;
		if (sex1 == "unknown" || sex2 == "unknown") {
			return false;
		}
		if (sex1 == "double" || sex2 == "double") {
			return true;
		}
		return sex1 == sex2;
	},
	differentSexFrom(this: Player, target: Player): boolean {
		const sex1 = this.sex;
		const sex2 = target.sex;
		if (sex1 == "unknown" || sex2 == "unknown") {
			return false;
		}
		if (sex1 == "double" || sex2 == "double") {
			return true;
		}
		return sex1 != sex2;
	},
	changeGroup(this: Player, group: string, log?: boolean, broadcast?: "nobroadcast" | boolean): GameEvent {
		const next: ChangeGroupEvent = game.createEvent("changeGroup");
		next.player = this;
		next.group = group;
		next.log = typeof log === "boolean" ? log : true;
		next.broadcast = broadcast !== "nobroadcast";
		next.setContent("changeGroup");
		return next;
	},
	setIdentity(this: Player, identity?: string, nature?: string): Player {
		if (!identity) {
			identity = this.identity;
		}
		const firstChild = this.node.identity.firstChild as HTMLElement;
		if (get.is.jun(this)) {
			firstChild.innerHTML = "君";
		} else {
			firstChild.innerHTML = get.translation(identity);
		}
		this.node.identity.dataset.color = nature || identity;
		return this;
	},
	isZhu2(this: Player): boolean {
		const mode = get.mode();
		if (!this.isZhu) {
			return false;
		}
		if (mode == "identity") {
			if (_status.mode == "stratagem" && !this.identityShown) {
				return false;
			}
			return true;
		}
		if (mode == "versus" && (_status.mode == "four" || _status.mode == "guandu")) {
			return true;
		}
		return false;
	},
	isInitFilter(this: Player, tag: string): boolean {
		const player = this;
		for (const name of [player.name, player.name1, player.name2]) {
			if (name && lib.character[name]) {
				const charInfo = lib.character[name] as { initFilters: string[] };
				const filter = charInfo.initFilters;
				if (!filter.includes(tag)) {
					continue;
				}
				if (lib.characterInitFilter[name] && lib.characterInitFilter[name](tag) === false) {
					continue;
				}
				return true;
			}
		}
		return false;
	},
};
