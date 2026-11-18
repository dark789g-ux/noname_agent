import "../../../noname.js";
import { requireRegisteredSkill, getRegisteredSkill } from "../../library/skillRegistry.js";
import { game } from "../index.js";
import { ui } from "../../ui/index.js";
import { _status } from "../../status/index.js";
import { lib } from "../../library/index.js";
import { get } from "../../get/binding.js";
const arenaFinishMethods = {
  finishSkill(skillId, sub) {
    const mode = get.mode();
    const info = requireRegisteredSkill(lib.skill, skillId);
    const iInfo = `${skillId}_info`;
    if (_status.mode && lib.translate[`${iInfo}_${mode}_${_status.mode}`]) {
      lib.translate[iInfo] = lib.translate[`${iInfo}_${mode}_${_status.mode}`];
    } else if (lib.translate[`${iInfo}_${mode}`]) {
      lib.translate[iInfo] = lib.translate[`${iInfo}_${mode}`];
    } else if (lib.translate[`${iInfo}_zhu`] && (mode === "identity" || mode === "guozhan" && _status.mode === "four")) {
      lib.translate[iInfo] = lib.translate[`${iInfo}_zhu`];
    } else if (lib.translate[`${iInfo}_combat`] && get.is.versus()) {
      lib.translate[iInfo] = lib.translate[`${iInfo}_combat`];
    }
    info.skill_id ??= skillId;
    const deleteSkill = (skill, iInfo2) => {
      const { audio, audioname, audioname2, skillID } = getRegisteredSkill(lib.skill, skill) || {};
      lib.skill[skill] = { audio, audioname, audioname2, skillID };
      lib.translate[iInfo2] &&= "此模式下不可用";
      lib.dynamicTranslate[skill] &&= () => "此模式下不可用";
    };
    if (info.inherit) {
      const skill = getRegisteredSkill(lib.skill, info.inherit);
      if (skill) {
        Object.keys(skill).forEach((value) => {
          if (info[value] == null) {
            if (value === "audio" && (typeof info[value] === "number" || typeof info[value] === "boolean")) {
              info[value] = info.inherit;
            } else if (typeof skill[value] === "object") {
              info[value] = get.copy(skill[value]);
            } else {
              info[value] = skill[value];
            }
          }
        });
      }
      lib.translate[skillId] ??= lib.translate[info.inherit];
      lib.translate[iInfo] ??= lib.translate[`${info.inherit}_info`];
    }
    if (info.forbid?.includes(mode) || info.mode?.includes(mode) === false || info.available?.(mode) === false) {
      deleteSkill(skillId, iInfo);
      return;
    }
    if (info.viewAs && typeof info.viewAs !== "function") {
      if (typeof info.viewAs === "string") {
        info.viewAs = { name: info.viewAs };
      }
      if (!lib.card[info.viewAs.name]) {
        deleteSkill(skillId, iInfo);
        return;
      }
      if (info.ai == null) {
        info.ai = {};
      }
      const skill = info.ai;
      const card = lib.card[info.viewAs.name].ai;
      if (card) {
        Object.keys(card).forEach((value) => {
          if (skill[value] == null) {
            skill[value] = typeof card[value] === "object" ? get.copy(card[value]) : card[value];
          } else if (typeof skill[value] === "object") {
            Object.keys(card[value]).forEach((element) => {
              if (skill[value][element] == null) {
                skill[value][element] = card[value][element];
              }
            });
          }
        });
      }
    }
    if (info.limited) {
      info.mark ??= true;
      info.intro ??= {};
      info.intro.content ??= "limited";
      info.skillAnimation ??= true;
      info.init ??= (player, skill) => player.storage[skill] = false;
    }
    if (info.subSkill && !sub) {
      const subSkill = info.subSkill;
      Object.keys(subSkill).forEach((value) => {
        const iValue = `${skillId}_${value}`;
        lib.skill[iValue] = subSkill[value];
        const subInfo = requireRegisteredSkill(lib.skill, iValue);
        subInfo.sub = true;
        if (subSkill[value].sourceSkill === void 0) {
          subInfo.sourceSkill = skillId;
        }
        if (subSkill[value].name) {
          lib.translate[iValue] = subSkill[value].name;
        } else {
          lib.translate[iValue] = lib.translate[iValue] || lib.translate[skillId];
        }
        if (subSkill[value].description) {
          lib.translate[`${iValue}_info`] = subSkill[value].description;
        }
        if (subSkill[value].marktext) {
          lib.translate[`${iValue}_bg`] = subSkill[value].marktext;
        }
        game.finishSkill(iValue, true);
      });
    }
    if (info.round) {
      const k = `${skillId}_roundcount`;
      if (typeof info.group === "string") {
        info.group = [info.group, k];
      } else if (Array.isArray(info.group)) {
        info.group.add(k);
      } else {
        info.group = [k];
      }
      lib.skill[k] = /* @__PURE__ */ ((round, name) => ({
        init: (player) => {
          if (typeof player.storage[name] !== "number") {
            player.storage[name] = 1 - round;
          }
        },
        intro: {
          content(storage, player) {
            let str = "";
            const info2 = get.info(name.slice(0, name.indexOf("_roundcount")));
            if (info2 && info2.addintro) {
              str += info2.addintro(storage, player);
            }
            const num = round - (game.roundNumber - storage);
            if (num > 0) {
              str += `${get.cnNumber(num)}轮后${info2.roundtext || "技能重置"}`;
            } else {
              str += "技能可发动";
            }
            return str;
          },
          markcount: (storage) => Math.max(round - (game.roundNumber - storage), 0)
        },
        trigger: { global: "roundStart" },
        forced: true,
        popup: false,
        silent: true,
        async content(event, _trigger, player) {
          const key = event.name.slice(0, event.name.indexOf("_roundcount"));
          const skill = requireRegisteredSkill(lib.skill, key);
          const currentRound = skill.round;
          const elapsed = game.roundNumber - player.storage[event.name];
          if (currentRound !== void 0 && currentRound - elapsed > 0) {
            player.updateMarks();
          } else {
            player.unmarkSkill(event.name);
          }
        }
      }))(info.round, k);
      lib.translate[k] = lib.translate[skillId] || "";
      lib.translate[`${k}_bg`] = lib.translate[`${skillId}_bg`] || lib.translate[k][0];
    }
    if (info.marktext) {
      lib.translate[`${skillId}_bg`] = info.marktext;
    }
    if (info.silent) {
      if (!("forced" in info)) info.forced = true;
      if (!("popup" in info)) info.popup = false;
    }
    if (!("_priority" in info)) {
      let priority = 0;
      if (info.priority) priority = info.priority * 100;
      if (info.silent) priority++;
      if (info.equipSkill) priority -= 25;
      if (info.cardSkill) priority -= 50;
      if (info.ruleSkill) priority -= 75;
      info._priority = priority;
    }
    if (skillId[0] === "_") {
      game.addGlobalSkill(skillId);
    }
  },
  finishCard(cardId) {
    const mode = get.mode(), filterTarget = (_card, player, target) => player == target && target.canEquip(_card, true), aiBasicOrder = (card2, player) => {
      const equipValue = get.equipValue(card2, player) / 20;
      return player && player.hasSkillTag("reverseEquip") ? 8.5 - equipValue : 8 + equipValue;
    }, aiBasicValue = (card2, player, _index, method) => {
      if (!player.getCards("e").includes(card2) && !player.canEquip(card2, true)) {
        return 0.01;
      }
      const info2 = get.info(card2), current = player.getEquip(info2.subtype), value = current && card2 != current && get.value(current, player);
      let equipValue = info2.ai ? info2.ai.equipValue || info2.ai.basic && info2.ai.basic.equipValue : void 0;
      if (typeof equipValue == "function") {
        if (method == "raw") return equipValue(card2, player);
        if (method == "raw2") return equipValue(card2, player) - value;
        return Math.max(0.1, equipValue(card2, player) - value);
      }
      if (typeof equipValue != "number") equipValue = 0;
      if (method == "raw") return equipValue;
      if (method == "raw2") return equipValue - value;
      return Math.max(0.1, equipValue - value);
    }, aiResultTarget = (player, target, card2) => get.equipResult(player, target, card2);
    const info = `${cardId}_info`;
    if (lib.translate[`${info}_${mode}`]) {
      lib.translate[info] = lib.translate[`${info}_${mode}`];
    } else if (lib.translate[`${info}_zhu`] && (mode == "identity" || mode == "guozhan" && _status.mode == "four")) {
      lib.translate[info] = lib.translate[`${info}_zhu`];
    } else if (lib.translate[`${info}_combat`] && get.is.versus()) {
      lib.translate[info] = lib.translate[`${info}_combat`];
    }
    const card = lib.card[cardId];
    if (card.filterTarget && card.selectTarget == void 0) {
      card.selectTarget = 1;
    }
    if (card.autoViewAs) {
      if (!card.ai) card.ai = {};
      if (!card.ai.order) {
        card.ai.order = lib.card[card.autoViewAs].ai.order;
        if (!card.ai.order && lib.card[card.autoViewAs].ai.basic) {
          card.ai.order = lib.card[card.autoViewAs].ai.basic.order;
        }
      }
    }
    if (card.type == "equip") {
      card.enable ??= true;
      card.selectTarget ??= -1;
      card.filterTarget ??= filterTarget;
      card.modTarget ??= true;
      card.allowMultiple ??= false;
      card.content ??= lib.element.content.equipCard;
      card.toself ??= true;
      card.ai ??= { basic: {} };
      card.ai.basic ??= {};
      card.ai.result ??= { target: 1.5 };
      card.ai.basic.order ??= aiBasicOrder;
      card.ai.basic.useful ??= 2;
      if (card.subtype == "equip3") {
        card.ai.basic.equipValue ??= 7;
      } else if (card.subtype == "equip4") {
        card.ai.basic.equipValue ??= 4;
      } else {
        card.ai.basic.equipValue ??= 1;
      }
      card.ai.basic.value ??= aiBasicValue;
      if (!card.ai.result.keepAI) {
        card.ai.result.target = aiResultTarget;
      }
    } else if (card.type == "delay" || card.type == "special_delay") {
      card.enable ??= true;
      card.filterTarget ??= lib.filter.judge;
      card.content ??= lib.element.content.addJudgeCard;
      card.allowMultiple ??= false;
    }
  },
  finishCards() {
    _status.cardsFinished = true;
    Object.keys(lib.card).forEach((i) => game.finishCard(i));
    Object.keys(lib.skill).filter((i) => i !== "global" && i !== "globalmap").forEach((i) => game.finishSkill(i));
  },
  checkMod(...argumentArray) {
    const name = argumentArray[argumentArray.length - 2];
    let skills = argumentArray[argumentArray.length - 1];
    if (typeof skills.getModableSkills == "function") {
      skills = skills.getModableSkills();
    } else if (typeof skills.getSkills == "function") {
      skills = skills.getSkills().concat(lib.skill.global);
      game.expandSkills(skills);
      skills = skills.filter(function(skill) {
        const info = get.info(skill);
        return info && info.mod;
      });
      skills.sort((a, b) => get.priority(a) - get.priority(b));
    }
    const arg = argumentArray.slice(0, -2);
    skills.forEach((value) => {
      const info = get.info(value);
      if (!info) {
        throw new TypeError("skill mod is missing");
      }
      const mods = info.mod;
      if (mods == null) {
        throw new TypeError("skill mod is missing");
      }
      const mod = mods[name];
      if (!mod) {
        return;
      }
      const result = mod.call(this, ...arg);
      if (result != void 0 && typeof arg[arg.length - 1] != "object") {
        arg[arg.length - 1] = result;
      }
    });
    return arg[arg.length - 1];
  },
  prepareArena(num) {
    _status.prepareArena = true;
    game.showHistory(false);
    ui.create.players(num);
    ui.create.me();
    ui.create.cardsAsync();
    game.finishCards();
  },
  clearArena() {
    ui.control.innerHTML = "";
    ui.arenalog.innerHTML = "";
    Array.from(ui.arena.childNodes).forEach((value) => {
      if (value == ui.canvas || value == ui.control || value == ui.arenalog || value == ui.roundmenu || value == ui.timer || value == ui.autonode) {
        return;
      }
      value.remove();
    });
    ui.sidebar.innerHTML = "";
    ui.cardPile.innerHTML = "";
    ui.discardPile.innerHTML = "";
    ui.special.innerHTML = "";
    ui.ordering.innerHTML = "";
    ui.playerids.remove();
    game.players.length = 0;
    game.dead.length = 0;
    game.me = null;
  },
  clearConnect() {
    if (ui.ipnode) {
      ui.ipnode.remove();
      delete ui.ipnode;
    }
    if (ui.iptext) {
      ui.iptext.remove();
      delete ui.iptext;
    }
    if (ui.ipbutton) {
      ui.ipbutton.remove();
      delete ui.ipbutton;
    }
    if (ui.recentIP) {
      ui.recentIP.remove();
      delete ui.recentIP;
    }
    if (ui.hall_button) {
      ui.hall_button.remove();
      delete ui.hall_button;
    }
    if (ui.startServer) {
      ui.startServer.remove();
      delete ui.startServer;
    }
    if (ui.rooms) {
      ui.rooms.forEach((value) => value.remove());
      delete ui.rooms;
    }
    if (ui.roombase) {
      ui.roombase.remove();
      delete ui.roombase;
    }
    if (!ui.connectEvents) {
      return;
    }
    ui.connectEvents.remove();
    if (ui.connectEventsCount) ui.connectEventsCount.remove();
    if (ui.connectClients) ui.connectClients.remove();
    if (ui.connectClientsCount) ui.connectClientsCount.remove();
    if (ui.createRoomButton) ui.createRoomButton.remove();
    delete ui.connectEvents;
    delete ui.connectEventsCount;
    delete ui.connectClients;
    delete ui.connectClientsCount;
    delete ui.createRoomButton;
  }
};
export {
  arenaFinishMethods
};
