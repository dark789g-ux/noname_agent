import "../../../../../noname.js";
import "../contracts/choiceAndPhaseContract.js";
import { game } from "../../../../game/index.js";
import { get } from "../../../../get/binding.js";
import { lib } from "../../../index.js";
const chooseButtonMethods = {
  discoverCard(list, params) {
    const next = game.createEvent("discoverCard");
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
  chooseCardButton(params) {
    let cards;
    let prompt;
    let forced;
    let select;
    let filter;
    let ai;
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
    if (prompt == void 0) {
      prompt = "请选择卡牌";
    }
    return this.chooseButton({
      forced,
      selectButton: select,
      createDialog: [prompt, cards, "hidden"],
      filterButton: filter,
      ai
    });
  },
  chooseVCardButton(params) {
    let rawList;
    let prompt;
    let forced;
    let select;
    let notype = false;
    let filter;
    let ai;
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
    const list = rawList?.map((item) => {
      if (notype) {
        return ["", "", item];
      }
      return [get.subtype(item, false) || get.type(item), "", item];
    });
    if (prompt == void 0) {
      prompt = "请选择卡牌";
    }
    return this.chooseButton({
      forced,
      selectButton: select,
      createDialog: [prompt, [list, "vcard"], "hidden"],
      filterButton: filter,
      ai
    });
  },
  chooseButton(params) {
    const next = game.createEvent("chooseButton");
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
    if (next.filterButton == void 0) {
      next.filterButton = lib.filter.filterButton;
    }
    if (next.selectButton == void 0) {
      next.selectButton = [1, 1];
    }
    if (next.ai == void 0) {
      next.ai = function() {
        return 1;
      };
    }
    if (next.complexSelect !== false) {
      if (next.complexSelect === void 0 && next.allowChooseAll === true) {
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
  chooseButtonOL(list, callback, ai) {
    const next = game.createEvent("chooseButtonOL");
    next.list = list;
    next.setContent("chooseButtonOL");
    next.ai = ai;
    next.callback = callback;
    next._args = [...arguments];
    return next;
  }
};
export {
  chooseButtonMethods
};
