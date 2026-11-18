import "../../../../noname.js";
import { delay } from "../../../util/index.js";
import { game } from "../../../game/index.js";
import { ui } from "../../../ui/index.js";
import { lib } from "../../index.js";
import { _status } from "../../../status/index.js";
import { get } from "../../../get/binding.js";
const showCardsContent = {
  async showCards(event, trigger, player) {
    const { cards, str, flashAnimation, triggeronly, isFlash, multipleShow } = event;
    if (get.itemtype(cards) != "cards") {
      return event.finish();
    }
    const showMap = /* @__PURE__ */ new Map();
    const others = {
      cardPile: [],
      discardPile: [],
      ordering: [],
      special: [],
      noPosition: []
    };
    showMap.set("others", others);
    event.show_map = showMap;
    await event.trigger("showCards");
    if (get.itemtype(cards) != "cards") {
      return;
    }
    event.result = {
      cards: cards.slice(0),
      show_map: event.show_map
    };
    await event.trigger("showCardsFixing");
    if (typeof event.result == "string" || !Array.isArray(event.result.cards) || !event.result.cards.every((card) => get.itemtype(card) == "card")) {
      return;
    }
    event.cards = event.result.cards;
    const directLose = [];
    event.directLose = directLose;
    const ownerLose = /* @__PURE__ */ new Map();
    event.ownerLose = ownerLose;
    for (const card of cards) {
      const pos = get.position(card, true);
      const owner = get.owner(card);
      if (owner && !event.show_map.has(owner)) {
        const ownerEntry2 = {
          hs: [],
          es: [],
          js: [],
          xs: [],
          ss: [],
          cards2: [],
          cards: []
        };
        event.show_map.set(owner, ownerEntry2);
        ownerLose.set(owner, []);
      }
      const ownerEntry = owner ? event.show_map.get(owner) : void 0;
      if ("hejsx".includes(pos) && owner) {
        if (!ownerEntry || !("hs" in ownerEntry)) {
          continue;
        }
        if (pos == "h") {
          ownerEntry.hs.push(card);
        } else if (pos == "e") {
          ownerEntry.es.push(card);
        } else if (pos == "j") {
          ownerEntry.js.push(card);
        } else if (pos == "s") {
          ownerEntry.ss.push(card);
        } else {
          ownerEntry.xs.push(card);
        }
        ownerEntry.cards.push(card);
        if ("he".includes(pos)) {
          ownerEntry.cards2.push(card);
        }
        ownerLose.get(owner)?.push(card);
      } else if ("cds".includes(pos)) {
        directLose.push(card);
        if (pos == "c") {
          others.cardPile.push(card);
        } else if (pos == "d") {
          others.discardPile.push(card);
        } else {
          others.special.push(card);
        }
      } else {
        directLose.push(card);
        if (pos == "o") {
          others.ordering.push(card);
        } else if (card.original == "c") {
          others.cardPile.push(card);
        } else if (card.original == "d") {
          others.discardPile.push(card);
        } else if (card.original == "s") {
          others.special.push(card);
        } else {
          others.noPosition.push(card);
        }
      }
    }
    if (triggeronly) {
      return;
    }
    if (!event.noOrdering && isFlash) {
      if (Array.from(ownerLose.values())?.flat()?.length > 0) {
        const next = game.loseAsync({ lose_list: Array.from(ownerLose.entries()) }).set("relatedEvent", event.relatedEvent || event.getParent());
        next.setContent("chooseToCompareLose");
        await next;
      }
      if (directLose.length > 0) {
        const ordering = game.cardsGotoOrdering(directLose);
        if (ordering) {
          await ordering.set("relatedEvent", event.relatedEvent || event.getParent());
        }
      }
    }
    if (!event.str) {
      event.str = `${get.translation(player.name)}展示的牌`;
    }
    if (!flashAnimation) {
      if (typeof event.dialog == "number") {
        event.videoId = event.dialog;
        event.dialog = get.idDialog(event.dialog);
      } else {
        event.videoId = lib.status.videoId++;
      }
      if (event.createDialog && !event.dialog) {
        if (Array.isArray(event.createDialog)) {
          game.broadcastAll(
            (id, createDialog2) => {
              const dialog = ui.create.dialog.apply(this, createDialog2);
              dialog.videoId = id;
            },
            event.videoId,
            event.createDialog
          );
        }
      }
      if (event.dialog == void 0) {
        game.broadcastAll(
          (id, str2, cards3) => {
            const dialog = ui.create.dialog(str2, cards3);
            dialog.videoId = id;
          },
          event.videoId,
          event.str,
          cards
        );
      }
      event.dialog = get.idDialog(event.videoId);
      const createDialog = (cards22, id, customButton2) => {
        const dialog = get.idDialog(id);
        if (!dialog) {
          return;
        }
        dialog.forcebutton = true;
        if (cards22) {
          for (const button of dialog.buttons) {
            if (cards22.includes(button.link)) {
              button.className = "button card";
              button.innerHTML = "";
            }
          }
        }
        if (typeof customButton2 == "function") {
          dialog.buttons.forEach((button) => customButton2(button));
        }
      };
      const customButton = event.customButton || (() => {
      });
      createDialog(event.hiddencards, event.videoId, customButton);
      game.broadcast(
        (func, cards22, id, customButton2) => {
          func(cards22, id, customButton2);
        },
        createDialog,
        event.hiddencards,
        event.videoId,
        customButton
      );
      game.addVideo("showCards", player, [event.str, get.cardsInfo(cards)]);
    } else {
      event.videoId = lib.status.videoId++;
      for (const card of cards) {
        game.addVideo("judge1", player, [get.cardInfo(card), event.str, event.videoId]);
      }
      game.broadcastAll(
        (player2, cards3, str2, id, cardids) => {
          let event2;
          if (game.online) {
            event2 = {};
          } else {
            event2 = _status.event;
          }
          event2.nodes ??= [];
          cards3.forEach((card, index) => {
            let node;
            const cardid = cardids[index];
            if (game.chess) {
              node = card.copy("thrown", "center", ui.arena).addTempClass("start");
            } else {
              node = player2.$throwordered(card.copy(), true);
            }
            if (lib.cardOL) {
              lib.cardOL[cardid] = node;
            }
            node.cardid = cardid;
            node.classList.add("thrownhighlight");
            event2.nodes.push(node);
          });
          ui.arena.classList.add("thrownhighlight");
          event2.dialog = ui.create.dialog(str2);
          event2.dialog.classList.add("center");
          event2.dialog.videoId = id;
        },
        player,
        cards,
        event.str,
        event.videoId,
        cards.map((i) => get.id())
      );
    }
    const cards2 = cards.slice(0);
    if (event.hiddencards && !isFlash) {
      cards2.removeArray(event.hiddencards);
    }
    if (event.log != false) {
      const str2 = isFlash ? "亮出了" : "展示了";
      if (multipleShow !== true) {
        const logList = event.log?.(cards2, player) || [player, str2, cards2];
        game.log(...logList);
      } else {
        const targets = Array.from(ownerLose.keys());
        for (const target of targets.sortBySeat()) {
          const cardsx = ownerLose.get(target)?.filter((card) => !event.hiddenCards?.includes(card));
          if (cardsx?.length) {
            const logList = event.log?.(cardsx, target) || [target, str2, cardsx];
            game.log(...logList);
          }
        }
        if (directLose.length) {
          const logList = event.log?.(directLose, player) || [player, str2, directLose];
          game.log(...logList);
        }
      }
    }
    cards.forEach((card) => card.addKnower("everyone"));
    const delay2 = Math.max(2, Math.min(5, cards.length));
    await game.delayx(event.delay_time || delay2);
    if (!flashAnimation) {
      if (event.closeDialog != false) {
        game.broadcastAll(lib.message.client.closeDialog, event.videoId);
      }
    } else {
      if (event.clearArena !== false) {
        game.broadcastAll(() => ui.clear());
      }
      event.highlightRemove = () => {
        game.broadcastAll((id) => {
          const dialog = get.idDialog(id);
          if (dialog) {
            dialog.close();
          }
          ui.arena.classList.remove("thrownhighlight");
        }, event.videoId);
      };
      if (event.removeHighlight !== false) {
        event.highlightRemove();
      }
      game.addVideo("judge2", null, event.videoId);
    }
    if (event.callback) {
      const next = game.createEvent("showCardsCallback", false);
      next.player = player;
      next.cards = event.result.cards;
      next.result = event.result;
      next.setContent(event.callback);
      await next;
    }
  },
  async viewCards(event, trigger, player) {
    game.addCardKnower(event.cards, player);
    let result;
    if (player == game.me) {
      event.dialog = ui.create.dialog(event.str, event.cards);
      if (event.isMine()) {
        game.countChoose();
        event.choosing = true;
        await new Promise((resolve) => {
          ui.create.confirm("o", resolve);
        });
        ui?.confirm?.close();
      } else {
        event.result = "viewed";
        const wait = delay(2 * lib.config.duration).then(() => {
          event.dialog.close();
        });
        await game.delayx(2);
        await wait;
        return;
      }
    } else if (event.isOnline()) {
      await event.sendAsync();
    } else {
      return;
    }
    event.result = "viewed";
    _status.imchoosing = false;
    event.choosing = false;
    if (event.dialog) {
      event.dialog.close();
    }
  }
};
export {
  showCardsContent
};
