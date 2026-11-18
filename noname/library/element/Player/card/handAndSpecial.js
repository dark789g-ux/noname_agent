import "../../../../../noname.js";
import "../contracts/cardContract.js";
import { lib } from "../../../index.js";
import { game } from "../../../../game/index.js";
import { get } from "../../../../get/binding.js";
import { ui } from "../../../../ui/index.js";
import { _status } from "../../../../status/index.js";
const cardHandAndSpecialMethods = {
  sortHandcard(sort) {
    if (this.hasSkillTag("noSortCard")) {
      return false;
    }
    const hs = this.getCards("h").slice();
    if (!hs.length) {
      return false;
    }
    const cards1 = [];
    const cards2 = !get.is.singleHandcard() ? [] : null;
    if (typeof sort == "function") {
      Reflect.apply(hs.sort, hs, [sort]);
    } else if (Array.isArray(sort)) {
      hs.sort((a, b) => sort.indexOf(a) - sort.indexOf(b));
    } else if (this.hasSkillTag("sortCardByNum")) {
      const getn = (card) => {
        const num = get.number(card, this);
        if (typeof num != "number") {
          return NaN;
        }
        if (num < 3) {
          return 13 + num;
        }
        return num;
      };
      hs.sort((a, b) => getn(b) - getn(a));
    } else {
      hs.sort(function(b, a) {
        if (a.name != b.name) {
          return lib.sort.card(a.name, b.name);
        } else if (a.suit != b.suit) {
          const suitA = typeof a.suit == "string" ? a.suit : "";
          const suitB = typeof b.suit == "string" ? b.suit : "";
          return lib.suit.indexOf(suitA) - lib.suit.indexOf(suitB);
        } else {
          return typeof a.number == "number" && typeof b.number == "number" ? a.number - b.number : NaN;
        }
      });
    }
    if (this.getCards("h").every((card, index) => hs[index] == card)) {
      return false;
    }
    this.node.handcards1.style.visibility = "hidden";
    this.node.handcards2.style.visibility = "hidden";
    hs.forEach((card) => {
      const sortVal = lib.config.sort_card(card);
      if (sortVal < 0 && cards2) {
        cards2.unshift(card);
      } else {
        cards1.unshift(card);
      }
    });
    this.node.handcards1.prepend(...cards1);
    if (cards2) {
      this.node.handcards2.prepend(...cards2);
    }
    this.node.handcards1.style.visibility = "visible";
    this.node.handcards2.style.visibility = "visible";
    if (this == game.me) {
      ui.updatehl();
    }
  },
  sortHandcardOL(sort) {
    const bool = this.sortHandcard(sort);
    if (_status.connectMode && bool !== false) {
      if (game.online) {
        game.send(
          "syncHandcard",
          this.getCards("h").map((i) => i.cardid).filter((id) => typeof id == "string")
        );
      } else {
        game.syncHandcard(
          this,
          this.getCards("h").map((i) => i.cardid).filter((id) => typeof id == "string")
        );
      }
    }
  },
  canIgnoreHandcard(card) {
    return lib.filter.ignoredHandcard(card, this);
  },
  gift(cards, target) {
    const next = game.createEvent("gift");
    next.player = this;
    next.target = target;
    const isArray = Array.isArray(cards);
    if (cards && !isArray) {
      next.cards = [cards];
    } else if (isArray && cards.length) {
      next.cards = cards;
    } else {
      _status.event.next.remove(next);
      next.resolve();
    }
    next.deniedGifts = [];
    next.setContent("gift");
    next._args = [...arguments];
    return next;
  },
  canGift(card, target, strict) {
    return lib.filter.cardGiftable(card, this, target, strict);
  },
  refuseGifts(card, player) {
    return this.hasSkillTag("refuseGifts", null, {
      player,
      card
    });
  },
  getGiftAIResultTarget(card, target) {
    if (!card || !this.canGift(card, target, true) || target.refuseGifts(card, this)) {
      return 0;
    }
    if (get.type(card, null, target) == "equip") {
      let eff = get.effect(target, card, target, target);
      const att = get.sgnAttitude(this, target);
      if (att < 0) {
        if (eff == 0) {
          eff -= 0.1;
        }
        if (target.canEquip(card)) {
          eff--;
        }
      } else {
        if (att > 0 && target.canEquip(card) && eff > 0) {
          eff++;
        }
      }
      return eff;
    }
    if (card.name == "du") {
      if (["usedu", "keepdu"].some((tag) => this.hasSkillTag(tag))) {
        return 0;
      }
      const att = get.sgnAttitude(this, target);
      if (this.hasSkillTag("nodu")) {
        if (["usedu", "keepdu"].some((tag) => target.hasSkillTag(tag))) {
          return get.attitude(this, target) - 0.01;
        }
        return -att * Math.max(1, 4 - target.getHp());
      }
      if (get.effect(this, { name: "losehp" }, this, this) > 0) {
        return -att * Math.max(1, 4 - target.getHp());
      }
      return this.getHp() > target.getHp() ? -1 : 0;
    }
    if (target.hasSkillTag("nogain")) {
      return 0;
    }
    return Math.max(1, get.value(card, this) - get.value(card, target));
  },
  getGiftEffect(card, target) {
    return this.getGiftAIResultTarget(card, target) * get.attitude(this, target);
  },
  recast(cards, recastingLose, recastingGain) {
    const recast = game.createEvent("recast");
    recast.player = this;
    const isArray = Array.isArray(cards);
    if (cards && !isArray) {
      recast.cards = [cards];
    } else if (isArray && cards.length) {
      recast.cards = cards;
    } else {
      _status.event.next.remove(recast);
      recast.resolve();
    }
    if (typeof recastingLose != "function") {
      if (recastingLose === null) {
        console.trace(`recast的recastingLose参数不应传入null,可以用void 0或undefined占位`);
      }
      recastingLose = (player, cards2) => {
        const next = player.loseToDiscardpile(cards2);
        next.log = false;
        return next;
      };
    }
    recast.recastingLose = recastingLose;
    recast.recastingLosingEvents = [];
    if (typeof recastingGain != "function") {
      if (recastingLose === null) {
        console.trace(`recast的recastingGain参数不应传入null,可以用void 0或undefined占位`);
      }
      recastingGain = (player, cards2) => {
        const next = player.draw(cards2.length);
        next.log = false;
        return next;
      };
    }
    recast.recastingGain = recastingGain;
    recast.recastingGainingEvents = [];
    recast.setContent("recast");
    recast._args = [...arguments];
    return recast;
  },
  canRecast(card, source, strict) {
    return lib.filter.cardRecastable(card, this, source ?? void 0, strict);
  },
  loseToSpecial(cards, tag, target) {
    const next = game.loseAsync({
      player: this,
      cards,
      tag,
      toStorage: true,
      target: target || this
    });
    next.setContent(async function(event, trigger, player) {
      const specialEvent = event;
      if (!player) {
        return;
      }
      await player.lose(specialEvent.cards, ui.special).set("getlx", false);
      let cards2 = specialEvent.cards.slice();
      cards2.removeArray(player.getCards("hejsx"));
      if (cards2.length) {
        specialEvent.target.directgains(cards2, null, specialEvent.tag);
      }
    });
    return next;
  },
  addGaintag(cards, tag) {
    const cardArr = Array.isArray(cards) ? cards : [cards];
    game.addVideo("addGaintag", this, [get.cardsInfo(cardArr), tag]);
    game.broadcastAll(
      function(player, cards2, tag2) {
        const hs = player.getCards("hejsx");
        for (const i of cards2) {
          if (hs.includes(i)) {
            i.addGaintag(tag2);
          }
        }
      },
      this,
      cardArr,
      tag
    );
  },
  removeGaintag(tag, cards) {
    let cardArr;
    if (Array.isArray(cards)) {
      cardArr = cards;
    } else if (cards) {
      cardArr = [cards];
    } else {
      cardArr = this.getCards("h");
    }
    game.addVideo("removeGaintag", this, [tag, get.cardsInfo(cardArr)]);
    game.broadcastAll(
      function(player, tag2, cards2) {
        for (const i of cards2) {
          i.removeGaintag(tag2);
        }
      },
      this,
      tag,
      cardArr
    );
  },
  getExpansions(tag) {
    return this.getCards("x", (card) => card.hasGaintag(tag));
  },
  countExpansions(tag) {
    return this.countCards("x", (card) => card.hasGaintag(tag));
  },
  hasExpansions(tag) {
    return this.hasCards("x", (card) => card.hasGaintag(tag));
  },
  getHandcardLimit() {
    let num = Math.max(Number(this.hp), 0);
    num = game.checkMod(this, num, "maxHandcardBase", this);
    num = game.checkMod(this, num, "maxHandcard", this);
    num = game.checkMod(this, num, "maxHandcardFinal", this);
    return Math.max(0, num);
  },
  needsToDiscard(add, filter, pure) {
    let cards = this.getCards("h"), num = 0;
    if (typeof add === "number") {
      num = add;
    } else if (Array.isArray(add) && add.every((card) => card instanceof lib.element.Card)) {
      cards.addArray(add);
    } else if (add instanceof lib.element.Card) {
      cards.push(add);
    }
    const activeFilter = typeof filter === "function" ? filter : (card, player) => !player.canIgnoreHandcard(card);
    cards = cards.filter((card) => {
      return activeFilter(card, this, cards);
    });
    num += cards.length - this.getHandcardLimit();
    if (pure) {
      return num;
    }
    return Math.max(0, num);
  }
};
export {
  cardHandAndSpecialMethods
};
