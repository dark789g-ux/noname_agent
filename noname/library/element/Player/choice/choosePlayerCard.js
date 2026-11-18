import "../../../../../noname.js";
import "../contracts/choiceAndPhaseContract.js";
import { game } from "../../../../game/index.js";
import { get } from "../../../../get/binding.js";
import { lib } from "../../../index.js";
import { _status } from "../../../../status/index.js";
function createPlayerCardChoiceEvent(player, eventName, rawArgs) {
  const next = game.createEvent(eventName);
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
        next.filterButton = function(button) {
          return filter(button.link);
        };
      } else if (typeof arg == "string") {
        next.prompt = arg;
      }
    }
  }
  if (next.filterButton == void 0) {
    next.filterButton = lib.filter.all;
  }
  if (next.position == void 0) {
    next.position = "he";
  }
  if (next.selectButton == void 0) {
    next.selectButton = [1, 1];
  }
  if (next.ai == void 0) {
    next.ai = function(button) {
      const val = get.buttonValue(button);
      const owner = get.owner(button.link);
      if (_status.event.player && owner && get.attitude(_status.event.player, owner) > 0) {
        return -val;
      }
      return val;
    };
  }
  if (next.complexSelect !== false) {
    if (next.complexSelect === void 0 && next.allowChooseAll === true) {
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
const choosePlayerCardMethods = {
  choosePlayerCard(params) {
    void params;
    return createPlayerCardChoiceEvent(this, "choosePlayerCard", arguments);
  },
  discardPlayerCard(params) {
    void params;
    return createPlayerCardChoiceEvent(this, "discardPlayerCard", arguments);
  },
  gainPlayerCard(params) {
    void params;
    return createPlayerCardChoiceEvent(this, "gainPlayerCard", arguments);
  }
};
export {
  choosePlayerCardMethods
};
