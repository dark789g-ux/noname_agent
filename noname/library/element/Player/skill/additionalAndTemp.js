import "../../../../../noname.js";
import { getRegisteredSkill } from "../../../skillRegistry.js";
import { lib } from "../../../index.js";
import { get } from "../../../../get/binding.js";
import { game } from "../../../../game/index.js";
import { _status } from "../../../../status/index.js";
const skillAdditionalAndTempMethods = {
  addInvisibleSkill(skill) {
    if (Array.isArray(skill)) {
      _status.event.clearStepCache();
      for (let i = 0; i < skill.length; i++) {
        this.addInvisibleSkill(skill[i]);
      }
    } else {
      if (this.invisibleSkills.includes(skill)) {
        return;
      }
      _status.event.clearStepCache();
      const info = getRegisteredSkill(lib.skill, skill);
      if (!info) {
        return;
      }
      this.invisibleSkills.add(skill);
      this.addSkillTrigger(skill);
      if (this.awakenedSkills.includes(skill)) {
        this.awakenSkill(skill);
        return;
      }
    }
  },
  removeInvisibleSkill(skill) {
    if (!skill) {
      return;
    }
    if (Array.isArray(skill)) {
      for (let i = 0; i < skill.length; i++) {
        this.removeInvisibleSkill(skill[i]);
      }
    } else {
      const info = getRegisteredSkill(lib.skill, skill);
      if (info && info.fixed && arguments[1] !== true) {
        return skill;
      }
      game.broadcastAll(
        function(player, skill2) {
          player.invisibleSkills.remove(skill2);
        },
        this,
        skill
      );
      if (!this.hasSkill(skill, true)) {
        this.removeSkill(skill);
      }
    }
    return skill;
  },
  addSkills(skill, popup = true) {
    if (!skill) {
      return;
    }
    return this.changeSkills(Array.isArray(skill) ? skill : [skill], [], popup);
  },
  removeSkills(skill, popup = true) {
    if (!skill) {
      return;
    }
    return this.changeSkills([], Array.isArray(skill) ? skill : [skill], popup);
  },
  changeSkills(addSkill = [], removeSkill = [], popup = true) {
    if (!Array.isArray(addSkill) || !Array.isArray(removeSkill)) {
      console.warn(`警告：Player[${this.name}].changeSkills的参数错误，应当为数组形式。`);
      return;
    }
    const next = game.createEvent("changeSkills", false);
    next.player = this;
    next.forceDie = true;
    next.popup = popup;
    next.addSkill = addSkill.slice(0).unique();
    next.removeSkill = removeSkill.slice(0).unique();
    next.setContent("changeSkills");
    return next;
  },
  addAdditionalSkills(skill, skillsToAdd, keep) {
    const normalizedSkills = typeof skillsToAdd == "string" ? [skillsToAdd] : skillsToAdd;
    if (!Array.isArray(normalizedSkills)) {
      console.warn(`警告：Player[${this.name}].addAdditionalSkills的参数错误，应当为技能字符串或数组:`, normalizedSkills);
    }
    const skillsToRemove = [];
    if (!keep) {
      skillsToRemove.addArray(this.getRemovableAdditionalSkills(skill));
    }
    const next = this.changeSkills(normalizedSkills, skillsToRemove);
    if (!next) {
      throw new TypeError("addAdditionalSkills requires an array of skills");
    }
    next.$handle = function(player, skillsToAdd2, skillsToRemove2) {
      const currentEvent = get.event();
      if (!currentEvent) {
        throw new Error("addAdditionalSkills must run in an event context");
      }
      if (skillsToRemove2.length > 0) {
        player.removeSkillLog(skillsToRemove2, currentEvent.popup);
      }
      if (skillsToAdd2.length > 0) {
        game.log(
          player,
          "获得了技能",
          ...skillsToAdd2.map((i) => {
            if (currentEvent.popup) {
              player.popup(i);
            }
            return "#g【" + get.translation(i) + "】";
          })
        );
        if (!Array.isArray(player.additionalSkills[skill])) {
          player.additionalSkills[skill] = [];
        }
        for (let i = 0; i < skillsToAdd2.length; i++) {
          player.addSkill(skillsToAdd2[i], null, true, true);
          player.additionalSkills[skill].push(skillsToAdd2[i]);
        }
        game.broadcast(
          (player2, map) => {
            player2.additionalSkills = map;
          },
          player,
          player.additionalSkills
        );
        player.checkConflict();
      }
      _status.event.clearStepCache();
    };
    return next;
  },
  addAdditionalSkill(skill, skillsToAdd, keep) {
    const normalizedSkills = typeof skillsToAdd == "string" ? [skillsToAdd] : skillsToAdd;
    if (!Array.isArray(normalizedSkills)) {
      console.warn(`警告：Player[${this.name}].addAdditionalSkill的参数错误，应当为技能字符串或数组:`, normalizedSkills);
    }
    const skillsToRemove = [];
    if (!keep) {
      skillsToRemove.addArray(this.getRemovableAdditionalSkills(skill));
    }
    this.removeSkill(skillsToRemove);
    if (!Array.isArray(this.additionalSkills[skill])) {
      this.additionalSkills[skill] = [];
    }
    for (let i = 0; i < normalizedSkills.length; i++) {
      this.addSkill(normalizedSkills[i], null, null, true);
      this.additionalSkills[skill].push(normalizedSkills[i]);
    }
    game.broadcast(
      (player, map) => {
        player.additionalSkills = map;
      },
      this,
      this.additionalSkills
    );
    this.checkConflict();
    _status.event.clearStepCache();
    return this;
  },
  $removeAdditionalSkills(skill, target) {
    const additionalSkills = this.additionalSkills[skill];
    if (Array.isArray(additionalSkills)) {
      if (typeof target === "string") {
        if (additionalSkills.includes(target)) {
          additionalSkills.remove(target);
          if (!additionalSkills.length) {
            delete this.additionalSkills[skill];
          }
        }
      } else {
        delete this.additionalSkills[skill];
      }
    }
    game.broadcast(
      (player, map) => {
        player.additionalSkills = map;
      },
      this,
      this.additionalSkills
    );
  },
  getRemovableAdditionalSkills(skill, target) {
    const player = this;
    const removableSkills = [];
    if (this.additionalSkills[skill]) {
      const additionalSkills = this.additionalSkills[skill];
      const hasAnotherSkill = function(skillkey, candidate) {
        return Boolean(
          player.skills.includes(candidate) || player.tempSkills[candidate] || Object.keys(player.additionalSkills).some((key) => {
            if (key === skillkey) {
              return false;
            }
            const entry = player.additionalSkills[key];
            if (Array.isArray(entry)) {
              return entry.includes(candidate);
            }
            return entry == candidate;
          })
        );
      };
      if (Array.isArray(additionalSkills) && typeof target == "string") {
        if (additionalSkills.includes(target)) {
          removableSkills.push(target);
        }
      } else if (Array.isArray(additionalSkills)) {
        removableSkills.addArray(additionalSkills.filter((candidate) => !hasAnotherSkill(skill, candidate)));
      }
    }
    return removableSkills;
  },
  removeAdditionalSkill(skill, target) {
    const player = this;
    const skills = this.getRemovableAdditionalSkills(skill, target);
    if (skills.length) {
      player.removeSkill(skills);
    }
    player.$removeAdditionalSkills(skill, target);
    _status.event.clearStepCache();
    return this;
  },
  removeAdditionalSkills(skill, target) {
    const player = this;
    const skills = this.getRemovableAdditionalSkills(skill, target);
    const next = player.changeSkills([], skills);
    if (!next) {
      throw new TypeError("removeAdditionalSkills requires an array of skills");
    }
    next.$handle = function(player2, _addSkills, removeSkills) {
      const currentEvent = get.event();
      if (!currentEvent) {
        throw new Error("removeAdditionalSkills must run in an event context");
      }
      if (removeSkills.length > 0) {
        player2.removeSkillLog(removeSkills, currentEvent.popup);
      }
      player2.$removeAdditionalSkills(skill, target);
    };
    return next;
  },
  addTempSkills(skillsToAdd, expire) {
    const normalizedSkills = typeof skillsToAdd == "string" ? [skillsToAdd] : skillsToAdd;
    if (!Array.isArray(normalizedSkills) || !normalizedSkills.length) {
      console.warn(`警告：Player[${this.name}].addTempSkills的参数错误，应当为技能字符串或非空数组:`, normalizedSkills);
    }
    let normalizedExpire;
    if (!expire) {
      normalizedExpire = { global: ["phaseAfter", "phaseBeforeStart"] };
    } else if (typeof expire == "string" || Array.isArray(expire)) {
      normalizedExpire = { global: expire };
    } else {
      normalizedExpire = expire;
    }
    const next = this.changeSkills(normalizedSkills, []);
    if (!next) {
      throw new TypeError("addTempSkills requires an array of skills");
    }
    next.$handle = function(player, addSkills) {
      const currentEvent = get.event();
      if (!currentEvent) {
        throw new Error("addTempSkills must run in an event context");
      }
      if (addSkills.length) {
        game.log(
          player,
          "获得了技能",
          ...addSkills.map((i) => {
            if (currentEvent.popup) {
              player.popup(i);
            }
            return "#g【" + get.translation(i) + "】";
          })
        );
        let skillName;
        do {
          skillName = "player_tempSkills_" + Math.random().toString(36).slice(-8);
        } while (player.additionalSkills[skillName] != null);
        player.addAdditionalSkill(skillName, normalizedSkills);
        player.when(normalizedExpire, false).assign({
          firstDo: true,
          priority: Infinity
        }).step(async (_event, _trigger, player2) => {
          player2.removeAdditionalSkills(skillName);
        }).finish();
      }
    };
    return next;
  },
  /**
   * 添加临时技能
   */
  addTempSkill(skill, expire, checkConflict) {
    if (Array.isArray(skill)) {
      for (let i = 0; i < skill.length; i++) {
        this.addTempSkill(skill[i], expire, checkConflict);
      }
    } else {
      if (this.hasSkill(skill) && this.tempSkills[skill] == void 0) {
        return;
      }
      this.addSkill(skill, checkConflict, false, true);
      let normalizedExpire;
      if (!expire) {
        normalizedExpire = { global: ["phaseAfter", "phaseBeforeStart"] };
      } else if (typeof expire == "string" || Array.isArray(expire)) {
        normalizedExpire = { global: expire };
      } else {
        normalizedExpire = expire;
      }
      this.tempSkills[skill] = normalizedExpire;
      const map = lib.relatedTrigger;
      const names = Object.keys(map);
      if (typeof normalizedExpire !== "function" && get.objtype(normalizedExpire) == "object") {
        const roles = ["player", "source", "target", "global"];
        for (const i of roles) {
          const raw = normalizedExpire[i];
          const triggers = Array.isArray(raw) ? raw : [raw];
          triggers.forEach((trigger) => {
            lib.hookmap[String(trigger)] = true;
            const key = names.find((name) => trigger?.startsWith(name));
            if (key && trigger) {
              map[key].forEach((rawTrigger) => {
                lib.hookmap[`${rawTrigger}${trigger.slice(key.length)}`] = true;
              });
            }
          });
        }
      }
      game.broadcast(
        (player, map2) => {
          player.tempSkills = map2;
        },
        this,
        this.tempSkills
      );
    }
    return skill;
  }
};
export {
  skillAdditionalAndTempMethods
};
