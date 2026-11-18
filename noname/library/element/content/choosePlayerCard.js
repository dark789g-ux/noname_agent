import "../../../../noname.js";
import { delay } from "../../../util/index.js";
import { forwardEventLogSkill } from "../GameEvent/logSkill.js";
import { applyLLMDecision, isCardLinks } from "./selectionResults.js";
import { ui } from "../../../ui/index.js";
import { get } from "../../../get/binding.js";
import { lib } from "../../index.js";
import { game } from "../../../game/index.js";
import { ai } from "../../../ai/index.js";
import { _status } from "../../../status/index.js";
const choosePlayerCardContent = {
  choosePlayerCard: [
    async (event, trigger, player) => {
      const target = event.getTarget();
      if (!event.dialog) {
        event.dialog = ui.create.dialog("hidden");
      } else if (!event.isMine()) {
        event.dialog.style.display = "none";
      }
      const select = get.select(event.selectButton);
      if (event.prompt == void 0) {
        let str = `请选择${get.translation(target)}的`;
        if (select[0] == select[1]) {
          str += get.cnNumber(select[0]);
        } else if (select[1] == Infinity) {
          str += `至少${get.cnNumber(select[0])}`;
        } else {
          str += `${get.cnNumber(select[0])}至${get.cnNumber(select[1])}`;
        }
        str += "张";
        if (event.position == "h" || event.position == void 0) {
          str += "手";
        }
        if (event.position == "e") {
          str += "装备";
        }
        str += "牌";
        event.prompt = str;
      }
      event.dialog.add(event.prompt);
      if (event.prompt2) {
        event.dialog.addText(event.prompt2);
      }
      let expand_length = 0;
      const cs = target.getCards(event.position);
      const directFilter = event.forced && typeof event.filterOk != "function" && typeof event.selectButton != "function" && event.filterButton == lib.filter.all;
      let directh = !lib.config.unauto_choose && !event.isOnline() && select[0] == select[1] && (!event.complexSelect || select[1] === 1);
      for (const position of event.position) {
        if (position == "h") {
          const hs = target.getCards("h");
          if (hs.length) {
            expand_length += Math.ceil(hs.length / 6);
            const title = event.dialog.add('<div class="text center" style="margin: 0px;">手牌区</div>');
            title.style.margin = "0px";
            title.style.padding = "0px";
            hs.randomSort();
            if (event.visible || target.isUnderControl(true, player) || player.hasSkillTag("viewHandcard", null, target, true)) {
              event.dialog.add(hs);
              directh = false;
            } else {
              const shown = hs.filter((card) => get.is.shownCard(card));
              if (shown.length) {
                const hidden = hs.filter((card) => !shown.includes(card));
                const buttons = ui.create.div(".buttons", event.dialog.content);
                event.dialog.buttons = event.dialog.buttons.concat(ui.create.buttons(shown, "card", buttons));
                event.dialog.buttons = event.dialog.buttons.concat(ui.create.buttons(hidden, "blank", buttons));
                if (event.dialog.forcebutton !== false) {
                  event.dialog.forcebutton = true;
                }
                if (event.dialog.buttons.length > 3) {
                  event.dialog.classList.remove("forcebutton-auto");
                } else if (!event.dialog.noforcebutton) {
                  event.dialog.classList.add("forcebutton-auto");
                }
                directh = false;
              } else {
                event.dialog.add([hs, "blank"]);
              }
            }
          }
        } else if (position == "e") {
          const es = target.getCards("e");
          if (es.length) {
            expand_length += Math.ceil(es.length / 6);
            const title = event.dialog.add('<div class="text center" style="margin: 0px;">装备区</div>');
            title.style.margin = "0px";
            title.style.padding = "0px";
            event.dialog.add(es);
            directh = false;
          }
        } else if (position == "j") {
          const js = target.getCards("j");
          if (js.length) {
            expand_length += Math.ceil(js.length / 6);
            const title = event.dialog.add('<div class="text center" style="margin: 0px;">判定区</div>');
            title.style.margin = "0px";
            title.style.padding = "0px";
            const shown = js.filter((card) => {
              const name = card.viewAs || card.name;
              const info = lib.card[name];
              if (!info || !info.blankCard) {
                return true;
              }
              return false;
            });
            if (shown.length < js.length && !target.isUnderControl(true)) {
              const hidden = js.filter((card) => !shown.includes(card));
              const buttons = ui.create.div(".buttons", event.dialog.content);
              event.dialog.buttons = event.dialog.buttons.concat(ui.create.buttons(shown, "card", buttons));
              event.dialog.buttons = event.dialog.buttons.concat(ui.create.buttons(hidden, "blank", buttons));
              if (event.dialog.forcebutton !== false) {
                event.dialog.forcebutton = true;
              }
              if (event.dialog.buttons.length > 3) {
                event.dialog.classList.remove("forcebutton-auto");
              } else if (!event.dialog.noforcebutton) {
                event.dialog.classList.add("forcebutton-auto");
              }
            } else {
              event.dialog.add(js);
            }
            directh = false;
          }
        }
      }
      if (event.dialog.buttons.length == 0) {
        event.finish();
        return;
      }
      if (directFilter && select[0] >= cs.length) {
        event.result = {
          bool: true,
          buttons: event.dialog.buttons,
          links: cs
        };
      } else if (directFilter && directh) {
        const buttons = event.dialog.buttons.randomGets(select[0]);
        event.result = {
          bool: true,
          buttons,
          links: []
        };
        for (const button of buttons) {
          event.result.links?.push(button.link);
        }
      } else {
        if (event.isMine()) {
          if (event.hsskill && !event.forced && _status.prehidden_skills.includes(event.hsskill)) {
            ui.click.cancel();
            return;
          }
          event.dialog.open();
          ui.create.buttonChooseAll();
          game.check();
          game.pause();
          if (expand_length > 2) {
            ui.arena.classList.add("choose-player-card");
            event.dialog.classList.add("fullheight");
          }
        } else if (event.isOnline()) {
          event.send();
        } else {
          event.result = "ai";
        }
      }
    },
    async (event, trigger, player) => {
      const { forced } = event;
      if (event.result == "ai" && !await applyLLMDecision(event)) {
        game.check();
        if ((ai.basic.chooseButton(event.ai) || forced) && (!event.filterOk || event.filterOk())) {
          ui.click.ok();
        } else {
          ui.click.cancel();
        }
      }
      event.dialog.close();
      if (typeof event.result !== "string" && isCardLinks(event.result.links)) {
        event.result.cards = event.result.links.slice(0);
      }
      event.resume();
      delay(500).then(() => void ui.arena.classList.remove("choose-player-card"));
    }
  ],
  discardPlayerCard: [
    async (event, trigger, player) => {
      const target = event.getTarget();
      if (event.directresult) {
        event.result = {
          buttons: [],
          cards: event.directresult.slice(0),
          links: event.directresult.slice(0),
          targets: [],
          confirm: "ok",
          bool: true
        };
        event.cards = event.directresult.slice(0);
        event.goto(2);
        return;
      }
      if (!event.dialog) {
        event.dialog = ui.create.dialog("hidden");
      } else if (!event.isMine()) {
        event.dialog.style.display = "none";
      }
      if (event.prompt == null) {
        let str = `弃置${get.translation(target)}`;
        const range = get.select(event.selectButton);
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
        event.prompt = str;
      }
      if (event.prompt) {
        event.dialog.add(event.prompt);
      }
      if (event.prompt2) {
        event.dialog.addText(event.prompt2);
      }
      let expand_length = 0;
      const cs = target.getCards(event.position);
      const select = get.select(event.selectButton);
      const directFilter = event.forced && typeof event.filterOk != "function" && typeof event.selectButton != "function" && event.filterButton == lib.filter.all;
      let directh = !lib.config.unauto_choose && !event.isOnline() && select[0] == select[1] && (!event.complexSelect || select[1] === 1);
      for (const position of event.position) {
        if (position == "h") {
          const hs = target.getDiscardableCards(player, "h");
          expand_length += Math.ceil(hs.length / 6);
          if (hs.length) {
            const title = event.dialog.add('<div class="text center" style="margin: 0px;">手牌区</div>');
            title.style.margin = "0px";
            title.style.padding = "0px";
            hs.randomSort();
            if (event.visible || target.isUnderControl(true, player) || player.hasSkillTag("viewHandcard", null, target, true)) {
              event.dialog.add(hs);
              directh = false;
            } else {
              const shown = hs.filter((card) => get.is.shownCard(card));
              if (shown.length) {
                const hidden = hs.filter((card) => !shown.includes(card));
                const buttons = ui.create.div(".buttons", event.dialog.content);
                event.dialog.buttons = event.dialog.buttons.concat(ui.create.buttons(shown, "card", buttons));
                event.dialog.buttons = event.dialog.buttons.concat(ui.create.buttons(hidden, "blank", buttons));
                if (event.dialog.forcebutton !== false) {
                  event.dialog.forcebutton = true;
                }
                if (event.dialog.buttons.length > 3) {
                  event.dialog.classList.remove("forcebutton-auto");
                } else if (!event.dialog.noforcebutton) {
                  event.dialog.classList.add("forcebutton-auto");
                }
                directh = false;
              } else {
                event.dialog.add([hs, "blank"]);
              }
            }
          }
        } else if (position == "e") {
          const es = target.getDiscardableCards(player, "e");
          if (es.length) {
            expand_length += Math.ceil(es.length / 6);
            const title = event.dialog.add('<div class="text center" style="margin: 0px;">装备区</div>');
            title.style.margin = "0px";
            title.style.padding = "0px";
            event.dialog.add(es);
            directh = false;
          }
        } else if (position == "j") {
          const js = target.getDiscardableCards(player, "j");
          if (js.length) {
            expand_length += Math.ceil(js.length / 6);
            const title = event.dialog.add('<div class="text center" style="margin: 0px;">判定区</div>');
            title.style.margin = "0px";
            title.style.padding = "0px";
            const shown = js.filter((card) => {
              const name = card.viewAs || card.name;
              const info = lib.card[name];
              if (!info || !info.blankCard) {
                return true;
              }
              return false;
            });
            if (shown.length < js.length && !target.isUnderControl(true)) {
              const hidden = js.filter((card) => !shown.includes(card));
              const buttons = ui.create.div(".buttons", event.dialog.content);
              event.dialog.buttons = event.dialog.buttons.concat(ui.create.buttons(shown, "card", buttons));
              event.dialog.buttons = event.dialog.buttons.concat(ui.create.buttons(hidden, "blank", buttons));
              if (event.dialog.forcebutton !== false) {
                event.dialog.forcebutton = true;
              }
              if (event.dialog.buttons.length > 3) {
                event.dialog.classList.remove("forcebutton-auto");
              } else if (!event.dialog.noforcebutton) {
                event.dialog.classList.add("forcebutton-auto");
              }
            } else {
              event.dialog.add(js);
            }
            directh = false;
          }
        }
      }
      if (event.dialog.buttons.length == 0) {
        event.result = {
          bool: false
        };
        event.dialog.close();
        event.finish();
        return;
      }
      if (directFilter && select[0] >= cs.length) {
        event.result = {
          bool: true,
          buttons: event.dialog.buttons,
          links: cs
        };
      } else if (directFilter && directh) {
        const buttons = event.dialog.buttons.randomGets(select[0]);
        event.result = {
          bool: true,
          buttons,
          links: []
        };
        for (const button of buttons) {
          event.result.links?.push(button.link);
        }
      } else {
        if (event.isMine()) {
          event.dialog.open();
          ui.create.buttonChooseAll();
          game.check();
          game.pause();
          if (expand_length > 2) {
            ui.arena.classList.add("discard-player-card");
            event.dialog.classList.add("fullheight");
          }
        } else if (event.isOnline()) {
          event.send();
        } else {
          event.result = "ai";
        }
      }
    },
    async (event, trigger, player) => {
      const { forced } = event;
      if (event.result == "ai" && !await applyLLMDecision(event)) {
        game.check();
        if ((ai.basic.chooseButton(event.ai) || forced) && (!event.filterOk || event.filterOk())) {
          ui.click.ok();
        } else {
          ui.click.cancel();
        }
      }
      event.dialog.close();
    },
    async (event, trigger, player) => {
      event.resume();
      delay(500).then(() => void ui.arena.classList.remove("discard-player-card"));
      if (typeof event.result !== "string" && event.result.bool && isCardLinks(event.result.links) && !game.online) {
        if (event.logSkill) {
          if (typeof event.logSkill == "string") {
            player.logSkill(event.logSkill);
          } else if (Array.isArray(event.logSkill)) {
            forwardEventLogSkill(player, event.logSkill);
          }
        }
        const cards = event.result.links.slice(0);
        event.result.cards = cards.slice(0);
        event.cards = cards;
        await event.trigger("rewriteDiscardResult");
      }
    },
    async (event, trigger, player) => {
      const target = event.getTarget();
      if (event.boolline) {
        player.line(target, "green");
      }
      if (!event.chooseonly) {
        const next = target.discard(event.cards);
        next.discarder = player;
        event.done = next;
        if (event.delay === false) {
          next.set("delay", false);
        }
        await next;
      }
    }
  ]
};
export {
  choosePlayerCardContent
};
