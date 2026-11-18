import "../../../../noname.js";
import { game } from "../../../game/index.js";
import { _status } from "../../../status/index.js";
import { lib } from "../../index.js";
import { get } from "../../../get/binding.js";
import { ui } from "../../../ui/index.js";
const chooseToPlayBeatmapContent = {
  // 苏婆！
  async chooseToPlayBeatmap(event, trigger, player) {
    if (game.online) {
      return;
    }
    if (_status.connectMode) {
      event.time = lib.configOL.choose_timeout;
    }
    event.videoId = lib.status.videoId++;
    game.broadcastAll(
      (player2, id, beatmap2) => {
        if (_status.connectMode) {
          lib.configOL.choose_timeout = (Math.ceil((beatmap2.timeleap[beatmap2.timeleap.length - 1] + beatmap2.speed * 100 + (beatmap2.current || 0)) / 1e3) + 5).toString();
        }
        if (player2 == game.me) {
          return;
        }
        let str = `${get.translation(player2)}正在演奏《${beatmap2.name}》...`;
        if (!_status.connectMode) {
          str += "<br>（点击屏幕可以跳过等待AI操作）";
        }
        ui.create.dialog(str).videoId = id;
        if (ui.backgroundMusic) {
          ui.backgroundMusic.pause();
        }
        if (lib.config.background_audio) {
          if (beatmap2.filename.startsWith("ext:")) {
            game.playAudio(beatmap2.filename);
          } else {
            game.playAudio("effect", beatmap2.filename);
          }
        }
      },
      player,
      event.videoId,
      event.beatmap
    );
    const beatmap = event.beatmap;
    let result;
    if (event.isMine()) {
      const { promise, resolve } = Promise.withResolvers();
      const timeleap = beatmap.timeleap.slice(0);
      let current = beatmap.current;
      const getTimeout = () => {
        const time = timeleap.shift();
        const out = time - current;
        current = time;
        return out;
      };
      let score = 0;
      const added = timeleap.length;
      const number_of_tracks = beatmap.number_of_tracks || 6;
      const custom_mapping = Array.isArray(beatmap.mapping);
      const mapping = custom_mapping ? beatmap.mapping.slice() : beatmap.mapping;
      let hitsound = beatmap.hitsound || "hitsound.wav";
      if (hitsound.startsWith("ext:")) {
        hitsound = `${lib.assetURL}extension/${hitsound.slice(4)}`;
      } else {
        hitsound = `${lib.assetURL}audio/effect/${hitsound}`;
      }
      const hitsound_audio = new Audio(hitsound);
      hitsound_audio.volume = 0.25;
      let abs = 1;
      let node_pos = 0;
      if (custom_mapping) {
        node_pos = mapping.shift();
      } else if (mapping == "random") {
        abs = get.rand(number_of_tracks);
        node_pos = abs;
      }
      let combo = 0;
      let max_combo = 0;
      const nodes = [];
      const nodePositions = /* @__PURE__ */ new WeakMap();
      const nodeTimeouts = /* @__PURE__ */ new WeakMap();
      let roundmenu = false;
      if (ui.roundmenu && ui.roundmenu.style.display != "none") {
        roundmenu = true;
        ui.roundmenu.style.display = "none";
      }
      if (ui.backgroundMusic) {
        ui.backgroundMusic.pause();
      }
      event.settleed = false;
      const dialog = ui.create.dialog("forcebutton", "hidden");
      event.dialog = dialog;
      event.dialog.textPrompt = event.dialog.add(`<div class="text center">${beatmap.prompt || "在音符滑条和底部判定区重合时点击屏幕！"}</div>`);
      event.switchToAuto = () => {
      };
      event.dialog.classList.add("fixed");
      event.dialog.classList.add("scroll1");
      event.dialog.classList.add("scroll2");
      event.dialog.classList.add("fullwidth");
      event.dialog.classList.add("fullheight");
      event.dialog.classList.add("noupdate");
      event.dialog.style.overflow = "hidden";
      event.settle = () => {
        if (event.settleed) {
          return;
        }
        event.settleed = true;
        const acc = Math.floor(score / (added * 5) * 100);
        if (!Array.isArray(lib.config.choose_to_play_beatmap_accuracies)) {
          lib.config.choose_to_play_beatmap_accuracies = [];
        }
        lib.config.choose_to_play_beatmap_accuracies.push(acc);
        if (lib.config.choose_to_play_beatmap_accuracies.length > 5) {
          lib.config.choose_to_play_beatmap_accuracies.shift();
        }
        game.saveConfigValue("choose_to_play_beatmap_accuracies");
        let rank;
        if (acc == 100) {
          rank = ["SS", "metal"];
        } else if (acc >= 94) {
          rank = ["S", "orange"];
        } else if (acc >= 87) {
          rank = ["A", "wood"];
        } else if (acc >= 80) {
          rank = ["B", "water"];
        } else if (acc >= 65) {
          rank = ["C", "thunder"];
        } else {
          rank = ["D", "fire"];
        }
        event.dialog.textPrompt.innerHTML = `<div class="text center">演奏结束！<br>最大连击数：${max_combo}  精准度：${acc}%</div>`;
        game.getMe().$fullscreenpop(`<span style="font-family:xinwei">演奏评级：<span data-nature="${rank[1]}">${rank[0]}</span></span>`, null, null, false);
        setTimeout(() => {
          event.dialog.close();
          _status.imchoosing = false;
          if (roundmenu) {
            ui.roundmenu.style.display = "";
          }
          if (ui.backgroundMusic && !isNaN(ui.backgroundMusic.duration)) {
            ui.backgroundMusic.play();
          }
          hitsound_audio.remove();
          resolve({
            bool: true,
            accuracy: acc,
            rank
          });
        }, 1e3);
      };
      event.dialog.open();
      const height = event.dialog.offsetHeight;
      const width = event.dialog.offsetWidth;
      const range1 = beatmap.range1 || [90, 110];
      const range2 = beatmap.range2 || [93, 107];
      const range3 = beatmap.range3 || [96, 104];
      const speed = beatmap.speed || 25;
      const judger = ui.create.div("");
      judger.style["background-image"] = beatmap.judgebar_color || "linear-gradient(rgba(240, 235, 3, 1), rgba(230, 225, 5, 1))";
      judger.style["border-radius"] = "3px";
      judger.style.position = "absolute";
      judger.style.opacity = "0.3";
      const heightj = Math.ceil(height * (beatmap.judgebar_height || 0.1));
      judger.style.height = `${heightj}px`;
      judger.style.width = `${width}px`;
      judger.style.left = "0px";
      judger.style.top = `${height - heightj}px`;
      event.dialog.appendChild(judger);
      const addNode = () => {
        const node = ui.create.div("");
        nodes.push(node);
        node.style["background-image"] = beatmap.node_color || "linear-gradient(rgba(120, 120, 240, 1), rgba(100, 100, 230, 1))";
        node.style["border-radius"] = "3px";
        node.style.position = "absolute";
        node.style.height = `${Math.ceil(height / 10)}px`;
        node.style.width = `${Math.ceil(width / number_of_tracks) - 10}px`;
        nodePositions.set(node, get.utc());
        event.dialog.appendChild(node);
        node.style.left = `${Math.ceil(width * node_pos / number_of_tracks + 5)}px`;
        node.style.top = `-${Math.ceil(height / 10)}px`;
        ui.refresh(node);
        node.style.transition = `all ${speed * 110}ms linear`;
        node.style.transform = `translateY(${Math.ceil(height * 1.1)}px)`;
        const timeout = setTimeout(() => {
          if (nodes.includes(node)) {
            nodes.remove(node);
            player.popup("Miss", "fire", false);
            if (player.damagepopups.length) {
              player.$damagepop();
            }
            combo = 0;
          }
        }, speed * 110);
        nodeTimeouts.set(node, timeout);
        if (custom_mapping) {
          node_pos = mapping.shift();
        } else if (mapping == "random") {
          while (node_pos == abs) {
            node_pos = get.rand(number_of_tracks);
          }
          abs = node_pos;
        } else {
          node_pos += abs;
          if (node_pos > number_of_tracks - 1) {
            abs = -1;
            node_pos = number_of_tracks - 2;
          } else if (node_pos < 0) {
            abs = 1;
            node_pos = 1;
          }
        }
        if (timeleap.length) {
          setTimeout(() => {
            addNode();
          }, getTimeout());
        } else {
          setTimeout(
            () => {
              event.settle();
            },
            speed * 110 + 100
          );
        }
      };
      const click = () => {
        if (!nodes.length) {
          return;
        }
        for (const node of nodes) {
          const time = get.utc();
          const position = nodePositions.get(node);
          if (position === void 0) {
            continue;
          }
          const top = (time - position) / speed;
          if (top > range1[1]) {
            continue;
          } else if (top < range1[0]) {
            return;
          }
          nodes.remove(node);
          const timeout = nodeTimeouts.get(node);
          if (timeout !== void 0) {
            clearTimeout(timeout);
          }
          node.style.transform = "";
          node.style.transition = "all 0s";
          node.style.top = `${height * ((top - 10) / 100)}px`;
          ui.refresh(node);
          node.style.transition = "all 0.5s";
          node.style.transform = "scale(1.2)";
          node.delete();
          if (top >= range3[0] && top < range3[1]) {
            score += 5;
            player.popup("Perfect", "orange", false);
          } else if (top >= range2[0] && top < range2[1]) {
            score += 3;
            player.popup("Great", "wood", false);
          } else {
            score += 1;
            player.popup("Good", "soil", false);
          }
          if (player.damagepopups.length) {
            player.$damagepop();
          }
          combo++;
          max_combo = Math.max(combo, max_combo);
          hitsound_audio.currentTime = 0;
          if (hitsound_audio.paused) {
            Promise.resolve(hitsound_audio.play()).catch(() => void 0);
          }
          break;
        }
      };
      document.addEventListener(lib.config.touchscreen ? "touchstart" : "mousedown", click);
      game.countChoose();
      setTimeout(
        () => {
          if (!lib.config.background_audio) {
            return;
          }
          if (beatmap.filename.startsWith("ext:")) {
            game.playAudio(beatmap.filename);
          } else {
            game.playAudio("effect", beatmap.filename);
          }
        },
        Math.floor(speed * 100 * (0.9 + beatmap.judgebar_height)) + beatmap.current
      );
      setTimeout(() => {
        addNode();
      }, getTimeout());
      result = await promise;
    } else if (event.isOnline()) {
      const remoteResult = await event.sendAsync();
      const isRecord2 = (value) => typeof value == "object" && value !== null && !Array.isArray(value);
      if (isRecord2(remoteResult)) {
        const bool = remoteResult.bool;
        const accuracy = remoteResult.accuracy;
        const rank = remoteResult.rank;
        if (typeof bool == "boolean" && typeof accuracy == "number" && Number.isFinite(accuracy) && Array.isArray(rank) && rank.length == 2 && typeof rank[0] == "string" && typeof rank[1] == "string") {
          const normalizedResult = {
            bool,
            accuracy,
            rank: [rank[0], rank[1]]
          };
          result = normalizedResult;
        } else {
          result = {};
        }
      } else {
        result = {};
      }
    } else {
      game.countChoose();
      const songDuration = beatmap.timeleap[beatmap.timeleap.length - 1] + beatmap.speed * 100 + 1e3 + (beatmap.current || 0);
      const control = new AbortController();
      const songPlaybackDelay = delayExt(songDuration, { signal: control.signal, rejectOnAbort: false });
      const delays = [songPlaybackDelay];
      if (!_status.connectMode) {
        const skip = () => {
          Array.from(ui.window.getElementsByTagName("audio")).forEach((audio) => {
            if (audio.currentSrc.includes(beatmap.filename.startsWith("ext:") ? beatmap.name : beatmap.filename)) {
              audio.remove();
            }
          });
          control.abort();
        };
        document.addEventListener(lib.config.touchscreen ? "touchend" : "click", skip);
        const skipDelay = delayExt(songDuration, { signal: control.signal, rejectOnAbort: false }).then(() => {
          document.removeEventListener(lib.config.touchscreen ? "touchend" : "click", skip);
        });
        delays.push(skipDelay);
      }
      await Promise.all(delays);
      _status.imchoosing = false;
      const chooseToPlayBeatmapAccuracies = (lib.config.choose_to_play_beatmap_accuracies || []).concat(
        Array.from(
          {
            length: 6 - (lib.config.choose_to_play_beatmap_accuracies || []).length
          },
          () => get.rand(70, 100)
        )
      );
      const mean = Math.round(chooseToPlayBeatmapAccuracies.reduce((previousValue, currentValue) => previousValue + currentValue) / chooseToPlayBeatmapAccuracies.length);
      const half_standard_deviation = Math.round(Math.sqrt(chooseToPlayBeatmapAccuracies.reduce((previousValue, currentValue) => previousValue + Math.pow(currentValue - mean, 2), 0)) / 2);
      const acc = Math.min(Math.max(get.rand.apply(get, beatmap.aiAcc || [mean - half_standard_deviation - get.rand(0, half_standard_deviation), mean + half_standard_deviation + get.rand(0, half_standard_deviation)]), 0), 100);
      let rank;
      if (acc == 100) {
        rank = ["SS", "metal"];
      } else if (acc >= 94) {
        rank = ["S", "orange"];
      } else if (acc >= 87) {
        rank = ["A", "green"];
      } else if (acc >= 80) {
        rank = ["B", "water"];
      } else if (acc >= 65) {
        rank = ["C", "thunder"];
      } else {
        rank = ["D", "fire"];
      }
      if (event.dialog) {
        event.dialog.close();
      }
      if (event.control) {
        event.control.close();
      }
      result = {
        bool: true,
        accuracy: acc,
        rank
      };
    }
    game.broadcastAll(
      (id, time) => {
        if (_status.connectMode) {
          lib.configOL.choose_timeout = time;
        }
        const dialog = get.idDialog(id);
        if (dialog) {
          dialog.close();
        }
        if (ui.backgroundMusic && !isNaN(ui.backgroundMusic.duration)) {
          ui.backgroundMusic.play();
        }
      },
      event.videoId,
      event.time
    );
    event.result = result;
    return;
    function delayExt(ms, option = {}) {
      const { signal, rejectOnAbort = true } = option;
      if (signal?.aborted) {
        return rejectOnAbort ? Promise.reject(signal.reason) : Promise.resolve();
      }
      return new Promise((resolve, reject) => {
        const abort = () => {
          clearTimeout(timeout);
          if (rejectOnAbort) {
            reject(signal?.reason);
          } else {
            resolve();
          }
        };
        const done = () => {
          signal?.removeEventListener("abort", abort);
          clearTimeout(timeout);
          resolve();
        };
        const timeout = setTimeout(done, ms);
        signal?.addEventListener("abort", abort, { once: true });
      });
    }
  }
};
export {
  chooseToPlayBeatmapContent
};
