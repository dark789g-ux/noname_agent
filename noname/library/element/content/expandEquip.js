import "../../../../noname.js";
import "../gameEvent.js";
import { getButtonSubtypes } from "../GameEvent/buttonSubtypes.js";
import { normalizeSelectionResult, isVCardLinks } from "./selectionResults.js";
import { game } from "../../../game/index.js";
import { get } from "../../../get/binding.js";
import { lib } from "../../index.js";
import { _status } from "../../../status/index.js";
import { ui } from "../../../ui/index.js";
import { initializeEvent } from "../GameEvent/initializeEvent.js";
const expandEquipContent = {
  async expandEquip(event, trigger, player) {
    const { slots } = event;
    if (!slots.length) {
      return;
    }
    const slotsx = [];
    if (get.is.mountCombined()) {
      for (const slot of slots) {
        if (slot == "equip3" || slot == "equip4") {
          slotsx.add("equip3_4");
        } else {
          slotsx.add(slot);
        }
      }
    } else {
      slotsx.addArray(slots);
    }
    slotsx.sort();
    for (const slot of slotsx) {
      let expand = get.numOf(slots, slot);
      let slot_key = slot;
      if (slot == "equip3_4") {
        expand = Math.max(get.numOf(slots, "equip3"), get.numOf(slots, "equip4"));
        slot_key = "equip3";
      }
      game.log(player, `获得了${get.cnNumber(expand)}个额外的`, `#g${get.translation(slot)}栏`);
      player.expandedSlots ??= {};
      player.expandedSlots[slot_key] ??= 0;
      player.expandedSlots[slot_key] += expand;
    }
    player.$syncExpand();
  },
  //选择顶装备要顶的牌
  async replaceEquip(event, trigger, player) {
    const vcards = [];
    const cardSymbol = event.card.cardSymbol;
    const vcard = cardSymbol !== void 0 ? event.card[cardSymbol] : void 0;
    vcards.push(vcard || get.autoViewAs(event.card, void 0, false));
    const specializedVCards = [];
    const normalVCards = [];
    const replacedCards = [];
    vcards.forEach((card) => {
      const info = get.info(card, false);
      (info?.customSwap ? specializedVCards : normalVCards).push(card);
    });
    specializedVCards.forEach((card) => {
      const info = get.info(card, false);
      replacedCards.addArray(player.getVCards("e", (card2) => info.customSwap(card2)));
    });
    const types = normalVCards.reduce((types2, card) => types2.concat(get.subtypes(card, false)), []);
    if (types.length > 0) {
      const slots = types;
      const slotsx = [];
      if (get.is.mountCombined()) {
        slots.forEach((type) => {
          if (type == "equip3" || type == "equip4") {
            slotsx.add("equip3_4");
          } else {
            slotsx.add(type);
          }
        });
      } else {
        slotsx.addArray(slots);
      }
      slotsx.sort();
      for (const slot of slotsx) {
        const left = player.countEquipableSlot(slot);
        let lose;
        if (slot == "equip3_4") {
          lose = Math.min(left, Math.max(get.numOf(slots, "equip3"), get.numOf(slots, "equip4")));
        } else {
          lose = Math.min(left, get.numOf(slots, slot));
        }
        let result;
        if (lose <= 0) {
          continue;
        } else {
          const cards = player.getVEquips(slot).filter((card) => !replacedCards.includes(card) && lib.filter.canBeReplaced(card, player));
          if (cards.length > 0) {
            if (lose >= left) {
              result = { bool: true, links: cards };
            } else if (cards.length > left - lose) {
              let source = event.source;
              const num = cards.length - (left - lose);
              if (!source || !source.isIn()) {
                source = player;
              }
              const chooseEvent = source.chooseButton({
                createDialog: [`选择替换掉${get.cnNumber(num)}张${get.translation(slot)}装备牌`, [cards, "vcard"]],
                forced: true,
                selectButton: [1, num]
              }).set("filterOk", () => {
                const evt = _status.event;
                return ui.selected.buttons.reduce((num2, button) => {
                  if (evt.slot == "equip3_4") {
                    return num2 + Math.max(get.numOf(getButtonSubtypes("link" in button ? button.link : void 0), "equip3"), get.numOf(getButtonSubtypes("link" in button ? button.link : void 0), "equip4"));
                  }
                  return num2 + get.numOf(getButtonSubtypes("link" in button ? button.link : void 0), evt.slot);
                }, 0) == evt.required;
              }).set("required", num).set("slot", slot);
              result = normalizeSelectionResult(await chooseEvent.forResult());
            }
          }
        }
        if (typeof result !== "string" && isVCardLinks(result?.links)) {
          replacedCards.addArray(result.links);
        }
      }
    }
    event.result = {
      vcards: replacedCards,
      cards: player.getCards("e", (i) => {
        const cardSymbol2 = i.cardSymbol;
        return cardSymbol2 !== void 0 && replacedCards.includes(i[cardSymbol2]);
      })
    };
  },
  //装备牌
  async equip(event, trigger, player) {
    event.visible = true;
    if (event.cards.length > 1 && event.cards.some((cardx) => cardx.isViewAsCard)) {
      event.untrigger();
      return;
    }
    const loseCards = [];
    if (event.card.isViewAsCard) {
      loseCards.add(event.card);
    } else {
      loseCards.addArray(event.cards);
    }
    if (loseCards.length) {
      const map = {};
      for (const i of loseCards) {
        const owner = get.owner(i, "judge");
        if (owner && (owner != player || get.position(i) != "e")) {
          const id = owner.playerid;
          if (typeof id !== "string") {
            continue;
          }
          if (!map[id]) {
            map[id] = [[], [], []];
          }
          map[id][0].push(i);
          const position = get.position(i);
          if (position == "h") {
            map[id][1].push(i);
          } else {
            map[id][2].push(i);
          }
        } else if (!event.updatePile && get.position(i) == "c") {
          event.updatePile = true;
        }
        if (event.visible) {
          i.addKnower("everyone");
        }
      }
      event.losing_map = map;
      for (const i in map) {
        const owner = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
        const next = owner.lose({ cards: map[i][0], position: ui.special }).set("type", "equip").set("forceDie", true).set("getlx", false);
        if (event.visible == true) {
          next.visible = true;
        }
        await next;
        event.relatedLose = next;
      }
      for (const [key, value] of lib.commonArea) {
        const list2 = (_status[value.areaStatusName] || []).filter((card2) => loseCards.includes(card2));
        if (event[value.fromName] || list2.length) {
          const next = initializeEvent(game.createEvent(`from_${value.fromName}`), { cards: list2 });
          next.setContent(value.removeHandeler);
          next.player = player;
          next.type = event.name;
          await next;
        }
      }
    }
    player.equiping = true;
    const handleEquip = async (card2) => {
      const cards = event.cards;
      const cardInfo2 = get.info(card2, false);
      if (player.isMin() || !player.canEquip(card2)) {
        await game.cardsDiscard(cards);
        delete player.equiping;
        return;
      }
      let audioSubtype = get.subtype(card2);
      if (audioSubtype == "equip6") {
        audioSubtype = "equip3";
      }
      game.broadcastAll((type) => {
        if (lib.config.background_audio) {
          game.playAudio("effect", type);
        }
      }, audioSubtype);
      player.addVirtualEquip(card2, cards);
      if (event.log != false) {
        const isViewAsCard = cards.length !== 1 || cards[0].name !== card2.name;
        if (isViewAsCard && cards.length) {
          game.log(player, `装备了<span class="yellowtext">${get.translation(card2)}</span>（`, cards, "）");
        } else {
          game.log(player, "装备了", card2);
        }
      }
      if (cardInfo2.onEquip && (!cardInfo2.filterEquip || cardInfo2.filterEquip(card2, player))) {
        if (Array.isArray(cardInfo2.onEquip)) {
          for (const onEquip of cardInfo2.onEquip) {
            const next = game.createEvent(`equip_${card2.name}`);
            next.setContent(onEquip);
            next.player = player;
            next.card = event.vcards[0];
            await next;
          }
        } else {
          const next = game.createEvent(`equip_${card2.name}`);
          next.setContent(cardInfo2.onEquip);
          next.player = player;
          next.card = event.vcards[0];
          await next;
        }
        if (cardInfo2.equipDelay != false) {
          await game.delayx();
        }
      }
      delete player.equiping;
      if (event.delay) {
        await game.delayx();
      }
    };
    let stop = false;
    const list = [];
    for (const cardx of event.cards) {
      if (cardx.willBeDestroyed("equip", player, event)) {
        cardx.selfDestroy(event);
        stop = true;
      } else if ("hejx".includes(get.position(cardx, true))) {
        stop = true;
      } else {
        list.add(cardx);
      }
    }
    if (stop) {
      if (list.length) {
        await game.cardsDiscard(list);
      }
      return;
    }
    event.vcards = [];
    const card = event.card;
    if (get.itemtype(card) === "card" && !card.isViewAsCard) {
      event.card = card.cardSymbol ? card[card.cardSymbol] : get.autoViewAs(card, void 0, false);
      event.vcards.push(event.card);
    } else {
      if (get.itemtype(card) === "card" && card.isViewAsCard) {
        const cardSymbol = card.cardSymbol;
        const cardSymbolKey = cardSymbol === void 0 ? "undefined" : cardSymbol;
        event.vcards.push(card[cardSymbolKey]);
      } else {
        event.vcards.push(card);
      }
    }
    const cardInfo = get.info(event.card, false);
    if (cardInfo.prepareEquip && (!cardInfo.filterEquip || cardInfo.filterEquip(event.card, player))) {
      const next = game.createEvent(`prepare_${event.card.name}`);
      next.setContent(cardInfo.prepareEquip);
      next.player = player;
      next.card = event.card;
      await next;
    }
    if (event.cards.length) {
      if (event.draw) {
        player.$draw(event.cards);
        await game.delay(0, 300);
      } else {
        game.broadcast(
          (cards, player2) => {
            cards.forEach((card2) => {
              if (card2.clone) {
                card2.clone.moveDelete(player2);
              }
            });
          },
          event.cards,
          player
        );
        event.cards.forEach((card2) => {
          if (card2.clone) {
            card2.clone.moveDelete(player);
            game.addVideo("gain2", player, get.cardsInfo([card2.clone]));
          }
        });
      }
    }
    const replaceEquipEvent = game.createEvent("replaceEquip");
    replaceEquipEvent.player = player;
    replaceEquipEvent.card = event.card;
    replaceEquipEvent.setContent("replaceEquip");
    const result = await replaceEquipEvent.forResult();
    if (typeof result !== "string" && Array.isArray(result.cards) && get.itemtype(result.cards) == "cards") {
      event.swapped = true;
      const loseEvent = player.lose({ cards: result.cards, visible: true }).set("type", "equip").set("getlx", false);
      loseEvent.swapEquip = true;
      if (get.info(event.card, false)?.loseThrow) {
        player.$throw(result.cards, 1e3);
      }
      await loseEvent;
      for (const card2 of result.cards) {
        if (card2.willBeDestroyed("discardPile", player, event)) {
          card2.selfDestroy(event);
        }
      }
    }
    await handleEquip(event.card);
    if (event.card instanceof lib.element.Card) {
      const cardSymbol = event.card.cardSymbol;
      if (cardSymbol !== void 0) {
        const virtualCard = event.card[cardSymbol];
        if (virtualCard instanceof lib.element.VCard) {
          event.card = virtualCard;
        }
      }
    }
    if (event.updatePile) {
      game.updateRoundNumber();
    }
  },
  //装备栏 END
  async changeGroup(event, trigger, player) {
    event.originGroup = player.group;
    event.group ??= player.group;
    const group = event.group;
    game.addVideo("changeGroup", player, group);
    player.getHistory("custom").push(event);
    if (event.broadcast !== false) {
      game.broadcast(
        (player2, group2) => {
          player2.group = group2;
          player2.node.name.dataset.nature = get.groupnature(group2);
        },
        player,
        group
      );
    }
    player.group = group;
    player.node.name.dataset.nature = get.groupnature(group);
    if (event.log !== false) {
      game.log(player, "将势力变为了", `#y${get.translation(group + 2)}`);
    }
  }
};
export {
  expandEquipContent
};
