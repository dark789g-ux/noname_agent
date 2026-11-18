import "../../../../noname.js";
import { forwardEventLogSkill } from "../GameEvent/logSkill.js";
import { normalizeSelectionResult, applyLLMDecision } from "./selectionResults.js";
import { lib } from "../../index.js";
import { _status } from "../../../status/index.js";
import { game } from "../../../game/index.js";
import { get } from "../../../get/binding.js";
import { ui } from "../../../ui/index.js";
import { ai } from "../../../ai/index.js";
const chooseToGiveContent = {
  chooseToGive: [
    async (event, trigger, player) => {
      const target = event.getTarget();
      event.result = {
        bool: true,
        confirm: "ok",
        buttons: [],
        links: [],
        cards: [],
        targets: []
      };
      event.filterCard = ((event2) => {
        const filterCard = event2.filterCard;
        return (card, player2) => {
          if (!lib.filter.canBeGained(card, event2.getTarget(), player2)) {
            return false;
          }
          return filterCard.call(event2, card, player2);
        };
      })(event);
      if (event.directresult) {
        event.result.cards = event.directresult.slice(0);
        event.goto(2);
        return;
      }
      const directFilter = event.forced && typeof event.filterOk != "function" && typeof event.selectCard != "function" && !event.complexCard;
      const cards = directFilter && typeof event.filterCard == "function" ? player.getCards(event.position).filter((card) => !card.classList.contains("uncheck") && lib.filter.cardAiIncluded(card) && event.filterCard(card, player)) : [];
      const range = get.select(event.selectCard);
      if (directFilter && (range[0] >= cards.length || range[1] <= -1)) {
        if (player.isOut()) {
          event.result.cards = [];
        } else {
          event.result.cards = cards;
        }
      } else if (event.isMine()) {
        game.check();
        if (event.hsskill && !event.forced && _status.prehidden_skills.includes(event.hsskill)) {
          ui.click.cancel();
          return;
        }
        game.pause();
        if (range[1] > 1 && typeof event.selectCard != "function") {
          ui.create.cardChooseAll();
          event.aiChoose = ui.create.control("AI代选", () => {
            if (typeof event.ai == "function") {
              ai.basic.chooseCard(event.ai);
            }
            if (typeof _status.event.custom?.add?.card == "function") {
              _status.event.custom.add.card();
            }
            ui.selected.cards.forEach((i) => i.updateTransform(true));
          });
        }
        if (Array.isArray(event.dialog)) {
          event.dialog = ui.create.dialog.apply(void 0, event.dialog);
          event.dialog.open();
          event.dialog.classList.add("noselect");
        } else if (event.prompt != false) {
          let prompt;
          if (typeof event.prompt == "string") {
            prompt = event.prompt;
          } else {
            let select;
            if (range[0] == range[1]) {
              select = get.cnNumber(range[0]);
            } else if (range[1] == Infinity) {
              select = `至少${get.cnNumber(range[0])}`;
            } else {
              select = `${get.cnNumber(range[0])}至${get.cnNumber(range[1])}`;
            }
            const position = event.position == "h" ? "手" : event.position == "e" ? "装备" : "";
            prompt = `请交给${get.translation(target)}${select}张${position}牌`;
          }
          event.dialog = ui.create.dialog(prompt);
          if (event.prompt2) {
            event.dialog.addText(event.prompt2, event.prompt2.length <= 20);
          }
          if (Array.isArray(event.promptx)) {
            event.promptx.forEach((i) => event.dialog.add(i));
          }
          if (Array.isArray(event.selectCard)) {
            event.promptbar = event.dialog.add(`0/${get.numStr(event.selectCard[1], "card")}`);
            event.custom.add.card = () => {
              _status.event.promptbar.innerHTML = `${ui.selected.cards.length}/${get.numStr(_status.event.selectCard[1], "card")}`;
            };
          }
        } else if (get.itemtype(event.dialog) == "dialog") {
          event.dialog.style.display = "";
          event.dialog.open();
        }
      } else if (event.isOnline()) {
        event.send();
      } else {
        event.result = "ai";
      }
    },
    async (event, trigger, player) => {
      const { forced } = event;
      if (event.result != "ai") {
        return;
      }
      if (await applyLLMDecision(event)) {
        return;
      } else if (event.processAI) {
        event.result = event.processAI();
      } else {
        game.check();
        if ((ai.basic.chooseCard(event.ai) || forced) && (!event.filterOk || event.filterOk())) {
          ui.click.ok();
        } else if (event.skill) {
          ui.click.cancel();
          event._aiexclude.add(event.skill);
          event.redo();
          game.resume();
        } else {
          ui.click.cancel();
        }
      }
    },
    async (event, trigger, player) => {
      if (typeof event.result === "string") event.result = {};
      event.resume();
      if (event.cardChooseAll) {
        event.cardChooseAll.close();
      }
      if (event.aiChoose) {
        event.aiChoose.close();
      }
      if (event.glow_result && event.result.cards && !event.directresult) {
        event.result.cards.forEach((i) => i.classList.add("glow"));
      }
      if (event.dialog) {
        event.dialog.close();
      }
    },
    async (event, trigger, player) => {
      if (typeof event.result === "string") event.result = {};
      if (!event.result.bool || !event.result.cards || game.online) {
        event.finish();
        return;
      }
      event.cards = event.result.cards.slice(0);
      if (event.logSkill) {
        if (Array.isArray(event.logSkill)) {
          forwardEventLogSkill(player, event.logSkill);
        } else {
          player.logSkill(event.logSkill);
        }
      }
      if (event.autodelay && !event.isMine()) {
        if (typeof event.autodelay == "number") {
          game.delayx(event.autodelay);
        } else {
          game.delayx();
        }
      }
    },
    async (event, trigger, player) => {
      const { cards } = event;
      const target = event.getTarget();
      if (event.boolline) {
        player.line(target, "green");
      }
      event.done = target.gain(event.cards, player);
      event.done.gaintag.addArray(event.gaintag);
      event.done.giver = player;
      if (event.delay !== false) {
        event.done.animate = event.visibleMove ? "give" : "giveAuto";
      } else {
        target[event.visibleMove ? "$give" : "$giveAuto"](cards, player);
        if (event.visibleMove) {
          event.done.visible = true;
        }
      }
    }
  ],
  chooseToDiscard: [
    async (event, trigger, player) => {
      event.filterCard = ((event2) => {
        const filterCard = event2.filterCard;
        return (card, player2) => {
          if (!lib.filter.cardDiscardable(card, player2, event2)) {
            return false;
          }
          return filterCard.call(event2, card, player2);
        };
      })(event);
      if (_status.noclearcountdown !== "direct") {
        _status.noclearcountdown = true;
      }
      if (event.autochoose()) {
        const cards = player.getCards(event.position);
        event.result = {
          bool: true,
          autochoose: true,
          cards,
          rawcards: player.getCards(event.position)
        };
        for (let i = 0; i < cards.length; i++) {
          if (!lib.filter.cardDiscardable(cards[i], player, event)) {
            cards.splice(i--, 1);
          }
        }
      } else {
        if (game.modeSwapPlayer && !_status.auto && player.isUnderControl()) {
          game.modeSwapPlayer(player);
        }
        event.rangecards = player.getCards(event.position);
        for (let i = 0; i < event.rangecards.length; i++) {
          if (lib.filter.cardDiscardable(event.rangecards[i], player, event)) {
            event.rangecards.splice(i--, 1);
          } else {
            event.rangecards[i].uncheck("chooseToDiscard");
          }
        }
        const directFilter = event.forced && typeof event.filterOk != "function" && typeof event.selectCard != "function" && !event.complexCard;
        const cards = directFilter ? player.getCards(event.position).filter((card) => !card.classList.contains("uncheck") && lib.filter.cardAiIncluded(card) && event.filterCard(card, player)) : [];
        const range = get.select(event.selectCard);
        if (directFilter && (range[0] >= cards.length || range[1] <= -1)) {
          if (player.isOut()) {
            event.result = {
              cards: []
            };
          } else {
            event.result = {
              bool: true,
              cards
            };
          }
        } else if (event.isMine()) {
          game.check();
          if (event.hsskill && !event.forced && _status.prehidden_skills.includes(event.hsskill)) {
            ui.click.cancel();
            return;
          }
          game.pause();
          if (range[1] > 1 && typeof event.selectCard != "function") {
            ui.create.cardChooseAll();
            event.promptdiscard = ui.create.control("AI代选", () => {
              ai.basic.chooseCard(event.ai);
              if (typeof _status.event.custom?.add?.card == "function") {
                _status.event.custom.add.card();
              }
              for (const card of ui.selected.cards) {
                card.updateTransform(true);
              }
            });
          }
          if (Array.isArray(event.dialog)) {
            event.dialog = ui.create.dialog.apply(void 0, event.dialog);
            event.dialog.open();
            event.dialog.classList.add("noselect");
          } else if (event.prompt != false) {
            let str;
            if (typeof event.prompt == "string") {
              str = event.prompt;
            } else {
              str = "请弃置";
              if (range[0] == range[1]) {
                str += get.cnNumber(range[0]);
              } else if (range[1] == Infinity) {
                str += `至少${get.cnNumber(range[0])}`;
              } else {
                str += `${get.cnNumber(range[0])}至${get.cnNumber(range[1])}`;
              }
              str += "张";
              if (event.position == "h" || event.position == void 0) {
                str += "手";
              }
              if (event.position == "e") {
                str += "装备";
              }
              str += "牌";
            }
            event.dialog = ui.create.dialog(str);
            if (event.prompt2) {
              event.dialog.addText(event.prompt2, event.prompt2.length <= 20);
            }
            if (Array.isArray(event.selectCard)) {
              event.promptbar = event.dialog.add(`0/${get.numStr(event.selectCard[1], "card")}`);
              event.custom.add.card = () => {
                _status.event.promptbar.innerHTML = `${ui.selected.cards.length}/${get.numStr(_status.event.selectCard[1], "card")}`;
              };
            }
          } else if (get.itemtype(event.dialog) == "dialog") {
            event.dialog.style.display = "";
            event.dialog.open();
          }
        } else if (event.isOnline()) {
          event.result = normalizeSelectionResult(await event.sendAsync());
        } else {
          event.result = "ai";
        }
      }
    },
    async (event, trigger, player) => {
      if (event.result == "ai") {
        if (await applyLLMDecision(event)) {
          return;
        }
        if (event.processAI) {
          event.result = event.processAI();
        } else {
          game.check();
          if (((event.ai ? ai.basic.chooseCard(event.ai) : false) || event.forced) && (!event.filterOk || event.filterOk())) {
            ui.click.ok();
          } else if (event.skill) {
            const skill = event.skill;
            ui.click.cancel();
            event._aiexclude.add(skill);
            event.redo();
            game.resume();
          } else {
            ui.click.cancel();
          }
        }
      }
      if (event.rangecards) {
        for (const card of event.rangecards) {
          card.recheck("chooseToDiscard");
        }
      }
    },
    async (event, trigger, player) => {
      if (typeof event.result === "string") event.result = {};
      event.resume();
      if (event.cardChooseAll) {
        event.cardChooseAll.close();
      }
      if (typeof event.promptdiscard?.close == "function") {
        event.promptdiscard.close();
      }
      if (event.result) {
        if (event.result._sendskill) {
          lib.skill[event.result._sendskill[0]] = event.result._sendskill[1];
        }
        if (typeof event.result.skill === "string" && event.result.skill) {
          const info = get.info(event.result.skill);
          if (info && info.precontent && !game.online) {
            const next = game.createEvent(`pre_${event.result.skill}`);
            next.setContent(info.precontent);
            next.set("result", event.result);
            next.set("player", player);
            await next;
          }
        }
      }
    },
    async (event, trigger, player) => {
      if (typeof event.result === "string") event.result = {};
      if (event.result.bool && event.result.cards?.length && !game.online && event.autodelay && !event.isMine()) {
        if (typeof event.autodelay == "number") {
          await game.delayx(event.autodelay);
        } else {
          await game.delayx();
        }
      }
    },
    async (event, trigger, player) => {
      if (typeof event.result === "string") event.result = {};
      delete _status.noclearcountdown;
      if (typeof event.dialog?.close == "function") {
        event.dialog.close();
      }
      if (!game.online && event.result.bool) {
        if (event.logSkill) {
          if (typeof event.logSkill == "string") {
            player.logSkill(event.logSkill);
          } else if (Array.isArray(event.logSkill)) {
            forwardEventLogSkill(player, event.logSkill);
          }
        }
        if (!event.chooseonly) {
          const next = event.result.cards ? player.discard({ cards: event.result.cards.slice() }) : player.discard();
          if (typeof event.delay == "boolean") {
            next.delay = event.delay;
          }
          next.discarder = player;
          event.done = next;
          await next;
        }
      } else if (event._sendskill) {
        event.result._sendskill = event._sendskill;
      }
      if (!_status.noclearcountdown) {
        game.stopCountChoose();
      }
    }
  ]
};
export {
  chooseToGiveContent
};
