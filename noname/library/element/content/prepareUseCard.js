import "../../../../noname.js";
import { requireRegisteredSkill } from "../../skillRegistry.js";
import { get } from "../../../get/binding.js";
import { lib } from "../../index.js";
import { game } from "../../../game/index.js";
import { _status } from "../../../status/index.js";
import { ui } from "../../../ui/index.js";
const prepareUseCard = [
  async (event, trigger, player) => {
    const { cards, card, num } = event;
    const targets = event.getTargets();
    if (!event.card) {
      console.log("err: no card", get.translation(event.player));
      event.finish();
      return;
    }
    if (!get.info(event.card, false).noForceDie) {
      event.forceDie = true;
    }
    let cardaudio = true;
    if (event.skill) {
      const skill = requireRegisteredSkill(lib.skill, event.skill);
      if (skill.audio) {
        cardaudio = false;
      }
      if (skill.log != false) {
        player.logSkill(event.skill, false, null, null, [event, event.player]);
      }
      if (get.info(event.skill).popname) {
        player.tryCardAnimate(event.card, event.card.name, "metal", true);
      }
    } else if (!event.nopopup) {
      const popupTranslation = lib.translate[`${event.card.name}_pop`];
      if (popupTranslation) {
        player.tryCardAnimate(event.card, popupTranslation, "metal");
      } else {
        player.tryCardAnimate(event.card, event.card.name, "metal");
      }
    }
    if (event.audio === false) {
      cardaudio = false;
    }
    if (cardaudio) {
      game.broadcastAll(
        (player2, card2) => {
          game.playCardAudio(card2, player2);
        },
        player,
        event.card
      );
    }
    event.id = get.id();
    if (!Array.isArray(event.excluded)) {
      event.excluded = [];
    }
    if (!Array.isArray(event.directHit)) {
      event.directHit = [];
    }
    if (typeof event.customArgs != "object" || typeof event.customArgs.default != "object") {
      event.customArgs = { default: {} };
    }
    if (typeof event.baseDamage != "number") {
      event.baseDamage = get.info(event.card, false).baseDamage || 1;
    }
    if (typeof event.effectCount != "number") {
      event.effectCount = get.info(event.card, false).effectCount || 1;
    }
    event.effectedCount = 0;
    if (event.oncard) {
      event.oncard(event.card, event.player);
    }
    player.actionHistory[player.actionHistory.length - 1].useCard.push(event);
    game.getGlobalHistory().useCard.push(event);
    if (event.addCount !== false) {
      const cardStats = player.stat[player.stat.length - 1].card;
      const cardName = event.card.name;
      cardStats[cardName] = (cardStats[cardName] ?? 0) + 1;
    }
    if (event.skill && event.addSkillCount !== false) {
      if (player.stat[player.stat.length - 1].skill[event.skill] == void 0) {
        player.stat[player.stat.length - 1].skill[event.skill] = 1;
      } else {
        player.stat[player.stat.length - 1].skill[event.skill]++;
      }
      const sourceSkill = get.info(event.skill).sourceSkill;
      if (sourceSkill) {
        if (player.stat[player.stat.length - 1].skill[sourceSkill] == void 0) {
          player.stat[player.stat.length - 1].skill[sourceSkill] = 1;
        } else {
          player.stat[player.stat.length - 1].skill[sourceSkill]++;
        }
      }
    }
    const loseMap = { noowner: [] };
    event.lose_map = loseMap;
    if (typeof player.playerid == "string") {
      loseMap[player.playerid] = [];
    }
    const cards_ow = event.cards.slice();
    while (cards_ow.length) {
      const owner = get.owner(cards_ow[0]);
      if (owner) {
        const id = owner.playerid;
        const Cards_card = cards.filter((card2) => get.owner(card2) == owner);
        cards_ow.removeArray(Cards_card);
        owner.getCards("ej").forEach((card2) => {
          const cardSymbol = card2.cardSymbol;
          const virtualCard = cardSymbol === void 0 ? void 0 : card2[cardSymbol];
          const virtualCards = virtualCard instanceof lib.element.VCard ? virtualCard.cards : void 0;
          const cardsx = Array.isArray(virtualCards) ? virtualCards.filter((cardx) => cards.includes(cardx)) : void 0;
          if (!cardsx || !cardsx.length) {
            return;
          }
          event.cards.removeArray(cardsx);
          event.cards.add(card2);
        });
        if (typeof id == "string") {
          loseMap[id] ??= [];
          loseMap[id].addArray(Cards_card);
        } else {
          loseMap.noowner.addArray(Cards_card);
        }
      } else {
        const noownerCard = cards_ow.shift();
        if (noownerCard) {
          loseMap.noowner.add(noownerCard);
        }
      }
    }
    player.useCardAnimateBefore?.(event, trigger, player);
    if (event.animate != false && event.throw !== false) {
      let throw_cards = event.cards;
      let virtualCard_str = "";
      for (const id in loseMap) {
        if (id == "noowner") {
          continue;
        }
        const owner = (_status.connectMode ? lib.playerOL : game.playerMap)[id];
        const throws = loseMap[id];
        if (owner == player) {
          if (!throw_cards.length && lib.config.card_animation_info) {
            const virtualCard = ui.create.card();
            virtualCard._destroy = true;
            virtualCard.expired = true;
            const info = lib.card[card.name];
            const number = card.number;
            virtualCard.init([get.suit(card), typeof number == "number" ? number : "虚拟", card.name, card.nature]);
            const infoNode = virtualCard.querySelector(".info");
            if (infoNode instanceof HTMLElement) {
              virtualCard_str = infoNode.innerHTML;
            }
            throw_cards = [virtualCard];
            throws.add(virtualCard);
          }
          if (lib.config.card_animation_info) {
            throws.addArray(loseMap.noowner);
          }
        }
        if (throws.length) {
          owner.$throw(throws);
        }
      }
      if (loseMap.noowner.length && !lib.config.card_animation_info) {
        for (const card2 of loseMap.noowner) {
          game.broadcastAll(
            (player2, card3, cardid) => {
              let event2;
              if (game.online) {
                event2 = {};
              } else {
                event2 = _status.event;
              }
              if (game.chess) {
                event2.node = card3.copy("thrown", "center", ui.arena).addTempClass("start");
              } else {
                event2.node = player2.$throwordered(card3.copy(), true);
              }
              if (lib.cardOL) {
                lib.cardOL[cardid] = event2.node;
              }
              event2.node.cardid = cardid;
              event2.node.classList.add("thrownhighlight");
            },
            player,
            card2,
            get.id()
          );
        }
      }
      if (lib.config.card_animation_info) {
        game.broadcastAll(
          (cards2, card2, card_cards, str) => {
            for (const nodex of cards2) {
              const node = nodex.clone;
              if (nodex._tempName) {
                nodex._tempName.delete();
                delete nodex._tempName;
              }
              if (!node) {
                continue;
              }
              if (str) {
                const infoNode = node.querySelector(".info");
                if (infoNode instanceof HTMLElement) {
                  infoNode.innerHTML = str;
                }
              }
              const cardCards = card2 instanceof lib.element.VCard ? card2.cards : void 0;
              const hasCardCards = Array.isArray(cardCards) && cardCards.length > 0;
              if (cards2.length > 1 || !card2.isCard || card2.name != node.name || card2.nature != node.nature || !hasCardCards) {
                ui.create.cardTempName(card2, node);
                if (node._tempName && (!card_cards || card_cards.length <= 0)) {
                  node._tempName.innerHTML = node._tempName.innerHTML.slice(0, node._tempName.innerHTML.indexOf("<span", -1));
                  node._tempName.innerHTML += "<span style='color:black'>虚拟</span></span>";
                }
              }
            }
          },
          throw_cards,
          event.card,
          event.cards,
          virtualCard_str
        );
      }
      if (lib.config.sync_speed && throw_cards[0] && throw_cards[0].clone) {
        const waitingForTransition = get.time();
        const waitingEvent = event;
        waitingEvent.waitingForTransition = waitingForTransition;
        throw_cards[0].clone.listenTransition(() => {
          if (_status.waitingForTransition == waitingForTransition && _status.paused) {
            game.resume();
          }
          delete waitingEvent.waitingForTransition;
        });
      }
    }
    if (event.cards.length) {
      const ownerCards = event.cards.filter((card2) => get.owner(card2));
      const directDiscard = event.cards.filter((card2) => !get.owner(card2));
      if (ownerCards.length) {
        let ownerx;
        for (const card2 of ownerCards) {
          const owner = get.owner(card2);
          if (!owner) {
            continue;
          }
          ownerx = owner;
          break;
        }
        if (cards.some((card2) => {
          const owner = get.owner(card2);
          if (!owner) {
            return true;
          }
          return owner != ownerx;
        })) {
          await game.loseAsync({ player, cards: ownerCards }).setContent(async (event2, trigger2, player2) => {
            const cards2 = event2.cards;
            const cards_noowner = [];
            while (cards2.length) {
              const owner = get.owner(cards2[0]);
              if (!owner) {
                const noownerCard = cards2.shift();
                if (noownerCard) {
                  cards_noowner.add(noownerCard);
                }
              } else {
                const id = owner.playerid;
                const onLoseCards = cards2.filter((card2) => get.owner(card2) == owner);
                event2.cards.removeArray(onLoseCards);
                await owner.lose({ cards: onLoseCards, position: ui.ordering, visible: true }).set("relatedEvent", event2.getParent()).set("getlx", false).set("type", "use");
              }
            }
            if (cards_noowner.length) {
              const ordering = game.cardsGotoOrdering(cards_noowner);
              if (ordering) {
                await ordering.set("relatedEvent", event2.getParent());
              }
            }
          });
        } else if (ownerx) {
          await ownerx.lose({ cards: ownerCards, position: ui.ordering, visible: true }).set("type", "use");
        }
      }
      if (directDiscard.length) {
        loseMap.noowner.addArray(directDiscard);
        await game.cardsGotoOrdering(directDiscard);
      }
    }
    await event.trigger("useCard0");
  },
  async (event, trigger, player) => {
    const { cards, card } = event;
    const num = Number(event.num);
    const targets = event.getTargets();
    const target = targets[num];
    if (event.animate != false && event.line != false && !event.hideTargets) {
      if (event.card.name == "wuxie" && event.getParent()._info_map) {
        let evtmap = event.getParent()._info_map;
        if (evtmap._source) {
          evtmap = evtmap._source;
        }
        const lining = (evtmap.multitarget ? evtmap.targets : evtmap.target) || event.player;
        if (Array.isArray(lining)) {
          const trigger2 = event.getTrigger();
          if (!trigger2) {
            throw new Error("useCard line animation requires its triggering event.");
          }
          if (trigger2.name == "jiedao") {
            player.line(lining[0], "green");
          } else {
            player.line(lining, "green");
          }
        } else {
          player.line(lining, "green");
        }
      } else if (event.card.name == "youdishenru" && event.getParent().source) {
        let lining = event.getParent().sourcex || event.getParent().source2 || event.getParent().source;
        if (lining == player && event.getParent().sourcex2) {
          lining = event.getParent().sourcex2;
        }
        if (Array.isArray(lining)) {
          const trigger2 = event.getTrigger();
          if (!trigger2) {
            throw new Error("useCard line animation requires its triggering event.");
          }
          if (trigger2.name == "jiedao") {
            player.line(lining[0], "green");
          } else {
            player.line(lining, "green");
          }
        } else {
          player.line(lining, "green");
        }
      } else {
        const config = {};
        const nature = get.natureList(event.card)[0];
        if (typeof nature == "string" && (nature || event.card instanceof lib.element.Card && event.card.classList.contains(nature))) {
          config.color = nature;
        }
        if (event.addedTarget) {
          player.line2(targets.concat(event.addedTargets), config);
        } else if (get.info(event.card, false).multitarget && targets.length > 1 && !get.info(event.card, false).multiline) {
          player.line2(targets, config);
        } else {
          player.line(targets, config);
        }
      }
    }
    if (targets.length && !event.hideTargets) {
      const str = targets.length == 1 && targets[0] == player ? "#b自己" : targets.sortBySeat();
      if (cards.length && !event.card.isCard) {
        if (event.addedTarget) {
          game.log(player, "对", str, "使用了", event.card, "（", cards, "，指向", event.addedTargets, "）");
        } else {
          game.log(player, "对", str, "使用了", event.card, "（", cards, "）");
        }
      } else {
        if (event.addedTarget) {
          game.log(player, "对", str, "使用了", event.card, "（指向", event.addedTargets, "）");
        } else {
          game.log(player, "对", str, "使用了", event.card);
        }
      }
    } else {
      if (cards.length && !event.card.isCard) {
        if (event.addedTarget) {
          game.log(player, "使用了", event.card, "（", cards, "，指向", event.addedTargets, "）");
        } else {
          game.log(player, "使用了", event.card, "（", cards, "）");
        }
      } else {
        if (event.addedTarget) {
          game.log(player, "使用了", event.card, "（指向", event.addedTargets, "）");
        } else {
          game.log(player, "使用了", event.card);
        }
      }
    }
    if (event.card.name == "wuxie") {
      const trigger2 = event.getTrigger();
      if (!trigger2) {
        throw new Error("wuxie history requires its triggering event.");
      }
      game.logv(player, [event.card, cards], [trigger2.card]);
    } else {
      game.logv(player, [event.card, cards], targets);
    }
    await event.trigger("useCard1");
  },
  async (event, trigger, player) => {
    const { cards, card, num } = event;
    const targets = event.getTargets();
    await event.trigger("yingbian");
  },
  async (event, trigger, player) => {
    const { cards, card, num } = event;
    const targets = event.getTargets();
    await event.trigger("useCard2");
  }
];
export {
  prepareUseCard
};
