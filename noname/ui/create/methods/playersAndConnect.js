import "../../../../noname.js";
import { game } from "../../../game/index.js";
import { ui } from "../../index.js";
import { lib } from "../../../library/index.js";
import { get } from "../../../get/binding.js";
import { _status } from "../../../status/index.js";
function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.width = "1px";
  textArea.style.height = "1px";
  textArea.style.padding = "0";
  textArea.style.border = "none";
  textArea.style.outline = "none";
  textArea.style.boxShadow = "none";
  textArea.style.background = "transparent";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    const successful = document.execCommand("copy");
    if (!successful) {
      console.error("Unable to copy using execCommand");
      game.promises.prompt(`###分享内容复制失败，请自行复制以下内容###${text}`, true);
    } else {
      game.alert("分享内容复制成功");
    }
  } catch (err) {
    console.error("Unable to copy using execCommand:", err);
  }
  document.body.removeChild(textArea);
}
const playersAndConnectMethods = {
  connectRooms(list) {
    ui.rooms = [];
    ui.roombase = ui.create.dialog();
    ui.roombase.classList.add("fullwidth");
    ui.roombase.classList.add("fullheight");
    ui.roombase.classList.add("fixed");
    ui.roombase.classList.add("scroll1");
    ui.roombase.classList.add("scroll2");
    ui.roombase.classList.add("noupdate");
    for (let i = 0; i < list.length; i++) {
      const playerWithIndex = Object.assign(ui.roombase.add('<div class="popup text pointerdiv" style="width:calc(100% - 10px);display:inline-block;white-space:nowrap">空房间</div>'), {
        roomindex: i
      });
      const player = Object.assign(playerWithIndex, {
        initRoom: lib.element.Player.prototype.initRoom
      });
      player.addEventListener(lib.config.touchscreen ? "touchend" : "click", ui.click.connectroom);
      player.initRoom(list[i]);
      ui.rooms.push(player);
    }
  },
  identitycircle(list, target) {
    const container = ui.create.div(".identitycircle.menubg", target);
    const circle = ui.create.div(container);
    container.dataset.num = String(list.length);
    for (let i = 0; i < list.length; i++) {
      const sec1 = ui.create.div(circle);
      sec1.dataset.color = list[i];
      const sec2 = ui.create.div(circle);
      sec2.dataset.color = list[i];
      const deg1 = 360 / list.length * i;
      let deg2 = 0;
      if (list.length == 2) {
        deg2 = 90;
      } else if (list.length == 3) {
        deg2 = 30;
      }
      sec1.style.transform = "rotate(" + deg1 + "deg)";
      sec2.style.transform = "rotate(" + (deg1 + deg2) + "deg)";
    }
  },
  chat() {
    const chat = ui.create.system("聊天", null, true);
    ui.chatButton = chat;
    lib.setPopped(chat, ui.click.chat, 220);
  },
  exit() {
    if (!ui.exit) {
      ui.exit = ui.create.control("退出房间", ui.click.exit);
    }
  },
  connecting(bool) {
    if (bool) {
      ui.window.classList.remove("connecting");
      if (ui.connecting) {
        ui.connecting.delete();
        delete ui.connecting;
      }
    } else {
      ui.window.classList.add("connecting");
      ui.connecting = ui.create.div(".fullsize.connectlayer");
      document.body.appendChild(ui.connecting);
      ui.create.div("", "正在重连...", ui.connecting);
      ui.connecting.splashtimeout = setTimeout(function() {
        if (ui.connecting) {
          delete ui.connecting.splashtimeout;
        }
      }, 300);
    }
  },
  roomInfo() {
    const chat = ui.create.system(
      game.online ? "房间信息" : "房间设置",
      function() {
        if (!game.online || game.onlinezhu) {
          ui.click.connectMenu?.();
        }
      },
      true
    );
    ui.roomInfo = chat;
    lib.setPopped(
      chat,
      function() {
        if (game.getRoomInfo) {
          const uiintro = ui.create.dialog("hidden");
          game.getRoomInfo(uiintro);
          return uiintro;
        }
      },
      180
    );
  },
  templayer(time) {
    if (typeof time != "number" || isNaN(time) || time == Infinity) {
      time = 500;
    }
    const templayer = ui.create.div(".popup-container", ui.window);
    setTimeout(function() {
      templayer.remove();
    }, time);
  },
  giveup() {
    if (ui.giveup || !lib.config.show_giveup) {
      return;
    }
    ui.giveup = ui.create.system(
      "投降",
      function() {
        const player = game.getMe();
        this.remove();
        if (game.online) {
          game.send("giveup", player);
        } else {
          _status.event.next.length = 0;
          const next = game.createEvent("giveup", false).set("includeOut", true);
          next.setContent(function() {
            game.log(player, "投降");
            player.popup("投降");
            const dieEvent = player.die("nosource");
            dieEvent.set("_triggered", null);
            dieEvent.includeOut = true;
          });
          next.player = player;
        }
        if (_status.paused && _status.imchoosing && !_status.auto) {
          ui.click.auto();
        }
      },
      true,
      true
    );
  },
  player(position, noclick) {
    return new lib.element.Player(position).build(noclick);
  },
  connectPlayers(ip) {
    ui.updateConnectPlayerPositions();
    game.connectPlayers = [];
    const configOL = lib.configOL;
    const numberOfPlayers = parseInt(configOL.player_number) || configOL.number;
    for (let position = 0; position < numberOfPlayers; position++) {
      const player = ui.create.player(ui.window);
      player.dataset.position = String(position);
      player.classList.add("connect");
      game.connectPlayers.push(player);
    }
    const bar = ui.create.div(ui.window);
    bar.style.height = "20px";
    bar.style.width = "80%";
    bar.style.left = "10%";
    bar.style.top = "calc(200% / 7 - 120px + 5px)";
    bar.style.textAlign = "center";
    const ipbar = ui.create.div(".shadowed", ip, bar);
    ipbar.style.padding = "4px";
    ipbar.style.borderRadius = "2px";
    ipbar.style.position = "relative";
    const button = ui.create.div(".menubutton.large.highlight.connectbutton.connectbutton1.pointerdiv", game.online ? "退出联机" : "开始游戏", ui.window, function() {
      if (button.clicked) {
        return;
      }
      if (game.online) {
        if (game.onlinezhu) {
          game.send("startGame");
        } else {
          game.saveConfig("tmp_owner_roomId");
          game.saveConfig("tmp_user_roomId");
          game.saveConfig("reconnect_info");
          game.reload();
        }
      } else {
        let num = 0;
        for (const i of game.connectPlayers || []) {
          if (!i.nickname && !i.classList.contains("unselectable2")) {
            num++;
          }
        }
        if (num >= lib.configOL.number - 1) {
          alert("至少要有两名玩家才能开始游戏！");
          return;
        }
        game.resume();
      }
      button.delete();
      bar.delete();
      shareButton.delete();
      delete ui.connectStartButton;
      delete ui.connectStartBar;
      delete ui.connectShareButton;
      button.clicked = true;
    });
    const shareButton = ui.create.div(".menubutton.large.highlight.connectbutton.connectbutton2.pointerdiv", "分享房间", ui.window, function() {
      const text = `无名杀-联机-${lib.translate[get.mode()]}-${(game.connectPlayers || []).filter((p) => p.avatar).length}/${(game.connectPlayers || []).filter((p) => !p.classList.contains("unselectable2")).length}
${get.connectNickname()}邀请你加入${game.roomId}房间
联机地址:${game.ip}
请先通过游戏内菜单-开始-联机中启用“读取邀请链接”选项`;
      window.focus();
      if ("clipboard" in navigator) {
        navigator.clipboard.writeText(text).then(() => {
          game.alert("分享内容复制成功");
        }).catch(() => {
          fallbackCopyTextToClipboard(text);
        });
      } else {
        fallbackCopyTextToClipboard(text);
      }
    });
    ui.connectStartButton = button;
    ui.connectStartBar = bar;
    ui.connectShareButton = shareButton;
  },
  players(numberOfPlayers) {
    if (numberOfPlayers === 0) {
      return;
    }
    if (numberOfPlayers == void 0) {
      numberOfPlayers = lib.configOL.number;
    }
    if (numberOfPlayers == void 0) {
      numberOfPlayers = get.playerNumber();
    }
    if (typeof numberOfPlayers == "string") {
      numberOfPlayers = parseInt(numberOfPlayers);
    }
    if (!numberOfPlayers) {
      numberOfPlayers = 5;
    }
    for (let ordinal = 0; ordinal < numberOfPlayers; ordinal++) {
      const player = ui.create.player().addTempClass("start");
      game.players.push(player);
      player.dataset.position = String(ordinal);
    }
    const players = game.players;
    for (let ordinal = 0; ordinal < players.length; ordinal++) {
      if (ordinal > 0) {
        players[ordinal].previous = players[ordinal - 1];
        players[ordinal].previousSeat = players[ordinal - 1];
      }
      if (ordinal < players.length - 1) {
        players[ordinal].next = players[ordinal + 1];
        players[ordinal].nextSeat = players[ordinal + 1];
      }
    }
    players[0].previous = players[players.length - 1];
    players[0].previousSeat = players[players.length - 1];
    players[players.length - 1].next = players[0];
    players[players.length - 1].nextSeat = players[0];
    ui.arena.setNumber(numberOfPlayers);
    players.forEach((player) => ui.arena.appendChild(player));
    return players;
  },
  me(hasme) {
    ui.mebg = ui.create.div("#mebg", ui.arena);
    ui.me = ui.create.div("#me", ui.arena).addTempClass("start");
    const h1 = ui.create.div("#handcards1", ui.me);
    const h2 = ui.create.div("#handcards2", ui.me);
    ui.handcards1Container = h1;
    ui.handcards2Container = h2;
    ui.arena.classList.remove("nome");
    if (lib.config.mousewheel && !lib.config.touchscreen) {
      h1.onmousewheel = ui.click.mousewheel;
      h2.onmousewheel = ui.click.mousewheel;
    }
    h1.ontouchstart = function(e) {
      ui.click.touchStart.call(h1, e);
    };
    h2.ontouchstart = function(e) {
      ui.click.touchStart.call(h2, e);
    };
    h1.ontouchmove = function(e) {
      ui.click.touchScroll.call(h1, e);
    };
    h2.ontouchmove = function(e) {
      ui.click.touchScroll.call(h2, e);
    };
    h1.style.setProperty("-webkit-overflow-scrolling", "touch");
    h2.style.setProperty("-webkit-overflow-scrolling", "touch");
    if (hasme && game.me) {
      ui.handcards1 = game.me.node.handcards1;
      ui.handcards2 = game.me.node.handcards2;
      h1.appendChild(ui.handcards1);
      h2.appendChild(ui.handcards2);
    } else if (game.players.length) {
      game.me = game.players[0];
      ui.handcards1 = game.me.node.handcards1;
      ui.handcards2 = game.me.node.handcards2;
      h1.appendChild(ui.handcards1);
      h2.appendChild(ui.handcards2);
    }
  }
};
export {
  playersAndConnectMethods
};
