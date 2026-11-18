import "../../../noname.js";
import { game } from "../index.js";
import { get } from "../../get/binding.js";
import { lib } from "../../library/index.js";
import { ui } from "../../ui/index.js";
import { _status } from "../../status/index.js";
const seatAndSwapMethods = {
  swapSeat(player1, player2, prompt, behind, noanimate) {
    if (noanimate) {
      player1.style.transition = "all 0s";
      player2.style.transition = "all 0s";
      ui.refresh(player1);
      ui.refresh(player2);
    }
    if (behind) {
      const totalPopulation = game.players.length + game.dead.length + 1;
      for (let iwhile = 0; iwhile < totalPopulation; iwhile++) {
        if (player1.next != player2) {
          game.swapSeat(player1, player1.next, false, false);
        } else {
          break;
        }
      }
      if (prompt != false) {
        game.log(player1, "将座位移至", player2, "前");
      }
    } else {
      game.addVideo("swapSeat", null, [player1.dataset.position, player2.dataset.position]);
      const seat1 = player1.seatNum;
      const seat2 = player2.seatNum;
      player2.seatNum = seat1;
      player1.seatNum = seat2;
      let temp1 = player1.dataset.position;
      player1.dataset.position = player2.dataset.position;
      player2.dataset.position = temp1;
      game.arrangePlayers();
      if (!game.chess) {
        if (player1.dataset.position == "0" || player2.dataset.position == "0") {
          let pos = parseInt(String(player1.dataset.position));
          if (pos == 0) {
            pos = parseInt(String(player2.dataset.position));
          }
          const num = game.players.length + game.dead.length;
          for (let i = 0; i < game.players.length; i++) {
            temp1 = parseInt(String(game.players[i].dataset.position)) - pos;
            if (temp1 < 0) temp1 += num;
            game.players[i].dataset.position = String(temp1);
          }
          for (let i = 0; i < game.dead.length; i++) {
            temp1 = parseInt(String(game.dead[i].dataset.position)) - pos;
            if (temp1 < 0) temp1 += num;
            game.dead[i].dataset.position = String(temp1);
          }
        }
      }
      if (prompt != false) {
        game.log(player1, "和", player2, "交换了座位");
      }
    }
    if (noanimate) {
      setTimeout(() => {
        player1.style.transition = "";
        player2.style.transition = "";
      }, 200);
    }
  },
  swapPlayer(player, player2, options) {
    const animate = Boolean(options?.animate);
    const preserveIdentity = Boolean(options?.preserveIdentity);
    const players = game.players.concat(game.dead);
    if (player2) {
      if (player == game.me) {
        game.swapPlayer(player2, null, options);
      } else if (player2 == game.me) {
        game.swapPlayer(player, null, options);
      }
    } else {
      if (player == game.me) {
        return;
      }
      for (let i = 0; i < players.length; i++) {
        if (animate) {
          players[i].classList.add("player-seat-gliding");
        } else {
          players[i].style.transition = "all 0s";
        }
      }
      game.addVideo("swapPlayer", player, get.cardsInfo(player.getCards("h")));
      if (!game.chess) {
        const pos = parseInt(String(player.dataset.position));
        const num = game.players.length + game.dead.length;
        const allPlayers = game.players.concat(game.dead);
        let temp;
        for (let i = 0; i < allPlayers.length; i++) {
          temp = parseInt(String(allPlayers[i].dataset.position)) - pos;
          if (temp < 0) temp += num;
          allPlayers[i].dataset.position = String(temp);
        }
      }
      game.getMe().node.handcards1.remove();
      game.getMe().node.handcards2.remove();
      const current = game.getMe();
      game.me = player;
      if (current.isDead()) {
        current.$die();
      }
      const handcards1 = player.node.handcards1.addTempClass("start").fix();
      ui.handcards1 = handcards1;
      const handcards2 = player.node.handcards2.addTempClass("start").fix();
      ui.handcards2 = handcards2;
      ui.handcards1Container.appendChild(handcards1);
      ui.handcards2Container.appendChild(handcards2);
      ui.updatehl();
    }
    if (game.getMe().isAlive()) {
      if (ui.auto && !_status.llmSelfControlledAtGameStart) {
        ui.auto.show();
      }
      if (ui.wuxie && !_status.llmSelfControlledAtGameStart) {
        ui.wuxie.show();
      }
      if (ui.revive) {
        ui.revive.close();
        delete ui.revive;
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
    }
    if (lib.config.mode == "identity" && !preserveIdentity) {
      const current = game.getMe();
      current.setIdentity(current.identity);
    }
    if (animate && player) {
      player.classList.add("player-main-switched");
    }
    ui.create?.playerCard?.syncMainPlayer?.();
    ui.updateLLMLogButtons?.();
    setTimeout(
      (players2) => {
        for (let i = 0; i < players2.length; i++) {
          players2[i].style.transition = "";
          players2[i].classList.remove("player-seat-gliding", "player-main-switched");
        }
      },
      animate ? 500 : 100,
      players
    );
  },
  swapControl(player) {
    if (player == game.me) {
      return;
    }
    game.getMe().node.handcards1.remove();
    game.getMe().node.handcards2.remove();
    game.me = player;
    ui.handcards1 = player.node.handcards1.addTempClass("start").fix();
    ui.handcards2 = player.node.handcards2.addTempClass("start").fix();
    ui.handcards1Container.insertBefore(ui.handcards1, ui.handcards1Container.firstChild);
    ui.handcards2Container.insertBefore(ui.handcards2, ui.handcards2Container.firstChild);
    ui.updatehl();
    game.addVideo("swapControl", player, get.cardsInfo(player.getCards("h")));
    if (game.getMe().isAlive()) {
      if (ui.auto && !_status.llmSelfControlledAtGameStart) {
        ui.auto.show();
      }
      if (ui.wuxie && !_status.llmSelfControlledAtGameStart) {
        ui.wuxie.show();
      }
      if (ui.revive) {
        ui.revive.close();
        delete ui.revive;
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
    }
  },
  swapPlayerAuto(player) {
    if (game.modeSwapPlayer) {
      game.modeSwapPlayer(player);
    } else {
      game.swapPlayer(player);
    }
  },
  findNext(player) {
    const players = get.players(lib.sort.position);
    const position = parseInt(String(player.dataset.position));
    for (let i = 0; i < players.length; i++) {
      if (parseInt(String(players[i].dataset.position)) >= position) {
        return players[i];
      }
    }
    return players[0];
  }
};
export {
  seatAndSwapMethods
};
