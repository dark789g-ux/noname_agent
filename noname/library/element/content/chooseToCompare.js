import "../../../../noname.js";
import { getRegisteredSkill } from "../../skillRegistry.js";
import { get } from "../../../get/binding.js";
import { ui } from "../../../ui/index.js";
import { _status } from "../../../status/index.js";
import { lib } from "../../index.js";
import { game } from "../../../game/index.js";
const chooseToCompareContent = {
  chooseToCompare: [
    async (event, trigger, player) => {
      const target = event.target;
      const targetPlayer = target instanceof lib.element.Player ? target : void 0;
      if (typeof target === "string" && target === "cardPile") {
        event.compareWithCardPile = true;
        event.compareType ??= "top";
      }
      if (!event.compareWithCardPile && !targetPlayer) {
        event.finish();
        return;
      }
      if (!event.position || typeof event.position != "string") {
        event.position = "h";
      }
      const playerid = player.playerid;
      const playerHasFixedResult = typeof playerid == "string" && event.fixedResult?.[playerid] != void 0;
      const targetHasFixedResult = targetPlayer && typeof targetPlayer.playerid == "string" && event.fixedResult?.[targetPlayer.playerid] != void 0;
      if (!playerHasFixedResult && player.countCards(event.position) == 0 || !event.compareWithCardPile && targetPlayer && !targetHasFixedResult && targetPlayer.countCards(event.position) == 0) {
        event.result = { cancelled: true, bool: false };
        event.finish();
        return;
      }
      game.log(player, "对", event.compareWithCardPile ? "牌堆" : target, "发起", event.isDelay ? "延时" : "", "拼点");
      event.filterCard ??= lib.filter.all;
    },
    async (event, trigger, player) => {
      const target = event.target;
      event.list = [player, event.target instanceof lib.element.Player ? event.target : void 0].filter((current) => current instanceof lib.element.Player && (typeof current.playerid != "string" || event.fixedResult?.[current.playerid] == void 0));
      if (event.list.length) {
        player.chooseCardOL(event.list, "请选择拼点牌", true, event.position).set("small", event.small).set("filterCard", event.filterCard).set("type", "compare").set("ai", event.ai).set("source", player).aiCard = (target2) => {
          const hs = target2.getCards("h");
          const event2 = _status.event;
          const previousPlayer = event2.player;
          event2.player = target2;
          try {
            const ai2 = event2.ai;
            if (typeof ai2 == "function") {
              hs.sort((a, b) => ai2(b) - ai2(a));
            }
          } finally {
            event2.player = previousPlayer;
          }
          return { bool: true, cards: [hs[0]] };
        };
      }
    },
    async (event, trigger, player, result) => {
      const target = event.target;
      const lose_list = [];
      const playerid = player.playerid;
      if (typeof playerid == "string" && event.fixedResult?.[playerid]) {
        lose_list.push([player, [event.fixedResult[playerid]]]);
      } else {
        const skill = result[0].skill;
        const onCompare = skill ? getRegisteredSkill(lib.skill, skill)?.onCompare : void 0;
        if (skill !== void 0 && typeof onCompare == "function") {
          player.logSkill(result[0].skill);
          result[0].cards = onCompare(player);
        }
        lose_list.push([player, result[0].cards]);
      }
      event.card1 = lose_list[0][1][0];
      if (target && target !== "cardPile" && event.list.includes(target)) {
        const index = event.list.indexOf(target);
        const skill = result[index].skill;
        const onCompare = skill ? getRegisteredSkill(lib.skill, skill)?.onCompare : void 0;
        if (skill !== void 0 && typeof onCompare == "function") {
          target.logSkill(result[index].skill);
          result[index].cards = onCompare(target);
        }
        lose_list.push([target, result[index].cards]);
      } else if (target && target !== "cardPile" && typeof target.playerid == "string" && event.fixedResult?.[target.playerid]) {
        lose_list.push([target, [event.fixedResult[target.playerid]]]);
      }
      let card2;
      if (event.compareWithCardPile) {
        if (event.compareType == "top") {
          const cards = get.cards();
          if (!cards.length) {
            event.finish();
            return;
          }
          const ordering = game.cardsGotoOrdering(cards);
          if (ordering) {
            card2 = ordering.cards[0];
          }
        } else if (event.compareType == "bottom") {
          const cards = get.bottomCards();
          if (!cards.length) {
            event.finish();
            return;
          }
          const ordering = game.cardsGotoOrdering(cards);
          if (ordering) {
            card2 = ordering.cards[0];
          }
        }
      } else {
        card2 = lose_list[1][1][0];
      }
      event.card2 = card2;
      event.lose_list = lose_list;
    },
    async (event, trigger, player) => {
      const target = event.target;
      if (target && target !== "cardPile" && (event.card2.number >= 10 || event.card2.number <= 4)) {
        if (target.countCards("h") > 2) {
          event.addToAI = true;
        }
      }
    },
    async (event, trigger, player) => {
      if (event.lose_list.length) {
        game.loseAsync({
          lose_list: event.lose_list
        }).setContent("chooseToCompareLose");
      }
    },
    async (event, trigger, player) => {
      const target = event.target;
      if (event.isDelay) {
        const cards = [];
        for (const current of event.lose_list) {
          current[0].$giveAuto(current[1], current[0], false);
          cards.addArray(current[1]);
        }
        game.cardsGotoSpecial(cards);
        const evt = event;
        player.when({
          global: ["dieAfter", "phaseEnd"]
        }).assign({
          forceDie: true
        }).filter((event2, player2) => event2.name == "phase" || [player2, target].includes(event2.player)).step(async (event2, trigger2, player2) => {
          if (cards?.some((card) => get.position(card) == "s")) {
            evt.isDestroyed = true;
            await game.cardsGotoOrdering(cards);
            await game.cardsDiscard(cards);
          }
        });
        event.untrigger();
        event.finish();
      } else {
        event.trigger("compareCardShowBefore");
      }
    },
    async (event, trigger, player) => {
      game.broadcastAll(() => ui.arena.classList.add("thrownhighlight"));
      game.addVideo("thrownhighlight1");
      player.$compare(event.card1, event.compareWithCardPile ? player : event.getTarget(), event.card2);
    },
    async (event, trigger, player) => {
      const target = event.target;
      game.log(player, "的拼点牌为", event.card1);
      await player.showCards(event.card1).set("triggeronly", true);
      game.log(event.compareWithCardPile ? "牌堆" : target, "的拼点牌为", event.card2);
      if (event.compareWithCardPile) {
        await player.showCards(event.card2).set("triggeronly", true);
      } else {
        await event.getTarget().showCards(event.card2).set("triggeronly", true);
      }
      const getNum = (card) => {
        for (const i of event.lose_list) {
          if (i[1].includes(card)) {
            return get.number(card, i[0]);
          }
        }
        return get.number(card, false);
      };
      event.num1 = getNum(event.card1);
      event.num2 = getNum(event.card2);
      event.trigger("compare");
    },
    async (event, trigger, player) => {
      game.delay(0, lib.config.game_speed == "vvfast" ? 4e3 : 1500);
    },
    async (event, trigger, player) => {
      event.result = {
        player: event.card1,
        target: event.card2,
        num1: event.num1,
        num2: event.num2
      };
      event.trigger("compareFixing");
    },
    async (event, trigger, player) => {
      if (typeof event.result === "string") event.result = {};
      const target = event.target;
      if (event.forceWinner === player || event.forceWinner !== target && event.num1 > event.num2) {
        event.result.bool = true;
        event.result.winner = player;
        event.str = `${get.translation(player)}拼点成功`;
        player.popup("胜");
        if (target && target !== "cardPile" && get.itemtype(target) == "player") {
          target.popup("负");
        }
      } else {
        event.result.bool = false;
        event.str = `${get.translation(player)}拼点失败`;
        if (event.forceWinner !== target && event.num1 == event.num2) {
          event.result.tie = true;
          player.popup("平");
          if (target && target !== "cardPile" && get.itemtype(target) == "player") {
            target.popup("平");
          }
        } else {
          if (target && target !== "cardPile" && get.itemtype(target) == "player") {
            event.result.winner = target;
          }
          player.popup("负");
          if (target && target !== "cardPile" && get.itemtype(target) == "player") {
            target.popup("胜");
          }
        }
      }
    },
    async (event, trigger, player) => {
      game.broadcastAll((str) => {
        const dialog = ui.create.dialog(str);
        dialog.classList.add("center");
        setTimeout(() => dialog.close(), 1e3);
      }, event.str);
      game.delay(2);
    },
    async (event, trigger, player) => {
      if (typeof event.result === "string") event.result = {};
      const target = event.target;
      if (target && target !== "cardPile" && typeof target.ai.shown == "number" && target.ai.shown <= 0.85 && event.addToAI) {
        target.ai.shown += 0.1;
      }
      game.broadcastAll(() => ui.arena.classList.remove("thrownhighlight"));
      game.addVideo("thrownhighlight2");
      if (event.clear !== false) {
        game.broadcastAll(ui.clear);
      }
      if (typeof event.preserve == "function") {
        event.preserve = event.preserve(event.result);
      } else if (event.preserve == "win") {
        event.preserve = event.result.bool;
      } else if (event.preserve == "lose") {
        event.preserve = !event.result.bool;
      }
    }
  ],
  chooseToCompareEffect: [
    async (event, trigger, player) => {
      const evt = event.parentEvent;
      for (const key of ["target", "card1", "card2", "lose_list", "forceWinner", "clear", "preserve"]) {
        event[key] = evt[key];
      }
      event.result = {};
      if (evt.isDestroyed) {
        event.finish();
        event.untrigger();
        return;
      }
    },
    async (event, trigger, player) => {
      const target = event.getTarget();
      await game.cardsGotoOrdering([event.card1, event.card2]);
      game.log(player, "揭示了和", target, "的延时拼点结果");
      await game.delayx();
      await event.trigger("compareCardShowBefore");
    },
    async (event, trigger, player) => {
      const target = event.getTarget();
      game.broadcastAll(() => ui.arena.classList.add("thrownhighlight"));
      ui.arena.classList.add("thrownhighlight");
      game.addVideo("thrownhighlight1");
      player.$compare(event.card1, target, event.card2);
    },
    async (event, trigger, player) => {
      const target = event.getTarget();
      game.log(player, "的拼点牌为", event.card1);
      game.log(target, "的拼点牌为", event.card2);
      const getNum = (card) => {
        for (const i of event.lose_list) {
          if (i[1].includes(card)) {
            return get.number(card, i[0]);
          }
        }
        return get.number(card, false);
      };
      event.num1 = getNum(event.card1);
      event.num2 = getNum(event.card2);
      await event.trigger("compare");
    },
    async (event, trigger, player) => {
      await game.delay(0, lib.config.game_speed == "vvfast" ? 4e3 : 1500);
    },
    async (event, trigger, player) => {
      event.result = {
        player: event.card1,
        target: event.card2,
        num1: event.num1,
        num2: event.num2
      };
      await event.trigger("compareFixing");
    },
    async (event, trigger, player) => {
      if (typeof event.result === "string") event.result = {};
      const target = event.getTarget();
      if (event.forceWinner === player || event.forceWinner !== target && event.num1 > event.num2) {
        event.result.bool = true;
        event.result.winner = player;
        event.str = `${get.translation(player)}拼点成功`;
        player.popup("胜");
        target.popup("负");
      } else {
        event.result.bool = false;
        event.str = `${get.translation(player)}拼点失败`;
        if (event.forceWinner !== target && event.num1 == event.num2) {
          event.result.tie = true;
          player.popup("平");
          target.popup("平");
        } else {
          event.result.winner = target;
          player.popup("负");
          target.popup("胜");
        }
      }
    },
    async (event, trigger, player) => {
      game.broadcastAll((str) => {
        const dialog = ui.create.dialog(str);
        dialog.classList.add("center");
        setTimeout(() => dialog.close(), 1e3);
      }, event.str);
      await game.delay(2);
    },
    async (event, trigger, player) => {
      if (typeof event.result === "string") event.result = {};
      const target = event.getTarget();
      if (typeof target.ai.shown == "number" && target.ai.shown <= 0.85 && event.addToAI) {
        target.ai.shown += 0.1;
      }
      game.broadcastAll(() => ui.arena.classList.remove("thrownhighlight"));
      game.addVideo("thrownhighlight2");
      if (event.clear !== false) {
        game.broadcastAll(ui.clear);
      }
      if (typeof event.preserve == "function") {
        event.preserve = event.preserve(event.result);
      } else if (event.preserve == "win") {
        event.preserve = event.result.bool;
      } else if (event.preserve == "lose") {
        event.preserve = !event.result.bool;
      }
    },
    async (event, trigger, player) => {
      await event.trigger("chooseToCompareEnd");
      await event.trigger("chooseToCompareAfter");
    }
  ],
  async chooseSkill(event, trigger, player) {
    let list;
    const target = event.target;
    if (!target) {
      throw new Error("chooseSkill requires a target.");
    }
    if (typeof target == "string") {
      list = get.gainableSkillsName(target, event.func);
    } else {
      list = target.getGainableSkills(event.func);
    }
    if (!list.length) {
      event.result = { bool: false };
      return;
    }
    event.skillai = (list2) => get.max(list2, get.skillRank, "item");
    let result;
    if (event.isMine()) {
      const { promise, resolve } = Promise.withResolvers();
      const dialog = ui.create.dialog("forcebutton");
      dialog.add(event.prompt || "选择获得一项技能");
      _status.event.list = list;
      const clickItem = (skill) => () => {
        resolve(skill);
      };
      for (const skill of list) {
        if (lib.translate[`${skill}_info`]) {
          let translation = get.translation(skill);
          if (translation[0] == "新" && translation.length == 3) {
            translation = translation.slice(1, 3);
          } else {
            translation = translation.slice(0, 2);
          }
          const item = dialog.add(`<div class="popup pointerdiv" style="width:80%;display:inline-block"><div class="skill">【${translation}】</div><div>${lib.translate[`${skill}_info`]}</div></div>`);
          if (item instanceof HTMLDivElement) {
            const firstChild = item.firstElementChild;
            if (firstChild instanceof HTMLElement) {
              firstChild.addEventListener("click", clickItem(skill));
              Object.assign(firstChild, { link: skill });
            }
          }
        }
      }
      dialog.add(ui.create.div(".placeholder"));
      event.dialog = dialog;
      event.switchToAuto = () => {
        resolve(event.skillai(event.list));
      };
      _status.imchoosing = true;
      result = await promise;
    } else {
      result = event.skillai(list);
    }
    _status.imchoosing = false;
    if (event.dialog) {
      event.dialog.close();
    }
    event.result = { bool: true, skill: result };
  }
};
export {
  chooseToCompareContent
};
