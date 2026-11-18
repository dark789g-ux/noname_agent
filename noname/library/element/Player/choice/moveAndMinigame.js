import "../../../../../noname.js";
import "../contracts/choiceAndPhaseContract.js";
import { game } from "../../../../game/index.js";
import { get } from "../../../../get/binding.js";
import { lib } from "../../../index.js";
const DEFAULT_MOVE_FILTER_SYMBOL = /* @__PURE__ */ Symbol.for("noname.defaultMoveFilter");
function createDefaultMoveFilter() {
  const fn = function() {
    return true;
  };
  fn[DEFAULT_MOVE_FILTER_SYMBOL] = true;
  return fn;
}
const moveAndMinigameMethods = {
  chooseToPlayBeatmap(beatmap) {
    const next = game.createEvent("chooseToPlayBeatmap");
    next.player = this;
    next.beatmap = beatmap;
    next._args = [...arguments];
    next.setContent("chooseToPlayBeatmap");
    return next;
  },
  chooseToMove(params) {
    const next = game.createEvent("chooseToMove");
    next.player = this;
    const args = [...arguments];
    if (args.length === 1 && typeof params === "object") {
      Object.assign(next, params);
    } else {
      for (const arg of args) {
        if (typeof arg == "boolean") {
          next.forced = arg;
        } else if (arg === "allowChooseAll") {
          next.allowChooseAll = true;
        } else if (typeof arg == "string") {
          next.prompt = arg;
        }
      }
    }
    next.setContent("chooseToMove");
    next.filterOk ??= function() {
      return true;
    };
    next.filterMove ??= createDefaultMoveFilter();
    next._args = args;
    return next;
  },
  chooseToMove_new(params) {
    const next = game.createEvent("chooseToMove_new");
    next.player = this;
    const args = [...arguments];
    if (args.length === 1 && typeof params === "object") {
      Object.assign(next, params);
    } else {
      for (const arg of args) {
        if (typeof arg == "boolean") {
          next.forced = arg;
        } else if (typeof arg == "string") {
          next.prompt = arg;
        }
      }
    }
    next.setContent("chooseToMove_new");
    next.filterOk ??= function() {
      return true;
    };
    next.filterMove ??= createDefaultMoveFilter();
    next._args = Array.from(arguments);
    return next;
  },
  chooseToGuanxing(num) {
    const next = game.createEvent("chooseToGuanxing");
    next.num = num || 1;
    next.player = this;
    next.setContent("chooseToGuanxing");
    return next;
  },
  chooseToDuiben(target) {
    const next = game.createEvent("chooseToDuiben");
    next.player = this;
    next.target = target;
    next.setContent("chooseToDuiben");
    return next;
  },
  chooseToPSS(target) {
    const next = game.createEvent("chooseToPSS");
    next.player = this;
    next.target = target;
    next.setContent("chooseToPSS");
    return next;
  },
  //TODO: 给canMoveCard函数适配虚拟牌的移动
  canMoveCard(withatt, nojudge) {
    const player = this;
    const args = Array.from(arguments).slice(2);
    let sourceTargets;
    let aimTargets;
    let filterCard;
    let canReplace;
    args.forEach((arg) => {
      if (get.itemtype(arg) == "players") {
        if (!sourceTargets) {
          sourceTargets = arg;
        } else if (!aimTargets) {
          aimTargets = arg;
        }
      } else if (get.itemtype(arg) == "player") {
        if (!sourceTargets) {
          sourceTargets = [arg];
        } else if (!aimTargets) {
          aimTargets = [arg];
        }
      } else if (typeof arg == "function") {
        filterCard = arg;
      } else if (typeof arg == "object" && arg) {
        filterCard = get.filter(arg);
      } else if (arg == "canReplace") {
        canReplace = true;
      }
    });
    if (!sourceTargets) {
      sourceTargets = game.filterPlayer();
    }
    if (!aimTargets) {
      aimTargets = game.filterPlayer();
    }
    const resolvedAimTargets = aimTargets;
    return sourceTargets.some((current) => {
      const att = get.sgn(get.attitude(player, current));
      if (!withatt || att != 0) {
        const es = current.getVCards("e", filterCard);
        for (let i = 0; i < es.length; i++) {
          if (resolvedAimTargets.some((current2) => {
            if (withatt) {
              if (get.sgn(get.value(es[i], current)) != -att) {
                return false;
              }
              const att2 = get.sgn(get.attitude(player, current2));
              if (!canReplace || att < 0 && current2.countEquipableSlot(get.subtype(es[i]))) {
                if (att == att2 || att2 != get.sgn(get.effect(current2, es[i], player, current2))) {
                  return false;
                }
              }
            }
            return current != current2 && !current2.isMin() && current2.canEquip(es[i], canReplace);
          })) {
            return true;
          }
        }
      }
      if (!nojudge && (!withatt || att > 0)) {
        const js = current.getVCards("j", filterCard);
        for (let i = 0; i < js.length; i++) {
          if (game.hasPlayer(function(current2) {
            if (!resolvedAimTargets.includes(current2)) {
              return false;
            }
            if (withatt) {
              const att2 = get.attitude(player, current2);
              if (att2 >= 0) {
                return false;
              }
            }
            return current != current2 && current2.canAddJudge(js[i]);
          })) {
            return true;
          }
        }
      }
      return false;
    });
  },
  moveCard(params) {
    const next = game.createEvent("moveCard");
    next.player = this;
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
          next.forced = arg;
        } else if (get.itemtype(arg) == "players") {
          if (!next.sourceTargets) {
            next.sourceTargets = arg;
          } else if (!next.aimTargets) {
            next.aimTargets = arg;
          }
        } else if (get.itemtype(arg) == "player") {
          if (!next.sourceTargets) {
            next.sourceTargets = [arg];
          } else if (!next.aimTargets) {
            next.aimTargets = [arg];
          }
        } else if (typeof arg == "string") {
          if (arg == "canReplace") {
            next.canReplace = true;
          } else {
            get.evtprompt(next, arg);
          }
        } else if (Array.isArray(arg)) {
          let j = 0;
          for (; j < arg.length; j++) {
            if (typeof arg[j] != "string") {
              break;
            }
          }
          if (j == arg.length) {
            next.targetprompt = arg;
          }
        } else if (typeof arg == "function") {
          next.filter = arg;
        } else if (typeof arg == "object" && arg) {
          next.filter = get.filter(arg);
        }
      }
    }
    if (!next.sourceTargets) {
      next.sourceTargets = game.filterPlayer();
    }
    if (!next.aimTargets) {
      next.aimTargets = game.filterPlayer();
    }
    if (next.filter == void 0) {
      next.filter = lib.filter.all;
    }
    next.setContent("moveCard");
    next._args = args;
    return next;
  }
};
export {
  moveAndMinigameMethods
};
