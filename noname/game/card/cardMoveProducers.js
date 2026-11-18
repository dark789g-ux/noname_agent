import "../../../noname.js";
import "../../library/element/gameEvent.js";
import { game } from "../index.js";
import { lib } from "../../library/index.js";
import { ui } from "../../ui/index.js";
import { get } from "../../get/binding.js";
import { _status } from "../../status/index.js";
import { initializeEvent } from "../../library/element/GameEvent/initializeEvent.js";
function cloneCardPileEntry(entry) {
  return entry.slice(0);
}
const cardMoveProducersMethods = {
  cardsDiscard(cards) {
    const type = get.itemtype(cards);
    if (type != "cards" && type != "card") {
      return;
    }
    const next = game.createEvent("cardsDiscard");
    if (type == "card") {
      cards = [cards];
    }
    const cardInputs = Array.isArray(cards) ? cards : [cards];
    const initialized = initializeEvent(next, {
      cards: cardInputs.slice(0).map((i) => i.cards ? i.cards : [i]).flat()
    });
    initialized.setContent("cardsDiscard");
    next.getd = function(player, key, position) {
      if (!player) {
        const discardedCards = this.cards;
        if (!discardedCards) {
          throw new TypeError("Discard history requires its cards");
        }
        return discardedCards.slice(0);
      }
      if (!position) {
        position = ui.ordering;
      }
      if (!key) {
        key = "cards";
      }
      const cards2 = [];
      const event = this;
      game.checkGlobalHistory("cardMove", function(evt) {
        if (evt.name != "lose" || evt.position != position) {
          return;
        }
        if (player && player != evt.player) {
          return;
        }
        if (position == ui.ordering && evt.relatedEvent == event.getParent(2) || (() => {
          const parent = event.getParent(2, true);
          if (!parent) {
            throw new Error("card-move history requires the second parent event.");
          }
          return parent.childEvents.find((evtx) => {
            if (evtx.name == "loseAsync") {
              return evtx.childEvents.find((evtx2) => evtx2 == evt);
            }
            return evt == evtx;
          });
        })()) {
          cards2.addArray(evt[key]);
        }
      });
      return cards2.filter((c) => {
        const discardedCards = event.cards;
        if (!discardedCards) {
          throw new TypeError("Discard history requires its cards");
        }
        return discardedCards.includes(c);
      });
    };
    return initialized;
  },
  /**
   * 将cards移动到处理区
   */
  cardsGotoOrdering(cards) {
    const type = get.itemtype(cards);
    if (type != "cards" && type != "card") {
      return;
    }
    const next = game.createEvent("cardsGotoOrdering");
    next.cards = type == "cards" ? cards.slice(0) : [cards];
    next.setContent("cardsGotoOrdering");
    return next;
  },
  cardsGotoSpecial(cards, bool) {
    const type = get.itemtype(cards);
    if (type != "cards" && type != "card") {
      return;
    }
    const next = game.createEvent("cardsGotoSpecial");
    next.cards = type == "cards" ? cards.slice(0) : [cards];
    if (typeof bool == "string" && Array.from(lib.commonArea.keys()).some((area) => lib.commonArea.get(area)?.toName == bool)) {
      next[bool] = true;
    } else if (bool === false) {
      next.notrigger = true;
    }
    next.setContent("cardsGotoSpecial");
    return next;
  },
  /**
   * 解析牌堆操作的旧位置参数，保留 get.itemtype 的实验标记识别。
   */
  cardsGotoPile(...args) {
    const cards = [];
    const next = game.createEvent("cardsGotoPile");
    next.cards = cards;
    for (let i = 0; i < args.length; i++) {
      const arg = args[i], itemtype = get.itemtype(arg);
      if (itemtype == "cards") {
        cards.addArray(arg);
      } else if (itemtype == "card") {
        cards.add(arg);
      } else if (typeof arg == "function") {
        next.insert_index = arg;
      } else if (typeof arg == "string") {
        if (arg == "insert") {
          next.insert_card = true;
        } else if (arg == "washCard") {
          next.washCard = true;
        } else if (arg == "triggeronly") {
          next._triggeronly = true;
        }
      } else if (Array.isArray(arg) && arg.length == 2 && typeof arg[0] == "string") {
        next.set(arg[0], arg[1]);
      }
    }
    if (!cards.length) {
      _status.event.next.remove(next);
    } else {
      next.setContent("cardsGotoPile");
      if (next._triggeronly) {
        game.$cardsGotoPile(next);
      }
    }
    return next;
  },
  $cardsGotoPile(event) {
    const cards = event.cards;
    const pile = ui.cardPile;
    if (!cards) {
      throw new TypeError("Moving to the draw pile requires its cards");
    }
    for (let i = 0; i < cards.length; i++) {
      if (cards[i].willBeDestroyed("cardPile", null, event)) {
        cards[i].selfDestroy(event);
        continue;
      }
      if (event.insert_index) {
        cards[i].fix();
        pile.insertBefore(cards[i], event.insert_index(event, cards[i]));
      } else if (event.insert_card) {
        cards[i].fix();
        pile.insertBefore(cards[i], pile.firstChild);
      } else {
        cards[i].fix();
        pile.appendChild(cards[i]);
      }
    }
    game.updateRoundNumber();
  },
  showHistory(pause) {
    if (lib.config.show_history == "left") {
      ui.window.classList.add("leftbar");
    } else if (lib.config.show_history == "right") {
      ui.window.classList.add("rightbar");
    }
    if (pause != false && ui.pause) {
      ui.pause.show();
    }
  },
  createBackground(src, blur) {
    const current = document.body.querySelector(".background.upper");
    if (current) {
      if (!(current instanceof HTMLDivElement)) {
        throw new TypeError("The current background must be a div element");
      }
      current.delete();
    }
    const node = ui.create.div(".background.blurbg", document.body);
    node.setBackgroundImage(src);
    node.style.backgroundSize = "cover";
    if (blur) {
      node.classList.add("paused");
    }
    return node;
  },
  changeLand(url, player) {
    game.addVideo("changeLand", player, url);
    const parsedPath = lib.path.parse(url);
    delete parsedPath.base;
    if (!parsedPath.dir) {
      parsedPath.dir = "image/card/";
    }
    if (!parsedPath.ext) {
      parsedPath.ext = ".jpg";
    }
    const fileName = parsedPath.name;
    game.broadcastAll(
      (formattedPath, name, skill, player2) => {
        const node = Object.assign(ui.create.div(".background.upper.land"), {
          destroy() {
            if (node.skill) {
              game.removeGlobalSkill(node.skill);
              if (node.system) {
                node.system.remove();
              }
            }
            node.classList.add("hidden");
            setTimeout(() => node.remove(), 3e3);
            if (ui.land == node) {
              ui.land = null;
            }
          }
        });
        node.setBackgroundImage(formattedPath);
        const currentLand = ui.land;
        if (currentLand) {
          document.body.insertBefore(node, currentLand);
          currentLand.destroy();
        } else {
          node.classList.add("hidden");
          document.body.insertBefore(node, ui.window);
          ui.refresh(node);
          node.classList.remove("hidden");
        }
        ui.land = node;
        if (!name) {
          return;
        }
        node.name = name;
        node.skill = skill;
        if (player2) {
          node.player = player2;
          player2.addTempSkill("land_used");
        }
        lib.setPopped(
          node.system = ui.create.system(lib.translate[skill], null, true, true),
          () => {
            const uiIntro = ui.create.dialog("hidden");
            uiIntro.addText(player2 ? `来源：${get.translation(player2)}` : "地图").style.margin = "0";
            uiIntro._place_text = uiIntro.add(ui.create.div(".text", lib.translate[`${skill}_info`]));
            uiIntro.add(ui.create.div(".placeholder.slim"));
            return uiIntro;
          },
          200
        );
        game.addGlobalSkill(skill);
      },
      lib.path.format(parsedPath),
      fileName,
      `${fileName}_skill`,
      player
    );
  },
  async checkFileList(updates, proceed) {
    const list = updates.slice(0);
    for (const file of list) {
      const result = await game.promises.checkFile(file);
      if (result > 0) {
        updates.remove(file);
      }
    }
    await proceed();
  },
  replaceHandcards(...args) {
    const next = game.createEvent("replaceHandcards");
    if (Array.isArray(args[0])) {
      next.players = args[0];
    } else {
      next.players = [];
      for (let i = 0; i < args.length; i++) {
        if (get.itemtype(args[i]) == "player") {
          next.players.push(args[i]);
        }
      }
    }
    if (_status.connectMode) {
      next.setContent("replaceHandcardsOL");
    } else {
      next.setContent("replaceHandcards");
    }
  },
  removeCard(name) {
    for (let i = 0; i < lib.card.list.length; i++) {
      if (lib.card.list[i][2] == name) {
        lib.card.list.splice(i--, 1);
      }
    }
    const list = [];
    for (let i = 0; i < ui.cardPile.childElementCount; i++) {
      const card = ui.cardPile.childNodes[i];
      if (card instanceof lib.element.Card && card.name == name) {
        list.push(card);
      }
    }
    for (let i = 0; i < list.length; i++) {
      list[i].remove();
    }
  }
};
export {
  cardMoveProducersMethods,
  cloneCardPileEntry
};
