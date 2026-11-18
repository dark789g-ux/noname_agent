import "../../../../../noname.js";
import "../contracts/choiceAndPhaseContract.js";
import { game } from "../../../../game/index.js";
import { get } from "../../../../get/binding.js";
import { _status } from "../../../../status/index.js";
const chooseControlAndNumbersMethods = {
  chooseSkill(target, params) {
    const next = game.createEvent("chooseSkill");
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
  chooseControlList(params) {
    if (arguments.length === 1 && get.is.object(params) && params != null && get.itemtype(params) == null) {
      const controls2 = !params.forced ? ["cancel2"] : [];
      return this.chooseControl({
        controls: controls2,
        choiceList: params.list,
        ai: params.ai,
        prompt: params.prompt
      });
    }
    let list = [];
    let prompt = void 0;
    let forced = false;
    let func = void 0;
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
      ai: func
    });
  },
  chooseControl(params) {
    const next = game.createEvent("chooseControl");
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
    if (next.choice == void 0) {
      next.choice = 0;
    }
    next.setContent("chooseControl");
    next._args = args;
    next.forceDie = true;
    return next;
  },
  chooseBool(params) {
    const next = game.createEvent("chooseBool");
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
    if (next.choice == void 0) {
      next.choice = true;
    }
    next.player = this;
    next.setContent("chooseBool");
    next._args = args;
    next.forceDie = true;
    return next;
  },
  chooseDrawRecover(params) {
    const next = game.createEvent("chooseDrawRecover", false);
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
    if (next.target == void 0) {
      next.target = this;
    }
    next.setContent("chooseDrawRecover");
    return next;
  },
  chooseNumbers(params) {
    const next = game.createEvent("chooseNumbers");
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
        next.filterSelect = (num, index, event) => num + event.numbers.reduce((sum, item) => sum + item, 0) - (event.numbers[index] || 0) <= event.optionSum;
      } else {
        next.filterSelect = () => true;
      }
    }
    if (!next.filterOk) {
      if (next.optionSum) {
        next.filterOk = (event) => event.numbers.reduce((sum, item) => sum + item, 0) <= event.optionSum;
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
  }
};
export {
  chooseControlAndNumbersMethods
};
