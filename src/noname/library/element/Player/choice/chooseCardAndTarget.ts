/* eslint-disable prefer-rest-params */
import { game, get, lib } from "noname";
import type { GameEvent } from "../../gameEvent.js";
import type { Player } from "../../player.js";
import "../contracts/choiceAndPhaseContract.js";
import type {
	EventChooseButtonTargetParams,
	EventChooseCardOLParams,
	EventChooseCardParams,
	EventChooseCardTargetParams,
	EventChooseTargetParams,
	EventChooseUseTargetParams,
} from "../eventParams.js";

export const chooseCardAndTargetMethods = {
	chooseCardOL(this: Player, params?: EventChooseCardOLParams): GameEvent {
		const next: any = game.createEvent("chooseCardOL");
		next._args = [];

		const args = [...arguments];
		if (args.length == 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
			next.list = params.list;
			if (params.args) {
				next._args = params.args;
				next._args.add("glow_result");
			} else {
				const { list, ...newArgs } = params;
				if (newArgs.glow_result == null) {
					newArgs.glow_result = true;
				}
				next._args = [newArgs];
			}
		} else {
			for (const arg of args) {
				if (get.itemtype(arg) == "players") {
					next.list = arg.slice(0);
				} else {
					next._args.push(arg);
				}
			}
			next._args.add("glow_result");
		}
		next.setContent("chooseCardOL");
		return next;
	},

	chooseCard(this: Player, params?: EventChooseCardParams): GameEvent {
		const next: any = game.createEvent("chooseCard");
		next.player = this;

		const args = [...arguments];
		if (args.length == 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
			Object.assign(next, params);
			if (typeof next.selectCard === "number") {
				next.selectCard = [next.selectCard, next.selectCard];
			}
			if (params.prompt != null) {
				delete next.prompt;
				get.evtprompt(next, params.prompt);
			}
		} else {
			for (const arg of args) {
				if (typeof arg == "number") {
					next.selectCard = [arg, arg];
				} else if (get.itemtype(arg) == "select") {
					next.selectCard = arg;
				} else if (typeof arg == "boolean") {
					next.forced = arg;
				} else if (get.itemtype(arg) == "position") {
					next.position = arg;
				} else if (typeof arg == "function") {
					if (next.filterCard) {
						next.ai = arg;
					} else {
						next.filterCard = arg;
					}
				} else if (typeof arg == "object" && arg) {
					next.filterCard = get.filter(arg);
				} else if (arg == "glow_result") {
					next.glow_result = true;
				} else if (arg == "allowChooseAll") {
					next.allowChooseAll = true;
				} else if (typeof arg == "string") {
					get.evtprompt(next, arg);
				}
			}
		}
		if (next.filterCard == undefined) {
			next.filterCard = lib.filter.all;
		}
		if (next.selectCard == undefined) {
			next.selectCard = [1, 1];
		}
		if (next.ai == undefined) {
			next.ai = get.unuseful3;
		}
		next.autochoose = function () {
			if (!this.forced) {
				return false;
			}
			if (typeof this.selectCard == "function") {
				return false;
			}
			if (this.complexCard || this.complexSelect || this.filterOk) {
				return false;
			}
			if (this.type === "compare") {
				return false;
			}
			const cards = this.getPlayer().getCards(this.position);
			if (cards.some(card => !this.filterCard(card, this.player, this))) {
				return false;
			}
			return get.select(this.selectCard)[0] >= this.getPlayer().countCards(this.position);
		};
		next.setContent("chooseCard");
		next._args = args;
		return next;
	},

	chooseUseTarget(this: Player, params?: EventChooseUseTargetParams): GameEvent {
		const next: any = game.createEvent("chooseUseTarget");
		next.player = this;

		const args = [...arguments];
		if (args.length === 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
			Object.assign(next, params);
			if (typeof next.selectTarget === "number") {
				next.selectTarget = [next.selectTarget, next.selectTarget];
			}

			if (params.prompt != null) {
				delete next.prompt;
				get.evtprompt(next, params.prompt);
			}
		} else {
			for (const arg of args) {
				if (get.itemtype(arg) == "cards") {
					next.cards = arg.slice(0);
				} else if (get.itemtype(arg) == "card") {
					next.card = arg;
				} else if (get.itemtype(arg) == "players") {
					next.targets = arg;
				} else if (get.itemtype(arg) == "player") {
					next.targets = [arg];
				} else if (get.itemtype(arg) == "select") {
					next.selectTarget = arg;
				} else if (typeof arg == "number") {
					next.selectTarget = [arg, arg];
				} else if (get.is.object(arg) && arg.name) {
					next.card = arg;
				} else if (typeof arg == "string") {
					if (arg == "nopopup") {
						next.nopopup = true;
					} else if (arg == "noanimate") {
						next.animate = false;
					} else if (arg == "nothrow") {
						next.throw = false;
					} else if (arg == "nodistance") {
						next.nodistance = true;
					} else if (arg == "noTargetDelay") {
						next.noTargetDelay = true;
					} else if (arg == "nodelayx") {
						next.nodelayx = true;
					} else if (lib.card[arg] && !next.card) {
						next.card = { name: arg, isCard: true };
					} else {
						get.evtprompt(next, arg);
					}
				} else if (arg === true) {
					next.forced = true;
				} else if (arg === false) {
					next.addCount = false;
				}
			}
		}
		if (!next.targets) {
			next.targets = game.players.slice(0);
		}
		if (next.cards == undefined) {
			if (get.itemtype(next.card) == "card") {
				next.cards = [next.card];
			} else {
				next.cards = [];
			}
		} else if (next.card == undefined) {
			if (next.cards) {
				next.card = next.cards[0];
			}
		}
		if (next.card && get.info(next.card)?.deadTarget) {
			next.targets.addArray(game.dead);
		}
		next.setContent("chooseUseTarget");
		next._args = args;
		return next;
	},

	chooseTarget(this: Player, params?: EventChooseTargetParams): GameEvent {
		const next: any = game.createEvent("chooseTarget");
		next.player = this;

		const args = [...arguments];
		if (args.length === 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
			Object.assign(next, params);
			if (params.dialog != null) {
				next.prompt = false;
			}
			if (params.selectTarget != null && typeof params.selectTarget == "number") {
				next.selectTarget = [params.selectTarget, params.selectTarget];
			}
			if (params.prompt != null) {
				delete next.prompt;
				get.evtprompt(next, params.prompt);
			}
		} else {
			for (const arg of args) {
				if (typeof arg == "number") {
					next.selectTarget = [arg, arg];
				} else if (get.itemtype(arg) == "select") {
					next.selectTarget = arg;
				} else if (get.itemtype(arg) == "dialog") {
					next.dialog = arg;
					next.prompt = false;
				} else if (typeof arg == "boolean") {
					next.forced = arg;
				} else if (typeof arg == "function") {
					if (next.filterTarget) {
						next.ai = arg;
					} else {
						next.filterTarget = arg;
					}
				} else if (typeof arg == "string") {
					get.evtprompt(next, arg);
				}
			}
		}
		if (next.filterTarget == undefined) {
			next.filterTarget = lib.filter.all;
		}
		if (next.selectTarget == undefined) {
			next.selectTarget = [1, 1];
		}
		if (next.ai == undefined) {
			next.ai = get.attitude2;
		}
		next.setContent("chooseTarget");
		next._args = Array.from(arguments);
		next.forceDie = true;
		return next;
	},

	chooseCardTarget(this: Player, params?: EventChooseCardTargetParams): GameEvent {
		const next: any = game.createEvent("chooseCardTarget");
		next.player = this;

		Object.assign(next, params);
		if (typeof next.filterCard == "object") {
			next.filterCard = get.filter(next.filterCard);
		}
		if (typeof next.filterTarget == "object") {
			next.filterTarget = get.filter(next.filterTarget, 2);
		}
		if (next.filterCard == undefined || next.filterCard === true) {
			next.filterCard = lib.filter.all;
		}
		if (next.selectCard == undefined) {
			next.selectCard = 1;
		}
		if (next.filterTarget == undefined || next.filterTarget === true) {
			next.filterTarget = lib.filter.all;
		}
		if (next.selectTarget == undefined) {
			next.selectTarget = 1;
		}
		if (next.ai1 == undefined) {
			next.ai1 = get.unuseful2;
		}
		if (next.ai2 == undefined) {
			next.ai2 = get.attitude2;
		}
		next.setContent("chooseCardTarget");
		next._args = [...arguments];
		return next;
	},

	chooseButtonTarget(this: Player, params?: EventChooseButtonTargetParams): GameEvent {
		const next: any = game.createEvent("chooseButtonTarget");
		next.player = this;
		Object.assign(next, params);
		if (typeof next.filterButton == "object") {
			next.filterButton = get.filter(next.filterButton);
		}
		if (typeof next.filterTarget == "object") {
			next.filterTarget = get.filter(next.filterTarget, 2);
		}
		if (next.filterButton == undefined || next.filterButton === true) {
			next.filterButton = lib.filter.filterButton;
		}
		if (next.selectButton == undefined) {
			next.selectButton = 1;
		}
		if (next.filterTarget == undefined || next.filterTarget === true) {
			next.filterTarget = lib.filter.all;
		}
		if (next.selectTarget == undefined) {
			next.selectTarget = 1;
		}
		if (next.ai1 == undefined) {
			next.ai1 = function () {
				return 1;
			};
		}
		if (next.ai2 == undefined) {
			next.ai2 = get.attitude2;
		}
		if (next.canHidden == undefined) {
			next.canHidden = true;
		}
		next.setContent("chooseButtonTarget");
		next._args = Array.from(arguments);
		return next;
	},
};
