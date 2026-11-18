import "../../../noname.js";
import { game } from "../index.js";
import { get } from "../../get/binding.js";
import { lib } from "../../library/index.js";
import { ui } from "../../ui/index.js";
function createVideoContentCardMove() {
  return {
    line: function(player, content) {
      if (player && content) {
        player.line(game.playerMap[content[0]], content[1]);
      } else {
        console.log(player);
      }
    },
    fullscreenpop: function(player, content) {
      if (player && content) {
        player.$fullscreenpop(content[0], content[1], content[2]);
      } else {
        console.log(player);
      }
    },
    damagepop: function(player, content) {
      if (player && content) {
        player.$damagepop(content[0], content[1], content[2]);
      } else {
        console.log(player);
      }
    },
    damage: function(player, source) {
      if (player && player.$damage) {
        player.$damage(game.playerMap[source]);
      } else {
        console.log(player);
      }
    },
    diex: function(player) {
      if (!player) {
        console.log("diex");
        return;
      }
      let cards = player.getCards("hej");
      for (let i = 0; i < cards.length; i++) {
        cards[i].discard();
      }
      while (player.node.marks.childNodes.length > 1) {
        player.node.marks.lastChild.remove();
      }
      player.classList.add("dead");
      player.classList.remove("turnedover");
      player.classList.remove("out");
      player.node.count.innerHTML = "0";
      player.node.hp.hide();
      player.node.equips.hide();
      player.node.count.hide();
      player.previous.next = player.next;
      player.next.previous = player.previous;
      game.players.remove(player);
      game.dead.push(player);
      if (lib.config.mode == "stone") {
        setTimeout(function() {
          player.delete();
        }, 500);
      }
    },
    tafangMe: function(player) {
      if (player) {
        game.me = player;
        const handcardDisplay = ui.me.lastElementChild;
        if (handcardDisplay instanceof HTMLDivElement) {
          handcardDisplay.show();
        }
        if (typeof ui.create.fakeme != "function") {
          throw new TypeError("ui.create.fakeme is not a function");
        }
        ui.create.fakeme();
        const handcards1 = player.node.handcards1;
        const handcards2 = player.node.handcards2;
        if (handcards1) {
          const currentHandcards1 = handcards1.addTempClass("start").fix();
          ui.handcards1 = currentHandcards1;
          if (ui.handcards1Container) {
            ui.handcards1Container.appendChild(currentHandcards1);
          }
        }
        if (handcards2) {
          const currentHandcards2 = handcards2.addTempClass("start").fix();
          ui.handcards2 = currentHandcards2;
          if (ui.handcards2Container) {
            ui.handcards2Container.appendChild(currentHandcards2);
          }
        }
        ui.updatehl();
        game.setChessInfo();
      }
    },
    deleteChessPlayer: function(player) {
      if (player) {
        player.delete();
        delete game.playerMap[player.dataset.position];
        game.players.remove(player);
        for (let i = 0; i < ui.phasequeue.length; i++) {
          if (ui.phasequeue[i].link == player) {
            ui.phasequeue[i].remove();
            ui.phasequeue.splice(i, 1);
            break;
          }
        }
      }
    },
    addChessPlayer: function(content) {
      game.addChessPlayer.apply(this, content);
    },
    die: function(player) {
      if (!player) {
        console.log("die");
        return;
      }
      player.$die();
      if (game.chess) {
        const posmap = lib.posmap;
        if (!posmap) {
          throw new TypeError("lib.posmap is not available");
        }
        delete posmap[String(player.dataset.position)];
        setTimeout(function() {
          player.delete();
        }, 500);
        for (let i = 0; i < ui.phasequeue.length; i++) {
          if (ui.phasequeue[i].link == player) {
            ui.phasequeue[i].remove();
            ui.phasequeue.splice(i, 1);
            break;
          }
        }
      }
    },
    revive: function(player) {
      if (!player) {
        console.log("revive");
        return;
      }
      player.classList.remove("dead");
      player.node.hp.show();
      player.node.equips.show();
      player.node.count.show();
      player.node.avatar.style.transform = "";
      player.node.avatar2.style.transform = "";
      player.removeAttribute("style");
    },
    update: function(player, info) {
      if (player && info) {
        player.hp = info[1];
        player.maxHp = info[2];
        player.hujia = info[3];
        player.update(info[0]);
      } else {
        console.log(player);
      }
    },
    phaseJudge: function(player, card) {
      if (player && card) {
      } else {
        console.log(player);
      }
    },
    directgain: function(player, cards) {
      if (player && cards) {
        player.directgain(get.infoCards(cards));
      } else {
        console.log(player);
      }
    },
    directgains: function(player, cards) {
      if (player && cards) {
        if (get.is.object(cards)) {
          player.directgains(get.infoCards(cards.cards), null, cards.gaintag);
        } else {
          player.directgains(get.infoCards(cards));
        }
      } else {
        console.log(player);
      }
    },
    directequip: function(player, cards) {
      if (player && cards) {
        player.directequip(get.infoCards(cards));
      } else {
        console.log(player);
      }
    },
    gain12: function(player, cards12) {
      if (player && cards12) {
        let cards1 = get.infoCards(cards12[0]);
        let cards2 = get.infoCards(cards12[1]);
        for (let i = 0; i < cards1.length; i++) {
          cards1[i].classList.add("drawinghidden");
          cards1[i].addGaintag(cards12[2]);
          player.node.handcards1.insertBefore(cards1[i], player.node.handcards1.firstChild);
        }
        for (let i = 0; i < cards2.length; i++) {
          cards2[i].classList.add("drawinghidden");
          cards2[i].addGaintag(cards12[2]);
          player.node.handcards2.insertBefore(cards2[i], player.node.handcards2.firstChild);
        }
        ui.updatehl();
      } else {
        console.log(player);
      }
    },
    equip: function(player, card) {
      if (player && card) {
        player.$equip(get.infoCard(card));
      } else {
        console.log(player);
      }
    },
    addJudge: function(player, content) {
      if (player && content) {
        let card = get.infoCard(content[0]);
        card.viewAs = content[1];
        if (card.viewAs && card.viewAs != card.name && (card.classList.contains("fullskin") || card.classList.contains("fullborder"))) {
          card.classList.add("fakejudge");
          card.node.background.innerHTML = lib.translate[card.viewAs + "_bg"] || get.translation(card.viewAs)[0];
        }
        card.classList.add("drawinghidden");
        player.node.judges.insertBefore(card, player.node.judges.firstChild);
        ui.updatej(player);
      } else {
        console.log(player);
      }
    },
    markCharacter: function(player, content) {
      if (player && content) {
        if (game.playerMap[content.target]) {
          content.target = game.playerMap[content.target];
        }
        let mark = player.markCharacter(content.target, content);
        if (content.id) {
          player.marks[content.id] = mark;
        }
      } else {
        console.log(player);
      }
    },
    changeMarkCharacter: function(player, content) {
      if (player && content && player.marks[content.id]) {
        player.marks[content.id].info = {
          name: content.name,
          content: content.content
        };
        player.marks[content.id].setBackground(content.target, "character");
      }
    },
    mark: function(player, content) {
      if (player && content) {
        let mark = player.mark(content.id, content);
      } else {
        console.log(player);
      }
    },
    markSkill: function(player, content) {
      if (player && content) {
        if (content[1]) {
          player.markSkill(content[0], null, get.infoCard(content[1]));
        } else {
          player.markSkill(content[0]);
        }
      } else {
        console.log(player);
      }
    },
    unmarkSkill: function(player, name) {
      if (player && player.unmarkSkill) {
        player.unmarkSkill(name);
      } else {
        console.log(player);
      }
    }
  };
}
export {
  createVideoContentCardMove
};
