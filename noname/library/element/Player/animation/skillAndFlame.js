import "../../../../../noname.js";
import { getRegisteredSkill } from "../../../skillRegistry.js";
import { game } from "../../../../game/index.js";
import { lib } from "../../../index.js";
import { ui } from "../../../../ui/index.js";
import { get } from "../../../../get/binding.js";
const skillAndFlameMethods = {
  tryJudgeAnimate(bool) {
    game.broadcast(
      function(player, bool2) {
        player.tryJudgeAnimate(bool2);
      },
      this,
      bool
    );
    if (bool) {
      this.popup("判定生效", "wood", false);
    } else {
      this.popup("判定失效", "fire", false);
    }
  },
  trySkillAnimate(name, popname, checkShow) {
    game.callHook("checkSkillAnimate", [this, name, popname]);
    const info = getRegisteredSkill(lib.skill, name);
    if (!game.online && lib.config.skill_animation_type != "off" && info?.skillAnimation) {
      if (lib.config.skill_animation_type == "default") {
        checkShow = checkShow || "main";
      } else {
        checkShow = false;
      }
      if (info.textAnimation) {
        checkShow = false;
      }
      this.$skill(info.animationStr || lib.translate[name], info.skillAnimation, info.animationColor, checkShow);
      return;
    }
    let player = this;
    game.broadcast(
      function(player2, name2, popname2, checkShow2) {
        player2.trySkillAnimate(name2, popname2, checkShow2);
      },
      player,
      name,
      popname,
      checkShow
    );
    if (lib.animate.skill[name]) {
      lib.animate.skill[name].apply(this, arguments);
    } else {
      if (popname != name) {
        this.popup(popname, "water", false);
      } else {
        this.popup(get.skillTranslation(name, this), "water", false);
      }
    }
  },
  tryCardAnimate(card, name, nature, popname) {
    game.broadcast(
      function(player, card2, name2, nature2, popname2) {
        player.tryCardAnimate(card2, name2, nature2, popname2);
      },
      this,
      card,
      name,
      nature,
      popname
    );
    if (lib.animate.card[card.name]) {
      lib.animate.card[card.name].apply(this, arguments);
    } else {
      if (!lib.config.show_card_prompt) {
        return;
      }
      if (get.type(card) == "equip" && lib.config.hide_card_prompt_equip) {
        return;
      }
      if (get.type(card) == "basic" && lib.config.hide_card_prompt_basic) {
        return;
      }
      if (popname) {
        this.popup({ name: card.name, nature: card.nature }, nature, false);
      } else {
        this.popup(name, nature, false);
      }
    }
  },
  $skill(name, type, color, avatar) {
    if (typeof type != "string") {
      type = "legend";
    }
    if (!avatar) {
      this.playerfocus(1500);
      game.delay(2);
    } else {
      game.addVideo("playerfocus2");
      game.broadcastAll(function() {
        ui.arena.classList.add("playerfocus");
        setTimeout(function() {
          ui.arena.classList.remove("playerfocus");
        }, 1800);
      });
      game.delay(3);
    }
    let that = this;
    setTimeout(
      function() {
        game.broadcastAll(
          function(that2, type2, name2, color2, avatar2) {
            if (lib.config.animation && !lib.config.low_performance) {
              if (game.chess) {
                that2["$" + type2 + "2"](1200);
              } else {
                that2["$" + type2](1200);
              }
            }
            if (name2) {
              that2.$fullscreenpop(name2, color2, avatar2);
            }
          },
          that,
          type,
          name,
          color,
          avatar
        );
      },
      avatar ? 0 : 300
    );
  },
  $fire() {
    game.addVideo("flame", this, "fire");
    let left, top;
    if (game.chess) {
      let rect = this.getBoundingClientRect();
      left = rect.left;
      top = rect.top;
    } else {
      left = this.getLeft();
      top = this.getTop();
    }
    game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 20, 700, "fire");
  },
  $thunder() {
    game.addVideo("flame", this, "thunder");
    let left, top;
    if (game.chess) {
      let rect = this.getBoundingClientRect();
      left = rect.left;
      top = rect.top;
    } else {
      left = this.getLeft();
      top = this.getTop();
    }
    game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 30, 700, "thunder");
  },
  $rare2() {
    game.addVideo("flame", this, "rare2");
    let rect = this.getBoundingClientRect();
    let left = rect.left;
    let top = rect.top + 15;
    game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 30, 700, "rare");
  },
  $epic2() {
    game.addVideo("flame", this, "epic2");
    let rect = this.getBoundingClientRect();
    let left = rect.left;
    let top = rect.top + 15;
    game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 30, 700, "epic");
  },
  $legend2() {
    game.addVideo("flame", this, "legend2");
    let rect = this.getBoundingClientRect();
    let left = rect.left;
    let top = rect.top + 15;
    game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 30, 700, "legend");
  },
  $rare(time) {
    time = time || 700;
    game.addVideo("flame", this, "rare");
    let left, top;
    if (game.chess) {
      left = this.getLeft() - ui.arena.offsetLeft;
      top = this.getTop() - ui.arena.offsetTop;
    } else {
      left = this.getLeft();
      top = this.getTop();
    }
    if (this.classList.contains("minskin")) {
      top += 15;
    }
    game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 30, time, "rare");
  },
  $epic(time) {
    time = time || 700;
    game.addVideo("flame", this, "epic");
    let left, top;
    if (game.chess) {
      left = this.getLeft() - ui.arena.offsetLeft;
      top = this.getTop() - ui.arena.offsetTop;
    } else {
      left = this.getLeft();
      top = this.getTop();
    }
    if (this.classList.contains("minskin")) {
      top += 15;
    }
    game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 30, time, "epic");
  },
  $legend(time) {
    time = time || 700;
    game.addVideo("flame", this, "legend");
    let left, top;
    if (game.chess) {
      left = this.getLeft() - ui.arena.offsetLeft;
      top = this.getTop() - ui.arena.offsetTop;
    } else {
      left = this.getLeft();
      top = this.getTop();
    }
    if (this.classList.contains("minskin")) {
      top += 15;
    }
    game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 30, time, "legend");
  },
  $coin() {
    game.broadcast(function(player) {
      if (!lib.config.low_performance) {
        player.$coin();
      }
    }, this);
    game.addVideo("flame", this, "coin");
    let left = this.getLeft() - ui.arena.offsetLeft;
    let top = this.getTop() - ui.arena.offsetTop;
    if (this.classList.contains("minskin")) {
      top += 15;
    }
    top -= 25;
    game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 30, 700, "coin");
  },
  $dust() {
    game.broadcast(function(player) {
      if (!lib.config.low_performance) {
        player.$dust();
      }
    }, this);
    game.addVideo("flame", this, "dust");
    let left = this.getLeft() - ui.arena.offsetLeft;
    let top = this.getTop() - ui.arena.offsetTop;
    if (this.classList.contains("minskin")) {
      top += 15;
    }
    top -= 25;
    game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 30, 700, "dust");
  },
  $recover() {
    game.addVideo("flame", this, "recover");
    let left, top;
    if (game.chess) {
      let rect = this.getBoundingClientRect();
      left = rect.left;
      top = rect.top;
    } else {
      left = this.getLeft();
      top = this.getTop();
    }
    game.animate.flame(left + this.offsetWidth / 2, top + this.offsetHeight - 30, 700, "recover");
  }
};
export {
  skillAndFlameMethods
};
