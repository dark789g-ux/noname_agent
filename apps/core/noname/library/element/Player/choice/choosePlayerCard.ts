/* eslint-disable prefer-rest-params */
import { _status, game, get, lib } from "noname";
import type { Button, GameEvent, Player } from "../../index.js";
import "../contracts/choiceAndPhaseContract.js";
import type { EventChoosePlayerCardParams, EventDiscardPlayerCardParams, EventGainPlayerCardParams } from "../eventParams.js";

function createPlayerCardChoiceEvent(
	player: Player,
	eventName: "choosePlayerCard" | "discardPlayerCard" | "gainPlayerCard",
	rawArgs: IArguments
): GameEvent {
	const next: any = game.createEvent(eventName);
	next.player = player;

	const params = rawArgs[0];
	const args = [...rawArgs];
	if (args.length === 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
		Object.assign(next, params);
		if (typeof next.selectButton === "number") {
			next.selectButton = [next.selectButton, next.selectButton];
		}
		if (params.prompt != null) {
			delete next.prompt;
			get.evtprompt(next, params.prompt);
		}
	} else {
		for (const arg of args) {
			if (get.itemtype(arg) == "player") {
				next.target = arg;
			} else if (typeof arg == "number") {
				next.selectButton = [arg, arg];
			} else if (get.itemtype(arg) == "select") {
				next.selectButton = arg;
			} else if (typeof arg == "boolean") {
				if (!next.forced) {
					next.forced = arg;
				} else {
					next.complexSelect = arg;
				}
			} else if (get.itemtype(arg) == "position") {
				next.position = arg;
			} else if (arg == "visible") {
				next.visible = true;
			} else if (eventName === "gainPlayerCard" && arg == "visibleMove") {
				next.visibleMove = true;
			} else if (arg == "complexSelect") {
				// 为直接添加complexSelect提供支持喵
				next.complexSelect = true;
			} else if (arg == "allowChooseAll") {
				next.allowChooseAll = true;
			} else if (typeof arg == "function") {
				if (next.ai) {
					next.filterButton = arg;
				} else {
					next.ai = arg;
				}
			} else if (typeof arg == "object" && arg) {
				const filter = get.filter(arg);
				next.filterButton = function (button: Button) {
					return filter(button.link);
				};
			} else if (typeof arg == "string") {
				next.prompt = arg;
			}
		}
	}
	if (next.filterButton == undefined) {
		next.filterButton = lib.filter.all;
	}
	if (next.position == undefined) {
		next.position = "he";
	}
	if (next.selectButton == undefined) {
		next.selectButton = [1, 1];
	}
	if (next.ai == undefined) {
		next.ai = function (button: Button) {
			const val = get.buttonValue(button);
			const owner = get.owner(button.link as any);
			if (_status.event.player && owner && get.attitude(_status.event.player, owner) > 0) {
				return -val;
			}
			return val;
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
	next.setContent(eventName);
	next._args = args;
	if (eventName === "gainPlayerCard") {
		next.gaintag = [];
	}
	return next;
}

export const choosePlayerCardMethods = {
	choosePlayerCard(this: Player, params?: EventChoosePlayerCardParams): GameEvent {
		void params;
		return createPlayerCardChoiceEvent(this, "choosePlayerCard", arguments);
	},

	discardPlayerCard(this: Player, params?: EventDiscardPlayerCardParams): GameEvent {
		void params;
		return createPlayerCardChoiceEvent(this, "discardPlayerCard", arguments);
	},

	gainPlayerCard(this: Player, params?: EventGainPlayerCardParams): GameEvent {
		void params;
		return createPlayerCardChoiceEvent(this, "gainPlayerCard", arguments);
	},
};
