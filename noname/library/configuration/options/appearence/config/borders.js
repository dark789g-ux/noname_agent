import "../../../../../../noname.js";
import { game } from "../../../../../game/index.js";
import { ui } from "../../../../../ui/index.js";
import { lib } from "../../../../index.js";
function createAppearanceBordersOptions() {
  return {
    border_style: {
      name: "角色边框",
      init: "default",
      intro: "设置角色边框的样式，当设为自动时，样式将随着一局游戏中伤害或击杀的数量自动改变",
      item: {
        gold: "金框",
        silver: "银框",
        bronze: "铜框",
        dragon_gold: "金龙",
        dragon_silver: "银龙",
        dragon_bronze: "玉龙",
        custom: "自定",
        auto: "自动",
        default: "默认"
      },
      visualBar: function(node, item, create, switcher) {
        if (node.created) {
          return;
        }
        var button;
        for (var i = 0; i < node.parentNode.childElementCount; i++) {
          if (node.parentNode.childNodes[i]._link == "custom") {
            button = node.parentNode.childNodes[i];
          }
        }
        if (!button) {
          return;
        }
        node.created = true;
        var deletepic;
        ui.create.filediv(".menubutton", "添加图片", node, function(file) {
          if (file) {
            game.putDB("image", "border_style", file, function() {
              game.getDB("image", "border_style", function(fileToLoad) {
                if (!fileToLoad) {
                  return;
                }
                var fileReader = new FileReader();
                fileReader.onload = function() {
                  const data = fileReader.result;
                  if (typeof data !== "string") {
                    return;
                  }
                  button.style.backgroundImage = "url(" + data + ")";
                  button.className = "button character";
                  button.style.backgroundSize = "100% 100%";
                  node.classList.add("showdelete");
                };
                fileReader.readAsDataURL(fileToLoad);
              });
            });
          }
        }).inputNode.accept = "image/*";
        deletepic = ui.create.div(".menubutton.deletebutton", "删除图片", node, function() {
          if (confirm("确定删除自定义图片？（此操作不可撤销）")) {
            game.deleteDB("image", "border_style");
            button.style.backgroundImage = "none";
            button.className = "button character dashedmenubutton";
            node.classList.remove("showdelete");
            if (lib.config.border_style == "custom") {
              lib.configMenu.appearence.config.border_style.onclick("default");
              switcher.lastChild.innerHTML = "默认";
            }
            button.classList.add("transparent");
          }
        });
      },
      visualMenu: function(node, link, name, config) {
        node.className = "button character";
        node.style.backgroundSize = "";
        node.style.height = "108px";
        node.dataset.decoration = "";
        if (link == "default" || link == "custom" || link == "auto") {
          node.style.backgroundImage = "none";
          node.className = "button character dashedmenubutton";
        } else {
          if (link.startsWith("dragon_")) {
            link = link.slice(7);
            node.dataset.decoration = link;
          }
          node.setBackgroundImage("theme/style/player/" + link + "1.png");
          node.style.backgroundSize = "100% 100%";
        }
        if (link == "custom") {
          node.classList.add("transparent");
          game.getDB("image", "border_style", function(fileToLoad) {
            if (!fileToLoad) {
              return;
            }
            var fileReader = new FileReader();
            fileReader.onload = function() {
              const data = fileReader.result;
              if (typeof data !== "string") {
                return;
              }
              node.style.backgroundImage = "url(" + data + ")";
              node.className = "button character";
              node.parentNode.lastChild.classList.add("showdelete");
              node.style.backgroundSize = "100% 100%";
            };
            fileReader.readAsDataURL(fileToLoad);
          });
        }
      },
      onclick(layout) {
        game.saveConfig("border_style", layout);
        if (ui.css.border_stylesheet) {
          ui.css.border_stylesheet.remove();
          delete ui.css.border_stylesheet;
        }
        if (layout == "custom") {
          game.getDB("image", "border_style", function(fileToLoad) {
            if (!fileToLoad) {
              return;
            }
            var fileReader = new FileReader();
            fileReader.onload = function() {
              const data = fileReader.result;
              if (typeof data !== "string") {
                return;
              }
              if (ui.css.border_stylesheet) {
                ui.css.border_stylesheet.remove();
              }
              const borderStylesheet = lib.init.sheet();
              ui.css.border_stylesheet = borderStylesheet;
              borderStylesheet.id = "ui.css.border";
              borderStylesheet.sheet.insertRule('#window .player>.framebg{display:block;background-image:url("' + data + '")}', 0);
              borderStylesheet.sheet.insertRule(".player>.count{z-index: 3 !important;border-radius: 2px !important;text-align: center !important;}", 0);
            };
            fileReader.readAsDataURL(fileToLoad);
          });
        } else if (layout != "default" && layout != "auto") {
          const borderStylesheet = lib.init.sheet();
          ui.css.border_stylesheet = borderStylesheet;
          if (layout.startsWith("dragon_")) {
            layout = layout.slice(7);
            ui.arena.dataset.framedecoration = layout;
          } else {
            ui.arena.dataset.framedecoration = "";
          }
          borderStylesheet.sheet.insertRule('#window .player>.framebg,#window #arena.long.mobile:not(.fewplayer) .player[data-position="0"]>.framebg{display:block;background-image:url("' + lib.assetURL + "theme/style/player/" + layout + '1.png")}', 0);
          borderStylesheet.sheet.insertRule('#window #arena.long:not(.fewplayer) .player>.framebg, #arena.oldlayout .player>.framebg{background-image:url("' + lib.assetURL + "theme/style/player/" + layout + '3.png")}', 0);
          borderStylesheet.sheet.insertRule(".player>.count{z-index: 3 !important;border-radius: 2px !important;text-align: center !important;}", 0);
        }
      },
      unfrequent: true
    },
    autoborder_count: {
      name: "边框升级方式",
      intro: "<strong>击杀</strong> 每击杀一人，边框提升两级<br><strong>伤害</strong> 每造成2点伤害，边框提升一级<br><strong>混合</strong> 击杀量决定边框颜色，伤害量决定边框装饰",
      init: "kill",
      item: {
        kill: "击杀",
        damage: "伤害",
        mix: "混合"
      },
      unfrequent: true
    },
    autoborder_start: {
      name: "基础边框颜色",
      init: "bronze",
      item: {
        bronze: "铜",
        silver: "银",
        gold: "金"
      },
      unfrequent: true
    },
    player_border: {
      name: "边框宽度",
      init: "normal",
      intro: "设置角色的边框宽度",
      unfrequent: true,
      item: {
        slim: "细",
        narrow: "窄",
        normal: "中",
        wide: "宽"
      },
      onclick(item) {
        game.saveConfig("player_border", item);
        if (item != "wide" || game.layout == "long" || game.layout == "long2") {
          ui.arena.classList.add("slim_player");
        } else {
          ui.arena.classList.remove("slim_player");
        }
        if (item == "slim") {
          ui.arena.classList.add("uslim_player");
        } else {
          ui.arena.classList.remove("uslim_player");
        }
        if (item == "narrow") {
          ui.arena.classList.add("mslim_player");
        } else {
          ui.arena.classList.remove("mslim_player");
        }
        if (item == "normal" && lib.config.mode != "brawl" && (game.layout == "long" || game.layout == "long2")) {
          ui.arena.classList.add("lslim_player");
        } else {
          ui.arena.classList.remove("lslim_player");
        }
        ui.window.dataset.player_border = item;
      }
    }
  };
}
export {
  createAppearanceBordersOptions
};
