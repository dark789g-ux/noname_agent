import "../../../../../../noname.js";
import { game } from "../../../../../game/index.js";
import { ui } from "../../../../../ui/index.js";
import { _status } from "../../../../../status/index.js";
import { get } from "../../../../../get/binding.js";
function createVersusVisibilityOptions() {
  return {
    update: function(config, map) {
      if (config.versus_mode == "four") {
        map.change_choice.hide();
        map.ladder.show();
        if (config.ladder) {
          map.ladder_monthly.show();
          map.ladder_reset.show();
        } else {
          map.ladder_monthly.hide();
          map.ladder_reset.hide();
        }
        map.enable_all.show();
        map.enable_all_cards_four.show();
        map.four_assign.show();
        map.four_phaseswap.show();
        map.expand_dialog.show();
        map.fouralign.show();
        map.edit_character_four.show();
        map.reset_character_four.show();
      } else {
        map.change_choice.show();
        map.ladder.hide();
        map.ladder_monthly.hide();
        map.ladder_reset.hide();
        map.enable_all.hide();
        map.enable_all_cards_four.hide();
        map.four_assign.hide();
        map.four_phaseswap.hide();
        map.expand_dialog.hide();
        map.fouralign.hide();
        map.edit_character_four.hide();
        map.reset_character_four.hide();
      }
      if (config.versus_mode == "three") {
        map.edit_character_three.show();
        map.reset_character_three.show();
      } else {
        map.edit_character_three.hide();
        map.reset_character_three.hide();
      }
      if (config.versus_mode == "three" || config.versus_mode == "one") {
        map.enable_all_three.show();
        map.enable_all_cards.show();
      } else {
        map.enable_all_three.hide();
        map.enable_all_cards.hide();
      }
      if (config.versus_mode == "jiange" || config.versus_mode == "two" || config.versus_mode == "endless" || config.versus_mode == "three" || config.versus_mode == "one" || config.versus_mode == "siguo") {
        map.free_choose.show();
      } else {
        map.free_choose.hide();
      }
      if (config.versus_mode == "jiange") {
        map.double_character_jiange.show();
      } else {
        map.double_character_jiange.hide();
      }
      if (config.versus_mode == "two") {
        map.replace_handcard_two.show();
        map.olfeiyang_four.show();
        map.replace_character_two.show();
        map.two_assign.show();
        map.two_phaseswap.show();
      } else {
        map.replace_handcard_two.hide();
        map.olfeiyang_four.hide();
        map.replace_character_two.hide();
        map.two_assign.hide();
        map.two_phaseswap.hide();
      }
      if (config.versus_mode == "two" || config.versus_mode == "siguo" || config.versus_mode == "four") {
        if (config.versus_mode == "four" && (config.four_assign || config.four_phaseswap)) {
          map.change_identity.hide();
        } else {
          map.change_identity.show();
        }
      } else {
        map.change_identity.hide();
      }
      if (config.versus_mode == "siguo") {
        map.siguo_character.show();
      } else {
        map.siguo_character.hide();
      }
    },
    versus_mode: {
      name: "游戏模式",
      init: "two",
      item: {
        four: "对抗",
        three: "统率",
        two: "欢乐",
        guandu: "官渡",
        jiange: "剑阁",
        siguo: "四国",
        standard: "自由"
        // endless:'无尽',
        // triple:'血战',
        // one:'<span style="display:inline-block;width:100%;text-align:center">1v1</span>',
      },
      restart: true,
      frequent: true
    },
    ladder: {
      name: "天梯模式",
      init: true,
      frequent: true,
      restart: true
    },
    ladder_monthly: {
      name: "每月重置天梯",
      init: true,
      frequent: true
    },
    enable_all: {
      name: "启用全部武将",
      init: false,
      frequent: true,
      restart: true
    },
    enable_all_cards_four: {
      name: "启用全部卡牌",
      init: false,
      frequent: true,
      restart: true
    },
    enable_all_three: {
      name: "启用全部武将",
      init: false,
      frequent: true,
      restart: true
    },
    enable_all_cards: {
      name: "启用全部卡牌",
      init: false,
      frequent: true,
      restart: true
    },
    four_assign: {
      name: "代替队友选将",
      init: false,
      restart: true
    },
    four_phaseswap: {
      name: "代替队友行动",
      init: false,
      restart: true
    },
    two_assign: {
      name: "代替队友选将",
      init: false,
      restart: true
    },
    two_phaseswap: {
      name: "代替队友行动",
      init: false,
      restart: true
    },
    free_choose: {
      name: "自由选将",
      init: true,
      frequent: true,
      onclick(bool) {
        game.saveConfig("free_choose", bool, this._link.config.mode);
        if (!ui.create.cheat2) {
          return;
        }
        if (get.mode() != this._link.config.mode || !_status.event.getParent().showConfig && !_status.event.showConfig) {
          return;
        }
        if (!ui.cheat2 && get.config("free_choose")) {
          ui.create.cheat2();
        } else if (ui.cheat2 && !get.config("free_choose")) {
          ui.cheat2.close();
          delete ui.cheat2;
        }
      }
    },
    fouralign: {
      name: "自由选择阵型",
      init: false
    },
    change_identity: {
      name: "自由选择座位",
      init: true,
      onclick(bool) {
        game.saveConfig("change_identity", bool, this._link.config.mode);
        if (!_status.event.getParent().showConfig && !_status.event.showConfig) {
          return;
        }
        if (_status.mode == "four") {
          if (get.config("four_assign") || get.config("four_phaseswap")) {
            return;
          }
          if (bool) {
            const parent = _status.event.parent;
            if (!parent) {
              throw new TypeError("identity configuration requires a parent event");
            }
            if (parent.addSetting) {
              parent.addSetting();
            }
          } else {
            const parent = _status.event.parent;
            if (!parent) {
              throw new TypeError("identity configuration requires a parent event");
            }
            var seats = parent.seatsbutton;
            if (seats) {
              while (seats.length) {
                seats.shift().remove();
              }
              delete parent.seatsbutton;
            }
          }
        } else {
          var dialog;
          if (ui.cheat2 && ui.cheat2.backup) {
            dialog = ui.cheat2.backup;
          } else {
            dialog = _status.event.dialog;
          }
          if (!_status.brawl || !_status.brawl.noAddSetting) {
            if (!dialog.querySelector("table") && get.config("change_identity")) {
              const parent = _status.event.getParent();
              if (typeof parent.addSetting != "function") {
                throw new TypeError("identity configuration parent requires addSetting");
              }
              parent.addSetting(dialog);
            } else {
              const parent = _status.event.getParent();
              if (typeof parent.removeSetting != "function") {
                throw new TypeError("identity configuration parent requires removeSetting");
              }
              parent.removeSetting(dialog);
            }
          }
          ui.update();
        }
      }
    },
    change_choice: {
      name: "开启换将卡",
      init: true,
      onclick(bool) {
        game.saveConfig("change_choice", bool, this._link.config.mode);
        if (!_status.event.getParent().showConfig && !_status.event.showConfig) {
          return;
        }
        if (!ui.cheat && get.config("change_choice")) {
          ui.create.cheat?.();
        } else if (ui.cheat && !get.config("change_choice")) {
          ui.cheat.close();
          delete ui.cheat;
        }
      },
      frequent: true
    },
    double_character_jiange: {
      name: "双将模式",
      init: false,
      frequent: true
    },
    replace_handcard_two: {
      name: "四号位保护",
      init: true,
      frequent: true,
      intro: "最后行动的角色起始手牌+1"
    },
    olfeiyang_four: {
      name: "四号位获得【飞扬】",
      init: true,
      frequent: true,
      intro: "最后行动的角色获得技能【飞扬】（限定技，准备阶段，你可以弃置两张牌，然后弃置判定区的一张牌）"
    },
    replace_character_two: {
      name: "替补模式",
      init: false,
      frequent: true,
      intro: "每个额外选择一名武将，死亡后用该武将代替重新上场，替补武将用完时失败"
    },
    expand_dialog: {
      name: "默认展开选将框",
      intro: "选将框打开时直接显示全部武将（可能使游戏在开始时卡顿）",
      init: false
    },
    siguo_character: {
      name: "专属武将出场率",
      init: "increase",
      item: {
        increase: "大概率",
        normal: "默认概率",
        off: "不出现"
      },
      frequent: true
    },
    ladder_reset: {
      name: "重置天梯数据",
      onclick() {
        var node = this;
        if (node._clearing) {
          game.save("ladder", {
            current: 900,
            top: 900,
            month: (/* @__PURE__ */ new Date()).getMonth()
          });
          if (ui.ladder) {
            ui.ladder.innerHTML = "卫士五";
          }
          clearTimeout(node._clearing);
          node.firstChild.innerHTML = "重置天梯数据";
          delete node._clearing;
          return;
        }
        node.firstChild.innerHTML = "单击以确认 (3)";
        node._clearing = setTimeout(function() {
          node.firstChild.innerHTML = "单击以确认 (2)";
          node._clearing = setTimeout(function() {
            node.firstChild.innerHTML = "单击以确认 (1)";
            node._clearing = setTimeout(function() {
              node.firstChild.innerHTML = "重置天梯数据";
              delete node._clearing;
            }, 1e3);
          }, 1e3);
        }, 1e3);
      },
      clear: true
    }
  };
}
export {
  createVersusVisibilityOptions
};
