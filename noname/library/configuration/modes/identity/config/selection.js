import "../../../../../../noname.js";
import { game } from "../../../../../game/index.js";
import { get } from "../../../../../get/binding.js";
import { ui } from "../../../../../ui/index.js";
import { _status } from "../../../../../status/index.js";
function createIdentitySelectionOptions() {
  return {
    change_choice: {
      name: "开启换将卡",
      init: true,
      onclick(bool) {
        game.saveConfig("change_choice", bool, this._link.config.mode);
        if (get.mode() != "identity" || !_status.event.getParent().showConfig && !_status.event.showConfig) {
          return;
        }
        if (!ui.cheat && get.config("change_choice")) {
          ui.create.cheat?.();
        } else if (ui.cheat && !get.config("change_choice")) {
          ui.cheat.close();
          delete ui.cheat;
        }
      }
    },
    change_card: {
      name: "开启手气卡",
      init: "disabled",
      item: {
        disabled: "禁用",
        once: "一次",
        twice: "两次",
        unlimited: "无限"
      }
    },
    round_one_use_fury: {
      name: "开启首轮强化卡牌",
      init: false,
      frequent: false,
      restart: true,
      intro: "谋攻篇规则为第二轮开始才可使用怒气强化卡牌，开启此选项从游戏开始即可强化卡牌。"
    },
    nei_auto_mark_camouflage: {
      name: "内奸自动标记伪装反贼",
      intro: "玩家内奸在游戏开始洞察结束后，自动将被洞察角色标记为反贼。",
      init: false,
      unfrequent: true
    },
    continue_game: {
      name: "显示再战",
      init: false,
      onclick(bool) {
        game.saveConfig("continue_game", bool, this._link.config.mode);
        if (get.config("continue_game") && get.mode() == "identity") {
          if (!ui.continue_game && _status.over && !_status.brawl && !game.no_continue_game) {
            ui.continue_game = ui.create.control("再战", game.reloadCurrent);
          }
        } else if (ui.continue_game) {
          ui.continue_game.close();
          delete ui.continue_game;
        }
      },
      intro: "游戏结束后可选择用相同的武将再进行一局游戏"
    },
    dierestart: {
      name: "死亡后显示重来",
      init: true,
      onclick(bool) {
        game.saveConfig("dierestart", bool, this._link.config.mode);
        if (get.config("dierestart") && get.mode() == "identity") {
          if (!ui.restart && game.getMe().isDead() && !_status.connectMode) {
            ui.restart = ui.create.control("restart", game.reload);
          }
        } else if (ui.restart) {
          ui.restart.close();
          delete ui.restart;
        }
      }
    },
    revive: {
      name: "死亡后显示复活",
      init: false,
      onclick(bool) {
        game.saveConfig("revive", bool, this._link.config.mode);
        if (get.config("revive") && get.mode() == "identity") {
          if (!ui.revive && game.getMe().isDead()) {
            ui.revive = ui.create.control("revive", ui.click.dierevive);
          }
        } else if (ui.revive) {
          ui.revive.close();
          delete ui.revive;
        }
      }
    },
    ban_identity: {
      name: "屏蔽身份",
      init: "off",
      item: {
        off: "关闭",
        zhu: "主公",
        zhong: "忠臣",
        nei: "内奸",
        fan: "反贼"
      }
    },
    ban_identity2: {
      name: "屏蔽身份2",
      init: "off",
      item: {
        off: "关闭",
        zhu: "主公",
        zhong: "忠臣",
        nei: "内奸",
        fan: "反贼"
      }
    },
    ban_identity3: {
      name: "屏蔽身份3",
      init: "off",
      item: {
        off: "关闭",
        zhu: "主公",
        zhong: "忠臣",
        nei: "内奸",
        fan: "反贼"
      }
    },
    ai_strategy: {
      name: "内奸策略",
      init: "ai_strategy_1",
      item: {
        ai_strategy_1: "均衡",
        ai_strategy_2: "偏反",
        ai_strategy_3: "偏忠",
        ai_strategy_4: "酱油",
        ai_strategy_5: "天使",
        ai_strategy_6: "仇主"
      },
      intro: "设置内奸对主忠反的态度"
    },
    difficulty: {
      name: "AI对人类态度",
      init: "normal",
      item: {
        easy: "友好",
        normal: "一般",
        hard: "仇视"
      }
    },
    choice_zhu: {
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
        game.saveConfig("choice_zhu", num, "identity");
      }
    },
    limit_zhu: {
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
          await game.promises.saveConfig("limit_zhu", item, "identity");
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
              await game.promises.saveConfig("limit_zhu", result, "identity");
              break;
            }
          }
          alert("请输入大于0的整数");
        }
      }
    },
    choice_zhong: {
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
        game.saveConfig("choice_zhong", num, "identity");
      }
    },
    choice_nei: {
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
        game.saveConfig("choice_nei", num, "identity");
      }
    },
    choice_fan: {
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
        game.saveConfig("choice_fan", num, "identity");
      }
    },
    enable_commoner: {
      name: "启用平民",
      init: false,
      restart: true,
      frequent: false,
      intro: "开启后游戏中将有一个平民（身份）加入游戏。<br>具体规则请查看帮助。"
    },
    choice_commoner: {
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
        game.saveConfig("choice_commoner", num, "identity");
      }
    },
    enable_year_limit: {
      name: "启用年机制",
      init: false,
      restart: true,
      frequent: false,
      intro: "开启后将会加入年机制。<br>年机制的具体规则请查看帮助。"
    },
    enable_mingcha: {
      name: "启用明察",
      init: false,
      restart: true,
      frequent: false,
      intro: "开启后主公将获得技能〖明察〗。"
    }
  };
}
export {
  createIdentitySelectionOptions
};
