import "../../../../../noname.js";
import { requireRegisteredSkill, getRegisteredSkill } from "../../../skillRegistry.js";
import { requireParentEvent } from "../dom/nodeGuards.js";
import { lib } from "../../../index.js";
import { game } from "../../../../game/index.js";
import { _status } from "../../../../status/index.js";
import { get } from "../../../../get/binding.js";
const skillSubPlayerAndLogMethods = {
  logSkill(name, targets, nature, logv, args) {
    const skillTargets = [];
    if (targets && !Array.isArray(targets) && get.itemtype(targets) == "player") {
      skillTargets.push(targets);
    } else if (Array.isArray(targets)) {
      for (const target of targets) {
        if (get.itemtype(target) == "player") {
          skillTargets.push(target);
        }
      }
    }
    let resolvedName = typeof name == "string" ? name : "";
    let popname = resolvedName;
    if (Array.isArray(name)) {
      const skillName = name[0];
      const displayName = name[1];
      resolvedName = typeof skillName == "string" ? skillName : "";
      popname = typeof displayName == "string" ? displayName : resolvedName;
    }
    const showState = this.checkShow(resolvedName);
    const checkShow = showState == "main" || showState == "vice" ? showState : false;
    if (lib.translate[resolvedName]) {
      this.trySkillAnimate(resolvedName, popname, checkShow);
      if (skillTargets.length) {
        let str;
        if (skillTargets[0] == this) {
          str = "#b自己";
          if (skillTargets.length > 1) {
            str += "、";
            str += get.translation(skillTargets.slice(1));
          }
        } else {
          str = skillTargets;
        }
        game.log(this, "对", str, "发动了", "【" + get.skillTranslation(resolvedName, this) + "】");
      } else {
        game.log(this, "发动了", "【" + get.skillTranslation(resolvedName, this) + "】");
      }
    }
    if (nature != false) {
      const lineNature = nature === void 0 ? "green" : nature;
      this.line(skillTargets, lineNature);
    }
    const info = getRegisteredSkill(lib.skill, resolvedName);
    if (info && info.ai && info.ai.expose != void 0 && this.logAi && (skillTargets.length != 1 || skillTargets[0] != this)) {
      this.logAi(info.ai.expose);
    }
    if (info && info.round) {
      const roundname = resolvedName + "_roundcount";
      this.storage[roundname] = game.roundNumber;
      this.syncStorage(roundname);
      this.markSkill(roundname);
    }
    game.trySkillAudio(resolvedName, this, true, false, null, args);
    if (game.chess) {
      this.chessFocus();
    }
    if (logv === true) {
      game.logv(this, resolvedName, skillTargets, void 0, true);
    } else if (info && info.logv !== false) {
      game.logv(this, resolvedName, skillTargets);
    }
    if (info) {
      const player = this;
      const players = player.getSkills(false, false, false);
      const equips = player.getSkills("e");
      const global = lib.skill.global.slice(0);
      const logInfo = {
        skill: resolvedName,
        targets: skillTargets,
        event: _status.event
      };
      if (info.sourceSkill) {
        logInfo.sourceSkill = info.sourceSkill;
        if (global.includes(info.sourceSkill)) {
          logInfo.type = "global";
        } else if (players.includes(info.sourceSkill)) {
          logInfo.type = "player";
        } else if (equips.includes(info.sourceSkill)) {
          logInfo.type = "equip";
        }
      } else {
        if (global.includes(resolvedName)) {
          logInfo.sourceSkill = resolvedName;
          logInfo.type = "global";
        } else if (players.includes(resolvedName)) {
          logInfo.sourceSkill = resolvedName;
          logInfo.type = "player";
        } else if (equips.includes(resolvedName)) {
          logInfo.sourceSkill = resolvedName;
          logInfo.type = "equip";
        } else {
          let bool = false;
          for (const i of players) {
            const expand = [i];
            game.expandSkills(expand);
            if (expand.includes(resolvedName)) {
              bool = true;
              logInfo.sourceSkill = i;
              logInfo.type = "player";
              break;
            }
          }
          if (!bool) {
            for (const i of players) {
              const expand = [i];
              game.expandSkills(expand);
              if (expand.includes(resolvedName)) {
                logInfo.sourceSkill = i;
                logInfo.type = "equip";
                break;
              }
            }
          }
        }
      }
      const next = game.createEvent("logSkill", false);
      const evt = _status.event;
      next.player = player;
      next.forceDie = true;
      next.includeOut = true;
      evt.next.remove(next);
      const afterEvent = evt.logSkill || evt.name?.startsWith("pre_") ? evt.getParent() : evt;
      for (const i of Object.keys(logInfo)) {
        if (i == "event") {
          next.log_event = logInfo[i];
        } else {
          next[i] = logInfo[i];
        }
      }
      requireParentEvent(afterEvent).after.push(next);
      next.setContent("emptyEvent");
      player.getHistory("useSkill").push(logInfo);
      const next2 = game.createEvent("logSkillBegin", false, get.event());
      next2.player = player;
      next2.forceDie = true;
      next2.includeOut = true;
      for (const i of Object.keys(logInfo)) {
        if (i == "event") {
          next2.log_event = logInfo[i];
        } else {
          next2[i] = logInfo[i];
        }
      }
      next2.setContent("emptyEvent");
    }
    if (this._hookTrigger) {
      for (let i = 0; i < this._hookTrigger.length; i++) {
        const hookInfo = requireRegisteredSkill(lib.skill, this._hookTrigger[i]).hookTrigger;
        if (hookInfo && hookInfo.log) {
          hookInfo.log(this, resolvedName, skillTargets);
        }
      }
    }
  },
  /**
   * 添加随从
   */
  addSubPlayer(cfg) {
    const skill = "subplayer_" + cfg.name + "_" + get.id();
    game.log(this, "获得了随从", "#g" + get.translation(cfg.name));
    cfg.hs = cfg.hs || [];
    cfg.es = cfg.es || [];
    cfg.skills = cfg.skills || [];
    cfg.hp = cfg.hp || 1;
    cfg.maxHp = cfg.maxHp || 1;
    cfg.hujia = cfg.hujia || 0;
    cfg.sex = cfg.sex || "male";
    cfg.group = cfg.group || "qun";
    cfg.skill = cfg.skill || _status.event.name;
    if (!cfg.source) {
      if (_status.event.name && this.hasSkill(_status.event.name) && this.name2 && lib.character[this.name2] && lib.character[this.name2][3].includes(_status.event.name)) {
        cfg.source = this.name2;
      } else {
        cfg.source = this.name;
      }
    }
    const list = cfg.caption ? [cfg.caption] : ["", "_prefix", "_ab"].map((str) => lib.translate[cfg.name + str]);
    game.broadcastAll(
      //TODO: 这里直接修改trashBin部分，后续需要修改为新写法
      function(player, skill2, list2, cfg2) {
        const { name, sex = "male", group = "qun", hp = 1, maxHp = 1, hujia = 0, skills = [] } = cfg2;
        lib.skill[skill2] = {
          intro: {
            content: cfg2.intro || ""
          },
          mark: "character",
          subplayer: cfg2.skill,
          ai: {
            subplayer: true
          }
        };
        lib.character[skill2] = get.convertedCharacter([sex, group, parseFloat(String(hp)) + "/" + parseFloat(String(maxHp)) + "/" + parseFloat(String(hujia)), skills, ["tempname:" + name].concat(lib.character[name].trashBin || [])]);
        if (Array.isArray(cfg2.image)) {
          cfg2.image.forEach((image) => lib.character[skill2][4].push(image));
        } else if (typeof cfg2.image == "string") {
          lib.character[skill2].trashBin.push(cfg2.image);
        } else {
          lib.character[skill2].trashBin.push("character:" + name);
        }
        for (let i = 0; i < list2.length; i++) {
          const text = list2[i];
          if (!text) {
            continue;
          }
          lib.translate[skill2 + ["", "_prefix", "_ab"][i]] = text;
        }
        player.storage[skill2] = cfg2;
      },
      this,
      skill,
      list,
      cfg
    );
    game.addVideo("addSubPlayer", this, [skill, lib.skill[skill], lib.character[skill], list, { name: cfg.name }]);
    this.addSkill(skill);
    return skill;
  },
  removeSubPlayer(name) {
    if (this.hasSkill("subplayer") && this.name == name) {
      this.exitSubPlayer(true);
    } else {
      if (this.storage[name].onremove) {
        this.storage[name].onremove(this, name);
      }
      this.removeSkill(name);
      delete this.storage[name];
      game.log(this, "牺牲了随从", "#g" + name);
      _status.event.trigger("removeSubPlayer");
    }
  },
  callSubPlayer(result) {
    if (this.hasSkill("subplayer")) {
      return;
    }
    const next = game.createEvent("callSubPlayer");
    next.player = this;
    next.directresult = result;
    next.setContent("callSubPlayer");
    return next;
  },
  toggleSubPlayer(result) {
    if (!this.hasSkill("subplayer")) {
      return;
    }
    const next = game.createEvent("toggleSubPlayer");
    next.player = this;
    next.directresult = result;
    next.setContent("toggleSubPlayer");
    return next;
  },
  exitSubPlayer(remove) {
    const next = game.createEvent("exitSubPlayer");
    next.player = this;
    next.remove = remove;
    next.setContent("exitSubPlayer");
    if (!this.hasSkill("subplayer")) {
      _status.event.next.remove(next);
      next.resolve();
    }
    return next;
  },
  getSubPlayers(tag) {
    const skills = this.getSkills();
    const list = [];
    for (let i = 0; i < skills.length; i++) {
      const name = skills[i];
      const info = requireRegisteredSkill(lib.skill, name);
      if (tag && info.subplayer != tag) {
        continue;
      }
      if (info.ai && info.ai.subplayer && this.storage[name] && this.storage[name].name) {
        list.push(name);
      }
    }
    return list;
  }
};
export {
  skillSubPlayerAndLogMethods
};
