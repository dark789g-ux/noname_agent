import "../../../noname.js";
import { game } from "../index.js";
import { lib } from "../../library/index.js";
import { ui } from "../../ui/index.js";
import { _status } from "../../status/index.js";
import { get } from "../../get/binding.js";
const rulesAndNatureMethods = {
  //Stratagem
  //谋攻
  setStratagemBuffCost(cardName, cost) {
    return game.broadcastAll((clientCardName, clientCost) => lib.stratagemBuff.cost.set(clientCardName, clientCost), cardName, cost);
  },
  setStratagemBuffEffect(cardName, effect) {
    return game.broadcastAll((clientCardName, clientEffect) => lib.stratagemBuff.cost.set(clientCardName, clientEffect), cardName, effect);
  },
  setStratagemBuffPrompt(cardName, prompt) {
    return game.broadcastAll((clientCardName, clientPrompt) => lib.stratagemBuff.cost.set(clientCardName, clientPrompt), cardName, prompt);
  },
  /**
   * 添加游戏内生成使用的临时tag
   */
  addTempTag(id, translation) {
    game.addVideo("addTempTag", null, [id, translation]);
    game.broadcastAll(
      (id2, translation2) => {
        if (!lib.translate[id2]) {
          lib.translate[id2] = translation2;
          _status.postReconnect.addTempTag ??= [
            (list) => {
              for (const args of list) {
                game.addTempTag(...args);
              }
            },
            []
          ];
          _status.postReconnect.addTempTag[1].push([id2, translation2]);
        }
      },
      id,
      translation
    );
    return id;
  },
  /**
   * 添加新的属性杀
   */
  addNature(nature, translation, config) {
    if (!nature) {
      throw new TypeError();
    }
    if (translation && translation.length) {
      lib.translate["nature_" + nature] = translation;
    }
    game.callHook("addNature", [nature, translation, config]);
    return nature;
  },
  /**
   * 判断卡牌信息/事件是否有某个属性
   */
  hasNature(item, nature, player) {
    const natures = get.natureList(item, player);
    if (!nature) {
      return natures.length > 0;
    }
    if (nature == "linked") {
      return natures.some((n) => lib.linked.includes(n));
    }
    return get.is.sameNature(natures, nature);
  },
  /**
   * 设置卡牌信息/事件的属性
   */
  setNature(item, nature, addNature) {
    if (!nature) {
      nature = [];
    }
    if (!addNature) {
      item.nature = get.nature(nature);
      if (!item.nature.length) {
        delete item.nature;
      }
    } else {
      const natures = Array.isArray(nature) ? nature : nature.split(lib.natureSeparator);
      const _nature = get.natureList(item, false);
      _nature.addArray(natures);
      item.nature = _nature.join(lib.natureSeparator);
    }
    return item.nature;
  },
  /**
   * 洗牌
   */
  washCard() {
    if (!ui.cardPile.hasChildNodes() && !ui.discardPile.hasChildNodes()) {
      return false;
    }
    if (_status.maxShuffle != void 0) {
      if (_status.maxShuffle == 0) {
        if (_status.maxShuffleCheck) {
          game.over(_status.maxShuffleCheck());
        } else {
          game.over("平局");
        }
        return [];
      }
      _status.maxShuffle--;
    }
    game.shuffleNumber++;
    const cards = Array.from(ui.cardPile.childNodes);
    if (_status.discarded) {
      _status.discarded.length = 0;
    }
    for (let i = 0; i < ui.discardPile.childNodes.length; i++) {
      const currentcard = ui.discardPile.childNodes[i];
      if (!(currentcard instanceof lib.element.Card)) {
        throw new TypeError("Discard pile must contain physical cards");
      }
      currentcard.vanishtag.length = 0;
      currentcard.clearKnowers();
      if (get.info(currentcard).vanish || currentcard.storage.vanish) {
        currentcard.remove();
        continue;
      }
      cards.push(currentcard);
    }
    cards.randomSort();
    return game.cardsGotoPile(cards, "triggeronly", "washCard", ["shuffleNumber", game.shuffleNumber]);
  },
  /**
   * 基于钩子的添加势力方法
   */
  addGroup(id, short, name, config, type = "default") {
    if (!id) {
      throw new TypeError();
    }
    if (typeof short === "object") {
      config = short;
      short = null;
    }
    if (typeof name === "object") {
      config = name;
      name = null;
    }
    if (typeof short !== "string" && short) {
      name = short;
    }
    if (["default", "all"].includes(type)) {
      lib.group.add(id);
    }
    if (["select", "all"].includes(type)) {
      lib.selectGroup.add(id);
    }
    if (short) {
      lib.translate[id] = short;
    }
    if (name) {
      lib.translate[`${id}2`] = name;
    }
    game.callHook("addGroup", [id, short, name, config]);
    return id;
  },
  /**
   * 通用的调用钩子函数
   */
  callHook(name, args) {
    const callHook = () => {
      const hooks = lib.hooks[name];
      if (!hooks) {
        throw new TypeError(`Hook ${String(name)} is not initialized`);
      }
      for (const hook of hooks) {
        if (typeof hook == "function") {
          hook(...args);
        }
      }
    };
    if ("onload" in lib) {
      lib.onload.add(callHook);
    } else {
      callHook();
    }
  },
  //Yingbian
  //应变
  yingbianEffect(event, content, ...rest) {
    const yingbianEffect = game.createEvent("yingbianEffect");
    yingbianEffect.player = event.player;
    yingbianEffect.card = event.card;
    yingbianEffect._trigger = event;
    yingbianEffect.setContent(content);
    yingbianEffect._args = [event, content, ...rest];
    return yingbianEffect;
  },
  setYingbianConditionColor(yingbianCondition, color) {
    return game.broadcastAll((yingbianCondition2, color2) => lib.yingbian.condition.color.set(yingbianCondition2, color2), yingbianCondition, color);
  },
  setComplexYingbianCondition(yingbianCondition, condition) {
    return game.broadcastAll((yingbianCondition2, condition2) => lib.yingbian.condition.complex.set(yingbianCondition2, condition2), yingbianCondition, condition);
  },
  setSimpleYingbianCondition(yingbianCondition, condition) {
    return game.broadcastAll((yingbianCondition2, condition2) => lib.yingbian.condition.simple.set(yingbianCondition2, condition2), yingbianCondition, condition);
  },
  setYingbianEffect(yingbianEffect, effect) {
    return game.broadcastAll((yingbianEffect2, effect2) => lib.yingbian.effect.set(yingbianEffect2, effect2), yingbianEffect, effect);
  },
  setYingbianPrompt(yingbian, prompt) {
    return game.broadcastAll((yingbian2, prompt2) => lib.yingbian.prompt.set(yingbian2, prompt2), yingbian, prompt);
  }
};
export {
  rulesAndNatureMethods
};
