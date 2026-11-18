import "../../../../../noname.js";
import { game } from "../../../../game/index.js";
import { get } from "../../../../get/binding.js";
import { ui } from "../../../../ui/index.js";
import { lib } from "../../../index.js";
import { _status } from "../../../../status/index.js";
const virtualJudgeAndTriggerMethods = {
  addEquipTrigger(card) {
    if (card) {
      const skills = get.skillsFromEquips([card]);
      if (skills?.length) {
        skills.forEach((i) => this.addSkillTrigger(i));
      }
    } else {
      const es = this.getVCards("e");
      for (let i = 0; i < es.length; i++) {
        this.addEquipTrigger(es[i]);
      }
    }
    _status.event.clearStepCache();
    return this;
  },
  removeVirtualJudge(VCard) {
    const player = this;
    game.addVideo("removeVirtualJudge", player, get.vcardInfo(VCard));
    game.broadcast(
      (VCard2, player2) => {
        const cards2 = player2.vcardsMap?.judges;
        if (cards2 && cards2.includes(VCard2)) {
          cards2.remove(VCard2);
        }
      },
      VCard,
      player
    );
    const cards = player.vcardsMap?.judges;
    if (cards && cards.includes(VCard)) {
      cards.remove(VCard);
    }
    if (VCard.storage.equipEnable && VCard.cards?.some((card) => get.type(card) == "equip")) {
      const es = player.getVCards("e"), equips = VCard.cards;
      if (equips.length) {
        const keepSkills = Object.values(player.additionalSkills).flat().concat(get.skillsFromEquips(es)), skills = get.skillsFromEquips(equips).removeArray(keepSkills);
        if (skills.length) {
          player.removeSkill(skills);
        }
      }
    }
  },
  removeEquipTrigger(card, hasMove) {
    if (_status.video) {
      return;
    }
    if (card) {
      const info = get.info(card, false);
      const skills = this.getSkills(null, false);
      const VEquips = this.getVCards("e");
      const equip = VEquips.find((current) => current === card);
      if (equip) {
        VEquips.remove(equip);
      }
      skills.addArray(get.skillsFromEquips(VEquips));
      const cards = this.vcardsMap?.equips;
      const mappedEquip = cards?.find((current) => current === card);
      if (mappedEquip && hasMove !== true) {
        cards?.remove(mappedEquip);
      }
      if (info.skills) {
        for (let j = 0; j < info.skills.length; j++) {
          if (skills.includes(info.skills[j])) {
            continue;
          }
          this.removeSkillTrigger(info.skills[j]);
        }
      }
      if (info.clearLose && typeof info.onLose == "function") {
        const next = game.createEvent("lose_" + card.name);
        next.setContent(info.onLose);
        next.player = this;
        next.card = card;
      }
    } else {
      const es = this.getVCards("e");
      for (let i = 0; i < es.length; i++) {
        this.removeEquipTrigger(es[i], hasMove);
      }
    }
    _status.event.clearStepCache();
    return this;
  },
  addVirtualJudge(card, cards) {
    let cardx;
    if (get.itemtype(card) == "card" && card.isViewAsCard && card.cardSymbol !== void 0) {
      cardx = card[card.cardSymbol];
    } else {
      cardx = card;
    }
    cardx.initID();
    const player = this;
    game.broadcast(
      (player2, card2, cards2) => {
        player2.addVirtualJudge(card2, cards2);
      },
      player,
      card,
      cards
    );
    game.addVideo("addVirtualJudge", player, [get.vcardInfo(cardx), get.cardsInfo(cards)]);
    player.vcardsMap?.judges.push(cardx);
    if (_status.discarded) {
      _status.discarded.removeArray(cards);
    }
    player.$addVirtualJudge(card, cards);
    if (cardx.storage.equipEnable && (cardx.cards || cards).some((card2) => get.type(card2) == "equip")) {
      const equips = (cardx.cards || cards).filter((card2) => get.type(card2) == "equip");
      if (equips.length) {
        const skills = get.skillsFromEquips(equips);
        if (skills.length) {
          player.addSkill(skills);
        }
      }
      game.addGlobalSkill("equipEnableSkill");
    }
  },
  $addVirtualJudge(VCard, cards) {
    if (game.online) {
      return;
    }
    const player = this, card = VCard;
    const isViewAsCard = cards.length !== 1 || cards[0].name !== VCard.name || !card.isCard;
    let cardx;
    if (get.itemtype(card) == "card" && card.isViewAsCard) {
      cardx = card;
    } else {
      cardx = isViewAsCard ? game.createCard(card.name, cards.length == 1 ? get.suit(cards[0]) : "none", cards.length == 1 ? get.number(cards[0]) : 0) : cards[0];
    }
    game.broadcastAll(
      (player2, cardx2, isViewAsCard2, VCard2, cards2) => {
        cardx2.fix();
        if (!cardx2.isViewAsCard) {
          const cardSymbol = /* @__PURE__ */ Symbol("card");
          cardx2.cardSymbol = cardSymbol;
          cardx2[cardSymbol] = VCard2;
        }
        cardx2.style.transform = "";
        cardx2.classList.remove("drawinghidden");
        delete cardx2._transform;
        if (isViewAsCard2 && !cardx2.isViewAsCard) {
          cardx2.isViewAsCard = true;
          cardx2.destroyLog = false;
          for (const i of cards2) {
            i.goto(ui.special);
            i.destiny = player2.node.judges;
          }
          if (cardx2.destroyed) {
            cardx2._destroyed_Virtua = cardx2.destroyed;
          }
          cardx2.destroyed = function(card2, id, player3, event) {
            if (card2._destroyed_Virtua) {
              if (typeof card2._destroyed_Virtua == "function") {
                const bool = card2._destroyed_Virtua(card2, id, player3, event);
                if (bool === true) {
                  return true;
                }
              } else if (lib.skill[card2._destroyed_Virtua]) {
                if (player3) {
                  if (player3.hasSkill(card2._destroyed_Virtua)) {
                    delete card2._destroyed_Virtua;
                    return false;
                  }
                }
                return true;
              } else if (typeof card2._destroyed_Virtua == "string") {
                return card2._destroyed_Virtua == id;
              } else if (card2._destroyed_Virtua === true) {
                return true;
              }
            }
            if (id == "ordering" && ["phaseJudge", "executeDelayCardEffect"].includes(event.getParent().name)) {
              return false;
            }
            if (id != "judge") {
              return true;
            }
          };
        }
        cardx2.classList.add("drawinghidden");
        if (isViewAsCard2) {
          cardx2.cards = cards2 || [];
          cardx2.viewAs = VCard2.name;
          if (cardx2.classList.contains("fullskin") || cardx2.classList.contains("fullborder") || cardx2.classList.contains("fullimage")) {
            cardx2.classList.add("fakejudge");
            if (cardx2.classList.contains("fullimage")) {
              cardx2.classList.remove("fullimage");
              cardx2.classList.add("fullskin");
              cardx2.style.backgroundImage = "";
            }
            cardx2.node.background.innerHTML = lib.translate[cardx2.viewAs + "_bg"] || get.translation(cardx2.viewAs)[0];
          }
        } else {
          delete cardx2.viewAs;
          cardx2.classList.remove("fakejudge");
        }
        const domCard = cardx2;
        player2.node.judges.insertBefore(domCard, player2.node.judges.firstChild);
        ui.updatej(player2);
      },
      player,
      cardx,
      isViewAsCard,
      VCard,
      cards
    );
  }
};
export {
  virtualJudgeAndTriggerMethods
};
