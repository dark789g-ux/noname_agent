import "../../../../../noname.js";
import "../contracts/cardContract.js";
import { game } from "../../../../game/index.js";
import { get } from "../../../../get/binding.js";
import { lib } from "../../../index.js";
import { _status } from "../../../../status/index.js";
import { ui } from "../../../../ui/index.js";
const cardLoseAndDirectMethods = {
  swapHandcards(target, cards1, cards2) {
    const next = game.createEvent("swapHandcards", false);
    next.player = this;
    next.target = target;
    if (cards1) {
      next.cards1 = cards1;
    }
    if (cards2) {
      next.cards2 = cards2;
    }
    next.setContent("swapHandcards");
    return next;
  },
  directequip(cards) {
    const cardList = get.itemtype(cards) === "card" || !Array.isArray(cards) ? [cards] : cards;
    for (const card of cardList) {
      this.addVirtualEquip(
        ...(() => {
          if (get.itemtype(card) === "vcard") {
            const vcard = card;
            return [vcard, vcard.cards ?? []];
          }
          const realCard = card;
          return [realCard.cardSymbol ? realCard[realCard.cardSymbol] : get.autoViewAs(realCard, void 0, false), [realCard]];
        })()
      );
    }
    if (!_status.video) {
      game.addVideo("directequip", this, get.cardsInfo(cardList));
    }
  },
  $addToExpansion(cards, broadcast, gaintag, check = true) {
    const hs = this.getCards("x");
    for (let i = 0; i < cards.length; i++) {
      if (hs.includes(cards[i]) && check) {
        cards.splice(i--, 1);
      }
    }
    for (let i = 0; i < cards.length; i++) {
      cards[i].fix();
      if (gaintag) {
        gaintag.forEach((tag) => cards[i].addGaintag(tag));
      }
      this.node.expansions.insertBefore(cards[i], this.node.expansions.firstChild);
    }
    if (broadcast !== false) {
      game.broadcast(
        function(player, cards2, gaintag2, check2) {
          player.$addToExpansion(cards2, null, gaintag2, check2);
        },
        this,
        cards,
        gaintag,
        check
      );
    }
    return this;
  },
  directgain(cards, broadcast, gaintag) {
    const hs = this.getCards("hs");
    for (let i = 0; i < cards.length; i++) {
      if (hs.includes(cards[i])) {
        cards.splice(i--, 1);
      }
    }
    const cards1 = [];
    const cards2 = [];
    for (let i = 0; i < cards.length; i++) {
      cards[i].fix();
      if (gaintag) {
        if (typeof gaintag == "string") {
          gaintag = [gaintag];
        }
        gaintag.forEach((tag) => cards[i].addGaintag(tag));
      }
      const sort = lib.config.sort_card(cards[i]);
      if (this == game.me) {
        cards[i].classList.add("drawinghidden");
      }
      if (get.is.singleHandcard() || sort > 0) {
        cards1.push(cards[i]);
      } else {
        cards2.push(cards[i]);
      }
    }
    this.node.handcards1.prepend(...cards1);
    if (cards2.length) {
      this.node.handcards2.prepend(...cards2);
    }
    if (this == game.me || _status.video) {
      ui.updatehl();
    }
    if (!_status.video) {
      game.addVideo("directgain", this, get.cardsInfo(cards));
      this.update();
    }
    if (broadcast !== false) {
      game.broadcast(
        function(player, cards3) {
          player.directgain(cards3);
        },
        this,
        cards
      );
    }
    return this;
  },
  directgains(cards, broadcast, gaintag) {
    const hs = this.getCards("hs");
    for (let i = 0; i < cards.length; i++) {
      if (hs.includes(cards[i])) {
        cards.splice(i--, 1);
      }
    }
    const addLast = function(card, node) {
      if (gaintag) {
        for (let i = 0; i < node.childNodes.length; i++) {
          const add = node.childNodes[node.childNodes.length - i - 1];
          if (!add.classList.contains("glows")) {
            break;
          }
          if (typeof gaintag == "string" ? add.hasGaintag(gaintag) : gaintag.some((tag) => add.hasGaintag(tag))) {
            node.insertBefore(card, add.nextSibling);
            return;
          }
        }
      }
      node.appendChild(card);
    };
    for (let i = 0; i < cards.length; i++) {
      cards[i].fix();
      cards[i].remove();
      if (gaintag) {
        if (typeof gaintag == "string") {
          gaintag = [gaintag];
        }
        gaintag.forEach((tag) => cards[i].addGaintag(tag));
      }
      cards[i].classList.add("glows");
      if (this == game.me) {
        cards[i].classList.add("drawinghidden");
      }
      if (get.is.singleHandcard()) {
        addLast(cards[i], this.node.handcards1);
      } else {
        addLast(cards[i], this.node.handcards2);
      }
    }
    if (this == game.me || _status.video) {
      ui.updatehl();
    }
    if (!_status.video) {
      game.addVideo("directgains", this, {
        cards: get.cardsInfo(cards),
        gaintag
      });
      this.update();
    }
    if (broadcast !== false) {
      game.broadcast(
        function(player, cards2, gaintag2) {
          player.directgains(cards2, null, gaintag2);
        },
        this,
        cards,
        gaintag
      );
    }
    return this;
  },
  lose(params) {
    const next = game.createEvent("lose");
    next.player = this;
    next.forceDie = true;
    const args = [...arguments];
    if (args.length === 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
      const loseParams = params;
      Object.assign(next, loseParams);
      if (loseParams.areaNames != null) {
        delete next.areaNames;
        const commonAreas = [...lib.commonArea.values()];
        for (const areaName of loseParams.areaNames) {
          if (commonAreas.some((area) => area?.toName === areaName)) {
            next.toStorage = true;
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
        } else if (["div", "fragment"].includes(get.objtype(arg))) {
          next.position = arg;
        } else if (arg == "toStorage") {
          next.toStorage = true;
        } else if (typeof arg == "string" && Array.from(lib.commonArea.keys()).some((area) => lib.commonArea.get(area)?.toName == arg)) {
          next.toStorage = true;
          next[arg] = true;
        } else if (arg == "visible") {
          next.visible = true;
        } else if (arg == "insert") {
          next.insert_card = true;
        }
      }
    }
    if (next.cards) {
      const hej = this.getCards("hejsx");
      for (let i = 0; i < next.cards.length; i++) {
        if (!hej.includes(next.cards[i])) {
          next.cards.splice(i--, 1);
        }
      }
    }
    if (!next.cards || !next.cards.length) {
      _status.event.next.remove(next);
      next.resolve();
    } else {
      if (next.position == void 0) {
        next.position = ui.discardPile;
      }
      next.cards = next.cards.slice(0);
    }
    next.setContent("lose");
    next.getd = function(player, key, position) {
      if (!position) {
        position = ui.discardPile;
      }
      if (!key) {
        key = "cards";
      }
      if (this.getlx === false || this.position != position || player && this.player != player || !Array.isArray(this[key])) {
        return [];
      }
      return this[key].slice(0);
    };
    next.getl = function(player) {
      if (this.getlx !== false && this.player == player) {
        return this;
      }
      return {
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
    };
    next.getg = function(_player) {
      return [];
    };
    next.vcard_map = /* @__PURE__ */ new Map();
    return next;
  }
};
export {
  cardLoseAndDirectMethods
};
