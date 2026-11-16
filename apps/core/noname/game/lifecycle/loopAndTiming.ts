import { _status, lib } from "noname";
import { delay } from "@/util/index.js";
import { game } from "../index.js";
import type { Game } from "../index.js";

export const loopAndTimingMethods = {
	forceOver(this: Game, bool?: boolean | "noover", callback?: () => void) {
		_status.event.next.length = 0;
		const next = game.createEvent("finish_game");
		next.bool = bool;
		next.callback = callback;
		next.setContent("forceOver");
		if (_status.paused) {
			game.uncheck();
			game.resume();
		}
	},
	loop(this: Game, event = _status.event) {
		if (!event) {
			throw new Error("There is no _status.event when game.loop.");
		}
		return event.start();
	},
	pause(this: Game) {
		_status.paused = true;
		return _status.pauseManager.pause;
	},
	pause2(this: Game) {
		if (!_status.connectMode) {
			_status.paused2 = true;
		}
		return _status.pauseManager.pause2;
	},
	resume(this: Game) {
		if (!_status.paused) {
			return;
		}
		if (!_status.noclearcountdown) {
			game.stopCountChoose();
		}
		_status.paused = false;
		delete _status.waitingForTransition;
	},
	resume2(this: Game) {
		if (_status.connectMode) {
			return;
		}
		if (!_status.paused2) {
			return;
		}
		_status.paused2 = false;
	},
	delaye(this: Game, time = 1, time2 = 0) {
		const next = game.createEvent("delay", false);
		next.setContent("delay");
		next._args = [time, time2];
		return next;
	},
	delayex(this: Game, time = 1, time2 = 0) {
		const next = game.createEvent("delayx", false);
		next.setContent("delay");
		next._args = [time, time2];
		return next;
	},
	delay(this: Game, time = 1, time2 = 0) {
		time = time * lib.config.duration + time2;
		if (lib.config.game_speed == "vvfast") {
			time /= 3;
		}
		return _status.pauseManager.setDelay(delay(time));
	},
	delayx(this: Game, time = 1, time2 = 0) {
		switch (lib.config.game_speed) {
			case "vslow":
				time *= 2.5;
				break;
			case "slow":
				time *= 1.5;
				break;
			case "fast":
				time *= 0.7;
				break;
			case "vfast":
				time *= 0.4;
				break;
			case "vvfast":
				time *= 0.2;
				break;
		}
		return game.delay(time, time2);
	},
};
