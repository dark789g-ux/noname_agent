import "../../../../../../noname.js";
import { game } from "../../../../../game/index.js";
import { ui } from "../../../../../ui/index.js";
import { get } from "../../../../../get/binding.js";
import { lib } from "../../../../index.js";
import { _status } from "../../../../../status/index.js";
function createViewVisibilityOptions() {
  return {
    update: function(config, map) {
      if (lib.config.mode == "versus" || lib.config.mode == "chess" || lib.config.mode == "tafang" || lib.config.mode == "boss") {
        map.show_handcardbutton.show();
      } else {
        map.show_handcardbutton.hide();
      }
      if (lib.config.touchscreen) {
        map.pop_logv.hide();
      } else {
        map.pop_logv.show();
      }
      if (lib.device) {
        if (lib.device == "android") {
          map.show_statusbar_android.show();
          map.show_statusbar_ios.hide();
        } else if (lib.device == "ios") {
          map.show_statusbar_ios.show();
          map.show_statusbar_android.hide();
        }
        if (!game.download) {
          setTimeout(function() {
            if (!window.StatusBar) {
            }
          }, 5e3);
        }
      } else {
        map.show_statusbar_ios.hide();
        map.show_statusbar_android.hide();
      }
      if (get.is.phoneLayout()) {
        map.remember_round_button.show();
        map.popequip.show();
        map.filternode_button.show();
        map.show_pause.hide();
        map.show_auto.hide();
        map.show_replay.hide();
        map.show_round_menu.show();
      } else {
        map.show_pause.show();
        map.show_auto.show();
        map.show_replay.show();
        map.show_round_menu.hide();
        map.remember_round_button.hide();
        map.popequip.hide();
        map.filternode_button.hide();
      }
      if (lib.config.show_card_prompt) {
        map.hide_card_prompt_basic.show();
        map.hide_card_prompt_equip.show();
      } else {
        map.hide_card_prompt_basic.hide();
        map.hide_card_prompt_equip.hide();
      }
      if (lib.config.show_log != "off") {
        map.clear_log.show();
      } else {
        map.clear_log.hide();
      }
      if (lib.config.show_charactercard) {
        map.show_charactercardMode.show();
      } else {
        map.show_charactercardMode.hide();
      }
      if (get.is.phoneLayout()) {
        map.show_time2.show();
        map.show_time.hide();
        if (lib.config.show_time2) {
          map.watchface.show();
        } else {
          map.watchface.hide();
        }
      } else {
        map.show_time2.hide();
        map.show_time.show();
        map.watchface.hide();
      }
      if (lib.config.show_extensionmaker) {
        map.show_extensionshare.show();
      } else {
        map.show_extensionshare.hide();
      }
    },
    show_history: {
      name: "出牌记录栏",
      init: "off",
      intro: "在屏幕左侧或右侧显示出牌记录",
      unfrequent: true,
      item: {
        off: "关闭",
        left: "靠左",
        right: "靠右"
      },
      onclick(bool) {
        if (lib.config.show_history == "right") {
          ui.window.addTempClass("rightbar2");
        }
        game.saveConfig("show_history", bool);
        if (_status.video || !_status.prepareArena) {
          return;
        }
        if (bool == "left") {
          ui.window.classList.add("leftbar");
          ui.window.classList.remove("rightbar");
        } else if (bool == "right") {
          ui.window.classList.remove("leftbar");
          ui.window.classList.add("rightbar");
        } else {
          ui.window.classList.remove("leftbar");
          ui.window.classList.remove("rightbar");
        }
      }
    },
    pop_logv: {
      name: "自动弹出记录",
      init: false,
      unfrequent: true
    },
    show_log: {
      name: "历史记录栏",
      init: "off",
      intro: "在屏幕中部显示出牌文字记录",
      unfrequent: true,
      item: {
        off: "关闭",
        left: "靠左",
        center: "居中",
        right: "靠右"
      },
      onclick(bool) {
        game.saveConfig("show_log", bool);
        if (lib.config.show_log != "off") {
          ui.arenalog.style.display = "";
          ui.arenalog.dataset.position = bool;
        } else {
          ui.arenalog.style.display = "none";
          ui.arenalog.innerHTML = "";
        }
      }
    },
    clear_log: {
      name: "自动清除历史记录",
      init: false,
      unfrequent: true,
      intro: "开启后将定时清除历史记录栏的条目（而不是等记录栏满后再清除）"
    },
    log_highlight: {
      name: "历史记录高亮",
      init: true,
      unfrequent: true,
      intro: "开启后历史记录不同类别的信息将以不同颜色显示"
    },
    show_time: {
      name: "显示时间",
      intro: "在屏幕顶部显示当前时间",
      init: false,
      unfrequent: true,
      onclick(bool) {
        game.saveConfig("show_time", bool);
        if (bool) {
          ui.time.style.display = "";
        } else {
          ui.time.style.display = "none";
        }
      }
    },
    show_time2: {
      name: "显示时间",
      intro: "在触屏按钮处显示当前时间",
      init: false,
      unfrequent: true,
      onclick(bool) {
        game.saveConfig("show_time2", bool);
        if (bool) {
          ui.roundmenu.classList.add("clock");
        } else {
          ui.roundmenu.classList.remove("clock");
        }
      }
    },
    watchface: {
      name: "表盘样式",
      init: "none",
      unfrequent: true,
      item: {
        none: "默认",
        simple: "简约"
      },
      onclick(item) {
        game.saveConfig("watchface", item);
        ui.roundmenu.dataset.watchface = item;
      }
    },
    show_time3: {
      name: "显示游戏时间",
      init: false,
      unfrequent: true
    },
    show_statusbar_android: {
      name: "显示状态栏",
      init: false,
      unfrequent: true,
      onclick(bool) {
        game.saveConfig("show_statusbar_android", bool);
        if (window.StatusBar && lib.device == "android") {
          if (bool) {
            window.StatusBar.overlaysWebView(false);
            window.StatusBar.backgroundColorByName("black");
            window.StatusBar.show();
          } else {
            window.StatusBar.hide();
          }
        }
      }
    },
    show_statusbar_ios: {
      name: "显示状态栏",
      init: "off",
      unfrequent: true,
      item: {
        default: "默认",
        overlay: "嵌入",
        auto: "自动",
        off: "关闭"
      },
      onclick(bool) {
        game.saveConfig("show_statusbar_ios", bool);
        if (window.StatusBar && lib.device == "ios") {
          if (bool != "off" && bool != "auto") {
            if (lib.config.show_statusbar_ios == "default") {
              window.StatusBar.overlaysWebView(false);
              document.body.classList.remove("statusbar");
            } else {
              window.StatusBar.overlaysWebView(true);
              document.body.classList.add("statusbar");
            }
            window.StatusBar.backgroundColorByName("black");
            window.StatusBar.show();
          } else {
            document.body.classList.remove("statusbar");
            window.StatusBar.hide();
          }
        }
      }
    },
    show_card_prompt: {
      name: "显示出牌信息",
      intro: "出牌时在使用者上显示卡牌名称",
      init: true,
      unfrequent: true
    },
    hide_card_prompt_basic: {
      name: "隐藏基本牌信息",
      intro: "不显示基本牌名称",
      init: false,
      unfrequent: true
    },
    hide_card_prompt_equip: {
      name: "隐藏装备牌信息",
      intro: "不显示装备牌名称",
      init: false,
      unfrequent: true
    },
    show_phase_prompt: {
      name: "显示阶段信息",
      intro: "在当前回合不同阶段开始时显示阶段名称",
      init: true,
      unfrequent: true
    },
    show_phaseuse_prompt: {
      name: "出牌阶段提示",
      intro: "在你出牌时显示提示文字",
      init: true,
      unfrequent: true
    },
    auto_popped_config: {
      name: "自动弹出选项",
      intro: "鼠标移至选项按钮时弹出模式选择菜单",
      init: true,
      unfrequent: true
    },
    auto_popped_history: {
      name: "自动弹出历史",
      intro: "鼠标移至暂停按钮时弹出历史记录菜单",
      init: false,
      unfrequent: true
    },
    show_round_menu: {
      name: "显示触屏按钮",
      init: true,
      unfrequent: true,
      onclick(bool) {
        if (get.is.nomenu("show_round_menu", bool)) {
          return false;
        }
        game.saveConfig("show_round_menu", bool);
        if (bool && ui.roundmenu) {
          ui.roundmenu.style.display = "";
        } else {
          ui.roundmenu.style.display = "none";
          alert("关闭触屏按钮后可通过手势打开菜单（默认为下划）");
        }
      }
    },
    remember_round_button: {
      name: "记住按钮位置",
      intro: "重新开始后触屏按钮将保存的上一局的位置",
      init: false,
      unfrequent: true,
      onclick(bool) {
        game.saveConfig("remember_round_button", bool);
        if (!bool) {
          ui.click.resetround?.();
        }
      }
    }
  };
}
export {
  createViewVisibilityOptions
};
