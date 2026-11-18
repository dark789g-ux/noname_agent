import "../../../../noname.js";
import "../../dependencies.js";
import { get } from "../../binding.js";
import { game } from "../../../game/index.js";
import { lib } from "../../../library/index.js";
import { ui } from "../../../ui/index.js";
import { _status } from "../../../status/index.js";
const cardSelectGroupMethods = {
  selectGroup(name, type) {
    if (get.itemtype(name) == "player") {
      name = name.name || name.name1;
    }
    const info = get.character(name);
    if (info.skills?.length) {
      const groups = [];
      for (const skill of info.skills) {
        const skillInfo = get.info(skill);
        if (typeof skillInfo.initGroup === "string") {
          groups.add(skillInfo.initGroup);
        }
      }
      if (groups.length) {
        if (type === true) {
          return "double";
        }
        return groups;
      }
    }
    if (Array.isArray(info.doubleGroup) && info.doubleGroup.length) {
      if (type === true) {
        return "double";
      }
      return info.doubleGroup.slice(0);
    }
    if (lib.selectGroup.includes(info.group) && get.config("choose_group", void 0) && !info.hasHiddenSkill) {
      if (type === true) {
        return "kami";
      }
      return lib.group.filter((group) => !lib.selectGroup.includes(group));
    }
    if (type === true) {
      return "default";
    }
    return [info.group];
  },
  types() {
    let types = [];
    for (let i in lib.card) {
      if (lib.card[i].mode && lib.card[i].mode.includes(lib.config.mode) == false) {
        continue;
      }
      if (lib.card[i].forbid && lib.card[i].forbid.includes(lib.config.mode)) {
        continue;
      }
      if (lib.card[i].type) {
        if (lib.card[i].type == "delay") {
          types.add("trick");
        } else {
          types.add(lib.card[i].type);
        }
      }
    }
    return types;
  },
  /**
   * 返回智囊牌名组成的数组
   * @param { Function | boolean } [filter]
   * @returns { String[] }
   */
  zhinangs(filter) {
    let list = (_status.connectMode ? lib.configOL : lib.config).zhinang_tricks;
    if (!list || !list.filter || !list.length) {
      return get.inpile("trick", "trick").randomGets(3);
    }
    if (filter === false) {
      return list.slice(0);
    }
    list = list.filter((card) => lib.inpile.includes(card));
    if (list.length) {
      return list;
    }
    return get.inpile("trick", "trick").randomGets(3);
  },
  /**
   * 获取牌堆底的牌
   * @param { number } [num = 1] 默认为1
   * @param { boolean } [putBack] 是否放回牌堆底
   * @returns { Card[] } 返回牌堆底的牌
   */
  bottomCards(num, putBack) {
    if (_status.waitingForCards) {
      ui.create.cards.apply(ui.create, _status.waitingForCards);
      delete _status.waitingForCards;
    }
    let list = [];
    if (typeof num != "number") {
      num = 1;
    }
    if (num <= 0) {
      return [];
    }
    while (num--) {
      if (ui.cardPile.hasChildNodes() == false) {
        game.washCard();
      }
      if (ui.cardPile.hasChildNodes() == false) {
        game.over("平局");
        return [];
      }
      const cardx = ui.cardPile.lastChild;
      if (!(cardx instanceof lib.element.Card)) {
        throw new TypeError("card pile contains a non-card node");
      }
      ui.cardPile.removeChild(cardx);
      cardx.original = "c";
      list.push(cardx);
    }
    if (putBack) {
      for (let i = list.length - 1; i >= 0; i--) {
        ui.cardPile.appendChild(list[i]);
      }
    }
    game.updateRoundNumber();
    return list;
  },
  /**
   * 返回本回合进入[过]弃牌堆的牌
   * @returns { Card[] }
   */
  discarded() {
    const cards = [];
    return game.getGlobalHistory("everything", (evt) => {
      if (!evt.cards?.length) {
        return false;
      }
      return evt.name === "cardsDiscard" || evt.position == ui.discardPile;
    }).reduce((cards2, evt) => {
      const movedCards = evt.cards;
      if (!movedCards) {
        throw new TypeError("Card-move history requires its cards");
      }
      return cards2.addArray(movedCards);
    }, cards);
  },
  cardOffset() {
    let x = ui.arena.getBoundingClientRect();
    let y = ui.window.getBoundingClientRect();
    return -y.width / 2 + (x.left + x.width / 2);
  },
  /**
   * 将一张牌或虚拟牌数据转为对应的虚拟牌。
   *
   * @param { Card | VCard | CardBaseUIData } card - 要转换的牌或虚拟牌数据
   * @param { Card[] | "unsure" } [cards] - 组成虚拟牌的实体牌，或为缺省牌面信息设置 unsure
   * @param { Player | false } [owner] - 获取牌面信息时参考的玩家
   * @returns { VCard } 转换后的虚拟牌；单参数传入VCard时直接返回原对象
   */
  autoViewAs(card, cards, owner) {
    if (arguments.length === 1 && card instanceof lib.element.VCard) {
      return card;
    }
    return new lib.element.VCard(card, cards, void 0, void 0, owner);
  },
  inpilefull(type) {
    let list = [];
    for (let i in lib.cardPile) {
      for (let j = 0; j < lib.cardPile[i].length; j++) {
        let info = lib.cardPile[i][j];
        if (lib.inpile.includes(info[2]) && get.type(info[2]) == type) {
          list.push({
            name: info[2],
            suit: info[0],
            number: info[1],
            nature: info[3]
          });
        }
      }
    }
    return list;
  },
  inpile(type, filter) {
    let i;
    let list = [];
    if (filter == "trick") {
      for (i = 0; i < lib.inpile.length; i++) {
        if (get.type(lib.inpile[i], "trick") == type) {
          list.push(lib.inpile[i]);
        }
      }
    } else {
      for (i = 0; i < lib.inpile.length; i++) {
        if (typeof type == "function") {
          if (type(lib.inpile[i])) {
            list.push(lib.inpile[i]);
          }
        } else {
          if (typeof filter == "function" && !filter(lib.inpile[i])) {
            continue;
          }
          if (type.startsWith("equip") && type.length == 6) {
            if (get.subtype(lib.inpile[i]) == type) {
              list.push(lib.inpile[i]);
            }
          } else {
            if (get.type(lib.inpile[i]) == type) {
              list.push(lib.inpile[i]);
            }
          }
        }
      }
    }
    return list;
  },
  inpile2(type) {
    return get.inpile(type, "trick");
  },
  typeCard(type, filter) {
    let list = [];
    for (let i in lib.card) {
      if (lib.card[i].mode && lib.card[i].mode.includes(get.mode()) == false) {
        continue;
      }
      if (lib.card[i].destroy) {
        continue;
      }
      if (typeof filter == "function" && !filter(i)) {
        continue;
      }
      if (lib.config.bannedcards.includes(i)) {
        continue;
      }
      if (!lib.translate[i + "_info"]) {
        continue;
      }
      if (type.startsWith("equip") && type.length == 6 || type.startsWith("hslingjian") && type.length == 11 || type.startsWith("spell_")) {
        if (get.subtype(i) == type) {
          list.push(i);
        }
      } else {
        if (get.type(i) == type) {
          list.push(i);
        }
      }
    }
    return list;
  },
  libCard(filter) {
    let list = [];
    for (let i in lib.card) {
      if (lib.card[i].mode && lib.card[i].mode.includes(get.mode()) == false) {
        continue;
      }
      if (lib.card[i].destroy) {
        continue;
      }
      if (lib.config.bannedcards.includes(i)) {
        continue;
      }
      if (!lib.translate[i + "_info"]) {
        continue;
      }
      if (filter(lib.card[i], i)) {
        list.push(i);
      }
    }
    return list;
  },
  /**
   * 返回牌的类型
   * @param { Card | VCard | CardBaseUIData | string | undefined } obj
   * @param { 'trick' | null} [method]
   * @param { Player | false } [player]
   * @returns { string | undefined }
   */
  type(obj, method, player) {
    if (typeof obj == "string") {
      obj = { name: obj };
    }
    if (typeof obj != "object") {
      return;
    }
    let name = get.name(obj, player);
    if (!lib.card[name]) {
      if (!name?.startsWith("sha_")) {
        return;
      }
      if (name.slice(4).split("_").every((n) => lib.nature.has(n))) {
        return lib.card["sha"].type;
      }
    }
    if (method == "trick" && lib.card[name].type == "delay") {
      return "trick";
    }
    return lib.card[name].type;
  },
  type2(card, player) {
    return get.type(card, "trick", player);
  },
  /**
   * 返回牌的副类型
   * @param { string | Card | VCard | CardBaseUIData | undefined } obj
   * @param { false | Player } [player]
   * @returns { string | undefined }
   */
  subtype(obj, player) {
    if (typeof obj == "string") {
      obj = { name: obj };
    }
    if (typeof obj != "object") {
      return;
    }
    const name = get.name(obj, player);
    if (!lib.card[name]) {
      return;
    }
    let subtype = lib.card[name].subtype;
    return subtype;
  },
  equiptype(card, player) {
    let subtype = get.subtype(card, player);
    if (typeof subtype == "string" && subtype.startsWith("equip")) {
      return parseInt(subtype[5]);
    }
    return 0;
  },
  /**
   * 返回牌的牌名
   * @param { Card | VCard | CardBaseUIData } card
   * @param { false | Player } [player]
   * @returns { string | undefined }
   */
  name(card, player) {
    if (get.itemtype(player) == "player" || player !== false && get.position(card, void 0) == "h") {
      let owner = player || get.owner(card);
      if (owner) {
        return game.checkMod(card, owner, card.name, "cardname", owner);
      }
    }
    return card.name;
  },
  /**
   * 返回牌的花色
   * @param {Card | VCard | CardBaseUIData | Card[] | VCard[] | CardBaseUIData[] | undefined} card
   * @param {false | Player} [player]
   * @returns {string | null | undefined}
   */
  suit(card, player) {
    if (typeof card !== "object") {
      return;
    }
    if (Array.isArray(card)) {
      if (card.length == 1) {
        return get.suit(card[0], player);
      }
      return "none";
    } else if (!("suit" in card) && "cards" in card && Array.isArray(card.cards)) {
      return get.suit(card.cards, player);
    } else {
      if (player !== false) {
        const owner = player || get.owner(card);
        if (owner) {
          return game.checkMod(card, owner, game.checkMod(card, card.suit, "suit", owner), "cardsuit", owner);
        }
      }
      if (card.suit === "unsure" || typeof card.suit == "string" && lib.suits.includes(card.suit)) {
        return card.suit;
      }
      return "none";
    }
  }
};
export {
  cardSelectGroupMethods
};
