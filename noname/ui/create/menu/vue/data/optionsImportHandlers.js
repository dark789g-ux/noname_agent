import "../../../../../../noname.js";
import { menuBridge } from "../utils/menuBridge.js";
import { lib } from "../../../../../library/index.js";
import { game } from "../../../../../game/index.js";
import { _status } from "../../../../../status/index.js";
function handleImportDataButton(fileToLoad) {
  let fileReader = new FileReader();
  fileReader.onload = async function(fileLoadedEvent) {
    let data = fileLoadedEvent.target?.result;
    if (typeof data !== "string" || !data) return;
    try {
      data = JSON.parse(lib.init.decode(data));
      if (!data || typeof data != "object") {
        throw new Error("err");
      }
      if (lib.db && (!data.config || !data.data)) {
        throw new Error("err");
      }
    } catch (e) {
      console.log(e);
      alert("导入失败");
      return;
    }
    if (!lib.db) {
      let noname_inited = localStorage.getItem("noname_inited");
      let onlineKey = localStorage.getItem(lib.configprefix + "key");
      localStorage.clear();
      if (noname_inited) {
        localStorage.setItem("noname_inited", noname_inited);
      }
      if (onlineKey) {
        localStorage.setItem(lib.configprefix + "key", onlineKey);
      }
      for (let i in data) {
        localStorage.setItem(i, data[i]);
      }
    } else {
      for (let i in data.config) {
        await game.putDB("config", i, data.config[i]);
        lib.config[i] = data.config[i];
      }
      for (let i in data.data) {
        await game.putDB("data", i, data.data[i]);
      }
    }
    alert("导入成功");
    lib.init.background();
    game.reload();
  };
  fileReader.readAsText(fileToLoad, "UTF-8");
}
function handleImportMusic(fileToLoad) {
  if (_status.music_importing) return;
  _status.music_importing = true;
  if (!lib.config.customBackgroundMusic) {
    lib.config.customBackgroundMusic = {};
  }
  let name = fileToLoad.name;
  if (name.includes(".")) {
    name = name.slice(0, name.indexOf("."));
  }
  let link = (game.writeFile ? "cdv_" : "custom_") + name;
  if (lib.config.customBackgroundMusic[link]) {
    if (!confirm("已经存在文件名称相同的背景音乐，是否仍然要继续导入？")) {
      _status.music_importing = false;
      return;
    }
    for (let i = 1; i < 1e3; i++) {
      if (!lib.config.customBackgroundMusic[link + "_" + i]) {
        link = link + "_" + i;
        break;
      }
    }
  }
  let callback = function() {
    let musicname = link.slice(link.indexOf("_") + 1);
    game.prompt("###请输入音乐的名称###" + musicname, true, function(str) {
      if (str) {
        musicname = str;
      }
      lib.config.customBackgroundMusic[link] = musicname;
      lib.config.background_music = link;
      lib.config.all.background_music.add(link);
      game.saveConfig("background_music", link);
      game.saveConfig("customBackgroundMusic", lib.config.customBackgroundMusic);
      _status.music_importing = false;
      if (!_status._aozhan) {
        game.playBackgroundMusic();
      }
      lib.configMenu.audio.config.background_music.item[link] = musicname;
      menuBridge.refreshOptionsConfig?.("background_music");
    });
  };
  if (game.writeFile) {
    game.writeFile(fileToLoad, "audio/background", link + ".mp3", callback);
  } else {
    game.putDB("audio", link, fileToLoad, callback);
  }
}
export {
  handleImportDataButton,
  handleImportMusic
};
