import "../../../../../noname.js";
import { getRegisteredSkill } from "../../../skillRegistry.js";
import { lib } from "../../../index.js";
import { game } from "../../../../game/index.js";
import { get } from "../../../../get/binding.js";
import { _status } from "../../../../status/index.js";
const skillQueryMethods = {
  addSkillBlocker(skill) {
    if (!this.storage.skill_blocker) {
      this.storage.skill_blocker = [];
    }
    this.storage.skill_blocker.push(skill);
  },
  removeSkillBlocker(skill) {
    if (this.storage.skill_blocker) {
      this.storage.skill_blocker.remove(skill);
      if (!this.storage.skill_blocker.length) {
        delete this.storage.skill_blocker;
      }
    }
  },
  getStockSkills(unowned, unique, hidden) {
    const list = [];
    if (lib.character[String(this.name)] && (hidden || !this.isUnseen(0))) {
      list.addArray(lib.character[String(this.name)][3]);
    }
    if (lib.character[String(this.name1)] && (hidden || !this.isUnseen(0))) {
      list.addArray(lib.character[String(this.name1)][3]);
    }
    const name2 = this.name2;
    if (name2 && lib.character[name2] && (hidden || !this.isUnseen(1))) {
      list.addArray(lib.character[name2][3]);
    }
    if (!unowned) {
      for (let i = 0; i < list.length; i++) {
        if (!this.hasSkill(list[i])) {
          list.splice(i--, 1);
        }
      }
    }
    if (!unique) {
      for (let i = 0; i < list.length; i++) {
        const info = getRegisteredSkill(lib.skill, list[i]);
        if (!info || info.unique || info.temp || info.sub || info.charlotte) {
          list.splice(i--, 1);
        }
      }
    }
    return list;
  },
  /**
   * 获取一名角色隐藏武将牌上的所有技能
   */
  getHiddenSkills(unowned, unique) {
    const player = this;
    return player.getStockSkills(unowned, unique, true).removeArray(player.getStockSkills(unowned, unique));
  },
  getGainableSkills(func) {
    const list = [];
    const names = [this.name, this.name1, this.name2];
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      if (name) {
        list.addArray(get.gainableSkillsName(name, func));
      }
    }
    return list;
  },
  /**
   * 返回武将牌上原有的技能
   */
  getOriginalSkills() {
    const skills = [];
    if (lib.character[String(this.name)] && !this.isUnseen(0)) {
      skills.addArray(lib.character[String(this.name)][3]);
    }
    if (this.name2 && lib.character[this.name2] && !this.isUnseen(1)) {
      skills.addArray(lib.character[this.name2][3]);
    }
    return skills;
  },
  getModableSkills() {
    let skills = this.getSkills().concat(lib.skill.global);
    game.expandSkills(skills);
    skills = skills.filter(function(skill) {
      const info = get.info(skill);
      return Boolean(info && info.mod);
    });
    skills.sort((a, b) => get.priority(a) - get.priority(b));
    return skills;
  },
  /**
   * 返回玩家当前拥有的技能列表。
   *
   * - `null`: 返回普通技能、非`hidden:`的额外技能、临时技能和装备技能。
   * - `true`: 在`null`的基础上额外加入hiddenSkills，并允许`hidden:`的额外技能。
   * - `false`: 在`null`的基础上额外加入invisibleSkills。
   * - `"invisible"`: 同时包含`true`和`false`中的技能。
   * - `"e"`: 在`includeEquipSkills`不为`false`时，直接返回装备技能；反之退化为`true`
   */
  getSkills(skillMode, includeEquipSkills, applySkillFilter) {
    let skills = this.skills.slice(0);
    const es = [];
    if (includeEquipSkills !== false) {
      const VEquips = this.getVCards("e");
      es.addArray(get.skillsFromEquips(VEquips));
      if (skillMode === "e") {
        return es;
      }
    }
    for (const source in this.additionalSkills) {
      const additionalSkills = this.additionalSkills[source];
      if (Array.isArray(additionalSkills) && (skillMode || source.indexOf("hidden:") !== 0)) {
        for (const skill of additionalSkills) {
          if (!skill) {
            continue;
          }
          skills.add(skill);
        }
      } else if (additionalSkills && typeof additionalSkills === "string") {
        skills.add(additionalSkills);
      }
    }
    for (const skill in this.tempSkills) {
      skills.add(skill);
    }
    if (skillMode) {
      skills.addArray(this.hiddenSkills);
    }
    if (skillMode === false || skillMode === "invisible") {
      skills.addArray(this.invisibleSkills);
    }
    if (includeEquipSkills !== false) {
      skills.addArray(es);
    }
    for (const skill in this.forbiddenSkills) {
      skills.remove(skill);
    }
    if (applySkillFilter !== false) {
      skills = game.filterSkills(skills, this, es);
    }
    return skills;
  },
  /**
   * 返回技能是否暂时失效
   */
  isTempBanned(skill) {
    return this.hasStorage(`temp_ban_${skill}`);
  },
  hasSkill(skill, arg2, arg3, arg4) {
    if (skill === "counttrigger") {
      return true;
    }
    return game.expandSkills(this.getSkills(arg2, arg3, arg4)).includes(skill);
  },
  hasStockSkill(skill, arg1, arg2, arg3) {
    return game.expandSkills(this.getStockSkills(arg1, arg2, arg3)).includes(skill);
  },
  hasZhuSkill(skill, player) {
    if (!this.hasSkill(skill)) {
      return false;
    }
    if (player) {
      const mode = get.mode();
      if (mode == "identity" && _status.mode == "purple") {
        if (this.identity.slice(0, 1) != player.identity.slice(0, 1)) {
          return false;
        }
      }
      if (mode == "versus" && (_status.mode == "four" || _status.mode == "guandu")) {
        if (this.side != player.side) {
          return false;
        }
      }
    }
    return true;
  },
  hasGlobalTag(tag, arg) {
    const skills = lib.skill.global.slice(0);
    game.expandSkills(skills);
    for (let i = 0; i < skills.length; i++) {
      const info = getRegisteredSkill(lib.skill, skills[i]);
      if (info && info.ai) {
        if (info.ai.skillTagFilter && info.ai[tag] && info.ai.skillTagFilter(this, tag, arg) === false) {
          continue;
        }
        if (typeof info.ai[tag] == "string") {
          if (info.ai[tag] == arg) {
            return true;
          }
        } else if (info.ai[tag]) {
          return true;
        }
      }
    }
    return false;
  },
  hasSkillTag(tag, hidden, arg, globalskill) {
    const skills = this.getSkills(hidden);
    if (globalskill !== false) {
      skills.addArray(lib.skill.global);
    }
    game.expandSkills(skills);
    for (let i = 0; i < skills.length; i++) {
      const info = getRegisteredSkill(lib.skill, skills[i]);
      if (info && info.ai) {
        if (info.ai.skillTagFilter && info.ai[tag]) {
          if (info.ai.skillTagFilter(this, tag, arg) === false) {
            continue;
          }
        }
        if (info.ai[tag] === true) {
          if (typeof arg === "object" && arg && !info.ai.skillTagFilter) {
            console.log(`疑似忘给lib.skill.${skills[i]}.ai.${tag}加skillTagFilter了
hasSkillTag：`, arg);
          }
          return true;
        } else if (typeof info.ai[tag] !== "undefined") {
          if (typeof arg !== typeof info.ai[tag]) {
            console.warn(`lib.skill.${skills[i]}.ai.${tag}类型不符
hasSkillTag：`, arg);
          }
          if (info.ai[tag] == arg) {
            return true;
          }
        }
      }
    }
    return false;
  }
};
export {
  skillQueryMethods
};
