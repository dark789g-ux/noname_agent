import "../../../../../noname.js";
import "../contracts/cardContract.js";
import { game } from "../../../../game/index.js";
import { get } from "../../../../get/binding.js";
import { lib } from "../../../index.js";
import { ui } from "../../../../ui/index.js";
const cardGainAndExpansionMethods = {
  randomGain(params) {
    let position = "he";
    let num = 1;
    let target = null;
    let line = false;
    const args = [...arguments];
    if (args.length === 1 && get.is.object(params) && params != null && get.itemtype(params) == null) {
      const rgParams = params;
      num = rgParams.num ?? num;
      position = rgParams.position ?? position;
      target = rgParams.target ?? target;
      line = rgParams.line ?? line;
    } else {
      for (const arg of args) {
        if (typeof arg == "number") {
          num = arg;
        } else if (get.itemtype(arg) == "position") {
          position = arg;
        } else if (get.itemtype(arg) == "player") {
          target = arg;
        } else if (typeof arg == "boolean") {
          line = arg;
        }
      }
    }
    if (target == null) {
      return this.gain({
        cards: [],
        log: true,
        bySelf: true
      });
    }
    const cards = target.getCards(position).randomGets(num);
    const next = this.gain({
      cards,
      source: target,
      log: true,
      bySelf: true
    });
    if (line) {
      const contents = lib.element.content.gain;
      if (Array.isArray(contents)) {
        const newContents = [
          async (event, _trigger, player) => {
            if (player && event.target && event.target !== "cardPile") {
              player.line(event.target, "green");
            }
          },
          ...contents
        ];
        next.setContent(newContents);
      } else if (typeof contents === "function") {
        next.setContent(async (event, trigger, player) => {
          if (player && event.target && event.target !== "cardPile") {
            player.line(event.target, "green");
          }
          await contents(event, trigger, player);
        });
      }
    }
    return next;
  },
  gainMultiple(targets, position = "h") {
    const next = game.createEvent("gainMultiple", false);
    next.setContent("gainMultiple");
    next.player = this;
    next.targets = targets;
    next.position = position || "h";
    next.gaintag = [];
    return next;
  },
  gain(params) {
    const next = game.createEvent("gain");
    next.player = this;
    const args = [...arguments];
    if (args.length == 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
      const gainParams = params;
      Object.assign(next, gainParams);
      if (gainParams?.areaNames != null) {
        delete next.areaNames;
        const commonAreas = [...lib.commonArea.values()];
        for (const areaName of gainParams.areaNames) {
          if (commonAreas.some((area) => area?.fromName === areaName)) {
            next.fromStorage = true;
            next[areaName] = true;
          }
        }
      }
    } else {
      for (const arg of args) {
        if (get.itemtype(arg) == "player") {
          next.source = arg;
        } else if (get.itemtype(arg) == "cards") {
          next.cards = arg.slice(0);
        } else if (get.itemtype(arg) == "card") {
          next.cards = [arg];
        } else if (arg === "log") {
          next.log = true;
        } else if (arg == "fromStorage") {
          next.fromStorage = true;
        } else if (typeof arg == "string" && [...lib.commonArea.keys()].some((area) => lib.commonArea.get(area)?.fromName == arg)) {
          next.fromStorage = true;
          next[arg] = true;
        } else if (arg == "bySelf") {
          next.bySelf = true;
        } else if (typeof arg == "string") {
          next.animate = arg;
        } else if (typeof arg == "boolean") {
          next.delay = arg;
        }
      }
    }
    if (next.animate == "gain2" || next.animate == "draw2") {
      if (!("log" in next)) {
        next.log = true;
      }
    }
    if (get.itemtype(next.cards) !== "cards") {
      next.cards = [];
    }
    next.setContent("gain");
    next.getd = function(player, key, position) {
      if (!position) {
        position = ui.discardPile;
      }
      if (!key) {
        key = "cards";
      }
      const cards = [], event = this;
      game.checkGlobalHistory("cardMove", function(rawEvt) {
        const evt = rawEvt;
        if (evt.name != "lose" || evt.position != position || evt.getParent() != event) {
          return;
        }
        if (player && player != evt.player) {
          return;
        }
        cards.addArray(evt[key]);
      });
      return cards;
    };
    next.getl = function(player) {
      const that = this;
      const map = {
        player,
        hs: [],
        es: [],
        js: [],
        ss: [],
        xs: [],
        cards: [],
        cards2: [],
        gaintag_map: {},
        vcard_map: /* @__PURE__ */ new Map()
      };
      player.checkAllHistory("lose", function(rawEvt) {
        const evt = rawEvt;
        if (evt.parent == that) {
          map.hs.addArray(evt.hs);
          map.es.addArray(evt.es);
          map.js.addArray(evt.js);
          map.ss.addArray(evt.ss);
          map.xs.addArray(evt.xs);
          map.cards.addArray(evt.cards);
          map.cards2.addArray(evt.cards2);
          for (let key in evt.gaintag_map) {
            if (!map.gaintag_map[key]) {
              map.gaintag_map[key] = [];
            }
            map.gaintag_map[key].addArray(evt.gaintag_map[key]);
          }
          evt.vcard_map.forEach((value, key) => {
            map.vcard_map.set(key, value);
          });
        }
      });
      return map;
    };
    next.getg = function(player) {
      if (this.getlx === false || player != this.player || !this.cards) {
        return [];
      }
      return this.cards.slice(0);
    };
    next.gaintag ??= [];
    return next;
  },
  addToExpansion(params) {
    const next = game.createEvent("addToExpansion");
    next.player = this;
    const args = [...arguments];
    if (args.length === 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
      const expParams = params;
      Object.assign(next, expParams);
      if (expParams.areaNames != null) {
        delete next.areaNames;
        const commonAreas = [...lib.commonArea.values()];
        for (const areaName of expParams.areaNames) {
          if (commonAreas.some((area) => area?.fromName === areaName)) {
            next.fromStorage = true;
            next[areaName] = true;
          }
        }
      }
    } else {
      for (const arg of args) {
        if (get.itemtype(arg) == "player") {
          next.source = arg;
        } else if (get.itemtype(arg) == "cards") {
          next.cards = arg.slice(0);
        } else if (get.itemtype(arg) == "card") {
          next.cards = [arg];
        } else if (arg === "log") {
          next.log = true;
        } else if (arg == "fromStorage") {
          next.fromStorage = true;
        } else if (typeof arg == "string" && Array.from(lib.commonArea.keys()).some((area) => lib.commonArea.get(area)?.fromName == arg)) {
          next.fromStorage = true;
          next[arg] = true;
        } else if (arg == "bySelf") {
          next.bySelf = true;
        } else if (typeof arg == "string") {
          next.animate = arg;
        } else if (typeof arg == "boolean") {
          next.delay = arg;
        }
      }
    }
    if (next.animate == "gain2" || next.animate == "draw2" || next.animate == "give") {
      if (!("log" in next)) {
        next.log = true;
      }
    }
    if (get.itemtype(next.cards) !== "cards") {
      next.cards = [];
    }
    next.setContent("addToExpansion");
    next.getd = function(player, key, position) {
      if (!position) {
        position = ui.discardPile;
      }
      if (!key) {
        key = "cards";
      }
      const cards = [], event = this;
      game.checkGlobalHistory("cardMove", function(rawEvt) {
        const evt = rawEvt;
        if (evt.name != "lose" || evt.position != position || evt.getParent() != event) {
          return;
        }
        if (player && player != evt.player) {
          return;
        }
        cards.addArray(evt[key]);
      });
      return cards;
    };
    next.getl = function(player) {
      const that = this;
      const map = {
        player,
        hs: [],
        es: [],
        js: [],
        ss: [],
        xs: [],
        cards: [],
        cards2: [],
        gaintag_map: {},
        vcard_map: /* @__PURE__ */ new Map()
      };
      player.checkAllHistory("lose", function(rawEvt) {
        const evt = rawEvt;
        if (evt.parent == that) {
          map.hs.addArray(evt.hs);
          map.es.addArray(evt.es);
          map.js.addArray(evt.js);
          map.ss.addArray(evt.ss);
          map.xs.addArray(evt.xs);
          map.cards.addArray(evt.cards);
          map.cards2.addArray(evt.cards2);
          for (let key in evt.gaintag_map) {
            if (!map.gaintag_map[key]) {
              map.gaintag_map[key] = [];
            }
            map.gaintag_map[key].addArray(evt.gaintag_map[key]);
          }
          evt.vcard_map.forEach((value, key) => {
            map.vcard_map.set(key, value);
          });
        }
      });
      return map;
    };
    next.getg = function(_player) {
      return [];
    };
    next.gaintag ??= [];
    return next;
  },
  give(cards, target, visible) {
    const next = target.gain({
      cards: Array.isArray(cards) ? cards : [cards],
      source: this,
      animate: visible ? "give" : "giveAuto"
    });
    next.giver = this;
    return next;
  }
};
export {
  cardGainAndExpansionMethods
};
