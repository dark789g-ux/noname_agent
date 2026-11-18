import "../../../../noname.js";
import { requireRegisteredSkill } from "../../skillRegistry.js";
import { game } from "../../../game/index.js";
import { ui } from "../../../ui/index.js";
import { lib } from "../../index.js";
import { get } from "../../../get/binding.js";
import { _status } from "../../../status/index.js";
const discardContent = {
  async discard(event, trigger, player) {
    const { cards } = event;
    game.log(player, "弃置了", cards);
    event.done = player.lose({ cards, position: event.position, visible: true });
    event.done.type = "discard";
    if (event.discarder) {
      event.done.discarder = event.discarder;
    }
    await event.done;
    await event.trigger("discard");
  },
  async loseToDiscardpile(event, trigger, player) {
    const { cards } = event;
    if (event.log != false) {
      game.log(player, "将", cards, "置入了弃牌堆");
    }
    const next = player.lose({ cards, position: event.position });
    if (event.insert_index) {
      next.insert_index = event.insert_index;
    }
    if (event.insert_card) {
      next.insert_card = true;
    }
    if (!event.blank) {
      next.visible = true;
    }
    next.type = "loseToDiscardpile";
    event.done = next;
    await next;
    await event.trigger("loseToDiscardpile");
  },
  respond: [
    async (event, trigger, player) => {
      const { cards, card } = event;
      let cardaudio = true;
      if (event.skill) {
        const skill = requireRegisteredSkill(lib.skill, event.skill);
        if (skill.audio) {
          cardaudio = false;
        }
        if (skill.log != false) {
          const logAudioArgs = [event, event.player];
          player.logSkill(event.skill, false, null, null, logAudioArgs);
        }
        player.checkShow(event.skill, true);
        const onrespond = skill.onrespond;
        if (typeof onrespond == "function" && !game.online) {
          onrespond.call(skill, event, player);
        }
      } else if (!event.nopopup) {
        if (event.card && typeof event.card.name == "string") {
          const card2 = event.card instanceof lib.element.Card || event.card instanceof lib.element.VCard ? event.card : new lib.element.VCard(event.card);
          player.tryCardAnimate(card2, card2.name, "wood");
        }
      }
      if (cardaudio && event.getParent(3).name == "useCard") {
        game.broadcastAll(
          (player2, card2) => {
            game.playCardAudio(card2, player2);
          },
          player,
          event.card
        );
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
      if (cards.length && (cards.length > 1 || cards[0].name != event.card.name)) {
        game.log(player, "打出了", event.card, "（", cards, "）");
      } else {
        game.log(player, "打出了", event.card);
      }
      player.actionHistory[player.actionHistory.length - 1].respond.push(event);
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
            const cardsx = cardSymbol !== void 0 ? card2[cardSymbol]?.cards?.filter((cardx) => cards.includes(cardx)) : void 0;
            if (!cardsx?.length) {
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
      player.respondAnimateBefore?.(event, trigger, player);
      if (event.animate != false && event.throw !== false) {
        let throw_cards = cards;
        let virtualCard_str = "";
        for (const id in loseMap) {
          if (id == "noowner") {
            continue;
          }
          const owner = (_status.connectMode ? lib.playerOL : game.playerMap)[id];
          const throws = loseMap[id];
          if (owner == player) {
            if (!throw_cards.length && lib.config.card_animation_info) {
              const virtualCard = ui.create.card(void 0, void 0, void 0);
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
            (cards2, card2, card_cards, str, judgeing) => {
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
                if ((cards2.length > 1 || !card2.isCard || card2.name != node.name || card2.nature != node.nature || !card2.cards?.length) && !judgeing) {
                  ui.create.cardTempName(card2, node);
                  if (node._tempName && card_cards?.length <= 0) {
                    node._tempName.innerHTML = node._tempName.innerHTML.slice(0, node._tempName.innerHTML.indexOf("<span", -1));
                    node._tempName.innerHTML += "<span style='color:black'>虚拟</span></span>";
                  }
                }
              }
            },
            throw_cards,
            event.card,
            event.cards,
            virtualCard_str,
            Boolean(event.highlight)
          );
        }
        if (event.highlight) {
          for (const card2 of throw_cards) {
            if (card2.clone) {
              card2.clone.classList.add("thrownhighlight");
              game.addVideo("highlightnode", player, get.cardInfo(card2));
            }
          }
        }
        if (event.highlight) {
          game.broadcast((cards2) => {
            for (const card2 of cards2) {
              if (card2.clone) {
                card2.clone.classList.add("thrownhighlight");
              }
            }
          }, throw_cards);
        }
      }
      if (cards.length) {
        const ownerCards = cards.filter((card2) => get.owner(card2));
        const directDiscard = cards.filter((card2) => !get.owner(card2));
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
                  await owner.lose(onLoseCards, "visible", ui.ordering).set("relatedEvent", event2.getParent()).set("getlx", false).set("type", "use");
                }
              }
              if (cards_noowner.length) {
                const ordering = game.cardsGotoOrdering(cards_noowner);
                if (ordering) {
                  await ordering.set("relatedEvent", event2.getParent());
                }
              }
            });
          } else {
            if (ownerx) {
              await ownerx.lose({ cards: ownerCards, position: ui.ordering, visible: true }).set("type", "use");
            }
          }
        }
        if (directDiscard.length) {
          loseMap.noowner.addArray(directDiscard);
          await game.cardsGotoOrdering(directDiscard);
        }
      }
      await event.trigger("respond");
      await game.delayx(0.5);
    }
  ],
  async swapHandcards(event, trigger, player) {
    const target = event.getTarget();
    event.cards1 = event.cards1 || player.getCards("h");
    event.cards2 = event.cards2 || target.getCards("h");
    await game.loseAsync({
      player,
      target,
      cards1: event.cards1,
      cards2: event.cards2
    }).setContent("swapHandcardsx");
    await game.loseAsync({
      gain_list: [
        [player, event.cards2.filterInD()],
        [target, event.cards1.filterInD()]
      ]
    }).setContent("gaincardMultiple");
    await game.delayx();
  },
  async swapHandcardsx(event, trigger, player) {
    const target = event.getTarget();
    const { cards1, cards2 } = event;
    player.$giveAuto(cards1, target);
    target.$giveAuto(cards2, player);
    let delayed = false;
    let cards = cards1;
    const next1 = player.lose(cards, ui.ordering);
    next1.getlx = false;
    next1.relatedEvent = event.getParent();
    if (player == game.me) {
      delayed = true;
    } else {
      next1.delay = false;
    }
    await next1;
    cards = event.cards2;
    const next2 = target.lose(cards, ui.ordering);
    next2.getlx = false;
    next2.relatedEvent = event.getParent();
    if (target == game.me) {
      delayed = true;
    } else {
      next2.delay = false;
    }
    await next2;
    if (!delayed) {
      await game.delay();
    }
  },
  async gainMultiple(event, trigger, player) {
    const targets = [...event.getTargets()].sortBySeat();
    const map = /* @__PURE__ */ new Map();
    for (const target of targets.sortBySeat()) {
      const next = player.gainPlayerCard({ target, position: event.position, forced: true }).set("boolline", false).set("delay", false);
      next.gaintag.addArray(event.gaintag);
      const result = await next.forResult();
      if (typeof result !== "string" && result.bool && Array.isArray(result.cards) && result.cards.length) {
        map.set(target, result.cards);
      }
    }
    event.cards = Array.from(map.values()).flat();
    event.result = {
      bool: true,
      cards: event.cards,
      targets,
      gain_map: map
    };
    await game.delay();
  }
};
export {
  discardContent
};
