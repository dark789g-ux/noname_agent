import "../../../noname.js";
import { GeneratorFunction, AsyncFunction } from "../../util/index.js";
import "../../library/skillRegistry.js";
import { get } from "../binding.js";
import { _status } from "../../status/index.js";
import { lib } from "../../library/index.js";
const cardAndContentPredicates = {
  /**
   * 检查对象的某个属性是否是content*(){}/async content(){}/content(){}中的特定形式
   * @param {{[key: string]: any}} obj 目标对象
   * @param {string} key 属性名
   * @returns {boolean} 如果属性值是上述形式的函数定义，则返回true
   */
  functionMethod(obj, key) {
    const value = obj[key];
    if (!(typeof value === "function")) {
      return false;
    }
    key = key.replaceAll("$", "\\$");
    let reg;
    if (value instanceof GeneratorFunction) {
      reg = new RegExp(`\\*\\s*${key}[\\s\\S]*?\\(`);
    } else if (value instanceof AsyncFunction) {
      reg = new RegExp(`async\\s*${key}[\\s\\S]*?\\(`);
    } else {
      reg = new RegExp(`${key}[\\s\\S]*?\\(`);
    }
    return reg.exec(value)?.index === 0;
  },
  /**
   * @param { string } str
   * @returns
   */
  emotion(str) {
    let regExp = /^<img\b(?=[^>]*\bsrc="##assetURL##image\/emotion\/([^"/]+)\/([^"/]+)\.gif")(?=[^>]*\bwidth="50")(?=[^>]*\bheight="50")(?!.*\b(?!src|width|height)\w+=)[^>]*\/?>$/i;
    return regExp.test(str);
  },
  /**
   * 判断是否为进攻坐骑
   * @param { Card | VCard } card
   * @param { false | Player } [player]
   * @returns { boolean }
   */
  attackingMount(card, player) {
    const subtype = get.subtype(card, player);
    if (subtype == "equip4") {
      return true;
    } else if (subtype == "equip6") {
      const subtypes = get.subtypes(card, player);
      if (subtypes.includes("equip4")) {
        return true;
      }
      const info = get.info(card, player), distance = info.distance;
      if (!distance) {
        return false;
      }
      if (distance.globalFrom && !info.notMount) {
        return true;
      }
    }
    return false;
  },
  /**
   * 判断是否为防御坐骑
   * @param { Card | VCard } card
   * @param { false | Player } [player]
   * @returns { boolean }
   */
  defendingMount(card, player) {
    const subtype = get.subtype(card, player);
    if (subtype == "equip3") {
      return true;
    } else if (subtype == "equip6") {
      const subtypes = get.subtypes(card, player);
      if (subtypes.includes("equip3")) {
        return true;
      }
      const info = get.info(card, player), distance = info.distance;
      if (!distance) {
        return false;
      }
      if (distance.globalTo && !info.notMount) {
        return true;
      }
    }
    return false;
  },
  /**
   * 判断坐骑栏是否被合并
   * @returns { boolean }
   */
  mountCombined() {
    if (lib.configOL.mount_combine) {
      return lib.configOL.mount_combine;
    } else if (typeof _status.mountCombined != "boolean") {
      _status.mountCombined = lib.config.mount_combine ?? false;
    }
    return _status.mountCombined ?? false;
  },
  /**
   * 判断传入的参数的属性是否相同（参数可以为卡牌、卡牌信息、属性等）
   * @param {...(Card | VCard | CardBaseUIData | string | Array<Card | VCard | CardBaseUIData | string | null | undefined> | boolean | null | undefined)} arguments 要判断的属性列表和是否逐项比较的控制参数
   */
  sameNature() {
    let processedArguments = [], every = false;
    Array.from(arguments).forEach((argument) => {
      if (typeof argument == "boolean") {
        every = argument;
      } else if (argument) {
        processedArguments.push(argument);
      }
    });
    if (!processedArguments.length) {
      return true;
    }
    if (processedArguments.length == 1) {
      const argument = processedArguments[0];
      if (!Array.isArray(argument)) {
        return false;
      }
      if (!argument.length) {
        return true;
      }
      if (argument.length == 1) {
        return false;
      }
      processedArguments = argument;
    }
    const naturesList = processedArguments.map((card) => {
      if (typeof card == "string") {
        return card.split(lib.natureSeparator);
      } else if (Array.isArray(card)) {
        return card;
      }
      return get.natureList(card || {});
    });
    const testingNaturesList = naturesList.slice(0, naturesList.length - 1);
    if (every) {
      return testingNaturesList.every((natures, index) => naturesList.slice(index + 1).every((testingNatures) => testingNatures.length == natures.length && testingNatures.every((nature) => natures.includes(nature))));
    }
    return testingNaturesList.every((natures, index) => {
      const comparingNaturesList = naturesList.slice(index + 1);
      if (natures.length) {
        return natures.some((nature) => comparingNaturesList.every((testingNatures) => testingNatures.includes(nature)));
      }
      return comparingNaturesList.every((testingNatures) => !testingNatures.length);
    });
  },
  /**
   * 判断传入的参数的属性是否不同（参数可以为卡牌、卡牌信息、属性等）
   * @param {...(Card | VCard | CardBaseUIData | string | Array<Card | VCard | CardBaseUIData | string> | boolean)} arguments 要判断的属性列表和是否逐项比较的控制参数
   */
  differentNature() {
    let processedArguments = [], every = false;
    Array.from(arguments).forEach((argument) => {
      if (typeof argument == "boolean") {
        every = argument;
      } else if (argument) {
        processedArguments.push(argument);
      }
    });
    if (!processedArguments.length) {
      return false;
    }
    if (processedArguments.length == 1) {
      const argument = processedArguments[0];
      if (!Array.isArray(argument)) {
        return true;
      }
      if (!argument.length) {
        return false;
      }
      if (argument.length == 1) {
        return true;
      }
      processedArguments = argument;
    }
    const naturesList = processedArguments.map((card) => {
      if (typeof card == "string") {
        return card.split(lib.natureSeparator);
      } else if (Array.isArray(card)) {
        return card;
      }
      return get.natureList(card || {});
    });
    const testingNaturesList = naturesList.slice(0, naturesList.length - 1);
    if (every) {
      return testingNaturesList.every((natures, index) => naturesList.slice(index + 1).every((testingNatures) => testingNatures.every((nature) => !natures.includes(nature))));
    }
    return testingNaturesList.every((natures, index) => {
      const comparingNaturesList = naturesList.slice(index + 1);
      if (natures.length) {
        return natures.some((nature) => comparingNaturesList.every((testingNatures) => !testingNatures.length || testingNatures.some((testingNature) => testingNature != nature)));
      }
      return comparingNaturesList.every((testingNatures) => testingNatures.length);
    });
  },
  /**
   * 判断一张牌是否为连接手牌
   * @param { Card } card
   */
  connectedCard(card) {
    return _status.sxrmConnectCards?.includes(card);
  },
  /**
   * 判断一张牌是否为明置手牌
   * @param { Card } card
   */
  shownCard(card) {
    if (!card) {
      return false;
    }
    const gaintag = card.gaintag;
    return Array.isArray(gaintag) && gaintag.some((tag) => {
      if (tag.startsWith("eternal_")) {
        return tag.slice(8).startsWith("visible_");
      }
      return tag.startsWith("visible_");
    });
  },
  /**
   * 是否是伤害牌
   * @param { Card | VCard } card
   * @param { boolean } [includeDelay=false] 是否包含延时锦囊，默认排除
   * @returns { boolean } 是否是伤害牌
   */
  damageCard(card, includeDelay = false) {
    if (!get.tag(card, "damage")) {
      return false;
    }
    if (!includeDelay && get.type(card) === "delay") {
      return false;
    }
    return true;
  },
  /**
   * 是否是虚拟牌
   * @param { Card | VCard } card
   */
  virtualCard(card) {
    return !("cards" in card) || !Array.isArray(card.cards) || card.cards.length === 0;
  },
  /**
   * 是否是转化牌
   * @param { Card | VCard } card
   */
  convertedCard(card) {
    return !card.isCard && "cards" in card && Array.isArray(card.cards) && card.cards.length > 0;
  },
  /**
   * 是否是实体牌
   * @param { Card | VCard } card
   */
  ordinaryCard(card) {
    return card.isCard && "cards" in card && Array.isArray(card.cards) && card.cards.length === 1;
  }
};
export {
  cardAndContentPredicates
};
