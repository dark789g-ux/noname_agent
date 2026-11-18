import "../../../noname.js";
import { game } from "../index.js";
import { ui } from "../../ui/index.js";
import { get } from "../../get/binding.js";
import { lib } from "../../library/index.js";
import { _status } from "../../status/index.js";
function createVideoContentInitAndChess() {
  return {
    arrangeLib: function(content) {
      for (let i in content) {
        for (let j in content[i]) {
          lib[i][j] = content[i][j];
        }
      }
    },
    cardtag: function(cardtag) {
      _status.cardtag = cardtag;
    },
    addVirtualEquip: function(player, map) {
      const card = get.infoVCard(map[0]), cards = get.infoCards(map[1]);
      player.addVirtualEquip(card, cards);
    },
    addVirtualJudge: function(player, map) {
      const card = get.infoVCard(map[0]), cards = get.infoCards(map[1]);
      player.addVirtualJudge(card, cards);
    },
    removeVirtualEquip: function(player, card) {
      card = get.infoVCard(card);
      player.removeVirtualEquip(card);
    },
    removeVirtualJudge: function(player, card) {
      card = get.infoVCard(card);
      player.removeVirtualJudge(card);
    },
    $syncDisable: function(player, map) {
      player.disabledSlots = map;
      player.$syncDisable(map);
    },
    $syncExpand: function(player, map) {
      player.expandedSlots = map;
      player.$syncExpand(map);
    },
    $disableJudge: function(player, map) {
      player.$disableJudge();
    },
    $enableJudge: function(player, map) {
      player.$enableJudge();
    },
    jiuNode: function(player, bool) {
      if (bool) {
        if (!player.node.jiu && lib.config.jiu_effect) {
          player.node.jiu = ui.create.div(".playerjiu", player.node.avatar);
          player.node.jiu2 = ui.create.div(".playerjiu", player.node.avatar2);
        }
      } else {
        if (player.node.jiu) {
          player.node.jiu.delete();
          player.node.jiu2.delete();
          delete player.node.jiu;
          delete player.node.jiu2;
        }
      }
    },
    init: function(players) {
      if (game.chess) {
        return;
      }
      if (lib.config.mode == "versus") {
        players.bool = players.pop();
      }
      ui.arena.setNumber(players.length);
      ui.arena.classList.add("video");
      game.players.length = 0;
      game.dead.length = 0;
      ui.create.players(players.length);
      game.me = game.players[0];
      ui.handcards1 = game.me.node.handcards1;
      ui.handcards2 = game.me.node.handcards2;
      ui.handcards1Container.appendChild(ui.handcards1);
      ui.handcards2Container.appendChild(ui.handcards2);
      if (lib.config.mode == "versus") {
        if (players.bool) {
          const arenaNumber = ui.arena.dataset.number;
          if (typeof arenaNumber == "string") {
            const number = parseInt(arenaNumber);
            if (!Number.isNaN(number)) {
              ui.arena.setNumber(number + 1);
              for (let i = 0; i < game.players.length; i++) {
                const position = game.players[i].dataset.position;
                if (typeof position == "string") {
                  const parsedPosition = parseInt(position);
                  if (!Number.isNaN(parsedPosition)) {
                    game.players[i].dataset.position = String(parsedPosition + 1);
                  }
                }
              }
            }
          }
          game.singleHandcard = true;
          ui.arena.classList.add("single-handcard");
          ui.window.classList.add("single-handcard");
          ui.fakeme = ui.create.div(".fakeme.avatar", ui.me);
        }
        ui.arena.style.display = "";
        ui.refresh(ui.arena);
        ui.arena.show();
      } else if (lib.config.mode == "boss") {
        if (!players.boss) {
          game.singleHandcard = true;
          ui.arena.classList.add("single-handcard");
          ui.window.classList.add("single-handcard");
          ui.fakeme = ui.create.div(".fakeme.avatar", ui.me);
        }
        ui.arena.setNumber(8);
      }
      ui.updatehl();
      for (let i = 0; i < players.length; i++) {
        if (lib.config.mode == "identity") {
          if (_status.mode == "stratagem") {
            game.players[i].init(players[i].name, players[i].name2);
            game.players[i].identity = players[i].identity;
            if (game.players[i].identity == "fan" && players[i].isCamouflaged && game.me.identity == "nei" || game.players[i] == game.me) {
              game.players[i].setIdentity(players[i].identity);
            }
          } else {
            game.players[i].init(players[i].name, players[i].name2);
            game.players[i].setIdentity(players[i].identity);
          }
          game.players[i].setNickname(players[i].nickname);
        } else if (lib.config.mode == "doudizhu" || lib.config.mode == "single") {
          game.players[i].init(players[i].name, players[i].name2);
          game.players[i].setIdentity(players[i].identity);
          game.players[i].setNickname(players[i].nickname);
        } else if (lib.config.mode == "stone") {
          game.players[i].init(players[i].name, players[i].name2);
          game.players[i].classList.add("noidentity");
          game.players[i].updateActCount(null, players[i].count, 0);
        } else if (lib.config.mode == "boss") {
          game.players[i].init(players[i].name, players[i].name2);
          game.players[i].setIdentity(players[i].identity);
          game.players[i].dataset.position = players[i].position;
          game.players[i].node.action.innerHTML = "行动";
        } else if (lib.config.mode == "versus") {
          game.players[i].init(players[i].name, players[i].name2);
          const identityText = game.players[i].node.identity.firstElementChild;
          if (identityText instanceof HTMLDivElement) {
            identityText.innerHTML = players[i].identity;
          }
          game.players[i].node.identity.dataset.color = players[i].color;
          game.players[i].node.action.innerHTML = "行动";
        } else if (lib.config.mode == "guozhan") {
          game.players[i].name = players[i].name;
          game.players[i].name1 = players[i].name1;
          game.players[i].name2 = players[i].name2;
          game.players[i].sex = "unknown";
          game.players[i].identity = "unknown";
          lib.translate[String(game.players[i].name)] = players[i].translate;
          game.players[i].init(players[i].name1, players[i].name2);
          game.players[i].classList.add("unseen_v");
          game.players[i].classList.add("unseen2_v");
          if (game.players[i] != game.me) {
            const identityText = game.players[i].node.identity.firstElementChild;
            if (identityText instanceof HTMLDivElement) {
              identityText.innerHTML = "猜";
            }
            game.players[i].node.identity.dataset.color = "unknown";
          } else {
            game.players[i].setIdentity(game.players[i].group);
          }
          game.players[i].setNickname(players[i].nickname);
        }
      }
      for (let i = 0; i < game.players.length; i++) {
        const player = game.players[i];
        const position = player.dataset.position;
        if (typeof position == "string") {
          game.playerMap[position] = player;
        }
      }
      if (lib.config.mode == "versus") {
        if (players.bool) {
          game.onSwapControl();
        }
      } else if (lib.config.mode == "boss") {
        if (!players.boss) {
          game.onSwapControl();
        }
        ui.arena.style.display = "";
        ui.refresh(ui.arena);
        ui.arena.show();
        ui.updatehl();
      }
    },
    newcard: function(content) {
      if (content) {
        lib.translate[content.name] = content.translate;
        lib.translate[content.name + "_info"] = content.info;
        lib.card[content.name] = {};
        lib.card[content.name].cardimage = content.card;
        for (let i in lib.card[content.card]) {
          lib.card[content.name][i] = lib.card[content.card][i];
        }
        if (content.legend) {
          lib.card[content.name].legend = true;
        } else if (content.epic) {
          lib.card[content.name].epic = true;
        } else if (content.unique) {
          lib.card[content.name].unique = true;
        }
      }
    },
    changeLand: function(player, url) {
      game.changeLand(url, player);
    },
    destroyLand: function() {
      const currentLand = ui.land;
      if (currentLand) {
        currentLand.destroy();
      }
    },
    playAudio: function(str) {
      game.playAudio({ path: str, video: true });
    },
    playSkillAudio: function(name) {
      game.playSkillAudio(name, "video");
    },
    phaseChange: function(player) {
      if (player) {
        let glowing = document.querySelector(".glow_phase");
        if (glowing) {
          glowing.classList.remove("glow_phase");
        }
        if (lib.config.glow_phase) {
          player.classList.add("glow_phase");
        }
      } else {
        console.log(player);
      }
    },
    playerfocus: function(player, time) {
      if (player && player.playerfocus) {
        player.playerfocus(time);
      } else {
        console.log(player);
      }
    },
    playerfocus2: function() {
      ui.arena.classList.add("playerfocus");
      setTimeout(function() {
        ui.arena.classList.remove("playerfocus");
      }, 1500);
    },
    identityText: function(player, str) {
      if (player && str) {
        player.node.identity.firstChild.innerHTML = str;
      } else {
        console.log(player);
      }
    },
    identityColor: function(player, str) {
      if (player && str) {
        player.node.identity.dataset.color = str;
      } else {
        console.log(player);
      }
    },
    chessSwap: function(content) {
      let me = game.playerMap[content[0]];
      let player = game.playerMap[content[1]];
      if (me) {
        me.classList.remove("current_action");
      }
      if (player) {
        player.classList.add("current_action");
      }
    },
    chessgainmod: function(player, num) {
      if (Array.isArray(num)) {
        num = get.infoCards(num);
      }
      if (player && player.$gainmod) {
        player.$gainmod(num);
      } else {
        console.log(player);
      }
    },
    moveTo: function(player, pos) {
      if (player && player.moveTo && pos) {
        player.moveTo(pos[0], pos[1]);
      } else {
        console.log(player);
      }
    },
    addObstacle: function(pos) {
      if (pos) {
        game.addObstacle(pos[0], pos[1]);
      }
    },
    removeObstacle: function(pos) {
      game.removeObstacle(pos);
    },
    moveObstacle: function(pos) {
      if (pos) {
        game.moveObstacle(pos[0], pos[1], pos[2]);
      }
    },
    colorObstacle: function(pos) {
      if (pos) {
        game.colorObstacle(pos[0], pos[1]);
      }
    },
    thrownhighlight1: function() {
      ui.arena.classList.add("thrownhighlight");
    },
    thrownhighlight2: function() {
      ui.arena.classList.remove("thrownhighlight");
    },
    chessFocus: function(player) {
      if (player) {
        player.chessFocus();
      } else {
        console.log("chessFocus");
      }
    },
    removeTreasure: function(pos) {
      if (game.playerMap[pos]) {
        game.playerMap[pos].delete();
        delete game.playerMap[pos];
      } else {
        console.log(pos);
      }
    },
    initobs: function(obs) {
      if (obs) {
        for (let i = 0; i < obs.length; i++) {
          game.addObstacle(obs[i]);
        }
      } else {
        console.log(obs);
      }
    },
    stonePosition: function(content) {
      let player = game.playerMap[content[0]];
      if (player) {
        delete game.playerMap[content[0]];
        player.dataset.position = content[1];
        game.playerMap[content[1]] = player;
      } else {
        console.log(content);
      }
    }
  };
}
export {
  createVideoContentInitAndChess
};
