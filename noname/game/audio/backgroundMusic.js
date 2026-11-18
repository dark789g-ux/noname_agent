import "../../../noname.js";
import { menuBridge } from "../../ui/create/menu/vue/utils/menuBridge.js";
import { game } from "../index.js";
import { lib } from "../../library/index.js";
import { ui } from "../../ui/index.js";
import { _status } from "../../status/index.js";
const backgroundMusicMethods = {
  /**
   * Add a background music to the config option
   *
   * 在设置选项中添加一首背景音乐
   */
  addBackgroundMusic(link, musicName, aozhan) {
    if (typeof musicName != "string") {
      musicName = link;
    }
    if (aozhan) {
      lib.mode.guozhan.config.aozhan_bgm.item[link] = musicName;
    } else {
      lib.config.all.background_music.add(link);
      lib.configMenu.audio.config.background_music.item[link] = musicName;
    }
    menuBridge.refreshOptionsConfig?.(aozhan ? "aozhan_bgm" : "background_music");
  },
  /**
   * Remove a background music from the config option
   *
   * 从设置选项中移除一首背景音乐
   */
  removeBackgroundMusic(link, aozhan) {
    if (aozhan) {
      if (["disabled", "random"].includes(link)) {
        return;
      }
      delete lib.mode.guozhan.config.aozhan_bgm.item[link];
      if (!Array.isArray(_status.aozhanBGMToRemove)) {
        _status.aozhanBGMToRemove = [];
      }
      _status.aozhanBGMToRemove.add(link);
    } else {
      if (["music_off", "music_custom", "music_random"].includes(link)) {
        return;
      }
      lib.config.all.background_music.remove(link);
    }
    menuBridge.refreshOptionsConfig?.(aozhan ? "aozhan_bgm" : "background_music");
  },
  /**
   * Generate a beatmap using the given BPM, beats, and offset
   *
   * 用给定的BPM、节拍和偏移生成谱面
   */
  generateBeatmapTimeleap(bpm, beats, offset) {
    return beats.map((value) => Math.round(value * 6e4 / bpm + (offset || 0)));
  },
  playBackgroundMusic() {
    if (lib.config.background_music == "music_off") {
      ui.backgroundMusic.src = "";
      return;
    }
    if (_status._aozhan) {
      const aozhanBGMConfiguration = lib.config.mode_config.guozhan.aozhan_bgm;
      if (aozhanBGMConfiguration == "disabled") {
        return;
      }
      let aozhan = _status.tempAozhan || aozhanBGMConfiguration;
      if (Array.isArray(aozhan)) {
        aozhan = aozhan.randomGet("disabled", _status.currentAozhan) || aozhanBGMConfiguration;
      }
      if (aozhan == "random") {
        const excluded = ["disabled", "random"];
        if (_status.currentAozhan !== void 0) excluded.push(_status.currentAozhan);
        aozhan = Object.keys(lib.mode.guozhan.config.aozhan_bgm.item).randomGet(...excluded);
      }
      _status.currentAozhan = aozhan;
      if (["blob:", "data:"].some((prefix) => aozhan.startsWith(prefix))) {
        ui.backgroundMusic.src = aozhan;
      } else if (aozhan.startsWith("db:")) {
        game.getDB("image", aozhan.slice(3)).then((result) => ui.backgroundMusic.src = String(result));
      } else if (aozhan.startsWith("ext:")) {
        ui.backgroundMusic.src = `${lib.assetURL}extension/${aozhan.slice(4)}`;
      } else {
        ui.backgroundMusic.src = `${lib.assetURL}audio/background/aozhan_${aozhan}.mp3`;
      }
      return;
    }
    let music = _status.tempMusic || lib.config.background_music;
    if (Array.isArray(music)) {
      music = music.randomGet("music_off", _status.currentMusic) || lib.config.background_music;
    }
    if (music == "music_random") {
      music = lib.config.all.background_music.randomGet("music_off", "music_random", _status.currentMusic);
    }
    _status.currentMusic = music;
    if (music == "music_custom") {
      const backgroundMusicSourceConfiguration = lib.config.background_music_src;
      if (backgroundMusicSourceConfiguration) {
        ui.backgroundMusic.src = backgroundMusicSourceConfiguration;
      }
      return;
    }
    if (["blob:", "data:"].some((prefix) => music.startsWith(prefix))) {
      ui.backgroundMusic.src = music;
    } else if (music.startsWith("db:")) {
      game.getDB("image", music.slice(3)).then((result) => ui.backgroundMusic.src = String(result));
    } else if (music.startsWith("ext:")) {
      ui.backgroundMusic.src = `${lib.assetURL}extension/${music.slice(4)}`;
    } else {
      ui.backgroundMusic.src = `${lib.assetURL}audio/background/${music}.mp3`;
    }
  }
};
export {
  backgroundMusicMethods
};
