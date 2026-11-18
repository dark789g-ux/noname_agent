import "../../../noname.js";
import { game } from "../index.js";
import { get } from "../../get/binding.js";
import { lib } from "../../library/index.js";
import { _status } from "../../status/index.js";
import { ui } from "../../ui/index.js";
const soundEffectsMethods = {
  playAudio(...args) {
    const options = args.length === 1 && get.objtype(args[0]) === "object" ? args[0] : {
      path: args.filter((arg) => typeof arg === "string" || typeof arg === "number").join("/"),
      onError: args.find((arg) => typeof arg === "function")
    };
    const {
      path = "",
      addVideo = true,
      video = false,
      onCanPlay = (_evt) => void 0,
      onPlay = (_evt) => void 0,
      onEnded = (_evt) => void 0,
      onError = (_evt) => void 0
    } = options;
    if (_status.video && !video) {
      return;
    }
    let parsedPath = "";
    if (["blob:", "data:"].some((prefix) => path.startsWith(prefix))) {
      parsedPath = path;
    } else if (path.startsWith("ext:")) {
      parsedPath = path.replace(/^ext:/, "extension/");
    } else if (path.startsWith("db:")) {
      parsedPath = path.replace(/^(db:[^:]*)\//, (_, p) => p + ":");
    } else {
      parsedPath = `audio/${path}`;
    }
    if (!lib.config.repeat_audio && _status.skillaudio.includes(parsedPath)) {
      return;
    }
    const audio = document.createElement("audio");
    audio.volume = lib.config.volumn_audio / 8;
    audio.autoplay = true;
    audio.oncanplay = (ev) => {
      Promise.resolve(audio.play()).catch((e) => console.error(e));
      if (_status.video || game.online) {
        return;
      }
      onCanPlay(ev);
    };
    audio.onplay = (ev) => {
      _status.skillaudio.add(parsedPath);
      setTimeout(() => _status.skillaudio.remove(parsedPath), 1e3);
      if (addVideo) {
        game.addVideo("playAudio", null, path);
      }
      if (_status.video || game.online) {
        return;
      }
      onPlay(ev);
    };
    audio.onended = (ev) => {
      audio.remove();
      if (_status.video || game.online) {
        return;
      }
      onEnded(ev);
    };
    audio.onerror = (ev) => {
      audio.remove();
      if (_status.video || game.online) {
        return;
      }
      onError(ev);
    };
    Promise.resolve().then(async () => {
      let resolvedPath;
      if (parsedPath.startsWith("db:")) {
        const storedPath = await game.getDB("image", parsedPath.slice(3));
        if (typeof storedPath != "string") {
          throw new TypeError("The stored audio path must be a string");
        }
        resolvedPath = get.objectURL(storedPath);
      } else if (lib.path.extname(parsedPath)) {
        resolvedPath = `${lib.assetURL}${parsedPath}`;
      } else if (URL.canParse(path)) {
        resolvedPath = path;
      } else {
        resolvedPath = `${lib.assetURL}${parsedPath}.mp3`;
      }
      audio.src = resolvedPath;
      ui.window.appendChild(audio);
    });
    return audio;
  },
  tryAudio({ audioList, autoplay = true, random = true, addVideo = true }) {
    let audio, list = audioList.slice(), refresh = false;
    const check = () => {
      if (list.length) {
        return true;
      }
      if (refresh) {
        list = audioList.slice();
        return true;
      }
      return false;
    };
    const play = () => {
      if (!check()) return;
      audio = random ? list.randomRemove() : list.shift();
      return game.playAudio({
        path: audio,
        addVideo,
        onCanPlay: () => refresh = true,
        onError: play
      });
    };
    if (autoplay) {
      return play();
    }
    return () => {
      if (random) {
        list = audioList.slice();
      }
      return play();
    };
  },
  parseSkillAudio(skill, player, skillInfo) {
    return get.Audio.skill({ skill, player, info: skillInfo }).fileList;
  },
  parseSkillText(skill, player, skillInfo) {
    return get.Audio.skill({ skill, player, info: skillInfo }).textList;
  },
  parseSkillTextMap(skill, player, skillInfo) {
    return get.Audio.skill({ skill, player, info: skillInfo }).audioList;
  },
  parseDieTextMap(player) {
    return get.Audio.die({ player }).audioList;
  },
  trySkillAudio(skill, player, directaudio, nobroadcast, skillInfo, args) {
    if (!nobroadcast) {
      game.broadcast(game.trySkillAudio, skill, player, directaudio, nobroadcast, skillInfo, args);
    }
    if (!lib.config.background_speak) {
      return;
    }
    const info = skillInfo || lib.skill[skill];
    if (!info) {
      return;
    }
    if (info.direct && !directaudio) {
      return;
    }
    if (lib.skill.global.includes(skill) && !info.forceaudio) {
      return;
    }
    const audioList = get.Audio.skill({ skill, player, info: skillInfo, args }).fileList;
    return game.tryAudio({ audioList });
  },
  tryDieAudio(player) {
    game.broadcast(game.tryDieAudio, player);
    if (!lib.config.background_speak) {
      return;
    }
    const audioList = get.Audio.die({ player }).fileList;
    return game.tryAudio({ audioList });
  },
  /**
   * @deprecated
   */
  playSkillAudio(name, index) {
    if (_status.video && index != "video") {
      return;
    }
    if (!lib.config.repeat_audio && _status.skillaudio.includes(name)) {
      return;
    }
    game.addVideo("playSkillAudio", null, name);
    if (name.indexOf("|") < name.lastIndexOf("|")) {
      name = name.slice(name.lastIndexOf("|") + 1);
    }
    _status.skillaudio.add(name);
    setTimeout(function() {
      _status.skillaudio.remove(name);
    }, 1e3);
    const str = "audio/skill/";
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.volume = lib.config.volumn_audio / 8;
    audio.src = lib.assetURL + str + name + ".mp3";
    audio.addEventListener("ended", function() {
      this.remove();
    });
    if (typeof index != "number") {
      index = Math.ceil(Math.random() * 2);
    }
    let changed = 1;
    audio.onerror = function() {
      switch (changed) {
        case 1: {
          audio.src = lib.assetURL + str + name + ".ogg";
          changed = 2;
          break;
        }
        case 2: {
          audio.src = lib.assetURL + str + name + index + ".mp3";
          changed = 3;
          break;
        }
        case 3: {
          audio.src = lib.assetURL + str + name + index + ".ogg";
          changed = 4;
          break;
        }
        default: {
          audio.remove();
        }
      }
    };
    audio.oncanplay = function() {
      Promise.resolve(audio.play()).catch(() => void 0);
    };
    ui.window.appendChild(audio);
  },
  playCardAudio(card, sex) {
    const originalCard = card;
    const audioCard = typeof card === "string" ? { name: card } : card;
    const normalizedSex = get.itemtype(sex) === "player" && typeof sex !== "string" && sex.sex == "female" ? "female" : sex == "female" ? "female" : "male";
    const cardName = audioCard.name;
    if (!lib.config.background_audio || get.type(originalCard) == "equip" && !lib.config.equip_audio) {
      return;
    }
    const nature = get.natureList(originalCard)[0];
    if (lib.natureAudio[cardName]) {
      const useAudio = lib.natureAudio[cardName][nature];
      if (useAudio === "default") {
        game.playAudio("card", normalizedSex, `${cardName}_${nature}`);
        return;
      } else if (useAudio && useAudio[normalizedSex]) {
        game.playAudio(useAudio[normalizedSex]);
        return;
      }
    }
    const audio = get.dynamicVariable(lib.card[cardName].audio, audioCard, normalizedSex);
    if (typeof audio == "string") {
      const audioInfo = audio.split(":");
      if (["blob:", "data:"].some((prefix) => audio.startsWith(prefix))) {
        game.playAudio(audio);
      } else if (audio.startsWith("db:")) {
        game.playAudio(`${audioInfo[0]}:${audioInfo[1]}`, audioInfo[2], `${cardName}_${normalizedSex}.${audioInfo[3] || "mp3"}`);
      } else if (audio.startsWith("ext:")) {
        game.playAudio(`${audioInfo[0]}:${audioInfo[1]}`, `${cardName}_${normalizedSex}.${audioInfo[2] || "mp3"}`);
      } else {
        game.playAudio("card", normalizedSex, `${audioInfo[0]}.${audioInfo[1] || "mp3"}`);
      }
    } else {
      game.playAudio("card", normalizedSex, cardName);
    }
  }
};
export {
  soundEffectsMethods
};
