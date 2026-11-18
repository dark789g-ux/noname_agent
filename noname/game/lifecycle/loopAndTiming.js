import "../../../noname.js";
import { delay } from "../../util/index.js";
import { game } from "../index.js";
import { lib } from "../../library/index.js";
import { _status } from "../../status/index.js";
const loopAndTimingMethods = {
  forceOver(bool, callback) {
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
  loop(event = _status.event) {
    if (!event) {
      throw new Error("There is no _status.event when game.loop.");
    }
    return event.start();
  },
  pause() {
    _status.paused = true;
    return _status.pauseManager.pause;
  },
  pause2() {
    if (!_status.connectMode) {
      _status.paused2 = true;
    }
    return _status.pauseManager.pause2;
  },
  resume() {
    if (!_status.paused) {
      return;
    }
    if (!_status.noclearcountdown) {
      game.stopCountChoose();
    }
    _status.paused = false;
    delete _status.waitingForTransition;
  },
  resume2() {
    if (_status.connectMode) {
      return;
    }
    if (!_status.paused2) {
      return;
    }
    _status.paused2 = false;
  },
  delaye(time = 1, time2 = 0) {
    const next = game.createEvent("delay", false);
    next.setContent("delay");
    next._args = [time, time2];
    return next;
  },
  delayex(time = 1, time2 = 0) {
    const next = game.createEvent("delayx", false);
    next.setContent("delay");
    next._args = [time, time2];
    return next;
  },
  delay(time = 1, time2 = 0) {
    time = time * lib.config.duration + time2;
    if (lib.config.game_speed == "vvfast") {
      time /= 3;
    }
    return _status.pauseManager.setDelay(delay(time));
  },
  delayx(time = 1, time2 = 0) {
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
  }
};
export {
  loopAndTimingMethods
};
