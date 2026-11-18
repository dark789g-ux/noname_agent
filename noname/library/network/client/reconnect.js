import "../../../../noname.js";
import { ui } from "../../../ui/index.js";
import { game } from "../../../game/index.js";
import { _status } from "../../../status/index.js";
import { lib } from "../../index.js";
import { ai } from "../../../ai/index.js";
import { get } from "../../../get/binding.js";
function createMessageClientReconnect() {
  return {
    reinit: function(config, state, state2, ip, observe, onreconnect, cardtag, postReconnect) {
      ui.auto.show();
      ui.pause.show();
      game.clearConnect();
      clearTimeout(_status.createNodeTimeout);
      game.online = true;
      game.ip = ip;
      game.servermode = state.servermode;
      game.roomId = state.roomId;
      if (state.over) {
        _status.over = true;
      }
      if (observe) {
        game.observe = true;
        game.onlineID = null;
        game.roomId = null;
      }
      if (game.servermode && !observe) {
        game.saveConfig("reconnect_info", [_status.ip, game.onlineID, game.roomId]);
      } else {
        game.saveConfig("reconnect_info", [_status.ip, game.onlineID]);
        if (!observe) {
          game.saveConfig("tmp_user_roomId", game.roomId);
        }
      }
      _status.connectMode = true;
      lib.configOL = config;
      lib.playerOL = {};
      lib.cardOL = {};
      lib.vcardOL = {};
      game.loadModeAsync(
        config.mode,
        /** @this {void} */
        function(mode) {
          for (var i in mode.ai) {
            if (typeof mode.ai[i] == "object") {
              if (ai[i] == void 0) {
                ai[i] = {};
              }
              for (var j in mode.ai[i]) {
                ai[i][j] = mode.ai[i][j];
              }
            } else {
              ai[i] = mode.ai[i];
            }
          }
          for (var i in mode.get) {
            if (typeof mode.get[i] == "object") {
              if (get[i] == void 0) {
                get[i] = {};
              }
              for (var j in mode.get[i]) {
                get[i][j] = mode.get[i][j];
              }
            } else {
              get[i] = mode.get[i];
            }
          }
          for (var i in mode.translate) {
            lib.translate[i] = mode.translate[i];
          }
          if (mode.game) {
            game.getIdentityList = mode.game.getIdentityList;
            game.getIdentityList2 = mode.game.getIdentityList2;
            game.updateState = mode.game.updateState;
            game.showIdentity = mode.game.showIdentity;
          }
          if (mode.element && mode.element.player) {
            Object.defineProperties(lib.element.Player.prototype, Object.getOwnPropertyDescriptors(mode.element.player));
          }
          if (mode.skill) {
            for (var i in mode.skill) {
              lib.skill[i] = mode.skill[i];
            }
          }
          if (mode.card) {
            for (var i in mode.card) {
              lib.card[i] = mode.card[i];
            }
          }
          game.finishCards();
          if (mode.characterPack) {
            for (var i in mode.characterPack) {
              lib.characterPack[i] = mode.characterPack[i];
            }
          }
          if (mode.onreinit) {
            mode.onreinit();
          }
          _status.cardtag = get.parsedResult(cardtag);
          game.players = [];
          game.dead = [];
          for (var i in lib.characterPack) {
            for (var j in lib.characterPack[i]) {
              lib.character[j] = lib.character[j] || lib.characterPack[i][j];
            }
          }
          game.clearArena();
          game.finishCards();
          if (!observe) {
            ui.create.chat();
            if (ui.exitroom) {
              ui.exitroom.remove();
              delete ui.exitroom;
            }
          } else {
            if (!ui.exitroom) {
              ui.create.system(
                "退出旁观",
                function() {
                  game.saveConfig("reconnect_info");
                  game.reload();
                },
                true
              );
            }
            if (!lib.configOL.observe_handcard) {
              ui.arena.classList.add("observe");
            }
          }
          postReconnect = get.parsedResult(postReconnect);
          for (var i in postReconnect) {
            if (Array.isArray(postReconnect[i])) {
              postReconnect[i].shift().apply(this, postReconnect[i]);
            }
          }
          state = get.parsedResult(state);
          ui.arena.setNumber(state.number);
          _status.mode = state.mode;
          for (const [key, value] of lib.commonArea) {
            _status[value.areaStatusName] = state[value.areaStatusName];
          }
          lib.inpile = state.inpile;
          lib.inpile_nature = state.inpile_nature;
          var pos = state.players[observe || game.onlineID].position;
          for (var i in state.players) {
            var info = state.players[i];
            var player = ui.create.player(ui.arena).addTempClass("start");
            player.dataset.position = String(info.position < pos ? info.position - pos + parseInt(state.number) : info.position - pos);
            if (i == observe || i == game.onlineID) {
              game.me = player;
            }
            if (player.setModeState) {
              player.setModeState(info);
            } else {
              player.init(info.name1, info.name2);
              if (info.name && info.name != info.name1) {
                player.name = info.name;
              }
            }
            if (!info.unseen) {
              player.classList.remove("unseen");
            }
            if (!info.unseen2) {
              player.classList.remove("unseen2");
            }
            if (!player.isUnseen(2) && player.storage.nohp) {
              delete player.storage.nohp;
              player.node.hp.show();
            }
            player.playerid = i;
            player.nickname = info.nickname;
            player.group = info.group;
            player.node.name.dataset.nature = get.groupnature(info.group);
            player.identity = info.identity;
            player.identityShown = info.identityShown;
            player.hp = info.hp;
            player.maxHp = info.maxHp;
            player.hujia = info.hujia;
            player.sex = info.sex;
            player.side = info.side;
            player.phaseNumber = info.phaseNumber;
            player.seatNum = info.seatNum;
            player.disabledSlots = info.disabledSlots;
            player.expandedSlots = info.expandedSlots;
            player.extraEquip = info.extraEquip;
            player.setNickname();
            if (info.dead) {
              player.classList.add("dead");
              if (lib.config.die_move) {
                player.$dieflip();
              }
              if (player.$dieAfter) {
                player.$dieAfter();
              }
              game.dead.push(player);
            } else {
              game.players.push(player);
            }
            if (info.linked) {
              player.addLink();
            }
            if (info.turnedover) {
              player.classList.add("turnedover");
            }
            if (info.out) {
              player.classList.add("out");
            }
            if (info.disableJudge) {
              player.$disableJudge();
            }
            player.$syncDisable();
            if (info.extraEquip) {
              player.$handleEquipChange();
            }
            player.directgain(info.handcards);
            lib.playerOL[i] = player;
            for (let i2 = 0; i2 < info.equips.length; i2++) {
              let card = info.equips[i2], id = card.cardid, map = info.equips_map[id];
              card.fix();
              card.style.transform = "";
              card.classList.remove("drawinghidden");
              delete card._transform;
              if (map.isViewAsCard) {
                card.isViewAsCard = true;
                if (map._destroyed_Virtua) {
                  card._destroyed_Virtua = map._destroyed_Virtua;
                }
                if (map.destroyed) {
                  card.destroyed = map.destroyed;
                }
                card.cards = map?.vcard?.cards || [];
                card.viewAs = map?.vcard?.name || card.name;
                card.classList.add("fakeequip");
              } else {
                card.classList.remove("fakeequip");
                delete card.viewAs;
              }
              if (map.name2) {
                card.node.name2.innerHTML = map.name2;
              }
              if (map.vcard) {
                const cardSymbol = /* @__PURE__ */ Symbol("card");
                card.cardSymbol = cardSymbol;
                card[cardSymbol] = map.vcard;
                if (map.vcard.subtypes) {
                  card.subtypes = map.vcard.subtypes;
                }
                if (map.vcard.cards?.length) {
                  for (let j2 of map.vcard.cards) {
                    j2.goto(ui.special);
                    j2.destiny = player.node.equips;
                  }
                }
                player.addVirtualEquip(map.vcard, map.vcard.cards);
              }
              let equipped = false, equipNum = get.equipNum(card);
              if (player.node.equips.childNodes.length) {
                for (let i3 = 0; i3 < player.node.equips.childNodes.length; i3++) {
                  if (get.equipNum(player.node.equips.childNodes[i3]) >= equipNum) {
                    equipped = true;
                    player.node.equips.insertBefore(card, player.node.equips.childNodes[i3]);
                    break;
                  }
                }
              }
              if (equipped === false) {
                player.node.equips.appendChild(card);
              }
            }
            for (let i2 = 0; i2 < info.judges.length; i2++) {
              let card = info.judges[i2], id = card.cardid, map = info.judges_map[id];
              card.fix();
              card.style.transform = "";
              card.classList.remove("drawinghidden");
              delete card._transform;
              if (map.isViewAsCard) {
                card.isViewAsCard = true;
                if (map._destroyed_Virtua) {
                  card._destroyed_Virtua = map._destroyed_Virtua;
                }
                if (map.destroyed) {
                  card.destroyed = map.destroyed;
                }
                card.cards = map?.vcard?.cards || [];
                card.viewAs = map?.vcard?.name || card.name;
                card.classList.add("fakejudge");
              } else {
                card.classList.remove("fakejudge");
                delete card.viewAs;
              }
              if (map.name2) {
                card.node.name2.innerHTML = map.name2;
              }
              if (map.vcard) {
                const cardSymbol = /* @__PURE__ */ Symbol("card");
                card.cardSymbol = cardSymbol;
                card[cardSymbol] = map.vcard;
                if (map.vcard.subtypes) {
                  card.subtypes = map.vcard.subtypes;
                }
                if (map.vcard.cards?.length) {
                  for (let j2 of map.vcard.cards) {
                    j2.goto(ui.special);
                    j2.destiny = player.node.judges;
                  }
                }
                player.addVirtualJudge(map.vcard, map.vcard.cards);
              }
              player.node.judges.insertBefore(card, player.node.judges.firstChild);
            }
            for (let i2 = 0; i2 < info.handcards.length; i2++) {
              info.handcards[i2].addGaintag(info.gaintag[i2]);
            }
            for (let i2 = 0; i2 < info.specials.length; i2++) {
              info.specials[i2].classList.add("glows");
            }
            if (info.expansions.length) {
              var expansion_gaintag = [];
              player.$addToExpansion(info.expansions);
              for (let i2 = 0; i2 < info.expansions.length; i2++) {
                info.expansions[i2].addGaintag(info.expansion_gaintag[i2]);
                expansion_gaintag.addArray(info.expansion_gaintag[i2]);
              }
              for (let i2 of expansion_gaintag) {
                player.markSkill[i2];
              }
            }
            for (let i2 = 0; i2 < info.judges.length; i2++) {
              if (info.views[i2] && info.views[i2] != info.judges[i2]) {
                info.judges[i2].classList.add("fakejudge");
                info.judges[i2].viewAs = info.views[i2];
                info.judges[i2].node.background.innerHTML = lib.translate[info.views[i2] + "_bg"] || get.translation(info.views[i2])[0];
              }
              player.node.judges.appendChild(info.judges[i2]);
            }
            ui.updatej(player);
            if (!player.setModeState) {
              if (!game.getIdentityList && info.identityNode) {
                player.node.identity.innerHTML = info.identityNode[0];
                player.node.identity.dataset.color = info.identityNode[1];
              } else if (player == game.me || player.identityShown || observe) {
                player.setIdentity();
                player.forceShown = true;
              } else {
                player.setIdentity("cai");
              }
              if (!lib.configOL.observe_handcard && (lib.configOL.mode == "identity" || lib.configOL.mode == "guozhan")) {
                if (observe && !player.identityShown) {
                  player.setIdentity("cai");
                  player.forceShown = false;
                }
              }
            }
            player.update();
          }
          game.arrangePlayers();
          ui.create.me(true);
          _status.event = lib.element.GameEvent.initialGameEvent();
          _status.paused = false;
          _status.dying = get.parsedResult(state.dying) || [];
          if (game.updateState) {
            game.updateState(state2);
          }
          var next = game.createEvent("game", false);
          next.setContent(lib.init.startOnline);
          if (observe) {
            next.custom.replace.target = function(player2) {
              if (!lib.configOL.observe_handcard && lib.configOL.mode == "guozhan") {
                return;
              }
              if (player2.isAlive()) {
                const me = game.getMe();
                if (!me.identityShown && lib.configOL.mode == "guozhan") {
                  const identityLabel = me.node.identity.firstChild;
                  if (!(identityLabel instanceof HTMLElement)) {
                    throw new TypeError("The player identity node requires its label");
                  }
                  identityLabel.innerHTML = "猜";
                  me.node.identity.dataset.color = "unknown";
                }
                game.swapPlayer(player2);
                const currentMe = game.getMe();
                if (!currentMe.identityShown && lib.configOL.mode == "guozhan") {
                  const identityLabel = currentMe.node.identity.firstChild;
                  if (!(identityLabel instanceof HTMLElement)) {
                    throw new TypeError("The player identity node requires its label");
                  }
                  identityLabel.innerHTML = "";
                }
              }
            };
          } else {
            if (Array.isArray(onreconnect)) {
              onreconnect.shift().apply(this, onreconnect);
            }
          }
          game.loop();
          game.send("reinited");
          game.showHistory();
          _status.gameStarted = true;
          if (lib.config.show_cardpile) {
            ui.cardPileButton.style.display = "";
          }
          if (lib.config.show_commonCardpile) {
            if (ui.commonCardPileButton) {
              ui.commonCardPileButton.style.display = "";
            }
          }
          if (!observe && game.me && (game.me.isDead() || _status.over)) {
            ui.create.exit();
          }
          ui.updatehl();
          ui.create.connecting(true);
        }
      );
    }
  };
}
export {
  createMessageClientReconnect
};
