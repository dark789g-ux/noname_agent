import "../../../../../noname.js";
import { get } from "../../../../get/binding.js";
import { ui } from "../../../../ui/index.js";
import { game } from "../../../../game/index.js";
import { lib } from "../../../index.js";
import { _status } from "../../../../status/index.js";
const chatAndPromptMethods = {
  $throwEmotion(target, name, rotate) {
    game.addVideo("throwEmotion", this, [target.dataset.position, name]);
    let getLeft = function(player2) {
      if (player2 == game.me && !ui.fakeme && !ui.chess) {
        return player2.getLeft() + player2.node.avatar.offsetWidth / 2;
      }
      return player2.getLeft() + player2.offsetWidth / 2;
    };
    let player = this;
    let emotion = ui.create.div("", '<div style="text-align:center"> <img src="' + lib.assetURL + "image/emotion/throw_emotion/" + name + '1.png"> </div>', game.chess ? ui.chess : ui.window);
    emotion.style.width = "60px";
    emotion.style.height = "60px";
    let width = emotion.offsetWidth / 2;
    let height = emotion.offsetHeight / 2;
    if (game.chess) {
      width += 60;
    }
    let left = getLeft(player) - width;
    let top = player.getTop() + player.offsetHeight / 3 - height;
    emotion.style.left = left + "px";
    emotion.style.top = top + "px";
    let left2 = getLeft(target) - width;
    let top2 = target.getTop() + target.offsetHeight / 3 - height;
    if (["egg", "flower", "shoe"].includes(name) || rotate) {
      let num1 = 0.95 + Math.random() * (1.1 - 0.95);
      let num2 = 1 + Math.random() * (3 - 1);
      left2 = getLeft(target) / num1 - width;
      top2 = target.getTop() + target.offsetHeight / num2 - height;
    } else {
      left2 = getLeft(target) - width;
      top2 = target.getTop() + target.offsetHeight / 3 - height;
    }
    emotion.style["z-index"] = 10;
    emotion.style.transform = "translateY(" + (top2 - top) + "px) translateX(" + (left2 - left) + "px)";
    if (["egg", "flower", "shoe"].includes(name) || rotate) {
      const firstElement = emotion.firstElementChild;
      if (firstElement instanceof HTMLElement) {
        firstElement.style.transform = "rotate(1440deg)";
      }
    }
    if (lib.config.background_audio) {
      game.playAudio("effect", "throw_" + name + get.rand(1, 2));
    }
    setTimeout(function() {
      emotion.innerHTML = '<div style="text-align:center"> <img src="' + lib.assetURL + "image/emotion/throw_emotion/" + name + '2.png"> </div>';
      setTimeout(function() {
        emotion.delete();
      }, 1200);
    }, 600);
  },
  throwEmotion(target, emotion, rotate) {
    game.broadcastAll(
      function(player, target2, emotion2, rotate2) {
        player.$throwEmotion(target2, emotion2, rotate2);
      },
      this,
      target,
      emotion,
      rotate
    );
  },
  emotion(pack, id) {
    let str = `<img src="##assetURL##image/emotion/${pack}/${id}" width="50" height="50">`;
    this.say(str);
    game.broadcast(
      function(id2, str2) {
        if (typeof id2 !== "string") return;
        if (lib.playerOL[id2]) {
          lib.playerOL[id2].say(str2);
        } else if (game.connectPlayers) {
          for (let i = 0; i < game.connectPlayers.length; i++) {
            if (game.connectPlayers[i].playerid == id2) {
              game.connectPlayers[i].say(str2);
              return;
            }
          }
        }
      },
      this.playerid,
      str
    );
  },
  chat(str) {
    if (get.is.banWords(str)) {
      return;
    }
    this.say(str);
    game.broadcast(
      function(id, str2) {
        if (typeof id !== "string") return;
        if (lib.playerOL[id]) {
          lib.playerOL[id].say(str2);
        } else if (game.connectPlayers) {
          for (let i = 0; i < game.connectPlayers.length; i++) {
            if (game.connectPlayers[i].playerid == id) {
              game.connectPlayers[i].say(str2);
              return;
            }
          }
        }
      },
      this.playerid,
      str
    );
  },
  say(str) {
    if (!get.is.emotion(str)) {
      str = get.plainText(str);
    }
    str = str.replace(/##assetURL##/g, lib.assetURL);
    let dialog = ui.create.dialog("hidden");
    dialog.classList.add("static");
    dialog.add('<div class="text" style="word-break:break-all;display:inline">' + str + "</div>");
    dialog.classList.add("popped");
    ui.window.appendChild(dialog);
    const content = dialog.content.firstElementChild;
    const text = content?.firstElementChild;
    let width = text instanceof HTMLElement ? text.offsetWidth : 190;
    if (width < 190) {
      dialog._mod_height = -16;
    } else if (content instanceof HTMLElement) {
      content.style.textAlign = "left";
    }
    dialog.style.width = width + 16 + "px";
    let refnode;
    if (this.node && this.node.avatar && this.parentNode == ui.arena) {
      refnode = this.node.avatar;
    }
    if (refnode) {
      lib.placePoppedDialog(dialog, {
        clientX: (ui.arena.offsetLeft + this.getLeft() + refnode.offsetLeft + refnode.offsetWidth / 2) * game.documentZoom,
        clientY: (ui.arena.offsetTop + this.getTop() + refnode.offsetTop + refnode.offsetHeight / 4) * game.documentZoom
      });
    } else {
      lib.placePoppedDialog(dialog, {
        clientX: (this.getLeft() + this.offsetWidth / 2) * game.documentZoom,
        clientY: (this.getTop() + this.offsetHeight / 4) * game.documentZoom
      });
    }
    if (dialog._mod_height && content instanceof HTMLElement) {
      content.style.padding = "0";
    }
    setTimeout(
      function() {
        dialog.delete();
      },
      lib.quickVoice.includes(str) ? 3800 : 2e3
    );
    let name = get.translation(this.name);
    let info = [name ? name + "[" + this.nickname + "]" : this.nickname, str];
    lib.chatHistory.push(info);
    if (_status.addChatEntry) {
      if (_status.addChatEntry._origin.parentNode) {
        _status.addChatEntry(info, false);
      } else {
        delete _status.addChatEntry;
      }
    }
    if (lib.config.background_speak && lib.quickVoice.includes(str)) {
      game.playAudio("voice", this.sex == "female" ? "female" : "male", lib.quickVoice.indexOf(str));
    }
  },
  line(target, config) {
    if (get.itemtype(target) == "players") {
      for (let i = 0; i < target.length; i++) {
        this.line(target[i], config);
      }
    } else if (get.itemtype(target) == "player") {
      if (target == this) {
        return;
      }
      game.broadcast(
        function(player, target2, config2) {
          player.line(target2, config2);
        },
        this,
        target,
        config
      );
      game.addVideo("line", this, [target.dataset.position, config]);
      game.linexy([this.getLeft() + this.offsetWidth / 2, this.getTop() + this.offsetHeight / 2, target.getLeft() + target.offsetWidth / 2, target.getTop() + target.offsetHeight / 2], config, true);
    }
  },
  line2(targets, config) {
    this.line(targets[0], config);
    targets = targets.slice(0);
    for (let i = 1; i < targets.length; i++) {
      (function(j) {
        setTimeout(function() {
          targets[j - 1].line(targets[j], config);
        }, lib.config.duration * i);
      })(i);
    }
  },
  unprompt() {
    if (this.node.prompt) {
      this.node.prompt.delete();
      delete this.node.prompt;
    }
  },
  prompt(str, nature) {
    let node;
    if (this.node.prompt) {
      node = this.node.prompt;
      node.innerHTML = "";
      node.className = "damage normal-font damageadded";
    } else {
      node = ui.create.div(".damage.normal-font", this);
      this.node.prompt = node;
      ui.refresh(node);
      node.classList.add("damageadded");
    }
    node.innerHTML = str;
    node.dataset.nature = nature || "soil";
  },
  prompt_old(name2, className) {
    let node;
    if (this.node.prompt) {
      node = this.node.prompt;
      node.innerHTML = "";
      node.className = "popup";
    } else {
      node = ui.create.div(".popup", this.parentNode);
      this.node.prompt = node;
    }
    const position = this.dataset.position;
    node.dataset.position = typeof position == "string" ? position : "";
    const positionNumber = typeof position == "string" ? Number.parseInt(position, 10) : NaN;
    const arenaPositionCount = ui.arena && typeof ui.arena.dataset.number == "string" ? Number.parseInt(ui.arena.dataset.number, 10) : NaN;
    const popupText = typeof name2 == "string" || typeof name2 == "number" ? name2 : String(name2);
    if (positionNumber == 0 || Number.isFinite(positionNumber) && Number.isFinite(arenaPositionCount) && positionNumber == arenaPositionCount / 2 || typeof popupText == "number" || this.classList.contains("minskin")) {
      node.innerHTML = String(popupText);
    } else {
      for (let i = 0; i < popupText.length; i++) {
        node.innerHTML += popupText[i] + "<br/>";
      }
    }
    if (className) {
      node.classList.add(className);
    }
  },
  popup(name, className = "water", nobroadcast) {
    let name2 = get.translation(name);
    if (!name2) {
      return;
    }
    this.$damagepop(name2, className || "water", true, nobroadcast);
  },
  popup_old(name, className) {
    let name2 = get.translation(name);
    let node = ui.create.div(".popup", this.parentNode);
    if (!name2) {
      node.remove();
      return node;
    }
    game.addVideo("popup", this, [name, className]);
    const position = this.dataset.position;
    node.dataset.position = typeof position == "string" ? position : "";
    const positionNumber = typeof position == "string" ? Number.parseInt(position, 10) : NaN;
    const arenaPositionCount = ui.arena && typeof ui.arena.dataset.number == "string" ? Number.parseInt(ui.arena.dataset.number, 10) : NaN;
    const popupText = typeof name2 == "string" || typeof name2 == "number" ? name2 : String(name2);
    if (positionNumber == 0 || Number.isFinite(positionNumber) && Number.isFinite(arenaPositionCount) && positionNumber == arenaPositionCount / 2 || typeof popupText == "number" || this.classList.contains("minskin")) {
      node.innerHTML = String(popupText);
    } else {
      for (let i = 0; i < popupText.length; i++) {
        node.innerHTML += popupText[i] + "<br/>";
      }
    }
    if (className) {
      node.classList.add(className);
    }
    this.popups.push(node);
    if (this.popups.length > 1) {
      node.hide();
    } else {
      let that = this;
      setTimeout(function() {
        that._popup();
      }, 1e3);
    }
    return node;
  },
  _popup() {
    if (this.popups.length) {
      this.popups.shift().delete();
      if (this.popups.length) {
        this.popups[0].show();
        let that = this;
        setTimeout(function() {
          that._popup();
        }, 1e3);
      }
    }
  }
};
export {
  chatAndPromptMethods
};
