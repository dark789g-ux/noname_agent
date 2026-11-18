import "../../../../../noname.js";
import { forwardEventLogSkill } from "../../GameEvent/logSkill.js";
import "../contracts/cardContract.js";
import { game } from "../../../../game/index.js";
import { get } from "../../../../get/binding.js";
import { lib } from "../../../index.js";
import { _status } from "../../../../status/index.js";
const cardUseAndRespondMethods = {
  useResult(result, event) {
    const activeEvent = event || _status.event;
    if (result._sendskill) {
      lib.skill[result._sendskill[0]] = result._sendskill[1];
    }
    if (activeEvent.onresult) {
      activeEvent.onresult(result);
    }
    if (result.skill) {
      const info = get.info(result.skill);
      if (info.onuse) {
        info.onuse(result, this);
      }
    }
    if (activeEvent.logSkill) {
      forwardEventLogSkill(this, activeEvent.logSkill);
    }
    if (result.card || !result.skill) {
      result.used = result.card || result.cards?.[0];
      const next = this.useCard(result.used, result.cards, result.targets, result.skill);
      next.oncard = activeEvent.oncard;
      next.respondTo = activeEvent.respondTo;
      if (activeEvent.addCount === false) {
        next.addCount = false;
      }
      if (result._apply_args) {
        for (const i in result._apply_args) {
          next[i] = result._apply_args[i];
        }
      }
      return next;
    } else if (result.skill) {
      result.used = result.skill;
      const next = this.useSkill(result.skill, result.cards, result.targets);
      if (activeEvent.addSkillCount === false) {
        next.addCount = false;
      }
      return next;
    }
  },
  useCard(params) {
    const next = game.createEvent("useCard");
    next.player = this;
    next.num = 0;
    const args = [...arguments];
    if (args.length == 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
      Object.assign(next, params);
    } else {
      for (const arg of args) {
        if (get.itemtype(arg) == "cards") {
          next.cards = arg.slice(0);
        } else if (get.itemtype(arg) == "players") {
          next.targets = arg;
        } else if (get.itemtype(arg) == "player") {
          next.targets = [arg];
        } else if (get.itemtype(arg) == "card") {
          next.card = arg;
        } else if (typeof arg == "object" && arg && arg.name) {
          next.card = arg;
        } else if (typeof arg == "string") {
          if (arg == "noai") {
            next.noai = true;
          } else if (arg == "nowuxie") {
            next.nowuxie = true;
          } else {
            next.skill = arg;
          }
        } else if (typeof arg == "boolean") {
          next.addCount = arg;
        }
      }
    }
    if (next.cards == void 0) {
      if (get.itemtype(next.card) == "card") {
        next.cards = [next.card];
      } else {
        next.cards = [];
      }
    } else if (next.card == void 0) {
      if (next.cards) {
        next.card = next.cards[0];
      }
    }
    const event = get.event(), card = next.cards[0];
    next.modSkill = {
      cardname: null,
      cardnature: null,
      cardsuit: null,
      cardnumber: null
    };
    const keys = Object.keys(next.modSkill).flat();
    if (event.name == "chooseToUse" && !next.skill && get.itemtype(card) == "card") {
      let skills = [];
      if (typeof this.getModableSkills === "function") {
        skills = this.getModableSkills();
      } else if (typeof this.getSkills === "function") {
        skills = this.getSkills().concat(lib.skill.global);
        game.expandSkills(skills);
        skills = skills.filter((i) => {
          const info = get.info(i);
          return info && info.mod;
        });
        skills.sort((a, b) => get.priority(a) - get.priority(b));
      }
      for (const key of keys) {
        if (key === "cardsuit") {
          let suit = card.suit;
          for (const stage of ["suit", "cardsuit"]) {
            for (const skill of skills) {
              const mods = get.info(skill).mod;
              if (!mods) throw new TypeError(`Expected mod configuration for ${skill}`);
              const result = stage === "suit" ? mods.suit?.call(game, card, suit) : mods.cardsuit?.call(game, card, this, suit);
              if (result != void 0 && typeof suit !== "object" && result !== suit) {
                suit = result;
                next.modSkill[key] = skill;
              }
            }
          }
          continue;
        }
        let preResult = "unchanged";
        for (const skill of skills) {
          const mods = get.info(skill).mod;
          if (!mods) throw new TypeError(`Expected mod configuration for ${skill}`);
          const mod = mods[key];
          if (mod) {
            let arg = [card, this, get[key.slice(4)](card, false), preResult];
            let result = mod.call(game, ...arg);
            if (result !== void 0 && typeof arg[arg.length - 1] !== "object") {
              arg[arg.length - 1] = result;
            }
            if (arg[arg.length - 1] !== preResult) {
              next.modSkill[key] = skill;
              preResult = arg[arg.length - 1];
            }
          }
        }
      }
    }
    if (!next.targets) {
      next.targets = [];
    }
    if (next.card) {
      next.card = get.autoViewAs(next.card, next.cards);
      const info = get.info(next.card);
      if (info.changeTarget) {
        info.changeTarget(next.player, next.targets);
      }
      if (info.singleCard) {
        next._targets = next.targets.slice(0);
        next.target = next.targets[0];
        next.addedTargets = next.targets.splice(1);
        if (next.addedTargets.length) {
          next.addedTarget = next.addedTargets[0];
        }
      }
    }
    for (let i = 0; i < next.targets.length; i++) {
      if (get.attitude(this, next.targets[i]) >= -1 && get.attitude(this, next.targets[i]) < 0) {
        if (!this.ai.tempIgnore) {
          this.ai.tempIgnore = [];
        }
        this.ai.tempIgnore.add(next.targets[i]);
      }
    }
    if (typeof this.logAi == "function" && !next.noai && !get.info(next.card).noai && !this.hasSkillTag(
      "noai",
      true,
      {
        card: next.card,
        targets: next.targets
      },
      true
    )) {
      const postAi = get.info(next.card).postAi;
      if (postAi && postAi(next.targets)) {
        next.postAi = true;
      } else {
        this.logAi(next.targets, next.card);
      }
    }
    next.stocktargets = next.targets.slice(0);
    next.setContent("useCard");
    return next;
  },
  useSkill(params) {
    const next = game.createEvent("useSkill");
    next.player = this;
    next.num = 0;
    const args = [...arguments];
    if (args.length == 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
      Object.assign(next, params);
    } else {
      for (const arg of args) {
        if (get.itemtype(arg) == "cards") {
          next.cards = arg.slice(0);
        } else if (get.itemtype(arg) == "players") {
          next.targets = arg;
        } else if (get.itemtype(arg) == "card") {
          next.card = arg;
        } else if (typeof arg == "string") {
          next.skill = arg;
        } else if (typeof arg == "boolean") {
          next.addCount = arg;
        }
      }
    }
    if (next.cards == void 0) {
      next.cards = [];
    }
    if (next.skill && get.info(next.skill) && get.info(next.skill).changeTarget) {
      get.info(next.skill).changeTarget?.(next.player, next.targets ?? []);
    }
    if (next.targets) {
      for (let i = 0; i < next.targets.length; i++) {
        if (get.attitude(this, next.targets[i]) >= -1 && get.attitude(this, next.targets[i]) < 0) {
          if (!this.ai.tempIgnore) {
            this.ai.tempIgnore = [];
          }
          this.ai.tempIgnore.add(next.targets[i]);
        }
      }
      if (typeof this.logAi == "function") {
        this.logAi(next.targets, next.skill);
      }
    } else {
      next.targets = [];
    }
    next.setContent("useSkill");
    return next;
  },
  respond(params) {
    const next = game.createEvent("respond");
    next.player = this;
    const args = [...arguments];
    if (args.length == 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
      Object.assign(next, params);
    } else {
      for (const arg of args) {
        if (get.itemtype(arg) == "cards") {
          next.cards = arg.slice(0);
        } else if (get.itemtype(arg) == "card") {
          next.card = arg;
        } else if (get.itemtype(arg) == "player") {
          next.source = arg;
        } else if (typeof arg == "object" && arg && arg.name) {
          next.card = arg;
        } else if (typeof arg == "boolean") {
          next.animate = arg;
        } else if (arg == "highlight") {
          next.highlight = true;
        } else if (arg == "noOrdering") {
          next.noOrdering = true;
        } else if (typeof arg == "string") {
          next.skill = arg;
        }
      }
    }
    if (next.cards == void 0) {
      if (get.itemtype(next.card) == "card") {
        next.cards = [next.card];
      } else {
        next.cards = [];
      }
    } else if (next.card == void 0) {
      if (next.cards) {
        next.card = next.cards[0];
      }
    }
    const event = get.event(), card = next.cards[0];
    next.modSkill = {
      cardname: null,
      cardnature: null,
      cardsuit: null,
      cardnumber: null
    };
    const keys = Object.keys(next.modSkill).flat();
    if (event.name == "chooseToRespond" && !next.skill && get.itemtype(card) == "card") {
      let skills = [];
      if (typeof this.getModableSkills === "function") {
        skills = this.getModableSkills();
      } else if (typeof this.getSkills === "function") {
        skills = this.getSkills().concat(lib.skill.global);
        game.expandSkills(skills);
        skills = skills.filter((i) => {
          const info = get.info(i);
          return info && info.mod;
        });
        skills.sort((a, b) => get.priority(a) - get.priority(b));
      }
      for (const key of keys) {
        if (key === "cardsuit") {
          let suit = card.suit;
          for (const stage of ["suit", "cardsuit"]) {
            for (const skill of skills) {
              const mods = get.info(skill).mod;
              if (!mods) throw new TypeError(`Expected mod configuration for ${skill}`);
              const result = stage === "suit" ? mods.suit?.call(game, card, suit) : mods.cardsuit?.call(game, card, this, suit);
              if (result != void 0 && typeof suit !== "object" && result !== suit) {
                suit = result;
                next.modSkill[key] = skill;
              }
            }
          }
          continue;
        }
        let preResult = "unchanged";
        for (const skill of skills) {
          const mods = get.info(skill).mod;
          if (!mods) throw new TypeError(`Expected mod configuration for ${skill}`);
          const mod = mods[key];
          if (mod) {
            let arg = [card, this, get[key.slice(4)](card, false), preResult];
            let result = mod.call(game, ...arg);
            if (result !== void 0 && typeof arg[arg.length - 1] !== "object") {
              arg[arg.length - 1] = result;
            }
            if (arg[arg.length - 1] !== preResult) {
              next.modSkill[key] = skill;
              preResult = arg[arg.length - 1];
            }
          }
        }
      }
    }
    if (next.card) {
      next.card = get.autoViewAs(next.card, next.cards);
    }
    next.setContent("respond");
    return next;
  }
};
export {
  cardUseAndRespondMethods
};
