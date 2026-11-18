import "../../../../noname.js";
import "../../dependencies.js";
import { lib } from "../../../library/index.js";
import { get } from "../../binding.js";
import { ui } from "../../../ui/index.js";
import { game } from "../../../game/index.js";
const cardAddNewRowListMethods = {
  /**
   * 将一组卡牌按花色或颜色分组，生成最终可用于dialog.addNewRow方法的参数列表，用于使用#Player.chooseButton/Player.chooseButtonTarget使用createDialog创建对话框的需要从一组卡牌中选择所有某种颜色/花色的牌的技能，用法可参考手杀曹髦/手杀陆郁生
   * @param {Card[]} cards 要分组的卡牌
   * @param {'suit'|'color'} type 分组类型 目前仅支持'suit'/'color'
   * @param {false | Player} player get.suit/get.color的player参数
   * @returns {Array<RuntimeRowItemOption | RuntimeRowItemOption[]>} 返回一个列表，每一项是一个分组配置（addNewRow方法的参数RowItem）或一对分组配置组成的数组
   */
  addNewRowList(cards, type = "suit", player = false) {
    function createCustom() {
      return function(itemContainer) {
        const { count, type: type2 } = this;
        let link;
        if (type2 === "suit") {
          link = this.suit;
        } else if (type2 === "color") {
          link = this.color;
        }
        const linkedContainer = Object.assign(itemContainer, { link });
        Object.setPrototypeOf(linkedContainer, lib.element.Button.prototype);
        linkedContainer.addEventListener(lib.config.touchscreen ? "touchend" : "click", ui.click.button);
        linkedContainer.closest(".dialog").buttons.add(linkedContainer);
        itemContainer.buttonid ??= get.id();
        function formatStr(str, type3) {
          if (type3 === "color") {
            return str.replace("红色", '<span style="color: red; ">$&</span>');
          }
          return str.replace(/(?:♥︎|♦︎)/g, '<span style="color: red; ">$&</span>');
        }
        let div = ui.create.div(itemContainer);
        const innerHTML = count ? formatStr(`${get.translation(link)}牌${count}张`, type2) : formatStr(`没有${get.translation(link)}牌`, type2);
        div.css({
          innerHTML,
          position: "absolute",
          width: "100%",
          bottom: "1%",
          height: "35%",
          background: "#352929bf",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "1.2em",
          zIndex: "2"
        });
      };
    }
    let itemContainerCss = {
      border: "solid #c6b3b3 2px",
      minHeight: "100px"
    };
    const groupCards = Object.groupBy(cards, (card) => {
      const key = get[type](card, player);
      return typeof key == "string" ? key : "none";
    });
    if (type == "suit") {
      groupCards.heart ??= [];
      groupCards.diamond ??= [];
      groupCards.spade ??= [];
      groupCards.club ??= [];
    } else if (type == "color") {
      groupCards.red ??= [];
      groupCards.black ??= [];
    }
    const keys = Object.keys(groupCards).sort((a, b) => {
      let arr = [];
      if (type == "suit") {
        arr = lib.suits.slice();
      } else if (type == "color") {
        arr = Object.keys(lib.color);
      }
      return arr.indexOf(a) - arr.indexOf(b);
    });
    const list = [];
    const createOption = (item, key, count) => {
      const base = { item, ItemNoclick: true, custom: createCustom(), itemContainerCss, count, type };
      return type == "suit" ? { ...base, suit: key } : { ...base, color: key };
    };
    while (keys.length) {
      let key1 = keys.shift();
      if (typeof key1 != "string") {
        break;
      }
      let cards1 = groupCards[key1];
      if (!cards1) {
        continue;
      }
      let key2 = keys.shift();
      let cards2 = key2 ? groupCards[key2] : void 0;
      if (key2 && cards2) {
        list.push([createOption(cards1, key1, cards1.length), createOption(cards2, key2, cards2.length)]);
      } else {
        list.push(createOption(cards1, key1, cards1.length));
      }
    }
    return list;
  },
  /**
   * 获取牌的牌面信息
   * @param { Card | VCard | (CardBaseUIData & { name: string }) } node
   * @param { Player } player
   * @returns { string }
   */
  cardDescription(node, player) {
    let str = "", name = node.name;
    if (lib.translate[name + "_info"]) {
      if (lib.card[name].type && lib.translate[lib.card[name].type]) {
        str += "" + get.translation(lib.card[name].type) + "牌|";
      }
      if (get.subtype(name)) {
        str += "" + get.translation(get.subtype(name)) + "|";
      }
      if (lib.card[name] && lib.card[name].addinfomenu) {
        str += "" + lib.card[name].addinfomenu + "|";
      }
      if (get.subtype(name) == "equip1") {
        let added = false;
        if (lib.card[node.name] && lib.card[node.name].distance) {
          const dist = lib.card[node.name].distance;
          if (dist.attackFrom) {
            added = true;
            str += "攻击范围：" + (-dist.attackFrom + 1) + "|";
          }
        }
        if (!added) {
          str += "攻击范围：1|";
        }
      }
    }
    if (lib.card[name].cardPrompt) {
      str += "" + lib.card[name].cardPrompt(node, player) + "|";
    } else if (lib.translate[name + "_info"]) {
      str += "" + lib.translate[name + "_info"] + "|";
    }
    if (lib.translate[name + "_append"]) {
      str += "" + lib.translate[name + "_append"] + "|";
    }
    if (get.is.yingbianConditional(node)) {
      const yingbianEffects = get.yingbianEffects(node);
      if (!yingbianEffects.length) {
        const defaultYingbianEffect = get.defaultYingbianEffect(node);
        if (lib.yingbian.prompt.has(defaultYingbianEffect)) {
          yingbianEffects.push(defaultYingbianEffect);
        }
      }
      if (yingbianEffects.length) {
        str += `应变：${yingbianEffects.map((value) => lib.yingbian.prompt.get(value)).join("；")}|`;
      }
    }
    return str;
  },
  /**
   * 从指定区域获得一张牌
   *
   * @param { string | true | Record<string, any> | ((card: Card) => boolean) } pattern - 筛选条件，可以是牌名、属性对象或过滤函数；若为`true`，则表示任意一张牌
   * @param { boolean | "cardPile" | "discardPile" | "field" } [position] - 筛选区域，默认牌堆+弃牌堆：
   *
   * - cardPile: 仅牌堆
   * - discardPile: 仅弃牌堆
   * - field: 牌堆+弃牌堆+场上
   *
   * > 若为true且name为`string | VCard`类型，则在筛选区域内没有找到卡牌时创建一张`name`条件的牌
   *
   * @param { "top" | "bottom" | "random" } [start] - 遍历方式。默认top
   *
   * - top: 从牌堆/弃牌堆顶自顶向下遍历
   * - bottom: 从牌堆/弃牌堆底自底向上遍历
   * - random: 随机位置遍历
   *
   * @returns { Card | null }
   */
  cardPile(pattern, position, start = "top") {
    let filter;
    let create = false;
    let filtering = true;
    if (pattern === true) {
      filtering = false;
    } else if (typeof pattern === "function") {
      filter = pattern;
    } else if (pattern) {
      if (typeof pattern === "string") {
        filter = (card) => card.name === pattern;
      } else {
        const entries = [];
        for (const key in pattern) {
          const filterVal = pattern[key];
          entries.push({
            key,
            filterVal,
            isArray: Array.isArray(filterVal)
          });
        }
        filter = (card) => {
          for (const { key, filterVal, isArray } of entries) {
            const value = card[key];
            if (!value) {
              continue;
            }
            if (!isArray && value !== filterVal || isArray && !filterVal.includes(value)) {
              return false;
            }
          }
          return true;
        };
      }
      if (position === true) {
        create = true;
      }
    } else {
      console.error("调用get.cardPile()时未传入符合条件的参数name！");
      return null;
    }
    const matches = (card) => !filtering || filter(card);
    const findInPile = (pile, reverse = false) => {
      const nodes = pile.childNodes;
      const length = nodes.length;
      if (!length) {
        return null;
      }
      if (reverse) {
        let index2 = length;
        while (index2--) {
          const card = nodes[index2];
          if (matches(card)) {
            return card;
          }
        }
        return null;
      }
      let index = start === "random" ? get.rand(0, length - 1) : 0;
      let count = 0;
      while (count < length) {
        const card = nodes[index];
        if (matches(card)) {
          return card;
        }
        count++;
        index++;
        if (index === length) {
          index = 0;
        }
      }
      return null;
    };
    if (start === "bottom") {
      if (position !== "cardPile") {
        const card = findInPile(ui.discardPile, true);
        if (card) {
          return card;
        }
      }
      if (position !== "discardPile") {
        const card = findInPile(ui.cardPile, true);
        if (card) {
          return card;
        }
      }
      if (position === "field") {
        for (const current of game.filterPlayer().reverse()) {
          for (const card of reversedFieldCards(current)) {
            if (matches(card)) {
              return card;
            }
          }
        }
      }
      if (create) {
        return game.createCard(pattern);
      }
      return null;
    }
    if (position !== "discardPile") {
      const card = findInPile(ui.cardPile);
      if (card) {
        return card;
      }
    }
    if (position !== "cardPile") {
      const card = findInPile(ui.discardPile);
      if (card) {
        return card;
      }
    }
    if (position === "field") {
      for (const current of game.filterPlayer()) {
        for (const card of current.iterableGetCards("ej")) {
          if (matches(card)) {
            return card;
          }
        }
      }
    }
    if (create) {
      return game.createCard(pattern);
    }
    return null;
    function* reversedFieldCards(player) {
      const judges = player.node.judges.childNodes;
      let index = judges.length;
      while (index--) {
        const card = judges[index];
        if (card.classList.contains("removing") || card.classList.contains("feichu")) {
          continue;
        }
        yield card;
      }
      const equips = player.node.equips.childNodes;
      index = equips.length;
      while (index--) {
        const card = equips[index];
        if (card.classList.contains("removing") || card.classList.contains("feichu") || card.classList.contains("emptyequip")) {
          continue;
        }
        yield card;
      }
    }
  },
  /**
   * 从牌堆获得一张牌
   *
   * @param { string | true | Record<string, any> | ((card: Card) => boolean) } pattern - 筛选条件，可以是牌名、属性对象或过滤函数；若为`true`，则表示任意一张牌
   * @param { "top" | "bottom" | "random" } [start] - 遍历方式。默认top
   *
   * - top: 从牌堆/弃牌堆顶自顶向下遍历
   * - bottom: 从牌堆/弃牌堆底自底向上遍历
   * - random: 随机位置遍历
   *
   * @returns { Card | null }
   */
  cardPile2(pattern, start) {
    return get.cardPile(pattern, "cardPile", start || "top");
  },
  /**
   * 从弃牌堆获得一张牌
   *
   * @param { string | true | Record<string, any> | ((card: Card) => boolean) } pattern - 筛选条件，可以是牌名、属性对象或过滤函数；若为`true`，则表示任意一张牌
   * @param { "top" | "bottom" | "random" } [start] - 遍历方式。默认top
   *
   * - top: 从牌堆/弃牌堆顶自顶向下遍历
   * - bottom: 从牌堆/弃牌堆底自底向上遍历
   * - random: 随机位置遍历
   *
   * @returns { Card | null }
   */
  discardPile(pattern, start) {
    return get.cardPile(pattern, "discardPile", start || "top");
  },
  /**
   * 返回牌名“【XXX】”形式的数组
   * @param { Function } [filter]
   * @returns { string[] }
   */
  cardTranslation(filter = lib.filter.all) {
    let list = [];
    if (get["#cardTranslation"]) {
      list = get["#cardTranslation"];
    } else {
      for (const key in lib.cardPack) {
        list.addArray(lib.cardPack[key]);
      }
      get["#cardTranslation"] = list;
    }
    return list.filter(filter).map((c) => `【${get.translation(c)}】`);
  }
};
export {
  cardAddNewRowListMethods
};
