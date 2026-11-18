import "../../../noname.js";
import { game } from "../index.js";
import { renderGameOverTable, saveGameOverVideo } from "./overStatsAndVideo.js";
import { _status } from "../../status/index.js";
import { lib } from "../../library/index.js";
import { get } from "../../get/binding.js";
import { ui } from "../../ui/index.js";
function handleGameOverRewardsAndLadder(dialog, result) {
  if (typeof _status.coin == "number" && !_status.connectMode) {
    let coeff = Math.random() * 0.4 + 0.8;
    let added = 0;
    let betWin = false;
    if (result == "战斗胜利") {
      if (_status.betWin) {
        betWin = true;
        _status.coin += 10;
      }
      _status.coin += 20;
      if (_status.additionalReward) {
        _status.coin += _status.additionalReward();
      }
      switch (lib.config.mode) {
        case "identity": {
          switch (game.getMe().identity) {
            case "zhu":
            case "zhong":
            case "mingzhong":
              added = get.config("enhance_zhu") ? 10 : 20;
              break;
            case "fan":
              added = get.config("enhance_zhu") ? 16 : 8;
              break;
            case "nei":
              added = 40;
              break;
          }
          added = added * (game.players.length + game.dead.length) / 8;
          break;
        }
        case "guozhan":
          added = game.getMe().identity == "ye" ? 8 : 5 / get.totalPopulation(game.getMe().identity);
          added = added * (game.players.length + game.dead.length);
          break;
        case "versus":
          if (_status.friend) {
            added = 5 * (game.players.length + _status.friend.length);
          }
          break;
        default:
          added = 10;
      }
    } else {
      added = 10;
    }
    if (lib.config.mode == "chess" && _status.mode == "combat" && get.config("additional_player")) {
      added = 2;
    }
    _status.coin += added * coeff;
    if (_status.coinCoeff) {
      _status.coin *= _status.coinCoeff;
    }
    _status.coin = Math.ceil(_status.coin);
    dialog.add(ui.create.div("", "获得" + _status.coin + "金"));
    if (betWin) {
      if (game.changeCoin) {
        game.changeCoin(20);
      }
      dialog.content.appendChild(document.createElement("br"));
      dialog.add(ui.create.div("", "（下注赢得10金）"));
    }
    if (game.changeCoin) {
      game.changeCoin(_status.coin);
    }
  }
  if (get.mode() == "versus" && _status.ladder) {
    const ladder = lib.storage.ladder;
    let mmr = _status.ladder_mmr;
    mmr += 10 - get.rank(game.getMe().name, true) * 2;
    if (result == "战斗胜利") {
      mmr = 20 + Math.round(mmr);
      if (mmr > 40) mmr = 40;
      else if (mmr < 10) mmr = 10;
      dialog.add(ui.create.div("", "获得 " + mmr + " 积分"));
    } else {
      mmr = -30 + Math.round(mmr / 2);
      if (mmr > -20) mmr = -20;
      else if (mmr < -35) mmr = -35;
      if (ladder.current < 900) mmr = Math.round(mmr / 4);
      else if (ladder.current < 1400) mmr = Math.round(mmr / 2);
      else if (ladder.current < 2e3) mmr = Math.round(mmr / 1.5);
      else if (ladder.current > 2500) mmr = Math.round(mmr * 1.5);
      dialog.add(ui.create.div("", "失去 " + -mmr + " 积分"));
    }
    if (_status.ladder_tmp) {
      ladder.current += 40;
      delete _status.ladder_tmp;
    }
    ladder.current += mmr;
    if (ladder.top < ladder.current) {
      ladder.top = ladder.current;
    }
    game.save("ladder", ladder);
    if (ui.ladder && game.getLadderName) {
      ui.ladder.innerHTML = game.getLadderName(ladder.current);
    }
  }
}
const overMethods = {
  over(result, bool) {
    if (_status.over) {
      return;
    }
    const trueMe = game.getMe()._trueMe;
    if (trueMe) {
      game.swapPlayer(trueMe);
    }
    const hsMap = /* @__PURE__ */ new Map([]);
    for (const target of [...game.players, ...game.dead]) {
      hsMap.set(target, target.getCards("h"));
    }
    _status.over = true;
    ui.control.show();
    ui.clear();
    game.stopCountChoose();
    if (ui.time3) {
      clearInterval(ui.time3.interval);
    }
    if ((game.layout == "long2" || game.layout == "nova") && !game.chess) {
      ui.arena.classList.add("choose-character");
      ui.me.hide();
      ui.mebg.hide();
      ui.autonode.hide();
      if (lib.config.radius_size != "off") {
        ui.historybar.style.borderRadius = "0 0 0 4px";
      }
    }
    if (game.online) {
      const dialog2 = ui.create.dialog();
      dialog2.noforcebutton = true;
      dialog2.content.innerHTML = String(result);
      dialog2.forcebutton = true;
      const result2 = bool;
      const resultText = dialog2.content.firstElementChild;
      if (result2 == true) {
        if (resultText instanceof HTMLDivElement) {
          resultText.innerHTML = "战斗胜利";
        }
      } else if (result2 == false) {
        if (resultText instanceof HTMLDivElement) {
          resultText.innerHTML = "战斗失败";
        }
      }
      ui.update();
      dialog2.add(ui.create.div(".placeholder"));
      dialog2.add(ui.create.div(".placeholder.slim"));
      if (lib.config.background_audio) {
        if (result2 === true) game.playAudio("effect", "win");
        else if (result2 === false) game.playAudio("effect", "lose");
        else game.playAudio("effect", "tie");
      }
      if (!ui.exit) ui.create.exit();
      if (ui.giveup) {
        ui.giveup.remove();
        delete ui.giveup;
      }
      if (game.servermode) {
        if (!ui.exit) return;
        const exitText = ui.exit.firstElementChild;
        if (exitText instanceof HTMLDivElement) {
          exitText.innerHTML = "返回房间";
        }
        setTimeout(function() {
          if (exitText instanceof HTMLDivElement) {
            exitText.innerHTML = "退出房间";
          }
          _status.roomtimeout = true;
          lib.config.reconnect_info[2] = null;
          game.saveConfig("reconnect_info", lib.config.reconnect_info);
        }, 1e4);
      }
      if (ui.tempnowuxie) {
        ui.tempnowuxie.close();
        delete ui.tempnowuxie;
      }
      if (ui.auto) ui.auto.hide();
      if (ui.wuxie) ui.wuxie.hide();
      if (game.getIdentityList) {
        for (let i = 0; i < game.players.length; i++) {
          game.players[i].setIdentity();
        }
      }
      return;
    }
    if (lib.config.background_audio) {
      if (result === true) game.playAudio("effect", "win");
      else if (result === false) game.playAudio("effect", "lose");
      else game.playAudio("effect", "tie");
    }
    const resultbool = typeof result === "boolean" ? result : null;
    if (result === true) result = "战斗胜利";
    if (result === false) result = "战斗失败";
    if (result == void 0) result = "战斗结束";
    const dialog = ui.create.dialog(result);
    dialog.noforcebutton = true;
    dialog.forcebutton = true;
    if (game.addOverDialog) {
      game.addOverDialog(dialog, result);
    }
    handleGameOverRewardsAndLadder(dialog, result);
    renderGameOverTable(dialog, hsMap);
    dialog.add(ui.create.div(".placeholder"));
    const clients = game.players.concat(game.dead);
    for (let i = 0; i < clients.length; i++) {
      if (clients[i].isOnline2()) {
        clients[i].send(game.over, dialog.content.innerHTML, game.checkOnlineResult(clients[i]));
      }
    }
    dialog.add(ui.create.div(".placeholder"));
    dialog.add(ui.create.div(".placeholder.slim"));
    game.addVideo("over", null, dialog.content.innerHTML);
    if (!saveGameOverVideo(result)) {
      return;
    }
    if (ui.auto) ui.auto.hide();
    if (ui.wuxie) ui.wuxie.hide();
    if (ui.giveup) {
      ui.giveup.remove();
      delete ui.giveup;
    }
    if (lib.config.test_game && !_status.connectMode) {
      if (typeof lib.config.test_game !== "string") {
        switch (lib.config.mode) {
          case "identity":
            game.saveConfig("mode", "guozhan");
            break;
          case "guozhan":
            game.saveConfig("mode", "versus");
            break;
          case "versus":
            game.saveConfig("mode", "boss");
            break;
          case "boss":
            game.saveConfig("mode", "chess");
            break;
          case "chess":
            game.saveConfig("mode", "stone");
            break;
          case "stone":
            game.saveConfig("mode", "identity");
            break;
        }
      }
      setTimeout(game.reload, 500);
    }
    if (game.controlOver) {
      game.controlOver();
      return;
    }
    if (!_status.brawl) {
      if (lib.config.mode == "boss") {
        ui.create.control("再战", function() {
          let pointer = game.boss;
          let map = { boss: game.me == game.boss, links: [] };
          for (let iwhile = 0; iwhile < 10; iwhile++) {
            pointer = pointer.nextSeat;
            if (pointer == game.boss) break;
            if (!pointer.side) map.links.push(pointer.name);
          }
          game.saveConfig("continue_name_boss", map);
          game.saveConfig("mode", lib.config.mode);
          localStorage.setItem(lib.configprefix + "directstart", "true");
          game.reload();
        });
      } else if (lib.config.mode == "versus") {
        if (_status.mode == "standard" || _status.mode == "three") {
          ui.create.control("再战", function() {
            game.saveConfig("continue_name_versus" + (_status.mode == "three" ? "_three" : ""), {
              friend: _status.friendBackup,
              enemy: _status.enemyBackup,
              color: _status.color
            });
            game.saveConfig("mode", lib.config.mode);
            localStorage.setItem(lib.configprefix + "directstart", "true");
            game.reload();
          });
        }
      } else if (!_status.connectMode && get.config("continue_game") && !ui.continue_game && !_status.brawl && !game.no_continue_game) {
        ui.continue_game = ui.create.control("再战", game.reloadCurrent);
      }
    }
    if (!ui.restart) {
      if (game.onlineroom && typeof game.roomId == "string") {
        ui.restart = ui.create.control("restart", function() {
          game.broadcastAll(function() {
            if (ui.exit) {
              ui.exit.stay = true;
              const exitText = ui.exit.firstElementChild;
              if (exitText instanceof HTMLDivElement) {
                exitText.innerHTML = "返回房间";
              }
            }
          });
          game.saveConfig("tmp_owner_roomId", game.roomId);
          setTimeout(game.reload, 100);
        });
      } else {
        ui.restart = ui.create.control("restart", game.reload);
      }
    }
    if (ui.tempnowuxie) {
      ui.tempnowuxie.close();
      delete ui.tempnowuxie;
    }
    if (ui.revive) {
      ui.revive.close();
      delete ui.revive;
    }
    if (ui.swap) {
      ui.swap.close();
      delete ui.swap;
    }
    for (let i = 0; i < lib.onover.length; i++) {
      lib.onover[i](resultbool);
    }
    if (game.addRecord) {
      game.addRecord(resultbool);
    }
    if (_status.connectMode && !game.online) {
      setTimeout(game.reload, 15e3);
    }
  }
};
export {
  overMethods
};
