import "../../../../../noname.js";
import { lib } from "../../../index.js";
import { game } from "../../../../game/index.js";
function createModeIdentityConnect() {
  return {
    update: function(config, map) {
      if (config.connect_identity_mode == "stratagem") {
        map.connect_round_one_use_fury.show();
      } else {
        map.connect_round_one_use_fury.hide();
      }
      if (config.connect_identity_mode == "zhong") {
        map.connect_player_number.hide();
        map.connect_choice_zhu.hide();
        map.connect_limit_zhu.hide();
        map.connect_enhance_zhu.hide();
        map.connect_enable_mingcha.hide();
        map.connect_choice_zhong.hide();
        map.connect_choice_fan.hide();
        map.connect_choice_nei.hide();
        map.connect_double_nei.hide();
        map.connect_enable_commoner.hide();
        map.connect_choice_commoner.hide();
        map.connect_enable_year_limit.show();
        map.connect_zhong_card.show();
        map.connect_special_identity.hide();
        map.connect_double_character.show();
      } else if (config.connect_identity_mode == "stratagem") {
        map.connect_double_character.show();
        map.connect_player_number.show();
        map.connect_choice_zhu.show();
        map.connect_limit_zhu.hide();
        map.connect_enhance_zhu.hide();
        map.connect_enable_mingcha.hide();
        map.connect_choice_zhong.show();
        map.connect_choice_fan.show();
        map.connect_choice_nei.show();
        map.connect_double_nei.hide();
        map.connect_enable_commoner.hide();
        map.connect_choice_commoner.hide();
        map.connect_enable_year_limit.show();
        map.connect_zhong_card.hide();
        map.connect_special_identity.hide();
      } else if (config.connect_identity_mode == "purple") {
        map.connect_player_number.hide();
        map.connect_choice_zhu.hide();
        map.connect_limit_zhu.hide();
        map.connect_enhance_zhu.hide();
        map.connect_enable_mingcha.hide();
        map.connect_choice_zhong.hide();
        map.connect_choice_fan.hide();
        map.connect_choice_nei.hide();
        map.connect_double_nei.hide();
        map.connect_enable_commoner.hide();
        map.connect_choice_commoner.hide();
        map.connect_enable_year_limit.hide();
        map.connect_zhong_card.hide();
        map.connect_special_identity.hide();
        map.connect_double_character.hide();
      } else {
        map.connect_double_character.show();
        map.connect_player_number.show();
        map.connect_choice_zhu.show();
        map.connect_limit_zhu.show();
        map.connect_enhance_zhu.show();
        map.connect_enable_mingcha.show();
        map.connect_choice_zhong.show();
        map.connect_choice_fan.show();
        map.connect_choice_nei.show();
        map.connect_double_nei[config.connect_player_number != "2" && !config.connect_enable_commoner ? "show" : "hide"]();
        map.connect_enable_commoner[config.connect_player_number != "2" && !config.connect_double_nei ? "show" : "hide"]();
        map.connect_choice_commoner[config.connect_enable_commoner ? "show" : "hide"]();
        map.connect_enable_year_limit.show();
        map.connect_zhong_card.hide();
        if (config.connect_player_number == "8") {
          map.connect_special_identity.show();
        } else {
          map.connect_special_identity.hide();
        }
      }
    },
    connect_identity_mode: {
      name: "游戏模式",
      init: "normal",
      item: {
        normal: "标准",
        zhong: "明忠",
        stratagem: "谋攻",
        purple: "3v3v2"
      },
      restart: true,
      frequent: true,
      intro: "明忠模式和3v3v2模式详见帮助"
    },
    connect_player_number: {
      name: "游戏人数",
      init: "8",
      get item() {
        return lib.mode.identity.config.player_number.item;
      },
      frequent: true,
      restart: true
    },
    connect_choice_zhu: {
      name: "主公候选武将数",
      init: 3,
      input: true,
      restart: true,
      onblur(e) {
        let text = e.target, num = Number(text.innerText);
        if (isNaN(num) || num < 1) {
          num = 1;
        } else if (!Number.isInteger(num)) {
          num = Math.round(num);
        }
        text.innerText = num;
        game.saveConfig("connect_choice_zhu", num, "identity");
      }
    },
    connect_limit_zhu: {
      name: "常备主候选武将数",
      init: "group",
      restart: true,
      item: {
        off: "不限制",
        group: "按势力筛选",
        number: "自选数值"
      },
      async onclick(item) {
        if (item !== "number") {
          await game.promises.saveConfig("connect_limit_zhu", item, "identity");
          return;
        }
        while (true) {
          const result = await game.promises.prompt("请输入常备主候选武将数");
          if (!result) {
            break;
          }
          if (/^-?\d+(\.\d+)?$/.test(result)) {
            const number = Number(result);
            if (number > 0 && Number.isInteger(number)) {
              this.querySelector("div").innerHTML = result;
              await game.promises.saveConfig("connect_limit_zhu", result, "identity");
              break;
            }
          }
          alert("请输入大于0的整数");
        }
      }
    },
    connect_choice_zhong: {
      name: "忠臣候选武将数",
      init: 4,
      input: true,
      restart: true,
      onblur(e) {
        let text = e.target, num = Number(text.innerText);
        if (isNaN(num) || num < 1) {
          num = 1;
        } else if (!Number.isInteger(num)) {
          num = Math.round(num);
        }
        text.innerText = num;
        game.saveConfig("connect_choice_zhong", num, "identity");
      }
    },
    connect_zhong_card: {
      name: "明忠卡牌替换",
      init: true,
      frequent: true,
      restart: true
    },
    connect_choice_fan: {
      name: "反贼候选武将数",
      init: 3,
      input: true,
      restart: true,
      onblur(e) {
        let text = e.target, num = Number(text.innerText);
        if (isNaN(num) || num < 1) {
          num = 1;
        } else if (!Number.isInteger(num)) {
          num = Math.round(num);
        }
        text.innerText = num;
        game.saveConfig("connect_choice_fan", num, "identity");
      }
    },
    connect_choice_nei: {
      name: "内奸候选武将数",
      init: 6,
      input: true,
      restart: true,
      onblur(e) {
        let text = e.target, num = Number(text.innerText);
        if (isNaN(num) || num < 1) {
          num = 1;
        } else if (!Number.isInteger(num)) {
          num = Math.round(num);
        }
        text.innerText = num;
        game.saveConfig("connect_choice_nei", num, "identity");
      }
    },
    connect_double_nei: {
      name: "双内奸",
      init: false,
      restart: true,
      // frequent:true,
      get intro() {
        return lib.mode.identity.config.double_nei.intro;
      }
    },
    connect_enable_commoner: {
      name: "启用平民",
      init: false,
      restart: true,
      frequent: false,
      get intro() {
        return lib.mode.identity.config.enable_commoner.intro;
      }
    },
    connect_choice_commoner: {
      name: "平民候选武将数",
      init: 4,
      input: true,
      restart: true,
      onblur(e) {
        let text = e.target, num = Number(text.innerText);
        if (isNaN(num) || num < 1) {
          num = 1;
        } else if (!Number.isInteger(num)) {
          num = Math.round(num);
        }
        text.innerText = num;
        game.saveConfig("connect_choice_commoner", num, "identity");
      }
    },
    connect_double_character: {
      name: "双将模式",
      init: false,
      frequent: true,
      restart: true
    },
    connect_change_card: {
      name: "启用手气卡",
      init: false,
      frequent: true,
      restart: true
    },
    connect_special_identity: {
      name: "特殊身份",
      init: false,
      restart: true,
      frequent: true,
      intro: "开启后游戏中将增加军师、大将、贼首三个身份"
    },
    connect_enable_year_limit: {
      name: "启用年机制",
      init: false,
      restart: true,
      frequent: false,
      get intro() {
        return lib.mode.identity.config.enable_year_limit.intro;
      }
    },
    connect_round_one_use_fury: {
      name: "开启首轮强化卡牌",
      init: false,
      frequent: false,
      restart: true,
      intro: "谋攻篇规则为第二轮开始才可使用怒气强化卡牌，开启此选项从游戏开始即可强化卡牌。"
    },
    connect_enhance_zhu: {
      name: "加强主公",
      init: "off",
      item: {
        sixiang: "四象标记",
        specific: "专属技能",
        off: "关闭"
      },
      restart: true,
      intro: "为主公增加一个额外技能。<br><li>四象标记：主公随机获得一个四象标记（限发动一次）；每个回合结束时，若场上没有反贼，主公失去此标记。<br><li>专属技能：至少三名反贼的身份场，主公获得一个专属技能（无则改为〖天命〗）；一名角色阵亡后，若存活反贼数小于3，主公失去此技能。"
    },
    connect_enable_mingcha: {
      name: "启用明察",
      init: false,
      restart: true,
      frequent: false,
      get intro() {
        return lib.mode.identity.config.enable_mingcha.intro;
      }
    }
  };
}
export {
  createModeIdentityConnect
};
