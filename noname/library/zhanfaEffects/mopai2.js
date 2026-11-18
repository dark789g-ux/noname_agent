import "../../../noname.js";
import { game } from "../../game/index.js";
import { get } from "../../get/binding.js";
import { lib } from "../index.js";
import { _status } from "../../status/index.js";
const mopai2Effects = {
  //摸牌Ⅱ
  zf_mopai2: {
    rarity: "legend",
    translate: "摸牌Ⅱ",
    info: "摸牌阶段，你的摸牌数+2",
    card: {
      cardimage: "zf_mopai",
      ai: { basic: { value: 8.2 } }
    },
    skill: {
      inherit: "zf_phaseDraw",
      num: 2
    }
  },
  //木牛流马
  zf_muniuliuma: {
    rarity: "epic",
    translate: "木牛流马",
    info: "你的摸牌阶段，你额外摸两张牌,手牌上限-1",
    card: {
      ai: { basic: { value: 7.2 } }
    },
    skill: {
      inherit: "zf_phaseDraw",
      num: 2,
      mod: {
        maxHandcard(player, num) {
          return num - 1;
        }
      }
    }
  },
  //皮囊
  zf_pinang: {
    rarity: "common",
    translate: "皮囊",
    info: "手牌上限+1",
    card: {
      ai: { basic: { value: 5.7 } }
    },
    skill: {
      inherit: "zf_maxHandcard"
    }
  },
  //皮囊Ⅱ
  zf_pinang2: {
    rarity: "rare",
    translate: "皮囊Ⅱ",
    info: "手牌上限+2",
    card: {
      cardimage: "zf_pinang",
      ai: { basic: { value: 6.5 } }
    },
    skill: {
      inherit: "zf_maxHandcard",
      modNum: 2
    }
  },
  //皮囊Ⅲ
  zf_pinang3: {
    rarity: "epic",
    translate: "皮囊Ⅲ",
    info: "手牌上限+5",
    card: {
      cardimage: "zf_pinang",
      ai: { basic: { value: 7.7 } }
    },
    skill: {
      inherit: "zf_maxHandcard",
      modNum: 5
    }
  },
  //偏转甲
  zf_pianzhuanjia: {
    rarity: "legend",
    translate: "偏转甲",
    info: "每次受到伤害后对随机敌方造成1点伤害",
    card: {
      ai: { basic: { value: 8 } }
    },
    skill: {
      inherit: "zf_directDamage"
    }
  },
  //破釜沉舟
  zf_pofuchenzhou: {
    rarity: "common",
    translate: "破釜沉舟",
    info: "回合外受到伤害一次大于等于3点时，对伤害来源造成等量同属性伤害",
    card: {
      ai: { basic: { value: 4.5 } }
    },
    skill: {
      inherit: "zf_directDamage",
      filter(event, player) {
        return _status.currentPhase != player && Number(event.num) >= 3 && event.source?.isIn();
      },
      num: "event",
      nature: "event",
      select: "source"
    }
  },
  //强取豪夺
  zf_qiangquhaoduo: {
    rarity: "common",
    translate: "强取豪夺",
    info: "【顺手牵羊】时目标手牌可见",
    card: {
      ai: { basic: { value: 5.4 } }
    },
    skill: {
      trigger: { player: "gainPlayerCardBegin" },
      filter(event, player) {
        return event.getParent()?.name == "shunshou";
      },
      async content(event, trigger, player) {
        trigger.set("visible", true);
      }
    }
  },
  //巧取豪夺
  zf_qiaoquhaoduo: {
    rarity: "rare",
    translate: "巧取豪夺",
    info: "你的【借刀杀人】成功时，伤害+1",
    card: {
      ai: { basic: { value: 4.3 } }
    },
    skill: {
      inherit: "zf_cardDamage",
      trigger: { global: "useCard" },
      filter(event, player) {
        return event.card.name == "sha" && event.respondTo?.[0] == player && event.respondTo?.[1].name == "jiedao";
      }
    }
  },
  //弱反馈
  zf_ruofankui: {
    rarity: "epic",
    translate: "弱反馈",
    info: "受到1点伤害后，摸一张牌",
    card: {
      ai: { basic: { value: 6.3 } }
    },
    skill: {
      inherit: "zf_anyDraw",
      trigger: { player: "damageEnd" },
      getIndex(event, player) {
        return event.num;
      }
    }
  },
  //弱袭
  zf_ruoxi: {
    rarity: "legend",
    translate: "弱袭",
    info: "你的手牌小于当前体力时，你造成的伤害+1",
    card: {
      ai: { basic: { value: 7.8 } }
    },
    skill: {
      inherit: "zf_anyDamage",
      filter(event, player) {
        return player.countCards("h") < player.getHp();
      }
    }
  },
  //三板斧
  zf_sanbanfu: {
    rarity: "rare",
    translate: "三板斧",
    info: "你的每第三张【杀】伤害+1",
    card: {
      ai: { basic: { value: 6.7 } }
    },
    skill: {
      inherit: "zf_cardDamage",
      filter(event, player) {
        if (event.card.name != "sha") {
          return false;
        }
        const index = player.getAllHistory("useCard", (evt) => evt.card.name == "sha").indexOf(event) + 1;
        return index > 0 && index % 3 == 0;
      }
    }
  },
  //三板斧Ⅱ
  zf_sanbanfu2: {
    rarity: "legend",
    translate: "三板斧Ⅱ",
    info: "你的每第三张【杀】伤害+2",
    card: {
      cardimage: "zf_sanbanfu",
      ai: { basic: { value: 8.7 } }
    },
    skill: {
      inherit: "zf_sanbanfu",
      num: 2
    }
  },
  //神龙摆尾
  zf_shenlongbaiwei: {
    rarity: "rare",
    translate: "神龙摆尾",
    info: "你每摸九张卡牌，你对随机敌方造成1点伤害",
    card: {
      ai: { basic: { value: 6.1 } }
    },
    skill: {
      inherit: "zf_directDamage",
      trigger: { player: "gainAfter" },
      getIndex(event, player) {
        if (event.getParent()?.name != "draw") {
          return 0;
        }
        const prev = player.getAllHistory("gain", (evt) => evt.getParent()?.name == "draw", event).reduce((sum, evt) => sum + evt.cards.length, 0);
        const cur = prev + event.cards.length;
        return Math.floor(cur / 9) - Math.floor(prev / 9);
      }
    }
  },
  //神龙摆尾Ⅱ
  zf_shenlongbaiwei2: {
    rarity: "legend",
    translate: "神龙摆尾Ⅱ",
    info: "你每摸六张卡牌，你对随机敌方造成1点伤害",
    card: {
      cardimage: "zf_shenlongbaiwei",
      ai: { basic: { value: 8.1 } }
    },
    skill: {
      inherit: "zf_shenlongbaiwei",
      getIndex(event, player) {
        if (event.getParent()?.name != "draw") {
          return 0;
        }
        const prev = player.getAllHistory("gain", (evt) => evt.getParent()?.name == "draw", event).reduce((sum, evt) => sum + evt.cards.length, 0);
        const cur = prev + event.cards.length;
        return Math.floor(cur / 6) - Math.floor(prev / 6);
      }
    }
  },
  //士气剥夺
  zf_shiqiboduo: {
    rarity: "epic",
    translate: "士气剥夺",
    info: "所有敌方的体力上限-1，最低为1",
    card: {
      ai: { basic: { value: 7.3 } }
    },
    skill: {
      inherit: "zf_loseMaxHp",
      getTargets: (event, player) => player.getEnemies()
    }
  },
  //噬血I
  zf_shixue: {
    rarity: "legend",
    translate: "噬血I",
    info: "回复1点体力后，摸一张牌",
    card: {
      ai: { basic: { value: 7.2 } }
    },
    skill: {
      inherit: "zf_anyDraw",
      trigger: { player: "recoverEnd" },
      getIndex(event, player) {
        return event.num;
      }
    }
  },
  //手到擒来
  zf_shoudaoqinlai: {
    rarity: "common",
    translate: "手到擒来",
    info: "每回合你使用第七张牌后,你摸一张牌",
    card: {
      ai: { basic: { value: 5.6 } }
    },
    skill: {
      inherit: "zf_anyDraw",
      trigger: { player: "useCardAfter" },
      filter(event, player) {
        return player.getHistory("useCard").indexOf(event) == 6;
      }
    }
  },
  //手到擒来Ⅱ
  zf_shoudaoqinlai2: {
    rarity: "common",
    translate: "手到擒来Ⅱ",
    info: "每回合你使用第五张牌后,你摸一张牌",
    card: {
      cardimage: "zf_shoudaoqinlai",
      ai: { basic: { value: 6.5 } }
    },
    skill: {
      inherit: "zf_shoudaoqinlai",
      filter(event, player) {
        return player.getHistory("useCard").indexOf(event) == 4;
      }
    }
  },
  //手到擒来Ⅲ
  zf_shoudaoqinlai3: {
    rarity: "common",
    translate: "手到擒来Ⅲ",
    info: "每回合你使用第六张牌后,你摸两张牌",
    card: {
      cardimage: "zf_shoudaoqinlai",
      ai: { basic: { value: 7.1 } }
    },
    skill: {
      inherit: "zf_shoudaoqinlai",
      filter(event, player) {
        return player.getHistory("useCard").indexOf(event) == 5;
      },
      num: 2
    }
  },
  //双掠
  zf_shuanglve: {
    rarity: "rare",
    translate: "双掠",
    info: "你使用的【顺手牵羊】可额外结算一次",
    card: {
      ai: { basic: { value: 6 } }
    },
    skill: {
      inherit: "zf_extraEff",
      filter(event, player) {
        return event.card.name == "shunshou";
      }
    }
  },
  //双刃
  zf_shuangren: {
    rarity: "rare",
    translate: "双刃",
    info: "每轮，你的首张【杀】至多能额外选择1个目标",
    card: {
      ai: { basic: { value: 6.7 } }
    },
    skill: {
      trigger: { player: "useCard2" },
      select: 1,
      filter(event, player) {
        if (event.card.name != "sha") {
          return false;
        }
        return player.getRoundHistory("useCard", (evt) => evt.card.name == "sha").indexOf(event) == 0 && game.hasPlayer((target) => !event.getTargets().includes(target) && lib.filter.targetEnabled2(event.card, player, target) && lib.filter.targetInRange(event.card, player, target));
      },
      forced: false,
      async cost(event, trigger, player) {
        const skill = event.skill;
        if (!skill) {
          throw new TypeError("additional target cost requires an event skill");
        }
        const select = get.info(skill).select;
        event.result = await player.chooseTarget(get.prompt2(skill), select, (card, player2, target) => {
          const cardTrigger = get.event().getTrigger();
          if (!cardTrigger) {
            throw new TypeError("additional target filter requires a trigger event");
          }
          const cardx = cardTrigger.card;
          const targetTrigger = get.event().getTrigger();
          if (!targetTrigger || !targetTrigger.targets) {
            throw new TypeError("additional target filter requires trigger targets");
          }
          return !targetTrigger.targets.includes(target) && lib.filter.targetEnabled2(cardx, player2, target) && lib.filter.targetInRange(cardx, player2, target);
        }).set("ai", (target) => {
          const currentPlayer = get.player() ?? void 0;
          const triggerEvent = get.event().getTrigger();
          if (!triggerEvent) {
            throw new TypeError("additional target AI requires a trigger event");
          }
          return get.effect(target, triggerEvent.card, currentPlayer, currentPlayer);
        }).forResult();
      },
      async content(event, trigger, player) {
        const targets = event.getTargets();
        game.log(targets, "也成为", trigger.card, "的目标");
        trigger.getTargets().addArray(targets);
      }
    }
  },
  //双刃Ⅱ
  zf_shuangren2: {
    rarity: "epic",
    translate: "双刃Ⅱ",
    info: "每轮，你的首张【杀】至多能额外选择2个目标",
    card: {
      cardimage: "zf_shuangren",
      ai: { basic: { value: 7.7 } }
    },
    skill: {
      inherit: "zf_shuangren",
      select: [1, 2]
    }
  }
};
export {
  mopai2Effects
};
