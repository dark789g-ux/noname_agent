import "../../../../../noname.js";
import { requireParentEvent } from "../dom/nodeGuards.js";
import { get } from "../../../../get/binding.js";
import { lib } from "../../../index.js";
import { game } from "../../../../game/index.js";
import { _status } from "../../../../status/index.js";
const showCharacterAndSkinMethods = {
  showCharacter(num, log) {
    const toShow = [];
    if ((num == 0 || num == 2) && this.isUnseen(0)) {
      toShow.add(this.name1);
    }
    if ((num == 1 || num == 2) && this.isUnseen(1)) {
      toShow.add(this.name2);
    }
    if (!toShow.length) {
      return;
    }
    this.$showCharacter(num, log);
    this.$handleEquipChange();
    const next = game.createEvent("showCharacter", false);
    next.player = this;
    next.num = num;
    next.toShow = toShow;
    next._args = Array.from(arguments);
    next.setContent("showCharacter");
    const evt = _status.event;
    if (!["useSkill", "trigger"].includes(evt.name)) {
      evt.next.remove(next);
      const afterEvent = evt.logSkill ? evt.getParent() : evt;
      requireParentEvent(afterEvent).after.push(next);
    }
    return next;
  },
  $showCharacter(num, log) {
    if (num == 0 && !this.isUnseen(0)) {
      return;
    }
    if (num == 1 && (!this.name2 || !this.isUnseen(1))) {
      return;
    }
    if (!this.isUnseen(2)) {
      return;
    }
    game.addVideo("showCharacter", this, num);
    let skills;
    switch (num) {
      case 0:
        if (log !== false) {
          game.log(this, "展示了主将", "#b" + this.name1);
        }
        this.name = this.name1;
        skills = lib.character[String(this.name)][3] || [];
        this.sex = lib.character[String(this.name)][0];
        if (this.group == "unknown") {
          this.group = lib.character[String(this.name)][1];
        }
        this.classList.remove("unseen");
        this.classList.remove("unseen_show");
        break;
      case 1: {
        const name2 = this.name2;
        if (!name2) {
          throw new Error("cannot show an absent vice character");
        }
        if (log !== false) {
          game.log(this, "展示了副将", "#b" + name2);
        }
        skills = lib.character[name2][3] || [];
        if (this.sex == "unknown") {
          this.sex = lib.character[name2][0];
        }
        const name = this.name;
        if (name === void 0) throw new TypeError("Showing a character requires an initialized name");
        if (name.startsWith("unknown")) {
          this.name = name2;
        }
        this.classList.remove("unseen2");
        this.classList.remove("unseen2_show");
        break;
      }
      case 2:
        if (log !== false) {
          if (this.name2) {
            game.log(this, "展示了主将", "#b" + this.name1, "、副将", "#b" + this.name2);
          } else {
            game.log(this, "展示了主将", "#b" + this.name1);
          }
        }
        this.name = this.name1;
        skills = lib.character[String(this.name)][3] || [];
        if (this.name2) {
          skills = skills.concat(lib.character[this.name2][3] || []);
        }
        this.sex = lib.character[String(this.name)][0];
        if (this.group == "unknown") {
          this.group = lib.character[String(this.name)][1];
        }
        this.classList.remove("unseen");
        this.classList.remove("unseen2");
        this.classList.remove("unseen_show");
        this.classList.remove("unseen2_show");
        break;
    }
    if (!this.isUnseen(2)) {
      delete this.storage.nohp;
      this.hp = this.storage.rawHp + Number(this.maxHp) - 1;
      this.maxHp = this.storage.rawMaxHp + Number(this.maxHp) - 1;
      this.node.hp.show();
      this.update();
    }
    game.broadcast(
      function(player, name, sex, num2, group) {
        player.group = group;
        player.name = name;
        player.sex = sex;
        switch (num2) {
          case 0:
            player.classList.remove("unseen");
            player.classList.remove("unseen_show");
            break;
          case 1:
            player.classList.remove("unseen2");
            player.classList.remove("unseen2_show");
            break;
          case 2:
            player.classList.remove("unseen");
            player.classList.remove("unseen2");
            player.classList.remove("unseen_show");
            player.classList.remove("unseen2_show");
            break;
        }
        if (!player.isUnseen(2)) {
          delete player.storage.nohp;
          player.node.hp.show();
          player.update();
        }
      },
      this,
      this.name,
      this.sex,
      num,
      this.group
    );
    skills = skills.filter((skill) => {
      const info = get.info(skill);
      if (info && info.zhuSkill && !this.isZhu2()) {
        return false;
      }
      return true;
    });
    for (let i = 0; i < skills.length; i++) {
      if (this.hiddenSkills.includes(skills[i])) {
        this.hiddenSkills.remove(skills[i]);
        this.addSkill(skills[i]);
      }
    }
    this.checkConflict();
  },
  changeSkin(map, character) {
    if (!map || !character) {
      console.warn("error: no sourceMap or character to changeSkin", get.translation(this));
      return;
    }
    if (typeof map == "string") {
      map = { skill: map };
    }
    const skin = this.skin;
    if (!skin) return;
    for (const i of ["name", "name1", "name2"]) {
      if (i == "name" && get.mode() == "guozhan") {
        continue;
      }
      if (i == "name1" && this.name === this.name1 && get.mode() != "guozhan") {
        continue;
      }
      const currentName = this[i];
      const list = currentName ? lib.characterSubstitute[currentName] : void 0;
      if (currentName && list) {
        const name = i == "name2" ? "name2" : "name";
        if ((() => {
          if (typeof map == "function") {
            return map(this, name);
          }
          if (typeof map.skill == "string" && get.character(currentName, 3).includes(map.skill)) {
            return true;
          }
          if (typeof map.characterName == "string" && currentName == map.characterName) {
            return true;
          }
          if (typeof map.characterSkinName == "string" && skin[name] == map.characterSkinName) {
            return true;
          }
          if (typeof map.source == "string" && name == map.source) {
            return true;
          }
          return false;
        })()) {
          if (skin[name] != character) {
            const origin = skin[name];
            game.broadcastAll(
              (player, name2, character2, list2, origin2) => {
                const skin2 = player.skin;
                if (!skin2) return;
                const tempname = player.tempname;
                if (!tempname) throw new TypeError("Skin changes require initialized temporary names");
                tempname.remove(origin2);
                tempname.add(character2);
                skin2[name2] = character2;
                const goon = !lib.character[character2];
                if (goon) {
                  const convertedCharacter = get.convertedCharacter(["", "", 0, [], (list2.find((i2) => i2[0] == character2) || [character2, []])[1]]);
                  lib.character[character2] = convertedCharacter;
                }
                player.smoothAvatar(name2 == "name2");
                const skinImg = !lib.config.skin[character2] && lib.character[character2]?.img;
                skinImg ? player.node["avatar" + name2.slice(4)].setBackgroundImage(skinImg) : player.node["avatar" + name2.slice(4)].setBackground(character2, "character");
                player.node["avatar" + name2.slice(4)].show();
                if (goon) {
                  delete lib.character[character2];
                }
              },
              this,
              name,
              character,
              list,
              origin
            );
            game.addVideo("changeSkin", this, {
              from: origin,
              to: character,
              name,
              list,
              avatar2: name == "name2"
            });
          }
        }
      }
    }
  },
  changeSkinByName(character, index) {
    const name = index == 2 ? "name2" : "name";
    const playerName = this[name];
    if (!playerName) {
      return;
    }
    const list = lib.characterSubstitute[playerName];
    if (list && lib.characterSubstitute[playerName]) {
      const skin = this.skin;
      if (!skin) return;
      const origin = skin[name];
      game.broadcastAll(
        (player, name2, character2, list2, origin2) => {
          const skin2 = player.skin;
          if (!skin2) return;
          const tempname = player.tempname;
          if (!tempname) throw new TypeError("Skin changes require initialized temporary names");
          tempname.remove(origin2);
          tempname.add(character2);
          skin2[name2] = character2;
          const goon = !lib.character[character2];
          if (goon) {
            const convertedCharacter = get.convertedCharacter(["", "", 0, [], (list2.find((i) => i[0] == character2) || [character2, []])[1]]);
            lib.character[character2] = convertedCharacter;
          }
          player.smoothAvatar(name2 == "name2");
          player.node["avatar" + name2.slice(4)].setBackground(character2, "character");
          player.node["avatar" + name2.slice(4)].show();
          if (goon) {
            delete lib.character[character2];
          }
        },
        this,
        name,
        character,
        list,
        origin
      );
      game.addVideo("changeSkin", this, {
        from: origin,
        to: character,
        name,
        list,
        avatar2: name == "name2"
      });
    }
  },
  checkShow(skill, showonly) {
    const sourceSkill = get.info(skill);
    let noshow = false;
    if (sourceSkill && sourceSkill.sourceSkill) {
      skill = sourceSkill.sourceSkill;
    }
    if (lib.skill.global.includes(skill)) {
      return false;
    }
    if (get.mode() != "guozhan" || game.expandSkills(this.getSkills()).includes(skill)) {
      if (showonly) {
        return false;
      } else {
        noshow = true;
      }
    }
    const unseen0 = this.isUnseen(0);
    const name1 = this.name1 || this.name;
    if (lib.character[String(name1)] && (!showonly || unseen0)) {
      const skills = game.expandSkills(lib.character[String(name1)][3].slice(0));
      if (skills.includes(skill)) {
        if (!noshow && this.isUnseen(0)) {
          this.showCharacter(0);
        }
        return "main";
      }
    }
    const unseen1 = this.isUnseen(1);
    const name2 = this.name2;
    if (name2 && lib.character[name2] && (!showonly || unseen1)) {
      const skills = game.expandSkills(lib.character[name2][3].slice(0));
      if (skills.includes(skill)) {
        if (!noshow && this.isUnseen(1)) {
          this.showCharacter(1);
        }
        return "vice";
      }
    }
    return false;
  }
};
export {
  showCharacterAndSkinMethods
};
