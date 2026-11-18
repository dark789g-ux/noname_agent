import "../../../../noname.js";
import "../gameEvent.js";
import { delay } from "../../../util/index.js";
import { ui } from "../../../ui/index.js";
import { game } from "../../../game/index.js";
import { lib } from "../../index.js";
import { get } from "../../../get/binding.js";
import { _status } from "../../../status/index.js";
import { initializeEvent } from "../GameEvent/initializeEvent.js";
const addToExpansionMultipleContent = {
  addToExpansionMultiple: [
    async (event, trigger, player) => {
      if (event.animate == "give") {
        event.visible = true;
      }
      event.type = "addToExpansion";
      event.gaintag ??= [];
      event.cards ??= [];
      if (event.lose_list) {
        const playersById = _status.connectMode ? lib.playerOL : game.playerMap;
        for (const list of event.lose_list) {
          const source = list[0];
          const sourceId = source.playerid;
          if (!playersById || typeof sourceId != "string" || !playersById[sourceId]) {
            event.cards = [];
            event.finish();
            return;
          }
          for (const card of list[1]) {
            const owner = get.owner(card, "judge");
            if (owner && (owner != source || get.position(card) != "x")) {
              const ownerId = owner.playerid;
              if (!playersById || typeof ownerId != "string" || !playersById[ownerId]) {
                event.cards = [];
                event.finish();
                return;
              }
            }
          }
        }
        const map = {};
        const map2 = {};
        for (const list of event.lose_list) {
          const player2 = list[0];
          const cards = list[1];
          const myId = player2.playerid;
          if (typeof myId != "string") {
            event.cards = [];
            event.finish();
            return;
          }
          event.cards.addArray(cards);
          if (!map2[myId]) {
            map2[myId] = [];
          }
          for (const i of cards) {
            const owner = get.owner(i, "judge");
            if (owner && (owner != player2 || get.position(i) != "x")) {
              const id = owner.playerid;
              if (typeof id != "string") {
                event.cards = [];
                event.finish();
                return;
              }
              if (!map[id]) {
                map[id] = [[], [], []];
              }
              map[id][0].push(i);
              map2[myId].push(i);
              const position = get.position(i);
              if (position == "h") {
                map[id][1].push(i);
              } else {
                map[id][2].push(i);
              }
            } else if (!event.updatePile && get.position(i) == "c") {
              event.updatePile = true;
            }
          }
        }
        event.losing_map = map;
        event.gaining_map = map2;
        for (const i in map) {
          const owner = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
          if (!owner) {
            event.finish();
            return;
          }
          const next = owner.lose({ cards: map[i][0], position: ui.special }).set("forceDie", true).set("getlx", false);
          next.set("relatedEvent", event.getParent());
          next.set("forceDie", true);
          next.set("getlx", false);
          if (event.visible == true) {
            next.set("visible", true);
          }
          await next;
        }
      } else {
        event.finish();
        return;
      }
    },
    async (event, trigger, player) => {
      const { cards: cardsx } = event;
      if (event.lose_list) {
        const map = {};
        for (const list of event.lose_list) {
          const player2 = list[0];
          const cards = list[1];
          for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            if (card.willBeDestroyed("expansion", player2, event)) {
              card.selfDestroy(event);
              cards.splice(i--, 1);
              cardsx.remove(card);
            } else if (event.losing_map) {
              for (const id in event.losing_map) {
                if (event.losing_map[id][0].includes(card)) {
                  const source = (_status.connectMode ? lib.playerOL : game.playerMap)[id];
                  if (!source) {
                    event.finish();
                    return;
                  }
                  const hs = source.getCards("hejsx");
                  if (hs.includes(card)) {
                    cards.splice(i--, 1);
                    cardsx.remove(card);
                  }
                }
              }
            }
          }
        }
      }
      if (cardsx.length == 0) {
        event.finish();
        return;
      }
    },
    async (event, trigger, player) => {
      const { lose_list } = event;
      for (const [source, cards] of lose_list) {
        for (const [key, value] of lib.commonArea) {
          const list = (_status[value.areaStatusName] || []).filter((card) => cards.includes(card));
          if (event[value.fromName] || list.length) {
            const next = initializeEvent(game.createEvent(`from_${value.fromName}`), { cards });
            next.setContent(value.removeHandeler);
            next.player = source;
            next.type = event.type;
            await next;
          }
        }
      }
    },
    async (event, trigger, player) => {
      const animate = event.animate;
      const postAnimate = (player2, cards) => {
        player2.$addToExpansion(cards, null, event.gaintag);
        for (const id of event.gaintag) {
          player2.markSkill(id);
        }
      };
      const playersById = _status.connectMode ? lib.playerOL : game.playerMap;
      const gainingMap = event.gaining_map;
      const waitings = [];
      for (const [id, cards] of Object.entries(gainingMap)) {
        const player2 = playersById && playersById[id];
        if (!player2) {
          event.finish();
          return;
        }
        const hs = player2.getCards("x");
        const cards2 = cards.filter((card) => !hs.includes(card));
        for (const card of cards2) {
          if (_status.discarded) {
            _status.discarded.remove(card);
          }
          for (let i = 0; i < card.vanishtag.length; i++) {
            if (card.vanishtag[i][0] !== "_") {
              card.vanishtag.splice(i--, 1);
            }
          }
        }
        let animateTime = null;
        switch (animate) {
          case "draw":
            player2.$draw(cards2.length);
            if (event.log) {
              game.log(player2, "将", get.cnNumber(cards2.length), "张牌置于了武将牌上");
            }
            animateTime = 500;
            break;
          case "gain":
            player2.$gain(cards2, false);
            animateTime = 700;
            break;
          case "gain2":
          case "draw2":
            animateTime = 300;
            if (player2.$gain2(cards2) && player2 === game.me) {
              animateTime = 500;
            }
            break;
          case "give":
          case "giveAuto": {
            const evtmap = event.losing_map;
            const entries = [];
            for (const [id2, slots] of Object.entries(evtmap)) {
              entries.push([id2, slots[0]]);
            }
            const getOwner = (card) => {
              const entry = entries.find((entry2) => entry2[1].includes(card));
              if (entry) {
                const owner = playersById && playersById[entry[0]];
                if (!owner) {
                  event.finish();
                  return null;
                }
                return owner;
              }
              return null;
            };
            const gainmap = {};
            for (const cardx of cards2) {
              const owner = getOwner(cardx);
              if (owner) {
                const id2 = owner.playerid;
                if (typeof id2 != "string") {
                  continue;
                }
                if (!gainmap[id2]) {
                  gainmap[id2] = [];
                }
                gainmap[id2].push(cardx);
              }
            }
            if (animate === "give") {
              for (const i in gainmap) {
                const source = playersById && playersById[i];
                if (!source || !evtmap[i]) {
                  continue;
                }
                source.$give(evtmap[i][0], player2, false);
                if (event.log) {
                  game.log(player2, "将", evtmap[i][0], "置于了武将牌上");
                }
              }
            } else {
              for (const id2 in gainmap) {
                const source = playersById && playersById[id2];
                if (!source || !evtmap[id2]) {
                  continue;
                }
                if (evtmap[id2][1].length) {
                  source.$giveAuto(evtmap[id2][1], player2, false);
                  if (event.log) {
                    game.log(player2, "将", get.cnNumber(evtmap[id2][1].length), "张牌置于了武将牌上");
                  }
                }
                if (evtmap[id2][2].length) {
                  source.$give(evtmap[id2][2], player2, false);
                  if (event.log) {
                    game.log(player2, "将", evtmap[id2][2], "置于了武将牌上");
                  }
                }
              }
            }
            animateTime = 500;
            break;
          }
          default:
            if (typeof animate === "function") {
              animateTime = animate(event);
            }
            break;
        }
        if (animateTime == null) {
          postAnimate(player2, cards2);
          continue;
        }
        const waiting = typeof animateTime === "number" ? delay(get.delayx(animateTime, animateTime)) : animateTime;
        waitings.push(waiting.then(() => postAnimate(player2, cards2)));
      }
      if (waitings.length) {
        Promise.allSettled(waitings).finally(() => void game.resume());
        await game.pause();
        game.delayx();
      }
      if (event.updatePile) {
        game.updateRoundNumber();
      }
    }
  ],
  loseToDiscardpileMultiple: [
    async (event, trigger, player) => {
      event.visible = true;
      if (!event.position) {
        event.position = ui.discardPile;
      }
      event.type = "loseToDiscardpile";
      const cards = [];
      event.cards = cards;
      for (const [target, targetCards] of event.lose_list) {
        const next = target.lose(targetCards, event.position);
        game.log(target, "将", targetCards, `置入了${lib.areaList.get(event.position.id)}`);
        next.animate = false;
        next.delay = false;
        cards.addArray(targetCards);
        next.getlx = false;
      }
      const evt = event;
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
            for (const card of cards2) {
              if (card.clone) {
                cardnodes.push(card.clone);
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
    },
    async (event, trigger, player) => {
      if (event.delay != false) {
        if (event.waitingForTransition) {
          _status.waitingForTransition = event.waitingForTransition;
          game.pause();
        } else {
          await game.delayx();
        }
      }
    }
  ],
  async chooseToCompareLose(event) {
    const waitings = event.lose_list.map(async ([player, cards]) => {
      const next = player.lose(cards, ui.ordering);
      next.relatedEvent = event.relatedEvent || event.getParent();
      next.getlx = false;
      await next;
    });
    await Promise.all(waitings);
  }
};
export {
  addToExpansionMultipleContent
};
