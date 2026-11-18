import "../../../../../noname.js";
import { _status } from "../../../../status/index.js";
import { game } from "../../../../game/index.js";
import { lib } from "../../../index.js";
import { ui } from "../../../../ui/index.js";
import { get } from "../../../../get/binding.js";
const waitAndTimerMethods = {
  wait(callback) {
    if (lib.node) {
      const playerid = this.playerid;
      if (typeof playerid !== "string") return;
      const node = lib.requireNodeServer();
      if (typeof callback == "function") {
        callback._noname_waiting = true;
        node.torespond[playerid] = callback;
      } else {
        node.torespond[playerid] = "_noname_waiting";
      }
      clearTimeout(node.torespondtimeout[playerid]);
      const socket = this.ws;
      if (socket && !socket.closed) {
        const player = this;
        const time = parseInt(lib.configOL.choose_timeout) * 1e3;
        if (_status.event._global_timer || _status.event.getParent().skillHidden) {
          for (let i = 0; i < game.players.length; i++) {
            game.players[i].showTimer(time);
          }
          player._hide_all_timer = true;
        } else if (!_status.event._global_waiting && _status.noclearcountdown !== "direct") {
          player.showTimer(time);
        }
        node.torespondtimeout[playerid] = setTimeout(function() {
          player.unwait("ai");
          const currentSocket = player.ws;
          if (!currentSocket) {
            throw new TypeError("联机等待生命周期错误：玩家连接未初始化");
          }
          currentSocket.ws.close();
        }, time + 5e3);
      }
    }
  },
  unwait(result) {
    if (this._hide_all_timer) {
      delete this._hide_all_timer;
      for (let i = 0; i < game.players.length; i++) {
        game.players[i].hideTimer();
      }
    } else if (!get.event()._global_waiting && (_status.noclearcountdown !== "direct" || result && result.bool) && !(result && result._noHidingTimer)) {
      this.hideTimer();
    }
    const playerid = this.playerid;
    if (typeof playerid !== "string") return;
    const node = lib.requireNodeServer();
    clearTimeout(node.torespondtimeout[playerid]);
    delete node.torespondtimeout[playerid];
    if (!(playerid in node.torespond)) {
      return;
    }
    let noresume = false;
    let proceed = void 0;
    const entry = node.torespond[playerid];
    if (typeof entry == "function" && entry._noname_waiting) {
      proceed = entry(result, this);
      if (proceed === false) {
        noresume = true;
      }
    }
    node.torespond[playerid] = result;
    for (const i in node.torespond) {
      const responder = node.torespond[i];
      if (responder == "_noname_waiting") {
        return;
      } else if (responder && typeof responder == "function" && responder._noname_waiting) {
        return;
      }
    }
    _status.event.result = result;
    _status.event.resultOL = node.torespond;
    node.torespond = {};
    if (typeof proceed == "function") {
      proceed();
    } else if (_status.paused && !noresume) {
      game.resume();
    }
    if (node.waitForResult[playerid]?.length > 0) {
      const current = node.waitForResult[playerid].pop();
      current?.(result);
    }
  },
  tempUnwait(result) {
    const playerid = this.playerid;
    if (typeof playerid !== "string") return;
    const node = lib.requireNodeServer();
    if (!(playerid in node.torespond)) {
      return;
    }
    let proceed = void 0;
    const entry = node.torespond[playerid];
    if (typeof entry == "function" && entry._noname_waiting) {
      proceed = entry(result, this);
    }
    if (typeof proceed == "function") {
      proceed();
    }
  },
  showTimer(time) {
    if (!time && lib.configOL) {
      time = parseInt(lib.configOL.choose_timeout) * 1e3;
    }
    if (_status.connectMode && !game.online) {
      game.broadcast(
        function(player, time2) {
          player.showTimer(time2);
        },
        this,
        time
      );
    }
    if (this == game.me) {
      return;
    }
    if (this.node.timer) {
      this.node.timer.remove();
    }
    const timer = ui.create.div(".timerbar", this);
    this.node.timer = timer;
    ui.create.div(this.node.timer);
    const bar = ui.create.div(this.node.timer);
    ui.refresh(bar);
    bar.style.transitionDuration = time / 1e3 + "s";
    bar.style.transform = "scale(0,1)";
  },
  hideTimer() {
    if (_status.connectMode && !game.online && this.playerid) {
      game.broadcast(function(player) {
        player.hideTimer();
      }, this);
    }
    if (this.node.timer) {
      this.node.timer.delete();
      delete this.node.timer;
    }
  }
};
export {
  waitAndTimerMethods
};
