/* eslint-disable prefer-rest-params */
import { _status, game, get } from "noname";
import type { GameEvent } from "../../gameEvent.js";
import type { Player } from "../../player.js";
import "../contracts/choiceAndPhaseContract.js";
import type {
	EventChooseBoolParams,
	EventChooseControlListParams,
	EventChooseControlParams,
	EventChooseDrawRecoverParams,
	EventChooseNumbersParams,
	EventChooseSkillParams,
} from "../eventParams.js";

export const chooseControlAndNumbersMethods = {
	chooseSkill(this: Player, target: Player, params?: EventChooseSkillParams): GameEvent {
		const next: any = game.createEvent("chooseSkill");
		next.player = this;
		next.setContent("chooseSkill");
		next.target = target;

		const args = [...arguments].slice(1);
		if (args.length == 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
			Object.assign(next, params);
		} else {
			for (const arg of args) {
				if (typeof arg == "string") {
					next.prompt = arg;
				} else if (typeof arg == "function") {
					next.func = arg;
				}
			}
		}
		return next;
	},

	chooseControlList(this: Player, params?: EventChooseControlListParams): GameEvent {
		if (arguments.length === 1 && get.is.object(params) && params != null && get.itemtype(params) == null) {
			const controls = !params.forced ? ["cancel2"] : [];
			return this.chooseControl({
				controls,
				choiceList: params.list,
				ai: params.ai,
				prompt: params.prompt,
			});
		}

		let list: string[] = [];
		let prompt: string | undefined = undefined;
		let forced = false;
		let func: ((event: GameEvent, player: Player) => string | number) | undefined = undefined;
		const args = [...arguments];
		for (const arg of args) {
			if (typeof arg == "string") {
				if (!prompt) {
					prompt = arg;
				} else {
					list.push(arg);
				}
			} else if (Array.isArray(arg)) {
				list = arg;
			} else if (arg === true) {
				forced = true;
			} else if (typeof arg == "function") {
				func = arg;
			}
		}
		const controls = forced ? ["cancel2"] : [];
		return this.chooseControl({
			controls,
			choiceList: list,
			prompt,
			ai: func,
		});
	},

	chooseControl(this: Player, params?: EventChooseControlParams): GameEvent {
		const next: any = game.createEvent("chooseControl");
		next.controls = [];

		const args = [...arguments];
		if (args.length == 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
			Object.assign(next, params);
		} else {
			for (const arg of args) {
				if (typeof arg == "string") {
					if (arg == "dialogcontrol") {
						next.dialogcontrol = true;
					} else if (arg == "seperate") {
						next.seperate = true;
					} else {
						next.controls.push(arg);
					}
				} else if (Array.isArray(arg)) {
					next.controls = next.controls.concat(arg);
				} else if (typeof arg == "function") {
					next.ai = arg;
				} else if (typeof arg == "number") {
					next.choice = arg;
				} else if (get.itemtype(arg) == "dialog") {
					next.dialog = arg;
				}
			}
		}
		next.player = this;
		if (next.choice == undefined) {
			next.choice = 0;
		}
		next.setContent("chooseControl");
		next._args = args;
		next.forceDie = true;
		return next;
	},

	chooseBool(this: Player, params?: EventChooseBoolParams): GameEvent {
		const next: any = game.createEvent("chooseBool");

		const args = [...arguments];
		if (args.length === 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
			Object.assign(next, params);
			if (params.prompt != null) {
				delete next.prompt;
				get.evtprompt(next, params.prompt);
			}
		} else {
			for (const arg of args) {
				if (typeof arg == "boolean") {
					next.choice = arg;
				} else if (typeof arg == "function") {
					next.ai = arg;
				} else if (typeof arg == "string") {
					get.evtprompt(next, arg);
				} else if (get.itemtype(arg) == "dialog") {
					next.dialog = arg;
				}
			}
		}
		if (next.choice == undefined) {
			next.choice = true;
		}
		next.player = this;
		next.setContent("chooseBool");
		next._args = args;
		next.forceDie = true;
		return next;
	},

	chooseDrawRecover(this: Player, params?: EventChooseDrawRecoverParams): GameEvent {
		const next: any = game.createEvent("chooseDrawRecover", false);
		next.player = this;
		next.gaintag = [];

		const args = [...arguments];
		if (args.length == 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
			Object.assign(next, params);
		} else {
			for (const arg of args) {
				if (typeof arg == "number") {
					if (typeof next.num1 == "number") {
						next.num2 = arg;
					} else {
						next.num1 = arg;
					}
				} else if (typeof arg == "boolean") {
					next.forced = arg;
				} else if (typeof arg == "string") {
					next.prompt = arg;
				} else if (typeof arg == "function") {
					next.ai = arg;
				} else if (get.itemtype(arg) == "player") {
					next.target = arg;
				}
			}
		}
		if (typeof next.num1 != "number") {
			next.num1 = 1;
		}
		if (typeof next.num2 != "number") {
			next.num2 = 1;
		}
		if (next.target == undefined) {
			next.target = this;
		}
		next.setContent("chooseDrawRecover");
		return next;
	},

	chooseNumbers(this: Player, params?: EventChooseNumbersParams): GameEvent {
		const next: any = game.createEvent("chooseNumbers");
		next.player = this;
		next.list = [];

		const args = [...arguments];
		if (args.length === 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
			Object.assign(next, params);
			if (params.prompt != null) {
				delete next.prompt;
				get.evtprompt(next, params.prompt);
			}
		} else {
			for (const arg of args) {
				if (typeof arg == "string") {
					get.evtprompt(next, arg);
				} else if (typeof arg == "number") {
					next.optionSum = arg;
				} else if (typeof arg == "boolean") {
					next.forced = arg;
				} else if (typeof arg == "object" && Array.isArray(arg)) {
					next.list.push(...arg);
				} else if (typeof arg == "function") {
					if (!next.processAI) {
						next.processAI = arg;
					} else {
						next.filterSelect = arg;
					}
				}
			}
		}
		if (!next.list.length) {
			_status.event.next.remove(next);
			next.resolve();
		}
		if (!next.filterSelect) {
			if (next.optionSum) {
				next.filterSelect = (num: number, index: number, event: any) => num + event.numbers.reduce((sum: number, item: number) => sum + item, 0) - (event.numbers[index] || 0) <= event.optionSum;
			} else {
				next.filterSelect = () => true;
			}
		}
		if (!next.filterOk) {
			if (next.optionSum) {
				next.filterOk = (event: any) => event.numbers.reduce((sum: number, item: number) => sum + item, 0) <= event.optionSum;
			} else {
				next.filterOk = () => true;
			}
		}
		if (!next.forced) {
			next.forced = false;
		}
		next.setContent("chooseNumbers");
		next._args = args;
		return next;
	},
};
