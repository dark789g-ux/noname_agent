import "../../../../../noname.js";
import "../contracts/choiceAndPhaseContract.js";
import { game } from "../../../../game/index.js";
import { get } from "../../../../get/binding.js";
import { lib } from "../../../index.js";
import { _status } from "../../../../status/index.js";
const chooseActionMethods = {
  chooseToUse(params) {
    const next = game.createEvent("chooseToUse");
    next.player = this;
    const args = [...arguments];
    if (args.length === 1 && typeof params === "object" && params !== null && get.itemtype(params) == null) {
      Object.assign(next, params);
    } else {
      for (const arg of args) {
        if (typeof arg == "number" || get.itemtype(arg) == "select") {
          next.selectTarget = arg;
        } else if (typeof arg == "object" && arg || typeof arg == "function") {
          if (get.itemtype(arg) == "player" || next.filterCard) {
            next.filterTarget = arg;
          } else {
            next.filterCard = arg;
          }
        } else if (typeof arg == "boolean") {
          next.forced = arg;
        } else if (typeof arg == "string") {
          if (arg == "chooseonly") {
            next.chooseonly = true;
          } else {
            next.prompt = arg;
          }
        }
      }
    }
    if (typeof next.filterCard == "object") {
      next.filterCard = get.filter(next.filterCard);
    }
    if (typeof next.filterTarget == "object") {
      next.filterTarget = get.filter(next.filterTarget, 2);
    }
    if (next.filterCard == void 0) {
      next.filterCard = lib.filter.filterCard;
    }
    if (next.selectCard == void 0) {
      next.selectCard = [1, 1];
    }
    if (next.filterTarget == void 0) {
      next.filterTarget = lib.filter.filterTarget;
    }
    if (next.selectTarget == void 0) {
      next.selectTarget = lib.filter.selectTarget;
    }
    if (next.position == void 0) {
      next.position = "hs";
    }
    if (next.ai1 == void 0) {
      next.ai1 = get.cacheOrder;
    }
    if (next.ai2 == void 0) {
      next.ai2 = get.cacheEffectUse;
    }
    next.setContent("chooseToUse");
    next._args = args;
    return next;
  },
  chooseToRespond(params) {
    const next = game.createEvent("chooseToRespond");
    next.player = this;
    let filter;
    const args = [...arguments];
    if (args.length === 1 && typeof params === "object" && params !== null && get.itemtype(params) == null) {
      Object.assign(next, params);
      if (params.card != null) {
        Reflect.deleteProperty(next, "card");
        next.filterCard = get.filter(params.card);
        filter = params.card;
      }
      if (typeof next.selectCard === "number") {
        next.selectCard = [next.selectCard, next.selectCard];
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
          filter = arg;
        } else if (arg == "nosource") {
          next.nosource = true;
        } else if (typeof arg == "string") {
          next.prompt = arg;
        }
      }
    }
    if (next.filterCard == void 0) {
      next.filterCard = lib.filter.all;
    }
    if (next.selectCard == void 0) {
      next.selectCard = [1, 1];
    }
    if (next.source == void 0 && !next.nosource) {
      next.source = _status.event.player;
    }
    if (next.ai == void 0) {
      next.ai = get.unuseful2;
    }
    if (next.prompt != false && typeof next.prompt != "string") {
      let str = "请打出" + get.cnNumber(next.selectCard[0]) + "张";
      if (filter) {
        if (filter.name) {
          str += get.translation(filter.name);
        } else {
          str += "牌";
        }
      } else {
        str += "牌";
      }
      if (_status.event.getParent().name == "useCard") {
        const cardname = _status.event.name;
        if (lib.card[cardname] && lib.translate[cardname]) {
          str += "响应" + lib.translate[cardname];
        }
      }
      next.prompt = str;
    }
    next.position = "hs";
    if (next.ai2 == void 0) {
      next.ai2 = () => 1;
    }
    next.setContent("chooseToRespond");
    next._args = args;
    return next;
  },
  chooseToGive(params) {
    const next = game.createEvent("chooseToGive");
    next.player = this;
    const args = [...arguments];
    if (args.length == 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
      Object.assign(next, params);
      if (params.dialog) {
        next.prompt = false;
      } else if (params.prompt) {
        delete next.prompt;
        get.evtprompt(next, params.prompt);
      }
    } else {
      for (const arg of args) {
        if (get.itemtype(arg) == "player") {
          next.target = arg;
        } else if (typeof arg == "number") {
          next.selectCard = [arg, arg];
        } else if (get.itemtype(arg) == "select") {
          next.selectCard = arg;
        } else if (get.itemtype(arg) == "dialog") {
          next.dialog = arg;
          next.prompt = false;
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
        } else if (arg == "allowChooseAll") {
          next.allowChooseAll = true;
        } else if (typeof arg == "string") {
          get.evtprompt(next, arg);
        }
        if (arg === null) {
          console.log(args);
        }
      }
    }
    if (next.isMine() == false && next.dialog) {
      next.dialog.style.display = "none";
    }
    if (next.filterCard == void 0) {
      next.filterCard = lib.filter.all;
    }
    if (next.selectCard == void 0) {
      next.selectCard = [1, 1];
    }
    if (next.position == void 0) {
      next.position = "h";
    }
    if (next.ai == void 0) {
      next.ai = get.unuseful;
    }
    next.setContent("chooseToGive");
    next._args = args;
    next.gaintag = [];
    return next;
  },
  chooseToDiscard(params) {
    const next = game.createEvent("chooseToDiscard");
    next.player = this;
    const args = [...arguments];
    if (args.length == 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
      Object.assign(next, params);
      if (params.dialog) {
        next.prompt = false;
      } else if (params.prompt) {
        delete next.prompt;
        get.evtprompt(next, params.prompt);
      }
    } else {
      for (const arg of args) {
        if (typeof arg == "number") {
          next.selectCard = [arg, arg];
        } else if (get.itemtype(arg) == "select") {
          next.selectCard = arg;
        } else if (get.itemtype(arg) == "dialog") {
          next.dialog = arg;
          next.prompt = false;
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
        } else if (typeof arg == "string") {
          if (arg == "chooseonly") {
            next.chooseonly = true;
          } else if (arg == "allowChooseAll") {
            next.allowChooseAll = true;
          } else {
            get.evtprompt(next, arg);
          }
        }
        if (arg === null) {
          console.log(args);
        }
      }
    }
    if (next.isMine() == false && next.dialog) {
      next.dialog.style.display = "none";
    }
    if (next.filterCard == void 0) {
      next.filterCard = lib.filter.cardDiscardable;
    }
    if (next.selectCard == void 0) {
      next.selectCard = [1, 1];
    }
    if (next.ai == void 0) {
      next.ai = get.unuseful;
    }
    next.autochoose = function() {
      if (!this.forced) {
        return false;
      }
      if (typeof this.selectCard == "function") {
        return false;
      }
      if (this.complexCard || this.complexSelect || this.filterOk) {
        return false;
      }
      const cards = this.getPlayer().getCards(this.position);
      if (cards.some((card) => !this.filterCard(card, this.player, this))) {
        return false;
      }
      let num = cards.length;
      for (let i = 0; i < cards.length; i++) {
        if (!lib.filter.cardDiscardable(cards[i], this.getPlayer(), this)) {
          num--;
        }
      }
      return get.select(this.selectCard)[0] >= num;
    };
    next.setContent("chooseToDiscard");
    next._args = args;
    return next;
  }
};
export {
  chooseActionMethods
};
