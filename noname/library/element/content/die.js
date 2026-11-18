import "../../../../noname.js";
import { requireRegisteredSkill } from "../../skillRegistry.js";
import { game } from "../../../game/index.js";
import { ui } from "../../../ui/index.js";
import { _status } from "../../../status/index.js";
import { lib } from "../../index.js";
import { get } from "../../../get/binding.js";
const dieContent = {
  die: [
    async (event, trigger, player) => {
      const { reason, source } = event;
      event.forceDie = true;
      if (_status.roundStart == player && !event.reserveOut) {
        _status.roundStart = player.next || player.getNext() || game.players[0];
      }
      if (ui.land && ui.land.player == player) {
        game.addVideo("destroyLand");
        ui.land.destroy();
      }
      let unseen = false;
      if (player.classList.contains("unseen")) {
        player.classList.remove("unseen");
        unseen = true;
      }
      const logvid = game.logv(player, "die", source || void 0);
      event.logvid = logvid?.logvid;
      if (unseen) {
        player.classList.add("unseen");
      }
      if (source) {
        game.log(player, "被", source, "杀害");
        const stat = source.stat[source.stat.length - 1];
        if (stat) {
          if (stat.kill == void 0) {
            stat.kill = 1;
          } else {
            stat.kill++;
          }
        }
      } else {
        game.log(player, "阵亡");
      }
      game.broadcastAll((player2) => {
        player2.classList.add("dead");
        player2.removeLink();
        player2.classList.remove("turnedover");
        player2.classList.remove("out");
        player2.node.count.innerHTML = "0";
        player2.node.hp.hide();
        player2.node.equips.hide();
        player2.node.count.hide();
        player2.previous.next = player2.next;
        player2.next.previous = player2.previous;
        game.players.remove(player2);
        game.dead.push(player2);
        _status.dying.remove(player2);
      }, player);
      if (!event.noDieAudio) {
        game.tryDieAudio(player);
      }
      if (!event.reserveOut) {
        game.addVideo("diex", player);
        if (event.animate !== false) {
          player.$die();
        }
      }
      if (player.hp != 0) {
        await player.changeHp(0 - Number(player.hp), false).set("forceDie", true);
      }
    },
    async (event, trigger, player) => {
      const { source } = event;
      if (player.dieAfter && !event.reserveOut && !event.noDieAfter) {
        await player.dieAfter(source);
      }
    },
    async (event, trigger, player) => {
      game.callHook("checkDie", [event, player]);
      await event.trigger("die");
    },
    async (event, trigger, player) => {
      const { reason, source } = event;
      if (player.isDead()) {
        if (!game.reserveDead) {
          const exclude = event.excludeMark;
          for (const mark in player.marks) {
            if (exclude.includes(mark)) {
              continue;
            }
            player.unmarkSkill(mark);
          }
          let count = 1;
          const list = Array.from(player.node.marks.childNodes);
          count += exclude.filter((name) => list.some((i) => "name" in i && i.name == name)).length;
          const func = (player2, count2, exclude2) => {
            while (player2.node.marks.childNodes.length > count2) {
              let node = player2.node.marks.lastChild;
              if (exclude2.includes(node.name)) {
                node = node.previousSibling;
              }
              node.remove();
            }
          };
          func(player, count, exclude);
          game.broadcast(
            (func2, player2, count2, exclude2) => {
              func2(player2, count2, exclude2);
            },
            func,
            player,
            count,
            exclude
          );
          player.removeTip();
        }
        for (const i in player.tempSkills) {
          player.removeSkill(i);
        }
        const skills = player.getSkills();
        for (const skill of skills) {
          if (requireRegisteredSkill(lib.skill, skill).temp) {
            player.removeSkill(skill);
          }
        }
        if (_status.characterlist && !event.reserveOut) {
          if (lib.character[String(player.name)]) {
            const name = player.name;
            if (name === void 0) throw new TypeError("Returning a character requires an initialized name");
            if (!name.startsWith("gz_shibing") && !name.startsWith("gz_jun_")) _status.characterlist.add(player.name);
          }
          if (lib.character[String(player.name1)]) {
            const name1 = player.name1;
            if (name1 === void 0) throw new TypeError("Returning a character requires an initialized primary name");
            if (!name1.startsWith("gz_shibing") && !name1.startsWith("gz_jun_")) _status.characterlist.add(player.name1);
          }
          const name2 = player.name2;
          if (name2 && lib.character[name2] && !name2.startsWith("gz_shibing") && !name2.startsWith("gz_jun_")) {
            _status.characterlist.add(name2);
          }
        }
        event.cards = player.getCards("hejsx");
        if (event.cards.length) {
          await player.discard(event.cards).set("forceDie", true);
        }
      }
    },
    async (event, trigger, player) => {
      const { source } = event;
      if (player.dieAfter2 && !event.reserveOut && !event.noDieAfter2) {
        await player.dieAfter2(source);
      }
    },
    async (event, trigger, player) => {
      const { reason, source } = event;
      if (!event.reserveOut) {
        game.broadcastAll((player2) => {
          if (game.online && player2 == game.me && !_status.over && !game.controlOver && !ui.exit) {
            if (lib.mode[lib.configOL.mode].config.dierestart) {
              ui.create.exit();
            }
          }
        }, player);
        if (!_status.connectMode && player == game.me && !_status.over && !game.controlOver) {
          ui.control.show();
          if (get.config("revive") && lib.mode[lib.config.mode].config.revive && !ui.revive) {
            ui.revive = ui.create.control("revive", ui.click.dierevive);
          }
          if (get.config("continue_game") && !ui.continue_game && lib.mode[lib.config.mode].config.continue_game && !_status.brawl && !game.no_continue_game) {
            ui.continue_game = ui.create.control("再战", game.reloadCurrent);
          }
          if (get.config("dierestart") && lib.mode[lib.config.mode].config.dierestart && !ui.restart) {
            ui.restart = ui.create.control("restart", game.reload);
          }
        }
        if (!_status.connectMode && player == game.me && !game.modeSwapPlayer) {
          if (ui.auto) {
            ui.auto.hide();
          }
          if (ui.wuxie) {
            ui.wuxie.hide();
          }
        }
        if (typeof _status.coin == "number" && source && !_status.auto) {
          if (source == game.me || source.isUnderControl()) {
            _status.coin += 10;
          }
        }
      }
      if (source && lib.config.border_style == "auto" && (lib.config.autoborder_count == "kill" || lib.config.autoborder_count == "mix")) {
        switch (source.node.framebg.dataset.auto) {
          case "gold":
          case "silver":
            source.node.framebg.dataset.auto = "gold";
            break;
          case "bronze":
            source.node.framebg.dataset.auto = "silver";
            break;
          default:
            source.node.framebg.dataset.auto = lib.config.autoborder_start || "bronze";
        }
        if (lib.config.autoborder_count == "kill") {
          source.node.framebg.dataset.decoration = source.node.framebg.dataset.auto;
        } else {
          let dnum = 0;
          for (const stat of source.stat) {
            if (stat.damage != void 0) {
              dnum += stat.damage;
            }
          }
          source.node.framebg.dataset.decoration = "";
          switch (source.node.framebg.dataset.auto) {
            case "bronze":
              if (dnum >= 4) {
                source.node.framebg.dataset.decoration = "bronze";
              }
              break;
            case "silver":
              if (dnum >= 8) {
                source.node.framebg.dataset.decoration = "silver";
              }
              break;
            case "gold":
              if (dnum >= 12) {
                source.node.framebg.dataset.decoration = "gold";
              }
              break;
          }
        }
        source.classList.add("topcount");
      }
    }
  ],
  //进入休整状态
  async rest(event, trigger, player) {
    const { type = "phase", count = -1 } = event.restMap;
    const playerid = player.playerid;
    if (typeof playerid !== "string" || _status._rest_return?.[playerid]) {
      return;
    }
    game.log(player, "进入了修整状态");
    player.classList.remove("dead");
    game.dead.remove(player);
    game.players.add(player);
    game.arrangePlayers();
    game.broadcastAll(
      (id, type2, count2) => {
        if (typeof id !== "string") {
          return;
        }
        _status._rest_return ??= {};
        _status._rest_return[id] = {
          type: type2,
          count: count2
        };
      },
      playerid,
      type,
      count
    );
    player.markSkill("_rest_return");
    game.log(player, "移出了游戏");
    game.broadcastAll((player2) => {
      player2.classList.add("out");
    }, player);
    player.addSkill("undist");
    await event.trigger("rest");
  },
  //结束休整状态
  async restEnd(event, trigger, player) {
    const { hp = player.maxHp } = event.restEndMap;
    const playerid = player.playerid;
    if (typeof playerid !== "string" || !_status._rest_return?.[playerid]) {
      return;
    }
    game.log(player, "结束了休整");
    game.broadcastAll((id) => {
      if (typeof id === "string" && _status._rest_return) {
        delete _status._rest_return[id];
      }
    }, playerid);
    player.unmarkSkill("_rest_return");
    game.log(player, "移回了游戏");
    game.broadcastAll((player2) => {
      player2.classList.remove("out");
    }, player);
    player.removeSkill("undist");
    await player.reviveEvent(hp, false);
    await event.trigger("restEnd");
  },
  //复活事件
  async revive(event, trigger, player) {
    const { hp, log } = event;
    if (log !== false) {
      game.log(player, "复活");
    }
    game.broadcastAll(
      (player2, hp2) => {
        if (Number(player2.maxHp) < 1) {
          player2.maxHp = 1;
        }
        player2.hp = hp2;
        game.addVideo("revive", player2);
        player2.classList.remove("dead");
        player2.removeAttribute("style");
        player2.node.avatar.style.transform = "";
        player2.node.avatar2.style.transform = "";
        player2.node.hp.show();
        player2.node.equips.show();
        player2.node.count.show();
        player2.update();
        let playerx;
        playerx = player2.previousSeat;
        while (playerx.isDead()) {
          playerx = playerx.previousSeat;
        }
        playerx.next = player2;
        player2.previous = playerx;
        playerx = player2.nextSeat;
        while (playerx.isDead()) {
          playerx = playerx.nextSeat;
        }
        playerx.previous = player2;
        player2.next = playerx;
        game.players.add(player2);
        game.dead.remove(player2);
        if (player2 == game.me) {
          if (ui.auto) {
            ui.auto.show();
          }
          if (ui.wuxie) {
            ui.wuxie.show();
          }
          if (ui.revive) {
            ui.revive.close();
            delete ui.revive;
          }
          if (ui.exit) {
            ui.exit.close();
            delete ui.exit;
          }
          if (ui.swap) {
            ui.swap.close();
            delete ui.swap;
          }
          if (ui.restart) {
            ui.restart.close();
            delete ui.restart;
          }
          if (ui.continue_game) {
            ui.continue_game.close();
            delete ui.continue_game;
          }
          if (player2.node.dieidentity) {
            player2.node.dieidentity.delete();
            delete player2.node.dieidentity;
          }
        }
      },
      player,
      hp
    );
  }
};
export {
  dieContent
};
