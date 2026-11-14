import { game, lib, ui } from "noname";
import type { GameEvent, Player } from "../../index.js";
import type { RestEndMap, RestMap } from "../contracts/statusContract.js";
import "../contracts/statusContract.js";

type DyingEvent = GameEvent & {
	reason?: GameEvent;
	nodying?: boolean;
};

type DieEvent = GameEvent & {
	reason?: GameEvent | "nosource";
	excludeMark?: string[];
};

type RestEvent = GameEvent & {
	restMap?: RestMap;
};

type RestEndEvent = GameEvent & {
	restEndMap?: RestEndMap;
};

type ReviveGameEvent = GameEvent & {
	hp?: number;
	log?: boolean;
};

export const survivalAndBuffMethods = {
	getBuff(this: Player, ...args: (number | boolean)[]): Player {
		const list = [1, 2, 3, 4, 5, 6];
		let nodelay = false;
		for (const arg of args) {
			if (typeof arg == "number") {
				list.remove(arg);
			} else if (arg === false) {
				nodelay = true;
			}
		}
		if (this.isHealthy()) {
			list.remove(2);
		}
		if (!this.countCards("j")) {
			list.remove(5);
		}
		if (!this.isLinked() && !this.isTurnedOver()) {
			list.remove(6);
		}
		if (this.hasSkill("qianxing")) {
			list.remove(4);
		}
		switch (list.randomGet()) {
			case 1:
				this.draw({ num: 1, nodelay });
				break;
			case 2:
				this.recover();
				break;
			case 3:
				this.changeHujia();
				break;
			case 4:
				this.tempHide();
				break;
			case 5:
				this.discard({ cards: this.getCards("j") }).delay = !nodelay;
				break;
			case 6: {
				if (this.isLinked()) {
					this.link();
				}
				if (this.isTurnedOver()) {
					this.turnOver();
				}
				break;
			}
		}
		return this;
	},
	getDebuff(this: Player, ...args: (number | boolean)[]): Player {
		const list = [1, 2, 3, 4, 5, 6];
		let nodelay = false;
		for (const arg of args) {
			if (typeof arg == "number") {
				list.remove(arg);
			} else if (arg === false) {
				nodelay = true;
			}
		}
		if (this.countCards("he") == 0) {
			list.remove(1);
		}
		if (this.isLinked()) {
			list.remove(4);
		}
		if (this.hasSkill("fengyin")) {
			list.remove(5);
		}
		if (this.hp == 1) {
			list.remove(3);
			if (list.length > 1) {
				list.remove(2);
			}
		}
		if (!list.length) {
			return this;
		}
		list.randomGet();
		switch (list.randomGet()) {
			case 1:
				this.randomDiscard({ position: "he", log: nodelay ? false : "popup" });
				break;
			case 2:
				this.loseHp();
				break;
			case 3:
				this.damage();
				break;
			case 4:
				if (!this.isLinked()) {
					this.link();
				}
				break;
			case 5:
				this.addTempSkill("fengyin", { player: "phaseAfter" });
				break;
			case 6: {
				const delayCards: string[] = [];
				for (let i = 0; i < lib.inpile.length; i++) {
					const info = lib.card[lib.inpile[i]];
					if (info.type == "delay" && !info.cancel && !this.hasJudge(lib.inpile[i])) {
						delayCards.push(lib.inpile[i]);
					}
				}
				if (delayCards.length) {
					const card = game.createCard(delayCards.randomGet());
					this.addJudge(card);
					this.$draw(card);
					if (!nodelay) {
						game.delay();
					}
				} else {
					this.getDebuff(6);
				}
				break;
			}
		}
		return this;
	},
	dying(this: Player, reason?: GameEvent): GameEvent | undefined {
		if (this.nodying || Number(this.hp) > 0 || this.isDying()) {
			return;
		}
		const next: DyingEvent = game.createEvent("dying");
		next.player = this;
		next.reason = reason;
		if (reason && reason.source) {
			next.source = reason.source;
		}
		next.setContent("dying");
		next.filterStop = function () {
			// @ts-expect-error nodying is a dynamic flag on dying events
			if (Number(this.getPlayer().hp) > 0 || this.nodying) {
				delete this.filterStop;
				return true;
			}
		};
		return next;
	},
	die(this: Player, reason?: GameEvent | "nosource"): GameEvent {
		const next: DieEvent = game.createEvent("die");
		next.player = this;
		next.reason = reason;
		if (reason) {
			next.source = reason === "nosource" ? undefined : reason.source;
		}
		next.excludeMark = [];
		next.setContent("die");
		return next;
	},
	rest(this: Player, restMap: RestMap = { type: "phase", count: -1 }): GameEvent {
		const next: RestEvent = game.createEvent("rest", false);
		next.player = this;
		next.restMap = restMap;
		next.forceDie = true;
		next.includeOut = true;
		next.setContent("rest");
		return next;
	},
	restEnd(this: Player, restEndMap: RestEndMap = { hp: null }): GameEvent {
		const next: RestEndEvent = game.createEvent("restEnd", false);
		restEndMap.hp ??= this.maxHp;
		next.player = this;
		next.restEndMap = restEndMap;
		next.forceDie = true;
		next.includeOut = true;
		next.setContent("restEnd");
		return next;
	},
	revive(this: Player, hp?: number, log?: boolean): void {
		if (log !== false) {
			game.log(this, "复活");
		}
		this.maxHp = Math.max(1, Number(this.maxHp));
		this.hp = hp || 1;
		game.addVideo("revive", this);
		this.classList.remove("dead");
		this.removeAttribute("style");
		this.node.avatar.style.transform = "";
		this.node.avatar2.style.transform = "";
		this.node.hp.show();
		this.node.equips.show();
		this.node.count.show();
		this.update();
		let player = this.previousSeat;
		while (player.isDead()) {
			player = player.previousSeat;
		}
		player.next = this;
		this.previous = player;
		player = this.nextSeat;
		while (player.isDead()) {
			player = player.nextSeat;
		}
		player.previous = this;
		this.next = player;
		game.players.add(this);
		game.dead.remove(this);
		if (this == game.me) {
			if (ui.auto) {
				ui.auto.show();
			}
			if (ui.wuxie) {
				ui.wuxie.show();
			}
			if (ui.revive) {
				ui.revive.close();
				delete ui.revive;
			}
			if (ui.exit) {
				ui.exit.close();
				delete ui.exit;
			}
			if (ui.swap) {
				ui.swap.close();
				delete ui.swap;
			}
			if (ui.restart) {
				ui.restart.close();
				delete ui.restart;
			}
			if (ui.continue_game) {
				ui.continue_game.close();
				delete ui.continue_game;
			}
			if (this.node.dieidentity) {
				this.node.dieidentity.delete();
				delete this.node.dieidentity;
			}
		}
	},
	reviveEvent(this: Player, hp?: number, log?: boolean): GameEvent {
		const next: ReviveGameEvent = game.createEvent("revive");
		next.player = this;
		if (hp) {
			next.hp = hp;
		} else {
			next.hp = 1;
		}
		next.log = log;
		next.forceDie = true;
		next.setContent("revive");
		return next;
	},
};
