import "../../../../../noname.js";
import "../contracts/cardContract.js";
import { game } from "../../../../game/index.js";
import { get } from "../../../../get/binding.js";
import { _status } from "../../../../status/index.js";
import { lib } from "../../../index.js";
const cardDrawAndDiscardMethods = {
  drawTo(num, args) {
    const num2 = num - this.countCards("h");
    let next;
    if (Array.isArray(args)) {
      next = this.draw({ num: num2 });
      for (const arg of args) {
        if (get.itemtype(arg) == "player") {
          next.source = arg;
        } else if (typeof arg == "boolean") {
          next.animate = arg;
        } else if (arg == "nodelay") {
          next.animate = false;
          next.$draw = true;
        } else if (arg == "visible") {
          next.visible = true;
        } else if (arg == "bottom") {
          next.bottom = true;
        } else if (typeof arg == "object" && arg && "drawDeck" in arg && arg.drawDeck != void 0) {
          next.drawDeck = arg.drawDeck;
        }
      }
    } else if (get.is.object(args) && get.itemtype(args) == null) {
      next = this.draw({ num: num2, ...args });
    } else {
      next = this.draw({ num: num2 });
    }
    return next;
  },
  draw(params) {
    const next = game.createEvent("draw");
    next.player = this;
    const args = [...arguments];
    const event = _status.event;
    if (args.length === 1 && typeof params === "number") {
      next.num = params;
    } else if (args.length === 1 && typeof params === "object" && !Array.isArray(params) && params != null && get.itemtype(params) == null) {
      const drawParams = params;
      Object.assign(next, drawParams);
      if (drawParams.nodelay) {
        delete next.nodelay;
        next.animate = false;
        next.$draw = true;
      }
    } else {
      for (const arg of args) {
        if (get.itemtype(arg) == "player") {
          next.source = arg;
        } else if (typeof arg == "number") {
          next.num = arg;
        } else if (typeof arg == "boolean") {
          next.animate = arg;
        } else if (arg == "nodelay") {
          next.animate = false;
          next.$draw = true;
        } else if (arg == "visible") {
          next.visible = true;
        } else if (arg == "bottom") {
          next.bottom = true;
        } else if (typeof arg == "object" && arg && arg.drawDeck != void 0) {
          next.drawDeck = arg.drawDeck;
        }
      }
    }
    if (typeof next.num != "number") {
      next.num = 1;
    }
    if (next.num <= 0) {
      _status.event.next.remove(next);
      next.resolve();
    }
    if (get.itemtype(next.source) != "player") {
      const source = event.player;
      if (source) {
        next.source = source;
      }
    }
    next.setContent("draw");
    if (lib.config.mode == "stone" && _status.mode == "deck" && next.drawDeck == void 0 && !next.player?.isMin() && next.num > 1) {
      next.drawDeck = 1;
    }
    next.result = [];
    next.gaintag ??= [];
    return next;
  },
  randomDiscard(params) {
    let position = "he";
    let discarder = this;
    let num = 1;
    let random = false;
    let log = "popup";
    const args = [...arguments];
    if (args.length === 1 && get.is.object(params) && params != null && get.itemtype(params) == null) {
      const rdParams = params;
      num = rdParams.num ?? num;
      discarder = rdParams.discarder ?? discarder;
      position = rdParams.position ?? position;
      random = rdParams.random ?? random;
      log = rdParams.log ?? log;
    } else {
      for (const arg of args) {
        if (typeof arg === "number") {
          num = arg;
        } else if (get.itemtype(arg) == "player") {
          discarder = arg;
        } else if (get.itemtype(arg) === "position") {
          position = arg;
        } else if (arg === "random") {
          random = true;
        } else if (arg === false || typeof arg === "string") {
          log = arg;
        }
      }
    }
    let cards;
    if (random) {
      cards = this.getCards(position).randomGets(num);
    } else {
      const discardable = this.getDiscardableCards(discarder, position);
      cards = discardable.randomGets(num);
      if (cards.length < num) {
        cards.addArray(this.getCards(position, (c) => !discardable.includes(c)).randomGets(num - cards.length));
      }
    }
    const next = this.modedDiscard({
      cards,
      discarder,
      log
    });
    return next;
  },
  discard(params) {
    const next = game.createEvent("discard");
    next.player = this;
    next.num = 0;
    const args = [...arguments];
    if (args.length === 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
      const discardParams = params;
      Object.assign(next, discardParams);
      if (discardParams.discarder != null && discardParams.discarder !== this) {
        next.notBySelf = true;
      }
    } else {
      for (const arg of args) {
        if (get.itemtype(arg) === "player") {
          next.discarder = arg;
          if (this !== next.discarder) {
            next.notBySelf = true;
          }
        } else if (get.itemtype(arg) === "cards") {
          next.cards = arg.slice(0);
        } else if (get.itemtype(arg) === "card") {
          next.cards = [arg];
        } else if (["div", "fragment"].includes(get.objtype(arg))) {
          next.position = arg;
        } else if (arg === "notBySelf") {
          next.notBySelf = true;
        }
      }
    }
    if (get.itemtype(next.cards) !== "cards") {
      _status.event.next.remove(next);
      next.resolve();
    }
    next.setContent("discard");
    return next;
  },
  modedDiscard(params) {
    const next = game.createEvent("discard");
    next.player = this;
    next.discarder = this;
    next.cards = [];
    next.log = "popup";
    const args = [...arguments];
    if (args.length === 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
      const modParams = params;
      Object.assign(next, modParams);
      if (modParams.discarder != null && modParams.discarder !== this) {
        next.notBySelf = true;
      }
    } else {
      for (const arg of args) {
        if (get.itemtype(arg) === "player") {
          next.discarder = arg;
          if (this !== next.discarder) {
            next.notBySelf = true;
          }
        } else if (get.itemtype(arg) === "cards") {
          next.cards = arg.slice(0);
        } else if (get.itemtype(arg) === "card") {
          next.cards = [arg];
        } else if (["div", "fragment"].includes(get.objtype(arg))) {
          next.position = arg;
        } else if (arg === false || typeof arg === "string") {
          next.log = arg;
        }
      }
    }
    if (!next.cards.length) {
      _status.event.next.remove(next);
      next.resolve();
    }
    next.skills = [];
    next.protected_cards = [];
    const currentEvent = _status.event;
    const event = typeof currentEvent === "string" ? currentEvent : currentEvent.getParent().name;
    let skills = [];
    if (typeof this.getModableSkills === "function") {
      skills = this.getModableSkills();
    } else if (typeof this.getSkills === "function") {
      skills = this.getSkills().concat(lib.skill.global);
      game.expandSkills(skills);
      skills = skills.filter((i) => {
        const info = get.info(i);
        return info && info.mod;
      });
      skills.sort((a, b) => get.priority(a) - get.priority(b));
    }
    for (let skill of skills) {
      const skillInfo = get.info(skill);
      if (!skillInfo.mod) {
        throw new TypeError(`Expected mod configuration for ${skill}`);
      }
      const canBeDiscarded = skillInfo.mod.canBeDiscarded;
      if (canBeDiscarded) {
        for (let i = 0; i < next.cards.length; i++) {
          let arg = [next.cards[i], next.discarder, this, event, "unchanged"], result = canBeDiscarded.call(game, ...arg);
          if (result !== void 0 && typeof arg[arg.length - 1] !== "object") {
            arg[arg.length - 1] = result;
          }
          if (!arg[arg.length - 1]) {
            next.skills.add(skill);
            next.protected_cards.push(next.cards.splice(i--, 1)[0]);
          }
        }
      }
      const discardSkillInfo = get.info(skill);
      if (!discardSkillInfo.mod) {
        throw new TypeError(`Expected mod configuration for ${skill}`);
      }
      const cardDiscardable = discardSkillInfo.mod.cardDiscardable;
      if (cardDiscardable) {
        for (let i = 0; i < next.cards.length; i++) {
          let arg = [next.cards[i], this, event, "unchanged"], result = cardDiscardable.call(game, ...arg);
          if (result !== void 0 && typeof arg[arg.length - 1] !== "object") {
            arg[arg.length - 1] = result;
          }
          if (!arg[arg.length - 1]) {
            next.skills.add(skill);
            next.protected_cards.push(next.cards.splice(i--, 1)[0]);
          }
        }
      }
    }
    next.setContent(async (event2, trigger, player) => {
      const modEvent = event2;
      if (!player) {
        return;
      }
      if (modEvent.skills.length && modEvent.log) {
        for (let i of modEvent.skills) {
          if (typeof player[modEvent.log] === "function") {
            player[modEvent.log](i);
          }
        }
      }
      const cards = modEvent.cards;
      if (cards.length) {
        game.log(player, "弃置了", cards);
        modEvent.done = player.lose(cards, modEvent.position, "visible");
        modEvent.done.type = "discard";
        if (modEvent.discarder) {
          modEvent.done.discarder = modEvent.discarder;
        }
        await modEvent.done;
        await event2.trigger("discard");
      }
      event2.result = {
        bool: cards.length > 0,
        cards,
        skills: modEvent.skills,
        protected_cards: modEvent.protected_cards
      };
    });
    return next;
  },
  loseToDiscardpile(params) {
    const next = game.createEvent("loseToDiscardpile");
    next.player = this;
    next.num = 0;
    const args = [...arguments];
    if (args.length === 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
      Object.assign(next, params);
    } else {
      for (const arg of args) {
        if (get.itemtype(arg) == "player") {
          next.source = arg;
        } else if (get.itemtype(arg) == "cards") {
          next.cards = arg.slice(0);
        } else if (get.itemtype(arg) == "card") {
          next.cards = [arg];
        } else if (typeof arg == "boolean") {
          next.animate = arg;
        } else if (["div", "fragment"].includes(get.objtype(arg))) {
          next.position = arg;
        } else if (arg == "notBySelf") {
          next.notBySelf = true;
        } else if (arg == "insert") {
          next.insert_card = true;
        } else if (arg == "blank") {
          next.blank = true;
        }
      }
    }
    if (next.cards == void 0) {
      _status.event.next.remove(next);
      next.resolve();
    }
    next.setContent("loseToDiscardpile");
    return next;
  },
  doubleDraw() {
    const next = game.createEvent("doubleDraw");
    if (get.is.changban()) {
      _status.event.next.remove(next);
      next.resolve();
    }
    next.player = this;
    next.setContent("doubleDraw");
    return next;
  }
};
export {
  cardDrawAndDiscardMethods
};
