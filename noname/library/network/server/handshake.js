import "../../../../noname.js";
import { requireConnectPlayers } from "../../runtime/node.js";
import { lib } from "../../index.js";
import { game } from "../../../game/index.js";
import { ui } from "../../../ui/index.js";
import { get } from "../../../get/binding.js";
import { _status } from "../../../status/index.js";
function createMessageServerHandshake() {
  return {
    cardPile() {
      this.send(
        JSON.stringify({
          type: "cardPile",
          data: {
            drawPile: Array.from(ui.cardPile.children),
            discardPile: Array.from(ui.discardPile.children)
          }
        })
      );
    },
    /**
     * @this {import("@/library/element/client.js").Client}
     * @param {number} version
     * @param {ClientInitConfig} config
     * @param {string | undefined} banned_info
     */
    init(version, config, banned_info) {
      const node = lib.requireNodeServer();
      this.onlineKey = config.onlineKey;
      var banBlacklist = lib.config.banBlacklist === void 0 ? [] : lib.config.banBlacklist;
      if (typeof banned_info == "string" && node.banned.includes(banned_info) || typeof config.onlineKey == "string" && banBlacklist.includes(config.onlineKey)) {
        this.send("denied", "banned");
      } else if (config.id && lib.playerOL && lib.playerOL[config.id]) {
        var player = lib.playerOL[config.id];
        player.setNickname();
        player.ws = this;
        player.isAuto = false;
        this.id = config.id;
        game.broadcast(function(player2) {
          player2.setNickname();
        }, player);
        const onreconnect = "onreconnect" in _status && Array.isArray(_status.onreconnect) ? _status.onreconnect : void 0;
        this.send("reinit", lib.configOL, get.arenaState(), game.getState ? game.getState() : {}, game.ip, null, onreconnect, _status.cardtag, _status.postReconnect);
      } else if (version != lib.versionOL) {
        this.send("denied", "version");
        node.clients.remove(this);
        this.closed = true;
      } else if (get.config("check_versionLocal", "connect") && config.versionLocal != lib.version) {
        this.send("denied", "version");
        node.clients.remove(this);
        this.closed = true;
      } else if (get.config("check_extension", "connect") && config.extension) {
        this.send("denied", "extension");
      } else if (!_status.waitingForPlayer) {
        if (!config.nickname) {
          this.send("denied", "banned");
          node.clients.remove(this);
          this.closed = true;
        } else if (game.phaseNumber && lib.configOL.observe) {
          node.observing.push(this);
          this.send("reinit", lib.configOL, get.arenaState(), game.getState ? game.getState() : {}, game.ip, game.players[0].playerid, null, _status.cardtag, _status.postReconnect);
          game.log("玩家 ", `#y${get.plainText(config.nickname)}`, " 进入房间观战");
          game.getMe().chat(`玩家 <span style="font-weight: bold; color: rgb(126, 180, 255)">${get.plainText(config.nickname)}</span> 进入房间观战`);
          if (!ui.removeObserve) {
            ui.removeObserve = ui.create.system(
              "移除旁观",
              /** @this {HTMLElement} */
              function() {
                lib.configOL.observe = false;
                if (game.onlineroom) {
                  game.send("server", "config", lib.configOL);
                }
                const server = lib.requireNodeServer();
                while (server.observing.length) {
                  const observer = server.observing.shift();
                  if (observer) {
                    observer.ws.close();
                  }
                }
                this.remove();
                delete ui.removeObserve;
              },
              true,
              true
            );
          }
        } else {
          this.send("denied", "gaming");
          node.clients.remove(this);
          this.closed = true;
        }
      } else if (node.clients.length >= parseInt(lib.configOL.number)) {
        this.send("denied", "number");
        node.clients.remove(this);
        this.closed = true;
      } else {
        if (config) {
          this.avatar = config.avatar;
          this.nickname = config.nickname;
        }
        const connectPlayers = requireConnectPlayers();
        for (var i = 0; i < connectPlayers.length; i++) {
          if (connectPlayers[i].classList.contains("unselectable2")) {
            continue;
          }
          if (connectPlayers[i] != game.me && !connectPlayers[i].playerid) {
            connectPlayers[i].playerid = this.id;
            connectPlayers[i].initOL(this.nickname, this.avatar);
            connectPlayers[i].ws = this;
            break;
          }
        }
        this.send("init", this.id, lib.configOL, game.ip, false, game.roomId);
      }
    },
    /**
     * @this {import("@/library/element/client.js").Client}
     */
    inited() {
      this.inited = true;
      if (_status.waitingForPlayer) {
        game.updateWaiting();
      }
    },
    /**
     * @this {import("@/library/element/client.js").Client}
     */
    reinited() {
      this.inited = true;
    },
    /**
     * @this {import("@/library/element/client.js").Client}
     */
    result(result) {
      if (lib.requireNodeServer().observing.includes(this)) {
        return;
      }
      var player = lib.playerOL[this.id];
      if (player) {
        player.unwait(result);
      }
    },
    /**
     * @this {import("@/library/element/client.js").Client}
     */
    tempResult(result) {
      if (lib.requireNodeServer().observing.includes(this)) {
        return;
      }
      var player = lib.playerOL[this.id];
      if (player) {
        player.tempUnwait(result);
      }
    },
    /**
     * @this {import("@/library/element/client.js").Client}
     */
    startGame() {
      if (this.id == game.onlinezhu) {
        game.resume();
      }
    },
    /**
     * @this {import("@/library/element/client.js").Client}
     */
    changeRoomConfig(config) {
      if (this.id == game.onlinezhu) {
        game.broadcastAll(function(config2) {
          for (var i2 in config2) {
            lib.configOL[i2] = config2[i2];
          }
          if (ui.connectStartBar) {
            const roomLabel = ui.connectStartBar.firstChild;
            if (!(roomLabel instanceof HTMLElement)) {
              throw new TypeError("The connection start bar requires its room label");
            }
            roomLabel.innerHTML = get.modetrans(lib.configOL, true);
          }
        }, config);
        if (lib.configOL.mode == "identity" && lib.configOL.identity_mode == "zhong" && game.connectPlayers) {
          for (var i = 0; i < game.connectPlayers.length; i++) {
            game.connectPlayers[i].classList.remove("unselectable2");
          }
          lib.configOL.number = 8;
          game.updateWaiting();
        }
        if (game.onlineroom) {
          game.send("server", "config", lib.configOL);
        }
        const connectPlayers = requireConnectPlayers();
        for (var i = 0; i < connectPlayers.length; i++) {
          if (connectPlayers[i].playerid == this.id) {
            connectPlayers[i].chat("房间设置已更改");
          }
        }
      }
    },
    /**
     * @this {import("@/library/element/client.js").Client}
     */
    changeNumConfig(num, index, bool) {
      if (this.id == game.onlinezhu) {
        lib.configOL.number = num;
        game.send("server", "config", lib.configOL);
        if (game.connectPlayers && game.connectPlayers[index]) {
          if (bool) {
            game.connectPlayers[index].classList.add("unselectable2");
          } else {
            game.connectPlayers[index].classList.remove("unselectable2");
          }
          game.updateWaiting();
        }
      }
    },
    /**
     * @this {import("@/library/element/client.js").Client}
     */
    throwEmotion(target, emotion, rotate) {
      if (lib.requireNodeServer().observing.includes(this)) {
        return;
      }
      var player = lib.playerOL[this.id];
      if (player) {
        player.throwEmotion(target, emotion, rotate);
      }
    },
    /**
     * @this {import("@/library/element/client.js").Client}
     */
    emotion(id, pack, emotion) {
      if (lib.requireNodeServer().observing.includes(this)) {
        return;
      }
      var that = this;
      if (!this.id || !lib.playerOL[this.id] && (!game.connectPlayers || !(function() {
        for (var i2 = 0; i2 < game.connectPlayers.length; i2++) {
          if (game.connectPlayers[i2].playerid == that.id) {
            return true;
          }
        }
        return false;
      })())) {
        return;
      }
      var player;
      if (lib.playerOL[id]) {
        player = lib.playerOL[id];
      } else if (game.connectPlayers) {
        for (var i = 0; i < game.connectPlayers.length; i++) {
          if (game.connectPlayers[i].playerid == id) {
            player = game.connectPlayers[i];
            break;
          }
        }
      }
      if (player) {
        player.emotion(pack, emotion);
      }
    },
    /**
     * @this {import("@/library/element/client.js").Client}
     */
    chat(id, str) {
      if (lib.requireNodeServer().observing.includes(this)) {
        return;
      }
      var that = this;
      if (!this.id || !lib.playerOL[this.id] && (!game.connectPlayers || !(function() {
        for (var i2 = 0; i2 < game.connectPlayers.length; i2++) {
          if (game.connectPlayers[i2].playerid == that.id) {
            return true;
          }
        }
        return false;
      })())) {
        return;
      }
      var player;
      if (lib.playerOL[id]) {
        player = lib.playerOL[id];
      } else if (game.connectPlayers) {
        for (var i = 0; i < game.connectPlayers.length; i++) {
          if (game.connectPlayers[i].playerid == id) {
            player = game.connectPlayers[i];
            break;
          }
        }
      }
      if (player) {
        player.chat(str);
      }
    }
  };
}
export {
  createMessageServerHandshake
};
