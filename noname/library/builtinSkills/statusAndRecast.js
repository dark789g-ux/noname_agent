import "../../../noname.js";
import { requireRegisteredSkill } from "../skillRegistry.js";
import { lib } from "../index.js";
import { _status } from "../../status/index.js";
import { game } from "../../game/index.js";
import { get } from "../../get/binding.js";
import { ui } from "../../ui/index.js";
const statusAndRecastSkills = {
  /**
   * @deprecated
   */
  /*_recovercheck: {
                 trigger: { player: 'recoverBefore' },
                 forced: true,
                 priority: 100,
                 firstDo: true,
                 popup: false,
                 silent: true,
                 filter: function (event, player) {
                     return player.hp >= player.maxHp;
                 },
  			async content(event, trigger, player) {
                     trigger.cancel();
                 },
             },*/
  /**
   * @deprecated
   */
  /*_turnover:{
                 trigger:{player:'phaseBefore'},
                 forced:true,
                 forceOut:true,
                 priority:100,
                 popup:false,
                 firstDo:true,
  			async content(event, trigger, player) {
                     if(player.isTurnedOver()&&!trigger._noTurnOver){
                         trigger.cancel();
                         player.turnOver();
                         player.phaseSkipped=true;
                     }
                     else{
                         player.phaseSkipped=false;
                     }
                     var isRound=false;
                     if(!trigger.skill){
                         isRound=_status.roundSkipped;
                         if(_status.isRoundFilter){
                             isRound=_status.isRoundFilter(trigger,player);
                         }
                         else if(_status.seatNumSettled){
                             var seatNum=player.getSeatNum();
                             if(seatNum!=0){
                                 if(typeof _status.lastSeatNum!='number'||seatNum<_status.lastSeatNum) isRound=true;
                                 _status.lastSeatNum=seatNum;
                             }
                         }
                         else if(player==_status.roundStart) isRound=true;
                         if(isRound){
                             delete _status.roundSkipped;
                             game.roundNumber++;
                             trigger._roundStart=true;
                             game.updateRoundNumber();
                             for(var i=0;i<game.players.length;i++){
                                 if(game.players[i].isOut()&&game.players[i].outCount>0){
                                     game.players[i].outCount--;
                                     if(game.players[i].outCount==0&&!game.players[i].outSkills){
                                         game.players[i].in();
                                     }
                                 }
                             }
                             event.trigger('roundStart');
                         }
                     }
                     _status.globalHistory.push({
                         cardMove:[],
                         custom:[],
                         useCard:[],
                         changeHp:[],
                         everything:[],
                     });
                     var players=game.players.slice(0).concat(game.dead);
                     for(var i=0;i<players.length;i++){
                         var current=players[i];
                         current.actionHistory.push({useCard:[],respond:[],skipped:[],lose:[],gain:[],sourceDamage:[],damage:[],custom:[],useSkill:[]});
                         current.stat.push({card:{},skill:{}});
                         if(isRound){
                             current.getHistory().isRound=true;
                             current.getStat().isRound=true;
                         }
                     };
                     if(!player.phaseSkipped){
                         player.getHistory().isMe=true;
                         player.getStat().isMe=true;
                     }
                     if(isRound){
                         game.getGlobalHistory().isRound=true;
                     }
                 },
             },*/
  _usecard: {
    trigger: { global: "useCardAfter" },
    forced: true,
    popup: false,
    priority: -100,
    lastDo: true,
    silent: true,
    filter: function(event) {
      return !event._cleared && event.card.name != "wuxie";
    },
    async content(event, trigger, player) {
      game.broadcastAll(function() {
        ui.clear();
      });
      event._cleared = true;
    }
  },
  _discard: {
    trigger: { global: ["discardAfter", "loseToDiscardpileAfter", "loseAsyncAfter"] },
    forced: true,
    popup: false,
    priority: -100,
    lastDo: true,
    silent: true,
    filter: function(event) {
      return ui.todiscard[event.discardid] ? true : false;
    },
    async content(event, trigger, player) {
      game.broadcastAll(function(id) {
        var todiscard = ui.todiscard[id];
        delete ui.todiscard[id];
        if (todiscard) {
          var time = 1e3;
          if (typeof todiscard._discardtime == "number") {
            time += todiscard._discardtime - get.time();
          }
          if (time < 0) {
            time = 0;
          }
          setTimeout(function() {
            for (var i = 0; i < todiscard.length; i++) {
              todiscard[i].delete();
            }
          }, time);
        }
      }, trigger.discardid);
    }
  },
  _ismin: {
    mod: {
      cardEnabled: function(card, player) {
        if (player.isMin()) {
          if (get.type(card) == "equip") {
            return false;
          }
        }
      }
    }
  },
  _recasting: {
    enable: "phaseUse",
    logv: false,
    prompt: "将要重铸的牌置入弃牌堆并摸一张牌",
    filter: (event, player) => {
      const recasting = requireRegisteredSkill(lib.skill, "_recasting");
      const filterCard = recasting.filterCard;
      if (!filterCard) {
        throw new TypeError("_recasting filterCard is missing");
      }
      return player.hasCard((card) => {
        if (typeof filterCard !== "function") throw new TypeError("_recasting filterCard must be callable");
        return filterCard(card, player);
      }, recasting.position);
    },
    position: "he",
    filterCard: (card, player) => player.canRecast(card, null, true),
    discard: false,
    lose: false,
    delay: false,
    async content(event, trigger, player) {
      player.recast(event.cards, void 0, (player2, cards) => {
        var numberOfCardsToDraw = cards.length;
        const isStoneCard = (card) => {
          const type = get.type(card);
          if (type === void 0) {
            throw new TypeError("Stone recast requires a registered card type");
          }
          return type.startsWith("stone");
        };
        cards.forEach((value) => {
          if (lib.config.mode == "stone" && _status.mode == "deck" && !player2.isMin() && isStoneCard(value)) {
            const getStonecard = get.stonecard;
            if (typeof getStonecard != "function") {
              throw new TypeError("Stone deck mode requires get.stonecard");
            }
            var stonecard = getStonecard.call(get, 1, player2.career);
            if (stonecard.length) {
              numberOfCardsToDraw -= stonecard.length;
              player2.gain(game.createCard(stonecard.randomGet()), "draw");
            } else {
              player2.draw({
                drawDeck: 1
              }).log = false;
            }
          } else if (get.subtype(value) == "spell_gold") {
            var libCard = get.libCard((info) => info.subtype == "spell_silver");
            if (!libCard.length) {
              return;
            }
            numberOfCardsToDraw--;
            player2.gain(game.createCard(libCard.randomGet()), "draw");
          } else if (get.subtype(value) == "spell_silver") {
            var libCard = get.libCard((info) => info.subtype == "spell_bronze");
            if (!libCard.length) {
              return;
            }
            numberOfCardsToDraw--;
            player2.gain(game.createCard(libCard.randomGet()), "draw");
          }
        });
        if (numberOfCardsToDraw) {
          player2.draw(numberOfCardsToDraw, "nodelay").log = false;
        }
      });
    },
    ai: {
      basic: {
        order: 6
      },
      result: {
        player: 1
      }
    }
  },
  _lianhuan: {
    trigger: { player: "damageAfter" },
    filter: function(event, player) {
      return event.lianhuanable == true;
    },
    forced: true,
    popup: false,
    logv: false,
    forceDie: true,
    silent: true,
    forceOut: true,
    //priority:-5,
    content: [
      async (event, trigger, player) => {
        event.logvid = trigger.getLogv();
      },
      async (event, trigger, player) => {
        event.targets = game.filterPlayer(function(current) {
          return current != event.player && current.isLinked();
        });
        lib.tempSortSeat = _status.currentPhase || player;
        event.targets.sort(lib.sort.seat);
        delete lib.tempSortSeat;
        event._args = [trigger.num, trigger.nature, trigger.cards, trigger.card];
        if (trigger.source) {
          event._args.push(trigger.source);
        } else {
          event._args.push("nosource");
        }
      },
      async (event, trigger, player) => {
        const targets = event.getTargets();
        if (targets.length) {
          const target = targets.shift();
          if (!target) {
            return;
          }
          if (target.isLinked()) {
            target.damage.apply(target, event._args.slice(0));
          }
          event.redo();
        }
      }
    ]
  },
  _lianhuan4: {
    trigger: { player: "changeHp" },
    priority: -10,
    forced: true,
    popup: false,
    forceDie: true,
    silent: true,
    filter: function(event, player) {
      var evt = event.getParent();
      return evt && evt.name == "damage" && evt.hasNature("linked") && player.isLinked();
    },
    async content(event, trigger, player) {
      player.link();
      const parent = trigger.getParent();
      if (typeof parent.notLink != "function") {
        throw new TypeError("linked damage requires an event parent");
      }
      if (parent.notLink()) {
        Object.assign(trigger.getParent(), { lianhuanable: true });
      }
    }
  },
  //休整
  _rest_return: {
    trigger: { global: "phaseBefore" },
    forced: true,
    charlotte: true,
    silent: true,
    forceDie: true,
    forceOut: true,
    filter(event, player) {
      const playerid = player.playerid;
      if (typeof playerid !== "string") {
        return false;
      }
      const map = _status._rest_return?.[playerid];
      if (!map?.count || map?.count < 0) {
        return false;
      }
      if (map?.type == "round" && (event.player != player || event.skill)) {
        return false;
      }
      if (player.isIn()) {
        delete _status._rest_return?.[playerid];
      }
      return !event._rest_return && player.isOut();
    },
    async content(event, trigger, player) {
      const playerid = player.playerid;
      if (typeof playerid !== "string") {
        return;
      }
      const map = _status._rest_return?.[playerid];
      if (!map) {
        return;
      }
      if (map?.count && map?.count > 0) {
        game.broadcastAll((map2) => {
          map2.count--;
        }, map);
      }
      player.markSkill("_rest_return");
      trigger[event.name] = true;
      if (!map.count) {
        await player.restEnd();
      }
    },
    intro: {
      markcount(storage, player) {
        const playerid = player.playerid;
        const { type, count } = typeof playerid === "string" ? _status._rest_return?.[playerid] || {} : {};
        return !count || !type || count < 0 ? "∞" : count;
      },
      content(storage, player) {
        const playerid = player.playerid;
        const { type, count } = typeof playerid === "string" ? _status._rest_return?.[playerid] || {} : {};
        if (!count || !type || count < 0) {
          return `无限休整中，撅醒时机未知`;
        }
        return `还需休整${count}${type == "phase" ? "回合" : "轮"}`;
      }
    }
  },
  /**
   * @deprecated
   */
  _chongzhu: {
    get filter() {
      return requireRegisteredSkill(lib.skill, "_recasting").filter;
    },
    set filter(filter) {
      requireRegisteredSkill(lib.skill, "_recasting").filter = filter;
    },
    get filterCard() {
      return requireRegisteredSkill(lib.skill, "_recasting").filterCard;
    },
    set filterCard(filterCard) {
      requireRegisteredSkill(lib.skill, "_recasting").filterCard = filterCard;
    },
    get content() {
      return requireRegisteredSkill(lib.skill, "_recasting").content;
    },
    set content(content) {
      requireRegisteredSkill(lib.skill, "_recasting").content = content;
    },
    get ai() {
      return requireRegisteredSkill(lib.skill, "_recasting").ai;
    },
    set ai(ai) {
      requireRegisteredSkill(lib.skill, "_recasting").ai = ai;
    }
  }
};
export {
  statusAndRecastSkills
};
