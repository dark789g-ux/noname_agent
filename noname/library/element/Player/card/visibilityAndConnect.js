import "../../../../../noname.js";
import "../contracts/cardContract.js";
import { get } from "../../../../get/binding.js";
import { game } from "../../../../game/index.js";
import { _status } from "../../../../status/index.js";
const cardVisibilityAndConnectMethods = {
  connectCards(params) {
    const next = game.createEvent("connectCards");
    next.player = this;
    const args = [...arguments];
    let objParam = args.length === 1 && typeof params === "object";
    if (objParam) {
      const type = get.itemtype(params);
      if (type != null) {
        objParam = false;
      }
    }
    if (objParam) {
      Object.assign(next, params);
    } else {
      for (const arg of args) {
        const type = get.itemtype(arg);
        if (type == "cards") {
          next.cards = arg;
        } else if (type == "card") {
          next.cards = [arg];
        } else if (type == "player") {
          next.source = arg;
        } else if (typeof arg == "boolean") {
          next.log = arg;
        }
      }
    }
    if (get.itemtype(next.source) != "player") {
      next.source = _status.event.player;
    }
    if (get.itemtype(next.cards) != "cards" || !next.cards) {
      next.cards = this.getCards("h");
    }
    if (!next.cards.length) {
      _status.event.next.remove(next);
      next.resolve();
    }
    if (next.log == void 0) {
      next.log = true;
    }
    next.setContent("connectCards");
    next._args = args;
    return next;
  },
  resetConnectedCards(params) {
    const next = game.createEvent("resetConnectedCards");
    next.player = this;
    const args = [...arguments];
    let objParam = args.length === 1 && typeof params === "object";
    if (objParam) {
      const type = get.itemtype(params);
      if (type != null) {
        objParam = false;
      }
    }
    if (objParam) {
      Object.assign(next, params);
    } else {
      for (const arg of args) {
        const type = get.itemtype(arg);
        if (type == "cards") {
          next.cards = arg;
        } else if (type == "card") {
          next.cards = [arg];
        } else if (type == "player") {
          next.source = arg;
        } else if (typeof arg == "boolean") {
          next.log = arg;
        }
      }
    }
    if (get.itemtype(next.source) != "player") {
      next.source = _status.event.player;
    }
    if (get.itemtype(next.cards) != "cards" || !next.cards) {
      next.cards = this.getConnectedCards();
    }
    if (next.log == void 0) {
      next.log = true;
    }
    if (!next.cards.length) {
      _status.event.next.remove(next);
      next.resolve();
    }
    next.setContent("resetConnectedCards");
    next._args = args;
    return next;
  },
  *iterableGetConnectedCards() {
    for (const card of this.iterableGetCards("h")) {
      if (get.is.connectedCard(card)) {
        yield card;
      }
    }
  },
  getConnectedCards() {
    return Array.from(this.iterableGetConnectedCards());
  },
  countConnectedCards() {
    let count = 0;
    for (const _ of this.iterableGetConnectedCards()) {
      ++count;
    }
    return count;
  },
  hasConnectedCards() {
    for (const _ of this.iterableGetConnectedCards()) {
      return true;
    }
    return false;
  },
  addShownCards(params) {
    const args = [...arguments];
    const next = game.createEvent("addShownCards", false);
    next.player = this;
    next.cards = [];
    next.gaintag = [];
    if (args.length === 1 && typeof params == "object" && params !== null && get.itemtype(params) == null) {
      Object.assign(next);
    } else {
      for (const arg of args) {
        const type = get.itemtype(arg);
        if (type == "cards") {
          next.cards.addArray(arg);
        } else if (type == "card") {
          next.cards.add(arg);
        } else if (typeof arg == "string" && arg.startsWith("visible_")) {
          next.gaintag.add(arg);
        }
      }
    }
    if (!next.cards?.length || !next.gaintag?.length) {
      _status.event.next.remove(next);
      next.resolve();
    }
    next.setContent("addShownCards");
    next._args = args;
    return next;
  },
  hideShownCards(params) {
    const next = game.createEvent("hideShownCards", false);
    next.player = this;
    next.cards = [];
    next.gaintag = [];
    const args = [...arguments];
    if (args.length === 1 && typeof params == "object" && params !== null && get.itemtype(params) == null) {
      Object.assign(next, params);
    } else {
      for (const arg of args) {
        const type = get.itemtype(arg);
        if (type == "cards") {
          next.cards.addArray(arg);
        } else if (type == "card") {
          next.cards.add(arg);
        } else if (typeof arg == "string" && arg.startsWith("visible_")) {
          next.gaintag.add(arg);
        }
      }
    }
    if (!next.cards?.length) {
      _status.event.next.remove(next);
      next.resolve();
    }
    next.setContent("hideShownCards");
    next._args = args;
    return next;
  },
  *iterableGetShownCards() {
    for (const card of this.iterableGetCards("h")) {
      if (get.is.shownCard(card)) {
        yield card;
      }
    }
  },
  getShownCards() {
    return Array.from(this.iterableGetShownCards());
  },
  countShownCards() {
    let count = 0;
    for (const _ of this.iterableGetShownCards()) {
      ++count;
    }
    return count;
  },
  hasShownCards() {
    for (const _ of this.iterableGetShownCards()) {
      return true;
    }
    return false;
  },
  *iterableGetKnownCards(other, filter) {
    if (!other) {
      if (other === null) {
        console.trace("other参数不应传入null，可以用void 0或undefined占位；后续版本可能将不再检查，请及时更改！");
      } else if (other !== void 0) {
        console.trace("other参数不应传入假值（如false、0和空字符串）后续版本可能会废除该兼容，请及时更改！");
      }
      other = get.player() || this;
    }
    for (const card of this.iterableGetCards("h", filter)) {
      if (card.isKnownBy(other)) {
        yield card;
      }
    }
  },
  getKnownCards(other, filter) {
    return Array.from(this.iterableGetKnownCards(other, filter));
  },
  isAllCardsKnown(other) {
    if (!other) {
      if (other === null) {
        console.trace("other参数不应传入null，可以用void 0或undefined占位；后续版本可能将不再检查，请及时更改！");
      } else if (other !== void 0) {
        console.trace("other参数不应传入假值（如false、0和空字符串）后续版本可能会废除该兼容，请及时更改！");
      }
      other = get.player() || this;
    }
    for (const card of this.iterableGetCards("h")) {
      if (!card.isKnownBy(other)) {
        return false;
      }
    }
    return true;
  },
  hasKnownCards(other, filter) {
    for (const _ of this.iterableGetKnownCards(other, filter)) {
      return true;
    }
    return false;
  },
  countKnownCards(other, filter) {
    let count = 0;
    for (const _ of this.iterableGetKnownCards(other, filter)) {
      ++count;
    }
    return count;
  },
  showHandcards(str) {
    const cards = this.getCards("h");
    if (typeof str !== "string") {
      str = get.translation(this) + "的手牌";
    }
    const next = this.showCards(cards, str);
    return next;
  },
  showCards(cards, str, flashAnimation = false, isFlash) {
    const next = game.createEvent("showCards");
    next.player = this;
    next.str = str;
    if (typeof cards == "string") {
      str = cards;
      cards = next.str;
      next.str = str;
    }
    const itemType = get.itemtype(cards);
    if (itemType == "card" && typeof cards == "object" && cards !== null && !Array.isArray(cards)) {
      next.cards = [cards];
    } else if (itemType == "cards" && Array.isArray(cards)) {
      next.cards = cards.slice(0);
    } else {
      _status.event.next.remove(next);
      next.resolve();
    }
    next.flashAnimation = flashAnimation;
    if (flashAnimation && isFlash == void 0) {
      next.isFlash = true;
    } else {
      next.isFlash = false;
    }
    next.getShown = function(player) {
      const event = this;
      if (!player || get.itemtype(player) != "player") {
        return event.show_map?.get?.("others") || {
          cardPile: [],
          discardPile: [],
          ordering: [],
          special: [],
          noPosition: []
        };
      }
      return event.show_map?.get?.(player) || {
        hs: [],
        es: [],
        js: [],
        xs: [],
        ss: [],
        cards2: [],
        cards: []
      };
    };
    next.setContent("showCards");
    next._args = [...arguments];
    return next;
  },
  viewCards(str, cards) {
    const next = game.createEvent("viewCards");
    next.player = this;
    next.str = str;
    next.cards = cards.slice(0);
    next.setContent("viewCards");
    next._args = Array.from(arguments);
    return next;
  },
  viewHandcards(target) {
    const cards = target.getCards("h");
    return this.viewCards(`${get.translation(target)}的手牌`, cards);
  }
};
export {
  cardVisibilityAndConnectMethods
};
