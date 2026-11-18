import "../../../../../../noname.js";
import { game } from "../../../../../game/index.js";
import { ui } from "../../../../../ui/index.js";
import { lib } from "../../../../index.js";
function createAppearanceCardbacksOptions() {
  return {
    cardback_style: {
      name: "卡背样式",
      intro: "设置背面朝上的卡牌的样式",
      init: "default",
      item: {
        // wood:'木纹',
        // music:'音乐',
        official: "原版",
        // new:'新版',
        feicheng: "废城",
        liusha: "流沙",
        ol: "手杀",
        custom: "自定",
        default: "默认"
      },
      visualBar(node, item, create, switcher) {
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
        ui.create.filediv(".menubutton", "添加图片", node, function(file) {
          if (file) {
            game.putDB("image", "cardback_style", file, function() {
              game.getDB("image", "cardback_style", function(fileToLoad) {
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
                  node.classList.add("showdelete");
                };
                fileReader.readAsDataURL(fileToLoad);
              });
            });
          }
        }).inputNode.accept = "image/*";
        ui.create.filediv(".menubutton.deletebutton.addbutton", "添加翻转图片", node, function(file) {
          if (file) {
            game.putDB("image", "cardback_style2", file, function() {
              node.classList.add("hideadd");
            });
          }
        }).inputNode.accept = "image/*";
        ui.create.div(".menubutton.deletebutton", "删除图片", node, function() {
          if (confirm("确定删除自定义图片？（此操作不可撤销）")) {
            game.deleteDB("image", "cardback_style");
            game.deleteDB("image", "cardback_style2");
            button.style.backgroundImage = "none";
            button.className = "button character dashedmenubutton";
            node.classList.remove("showdelete");
            node.classList.remove("hideadd");
            if (lib.config.cardback_style == "custom") {
              lib.configMenu.appearence.config.cardback_style.onclick("default");
              switcher.lastChild.innerHTML = "默认";
            }
            button.classList.add("transparent");
          }
        });
      },
      visualMenu(node, link, name, config) {
        node.style.backgroundSize = "100% 100%";
        switch (link) {
          case "default":
          case "custom":
            node.style.backgroundImage = "none";
            node.className = "button character dashedmenubutton";
            break;
          case "new":
            node.className = "button character";
            node.setBackgroundImage("theme/style/cardback/image/new.png");
            break;
          case "feicheng":
            node.className = "button character";
            node.setBackgroundImage("theme/style/cardback/image/feicheng.png");
            break;
          case "official":
            node.className = "button character";
            node.setBackgroundImage("theme/style/cardback/image/official.png");
            break;
          case "liusha":
            node.className = "button character";
            node.setBackgroundImage("theme/style/cardback/image/liusha.png");
            break;
          case "ol":
            node.className = "button character";
            node.setBackgroundImage("theme/style/cardback/image/ol.png");
            break;
          case "wood":
            node.className = "button card fullskin";
            node.setBackgroundImage("theme/woodden/wood.jpg");
            node.style.backgroundSize = "initial";
            break;
          case "music":
            node.className = "button card fullskin";
            node.setBackgroundImage("theme/music/wood3.png");
            break;
        }
        if (link == "custom") {
          node.classList.add("transparent");
          game.getDB("image", "cardback_style", function(fileToLoad) {
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
              game.getDB("image", "cardback_style2", function(file) {
                if (file) {
                  node.parentNode.lastChild.classList.add("hideadd");
                }
              });
            };
            fileReader.readAsDataURL(fileToLoad);
          });
        }
      },
      onclick(layout) {
        game.saveConfig("cardback_style", layout);
        var style = ui.css.cardback_style;
        ui.css.cardback_style = lib.init.css(lib.assetURL + "theme/style/cardback", lib.config.cardback_style);
        style.remove();
        if (ui.css.cardback_stylesheet) {
          ui.css.cardback_stylesheet.remove();
          delete ui.css.cardback_stylesheet;
        }
        if (ui.css.cardback_stylesheet2) {
          ui.css.cardback_stylesheet2.remove();
          delete ui.css.cardback_stylesheet2;
        }
        let url = "";
        switch (layout) {
          case "official":
            url = "theme/style/cardback/image/official.png";
            break;
          case "feicheng":
            url = "theme/style/cardback/image/feicheng.png";
            break;
          case "liusha":
            url = "theme/style/cardback/image/liusha.png";
            break;
          case "ol":
            url = "theme/style/cardback/image/ol.png";
            break;
          case "new":
            url = "theme/style/cardback/image/new.png";
            break;
          case "wood":
            url = "theme/woodden/wood.jpg";
            break;
          case "music":
            url = "theme/music/wood3.png";
            break;
          case "custom":
            game.getDB("image", "cardback_style", function(fileToLoad) {
              if (!fileToLoad) {
                return;
              }
              var fileReader = new FileReader();
              fileReader.onload = function() {
                const data = fileReader.result;
                if (typeof data !== "string") {
                  return;
                }
                if (ui.css.cardback_stylesheet) {
                  ui.css.cardback_stylesheet.remove();
                }
                ui.css.cardback_stylesheet = lib.init.sheet(".card:empty,.card.infohidden{background-image:url(" + data + ")}");
                document.documentElement.style.setProperty("--cardback-url", `url(${data})`);
                game.getDB("image", "cardback_style2", function(fileToLoad2) {
                  if (!fileToLoad2) {
                    return;
                  }
                  var fileReader2 = new FileReader();
                  fileReader2.onload = function() {
                    const data2 = fileReader2.result;
                    if (typeof data2 !== "string") {
                      return;
                    }
                    if (ui.css.cardback_stylesheet2) {
                      ui.css.cardback_stylesheet2.remove();
                    }
                    ui.css.cardback_stylesheet2 = lib.init.sheet(".card.infohidden:not(.infoflip){background-image:url(" + data2 + ")}");
                    document.documentElement.style.setProperty("--cardback-url", `url(${data2})`);
                  };
                  fileReader2.readAsDataURL(fileToLoad2);
                });
              };
              fileReader.readAsDataURL(fileToLoad);
            });
            return;
          case "default":
          default:
            document.documentElement.style.removeProperty("--cardback-url");
            return;
        }
        document.documentElement.style.setProperty("--cardback-url", `url(${lib.assetURL}/${url})`);
      },
      unfrequent: true
    }
  };
}
export {
  createAppearanceCardbacksOptions
};
