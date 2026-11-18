import "../../../../noname.js";
import { forwardEventLogSkill } from "../GameEvent/logSkill.js";
import { normalizeSelectionResult, applyLLMDecision } from "./selectionResults.js";
import { get } from "../../../get/binding.js";
import { lib } from "../../index.js";
import { ui } from "../../../ui/index.js";
import { _status } from "../../../status/index.js";
import { game } from "../../../game/index.js";
const chooseControlContent = {
  chooseControl: [
    async (event, trigger, player) => {
      if (event.controls.length == 0) {
        if (event.sortcard) {
          let sortnum = 2;
          if (event.sorttop) {
            sortnum = 1;
          }
          for (let i = 0; i < event.sortcard.length + sortnum; i++) {
            event.controls.push(get.cnNumber(i, true));
          }
        } else if (event.choiceList) {
          for (const [i] of event.choiceList.entries()) {
            event.controls.push(`选项${get.cnNumber(i + 1, true)}`);
          }
        } else {
          event.finish();
          return;
        }
      } else if (event.choiceList && event.controls.length == 1 && event.controls[0] == "cancel2") {
        event.controls.shift();
        for (const [i] of event.choiceList.entries()) {
          event.controls.push(`选项${get.cnNumber(i + 1, true)}`);
        }
        event.controls.push("cancel2");
      }
      if (event.isMine()) {
        if (event.arrangeSkill) {
          const hidden = player.hiddenSkills.slice(0);
          game.expandSkills(hidden);
          if (hidden.length) {
            for (const control of event.controls) {
              if (_status.prehidden_skills.includes(control) && hidden.includes(control)) {
                event.result = {
                  bool: true,
                  control
                };
                return;
              }
            }
          }
        } else if (event.hsskill && _status.prehidden_skills.includes(event.hsskill) && event.controls.includes("cancel2")) {
          event.result = {
            bool: true,
            control: "cancel2"
          };
          return;
        }
        if (event.sortcard) {
          let prompt = event.prompt || "选择一个位置";
          if (event.tosort) {
            prompt += `放置${get.translation(event.tosort)}`;
          }
          event.dialog = ui.create.dialog(prompt, "hidden");
          if (event.sortcard && event.sortcard.length) {
            event.dialog.addSmall(event.sortcard);
          } else {
            event.dialog.buttons = [];
            event.dialog.add(ui.create.div(".buttons"));
          }
          const buttons = event.dialog.content.lastChild;
          let sortnum = 2;
          if (event.sorttop) {
            sortnum = 1;
          }
          for (let i = 0; i < event.dialog.buttons.length + sortnum; i++) {
            const item = Object.assign(ui.create.div(".button.card.pointerdiv.mebg"), { link: String(get.cnNumber(i, true)) });
            item.style.width = "50px";
            buttons.insertBefore(item, event.dialog.buttons[i]);
            item.innerHTML = `<div style="font-family: xinwei;font-size: 25px;height: 75px;line-height: 25px;top: 8px;left: 10px;width: 30px;">第${get.cnNumber(i + 1, true)}张</div>`;
            if (i == event.dialog.buttons.length + 1) {
              const firstChild = item.firstChild;
              if (firstChild instanceof HTMLElement) {
                firstChild.innerHTML = "牌堆底";
              }
            }
            item.listen(ui.click.dialogcontrol);
          }
          event.dialog.forcebutton = true;
          event.dialog.classList.add("forcebutton");
          event.dialog.open();
        } else if (event.dialogcontrol) {
          event.dialog = ui.create.dialog(event.prompt || "选择一项", "hidden");
          for (const control of event.controls) {
            const item = event.dialog.add(`<div class="popup text pointerdiv" style="width:calc(100% - 10px);display:inline-block">${control}</div>`);
            item.firstChild.listen(ui.click.dialogcontrol);
            item.firstChild.link = control;
          }
          event.dialog.forcebutton = true;
          event.dialog.classList.add("forcebutton");
          if (event.addDialog) {
            for (const dialog of event.addDialog) {
              if (get.itemtype(dialog) == "cards") {
                event.dialog.addSmall(dialog);
              } else {
                event.dialog.add(dialog);
              }
            }
            event.dialog.add(ui.create.div(".placeholder.slim"));
          }
          event.dialog.open();
        } else {
          if (event.seperate || lib.config.seperate_control) {
            const controls = event.controls.slice(0);
            controls.remove("cancel2");
            if (event.direct && controls.length == 1 || event.forceDirect) {
              event.result = {
                control: event.controls[0],
                links: get.links([event.controls[0]])
              };
              return;
            } else {
              event.controlbars = [];
              for (const control of event.controls) {
                event.controlbars.push(ui.create.control([control]));
              }
            }
          } else {
            const controls = event.controls.slice(0);
            controls.remove("cancel2");
            if (event.direct && controls.length == 1 || event.forceDirect) {
              event.result = {
                control: event.controls[0],
                links: get.links([event.controls[0]])
              };
              return;
            }
            event.controlbar = ui.create.control(event.controls);
          }
          if (event.dialog) {
            if (Array.isArray(event.dialog)) {
              event.dialog = ui.create.dialog.apply(void 0, event.dialog);
            }
            event.dialog.open();
          } else if (event.choiceList) {
            event.dialog = ui.create.dialog(event.prompt || "选择一项", "hidden");
            event.dialog.forcebutton = true;
            event.dialog.open();
            for (const [i, choice] of event.choiceList.entries()) {
              event.dialog.add(`<div class="popup text" style="width:calc(100% - 10px);display:inline-block">${event.displayIndex !== false ? `选项${get.cnNumber(i + 1, true)}：` : ""}${choice}</div>`);
            }
          } else if (event.prompt) {
            event.dialog = ui.create.dialog(event.prompt);
            if (event.prompt2) {
              event.dialog.addText(event.prompt2, Boolean(event.prompt2.length <= 20 || event.centerprompt2));
            }
          }
        }
        game.pause();
        game.countChoose();
        event.choosing = true;
      } else if (event.isOnline()) {
        event.send();
      } else {
        event.result = "ai";
      }
    },
    async (event, trigger, player) => {
      if (event.result == "ai") {
        if (await applyLLMDecision(event)) {
        } else {
          event.result = {};
          if (event.ai) {
            const result2 = event.ai(event.getParent(), player);
            if (typeof result2 == "number") {
              event.result.control = event.controls[result2];
            } else {
              event.result.control = result2;
            }
          } else {
            event.result.control = event.controls[event.choice];
          }
        }
      }
      const result = normalizeSelectionResult(event.result);
      if (typeof result !== "string") {
        result.index = event.controls.indexOf(result.control);
      }
      event.result = result;
      event.choosing = false;
      _status.imchoosing = false;
      if (event.dialog && event.dialog.close) {
        event.dialog.close();
      }
      if (event.controlbar) {
        event.controlbar.close();
      }
      if (event.controlbars) {
        for (const controlBar of event.controlbars) {
          controlBar.close();
        }
      }
      event.resume();
    }
  ],
  async chooseBool(event, trigger, player) {
    if (event.isMine()) {
      if (event.frequentSkill && !lib.config.autoskilllist.includes(event.frequentSkill)) {
        ui.click.ok();
        return;
      } else if (event.hsskill && _status.prehidden_skills.includes(event.hsskill)) {
        ui.click.cancel();
        return;
      }
      ui.create.confirm("oc");
      if (event.createDialog && !event.dialog) {
        if (Array.isArray(event.createDialog)) {
          event.dialog = ui.create.dialog.apply(this, event.createDialog);
          if (event.dialogselectx) {
            for (const button of event.dialog.buttons) {
              button.classList.add("selectedx");
            }
          }
        }
      }
      if (event.dialog) {
        event.dialog.open();
      } else if (event.prompt) {
        event.dialog = ui.create.dialog(event.prompt);
        if (event.prompt2) {
          event.dialog.addText(event.prompt2, event.prompt2.length <= 20);
        }
      }
      game.countChoose();
      event.choosing = true;
      await game.pause();
    } else if (event.isOnline()) {
      const result = await event.sendAsync();
      event.result = normalizeSelectionResult(result);
    } else {
      event.result = "ai";
    }
    if (event.result == "ai") {
      if (!await applyLLMDecision(event)) {
        if (event.ai) {
          event.choice = event.ai(event.getParent(), player);
        }
        event.result = { bool: event.choice };
      }
    }
    _status.imchoosing = false;
    event.choosing = false;
    if (event.dialog) {
      event.dialog.close();
    }
    game.resume();
  },
  async chooseDrawRecover(event, trigger, player) {
    const { forced } = event;
    const target = event.getTarget();
    const controls = ["draw_card"];
    if (target.isDamaged()) {
      event.num2 = Math.min(event.num2, target.getDamagedHp());
      controls.push("recover_hp");
    }
    if (!forced) {
      controls.push("cancel2");
    }
    let result;
    if (controls.length == 1) {
      result = { control: controls[0] };
    } else {
      const prompt = event.prompt || (() => {
        let str = ``;
        if (!forced) {
          str += `是否`;
        }
        if (player !== target) {
          str += `令${get.translation(target)}`;
        }
        str += `摸${get.cnNumber(event.num1)}张牌`;
        if (target.isDamaged()) {
          str += `或回复${event.num2}点体力`;
        }
        if (!forced) {
          str += `？`;
        }
        return str;
      })();
      const next = player.chooseControl(controls);
      next.set("prompt", prompt);
      if (event.hsskill) {
        next.setHiddenSkill(event.hsskill);
      }
      next.set(
        "ai",
        event.ai || (() => {
          const player2 = get.player();
          const parent = get.event().getParent(void 0, true);
          if (!parent) {
            throw new Error("chooseDrawRecover requires a parent event.");
          }
          const target2 = parent.getTarget();
          const { num1, num2 } = parent;
          const att = get.attitude(player2, target2);
          const choices = get.event().controls.slice();
          const eff1 = get.recoverEffect(target2, player2, player2);
          const eff2 = get.effect(target2, { name: "draw" }, player2, player2) * 2;
          if (choices.includes("recover_hp") && eff1 > 0 && (target2.hp == 1 || target2.needsToDiscard() || target2.hasSkillTag("maixie_hp") || num2 > num1 || num2 == num1 && target2.needsToDiscard(1))) {
            return "recover_hp";
          }
          if (eff2 > 0) {
            return "draw_card";
          }
          if (choices.includes("cancel2") && att <= 0) {
            return "cancel2";
          }
          return choices.randomGet();
        })
      );
      result = await next.forResult();
    }
    if (result?.control != "cancel2") {
      if (event.logSkill) {
        if (typeof event.logSkill == "string") {
          player.logSkill(event.logSkill);
        } else if (Array.isArray(event.logSkill)) {
          forwardEventLogSkill(player, event.logSkill);
        }
      }
      if (result?.control == "draw_card") {
        const next = target.draw(event.num1);
        next.gaintag.addArray(event.gaintag);
        await next;
      } else if (result?.control == "recover_hp") {
        await target.recover(event.num2);
      }
    }
    event.result = result;
  }
};
export {
  chooseControlContent
};
