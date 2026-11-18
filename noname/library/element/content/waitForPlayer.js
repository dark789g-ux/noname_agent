import "../../../../noname.js";
import { game } from "../../../game/index.js";
import { lib } from "../../index.js";
import { _status } from "../../../status/index.js";
import { get } from "../../../get/binding.js";
import { ui } from "../../../ui/index.js";
const waitForPlayerContent = {
  async waitForPlayer(event, trigger, player) {
    ui.auto.hide();
    ui.pause.hide();
    game.createServer();
    if (!lib.translate.zhu) {
      lib.translate.zhu = "主";
    }
    if (event.func) {
      event.func();
    }
    if (!lib.configOL.number) {
      lib.configOL.number = parseInt(lib.configOL.player_number);
    }
    if (game.onlineroom) {
      game.send("server", "config", lib.configOL);
    }
    ui.create.connectPlayers(game.ip);
    const connectPlayers = game.connectPlayers;
    if (!connectPlayers) {
      return;
    }
    const me = connectPlayers[0];
    me.setIdentity("zhu");
    me.initOL(get.connectNickname(), lib.config.connect_avatar);
    me.playerid = "1";
    game.onlinezhu = "1";
    _status.waitingForPlayer = true;
    await game.pause();
    _status.waitingForPlayer = false;
    lib.configOL.gameStarted = true;
    if (game.onlineroom) {
      game.send("server", "config", lib.configOL);
    }
    for (const player2 of connectPlayers) {
      player2.delete();
    }
    delete game.connectPlayers;
    if (ui.roomInfo) {
      ui.roomInfo.remove();
      delete ui.roomInfo;
    }
    if (ui.exitroom) {
      ui.exitroom.remove();
      delete ui.exitroom;
    }
    game.broadcast("gameStart");
    game.delay(2);
    ui.auto.show();
    ui.pause.show();
    if (lib.config.show_cardpile) {
      ui.cardPileButton.style.display = "";
    }
    if (lib.config.show_commonCardpile) {
      ui.commonCardPileButton.style.display = "";
    }
  },
  async replaceHandcards(event, trigger, player) {
    const currentMe = game.me;
    if (!currentMe || !event.getPlayers().includes(currentMe)) {
      return;
    }
    const result = await currentMe.chooseBool({ prompt: "是否置换手牌？" }).forResult();
    if (result && typeof result !== "string" && result.bool) {
      const playerid = game.getMe().playerid;
      const hs = game.getMe().getCards("h");
      const cards = [];
      const pileConfig = typeof playerid == "string" ? event.otherPile?.[playerid] : void 0;
      const otherGetCards = pileConfig?.getCards;
      const otherDiscacrd = pileConfig?.discard;
      game.addVideo("lose", game.getMe(), [get.cardsInfo(hs), [], [], []]);
      for (const card of hs) {
        card.removeGaintag(true);
        if (otherDiscacrd) {
          otherDiscacrd(card);
        } else {
          card.discard(false);
        }
      }
      if (otherGetCards) {
        cards.addArray(otherGetCards(hs.length));
      } else {
        cards.addArray(get.cards(hs.length));
      }
      if (typeof playerid == "string" && event.gaintag?.[playerid]) {
        const gaintag = event.gaintag[playerid];
        const list = typeof gaintag == "function" ? gaintag(hs.length, cards) : [[cards, gaintag]];
        for (let i = list.length - 1; i >= 0; i--) {
          game.getMe().directgain(list[i][0], null, list[i][1]);
        }
      } else {
        game.getMe().directgain(cards);
      }
      game.getMe()._start_cards = cards;
    }
  },
  async replaceHandcardsOL(event, trigger, player) {
    const chooseRemote = () => {
      game.getMe().chooseBool({ prompt: "是否置换手牌？" });
      game.resume();
    };
    const chooseMe = () => {
      return game.getMe().chooseBool({ prompt: "是否置换手牌？" });
    };
    const choose = (current) => {
      return new Promise((resolve) => {
        if (current.isOnline()) {
          current.wait((result) => resolve(!!result?.bool));
          current.send(chooseRemote);
          return;
        } else if (current === game.me) {
          const next = chooseMe();
          game.getMe().wait((result) => resolve(!!result?.bool));
          next.forResult().then((result) => game.getMe().unwait(result)).catch(() => resolve(false));
        } else {
          resolve(false);
        }
      });
    };
    const events = event.getPlayers().map(async (current) => {
      const result = await choose(current);
      if (!result) {
        return;
      }
      const hs = current.getCards("h");
      const cards = [];
      const playerid = current.playerid;
      const otherGetCards = playerid === void 0 ? void 0 : event.otherPile?.[playerid]?.getCards;
      const otherDiscard = playerid === void 0 ? void 0 : event.otherPile?.[playerid]?.discard;
      game.broadcastAll(
        (player2, hs2, otherDiscard2) => {
          game.addVideo("lose", player2, [get.cardsInfo(hs2), [], [], []]);
          for (const card of hs2) {
            card.removeGaintag(true);
            if (otherDiscard2) {
              otherDiscard2(card);
            } else {
              card.discard(false);
            }
          }
        },
        current,
        hs,
        otherDiscard
      );
      if (otherGetCards) {
        cards.addArray(otherGetCards(hs.length));
      } else {
        cards.addArray(get.cards(hs.length));
      }
      if (playerid !== void 0 && event.gaintag?.[playerid]) {
        const gaintag = event.gaintag[playerid];
        const list = typeof gaintag == "function" ? gaintag(hs.length, cards) : [[cards, gaintag]];
        game.broadcastAll(
          (player2, list2) => {
            for (let i = list2.length - 1; i >= 0; i--) {
              player2.directgain(list2[i][0], null, list2[i][1]);
            }
          },
          current,
          list
        );
      } else {
        current.directgain(cards);
      }
      current._start_cards = cards;
    });
    await Promise.allSettled(events);
  },
  phase: [
    async (event, trigger, player) => {
      await event.trigger("phaseBefore");
    },
    async (event, trigger, player) => {
      game.phaseNumber++;
      event.phaseList ??= ["phaseZhunbei", "phaseJudge", "phaseDraw", "phaseUse", "phaseDiscard", "phaseJieshu"];
      if (typeof event.num != "number") {
        event.num = 0;
      }
      let isRound = false;
      if (lib.onround.every((onRound) => onRound(event, player))) {
        isRound = _status.roundSkipped;
        if (_status.isRoundFilter) {
          isRound = _status.isRoundFilter(event, player);
        } else if (_status.seatNumSettled) {
          const seatNum = player.getSeatNum();
          if (seatNum != 0) {
            const lastPhasedPlayer = _status.lastPhasedPlayer;
            if (!lastPhasedPlayer || get.itemtype(lastPhasedPlayer) != "player" || seatNum < lastPhasedPlayer.getSeatNum()) {
              isRound = true;
            }
            _status.lastPhasedPlayer = player;
          }
        } else if (player == _status.roundStart) {
          isRound = true;
        }
        if (isRound) {
          delete _status.roundSkipped;
          game.roundNumber++;
          event._roundStart = true;
          game.updateRoundNumber();
          for (const current of game.players) {
            if (current.isOut() && current.outCount > 0) {
              current.outCount--;
              if (current.outCount == 0 && !current.outSkills) {
                current.in();
              }
            }
          }
        }
      }
      _status.globalHistory.push({
        cardMove: [],
        custom: [],
        useCard: [],
        changeHp: [],
        everything: []
      });
      const players = game.players.slice(0).concat(game.dead);
      for (const current of players) {
        current.actionHistory.push({
          useCard: [],
          respond: [],
          skipped: [],
          lose: [],
          gain: [],
          sourceDamage: [],
          damage: [],
          custom: [],
          useSkill: []
        });
        current.stat.push({ card: {}, skill: {}, triggerSkill: {} });
        if (isRound) {
          current.getHistory().isRound = true;
          current.getStat().isRound = true;
        }
      }
      if (isRound) {
        const globalHistory = game.getGlobalHistory();
        globalHistory.isRound = true;
        await event.trigger("roundStart");
      }
    },
    async (event, trigger, player) => {
      await event.trigger("phaseBeforeStart");
    },
    async (event, trigger, player) => {
      await event.trigger("phaseBeforeEnd");
    },
    async (event, trigger, player) => {
      if (player.isTurnedOver() && !event._noTurnOver) {
        const next = player.turnOver();
        player.phaseSkipped = true;
        const players = game.players.slice(0).concat(game.dead);
        for (const current of players) {
          current.getHistory().isSkipped = true;
          current.getStat().isSkipped = true;
        }
        event.cancel();
        return next.forResult();
      } else {
        player.phaseSkipped = false;
        player.getHistory().isMe = true;
        player.getStat().isMe = true;
      }
    },
    async (event, trigger, player) => {
      while (ui.dialogs.length) {
        ui.dialogs[0].close();
      }
      player.phaseNumber++;
      game.broadcastAll(
        (player2, num, popup) => {
          if (lib.config.glow_phase) {
            player2.classList.add("glow_phase");
          }
          player2.phaseNumber = num;
          _status.currentPhase = player2;
          if (popup && lib.config.show_phase_prompt) {
            player2.popup("回合开始", void 0, false);
          }
        },
        player,
        player.phaseNumber,
        !player.noPhaseDelay
      );
      _status.currentPhase = player;
      _status.discarded = [];
      game.syncState();
      game.addVideo("phaseChange", player);
      if (game.phaseNumber >= 1 && !lib.configOL.observeReady) {
        if (lib.configOL.observe) {
          lib.configOL.observeReady = true;
          game.send("server", "config", lib.configOL);
        }
      }
      game.log();
      const skill = event.skill && get.sourceSkillFor(event.skill);
      game.log(player, "的", skill ? `#y【${get.translation(skill)}】` : "", "回合开始");
      player._noVibrate = true;
      if (get.config("identity_mode") != "zhong" && get.config("identity_mode") != "purple" && !_status.connectMode) {
        let num;
        switch (get.config("auto_identity")) {
          case "one":
            num = 1;
            break;
          case "two":
            num = 2;
            break;
          case "three":
            num = 3;
            break;
          case "always":
            num = -1;
            break;
          default:
            num = 0;
            break;
        }
        if (num && !_status.identityShown && game.phaseNumber > game.players.length * num && game.showIdentity) {
          if (!_status.video) {
            player.popup("显示身份");
          }
          _status.identityShown = true;
          game.showIdentity(false);
        }
      }
      player.ai.tempIgnore = [];
      if (ui.land && ui.land.player == player) {
        game.addVideo("destroyLand");
        ui.land.destroy();
      }
    },
    async (event, trigger, player) => {
      await event.trigger("phaseBeginStart");
    },
    async (event, trigger, player) => {
      await event.trigger("phaseBegin");
    },
    //阶段部分
    async (event, trigger, player) => {
      const num = Number(event.num);
      if (num < event.phaseList.length) {
        if (player.isIn()) {
          await event.trigger("phaseChange");
        }
      } else {
        event.goto(11);
      }
    },
    async (event, trigger, player) => {
      const num = Number(event.num);
      if (!player.isIn() || num >= event.phaseList.length) {
        return;
      }
      const list = event.phaseList[num].split("|");
      const phase = list[0].split("-");
      let skip = false;
      if (phase[0].startsWith("skip")) {
        event.currentPhase = `phase${phase[0].slice(4)}`;
        skip = true;
      } else {
        event.currentPhase = phase[0];
      }
      const next = player[event.currentPhase]();
      next.phaseIndex = num;
      if (list.length > 1) {
        next._extraPhaseReason = list[1];
      }
      if (skip) {
        next.isSkipped = true;
        if (phase.length > 1) {
          next._skipPhaseReason = phase[1];
        }
        game.log(player, "跳过了", event.currentPhase);
      }
      if (event.currentPhase == "phaseDraw" || event.currentPhase == "phaseDiscard") {
        if (!player.noPhaseDelay) {
          if (player == game.me) {
            await game.delay();
          } else {
            await game.delayx();
          }
        }
      }
      return next.forResult();
    },
    async (event, trigger, player) => {
      if (event.currentPhase == "phaseUse") {
        game.broadcastAll(() => {
          if (ui.tempnowuxie) {
            ui.tempnowuxie.close();
            delete ui.tempnowuxie;
          }
        });
        delete player._noSkill;
      }
      event.num = Number(event.num) + 1;
    },
    async (event, trigger, player) => {
      if (Number(event.num) < event.phaseList.length) {
        event.goto(8);
      } else if (!event._phaseEndTriggered) {
        event._phaseEndTriggered = true;
        event.redo();
        await event.trigger("phaseEnd");
      }
    },
    async (event, trigger, player) => {
      await event.trigger("phaseAfter");
    },
    async (event, trigger, player) => {
      game.broadcastAll((player2) => {
        player2.classList.remove("glow_phase");
        delete _status.currentPhase;
      }, player);
    }
  ]
};
export {
  waitForPlayerContent
};
