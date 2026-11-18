import "../../../noname.js";
import { game } from "../index.js";
import { _status } from "../../status/index.js";
import { get } from "../../get/binding.js";
import { lib } from "../../library/index.js";
import { ui } from "../../ui/index.js";
const videoControlMethods = {
  playVideo(time, mode) {
    if (!_status.replayvideo) {
      localStorage.setItem(lib.configprefix + "playbackmode", lib.config.mode);
    }
    game.saveConfig("mode", mode);
    localStorage.setItem(lib.configprefix + "playback", String(time));
    game.reload();
  },
  playVideoContent(video) {
    const next = game.createEvent("video", false);
    next.video = video;
    ui.system.style.display = "none";
    ui.system.hide();
    ui.arena.style.display = "none";
    ui.arena.hide();
    ui.window.classList.remove("leftbar");
    ui.window.classList.remove("rightbar");
    ui.historybar.style.display = "none";
    _status.event = next;
    _status.paused = false;
    _status.paused2 = false;
    _status.over = false;
    _status.video = true;
    clearTimeout(_status.timeout);
    for (let i in lib.characterPack) {
      for (let j in lib.characterPack[i]) {
        lib.character[j] = lib.character[j] || lib.characterPack[i][j];
      }
    }
    next.setContent("playVideoContent");
    game.loop();
  },
  reload() {
    if (_status) {
      if (_status.reloading) {
        return;
      }
      _status.reloading = true;
    }
    if (_status.video && !_status.replayvideo) {
      localStorage.removeItem(lib.configprefix + "playbackmode");
    }
    localStorage.setItem("show_splash_off", "true");
    if (lib.status.reload) {
      _status.waitingToReload = true;
    } else {
      window.location.reload();
    }
  },
  reload2() {
    lib.status.reload--;
    if (lib.status.reload == 0 && lib.ondb2.length) {
      const command = lib.ondb2.shift();
      game[command[0]](...command[1]);
    }
    if (lib.status.reload == 0 && lib.ondb.length) {
      const command = lib.ondb.shift();
      game[command[0]](...command[1]);
    }
    if (lib.status.reload || !_status.waitingToReload) {
      return;
    }
    window.location.reload();
    delete _status.waitingToReload;
  },
  reloadCurrent() {
    const me = Reflect.get(_status, "_startPlayerNames") ?? game.me;
    let names = [me.name1 || me.name, me.name2];
    if (me.name1 != me.name) {
      names = [me.name];
    }
    game.saveConfig("continue_name", names);
    game.saveConfig("mode", lib.config.mode);
    localStorage.setItem(lib.configprefix + "directstart", "true");
    game.reload();
  },
  update(func) {
    lib.updates.push(func);
    if (lib.updates.length === 1) {
      game.run();
    }
    return func;
  },
  unupdate(func) {
    lib.updates.remove(func);
  },
  stop() {
    cancelAnimationFrame(lib.status.frameId);
  },
  run() {
    if (lib.updates.length) {
      cancelAnimationFrame(lib.status.frameId);
      lib.status.frameId = requestAnimationFrame(function(time) {
        if (lib.status.time !== 0) {
          lib.status.delayed += time - lib.status.time;
        }
        lib.status.frameId = requestAnimationFrame(lib.run);
      });
    }
  },
  addVideo(type, player, content) {
    if (_status.video || game.online) {
      return;
    }
    if (!_status.videoInited) {
      if (type == "arrangeLib") {
        const initialVideoPlayer = player && get.itemtype(player) == "player" ? player.dataset.position : void 0;
        lib.video.push({
          type,
          player: initialVideoPlayer,
          content,
          delay: 0
        });
      }
      return;
    }
    if (type == "storage" && player && player.updateMarks) {
      player.updateMarks();
    }
    if (game.getVideoName) {
      let time = get.time();
      if (!_status.lastVideoLog) {
        _status.lastVideoLog = time;
      }
      let videoPlayer;
      if (player && get.itemtype(player) == "player") {
        videoPlayer = player.dataset.position;
      } else {
        videoPlayer = player == null ? player : void 0;
      }
      lib.video.push({
        type,
        player: videoPlayer === null ? void 0 : videoPlayer,
        content,
        delay: time - _status.lastVideoLog
      });
      _status.lastVideoLog = time;
    }
    if (type === "init") {
      game.addVideo("cardtag", null, _status.cardtag);
    }
  }
};
export {
  videoControlMethods
};
