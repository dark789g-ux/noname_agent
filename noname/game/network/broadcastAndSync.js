import "../../../noname.js";
import "../../util/sandbox.js";
import { game } from "../index.js";
import { get } from "../../get/binding.js";
import { _status } from "../../status/index.js";
import { security } from "../../util/sandbox/security.js";
import { lib } from "../../library/index.js";
import { ui } from "../../ui/index.js";
const broadcastAndSyncMethods = {
  randomMapOL(type) {
    const node = lib.requireNodeServer();
    if (type == "hidden") {
      ui.arena.classList.add("playerhidden");
    }
    game.prepareArena();
    const list = [];
    for (let i = 0; i < game.players.length; i++) {
      if (game.players[i] != game.me) {
        list.push(game.players[i]);
      }
    }
    const map = [];
    for (let i = 0; i < node.clients.length; i++) {
      if (!list.length) {
        break;
      }
      const current = list.randomRemove();
      if (!current) break;
      const client = node.clients[i];
      current.ws = client;
      current.playerid = client.id;
      current.nickname = client.nickname;
      current.setNickname();
    }
    game.getMe().playerid = get.id();
    game.getMe().nickname = get.connectNickname();
    game.getMe().setNickname();
    for (let i = 0; i < game.players.length; i++) {
      const player = game.players[i];
      if (!player.playerid) {
        player.playerid = get.id();
      }
      const playerid = player.playerid;
      if (typeof playerid !== "string") {
        continue;
      }
      map.push([playerid, player.nickname]);
      lib.playerOL[playerid] = player;
    }
    game.broadcast(
      function(map2, config, hidden) {
        if (hidden) {
          ui.arena.classList.add("playerhidden");
        }
        lib.configOL = config;
        ui.create.players();
        ui.create.me();
        const onlineID = game.onlineID;
        if (typeof onlineID === "string") {
          game.getMe().playerid = onlineID;
        }
        game.getMe().nickname = get.connectNickname();
        for (let i = 0; i < map2.length; i++) {
          if (map2[i][0] == game.getMe().playerid) {
            map2 = map2.concat(map2.splice(0, i));
            break;
          }
        }
        for (let i = 0; i < game.players.length; i++) {
          const player = game.players[i];
          player.playerid = map2[i][0];
          player.nickname = map2[i][1];
          player.setNickname();
          const playerid = player.playerid;
          if (typeof playerid === "string") {
            lib.playerOL[playerid] = player;
          }
        }
        _status.mode = lib.configOL[lib.configOL.mode + "_mode"];
      },
      map,
      lib.configOL,
      type == "hidden"
    );
    _status.mode = lib.configOL[lib.configOL.mode + "_mode"];
    return game.chooseCharacterOL();
  },
  closeMenu() {
    if (ui.menuContainer && !ui.menuContainer.classList.contains("hidden")) {
      ui.click.configMenu();
    }
  },
  closeConnectMenu() {
    if (ui.connectMenuContainer && !ui.connectMenuContainer.classList.contains("hidden")) {
      ui.click.connectMenu?.();
    }
  },
  closePopped() {
    if (ui.currentpopped) {
      if (ui.currentpopped._uiintro) {
        ui.currentpopped._uiintro.delete();
        delete ui.currentpopped._uiintro;
      }
      delete ui.currentpopped;
    }
  },
  /**
   * 向所有联机客户端广播并执行指定函数。
   *
   * 注意：`func`函数体内不能引用函数块外的作用域（如外层局部变量或闭包变量），
   * 否则客户端无法找到对应变量；需要的数据应通过`args`显式传入。
   */
  broadcast(func, ...args) {
    const node = lib.getNodeServer();
    if (!node || game.online) {
      return;
    }
    for (const client of node.clients) {
      if (client.inited) {
        if (typeof func == "string") {
          client.send(func, ...args);
        } else {
          client.send(func, ...args);
        }
      }
    }
  },
  syncState() {
    let state = null;
    if (game.getState) {
      state = game.getState();
    }
    game.broadcast(
      function(state2, current, number) {
        if (game.updateState && state2) {
          game.updateState(state2);
        }
        _status.currentPhase = current;
        game.phaseNumber = number;
      },
      state,
      _status.currentPhase,
      game.phaseNumber
    );
  },
  updateWaiting() {
    if (!game.connectPlayers) return;
    const map = [];
    for (let i = 0; i < game.connectPlayers.length; i++) {
      const player = game.connectPlayers[i];
      const playerid = player.playerid;
      if (typeof playerid === "string") {
        const avatar = player.avatar;
        if (!game.onlinezhu) {
          game.onlinezhu = playerid;
          game.send("server", "changeAvatar", player.nickname, avatar);
          _status.onlinenickname = player.nickname;
          _status.onlineavatar = avatar;
        }
        const waiting = [player.nickname, avatar, playerid];
        map[i] = waiting;
        if (playerid == game.onlinezhu) {
          waiting.push("zhu");
        }
      } else if (player.classList.contains("unselectable2")) {
        map[i] = "disabled";
      } else {
        map[i] = null;
      }
    }
    game.broadcast("updateWaiting", map);
  },
  waitForPlayer(func) {
    const next = game.createEvent("waitForPlayer", false);
    next.func = func;
    next.setContent("waitForPlayer");
    return next;
  },
  countDown(time, onEnd) {
    time = parseInt(time);
    if (!time || time <= 0) {
      return;
    }
    let current = time;
    ui.timer.set(current, 1);
    _status.countDown = setInterval(function() {
      if (--current) {
        ui.timer.set(current, current / time);
      } else {
        ui.timer.set(0, 0);
        clearInterval(_status.countDown);
        delete _status.countDown;
        if (onEnd) {
          onEnd();
        }
      }
    }, 1e3);
  },
  countChoose(clear) {
    if (_status.imchoosing) {
      return;
    }
    _status.imchoosing = true;
    let num;
    const info = _status.event?.player?.forceCountChoose;
    if (_status.connectMode && !_status.countDown) {
      ui.timer.show();
      if (_status.event?.name == "chooseToUse" && _status.event.type == "phase" && typeof info?.phaseUse == "number") {
        num = info.phaseUse;
      } else if (typeof info?.[_status.event.name] == "number") {
        num = info[_status.event.name];
      } else if (typeof info?.default == "number") {
        num = info.default;
      } else if (_status.connectMode) {
        num = lib.configOL.choose_timeout;
      } else {
        num = get.config("choose_timeout");
      }
      game.countDown(parseInt(num), () => {
        ui.click.auto();
        ui.timer.hide();
      });
      if (!game.online && game.me) {
        if (_status.event.getParent().skillHidden) {
          for (let i = 0; i < game.players.length; i++) {
            game.players[i].showTimer();
          }
          game.me._hide_all_timer = true;
        } else if (!_status.event._global_waiting) {
          game.me.showTimer();
        }
      }
    } else if (info && _status.event.isMine() && !_status.countDown) {
      if (_status.event.name == "chooseToUse" && _status.event.type == "phase" && typeof info.phaseUse == "number") {
        num = info.phaseUse;
      } else if (typeof info[_status.event.name] == "number") {
        num = info[_status.event.name];
      } else if (info.default) {
        num = info.default;
      } else {
        return;
      }
      const finish = function() {
        if (_status.event.endButton) {
          if (_status.event.skill) {
            ui.click.cancel();
          }
          ui.click.cancel();
        } else {
          if (ui.confirm && ui.confirm.str) {
            if (ui.confirm.str.includes("c")) {
              ui.click.cancel();
            } else if (ui.confirm.str.includes("o")) {
              ui.click.ok();
            }
          } else if (["chooseControl", "chooseBool"].includes(_status.event.name) && _status.paused) {
            _status.event.result = "ai";
            game.resume();
          } else {
            ui.click.auto("forced");
            setTimeout(() => {
              ui.click.auto("forced");
            }, 200);
          }
        }
        ui.timer.hide();
      };
      if (!num) {
        ui.timer.hide();
        game.uncheck();
        setTimeout(finish, 200);
      } else {
        ui.timer.show();
        game.countDown(num, finish);
      }
    }
  },
  stopCountChoose() {
    if (_status.countDown) {
      clearInterval(_status.countDown);
      delete _status.countDown;
      ui.timer.hide();
    }
    if (_status.connectMode && !game.online && game.me) {
      if (game.me._hide_all_timer) {
        delete game.me._hide_all_timer;
        for (let i = 0; i < game.players.length; i++) {
          game.players[i].hideTimer();
        }
      } else if (!_status.event._global_waiting) {
        game.me.hideTimer();
      }
    }
  },
  /**
   * 进入沙盒运行模式
   */
  requireSandboxOn(ip = "") {
    security.requireSandboxOn(ip);
  },
  connect(ip, callback) {
    if (game.online || typeof ip !== "string" || !ip?.length) {
      return;
    }
    let tempUrl;
    if (URL.canParse(ip) && (ip.startsWith("ws://") || ip.startsWith("wss://"))) {
      tempUrl = new URL(ip);
    } else {
      const protocol = get.config("wss_mode", "connect") ? "wss://" : "ws://";
      const tempHref = `${protocol}${ip}`;
      tempUrl = new URL(tempHref);
      const ipv4Regex = /^(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
      if (ipv4Regex.test(ip) || ipv6Regex.test(ip)) {
        tempUrl.port = "8080";
      } else if (tempUrl.pathname == "/") {
        let withport = false;
        const index = ip.lastIndexOf(":");
        if (index != -1) {
          const parsedPort = parseFloat(ip.slice(index + 1));
          if (parsedPort && Math.floor(parsedPort) == parsedPort) {
            withport = true;
          }
        }
        if (!withport) {
          tempUrl.port = "8080";
        }
      }
    }
    const url = tempUrl.href;
    _status.connectCallback = callback;
    try {
      if (game.ws) {
        game.ws._nocallback = true;
        game.ws.close();
        delete game.ws;
      }
      game.ws = new WebSocket(url);
    } catch {
      alert("错误：无效联机地址");
      if (callback) {
        callback(false);
      }
      return;
    }
    game.sandbox = security.createSandbox(ip);
    game.ws.onopen = lib.element.ws.onopen;
    game.ws.onmessage = lib.element.ws.onmessage;
    game.ws.onerror = lib.element.ws.onerror;
    game.ws.onclose = lib.element.ws.onclose;
    _status.ip = ip;
  },
  send(...args) {
    if (game.observe && args[0] != "reinited") {
      return;
    }
    if (game.ws) {
      if (typeof args[0] == "function") {
        args.unshift("exec");
      }
      game.ws.send(JSON.stringify(get.stringifiedResult(args)));
    }
  }
};
export {
  broadcastAndSyncMethods
};
