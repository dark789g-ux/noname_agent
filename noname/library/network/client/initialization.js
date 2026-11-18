import "../../../../noname.js";
import "../../../util/sandbox.js";
import { requireConnectPlayers } from "../../runtime/node.js";
import { game } from "../../../game/index.js";
import { lib } from "../../index.js";
import { _status } from "../../../status/index.js";
import { ui } from "../../../ui/index.js";
import { get } from "../../../get/binding.js";
import { security } from "../../../util/sandbox/security.js";
import { ErrorManager } from "../../../util/sandbox/error.js";
function createMessageClientInitialization() {
  return {
    exec: function(func, ..._args) {
      if (typeof func == "function") {
        const isMarshalled = security.isSandboxRequired() && security.importSandbox().Domain.current.isFrom(func);
        const level = isMarshalled ? 4 : 0;
        const args = Array.from(arguments).slice(1);
        ErrorManager.errorHandle(
          () => {
            func.apply(this, args);
          },
          func,
          level
        );
      }
      const key = game.onlineKey;
      if (key) {
        game.onlineKey = key;
        localStorage.setItem(lib.configprefix + "key", key);
      }
    },
    denied: function(reason) {
      switch (reason) {
        case "version":
          alert("加入失败：版本不匹配，请将游戏更新至最新版");
          game.saveConfig("tmp_owner_roomId");
          game.saveConfig("tmp_user_roomId");
          game.saveConfig("reconnect_info");
          break;
        case "gaming":
          alert("加入失败：游戏已开始");
          break;
        case "number":
          alert("加入失败：房间已满");
          break;
        case "banned":
          alert("加入失败：房间拒绝你加入");
          break;
        case "key":
          alert("您的游戏版本过低，请升级到最新版");
          game.saveConfig("tmp_owner_roomId");
          game.saveConfig("tmp_user_roomId");
          game.saveConfig("reconnect_info");
          break;
        case "offline":
          if (_status.paused && _status.event.name == "game") {
            setTimeout(game.resume, 500);
          }
          break;
        case "extension":
          if (confirm("加入失败：房间禁止使用扩展！是否关闭所有扩展？")) {
            let libexts = lib.config.extensions;
            for (let i = 0; i < libexts.length; i++) {
              game.saveConfig("extension_" + libexts[i] + "_enable", false);
            }
          }
          break;
        default:
          alert(reason);
      }
      if (!game.ws) {
        throw new TypeError("Connection denial requires the active WebSocket");
      }
      game.ws.close();
      if (_status.connectDenied) {
        _status.connectDenied();
      }
    },
    /**
     * 当服务器响应通过dataSync发送的请求时走这里喵
     *
     * @param {{ ok: boolean, id: string|null, result: any }} data
     */
    dataReply(data) {
      if (data.id && game.dataRequestMap && data.id in game.dataRequestMap) {
        const callback = game.dataRequestMap[data.id];
        delete game.dataRequestMap[data.id];
        if (typeof callback === "function") {
          callback(data.ok, data.result);
        }
      }
    },
    /** @param {string} id */
    cancel: function(id) {
      if (_status.event._parent_id == id) {
        ui.click.cancel();
        if (_status.event.getParent().name == "chooseToUse" && _status.event.getParent().id == id) {
          const parent = _status.event.getParent();
          if (typeof parent.cancel != "function") {
            throw new TypeError("choose-to-use parent requires cancel");
          }
          parent.cancel(null, null, false);
          if (ui.confirm) {
            ui.confirm.close();
          }
        }
      }
      if (_status.event.id == id) {
        if (_status.event._backup) {
          ui.click.cancel();
        }
        ui.click.cancel();
        if (ui.confirm) {
          ui.confirm.close();
        }
        const result = _status.event.result;
        if (typeof result === "object" && result !== null && !Array.isArray(result)) {
          result.id = id;
        }
      }
    },
    /** @param {number} id */
    closeDialog: function(id) {
      var dialog = get.idDialog(id);
      if (dialog) {
        dialog.close();
      }
    },
    createDialog: function(id) {
      var args = Array.from(arguments);
      args.shift();
      ui.create.dialog.apply(this, args).videoId = id;
    },
    gameStart: function() {
      const connectPlayers = requireConnectPlayers();
      for (var i = 0; i < connectPlayers.length; i++) {
        connectPlayers[i].delete();
      }
      delete game.connectPlayers;
      if (ui.connectStartButton) {
        ui.connectStartButton.delete();
        delete ui.connectStartButton;
      }
      if (ui.connectStartBar) {
        ui.connectStartBar.delete();
        delete ui.connectStartBar;
      }
      if (ui.connectShareButton) {
        ui.connectShareButton.delete();
        delete ui.connectShareButton;
      }
      if (ui.roomInfo) {
        ui.roomInfo.remove();
        delete ui.roomInfo;
      }
      if (ui.exitroom) {
        ui.exitroom.remove();
        delete ui.exitroom;
      }
      ui.auto.show();
      ui.pause.show();
      if (lib.config.show_cardpile) {
        ui.cardPileButton.style.display = "";
      }
      if (lib.config.show_commonCardpile) {
        if (ui.commonCardPileButton) {
          ui.commonCardPileButton.style.display = "";
        }
      }
      _status.gameStarted = true;
      game.showHistory();
    },
    updateWaiting: function(map) {
      if (!game.connectPlayers) {
        return;
      }
      if (!lib.translate.zhu) {
        lib.translate.zhu = "主";
      }
      game.onlinezhu = false;
      _status.waitingForPlayer = true;
      for (var i = 0; i < map.length; i++) {
        if (map[i] == "disabled") {
          game.connectPlayers[i].classList.add("unselectable2");
        } else {
          game.connectPlayers[i].classList.remove("unselectable2");
          if (map[i]) {
            game.connectPlayers[i].initOL(map[i][0], map[i][1]);
            game.connectPlayers[i].playerid = map[i][2];
            if (map[i][3] == "zhu") {
              game.connectPlayers[i].setIdentity("zhu");
              if (map[i][2] == game.onlineID) {
                game.onlinezhu = true;
                if (ui.roomInfo) {
                  ui.roomInfo.innerHTML = "房间设置";
                }
                if (ui.connectStartButton) {
                  ui.connectStartButton.innerHTML = "开始游戏";
                }
              }
            } else {
              const identityLabel = game.connectPlayers[i].node.identity.firstChild;
              if (!(identityLabel instanceof HTMLElement)) {
                throw new TypeError("The player identity node requires its label");
              }
              identityLabel.innerHTML = "";
            }
          } else {
            game.connectPlayers[i].uninitOL();
            delete game.connectPlayers[i].playerid;
          }
        }
      }
    }
  };
}
export {
  createMessageClientInitialization
};
