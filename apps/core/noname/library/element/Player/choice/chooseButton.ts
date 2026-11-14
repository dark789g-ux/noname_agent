/* eslint-disable prefer-rest-params */
import { game, get, lib } from "noname";
import type { Button, Card, GameEvent, Player } from "../../index.js";
import "../contracts/choiceAndPhaseContract.js";
import type { EventChooseButtonParams, EventChooseCardButtonParams, EventChooseVCardButtonParams, EventDiscoverCardParams } from "../eventParams.js";
import type { BroadSelect } from "../type.js";

export const chooseButtonMethods = {
	discoverCard(this: Player, list?: string[] | string | ((card: string) => boolean) | null, params?: EventDiscoverCardParams): GameEvent {
		const next: any = game.createEvent("discoverCard");
		next.player = this;
		next.setContent("discoverCard");
		next.list = list || lib.inpile.slice(0);
		next.forced = true;

		const args = [...arguments].slice(1);
		if (args.length == 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
			Object.assign(next, params);
		} else {
			for (const arg of args) {
				if (typeof arg == "boolean") {
					next.forced = arg;
				} else if (typeof arg == "string") {
					switch (arg) {
						case "use":
							next.use = true;
							break;
						case "nogain":
							next.nogain = true;
							break;
						default:
							next.prompt = arg;
					}
				} else if (typeof arg == "number") {
					next.num = arg;
				} else if (typeof arg === "function") {
					next.ai = arg;
				}
			}
		}
		return next;
	},

	chooseCardButton(this: Player, params?: EventChooseCardButtonParams): GameEvent {
		let cards: Card[] | undefined;
		let prompt: string | undefined;
		let forced: boolean | undefined;
		let select: BroadSelect | (() => BroadSelect) | undefined;
		let filter: ((button: Button, player: Player) => boolean) | undefined;
		let ai: ((button: Button) => number) | undefined;

		const args = [...arguments];
		if (args.length == 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
			cards = params.cards;
			prompt = params.prompt;
			forced = params.forced;
			select = params.select;
			filter = params.filter;
			ai = params.ai;
		} else {
			for (const arg of args) {
				if (get.itemtype(arg) == "cards") {
					cards = arg;
				} else if (typeof arg == "boolean") {
					forced = arg;
				} else if (typeof arg == "string") {
					prompt = arg;
				} else if (get.itemtype(arg) == "select" || typeof arg == "number") {
					select = arg;
				} else if (typeof arg == "function") {
					if (ai) {
						filter = arg;
					} else {
						ai = arg;
					}
				}
			}
		}
		if (prompt == undefined) {
			prompt = "请选择卡牌";
		}
		return this.chooseButton({
			forced,
			selectButton: select,
			createDialog: [prompt, cards, "hidden"],
			filterButton: filter,
			ai,
		});
	},

	chooseVCardButton(this: Player, params?: EventChooseVCardButtonParams): GameEvent {
		let rawList: string[] | undefined;
		let prompt: string | undefined;
		let forced: boolean | undefined;
		let select: BroadSelect | (() => BroadSelect) | undefined;
		let notype = false;
		let filter: ((button: Button, player: Player) => boolean) | undefined;
		let ai: ((button: Button) => number) | undefined;

		const args = [...arguments];
		if (args.length == 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
			rawList = params.list;
			prompt = params.prompt;
			forced = params.forced;
			select = params.select;
			notype = params.notype ?? false;
			filter = params.filter;
			ai = params.ai;
		} else {
			for (const arg of args) {
				if (Array.isArray(arg)) {
					rawList = arg;
				} else if (arg == "notype") {
					notype = true;
				} else if (typeof arg == "boolean") {
					forced = arg;
				} else if (typeof arg == "string") {
					prompt = arg;
				} else if (get.itemtype(arg) == "select" || typeof arg == "number") {
					select = arg;
				} else if (typeof arg == "function") {
					if (ai) {
						filter = arg;
					} else {
						ai = arg;
					}
				}
			}
		}
		const list = rawList?.map(item => {
			if (notype) {
				return ["", "", item];
			}
			return [get.subtype(item, false) || get.type(item), "", item];
		});
		if (prompt == undefined) {
			prompt = "请选择卡牌";
		}
		return this.chooseButton({
			forced,
			selectButton: select,
			createDialog: [prompt, [list, "vcard"], "hidden"],
			filterButton: filter,
			ai,
		});
	},

	chooseButton(this: Player, params?: EventChooseButtonParams): GameEvent {
		const next: any = game.createEvent("chooseButton");

		const args = [...arguments];
		if (args.length == 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
			Object.assign(next, params);
			if (typeof next.selectButton === "number") {
				next.selectButton = [next.selectButton, next.selectButton];
			}
			if (params.dialog != null) {
				next.closeDialog = true;
			}
		} else {
			for (const arg of args) {
				if (typeof arg == "boolean") {
					if (!next.forced) {
						next.forced = arg;
					} else {
						next.complexSelect = arg;
					}
				} else if (get.itemtype(arg) == "dialog") {
					next.dialog = arg;
					next.closeDialog = true;
				} else if (get.itemtype(arg) == "select") {
					next.selectButton = arg;
				} else if (typeof arg == "number") {
					next.selectButton = [arg, arg];
				} else if (typeof arg == "function") {
					if (next.ai) {
						next.filterButton = arg;
					} else {
						next.ai = arg;
					}
				} else if (arg == "complexSelect") {
					// 为直接添加complexSelect提供支持喵
					next.complexSelect = true;
				} else if (arg == "allowChooseAll") {
					next.allowChooseAll = true;
				} else if (arg == "direct") {
					next.direct = true;
				} else if (Array.isArray(arg)) {
					next.createDialog = arg;
				}
			}
		}
		next.player = this;
		if (typeof next.forced != "boolean") {
			next.forced = false;
		}
		if (next.isMine() == false && next.dialog) {
			next.dialog.style.display = "none";
		}
		if (next.filterButton == undefined) {
			next.filterButton = lib.filter.filterButton;
		}
		if (next.selectButton == undefined) {
			next.selectButton = [1, 1];
		}
		if (next.ai == undefined) {
			next.ai = function () {
				return 1;
			};
		}
		if (next.complexSelect !== false) {
			if (next.complexSelect === undefined && next.allowChooseAll === true) {
				// 如果complexSelect没有被显式的定义但是全选被显式要求了，那么我们默认认为调用者需要全选而不是complexSelect喵
				next.complexSelect = false;
			} else {
				next.complexSelect = true;
			}
		}
		next.setContent("chooseButton");
		next._args = args;
		next.forceDie = true;
		return next;
	},

	chooseButtonOL(this: Player, list: any[], callback?: (...args: any[]) => any, ai?: (button: Button) => number): GameEvent {
		const next: any = game.createEvent("chooseButtonOL");
		next.list = list;
		next.setContent("chooseButtonOL");
		next.ai = ai;
		next.callback = callback;
		next._args = [...arguments];
		return next;
	},
};
