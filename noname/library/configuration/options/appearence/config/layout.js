import "../../../../../../noname.js";
import { game } from "../../../../../game/index.js";
import { ui } from "../../../../../ui/index.js";
import { lib } from "../../../../index.js";
function createAppearanceLayoutOptions() {
  return {
    theme: {
      name: "主题",
      init: "woodden",
      item: {},
      visualMenu: function(node, link) {
        if (!node.menu) {
          node.className = "button character themebutton " + link;
          node.menu = ui.create.div(node, "", "<div></div><div></div><div></div><div></div>");
        }
      },
      onclick: async (theme) => {
        game.saveConfig("theme", theme);
        ui.arena.hide();
        lib.init.background();
        if (lib.config.autostyle) {
          if (theme === "simple") {
            lib.configMenu.appearence.config.player_border.onclick("slim");
          } else {
            lib.configMenu.appearence.config.player_border.onclick("normal");
          }
        }
        lib.announce.publish("Noname.Apperaence.Theme.onChanging", theme);
        await new Promise((resolve) => setTimeout(resolve, 500));
        const deletingTheme = ui.css.theme;
        ui.css.theme = lib.init.css(lib.assetURL + "theme/" + lib.config.theme, "style");
        deletingTheme.remove();
        lib.announce.publish("Noname.Apperaence.Theme.onChanged", theme);
        await new Promise((resolve) => setTimeout(resolve, 100));
        ui.arena.show();
        lib.announce.publish("Noname.Apperaence.Theme.onChangeFinished", theme);
      }
    },
    layout: {
      name: "布局",
      init: "mobile",
      item: {
        //default:'旧版',
        newlayout: "对称",
        mobile: "默认",
        long: "宽屏",
        long2: "手杀",
        nova: "新版"
      },
      visualMenu: function(node, link) {
        node.className = "button character themebutton " + lib.config.theme;
        if (!node.created) {
          node.created = true;
          node.style.overflow = "hidden";
          node.firstChild.style.display = "none";
          var me = ui.create.div(node);
          me.style.top = "auto";
          if (link == "default" || link == "newlayout") {
            me.style.width = "calc(100% - 6px)";
            me.style.left = "3px";
            me.style.bottom = "3px";
            me.style.height = "25px";
            if (link == "newlayout") {
              me.style.height = "23px";
              me.style.bottom = "4px";
            }
          } else if (link == "long2" || link == "nova") {
            me.style.display = "none";
          } else {
            me.style.width = "120%";
            me.style.left = "-10%";
            me.style.bottom = "0";
            me.style.height = "22px";
          }
          me.style.borderRadius = "2px";
          var list = ["re_caocao", "re_liubei", "sp_zhangjiao", "sunquan"];
          for (var i = 0; i < 4; i++) {
            var player = ui.create.div(".fakeplayer", node);
            var avatar = ui.create.div(".avatar", player);
            var name = list.randomRemove();
            if (name === void 0) {
              throw new TypeError("fake player character is missing");
            }
            avatar.setBackground(name, "character");
            player.style.borderRadius = "2px";
            if (i != 3) {
              player.style.top = "auto";
            }
            if (link == "default") {
              player.style.height = "19px";
              player.style.width = "38px";
              player.classList.add("oldlayout");
            } else if (link == "mobile" || link == "newlayout") {
              player.style.width = "24px";
              player.style.height = "29px";
            } else if (link == "nova") {
              player.style.width = "20px";
              player.style.height = "24px";
            } else {
              player.style.width = "20px";
              player.style.height = "34px";
            }
            if (i == 1) {
              player.style.left = "3px";
            }
            if (i == 2) {
              player.style.left = "auto";
              player.style.right = "3px";
            }
            if (i == 3) {
              player.style.top = "3px";
            }
            if (link == "default") {
              if (i == 0) {
                player.style.bottom = "6px";
              }
              if (i == 0 || i == 3) {
                player.style.left = "calc(50% - 18px)";
              }
              if (i == 1 || i == 2) {
                player.style.bottom = "36px";
              }
            } else if (link == "newlayout") {
              if (i == 0) {
                player.style.bottom = "1px";
              }
              if (i == 0 || i == 3) {
                player.style.left = "calc(50% - 12px)";
              }
              if (i == 1 || i == 2) {
                player.style.bottom = "32px";
              }
            } else if (link == "mobile") {
              if (i == 0 || i == 3) {
                player.style.left = "calc(50% - 12px)";
              }
              if (i == 1 || i == 2) {
                player.style.bottom = "30px";
              }
            } else if (link == "long") {
              if (i == 0 || i == 3) {
                player.style.left = "calc(50% - 10px)";
              }
              if (i == 1 || i == 2) {
                player.style.bottom = "45px";
              }
            } else if (link == "long2") {
              if (i == 0) {
                player.style.bottom = "2px";
                player.style.left = "3px";
              }
              if (i == 3) {
                player.style.left = "calc(50% - 10px)";
              }
              if (i == 1 || i == 2) {
                player.style.bottom = "45px";
              }
            } else if (link == "nova") {
              if (i == 0) {
                player.style.bottom = "2px";
                player.style.left = "3px";
              }
              if (i == 3) {
                player.style.left = "calc(50% - 10px)";
              }
              if (i == 1 || i == 2) {
                player.style.left = "3px";
                player.style.bottom = i * 30 + "px";
              }
            }
            if (i == 0 && (link == "mobile" || link == "long")) {
              player.classList.add("me");
              player.style.borderRadius = "0px";
              player.style.width = "25px";
              player.style.height = "25px";
              player.style.bottom = "-3px";
              player.style.left = "-3px";
            }
          }
        }
      },
      onclick(layout) {
        if (lib.layoutfixed.includes(lib.config.mode)) {
          game.saveConfig("layout", layout);
        } else {
          lib.init.layout(layout);
        }
      }
    },
    splash_style: {
      name: "启动页",
      init: "style1",
      item: {
        style1: "样式一",
        style2: "样式二"
      },
      visualMenu: async (node, link) => {
        let splash = lib.onloadSplashes.find((item) => item.id == link);
        if (splash) {
          await splash.preview(node);
        }
      }
    },
    // fewplayer:{
    //     name:'启用人数',
    // 	intro:'设置启用新版布局的最小人数（不足时切换至默认布局）',
    //     init:'3',
    //     // unfrequent:true,
    //     item:{
    //      			'2':'两人',
    //      			'3':'三人',
    //      			'4':'四人',
    //      			'5':'五人',
    //      			'6':'六人',
    //      			'7':'七人',
    //      			'8':'八人',
    //     },
    //     onclick(item){
    //      			game.saveConfig('fewplayer',item);
    //      			if(ui.arena) ui.arena.setNumber(ui.arena.dataset.number);
    //     }
    // },
    player_height: {
      name: "角色高度",
      init: "default",
      // unfrequent:true,
      item: {
        short: "矮",
        default: "中",
        long: "高"
      },
      onclick(item) {
        game.saveConfig("player_height", item);
        ui.arena.dataset.player_height = item;
      }
    },
    player_height_nova: {
      name: "角色高度",
      init: "short",
      item: {
        // auto:'自动',
        short: "矮",
        default: "中",
        long: "高"
      },
      onclick(item) {
        game.saveConfig("player_height_nova", item);
        ui.arena.dataset.player_height_nova = item;
      }
    }
  };
}
export {
  createAppearanceLayoutOptions
};
