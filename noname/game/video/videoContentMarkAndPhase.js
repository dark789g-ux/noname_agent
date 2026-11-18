import "../../../noname.js";
import { game } from "../index.js";
import { ui } from "../../ui/index.js";
import { lib } from "../../library/index.js";
import { get } from "../../get/binding.js";
function createVideoContentMarkAndPhase() {
  return {
    storage: function(player, content) {
      if (player && content) {
        if (content[2]) {
          switch (content[2]) {
            case "cards":
              content[1] = get.infoCards(content[1]);
              break;
            case "card":
              content[1] = get.infoCard(content[1]);
              break;
          }
        }
        player.storage[content[0]] = content[1];
      } else {
        console.log(player);
      }
    },
    markId: function(player, content) {
      if (player && content) {
        player.mark(get.infoCard(content[0]), content[1]);
      } else {
        console.log(player);
      }
    },
    unmarkId: function(player, content) {
      if (player && content) {
        player.unmark(get.infoCard(content[0]), content[1]);
      } else {
        console.log(player);
      }
    },
    lose: function(player, info) {
      if (player && info) {
        let hs = info[0] || [], es = info[1] || [], js = info[2] || [], ss = info[3] || [];
        let phs = player.getCards("h"), pes = player.getCards("e"), pjs = player.getCards("j"), pss = player.getCards("s");
        let checkMatch = function(l1, l2) {
          for (let i = 0; i < l1.length; i++) {
            for (let j = 0; j < l2.length; j++) {
              if (l1[i].length === 5) {
                if (l1[i][4] === l2[j].cardid) {
                  l2[j].classList.remove("glow");
                  l2[j].classList.remove("glows");
                  l2[j].remove();
                  l2.splice(j--, 1);
                  break;
                }
              } else if (l2[j].suit == l1[i][0] && l2[j].number == l1[i][1] && l2[j].name == l1[i][2]) {
                l2[j].classList.remove("glow");
                l2[j].classList.remove("glows");
                l2[j].remove();
                l2.splice(j--, 1);
                break;
              }
            }
          }
        };
        checkMatch(hs, phs);
        checkMatch(es, pes);
        checkMatch(js, pjs);
        checkMatch(ss, pss);
        ui.updatehl();
      } else {
        console.log(player);
      }
    },
    loseAfter: function(player) {
      if (!player) {
        console.log("loseAfter");
        return;
      }
    },
    link: function(player, bool) {
      if (player && player.classList) {
        if (bool) {
          player.addLink();
        } else {
          player.removeLink();
        }
      } else {
        console.log(player);
      }
    },
    turnOver: function(player, bool) {
      if (player && player.classList) {
        if (bool) {
          player.classList.add("turnedover");
        } else {
          player.classList.remove("turnedover");
        }
      } else {
        console.log(player);
      }
    },
    showCards: function(player, info) {
      if (info) {
        let dialog = ui.create.dialog(info[0], get.infoCards(info[1]));
        setTimeout(function() {
          dialog.close();
        }, 1e3);
      } else {
        console.log(player);
      }
    },
    cardDialog: function(content) {
      if (Array.isArray(content)) {
        ui.create.dialog(content[0], get.infoCards(content[1])).videoId = content[2];
      } else if (typeof content == "number") {
        for (let i = 0; i < ui.dialogs.length; i++) {
          if (ui.dialogs[i].videoId == content) {
            ui.dialogs[i].close();
            return;
          }
        }
      }
    },
    changeSeat: function(player, info) {
      if (player && player.getBoundingClientRect && player.changeSeat) {
        player.changeSeat(info);
        game.playerMap = {};
        let players = game.players.concat(game.dead);
        for (let i = 0; i < players.length; i++) {
          const position = players[i] && players[i].dataset && players[i].dataset.position;
          if (typeof position !== "string" || position.trim() === "" || Number.isNaN(parseInt(position, 10))) {
            continue;
          }
          game.playerMap[position] = players[i];
        }
      }
    },
    dialogCapt: function(content) {
      for (let i = 0; i < ui.dialogs.length; i++) {
        if (ui.dialogs[i].videoId == content[0]) {
          const caption = ui.dialogs[i].content.firstElementChild;
          if (caption instanceof HTMLDivElement) {
            caption.innerHTML = content[1];
          }
          return;
        }
      }
    },
    swapSeat: function(content) {
      const contentPosition1 = content && content[0];
      const contentPosition2 = content && content[1];
      let player1 = typeof contentPosition1 === "string" ? game.playerMap[contentPosition1] : void 0;
      let player2 = typeof contentPosition2 === "string" ? game.playerMap[contentPosition2] : void 0;
      if (!player1 || !player2) {
        console.log(content);
        return;
      }
      const getPosition = (player) => {
        const value = player && player.dataset && player.dataset.position;
        if (typeof value !== "string" || value.trim() === "") {
          return null;
        }
        const position = parseInt(value, 10);
        return Number.isNaN(position) ? null : position;
      };
      const position1 = getPosition(player1);
      const position2 = getPosition(player2);
      if (position1 !== null && position2 !== null) {
        player1.dataset.position = String(position2);
        player2.dataset.position = String(position1);
      } else {
        const tempPosition = player1.dataset.position;
        player1.dataset.position = player2.dataset.position;
        player2.dataset.position = tempPosition;
      }
      game.arrangePlayers();
      const swappedPosition1 = getPosition(player1);
      const swappedPosition2 = getPosition(player2);
      if (swappedPosition1 === 0 || swappedPosition2 === 0) {
        let pos = swappedPosition1;
        if (pos === 0) {
          pos = swappedPosition2;
        }
        if (pos !== null) {
          const num = game.players.length + game.dead.length;
          for (const currentPlayer of game.players) {
            const currentPosition = getPosition(currentPlayer);
            if (currentPosition === null) {
              continue;
            }
            let nextPosition = currentPosition - pos;
            if (nextPosition < 0) {
              nextPosition += num;
            }
            currentPlayer.dataset.position = String(nextPosition);
          }
          for (const currentPlayer of game.dead) {
            const currentPosition = getPosition(currentPlayer);
            if (currentPosition === null) {
              continue;
            }
            let nextPosition = currentPosition - pos;
            if (nextPosition < 0) {
              nextPosition += num;
            }
            currentPlayer.dataset.position = String(nextPosition);
          }
        }
      }
      game.playerMap = {};
      const players = game.players.concat(game.dead);
      for (const currentPlayer of players) {
        const position = currentPlayer && currentPlayer.dataset && currentPlayer.dataset.position;
        if (typeof position !== "string" || position.trim() === "" || Number.isNaN(parseInt(position, 10))) {
          continue;
        }
        game.playerMap[position] = currentPlayer;
      }
    },
    removeTafangPlayer: function() {
      ui.fakeme.hide();
      ui.handcards1Container.innerHTML = "";
      ui.handcards2Container.innerHTML = "";
      game.me = ui.create.player();
    },
    swapControl: function(player, hs) {
      if (player && player.node) {
        let cards = get.infoCards(hs);
        const handcards1 = player.node.handcards1;
        const handcards2 = player.node.handcards2;
        if (handcards1 && handcards2) {
          handcards1.innerHTML = "";
          handcards2.innerHTML = "";
          player.directgain(cards, false);
        }
        if (game.me && game.me.node && game.me.node.handcards1) {
          game.me.node.handcards1.remove();
        }
        if (game.me && game.me.node && game.me.node.handcards2) {
          game.me.node.handcards2.remove();
        }
        if (handcards1 && ui.handcards1Container) {
          const currentHandcards1 = handcards1.addTempClass("start").fix();
          ui.handcards1 = currentHandcards1;
          ui.handcards1Container.insertBefore(currentHandcards1, ui.handcards1Container.firstChild);
        }
        if (handcards2 && ui.handcards2Container) {
          const currentHandcards2 = handcards2.addTempClass("start").fix();
          ui.handcards2 = currentHandcards2;
          ui.handcards2Container.insertBefore(currentHandcards2, ui.handcards2Container.firstChild);
        }
        game.me = player;
        ui.updatehl();
        if (game.chess) {
          if (typeof ui.create.fakeme != "function") {
            throw new TypeError("ui.create.fakeme is not a function");
          }
          ui.create.fakeme();
        }
      } else {
        console.log(player);
      }
    },
    onSwapControl: function() {
      game.onSwapControl();
    },
    swapPlayer: function(player, hs) {
      if (player && player.node) {
        let cards = get.infoCards(hs);
        const handcards1 = player.node.handcards1;
        const handcards2 = player.node.handcards2;
        if (handcards1 && handcards2) {
          handcards1.innerHTML = "";
          handcards2.innerHTML = "";
          player.directgain(cards, false);
        }
        const positionValue = player.dataset && player.dataset.position;
        const parsedPosition = typeof positionValue === "string" && positionValue.trim() !== "" ? parseInt(positionValue, 10) : NaN;
        let num = game.players.length + game.dead.length;
        let players = game.players.concat(game.dead);
        if (!Number.isNaN(parsedPosition)) {
          for (const currentPlayer of players) {
            const currentValue = currentPlayer && currentPlayer.dataset && currentPlayer.dataset.position;
            if (typeof currentValue !== "string" || currentValue.trim() === "") {
              continue;
            }
            const currentPosition = parseInt(currentValue, 10);
            if (Number.isNaN(currentPosition)) {
              continue;
            }
            let nextPosition = currentPosition - parsedPosition;
            if (nextPosition < 0) {
              nextPosition += num;
            }
            currentPlayer.dataset.position = String(nextPosition);
          }
        }
        if (game.me && game.me.node && game.me.node.handcards1) {
          game.me.node.handcards1.remove();
        }
        if (game.me && game.me.node && game.me.node.handcards2) {
          game.me.node.handcards2.remove();
        }
        game.me = player;
        if (handcards1 && ui.handcards1Container) {
          const currentHandcards1 = handcards1.addTempClass("start").fix();
          ui.handcards1 = currentHandcards1;
          ui.handcards1Container.appendChild(currentHandcards1);
        }
        if (handcards2 && ui.handcards2Container) {
          const currentHandcards2 = handcards2.addTempClass("start").fix();
          ui.handcards2 = currentHandcards2;
          ui.handcards2Container.appendChild(currentHandcards2);
        }
        ui.updatehl();
        game.playerMap = {};
        players = game.players.concat(game.dead);
        for (const currentPlayer of players) {
          const position = currentPlayer && currentPlayer.dataset && currentPlayer.dataset.position;
          if (typeof position !== "string" || position.trim() === "" || Number.isNaN(parseInt(position, 10))) {
            continue;
          }
          game.playerMap[position] = currentPlayer;
        }
      } else {
        console.log(player);
      }
    },
    over: function(str) {
      let dialog = ui.create.dialog("hidden");
      dialog.noforcebutton = true;
      dialog.content.innerHTML = str;
      dialog.forcebutton = true;
      dialog.open();
      if (game.chess) {
        dialog.classList.add("center");
      }
      if ((game.layout == "long2" || game.layout == "nova") && !game.chess) {
        ui.arena.classList.add("choose-character");
        if (ui.me) {
          ui.me.hide();
        }
        if (ui.mebg) {
          ui.mebg.hide();
        }
        if (ui.autonode) {
          ui.autonode.hide();
        }
        if (lib.config.radius_size != "off") {
          if (ui.historybar) {
            ui.historybar.style.borderRadius = "0 0 0 4px";
          }
        }
      }
    }
  };
}
export {
  createVideoContentMarkAndPhase
};
