import "../../../../../noname.js";
import { game } from "../../../../game/index.js";
import { get } from "../../../../get/binding.js";
import { ui } from "../../../../ui/index.js";
import { _status } from "../../../../status/index.js";
import { lib } from "../../../index.js";
const judgeAreaMethods = {
  /**
   * Execute the delay card effect
   *
   * 执行延时锦囊牌效果
   */
  executeDelayCardEffect(card, target, judge, judge2) {
    const executeDelayCardEffect = game.createEvent("executeDelayCardEffect");
    executeDelayCardEffect.player = this;
    executeDelayCardEffect.target = target || this;
    if (typeof card == "string") {
      const virtualCard = executeDelayCardEffect.card = ui.create.card();
      virtualCard._destroy = true;
      virtualCard.expired = true;
      const info = lib.card[card];
      virtualCard.init(["", "", card, info && info.cardnature]);
    } else if (get.itemtype(card) == "card") {
      executeDelayCardEffect.card = card;
    } else {
      _status.event.next.remove(executeDelayCardEffect);
      executeDelayCardEffect.resolve();
    }
    executeDelayCardEffect.judge = judge;
    executeDelayCardEffect.judge2 = judge2;
    executeDelayCardEffect.setContent("executeDelayCardEffect");
    executeDelayCardEffect._args = [...arguments];
    return executeDelayCardEffect;
  },
  /**
   * 判断判定区是否被废除
   */
  isDisabledJudge() {
    return Boolean(this.storage._disableJudge);
  },
  $disableJudge() {
    this.storage._disableJudge = true;
    for (let i = 0; i < this.node.judges.childNodes.length; i++) {
      if (this.node.judges.childNodes[i].classList.contains("feichu")) {
        return;
      }
    }
    game.addVideo("$disableJudge", this);
    const card = game.createCard("disable_judge", "", "");
    card.fix();
    card.classList.add("feichu");
    card.style.transform = "";
    card.classList.add("drawinghidden");
    this.node.judges.insertBefore(card, this.node.judges.firstChild);
    ui.updatej(this);
  },
  $enableJudge() {
    game.addVideo("$enableJudge", this);
    this.storage._disableJudge = false;
    for (let i = 0; i < this.node.judges.childNodes.length; i++) {
      if (this.node.judges.childNodes[i].name == "disable_judge") {
        this.node.judges.removeChild(this.node.judges.childNodes[i]);
        break;
      }
    }
  },
  disableJudge() {
    const next = game.createEvent("disableJudge");
    next.player = this;
    next.source = _status.event.player;
    next.setContent("disableJudge");
    return next;
  },
  enableJudge() {
    const next = game.createEvent("enableJudge");
    next.player = this;
    next.source = _status.event.player;
    next.setContent("enableJudge");
    return next;
  },
  /**
   * 将一些牌置入到玩家的判定区
   */
  addJudge(card, cards) {
    const next = game.createEvent("addJudge");
    const normalizedCard = typeof card == "string" ? { name: card } : card;
    if (normalizedCard instanceof lib.element.Card) {
      next.card = normalizedCard;
      if (normalizedCard.isViewAsCard) {
        const cardSymbol = normalizedCard.cardSymbol;
        const vcard = cardSymbol === void 0 ? get.autoViewAs(normalizedCard, void 0, false) : normalizedCard[cardSymbol];
        next.cards = vcard?.cards ?? [normalizedCard];
      } else {
        next.cards = [normalizedCard];
      }
    } else {
      const cardList = cards === void 0 && normalizedCard instanceof lib.element.VCard ? normalizedCard.cards ?? [] : cards == null ? [] : Array.isArray(cards) ? cards : [cards];
      const isPhysicalCard = (entry) => get.itemtype(entry) == "card";
      const physicalCards = cardList.filter(isPhysicalCard);
      next.cards = physicalCards;
      next.card = get.autoViewAs(normalizedCard, physicalCards);
    }
    next.player = this;
    next.setContent("addJudge");
    next.getd = function(player, key, position) {
      if (!position) {
        position = ui.discardPile;
      }
      if (!key) {
        key = "cards";
      }
      const cards2 = [], event = this;
      game.checkGlobalHistory("cardMove", function(evt) {
        if (evt.name != "lose" || evt.position != position || evt.getParent() != event) {
          return;
        }
        if (player && player != evt.player) {
          return;
        }
        cards2.addArray(evt[key]);
      });
      return cards2;
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
      player.checkAllHistory("lose", function(evt) {
        if (evt.parent == that) {
          map.hs.addArray(evt.hs);
          map.es.addArray(evt.es);
          map.js.addArray(evt.js);
          map.ss.addArray(evt.ss);
          map.xs.addArray(evt.xs);
          map.cards.addArray(evt.cards);
          map.cards2.addArray(evt.cards2);
          for (const key in evt.gaintag_map) {
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
      return [];
    };
    return next;
  },
  /**
   * 返回某些牌是否能进入玩家的判定区
   */
  canAddJudge(card, player) {
    if (this.isDisabledJudge()) {
      return false;
    }
    let name;
    if (typeof card == "string") {
      name = card;
    } else {
      name = card.viewAs || card.name;
    }
    if (!name) {
      return false;
    }
    const cardInfo = lib.card[name];
    if (!cardInfo) {
      return false;
    }
    if (!cardInfo.allowDuplicate && this.hasJudge(name)) {
      return false;
    }
    if (this.isOut()) {
      return false;
    }
    return true;
  },
  addJudgeNext(card, unlimited) {
    if (!card.expired) {
      const cards = get.itemtype(card) == "card" ? [card] : card.cards ?? [];
      if (!unlimited && cards.some((card2) => {
        const position = get.position(card2, true);
        return position != "j" && position != "o";
      })) {
        game.log(card, "已被移出处理区，无法置入判定区");
        return;
      }
      let target = this;
      do {
        target = target.getNext();
        if (!target) {
          target = this;
        }
        if (lib.filter.judge(card, target, target)) {
          break;
        }
        if (target == this) {
          target = null;
        }
      } while (target);
      if (target) {
        return target.addJudge(card, cards);
      }
    } else {
      card.expired = false;
    }
  },
  judge(params) {
    const next = game.createEvent("judge");
    next.player = this;
    const args = [...arguments];
    if (args.length === 1 && typeof params == "object" && params !== null && get.itemtype(params) == null) {
      Object.assign(next, params);
    } else {
      for (const arg of args) {
        if (get.itemtype(arg) == "card" || get.is.object(arg)) {
          next.card = arg;
        } else if (typeof arg == "string") {
          next.skill = arg;
        } else if (typeof arg == "function") {
          next.judge = arg;
        } else if (typeof arg == "boolean") {
          next.clearArena = arg;
        } else if (["div", "fragment"].includes(get.objtype(arg))) {
          next.position = arg;
        }
      }
    }
    if (next.card && next.judge == void 0) {
      next.judge = get.judge(next.card);
      next.judge2 ??= get.judge2(next.card);
    }
    if (next.judge == void 0) {
      next.judge = function() {
        return 0;
      };
    }
    if (next.position == void 0) {
      next.position = ui.discardPile;
    }
    if (next.card) {
      next.cardname = next.card.viewAs || next.card.name;
    }
    let str = "";
    if (next.card) {
      str = get.translation(next.card.viewAs || next.card.name);
    } else if (next.skill) {
      str = get.translation(next.skill);
    } else {
      str = get.translation(_status.event.name);
    }
    next.judgestr = str;
    next.setContent("judge");
    return next;
  },
  /**
   * 返回玩家判定区是否有某(种牌名的)牌
   */
  hasJudge(name) {
    const targetName = name && typeof name === "object" ? name.viewAs || name.name : name;
    const judges = this.getVCards("j");
    for (let i = 0; i < judges.length; i++) {
      if (judges[i].name === targetName) {
        return true;
      }
    }
    return false;
  },
  /**
   * 返回玩家判定区中的虚拟牌
   */
  getVJudge(name) {
    const judges = this.getVCards("j");
    for (let i = 0; i < judges.length; i++) {
      if (judges[i].name == name) {
        return judges[i];
      }
    }
    return null;
  },
  /**
   * 返回玩家判定区中的牌
   * @deprecated
   */
  getJudge(name) {
    const judges = this.getCards("j");
    for (let i = 0; i < judges.length; i++) {
      if ((judges[i].viewAs || judges[i].name) == name) {
        return judges[i];
      }
    }
    return null;
  }
};
export {
  judgeAreaMethods
};
