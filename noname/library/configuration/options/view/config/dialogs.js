import "../../../../../../noname.js";
import { game } from "../../../../../game/index.js";
import { ui } from "../../../../../ui/index.js";
import { lib } from "../../../../index.js";
function createViewDialogsOptions() {
  return {
    remember_dialog: {
      name: "记住对话框位置",
      intro: "移动对话框后新的对话框也将在移动后的位置显示",
      init: false,
      unfrequent: true,
      onclick(bool) {
        game.saveConfig("remember_dialog", bool);
        if (!bool) {
          if (ui.dialog) {
            var dialog = ui.dialog;
            dialog.style.transform = "";
            dialog._dragtransform = [0, 0];
            dialog.style.transition = "all 0.3s";
            dialog._dragtouches;
            dialog._dragorigin;
            dialog._dragorigintransform;
            setTimeout(function() {
              dialog.style.transition = "";
            }, 500);
          }
          game.saveConfig("dialog_transform", [0, 0]);
        }
      }
    },
    transparent_dialog: {
      name: "堆叠对话框虚化",
      init: false,
      intro: "当具有static属性的对话框堆叠（如五谷丰登对话框中提示无懈可击）时，将后方的对话框变为半透明",
      onclick(bool) {
        game.saveConfig("transparent_dialog", bool);
        if (bool) {
          for (var i = 0; i < ui.dialogs.length; i++) {
            if (ui.dialogs[i] != ui.dialog && ui.dialogs[i].static) {
              ui.dialogs[i].unfocus();
            }
          }
        } else {
          for (var i = 0; i < ui.dialogs.length; i++) {
            if (ui.dialogs[i] != ui.dialog && ui.dialogs[i].static) {
              ui.dialogs[i].refocus();
            }
          }
        }
      }
    },
    show_rarity: {
      name: "显示武将评级",
      init: false,
      intro: "仅供娱乐，重启后生效",
      unfrequent: true,
      onclick(bool) {
        game.saveConfig("show_rarity", bool);
      }
    },
    mark_identity_style: {
      name: "标记身份操作",
      intro: "设置单击身份按钮时的操作",
      unfrequent: true,
      init: "menu",
      item: {
        menu: "菜单",
        click: "单击"
      }
    },
    character_dialog_tool: {
      name: "自由选将显示",
      intro: "点击自由选将时默认显示的条目",
      init: "最近",
      item: {
        收藏: "收藏",
        最近: "最近",
        all: "全部"
      },
      unfrequent: true
    },
    recent_character_number: {
      name: "最近使用武将",
      intro: "自由选将对话框中最近使用武将的数量",
      init: 12,
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
        game.saveConfig("recent_character_number", num);
      }
    },
    showMax_character_number: {
      name: "最大武将数显示",
      intro: "设置自由选将对话框一页显示的最大武将数<br><span class=firetext>注意事项：<br><li>更改此选项后，需要重启游戏以使用新选项配置<br><li>推荐将此选项设置为偏小数值，可降低加载过多武将时导致的性能损耗</span>",
      init: 10,
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
        game.saveConfig("showMax_character_number", num);
      }
    },
    popequip: {
      name: "触屏装备选择",
      intro: "设置触屏布局中选择装备的方式",
      init: true,
      unfrequent: true
    },
    filternode_button: {
      name: "触屏筛选按钮",
      intro: "设置自由选将对话框中筛选按钮的样式",
      init: true,
      unfrequent: true
    },
    show_charactercard: {
      name: "显示武将资料",
      intro: "在武将界面单击时弹出武将资料卡",
      init: true,
      unfrequent: true
    },
    show_charactercardMode: {
      name: "武将资料默认页",
      intro: "弹出武将资料卡时默认打开的页面",
      init: "intro",
      item: {
        intro: "介绍",
        skill: "技能"
      },
      unfrequent: true
    },
    show_favourite: {
      name: "显示添加收藏",
      intro: "在角色的右键菜单中显示添加收藏",
      init: false,
      unfrequent: true
    },
    show_favmode: {
      name: "显示模式收藏",
      intro: "快捷菜单中显示收藏模式",
      init: true,
      unfrequent: true
    },
    show_favourite_menu: {
      name: "显示收藏菜单",
      intro: "在选项-武将中显示收藏一栏",
      init: true,
      unfrequent: true
    },
    show_ban_menu: {
      name: "显示禁将菜单",
      intro: "在选项-武将中显示禁将一栏",
      init: false,
      unfrequent: true
    },
    right_range: {
      name: "显示距离信息",
      intro: "在角色的右键菜单中显示距离等信息",
      init: true,
      unfrequent: true
    },
    hide_card_image: {
      name: "隐藏卡牌背景",
      intro: "所有卡牌将使用文字作为背景",
      init: false,
      unfrequent: true,
      restart: true
    },
    show_name: {
      name: "显示角色名称",
      init: false,
      unfrequent: true,
      onclick(bool) {
        game.saveConfig("show_name", bool);
        if (bool) {
          ui.arena.classList.remove("hide_name");
        } else {
          ui.arena.classList.add("hide_name");
        }
      }
    },
    show_sex: {
      name: "显示角色性别",
      intro: "在角色的右键菜单中显示角色性别",
      init: true,
      unfrequent: true
    },
    show_group: {
      name: "显示角色势力",
      intro: "在角色的右键菜单中显示角色势力",
      init: true,
      unfrequent: true
    },
    show_replay: {
      name: "显示重来按钮",
      init: false,
      unfrequent: true,
      onclick(bool) {
        game.saveConfig("show_replay", bool);
        if (lib.config.show_replay) {
          ui.replay.style.display = "";
        } else {
          ui.replay.style.display = "none";
        }
      }
    },
    show_playerids: {
      name: "显示身份按钮",
      init: true,
      unfrequent: true,
      onclick(bool) {
        game.saveConfig("show_playerids", bool);
        if (lib.config.show_playerids) {
          ui.playerids.style.display = "";
        } else {
          ui.playerids.style.display = "none";
        }
      }
    },
    show_sortcard: {
      name: "显示整理手牌按钮",
      init: true,
      unfrequent: true,
      onclick(bool) {
        game.saveConfig("show_sortcard", bool);
        if (lib.config.show_sortcard) {
          ui.sortCard.style.display = "";
        } else {
          ui.sortCard.style.display = "none";
        }
      }
    },
    show_pause: {
      name: "显示暂停按钮",
      init: true,
      unfrequent: true,
      onclick(bool) {
        game.saveConfig("show_pause", bool);
        if (lib.config.show_pause) {
          ui.pause.style.display = "";
        } else {
          ui.pause.style.display = "none";
        }
      }
    },
    show_auto: {
      name: "显示托管按钮",
      init: true,
      unfrequent: true,
      onclick(bool) {
        game.saveConfig("show_auto", bool);
        if (lib.config.show_auto) {
          ui.auto.style.display = "";
        } else {
          ui.auto.style.display = "none";
        }
      }
    },
    show_volumn: {
      name: "显示音量按钮",
      init: true,
      unfrequent: true,
      onclick(bool) {
        game.saveConfig("show_volumn", bool);
        if (lib.config.show_volumn) {
          ui.volumn.style.display = "";
        } else {
          ui.volumn.style.display = "none";
        }
      }
    },
    show_cardpile: {
      name: "显示牌堆按钮",
      init: true,
      unfrequent: true,
      onclick(bool) {
        game.saveConfig("show_cardpile", bool);
        if (bool) {
          ui.cardPileButton.style.display = "";
        } else {
          ui.cardPileButton.style.display = "none";
        }
      }
    },
    show_commonCardpile: {
      name: "显示公共区域按钮",
      init: true,
      unfrequent: true,
      onclick(bool) {
        game.saveConfig("show_commonCardpile", bool);
        if (bool) {
          if (ui.commonCardPileButton) {
            ui.commonCardPileButton.style.display = "";
          }
        } else {
          if (ui.commonCardPileButton) {
            ui.commonCardPileButton.style.display = "none";
          }
        }
      }
    },
    show_cardpile_number: {
      name: "显示剩余牌数",
      init: true,
      unfrequent: true,
      onclick(bool) {
        game.saveConfig("show_cardpile_number", bool);
        if (bool) {
          ui.cardPileNumber.style.display = "";
        } else {
          ui.cardPileNumber.style.display = "none";
        }
      }
    },
    show_handcardbutton: {
      name: "显示手牌按钮",
      init: true,
      unfrequent: true,
      onclick(bool) {
        game.saveConfig("show_handcardbutton", bool);
      }
    },
    show_giveup: {
      name: "显示投降按钮",
      init: true,
      unfrequent: true,
      onclick(bool) {
        game.saveConfig("show_giveup", bool);
      }
    }
  };
}
export {
  createViewDialogsOptions
};
