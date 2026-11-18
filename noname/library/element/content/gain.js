import "../../../../noname.js";
import "../gameEvent.js";
import { delay } from "../../../util/index.js";
import { get } from "../../../get/binding.js";
import { lib } from "../../index.js";
import { game } from "../../../game/index.js";
import { _status } from "../../../status/index.js";
import { ui } from "../../../ui/index.js";
import { initializeEvent } from "../GameEvent/initializeEvent.js";
const gainContent = {
  gain: [
    async (event, trigger, player) => {
      const { cards } = event;
      if (event.animate == "give" || event.animate == "gain2" || event.animate == "draw2") {
        event.visible = true;
      }
      if (Array.isArray(cards) && !cards.some((card) => get.itemtype(card) !== "card")) {
        const map = {};
        for (const i of cards) {
          const owner = get.owner(i, "judge");
          if (owner && (owner != player || get.position(i) != "h")) {
            const id = owner.playerid;
            if (typeof id !== "string") continue;
            if (!map[id]) {
              map[id] = [[], [], []];
            }
            map[id][0].push(i);
            const position = get.position(i);
            if (position == "h") {
              map[id][1].push(i);
            } else {
              map[id][2].push(i);
            }
          } else if (!event.updatePile && get.position(i) == "c") {
            event.updatePile = true;
          }
          if (event.visible) {
            i.addKnower("everyone");
          }
        }
        event.losing_map = map;
        for (const i in map) {
          const owner = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
          const next = owner.lose({ cards: map[i][0], position: ui.special }).set("type", "gain").set("forceDie", true).set("getlx", false);
          if (event.visible == true) {
            next.visible = true;
          }
          event.relatedLose = next;
        }
      } else {
        const name = event.getParent(event.getlx === false ? 2 : 1).name;
        console.warn(`请检查技能：${name}中关于gain的写法`);
        event.finish();
      }
    },
    async (event, trigger, player) => {
      let { cards } = event;
      event.cards = cards = cards.map((i) => i.cards ? i.cards : [i]).flat();
      for (let i = 0; i < cards.length; i++) {
        if (cards[i].willBeDestroyed("handcard", player, event)) {
          cards[i].selfDestroy(event);
          cards.splice(i--, 1);
        } else if (event.losing_map) {
          for (const id in event.losing_map) {
            if (event.losing_map[id][0].includes(cards[i])) {
              const source = (_status.connectMode ? lib.playerOL : game.playerMap)[id];
              const hs = source.getCards("hejsx");
              if (hs.includes(cards[i])) {
                cards.splice(i--, 1);
              } else {
                cards[i].addKnower(source);
              }
            }
          }
        }
      }
      if (cards.length == 0) {
        event.finish();
        return;
      }
      player.getHistory("gain").push(event);
    },
    async (event, trigger, player) => {
      const { cards } = event;
      const stat = player.getStat();
      if (stat.gain == void 0) {
        stat.gain = cards.length;
      } else {
        stat.gain += cards.length;
      }
    },
    async (event, trigger, player) => {
      const { cards } = event;
      for (const [key, value] of lib.commonArea) {
        const list = (_status[value.areaStatusName] || []).filter((card) => cards.includes(card));
        if (event[value.fromName] || list.length) {
          const next = initializeEvent(game.createEvent(`from_${value.fromName}`), { cards });
          next.setContent(value.removeHandeler);
          next.player = player;
          next.type = event.name;
          await next;
        }
      }
    },
    async (event, trigger, player) => {
      const { cards } = event;
      let sort;
      const frag1 = document.createDocumentFragment();
      const frag2 = document.createDocumentFragment();
      const hs = player.getCards("hs");
      for (let i = 0; i < cards.length; i++) {
        if (hs.includes(cards[i])) {
          cards.splice(i--, 1);
        }
      }
      for (const card of cards) {
        sort = lib.config.sort_card(card);
        if (lib.config.reverse_sort) {
          sort = -sort;
        }
        if (["o", "d"].includes(get.position(card, true))) {
          card.addKnower("everyone");
        }
        card.fix();
        card.style.transform = "";
        event.gaintag.forEach((tag) => card.addGaintag(tag));
        if (event.knowers) {
          card.addKnower(event.knowers);
        }
        if (_status.discarded) {
          _status.discarded.remove(card);
        }
        for (let num2 = 0; num2 < card.vanishtag.length; num2++) {
          if (card.vanishtag[num2][0] != "_") {
            card.vanishtag.splice(num2--, 1);
          }
        }
        if (player == game.me) {
          card.classList.add("drawinghidden");
        }
        if (get.is.singleHandcard() || sort > 1) {
          frag1.appendChild(card);
        } else {
          frag2.appendChild(card);
        }
      }
      const addv = () => {
        if (player == game.me) {
          game.addVideo("gain12", player, [get.cardsInfo(Array.from(frag1.childNodes)), get.cardsInfo(Array.from(frag2.childNodes)), event.gaintag]);
        }
      };
      const broadcast = () => {
        game.broadcast(
          (player2, cards2, num, gaintag) => {
            player2.directgain(cards2, null, gaintag);
            _status.cardPileNum = num;
          },
          player,
          cards,
          ui.cardPile.childNodes.length,
          event.gaintag
        );
      };
      const postAnimate = () => {
        addv();
        player.node.handcards1.insertBefore(frag1, player.node.handcards1.firstChild);
        player.node.handcards2.insertBefore(frag2, player.node.handcards2.firstChild);
        player.update();
        if (player === game.me) {
          ui.updatehl();
        }
        broadcast();
      };
      let animateTime = null;
      const animate = event.animate;
      switch (animate) {
        case "draw":
          player.$draw(cards.length);
          animateTime = 500;
          break;
        case "gain":
          player.$gain(cards, event.log);
          animateTime = 700;
          break;
        case "draw2":
        case "gain2":
          animateTime = 300;
          if (player.$gain2(cards, event.log) && player === game.me) {
            animateTime = 500;
          }
          break;
        case "give":
        case "giveAuto": {
          const evtmap = event.losing_map;
          if (animate === "give") {
            for (const id in evtmap) {
              const source = (_status.connectMode ? lib.playerOL : game.playerMap)[id];
              source.$give(evtmap[id][0], player, event.log);
            }
          } else {
            for (const id in evtmap) {
              const source = (_status.connectMode ? lib.playerOL : game.playerMap)[id];
              if (evtmap[id][1].length) {
                source.$giveAuto(evtmap[id][1], player, event.log);
              }
              if (evtmap[id][2].length) {
                source.$give(evtmap[id][2], player, event.log);
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
        postAnimate();
      } else {
        const waiting = typeof animateTime === "number" ? delay(get.delayx(animateTime, animateTime)) : animateTime;
        waiting.then(postAnimate).finally(() => void game.resume());
        await game.pause();
        game.delayx();
      }
      if (event.updatePile) {
        game.updateRoundNumber();
      }
    }
  ],
  addToExpansion: [
    async (event, trigger, player) => {
      const { cards } = event;
      if (event.animate == "give") {
        event.visible = true;
      }
      if (get.itemtype(cards) == "cards") {
        const map = {};
        for (const i of cards) {
          const owner = get.owner(i, "judge");
          if (owner && (owner != player || get.position(i) != "x")) {
            const id = owner.playerid;
            if (typeof id !== "string") {
              continue;
            }
            if (!map[id]) {
              map[id] = [[], [], []];
            }
            map[id][0].push(i);
            const position = get.position(i);
            if (position == "h") {
              map[id][1].push(i);
            } else {
              map[id][2].push(i);
            }
          } else if (!event.updatePile && get.position(i) == "c") {
            event.updatePile = true;
          }
          if (event.visible) {
            i.addKnower("everyone");
          }
        }
        event.losing_map = map;
        for (const i in map) {
          const owner = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
          const next = owner.lose(map[i][0], ui.special).set("type", "loseToExpansion").set("forceDie", true).set("getlx", false);
          if (event.visible == true) {
            next.visible = true;
          }
          event.relatedLose = next;
        }
      } else {
        event.finish();
      }
    },
    async (event, trigger, player) => {
      let { cards } = event;
      const { source } = event;
      event.cards = cards = cards.map((i) => i.cards ? i.cards : [i]).flat();
      for (let i = 0; i < cards.length; i++) {
        if (cards[i].willBeDestroyed("expansion", player, event)) {
          cards[i].selfDestroy(event);
          cards.splice(i--, 1);
        } else if (event.losing_map) {
          for (const id in event.losing_map) {
            if (event.losing_map[id][0].includes(cards[i])) {
              const source2 = (_status.connectMode ? lib.playerOL : game.playerMap)[id];
              const hs = source2.getCards("hejsx");
              if (hs.includes(cards[i])) {
                cards.splice(i--, 1);
              }
            } else {
              cards[i].addKnower(source);
            }
          }
        }
      }
      if (cards.length == 0) {
        event.finish();
        return;
      }
    },
    async (event, trigger, player) => {
      const { cards } = event;
      for (const [key, value] of lib.commonArea) {
        const list = (_status[value.areaStatusName] || []).filter((card) => cards.includes(card));
        if (event[value.fromName] || list.length) {
          const next = initializeEvent(game.createEvent(`from_${value.fromName}`), { cards });
          next.setContent(value.removeHandeler);
          next.player = player;
          next.type = event.name;
          await next;
        }
      }
    },
    async (event, trigger, player) => {
      const { cards } = event;
      const hs = player.getCards("x");
      for (let i = 0; i < cards.length; i++) {
        if (hs.includes(cards[i])) {
          cards.splice(i--, 1);
        }
      }
      for (const card of cards) {
        if (["o", "d"].includes(get.position(card, true))) {
          card.addKnower("everyone");
        }
        if (_status.discarded) {
          _status.discarded.remove(card);
        }
        for (let num2 = 0; num2 < card.vanishtag.length; num2++) {
          if (card.vanishtag[num2][0] != "_") {
            card.vanishtag.splice(num2--, 1);
          }
        }
      }
      const postAnimate = () => {
        player.$addToExpansion(cards, null, event.gaintag);
        for (const gaintag of event.gaintag) {
          player.markSkill(gaintag);
        }
      };
      let animateTime = null;
      const animate = event.animate;
      switch (animate) {
        case "draw":
          player.$draw(cards.length);
          if (event.log) {
            game.log(player, "将", get.cnNumber(cards.length), "张牌置于了武将牌上");
          }
          animateTime = 500;
          break;
        case "gain":
          player.$gain(cards, false);
          animateTime = 700;
          break;
        case "gain2":
        case "draw2": {
          animateTime = 300;
          if (player.$gain2(cards) && player === game.me) {
            animateTime = 500;
          }
          break;
        }
        case "give":
        case "giveAuto": {
          const evtmap = event.losing_map;
          if (animate === "give") {
            for (const id in evtmap) {
              const source = (_status.connectMode ? lib.playerOL : game.playerMap)[id];
              source.$give(evtmap[id][0], player, false);
              if (event.log) {
                game.log(player, "将", evtmap[id][0], "置于了武将牌上");
              }
            }
          } else {
            for (const id in evtmap) {
              const source = (_status.connectMode ? lib.playerOL : game.playerMap)[id];
              if (evtmap[id][1].length) {
                source.$giveAuto(evtmap[id][1], player, false);
                if (event.log) {
                  game.log(player, "将", get.cnNumber(evtmap[id][1].length), "张牌置于了武将牌上");
                }
              }
              if (evtmap[id][2].length) {
                source.$give(evtmap[id][2], player, false);
                if (event.log) {
                  game.log(player, "将", evtmap[id][2], "置于了武将牌上");
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
        postAnimate();
      } else {
        const waiting = typeof animateTime === "number" ? delay(get.delayx(animateTime, animateTime)) : animateTime;
        waiting.then(postAnimate).finally(() => void game.resume());
        await game.pause();
        game.delayx();
      }
      if (event.updatePile) {
        game.updateRoundNumber();
      }
    }
  ]
};
export {
  gainContent
};
