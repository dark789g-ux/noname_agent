import "../../../../noname.js";
import { delay } from "../../../util/index.js";
import { requireRegisteredSkill } from "../../skillRegistry.js";
import { normalizeSelectionResult } from "./selectionResults.js";
import { game } from "../../../game/index.js";
import { ui } from "../../../ui/index.js";
import { _status } from "../../../status/index.js";
import { lib } from "../../index.js";
import { get } from "../../../get/binding.js";
const createTriggerContent = {
  async createTrigger(event, trigger, player) {
    const requireSkill = () => {
      if (!event.skill) {
        throw new TypeError("createTrigger requires an event skill");
      }
      return event.skill;
    };
    let skill = requireSkill();
    const info = get.info(skill);
    if (!game.expandSkills(player.getSkills().concat(lib.skill.global)).includes(skill) && !event.uncheckHasSkill) {
      const hidden = player.hiddenSkills.slice(0);
      const invisible = player.invisibleSkills.slice(0);
      game.expandSkills(hidden);
      game.expandSkills(invisible);
      if (hidden.includes(skill)) {
        if (!info.silent && player.hasSkillTag("nomingzhi", false, null, true)) {
          return;
        } else if (!info.direct && typeof info.cost !== "function" || get.is.locked(skill, player) && typeof info.cost == "function") {
          await event.trigger("triggerHidden");
        } else {
          event.skillHidden = true;
        }
      } else if (invisible.includes(skill)) {
        await event.trigger("triggerInvisible");
      } else {
        let flag = true;
        for (const skill2 in player.additionalSkills) {
          if (skill2.startsWith("hidden:")) {
            continue;
          }
          if (!game.expandSkills(player.additionalSkills[skill2]).includes(skill2)) {
            continue;
          }
          flag = false;
          break;
        }
        if (flag) {
          return;
        }
      }
    }
    skill = requireSkill();
    if (event.cancelled) {
      return;
    }
    if (skill.startsWith("player_when_")) {
      requireRegisteredSkill(lib.skill, skill).triggered = true;
    }
    let result;
    if (event.revealed || info.forced) {
      result = { bool: true };
    } else {
      const checkFrequent = (info2) => {
        if (player.hasSkillTag("nofrequent", false, skill)) {
          return false;
        }
        if (typeof info2.frequent == "boolean") {
          return info2.frequent;
        }
        if (typeof info2.frequent == "function") {
          return info2.frequent(trigger, player, event.triggername, event.indexedData);
        }
        if (info2.frequent == "check" && typeof info2.check == "function") {
          return info2.check(trigger, player, event.triggername, event.indexedData);
        }
        return false;
      };
      if (info.direct) {
        if (player.isUnderControl()) {
          game.swapPlayerAuto(player);
        }
        result = { bool: true };
        event._direct = true;
      } else if (typeof info.cost === "function") {
        if (checkFrequent(info)) {
          event.frequentSkill = true;
        }
        if (player.isUnderControl()) {
          game.swapPlayerAuto(player);
        }
        const next2 = game.createEvent(`${skill}_cost`);
        next2.player = player;
        if (event.frequentSkill) {
          next2.set("frequentSkill", skill);
        }
        next2.set("forceDie", true);
        next2.set("includeOut", true);
        next2._trigger = trigger;
        next2.triggername = event.triggername;
        next2.skillHidden = event.skillHidden;
        next2.indexedData = event.indexedData;
        if (info.forceDie) {
          next2.forceDie = true;
        }
        if (info.forceOut) {
          next2.includeOut = true;
        }
        next2.skill = skill;
        next2.setContent(info.cost);
        result = normalizeSelectionResult(await next2.forResult());
      } else {
        if (checkFrequent(info)) {
          event.frequentSkill = true;
        }
        let str;
        const check = info.check;
        if (info.prompt) {
          str = info.prompt;
        } else if (typeof info.logTarget == "string") {
          const logTarget = trigger[info.logTarget];
          str = logTarget && !Array.isArray(logTarget) && typeof logTarget !== "string" ? get.prompt(skill, logTarget, player) : get.prompt(skill, void 0, player);
        } else if (typeof info.logTarget == "function") {
          const logTarget = info.logTarget(trigger, player, event.triggername, event.indexedData);
          if (logTarget && !Array.isArray(logTarget) && typeof logTarget !== "string") {
            str = get.prompt(skill, logTarget, player);
          } else {
            str = get.prompt(skill, void 0, player);
          }
        } else {
          str = get.prompt(skill, void 0, player);
        }
        if (typeof str == "function") {
          str = str(trigger, player, event.triggername, event.indexedData);
        }
        const next2 = player.chooseBool(str);
        if (event.frequentSkill) {
          next2.set("frequentSkill", skill);
        }
        next2.set("forceDie", true);
        next2.set("includeOut", true);
        next2.set("ai", () => !check || check(trigger, player, event.triggername, event.indexedData));
        if (typeof info.prompt2 == "function") {
          next2.set("prompt2", info.prompt2(trigger, player, event.triggername, event.indexedData));
        } else if (typeof info.prompt2 == "string") {
          next2.set("prompt2", info.prompt2);
        } else if (info.prompt2 != false) {
          if (lib.dynamicTranslate[skill]) {
            next2.set("prompt2", lib.dynamicTranslate[skill](player, skill));
          } else if (lib.translate[`${skill}_info`]) {
            next2.set("prompt2", lib.translate[`${skill}_info`]);
          }
        }
        if (trigger.skillwarn) {
          if (next2.prompt2) {
            next2.set("prompt2", `<span class="thundertext">${trigger.skillwarn}。</span>${next2.prompt2}`);
          } else {
            next2.set("prompt2", trigger.skillwarn);
          }
        }
        result = normalizeSelectionResult(await next2.forResult());
      }
    }
    skill = requireSkill();
    if (typeof result !== "string" && result.control) {
      result.bool = !result.control.includes("cancel");
    }
    if (typeof result === "string" || !result.bool) {
      if (info.oncancel) {
        info.oncancel(trigger, player);
      }
      if (event.indexedData === true) {
        event.result = "cancelled";
      }
      return;
    }
    let autodelay = info.autodelay;
    if (typeof autodelay == "function") {
      autodelay = autodelay(trigger, player);
    }
    if (autodelay && (info.forced || !event.isMine())) {
      if (typeof autodelay == "number") {
        await game.delayx(autodelay);
      } else {
        await game.delayx();
      }
    }
    skill = requireSkill();
    let targets = null;
    if (Array.isArray(result.targets) && result.targets.length > 0) {
      targets = result.targets.slice(0);
    } else if (info.logTarget) {
      if (typeof info.logTarget === "string") {
        const logTarget = trigger[info.logTarget];
        if (Array.isArray(logTarget)) {
          targets = logTarget;
        } else if (logTarget && typeof logTarget !== "string") {
          targets = logTarget;
        }
      } else if (typeof info.logTarget === "function") {
        const logTarget = info.logTarget(trigger, player, event.triggername, event.indexedData);
        if (Array.isArray(logTarget)) {
          targets = logTarget;
        } else if (logTarget && typeof logTarget !== "string") {
          targets = logTarget;
        }
      }
    }
    if (targets && !Array.isArray(targets)) {
      targets = [targets];
    }
    if (info.popup != false && !info.direct && !("skill_popup" in result && !result["skill_popup"])) {
      const popup_info = typeof info.popup === "string" ? [skill, info.popup] : skill;
      const args = [trigger, player, event.triggername, event.indexedData, result];
      player.logSkill(popup_info, info.logLine === false ? null : targets, info.line, null, args);
    }
    if (info.usable !== void 0) {
      player.getStat("triggerSkill")[skill] ??= 0;
      player.getStat("triggerSkill")[skill]++;
    }
    const finalizeTrigger = async () => {
      const finalizedSkill = requireSkill();
      if (finalizedSkill.startsWith("player_when_")) {
        player.removeSkill(finalizedSkill);
        game.broadcastAll((skill2) => {
          delete lib.skill[skill2];
          delete lib.translate[skill2];
        }, finalizedSkill);
      }
      if (!player._hookTrigger) {
        return;
      }
      if (player._hookTrigger.some((i) => {
        const info2 = requireRegisteredSkill(lib.skill, i).hookTrigger;
        return info2 && info2.after && info2.after(event, player, event.triggername);
      })) {
        await event.trigger("triggerAfter");
      }
    };
    if (!info.content) {
      await finalizeTrigger();
      return;
    }
    const next = game.createEvent(skill);
    next.player = player;
    next._trigger = trigger;
    next.triggername = event.triggername;
    next.setContent(info.content);
    next.skillHidden = event.skillHidden;
    if (info.forceDie) {
      next.forceDie = true;
    }
    if (info.forceOut) {
      next.includeOut = true;
    }
    if (Array.isArray(targets)) {
      next.targets = targets.slice(0);
    }
    if (typeof result !== "string" && Array.isArray(result.cards)) {
      next.cards = result.cards.slice(0);
    }
    if (typeof result !== "string" && result.cost_data !== void 0) {
      next.cost_data = result.cost_data;
    }
    next.indexedData = event.indexedData;
    await next;
    await finalizeTrigger();
  },
  async playVideoContent(event, trigger, player) {
    await game.delay(0, 500);
    if (!game.chess) {
      ui.control.innerHTML = "";
      const nodes = [...ui.arena.childNodes];
      for (const node of nodes) {
        if (node == ui.canvas) {
          continue;
        }
        if (node == ui.control) {
          continue;
        }
        if (node == ui.mebg) {
          continue;
        }
        if (node == ui.me) {
          continue;
        }
        if (node == ui.roundmenu) {
          continue;
        }
        node.remove();
      }
      ui.sidebar.innerHTML = "";
      ui.cardPile.innerHTML = "";
      ui.discardPile.innerHTML = "";
      ui.special.innerHTML = "";
      ui.ordering.innerHTML = "";
    }
    const systemFirst = ui.system.firstElementChild;
    const systemLast = ui.system.lastElementChild;
    if (!(systemFirst instanceof HTMLElement) || !(systemLast instanceof HTMLElement)) {
      return;
    }
    systemFirst.innerHTML = "";
    systemLast.innerHTML = "";
    systemFirst.appendChild(ui.config2);
    if (ui.updateVideoMenu) {
      ui.updateVideoMenu();
    }
    _status.videoDuration = 1 / parseFloat(lib.config.video_default_play_speed.slice(0, -1));
    ui.create.system("返回", () => {
      const mode = localStorage.getItem(`${lib.configprefix}playbackmode`);
      if (mode) {
        game.saveConfig("mode", mode);
      }
      game.reload();
    });
    ui.create.system("重播", () => {
      _status.replayvideo = true;
      const mode = lib.config.mode;
      const playback = _status.playback;
      if (mode && playback) {
        game.playVideo(playback, mode);
      }
    });
    ui.create.system("暂停", ui.click.pause, true).id = "pausebutton";
    const atempo = ui.create.system(
      "原速",
      () => {
        _status.videoDuration = 1;
        updateDuration();
      },
      true
    );
    const slow = ui.create.system(
      "减速",
      () => {
        _status.videoDuration *= 1.5;
        updateDuration();
      },
      true
    );
    const fast = ui.create.system(
      "加速",
      () => {
        _status.videoDuration /= 1.5;
        updateDuration();
      },
      true
    );
    const updateDuration = () => {
      atempo.innerHTML = `原速(当前${Math.round(100 / _status.videoDuration) / 100}倍速)`;
      if (_status.videoDuration > 1) {
        slow.classList.add("glow");
      } else {
        slow.classList.remove("glow");
      }
      if (_status.videoDuration < 1) {
        fast.classList.add("glow");
      } else {
        fast.classList.remove("glow");
      }
    };
    updateDuration();
    ui.system.style.display = "";
    ui.refresh(ui.system);
    ui.system.show();
    ui.window.show();
    if (lib.config.mode != "versus" && lib.config.mode != "boss") {
      ui.arena.style.display = "";
      ui.refresh(ui.arena);
      ui.arena.show();
    }
    if (!game.chess) {
      game.playerMap = {};
    }
    game.finishCards();
    await event.waitNext();
    while (event.video.length) {
      const content = event.video.shift();
      if (content.type == "delay") {
        await game.delay(content.content);
      } else if (content.type == "play") {
        window.play = {};
        if (!event.playtoload) {
          event.playtoload = 1;
        } else {
          event.playtoload++;
        }
        const script = lib.init.js(`${lib.assetURL}play`, content.name);
        let cleaned = false;
        const cleanup = () => {
          if (cleaned) {
            return;
          }
          cleaned = true;
          if (event.playtoload > 0) {
            event.playtoload--;
          }
          if (event.playtoload == 0) {
            delete window.play;
          }
        };
        if (!script) {
          cleanup();
          continue;
        }
        script.addEventListener(
          "load",
          () => {
            const play = window.play;
            const video = play?.[content.name];
            try {
              video?.video?.(content.init);
            } finally {
              cleanup();
            }
          },
          { once: true }
        );
        script.addEventListener("error", cleanup, { once: true });
      } else if (typeof content.player == "string" && game.playerMap[content.player] && game.playerMap[content.player].classList && !game.playerMap[content.player].classList.contains("obstacle")) {
        await game.videoContent[content.type](game.playerMap[content.player], content.content);
      } else {
        await game.videoContent[content.type](content.content);
      }
      if (event.video.length) {
        await game.delay(0, _status.videoDuration * Math.min(2e3, event.video[0].delay));
      }
      await event.waitNext();
    }
    _status.over = true;
    const finalSystem = ui.system.lastElementChild;
    if (finalSystem && "hide" in finalSystem && typeof finalSystem.hide === "function") {
      finalSystem.hide();
      delay(500).then(() => void (finalSystem.innerHTML = ""));
    }
  }
};
export {
  createTriggerContent
};
