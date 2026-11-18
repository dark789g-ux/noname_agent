import "../../../../noname.js";
import { lib } from "../../index.js";
import { game } from "../../../game/index.js";
import { _status } from "../../../status/index.js";
import { ui } from "../../../ui/index.js";
import { get } from "../../../get/binding.js";
function createConfigMenuAudio() {
  return {
    name: "音效",
    config: {
      update: function(config, map) {
        if (lib.config.background_music == "music_custom" && (lib.device || lib.node)) {
          map.import_music.show();
        } else {
          map.import_music.hide();
        }
        map.clear_background_music[get.is.object(lib.config.customBackgroundMusic) ? "show" : "hide"]();
        ui.background_music_setting = map.background_music;
        map.background_music._link.config.updatex.call(map.background_music, []);
      },
      background_music: {
        updatex: function() {
          this.lastChild.innerHTML = this._link.config.item[lib.config.background_music];
          var menu = this._link.menu;
          for (var i = 0; i < menu.childElementCount; i++) {
            if (!["music_off", "music_custom", "music_random"].concat(lib.config.all.background_music).includes(menu.childNodes[i]._link)) {
              menu.childNodes[i].delete();
            }
          }
        },
        name: "背景音乐",
        init: true,
        item: {
          music_default: "默认"
        },
        onclick(item) {
          game.saveConfig("background_music", item);
          game.playBackgroundMusic();
        }
      },
      import_music: {
        name: '<div style="white-space:nowrap;width:calc(100% - 5px)"><input type="file" style="width:calc(100% - 40px)" accept="audio/*"><button style="width:40px">确定</button></div>',
        clear: true
      },
      background_audio: {
        name: "游戏音效",
        init: true
      },
      background_speak: {
        name: "人物配音",
        init: true
      },
      equip_audio: {
        name: "装备配音",
        init: false
      },
      repeat_audio: {
        name: "播放重复语音",
        init: false
      },
      volumn_audio: {
        name: "音效音量",
        init: 8,
        item: {
          0: "〇",
          1: "一",
          2: "二",
          3: "三",
          4: "四",
          5: "五",
          6: "六",
          7: "七",
          8: "八"
        },
        onclick(volume) {
          game.saveConfig("volumn_audio", parseInt(volume));
        }
      },
      volumn_background: {
        name: "音乐音量",
        init: 8,
        item: {
          0: "〇",
          1: "一",
          2: "二",
          3: "三",
          4: "四",
          5: "五",
          6: "六",
          7: "七",
          8: "八"
        },
        onclick(volume) {
          game.saveConfig("volumn_background", parseInt(volume));
          ui.backgroundMusic.volume = volume / 8;
        }
      },
      clear_background_music: {
        name: "清除自定义背景音乐",
        clear: true,
        onclick() {
          if (confirm("是否清除已导入的所有自定义背景音乐？（该操作不可撤销！）")) {
            for (var i in lib.config.customBackgroundMusic) {
              lib.config.all.background_music.remove(i);
              if (i.startsWith("cdv_")) {
                if (typeof game.removeFile !== "function") {
                  throw new TypeError("Removing platform music requires the removeFile API");
                }
                game.removeFile("audio/background/" + i + ".mp3");
              } else {
                game.deleteDB("audio", i);
              }
            }
            lib.config.customBackgroundMusic = null;
            game.saveConfig("customBackgroundMusic", null);
            game.saveConfig("background_music", "music_off");
            if (!_status._aozhan) {
              game.playBackgroundMusic();
            }
          }
        }
      }
    }
  };
}
export {
  createConfigMenuAudio
};
