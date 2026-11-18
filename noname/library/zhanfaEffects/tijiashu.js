import "../../../noname.js";
import { game } from "../../game/index.js";
import { get } from "../../get/binding.js";
import { _status } from "../../status/index.js";
const tijiashuEffects = {
  //剔甲术
  zf_tijiashu: {
    rarity: "epic",
    translate: "剔甲术",
    info: "对护甲造成双倍伤害",
    card: {
      ai: { basic: { value: 6.9 } }
    },
    skill: {
      inherit: "zf_anyDamage",
      filter(event, player) {
        return Number(event.getPlayer().hujia) > 0 && !event.nohujia && !player.hasSkillTag("nohujia");
      },
      num: (event, trigger, player) => Math.min(Math.floor(trigger.player.hujia / 2), trigger.num)
    }
  },
  //体魄
  zf_tipo: {
    rarity: "epic",
    translate: "体魄",
    info: "增加1点体力上限并回复等量体力",
    card: {
      ai: { basic: { value: 6 } }
    },
    skill: {
      num: 1,
      inherit: "zf_onAdd",
      async callback(event, trigger, player) {
        const { num } = get.info(event.name);
        await player.gainMaxHp({ num });
        await player.recover({ num });
      }
    }
  },
  //体魄Ⅱ
  zf_tipo2: {
    rarity: "legend",
    translate: "体魄Ⅱ",
    info: "增加2点体力上限并回复等量体力",
    card: {
      cardimage: "zf_tipo",
      ai: { basic: { value: 7.5 } }
    },
    skill: {
      inherit: "zf_tipo",
      num: 2
    }
  },
  //体魄Ⅲ
  zf_tipo3: {
    rarity: "legend",
    translate: "体魄Ⅲ",
    info: "增加3点体力上限并回复等量体力",
    card: {
      cardimage: "zf_tipo",
      ai: { basic: { value: 9 } }
    },
    skill: {
      inherit: "zf_tipo",
      num: 3
    }
  },
  //天降锦囊
  zf_tianjiangjinnang: {
    rarity: "rare",
    translate: "天降锦囊",
    info: "获得三张锦囊牌",
    card: {
      ai: { basic: { value: 7.2 } }
    },
    skill: {
      inherit: "zf_directGain",
      cardFilter: { type2: "trick" },
      num: 3
    }
  },
  //天降横财
  zf_tianjianghengcai: {
    rarity: "rare",
    translate: "天降横财",
    info: "获得四张基本牌",
    card: {
      ai: { basic: { value: 7.2 } }
    },
    skill: {
      inherit: "zf_directGain",
      cardFilter: { type2: "basic" },
      num: 4
    }
  },
  //天降装备
  zf_tianjiangzhuangbei: {
    rarity: "rare",
    translate: "天降装备",
    info: "获得四张装备牌",
    card: {
      ai: { basic: { value: 7.2 } }
    },
    skill: {
      inherit: "zf_directGain",
      cardFilter: { type2: "equip" },
      num: 4
    }
  },
  //天降卡牌
  zf_tianjiangkapai: {
    rarity: "rare",
    translate: "天降卡牌",
    info: "获得三张牌",
    card: {
      ai: { basic: { value: 7.5 } }
    },
    skill: {
      inherit: "zf_directGain",
      num: 3
    }
  },
  //铁布衫
  zf_tiebushan: {
    rarity: "common",
    translate: "铁布衫",
    info: "获得1点护甲",
    card: {
      ai: { basic: { value: 6 } }
    },
    skill: {
      num: 1,
      inherit: "zf_onAdd",
      async callback(event, trigger, player) {
        const { num } = get.info(event.name);
        await player.changeHujia(num);
      }
    }
  },
  //铁布衫Ⅱ
  zf_tiebushan2: {
    rarity: "rare",
    translate: "铁布衫Ⅱ",
    info: "获得2点护甲",
    card: {
      cardimage: "zf_tiebushan",
      ai: { basic: { value: 7 } }
    },
    skill: {
      num: 2,
      inherit: "zf_tiebushan"
    }
  },
  //铁布衫Ⅲ
  zf_tiebushan3: {
    rarity: "legend",
    translate: "铁布衫Ⅲ",
    info: "获得4点护甲",
    card: {
      cardimage: "zf_tiebushan",
      ai: { basic: { value: 9 } }
    },
    skill: {
      num: 4,
      inherit: "zf_tiebushan"
    }
  },
  //偷袭
  zf_touxi: {
    rarity: "rare",
    translate: "偷袭",
    info: "黑桃【杀】无次数限制",
    card: {
      ai: { basic: { value: 7 } }
    },
    skill: {
      inherit: "zf_cardUsable",
      modNum: Infinity,
      cardFilter: { name: "sha", suit: "spade" }
    }
  },
  //稳定体质
  zf_wendingtizhi: {
    rarity: "common",
    translate: "稳定体质",
    info: "你的体力上限固定为7，无法通过任何途径改变体力值上限",
    card: {
      ai: { basic: { value: 7.3 } }
    },
    skill: {
      inherit: "zf_onAdd",
      async callback(event, trigger, player) {
        const num = 7 - Number(player.maxHp);
        await player[num > 0 ? "gainMaxHp" : "loseMaxHp"]({ num: Math.abs(num) });
        await player.recover({ num: Math.abs(num) });
      },
      group: "zf_wendingtizhi_effect",
      subSkill: {
        effect: {
          charlotte: true,
          trigger: { player: ["gainMaxHpBefore", "loseMaxHpBefore"] },
          filter(event, player) {
            return event.parent?.name !== "zf_wendingtizhi";
          },
          async content(event, trigger, player) {
            trigger.cancel();
          }
        }
      }
    }
  },
  //稳定后勤
  zf_wendinghouqin: {
    rarity: "legend",
    translate: "稳定后勤",
    info: "摸牌阶段摸牌数固定为5",
    card: {
      ai: { basic: { value: 7.3 } }
    },
    skill: {
      inherit: "zf_phaseDraw",
      lastDo: true,
      async content(event, trigger, player) {
        trigger.num = 5;
        trigger.set("numFixed", true);
      }
    }
  },
  //稳定进攻
  zf_wendingjingong: {
    rarity: "legend",
    translate: "稳定进攻",
    info: "回合内出杀次数固定为5",
    card: {
      ai: { basic: { value: 7.5 } }
    },
    skill: {
      inherit: "zf_cardUsable",
      cardFilter: "sha",
      modNum: () => 5
    }
  },
  //稳定承载
  zf_wendingchengzai: {
    rarity: "legend",
    translate: "稳定承载",
    info: "手牌上限固定为8",
    card: {
      ai: { basic: { value: 7.9 } }
    },
    skill: {
      mod: {
        maxHandcardFinal(player, num) {
          return 8;
        }
      }
    }
  },
  //稳定士气
  zf_wendingshiqi: {
    rarity: "legend",
    translate: "稳定士气",
    info: "您的所有伤害值固定为2",
    card: {
      ai: { basic: { value: 8 } }
    },
    skill: {
      trigger: { source: "damageBegin4" },
      lastDo: true,
      async content(event, trigger, player) {
        trigger.num = 2;
      }
    }
  },
  //卧薪尝胆
  zf_woxinchangdan: {
    rarity: "epic",
    translate: "卧薪尝胆",
    info: "回合外每受到1次伤害，下回合出杀次数+1",
    card: {
      ai: { basic: { value: 7.4 } }
    },
    skill: {
      trigger: { player: "damageEnd" },
      filter(event, player) {
        return _status.currentPhase !== player;
      },
      async content(event, trigger, player) {
        player.addMark(event.name + "_effect", 1, false);
        player.addTempSkill(event.name + "_effect", { player: "phaseAfter" });
      },
      subSkill: {
        effect: {
          charlotte: true,
          onremove: true,
          mod: {
            cardUsable(card, player, num) {
              if (card.name == "sha" && player === _status.currentPhase && typeof num === "number") {
                return num + player.countMark("zf_woxinchangdan_effect");
              }
            }
          }
        }
      }
    }
  },
  //狭路相逢
  zf_xialuxiangfeng: {
    rarity: "common",
    translate: "狭路相逢",
    info: "受到【决斗】伤害后回复1点体力",
    card: {
      ai: { basic: { value: 5 } }
    },
    skill: {
      trigger: { player: "damageEnd" },
      filter(event, player) {
        return event.card?.name == "juedou";
      },
      async content(event, trigger, player) {
        await player.recover();
      }
    }
  },
  //信手拈来
  zf_xinshounianlai: {
    rarity: "rare",
    translate: "信手拈来",
    info: "你的手牌上限不因体力值改变而改变",
    card: {
      ai: { basic: { value: 6.5 } }
    },
    skill: {
      mod: {
        maxHandcardBase(player, num) {
          return player.maxHp;
        }
      }
    }
  },
  //虚焰
  zf_xuyan: {
    rarity: "common",
    translate: "虚焰",
    info: "【火攻】弃置改为展示",
    card: {
      ai: { basic: { value: 5.8 } }
    },
    skill: {
      trigger: { player: "huogongBegin" },
      async content(event, trigger, player) {
        trigger.set("chooseToDiscard", async (event2, player2, target) => {
          const { discardPostion = "h", cards2, filterDiscard = { suit: get.suit(cards2[0]) } } = event2;
          const result = await player2.chooseCard(`请选择火攻要展示的牌`, discardPostion, filterDiscard).set("ai", () => Math.random()).forResult();
          if (result?.bool && result.cards?.length) {
            await player2.showCards(result.cards, `${get.translation(player2)}因<span class = bluetext>虚焰</span>修改过的【火攻】展示的牌`);
          }
          return result;
        });
      }
      /*trigger: { player: "chooseToDiscardBegin" },
      filter(event, player) {
      	return event.getParent()?.name == "huogong";
      },
      async content(event, trigger, player) {
      	trigger.chooseonly = true;
      	player
      		.when("chooseToDiscardAfter")
      		.filter(evt => evt == trigger)
      		.step(async (event, trigger, player) => {
      			if (trigger.result?.cards?.length) {
      				const { cards } = trigger.result;
      				await player.showCards(cards, `${get.translation(player)}【火攻】展示的牌`);
      			}
      		});
      },*/
    }
  },
  //蓄力箭
  zf_xulijian: {
    rarity: "common",
    translate: "蓄力箭",
    info: "你使用的【万箭齐发】其他角色需要使用2张【闪】来响应",
    card: {
      ai: { basic: { value: 4.2 } }
    },
    skill: {
      trigger: { player: "useCard" },
      filter(event, player) {
        return event.card.name == "wanjian";
      },
      async content(event, trigger, player) {
        game.filterPlayer((target) => target != player).forEach((target) => {
          const id = target.playerid;
          const idKey = id === void 0 ? "undefined" : id;
          const map = trigger.customArgs;
          map[idKey] ??= {};
          if (typeof map[idKey].shanRequired == "number") {
            map[idKey].shanRequired++;
          } else {
            map[idKey].shanRequired = 2;
          }
        });
      },
      ai: {
        directHit_ai: true,
        skillTagFilter(player, tag, arg) {
          if (arg.card.name != "wanjian" || arg.target.countCards("h", "shan") > 1) {
            return false;
          }
        }
      }
    }
  }
};
export {
  tijiashuEffects
};
