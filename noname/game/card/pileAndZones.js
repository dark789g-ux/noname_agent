import "../../../noname.js";
import { game } from "../index.js";
import { lib } from "../../library/index.js";
import { get } from "../../get/binding.js";
import { _status } from "../../status/index.js";
import { ui } from "../../ui/index.js";
const pileAndZonesMethods = {
  updateBackground() {
    const background = _status.tempBackground || lib.config.image_background;
    ui.background.delete();
    const uiBackground = ui.background = ui.create.div(".background"), style = uiBackground.style;
    if (lib.config.image_background_blur) {
      style.filter = "blur(8px)";
      style.webkitFilter = "blur(8px)";
      style.transform = "scale(1.05)";
    }
    document.body.insertBefore(uiBackground, document.body.firstChild);
    if (background.startsWith("blob:") || background.startsWith("data:")) {
      uiBackground.setBackgroundImage(background);
    } else if (background.startsWith("db:")) {
      uiBackground.setBackgroundDB(background.slice(3));
    } else if (background.startsWith("ext:")) {
      uiBackground.setBackgroundImage(`extension/${background.slice(4)}`);
    } else if (background == "default") {
      uiBackground.addTempClass("start");
      style.backgroundImage = "none";
    } else if (background.startsWith("custom_")) {
      style.backgroundImage = "none";
      game.getDB("image", background).then((fileToLoad) => {
        if (!fileToLoad) {
          return;
        }
        if (!(fileToLoad instanceof Blob)) {
          throw new TypeError("The stored background must be a Blob");
        }
        const fileReader = new FileReader();
        fileReader.onload = (fileLoadedEvent) => {
          const target = fileLoadedEvent.target;
          if (target) {
            style.backgroundImage = `url(${target.result})`;
          }
        };
        fileReader.readAsDataURL(fileToLoad);
      });
    } else {
      uiBackground.setBackgroundImage(`image/background/${background}.jpg`);
    }
    style.backgroundSize = "cover";
    style.backgroundPosition = "50% 50%";
  },
  /**
   * 更新连接牌和显示
   */
  updateConnectedCards() {
    game.broadcast((cards) => {
      _status.sxrmConnectCards = cards;
    }, _status.sxrmConnectCards);
    game.players.forEach((current) => {
      if (current.hasConnectedCards()) {
        current.markSkill("_sxrm_connect");
      } else {
        current.unmarkSkill("_sxrm_connect");
      }
    });
  },
  /**
   * 连接牌
   */
  addConnectedCards(cards) {
    const cardArr = Array.isArray(cards) ? cards : [cards];
    const shown = cardArr.filter((card) => get.is.connectedCard(card)), hidden = cardArr.filter((card) => !shown.includes(card));
    if (shown.length) {
      game.removeConnectedCards(shown);
    }
    if (hidden.length) {
      _status.sxrmConnectCards.addArray(hidden);
      game.broadcastAll((cards2) => {
        cards2.forEach((card) => {
          card.addGaintag("visible_sxrm_connect_tag");
        });
      }, cardArr);
      game.updateConnectedCards();
    }
  },
  /**
   * 重置连接牌
   */
  removeConnectedCards(cards) {
    const cardArr = Array.isArray(cards) ? cards : [cards];
    _status.sxrmConnectCards.removeArray(cardArr);
    game.broadcastAll((cards2) => {
      cards2.forEach((card) => {
        card.removeGaintag("visible_sxrm_connect_tag");
      });
    }, cardArr);
    game.updateConnectedCards();
  },
  updateRenku() {
    game.broadcast(function(renku) {
      _status.renku = renku;
    }, _status.renku);
    for (const i of game.players) {
      if (i.storage.renku) {
        i.markSkill("renku");
      }
    }
  },
  /**
   * 为牌添加知情者
   */
  addCardKnower(cards, players) {
    if (get.itemtype(cards) == "card") {
      cards = [cards];
    }
    cards.forEach((card) => card.addKnower(players));
  },
  /**
   * 移除牌的所有知情者。
   */
  clearCardKnowers(cards) {
    const cardArr = Array.isArray(cards) ? cards : [cards];
    cardArr.forEach((card) => card.clearKnowers());
  },
  loseAsync(arg) {
    const next = game.createEvent("loseAsync");
    next.forceDie = true;
    next.getd = function(player, key, position) {
      if (!position) {
        position = ui.discardPile;
      }
      if (!key) {
        key = "cards";
      }
      const cards = [];
      const event = this;
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
      const that = this;
      const cards = [];
      player.checkHistory("gain", function(evt) {
        if (evt.parent == that) {
          cards.addArray(evt.cards);
        }
      });
      return cards;
    };
    if (arg && get.is.object(arg)) {
      for (const i in arg) {
        next[i] = arg[i];
      }
    }
    return next;
  },
  callFuncUseStepCache(prefix, func, params) {
    if (typeof func != "function") {
      return;
    }
    if (_status.closeStepCache || !_status.event) {
      return func.apply(null, params);
    }
    const cacheKey = "[" + prefix + "]" + get.paramToCacheKey.apply(null, params);
    let ret = _status.event.getStepCache(cacheKey);
    if (ret === void 0 || ret === null) {
      ret = func.apply(null, params);
      _status.event.putStepCache(cacheKey, ret);
    }
    return ret;
  },
  getRarity(name) {
    if (!lib.rank) return;
    const rank = lib.rank.rarity;
    if (rank.legend.includes(name)) return "legend";
    if (rank.epic.includes(name)) return "epic";
    if (rank.rare.includes(name)) return "rare";
    if (get.mode() != "chess" && rank.junk.includes(name)) return "junk";
    return "common";
  }
};
export {
  pileAndZonesMethods
};
