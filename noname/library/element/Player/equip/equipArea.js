import "../../../../../noname.js";
import { get } from "../../../../get/binding.js";
import { game } from "../../../../game/index.js";
import { lib } from "../../../index.js";
import { _status } from "../../../../status/index.js";
import { ui } from "../../../../ui/index.js";
const equipAreaMethods = {
  /**
   * 获取一名角色装备区内某种类型的装备牌
   *
   * 参数可以为数字/区域字符串/实体牌/虚拟牌/牌名
   */
  getEquips(subtype) {
    const VEquips = this.getVEquips(subtype);
    return VEquips.reduce((cards, vcard) => {
      cards.addArray(vcard.cards || []);
      return cards;
    }, []);
  },
  /**
   * 获取一名角色装备区内某种类型的虚拟牌
   *
   * 参数可以为数字/区域字符串/实体牌/虚拟牌/牌名
   */
  getVEquips(subtype) {
    let normalizedSubtype;
    switch (typeof subtype) {
      case "string":
        normalizedSubtype = subtype;
        if (subtype == "equip3_4") {
          const cards = [];
          cards.addArray(this.getVEquips(3));
          cards.addArray(this.getVEquips(4));
          return cards;
        } else if (subtype.startsWith("equip") && parseInt(subtype.slice(5)) > 0) {
          break;
        } else if (lib.card[subtype]) {
          return this.getVCards("e", (card) => card.name == subtype);
        } else {
          return [];
        }
      case "number":
        normalizedSubtype = "equip" + subtype;
        break;
      case "object":
        normalizedSubtype = get.subtype(subtype, false);
        break;
      default:
        return [];
    }
    if (!normalizedSubtype) {
      return [];
    }
    return this.getVCards("e", (card) => {
      return get.subtypes(card, false).includes(normalizedSubtype);
    });
  },
  /**
   * 判断角色是否能够装备指定的牌
   */
  canEquip(name, replace) {
    const ranges = get.subtypes(name), rangex = [], combined = get.is.mountCombined();
    if (combined) {
      ranges.forEach((type) => {
        if (type == "equip3" || type == "equip4") {
          rangex.add("equip3_4");
        } else {
          rangex.add(type);
        }
      });
    } else {
      rangex.push(...new Set(ranges));
    }
    if (name instanceof lib.element.Card) {
      const owner = get.owner(name, "judge");
      if (owner && !lib.filter.canBeGained(name, this, owner)) {
        return false;
      }
    }
    for (const range of rangex) {
      let num = this.countEquipableSlot(range);
      const num2 = get.numOf(rangex, range);
      if (!replace) {
        num -= this.getVEquips(range).filter((card) => lib.filter.canBeReplaced(card, this)).length;
      }
      if (num < num2) {
        return false;
      }
    }
    return true;
  },
  /**
   * 与target交换装备区里的牌
   */
  swapEquip(target) {
    const next = game.createEvent("swapEquip");
    next.player = this;
    next.target = target;
    next.setContent("swapEquip");
    return next;
  },
  equip(card, draw) {
    const next = game.createEvent("equip");
    next.player = this;
    next.setContent(lib.element.content.equip);
    const itemtype = get.itemtype(card);
    if (itemtype === "card") {
      next.cards = [card];
    } else {
      next.cards = card?.cards || [];
    }
    if ("isViewAsCard" in card && card.isViewAsCard && card.cardSymbol !== void 0) {
      next.card = card;
      next.cards = card[card.cardSymbol].cards;
      next.vcard = card[card.cardSymbol];
    } else {
      next.card = card;
    }
    if (draw) {
      next.draw = true;
    }
    if (next.cards.length > 1 && next.cards.some((cardx) => cardx.isViewAsCard) || !next.card.name) {
      _status.event.next.remove(next);
      next.resolve();
    }
    next.getd = function(player, key, position) {
      if (!position) {
        position = ui.discardPile;
      }
      if (!key) {
        key = "cards";
      }
      const cards = [], event = this;
      game.checkGlobalHistory("cardMove", function(evt) {
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
  getVEquip(name) {
    const es = this.getVCards("e");
    let target;
    if (typeof name == "object" && name !== null && get.info(name)) {
      const subtype = get.info(name).subtype;
      if (subtype) {
        target = parseInt(subtype[5]);
      }
    } else if (typeof name == "string" && name.startsWith("equip") && name.length == 6) {
      target = parseInt(name[5]);
    } else if (typeof name == "number" || typeof name == "string") {
      target = name;
    }
    if (!target) {
      return null;
    }
    for (let i = 0; i < es.length; i++) {
      if (typeof target === "number") {
        if (get.info(es[i]).subtype === "equip" + target) {
          return es[i];
        }
      } else {
        if (es[i].name === target) {
          return es[i];
        }
        const source = get.info(es[i]).source;
        if (Array.isArray(source) && source.includes(target)) {
          return es[i];
        }
      }
    }
    return null;
  },
  getEquip(name) {
    const es = this.getCards("e");
    let target;
    if (typeof name == "object" && name !== null && get.info(name)) {
      const subtype = get.info(name).subtype;
      if (subtype) {
        target = parseInt(subtype[5]);
      }
    } else if (typeof name == "string" && name.startsWith("equip") && name.length == 6) {
      target = parseInt(name[5]);
    } else if (typeof name == "number" || typeof name == "string") {
      target = name;
    }
    if (!target) {
      return null;
    }
    for (let i = 0; i < es.length; i++) {
      if (typeof target === "number") {
        if (get.info(es[i]).subtype === "equip" + target) {
          return es[i];
        }
      } else {
        if (es[i].name === target) {
          return es[i];
        }
        const source = get.info(es[i]).source;
        if (Array.isArray(source) && source.includes(target)) {
          return es[i];
        }
      }
    }
    return null;
  }
};
export {
  equipAreaMethods
};
