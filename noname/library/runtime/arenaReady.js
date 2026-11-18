import "../../../noname.js";
import { getRegisteredSkill } from "../skillRegistry.js";
import { _status } from "../../status/index.js";
import { lib } from "../index.js";
import { game } from "../../game/index.js";
import { get } from "../../get/binding.js";
import { ui } from "../../ui/index.js";
function createArenaReady() {
  return [
    //提前缓存表情包
    function() {
      const emotionCache = _status.emotion_cache = {};
      const findFiles = function(name) {
        const srcBase2 = `${lib.assetURL}image/emotion/${name}/`;
        if (typeof game.getFileList !== "function") {
          throw new TypeError("Emotion caching requires the platform getFileList API");
        }
        game.getFileList(
          srcBase2,
          function(folders, files) {
            if (!files.length) {
              return;
            }
            emotionCache[name] = files.sort((a, b) => parseInt(a.split(".")[0]) - parseInt(b.split(".")[0]));
          },
          () => {
          }
        );
      };
      const srcBase = `${lib.assetURL}image/emotion/`;
      if (typeof game.getFileList !== "function") {
        throw new TypeError("Emotion caching requires the platform getFileList API");
      }
      game.getFileList(
        srcBase,
        function(folders, files) {
          if (!folders.length) {
            return;
          }
          for (const folder of folders) {
            if (folder == "throw_emotion") {
              continue;
            }
            emotionCache[folder] = [];
            findFiles(folder);
          }
        },
        () => {
        }
      );
    },
    //增加ui.window的监听
    function() {
      lib.poptip.init();
    },
    //预处理技能拥有者
    function() {
      _status.skillOwner = {};
      let packSort = ["standard", "shenhua", "yijiang", "refresh", "extra", "sp", "xinghuoliaoyuan", "sp2", "mobile", "tw", "yingbian", "offline", "sb", "clan", "huicui", "shiji", "bingshi", "xianding", "jsrg", "onlyOL", "newjiang", "sixiang", "sxrm"];
      packSort = packSort.reverse();
      const packs = Object.keys(lib.characterPack).sort((a, b) => {
        return packSort.indexOf(b) - packSort.indexOf(a);
      });
      const map = /* @__PURE__ */ new Map();
      for (let i of packs) {
        for (let j in lib.characterPack[i]) {
          const info = get.character(j);
          if (!info || info[4]?.includes("unseen")) {
            continue;
          }
          if (info[3]?.length > 0) {
            let skills2 = info[3].slice(0);
            for (const skill of skills2) {
              const skillInfo = getRegisteredSkill(lib.skill, skill);
              if (!skillInfo) {
                continue;
              }
              if (!_status.skillOwner[skill]) {
                _status.skillOwner[skill] = j;
              }
              if (skillInfo.derivation) {
                const der = skillInfo.derivation.slice(0);
                for (const skillx of Array.isArray(der) ? der : [der]) {
                  if (!_status.skillOwner[skillx]) {
                    if (!map.has(skillx)) {
                      map.set(skillx, []);
                    }
                    map.get(skillx).add(j);
                  }
                }
              }
            }
          }
        }
      }
      for (const skill of map.keys()) {
        if (!_status.skillOwner[skill]) {
          _status.skillOwner[skill] = map.get(skill)[0];
        }
      }
    },
    //fullimage卡背css属性载入（决定卡背）
    function() {
      let url = "";
      switch (lib.config.cardback_style) {
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
    }
  ];
}
export {
  createArenaReady
};
