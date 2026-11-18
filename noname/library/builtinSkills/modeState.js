import "../../../noname.js";
import { requireRegisteredSkill } from "../skillRegistry.js";
import { get } from "../../get/binding.js";
import { game } from "../../game/index.js";
import { lib } from "../index.js";
import { _status } from "../../status/index.js";
const modeStateSkills = {
  aozhan: {
    charlotte: true,
    ruleSkill: true,
    mod: {
      cardname(card, player) {
        if (card.name == "tao") {
          const evt = get.event(), viewAs = (name) => {
            if (get.itemtype(card) === "card") {
              return get.autoViewAs({ name, cards: [card] }, [card]);
            }
            const cards = card.cards ?? [];
            return get.autoViewAs({ name, cards }, cards);
          };
          if (typeof evt.filterCard == "function" && evt.filterCard(viewAs("shan"), player, evt) && !evt.filterCard(viewAs("sha"), player, evt)) {
            return "shan";
          }
          return "sha";
        }
      }
    },
    trigger: {
      player: ["useCardBefore", "respondBefore"]
    },
    silent: true,
    direct: true,
    firstDo: true,
    priority: Infinity,
    filter(event, player) {
      if (!event.card || !event.cards || !["sha", "shan"].includes(event.card.name) || event.card === event.cards[0] || event.cards.length != 1 || event.cards[0].name != "tao") {
        return false;
      }
      const evt = event.getParent();
      return typeof evt.filterCard == "function" && evt.filterCard({ name: "shan" }, player, evt) && evt.filterCard({ name: "sha" }, player, evt);
    },
    async content(event, trigger, player) {
      const result = await player.chooseControl({
        controls: ["sha", "shan"],
        prompt: `鏖战：请选择${get.translation(trigger.cards[0])}视为${trigger.name == "respond" ? "打出" : "使用"}的牌名`,
        ai: () => {
          const choice = _status.event.getParent(5).choice;
          if (choice && ["sha", "shan"].includes(choice)) {
            return choice;
          }
          return ["sha", "shan"].randomGet();
        }
      }).forResult();
      if (typeof result == "string" || typeof result.control != "string") {
        return;
      }
      const card = get.autoViewAs({ name: result.control }, trigger.cards);
      trigger.card = card;
      const parentResult = trigger.getParent().result;
      if (typeof parentResult != "object" || parentResult === null || Array.isArray(parentResult)) {
        throw new TypeError("aozhan parent requires an object result");
      }
      parentResult.card = card;
    },
    hiddenCard(player, name) {
      return ["sha", "shan"].includes(name) && player.countCards("hs", (card) => card.name == "tao");
    },
    ai: {
      respondSha: true,
      respondShan: true,
      skillTagFilter(player, tag, arg) {
        if (!player.countCards("hs", (card) => card.name == "tao")) {
          return false;
        }
      }
    }
  },
  global: [],
  globalmap: {},
  storage: {},
  undist: { charlotte: true },
  others: {},
  zhu: {},
  zhuSkill: {},
  land_used: {},
  unequip: { ai: { unequip: true } },
  subplayer: {
    trigger: { player: "dieBefore" },
    forced: true,
    priority: -9,
    onremove: true,
    mark: "character",
    intro: {
      content: function(storage, player) {
        if (typeof storage.intro2 == "string") {
          return storage.intro2;
        }
        if (typeof storage.intro2 == "function") {
          return storage.intro2(storage, player);
        }
        return "死亡前切换回主武将";
      },
      name: function(storage) {
        return get.rawName(storage.name);
      }
    },
    async content(event, trigger, player) {
      trigger.cancel();
      var evt = trigger.getParent("damage");
      if (evt.player == player) {
        if (typeof evt.untrigger != "function") {
          throw new TypeError("subplayer damage parent requires untrigger");
        }
        evt.untrigger(false, player);
      }
      player.exitSubPlayer(true);
    },
    ai: {
      nosave: true
    }
  },
  autoswap: {
    firstDo: true,
    trigger: {
      player: ["chooseToUseBegin", "chooseToRespondBegin", "chooseToDiscardBegin", "chooseToCompareBegin", "chooseButtonBegin", "chooseCardBegin", "chooseTargetBegin", "chooseCardTargetBegin", "chooseControlBegin", "chooseBoolBegin", "choosePlayerCardBegin", "discardPlayerCardBegin", "gainPlayerCardBegin", "chooseToMoveBegin", "chooseToPlayBeatmapBegin", "chooseToGiveBegin", "chooseToGuanxingBegin", "chooseButtonTargetBegin", "chooseNumbersBegin"]
    },
    forced: true,
    priority: 100,
    forceDie: true,
    popup: false,
    filter: function(event, player) {
      if (event.autochoose && event.autochoose()) {
        return false;
      }
      if (lib.filter.wuxieSwap(event)) {
        return false;
      }
      if (_status.auto || !player.isUnderControl()) {
        return false;
      }
      return true;
    },
    async content(event, trigger, player) {
      game.swapPlayerAuto(player);
    }
  },
  dualside: {
    charlotte: true,
    subSkill: {
      turn: {
        trigger: { player: ["turnOverAfter", "dieBefore"] },
        silent: true,
        filter: function(event, player) {
          if (player.storage.dualside_over) {
            return false;
          }
          return Array.isArray(player.storage.dualside);
        },
        async content(event, trigger, player) {
          var cfg = player.storage.dualside;
          var bool = player.isTurnedOver();
          if (trigger.name == "die") {
            bool = !bool;
          }
          if (bool) {
            cfg[1] = player.hp;
            cfg[2] = player.maxHp;
            player.reinit(cfg[0], cfg[3], [cfg[4], cfg[5]]);
            player.unmarkSkill("dualside");
            player.markSkillCharacter("dualside", { name: cfg[0] }, "正面", "当前体力：" + cfg[1] + "/" + cfg[2]);
          } else {
            cfg[4] = player.hp;
            cfg[5] = player.maxHp;
            player.reinit(cfg[3], cfg[0], [cfg[1], cfg[2]]);
            player.unmarkSkill("dualside");
            player.markSkillCharacter("dualside", { name: cfg[3] }, "背面", "当前体力：" + cfg[4] + "/" + cfg[5]);
          }
          if (trigger.name == "die") {
            trigger.cancel();
            delete player.storage.dualside;
            player.storage.dualside_over = true;
            player.unmarkSkill("dualside");
          }
        }
      },
      init: {
        trigger: { global: "gameStart", player: "enterGame" },
        silent: true,
        async content(event, trigger, player) {
          var list = [player.name1, player.name2];
          for (var i = 0; i < list.length; i++) {
            const characterName = list[i];
            if (characterName && lib.character[characterName]) {
              var info = lib.character[characterName];
              if (info.skills.includes("dualside") && info.dualSideCharacter) {
                player.storage.dualside = [characterName, player.hp, player.maxHp];
                var name2 = info.dualSideCharacter;
                var info2 = lib.character[name2];
                player.storage.dualside.push(name2);
                player.storage.dualside.push(info2.hp);
                player.storage.dualside.push(info2.maxHp);
              }
              break;
            }
          }
          var cfg = player.storage.dualside;
          if (!Array.isArray(cfg)) {
            return;
          }
          if (get.mode() == "guozhan") {
            if (player.name1 == cfg[0]) {
              player.showCharacter(0);
            } else {
              player.showCharacter(1);
            }
          }
          player.markSkillCharacter("dualside", { name: cfg[3] }, "背面", "当前体力：" + cfg[4] + "/" + cfg[5]);
        }
      }
    },
    group: ["dualside_init", "dualside_turn"]
  },
  fengyin: {
    init: function(player, skill) {
      player.addSkillBlocker(skill);
      player.addTip(skill, "非锁定技失效");
    },
    onremove: function(player, skill) {
      player.removeSkillBlocker(skill);
      player.removeTip(skill);
    },
    charlotte: true,
    skillBlocker: function(skill, player) {
      const info = requireRegisteredSkill(lib.skill, skill);
      return !info.persevereSkill && !info.charlotte && !get.is.locked(skill, player);
    },
    mark: true,
    intro: {
      content: function(storage, player, skill) {
        const blocker = requireRegisteredSkill(lib.skill, "fengyin").skillBlocker;
        if (!blocker) {
          throw new TypeError("fengyin skillBlocker is missing");
        }
        var list = player.getSkills(null, false, false).filter(function(i) {
          return blocker(i, player);
        });
        if (list.length) {
          return "失效技能：" + get.translation(list);
        }
        return "无失效技能";
      }
    }
  },
  baiban: {
    init: function(player, skill) {
      player.addSkillBlocker(skill);
    },
    onremove: function(player, skill) {
      player.removeSkillBlocker(skill);
    },
    charlotte: true,
    skillBlocker: function(skill, player) {
      const info = requireRegisteredSkill(lib.skill, skill);
      return !info.persevereSkill && !info.charlotte;
    },
    mark: true,
    intro: {
      content: function(storage, player, skill) {
        const blocker = requireRegisteredSkill(lib.skill, "baiban").skillBlocker;
        if (!blocker) {
          throw new TypeError("baiban skillBlocker is missing");
        }
        var list = player.getSkills(null, false, false).filter(function(i) {
          return blocker(i, player);
        });
        if (list.length) {
          return "失效技能：" + get.translation(list);
        }
        return "无失效技能";
      }
    }
  },
  qianxing: {
    mark: true,
    nopop: true,
    init: function(player) {
      game.log(player, "获得了", "【潜行】");
    },
    intro: {
      content: "锁定技，你不能成为其他角色的卡牌的目标"
    },
    mod: {
      targetEnabled: function(card, player, target) {
        if (player != target) {
          return false;
        }
      }
    }
  },
  mianyi: {
    trigger: { player: "damageBefore" },
    mark: true,
    forced: true,
    init: function(player) {
      game.log(player, "获得了", "【免疫】");
    },
    async content(event, trigger, player) {
      trigger.cancel();
    },
    ai: {
      nofire: true,
      nothunder: true,
      nodamage: true,
      effect: {
        target: function(card, player, target, current) {
          if (get.tag(card, "damage")) {
            return "zeroplayertarget";
          }
        }
      }
    },
    intro: {
      content: "防止一切伤害"
    }
  },
  mad: {
    mark: true,
    locked: true,
    intro: {
      content: "已进入混乱状态",
      name: "混乱",
      onunmark: function(storage, player) {
        game.log(player, "解除混乱状态");
      }
    }
  },
  ghujia: {
    intro: {
      content: function(content, player) {
        return "已有" + get.cnNumber(player.hujia) + "点护甲值";
      }
    },
    markimage: "image/card/shield.png"
  }
};
export {
  modeStateSkills
};
