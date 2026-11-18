import "../../../noname.js";
import "../skillRegistry.js";
import { get } from "../../get/binding.js";
import { _status } from "../../status/index.js";
import { game } from "../../game/index.js";
import { lib } from "../index.js";
const zhengsuSkills = {
  zhengsu: {
    trigger: { player: "phaseDiscardEnd" },
    forced: true,
    charlotte: true,
    filter: function(event, player) {
      return player.storage.zhengsu_leijin || player.storage.zhengsu_bianzhen || player.storage.zhengsu_mingzhi;
    },
    filterx: function(skill, player) {
      const zhengsus = player.storage[skill];
      if (!zhengsus || !zhengsus.length) {
        return false;
      }
      return zhengsus.some((zhengsu) => player.storage[zhengsu]);
    },
    async content(event, trigger, player) {
      await player.chooseDrawRecover({
        num1: 2,
        prompt: "整肃奖励：摸两张牌或回复1点体力",
        forced: true
      });
    },
    subSkill: {
      leijin: {
        mod: {
          aiOrder: function(player, card, num) {
            if (typeof card.number != "number") {
              return;
            }
            const history = player.getHistory("useCard", (evt) => evt.isPhaseUsing(player));
            if (history.length == 0) {
              return num + 10 * (14 - card.number);
            }
            let lastNumber = get.number(history[0].card);
            if (typeof lastNumber != "number") {
              return;
            }
            for (let i = 1; i < history.length; i++) {
              const currentNumber = get.number(history[i].card);
              if (typeof currentNumber != "number" || currentNumber <= lastNumber) {
                return;
              }
              lastNumber = currentNumber;
            }
            if (card.number > lastNumber) {
              return num + 10 * (14 - card.number);
            }
          }
        },
        mark: true,
        trigger: { player: "useCard1" },
        lastDo: true,
        charlotte: true,
        forced: true,
        popup: false,
        nopop: true,
        onremove: true,
        filter: function(event, player) {
          return player.isPhaseUsing() && player.storage.zhengsu_leijin !== false;
        },
        async content(event, trigger, player) {
          var list = player.getHistory("useCard", function(evt) {
            return evt.isPhaseUsing(player);
          });
          var goon = true;
          for (var i = 0; i < list.length; i++) {
            var num = get.number(list[i].card);
            if (typeof num != "number") {
              goon = false;
              break;
            }
            if (i > 0) {
              var num2 = get.number(list[i - 1].card);
              if (typeof num2 != "number" || num2 >= num) {
                goon = false;
                break;
              }
            }
          }
          if (!goon) {
            game.broadcastAll(function(player2) {
              player2.storage.zhengsu_leijin = false;
              const markText = player2.marks.zhengsu_leijin?.firstElementChild;
              if (markText instanceof HTMLElement) {
                markText.innerHTML = "╳";
              }
              delete player2.storage.zhengsu_leijin_markcount;
            }, player);
          } else {
            if (list.length > 2) {
              game.broadcastAll(
                function(player2, num3) {
                  const markText = player2.marks.zhengsu_leijin?.firstElementChild;
                  if (markText instanceof HTMLElement) {
                    markText.innerHTML = "○";
                  }
                  player2.storage.zhengsu_leijin = true;
                  player2.storage.zhengsu_leijin_markcount = num3;
                },
                player,
                num
              );
            } else {
              game.broadcastAll(
                function(player2, num3) {
                  player2.storage.zhengsu_leijin_markcount = num3;
                },
                player,
                num
              );
            }
          }
          player.markSkill("zhengsu_leijin");
        },
        intro: {
          content: "<li>条件：回合内所有于出牌阶段使用的牌点数递增且不少于三张。"
        }
      },
      bianzhen: {
        mark: true,
        trigger: { player: "useCard1" },
        firstDo: true,
        charlotte: true,
        forced: true,
        popup: false,
        nopop: true,
        onremove: true,
        filter: function(event, player) {
          return player.isPhaseUsing() && player.storage.zhengsu_bianzhen !== false;
        },
        async content(event, trigger, player) {
          var list = player.getHistory("useCard", function(evt) {
            return evt.isPhaseUsing(player);
          });
          var goon = true, suit = get.suit(list[0].card, false);
          if (suit == "none") {
            goon = false;
          } else {
            for (var i = 1; i < list.length; i++) {
              if (get.suit(list[i].card) != suit) {
                goon = false;
                break;
              }
            }
          }
          if (!goon) {
            game.broadcastAll(function(player2) {
              player2.storage.zhengsu_bianzhen = false;
              const markText = player2.marks.zhengsu_bianzhen?.firstElementChild;
              if (markText instanceof HTMLElement) {
                markText.innerHTML = "╳";
              }
            }, player);
          } else {
            if (list.length > 1) {
              game.broadcastAll(function(player2) {
                const markText = player2.marks.zhengsu_bianzhen?.firstElementChild;
                if (markText instanceof HTMLElement) {
                  markText.innerHTML = "○";
                }
                player2.storage.zhengsu_bianzhen = true;
              }, player);
            } else {
              game.broadcastAll(
                function(player2, suit2) {
                  const markText = player2.marks.zhengsu_bianzhen?.firstElementChild;
                  if (markText instanceof HTMLElement) {
                    markText.innerHTML = get.translation(suit2);
                  }
                },
                player,
                suit
              );
            }
          }
          player.markSkill("zhengsu_bianzhen");
        },
        intro: {
          content: "<li>条件：回合内所有于出牌阶段使用的牌花色相同且不少于两张。"
        },
        ai: {
          effect: {
            player_use: function(card, player, target) {
              if (typeof card != "object" || !player.isPhaseUsing()) {
                return;
              }
              var suitx = get.suit(card);
              if (typeof suitx != "string" || !lib.suit.includes(suitx)) {
                return;
              }
              var history = player.getHistory("useCard");
              if (!history.length) {
                var val = 0;
                if (player.hasCard(function(cardx) {
                  return get.suit(cardx) == suitx && card != cardx && (!card.cards || !card.cards.includes(cardx)) && player.hasValueTarget(cardx);
                }, "hs")) {
                  val = [2, 0.1];
                }
                if (val) {
                  return val;
                }
                return;
              }
              var num = 0;
              var suit = false;
              for (var i = 0; i < history.length; i++) {
                var suit2 = get.suit(history[i].card);
                if (typeof suit2 != "string" || !lib.suit.includes(suit2)) {
                  return;
                }
                if (suit && suit != suit2) {
                  return;
                }
                suit = suit2;
                num++;
              }
              if (suitx == suit && num == 1) {
                return [1, 0.1];
              }
              if (suitx != suit && (num > 1 || num <= 1 && player.hasCard(function(cardx) {
                return get.suit(cardx) == suit && player.hasValueTarget(cardx);
              }, "hs"))) {
                return "zeroplayertarget";
              }
            }
          }
        }
      },
      mingzhi: {
        mark: true,
        trigger: { player: "loseAfter" },
        firstDo: true,
        charlotte: true,
        forced: true,
        popup: false,
        nopop: true,
        onremove: true,
        filter: function(event, player) {
          if (player.storage.zhengsu_mingzhi === false || event.type != "discard") {
            return false;
          }
          var evt = event.getParent("phaseDiscard");
          return evt && evt.player == player;
        },
        async content(event, trigger, player) {
          var goon = true, list = [];
          player.getHistory("lose", function(event2) {
            if (!goon || event2.type != "discard") {
              return false;
            }
            var evt = event2.getParent("phaseDiscard");
            if (evt && evt.player == player) {
              for (var i of event2.cards2) {
                var suit = get.suit(i, player);
                if (typeof suit != "string") {
                  goon = false;
                  break;
                }
                if (list.includes(suit)) {
                  goon = false;
                  break;
                } else {
                  list.push(suit);
                }
              }
            }
            return true;
          });
          if (!goon) {
            game.broadcastAll(function(player2) {
              player2.storage.zhengsu_mingzhi = false;
              const markText = player2.marks.zhengsu_mingzhi?.firstElementChild;
              if (markText instanceof HTMLElement) {
                markText.innerHTML = "╳";
              }
              delete player2.storage.zhengsu_mingzhi_list;
            }, player);
          } else {
            if (list.length > 1) {
              game.broadcastAll(
                function(player2, list2) {
                  const markText = player2.marks.zhengsu_mingzhi?.firstElementChild;
                  if (markText instanceof HTMLElement) {
                    markText.innerHTML = "○";
                  }
                  player2.storage.zhengsu_mingzhi = true;
                  player2.storage.zhengsu_mingzhi_list = list2;
                  player2.storage.zhengsu_mingzhi_markcount = list2.length;
                },
                player,
                list
              );
            } else {
              game.broadcastAll(
                function(player2, list2) {
                  player2.storage.zhengsu_mingzhi_list = list2;
                  player2.storage.zhengsu_mingzhi_markcount = list2.length;
                },
                player,
                list
              );
            }
          }
          player.markSkill("zhengsu_mingzhi");
        },
        intro: {
          content: "<li>条件：回合内所有于弃牌阶段弃置的牌花色均不相同且不少于两张。"
        }
      }
    }
  },
  renku: {
    intro: {
      markcount: function() {
        return _status.renku.length;
      },
      mark: function(dialog, content, player) {
        if (!_status.renku.length) {
          return "仁库中没有牌";
        } else {
          dialog.addAuto(_status.renku);
        }
      },
      content: function() {
        if (!_status.renku.length) {
          return "仁库中没有牌";
        }
        return get.translation(_status.renku);
      }
    }
  },
  _showHiddenCharacter: {
    trigger: { player: ["changeHp", "phaseBeginStart", "loseMaxHpBegin", "gainMaxHpBegin"] },
    firstDo: true,
    forced: true,
    popup: false,
    priority: 25,
    filter: function(event, player, name) {
      return player.isUnseen(2) && get.mode() != "guozhan";
    },
    async content(event, trigger, player) {
      player.showCharacter(2);
      player.removeSkill("g_hidden_ai");
    }
  },
  _kamisha: {
    trigger: { source: "damageBegin2" },
    //forced:true,
    popup: false,
    prompt: function(event, player) {
      return "是否防止即将对" + get.translation(event.player) + "造成的伤害，改为令其减少" + get.cnNumber(event.num) + "点体力上限？";
    },
    filter: function(event, player) {
      return event.hasNature("kami") && Number(event.num) > 0;
    },
    ruleSkill: true,
    check: function(event, player) {
      const eventPlayer = event.getPlayer();
      var att = get.attitude(player, eventPlayer);
      if (eventPlayer.hp == eventPlayer.maxHp) {
        return att < 0;
      }
      if (eventPlayer.hp == Number(eventPlayer.maxHp) - 1 && (Number(eventPlayer.maxHp) <= 3 || eventPlayer.hasSkillTag("maixie"))) {
        return att < 0;
      }
      return att > 0;
    },
    async content(event, trigger, player) {
      trigger.cancel();
      trigger.getPlayer().loseMaxHp({ num: trigger.num }).source = player;
    }
  },
  _doublegroup_choice: {
    trigger: {
      global: "gameStart",
      player: "enterGame"
    },
    firstDo: true,
    forced: true,
    popup: false,
    priority: 25,
    charlotte: true,
    filter: function(event, player) {
      const groups = get.selectGroup(player.name1), type = get.selectGroup(player.name1, true);
      return get.mode() != "guozhan" && groups.length > 0 && typeof type == "string" && type == "double" && !player._groupChosen;
    },
    async content(event, trigger, player) {
      const groups = get.selectGroup(player.name1), type = get.selectGroup(player.name1, true);
      if (!Array.isArray(groups) || typeof type != "string") {
        return;
      }
      player._groupChosen = type;
      const result = await player.chooseButton({
        prompt: "请选择你的势力",
        createDialog: ["请选择你的势力", [groups.map((group) => ["", "", `group_${group}`]), "vcard"]],
        forced: true
      }).set("direct", true).forResult();
      if (typeof result == "string" || !result.bool || !Array.isArray(result.links) || !result.links.length) {
        return;
      }
      const link = result.links[0];
      if (!Array.isArray(link) || typeof link[2] != "string") {
        return;
      }
      await player.changeGroup(link[2].slice(6));
    }
  }
};
export {
  zhengsuSkills
};
