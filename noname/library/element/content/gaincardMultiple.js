import "../../../../noname.js";
import { ui } from "../../../ui/index.js";
import { game } from "../../../game/index.js";
import { lib } from "../../index.js";
import { get } from "../../../get/binding.js";
import { _status } from "../../../status/index.js";
const gaincardMultipleContent = {
  async gaincardMultiple(event, trigger, player) {
    const { cards } = event;
    event.type = "gain";
    if (event.animate == "give" || event.animate == "gain2") {
      event.visible = true;
    }
    if (player && cards) {
      event._lose = true;
      await player.lose({ cards: cards.slice(), position: ui.special }).set("type", "gain").set("forceDie", true).set("getlx", false);
    }
    let delay2;
    const animate = event.animate;
    switch (animate) {
      case "draw":
        for (const pair of event.gain_list) {
          if (get.itemtype(pair[1]) == "card") {
            pair[1] = [pair[1]];
          }
          if (event._lose) {
            pair[1] = pair[1].filter((card) => !cards.includes(card) || !player.getCards("hejsx").includes(card));
          }
          if (pair[1].length > 0) {
            pair[0].$draw(pair[1].length);
          }
        }
        delay2 = game.delay(0, get.delayx(500, 500));
        break;
      case "gain":
        for (const pair of event.gain_list) {
          if (get.itemtype(pair[1]) == "card") {
            pair[1] = [pair[1]];
          }
          if (event._lose) {
            pair[1] = pair[1].filter((card) => !cards.includes(card) || !player.getCards("hejsx").includes(card));
          }
          if (pair[1].length > 0) {
            pair[0].$gain(pair[1].length);
          }
        }
        delay2 = game.delay(0, get.delayx(700, 700));
        break;
      case "gain2":
      case "draw2":
        for (const pair of event.gain_list) {
          if (get.itemtype(pair[1]) == "card") {
            pair[1] = [pair[1]];
          }
          if (event._lose) {
            pair[1] = pair[1].filter((card) => !cards.includes(card) || !player.getCards("hejsx").includes(card));
          }
          if (pair[1].length > 0) {
            pair[0].$gain2(pair[1]);
          }
        }
        delay2 = game.delay(0, get.delayx(500, 500));
        break;
      case "give":
      case "giveAuto": {
        if (!player) {
          break;
        }
        const evt = event.getl(player);
        for (const pair of event.gain_list) {
          if (get.itemtype(pair[1]) == "card") {
            pair[1] = [pair[1]];
          }
          if (event._lose) {
            pair[1] = pair[1].filter((card) => !cards.includes(card) || !player.getCards("hejsx").includes(card));
          }
          const shown = pair[1].slice(0);
          const hidden = [];
          if (event.animate == "giveAuto") {
            for (const card of pair[1]) {
              if (evt.hs.includes(card)) {
                shown.remove(card);
                hidden.push(card);
              }
            }
          }
          if (shown.length > 0) {
            player.$give(shown, pair[0]);
          }
          if (hidden.length > 0) {
            player.$giveAuto(hidden, pair[0]);
          }
        }
        delay2 = game.delay(0, get.delayx(500, 500));
        break;
      }
      default: {
        if (typeof animate === "function") {
          const animateResult = animate(event);
          if (typeof animateResult === "number") {
            delay2 = game.delay(0, get.delayx(animateResult, animateResult));
          } else {
            animateResult.finally(() => void game.resume());
            delay2 = game.pause();
          }
        }
        break;
      }
    }
    const nexts = [];
    for (const pair of event.gain_list) {
      if (pair[1].length > 0) {
        const next = pair[0].gain(pair[1]);
        next.getlx = false;
        if (event.visible) {
          next.visible = true;
        }
        if (event.giver) {
          next.giver = event.giver;
        }
        if (event.gaintag) {
          next.gaintag.addArray(event.gaintag);
        }
        nexts.push(next);
      }
    }
    await delay2;
    await Promise.all(nexts);
    await game.delayx();
  },
  async discardMultiple(event, trigger, player) {
    event.type = "discard";
    event.visible = true;
    if (!event.position) {
      event.position = ui.discardPile;
    }
    const allCards = [];
    const events = [];
    event.cards = allCards;
    for (const [target, cards2] of event.lose_list) {
      const next = target.lose(cards2, event.position);
      game.log(target, "弃置了", cards2);
      next.type = "discard";
      next.animate = false;
      next.delay = false;
      allCards.addArray(cards2);
      next.getlx = false;
      events.push(next);
    }
    const evt = event;
    const { cards } = event;
    if (evt.animate != false) {
      evt.discardid = lib.status.videoId++;
      game.broadcastAll(
        (list, id, cards2) => {
          for (const item of list) {
            for (const j of item[1]) {
              j.classList.remove("glow");
              j.classList.remove("glows");
            }
            item[0].$throw(item[1], null, "nobroadcast");
          }
          const cardnodes = [];
          cardnodes._discardtime = get.time();
          for (const ix of list) {
            const card = ix[1];
            for (const card2 of cards2) {
              if (card2.clone) {
                cardnodes.push(card2.clone);
              }
            }
          }
          ui.todiscard[id] = cardnodes;
        },
        event.lose_list,
        evt.discardid,
        cards
      );
      if (lib.config.sync_speed && cards[0] && cards[0].clone) {
        if (evt.delay != false) {
          const waitingForTransition = get.time();
          evt.waitingForTransition = waitingForTransition;
          cards[0].clone.listenTransition(() => {
            if (_status.waitingForTransition == waitingForTransition && _status.paused) {
              game.resume();
            }
            delete evt.waitingForTransition;
          });
        } else {
          const parent = evt.getParent(void 0, true);
          if (parent?.discardTransition) {
            delete parent.discardTransition;
            const waitingForTransition = get.time();
            parent.waitingForTransition = waitingForTransition;
            cards[0].clone.listenTransition(() => {
              if (_status.waitingForTransition == waitingForTransition && _status.paused) {
                game.resume();
              }
              const currentParent = evt.getParent(void 0, true);
              if (currentParent) {
                delete currentParent.waitingForTransition;
              }
            });
          }
        }
      }
    }
    await Promise.all(events);
    if (event.delay != false) {
      if (event.waitingForTransition) {
        _status.waitingForTransition = event.waitingForTransition;
        await game.pause();
      } else {
        await game.delayx();
      }
    }
  }
};
export {
  gaincardMultipleContent
};
