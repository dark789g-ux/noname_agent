import "../../../../../noname.js";
import { game } from "../../../../game/index.js";
import { get } from "../../../../get/binding.js";
import { _status } from "../../../../status/index.js";
import { ui } from "../../../../ui/index.js";
import { lib } from "../../../index.js";
const virtualEquipDomMethods = {
  removeVirtualEquip(VCard) {
    const player = this;
    game.addVideo("removeVirtualEquip", player, get.vcardInfo(VCard));
    game.broadcast(
      (VCard2, player2) => {
        const cards2 = player2.vcardsMap?.equips;
        if (cards2 && cards2.includes(VCard2)) {
          cards2.remove(VCard2);
        }
      },
      VCard,
      player
    );
    const cards = player.vcardsMap?.equips;
    if (cards && cards.includes(VCard)) {
      player.removeEquipTrigger(VCard, true);
      cards.remove(VCard);
    }
    player.$handleEquipChange();
  },
  $handleEquipChange() {
    const player = this;
    const cards = Array.from(player.node.equips.children).filter((node) => node instanceof lib.element.Card);
    const cardsResume = cards.slice(0);
    const extraEquip = [];
    player.extraEquip.forEach((info) => {
      if (player.hiddenSkills.includes(info[0])) {
        return;
      }
      const extra = `${get.translation(info[0])} ${get.translation(info[1])}`;
      const subtype = get.subtype(info[1]);
      const preserve = info[2] && !info[2](player);
      if (!preserve && !extraEquip.map((entry) => entry[1]).includes(info[1])) {
        extraEquip.add([info, extra, subtype]);
      }
    });
    cards.forEach((card) => {
      const cardNode = card;
      const num = get.equipNum(cardNode);
      let remove = false;
      if (card.name.indexOf("empty_equip") == 0) {
        if ((num == 4 || num == 3) && get.is.mountCombined()) {
          remove = !player.hasEmptySlot("equip3_4") || player.getEquips("equip3_4").length;
        } else if (!player.hasEmptySlot(num) || player.getEquips(num).length) {
          remove = true;
        }
        if (remove) {
          player.node.equips.removeChild(cardNode);
          cardsResume.remove(card);
        }
      }
      if (card.extraEquip && !remove) {
        const info = card.extraEquip, disable = card.classList.contains("feichu");
        const extra = extraEquip.find((infox) => infox.every((item) => info.includes(item)));
        if (!extra) {
          if (disable) {
            card.node.name2.innerHTML = get.translation("equip" + num) + " 已废除";
            delete card.extraEquip;
          } else {
            player.node.equips.removeChild(cardNode);
            cardsResume.remove(card);
          }
        } else {
          extraEquip.remove(extra);
        }
      } else if (card.classList.contains("feichu")) {
        const extra = extraEquip.find((info) => info[2].includes("equip" + num));
        if (extra) {
          card.node.name2.innerHTML = extra[1];
          card.extraEquip = extra[0];
          extraEquip.remove(extra);
        }
      }
    });
    for (let i = 1; i <= 5; i++) {
      let add = false;
      if ((i == 4 || i == 3) && get.is.mountCombined()) {
        add = player.hasEmptySlot("equip3_4") && !player.getEquips("equip3_4").length;
      } else {
        add = player.hasEmptySlot(i) && !player.getEquips(i).length;
      }
      if (add && !cardsResume.some((card) => {
        const num = get.equipNum(card);
        if ((i == 4 || i == 3) && get.is.mountCombined()) {
          return num == 4 || num == 3;
        } else {
          return num == i;
        }
      })) {
        const card = game.createCard("empty_equip" + i, "", "");
        card.fix();
        card.style.transform = "";
        card.classList.remove("drawinghidden");
        card.classList.add("emptyequip");
        card.classList.add("hidden");
        delete card._transform;
        const equipNum = get.equipNum(card);
        let equipped = false;
        for (const node of player.node.equips.children) {
          if (!(node instanceof lib.element.Card)) {
            continue;
          }
          if (get.equipNum(node) >= equipNum) {
            player.node.equips.insertBefore(card, node);
            equipped = true;
            break;
          }
        }
        if (!equipped) {
          player.node.equips.appendChild(card);
          if (_status.discarded) {
            _status.discarded.remove(card);
          }
        }
      }
    }
    extraEquip.forEach((info) => {
      if (player.hasEmptySlot(info[2])) {
        const card = game.createCard("empty_" + info[2], "", "");
        const cardNode = card;
        card.fix();
        card.style.transform = "";
        card.classList.remove("drawinghidden");
        card.classList.add("emptyequip");
        card.node.name2.innerHTML = info[1];
        card.extraEquip = info[0];
        delete card._transform;
        const equipNum = get.equipNum(cardNode);
        let equipped = false;
        for (const node of player.node.equips.children) {
          if (!(node instanceof lib.element.Card)) {
            continue;
          }
          const equipNode = node;
          if (get.equipNum(node) == info[2].at(-1) && info && node.classList.contains("emptyequip") && !equipNode.extraEquip) {
            equipNode.node.name2.innerHTML = info[1];
            equipNode.extraEquip = info[0];
            equipNode.classList.remove("hidden");
            equipped = true;
            break;
          }
          if (get.equipNum(node) >= equipNum) {
            player.node.equips.insertBefore(cardNode, node);
            equipped = true;
            break;
          }
        }
        if (!equipped) {
          player.node.equips.appendChild(cardNode);
          if (_status.discarded) {
            _status.discarded.remove(cardNode);
          }
        }
      }
    });
  },
  addVirtualEquip(card, cards) {
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
        player2.addVirtualEquip(card2, cards2);
      },
      player,
      card,
      cards
    );
    game.addVideo("addVirtualEquip", player, [get.vcardInfo(cardx), get.cardsInfo(cards)]);
    player.vcardsMap?.equips.push(cardx);
    player.vcardsMap?.equips.sort((a, b) => {
      return get.equipNum(a) - get.equipNum(b);
    });
    player.$addVirtualEquip(card, cards);
    player.addEquipTrigger(card);
  },
  $addVirtualEquip(card, cards) {
    if (game.online) {
      return;
    }
    const player = this;
    const isViewAsCard = cards.length !== 1 || cards[0].name !== card.name || !card.isCard, info = get.info(card, false);
    let cardShownName = get.translation(card.name);
    if (info.subtype === "equip3") {
      cardShownName += "+";
    } else if (info.subtype === "equip4") {
      cardShownName += "-";
    }
    let cardx;
    if (get.itemtype(card) == "card" && card.isViewAsCard) {
      cardx = card;
    } else {
      cardx = isViewAsCard ? game.createCard(card.name, cards.length == 1 ? get.suit(cards[0]) : "none", cards.length == 1 ? get.number(cards[0]) : 0) : cards[0];
    }
    game.broadcastAll(
      (player2, cardx2, isViewAsCard2, card2, cards2, cardShownName2) => {
        cardx2.fix();
        if (!cardx2.isViewAsCard) {
          const cardSymbol = /* @__PURE__ */ Symbol("card");
          cardx2.cardSymbol = cardSymbol;
          cardx2[cardSymbol] = card2;
        }
        const cardWithSubtypes = card2;
        if (cardWithSubtypes.subtypes) {
          cardx2.subtypes = cardWithSubtypes.subtypes;
        }
        cardx2.style.transform = "";
        cardx2.classList.remove("drawinghidden");
        delete cardx2._transform;
        if (isViewAsCard2 && !cardx2.isViewAsCard) {
          cardx2.isViewAsCard = true;
          cardx2.destroyLog = false;
          for (const i of cards2) {
            i.goto(ui.special);
            i.destiny = player2.node.equips;
          }
          if (cardx2.destroyed) {
            cardx2._destroyed_Virtua = cardx2.destroyed;
          }
          cardx2.destroyed = function(card3, id, player3, event) {
            if (card3._destroyed_Virtua) {
              if (typeof card3._destroyed_Virtua == "function") {
                const bool = card3._destroyed_Virtua(card3, id, player3, event);
                if (bool === true) {
                  return true;
                }
              } else if (lib.skill[card3._destroyed_Virtua]) {
                if (player3) {
                  if (player3.hasSkill(card3._destroyed_Virtua)) {
                    delete card3._destroyed_Virtua;
                    return false;
                  }
                }
                return true;
              } else if (typeof card3._destroyed_Virtua == "string") {
                return card3._destroyed_Virtua == id;
              } else if (card3._destroyed_Virtua === true) {
                return true;
              }
            }
            if (id != "equip") {
              return true;
            }
          };
        }
        const suit = get.translation(cardx2.suit), number = get.strNumber(cardx2.number);
        if (isViewAsCard2) {
          cardx2.cards = cards2 || [];
          cardx2.viewAs = card2.name;
          cardx2.node.name2.innerHTML = `${suit}${number} [${cardShownName2}]`;
          cardx2.classList.add("fakeequip");
        } else {
          delete cardx2.viewAs;
          cardx2.node.name2.innerHTML = `${suit}${number} ${cardShownName2}`;
          cardx2.classList.remove("fakeequip");
        }
        const domCard = cardx2;
        let equipped = false;
        const equipNum = get.equipNum(domCard);
        if (player2.node.equips.childNodes.length) {
          for (let i = 0; i < player2.node.equips.childNodes.length; i++) {
            if (get.equipNum(player2.node.equips.childNodes[i]) >= equipNum) {
              equipped = true;
              player2.node.equips.insertBefore(domCard, player2.node.equips.childNodes[i]);
              break;
            }
          }
        }
        if (equipped === false) {
          player2.node.equips.appendChild(domCard);
          if (cards2?.length && _status.discarded) {
            _status.discarded.removeArray(cards2);
          }
        }
      },
      player,
      cardx,
      isViewAsCard,
      card,
      cards,
      cardShownName
    );
  },
  $equip(card) {
    game.broadcast(
      function(player2, card2) {
        player2.$equip(card2);
      },
      this,
      card
    );
    card.fix();
    card.style.transform = "";
    card.classList.remove("drawinghidden");
    delete card._transform;
    const player = this;
    const equipNum = get.equipNum(card);
    let equipped = false;
    for (let i = 0; i < player.node.equips.childNodes.length; i++) {
      if (get.equipNum(player.node.equips.childNodes[i]) >= equipNum) {
        player.node.equips.insertBefore(card, player.node.equips.childNodes[i]);
        equipped = true;
        break;
      }
    }
    if (!equipped) {
      player.node.equips.appendChild(card);
      if (_status.discarded) {
        _status.discarded.remove(card);
      }
    }
    const info = get.info(card);
    if (info.skills) {
      for (let i = 0; i < info.skills.length; i++) {
        player.addSkillTrigger(info.skills[i]);
      }
    }
    return player;
  }
};
export {
  virtualEquipDomMethods
};
