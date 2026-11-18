import "../../../../../../noname.js";
import { game } from "../../../../../game/index.js";
import { ui } from "../../../../../ui/index.js";
import { lib } from "../../../../index.js";
function createAppearancePlayersOptions() {
  return {
    player_style: {
      name: "角色背景",
      init: "default",
      intro: "设置角色的背景图片",
      item: {
        wood: "木纹",
        music: "音乐",
        simple: "简约",
        custom: "自定",
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
            game.putDB("image", "player_style", file, function() {
              game.getDB("image", "player_style", function(fileToLoad) {
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
            game.deleteDB("image", "player_style");
            button.style.backgroundImage = "none";
            button.className = "button character dashedmenubutton";
            node.classList.remove("showdelete");
            if (lib.config.player_style == "custom") {
              lib.configMenu.appearence.config.player_style.onclick("default");
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
        switch (link) {
          case "default":
          case "custom": {
            node.style.backgroundImage = "none";
            node.className = "button character dashedmenubutton";
            break;
          }
          case "wood":
            node.setBackgroundImage("theme/woodden/wood.jpg");
            break;
          case "music":
            node.style.backgroundImage = "linear-gradient(#4b4b4b, #464646)";
            break;
          case "simple":
            node.style.backgroundImage = "linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4))";
            break;
        }
        if (link == "custom") {
          node.classList.add("transparent");
          game.getDB("image", "player_style", function(fileToLoad) {
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
        game.saveConfig("player_style", layout);
        if (ui.css.player_stylesheet) {
          ui.css.player_stylesheet.remove();
          delete ui.css.player_stylesheet;
        }
        if (layout == "custom") {
          game.getDB("image", "player_style", function(fileToLoad) {
            if (!fileToLoad) {
              return;
            }
            var fileReader = new FileReader();
            fileReader.onload = function() {
              const data = fileReader.result;
              if (typeof data !== "string") {
                return;
              }
              if (ui.css.player_stylesheet) {
                ui.css.player_stylesheet.remove();
              }
              ui.css.player_stylesheet = lib.init.sheet('#window .player{background-image:url("' + data + '");background-size:100% 100%;}');
            };
            fileReader.readAsDataURL(fileToLoad);
          });
        } else if (layout != "default") {
          var str = "";
          switch (layout) {
            case "wood":
              str = 'url("' + lib.assetURL + 'theme/woodden/wood.jpg")';
              break;
            case "music":
              str = "linear-gradient(#4b4b4b, #464646)";
              break;
            case "simple":
              str = "linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4))";
              break;
          }
          ui.css.player_stylesheet = lib.init.sheet("#window .player{background-image:" + str + "}");
        }
      },
      unfrequent: true
    },
    zhishixian: {
      name: "指示线",
      intro: "设置卡牌、技能的指示特效",
      init: "default",
      unfrequent: true,
      item: {
        default: "默认",
        Mohua: "水墨",
        Xiangong: "先攻",
        Zhuzhang: "竹杖",
        // Shuimo: "幻彩",
        Anhei: "黑暗",
        Mozhua: "魔爪",
        Shenjian: "神剑",
        Yujian: "御剑",
        Jianfeng: "剑锋",
        Jinjian: "金箭",
        Jinlong: "金龙",
        Yuexian: "乐仙",
        Xingdie: "星蝶",
        Luoying: "落英",
        Shezhang: "蛇杖"
      },
      onclick(items) {
        game.saveConfig("zhishixian", items);
        if (items == "default") {
          const originalLine = game.zsOriginLineXy;
          if (typeof originalLine !== "function") {
            throw new TypeError("Line themes require initialized original line drawing");
          }
          game.linexy = originalLine;
        } else {
          game.linexy = game["zs" + items + "LineXy"];
        }
      }
    }
  };
}
export {
  createAppearancePlayersOptions
};
