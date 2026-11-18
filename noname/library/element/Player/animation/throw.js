import "../../../../../noname.js";
import { isThrownNode, isThrownNodeMap, replaceThrownCardsetion, getThrownCardId } from "../dom/nodeGuards.js";
import { lib } from "../../../index.js";
import { get } from "../../../../get/binding.js";
import { ui } from "../../../../ui/index.js";
import { game } from "../../../../game/index.js";
const throwAnimationMethods = {
  $throw(card, time, init, nosource, cardsetion, id) {
    if (!cardsetion && cardsetion !== false && lib.config.card_animation_info) {
      let source = this;
      if (["useCard", "respond"].includes(get.event().name)) {
        const eventPlayer = get.player();
        if (eventPlayer) {
          source = eventPlayer;
          cardsetion = get.cardsetion(source);
        }
        const activeEvent = get.event();
        if (!activeEvent.id) activeEvent.id = get.id();
        if (!id) id = activeEvent.id;
      }
    }
    if (typeof card == "number") {
      let tmp = card;
      card = [];
      while (tmp--) {
        let cardx = ui.create.card();
        cardx.classList.add("infohidden");
        cardx.classList.add("infoflip");
        if (cardsetion) {
          let next = ui.create.div(".cardsetion", cardsetion, cardx);
          next.style.setProperty("display", "block", "important");
          const cardNode = cardx.node;
          if (isThrownNode(cardx) && cardNode) {
            if (!isThrownNodeMap(cardNode)) {
              throw new TypeError("thrown node map must be an object");
            }
            if (id) {
              cardNode.throw_id = id;
            }
            replaceThrownCardsetion(cardx, next);
          }
        }
        card.push(cardx);
      }
    }
    if (init !== false) {
      if (init !== "nobroadcast") {
        game.broadcast(
          function(player, card2, time2, init2, nosource2, cardsetion2, id2) {
            player.$throw(card2, time2, init2, nosource2, cardsetion2, id2);
          },
          this,
          card,
          time,
          init,
          nosource,
          cardsetion,
          id
        );
      }
      if (get.itemtype(card) != "cards") {
        if (get.itemtype(card) == "card") {
          card = [card];
        } else {
          return;
        }
      }
      game.addVideo("throw", this, [get.cardsInfo(card), time, nosource]);
    }
    if (game.chess) {
      this.chessFocus();
    }
    if (get.itemtype(card) == "cards") {
      const nodes = [];
      for (let i = 0; i < card.length; i++) {
        nodes.push(this.$throw(card[i], time, false, nosource, cardsetion, id));
      }
      const curEvent = get.event();
      const playerid = this.playerid;
      if (playerid && ["useCard", "respond"].includes(curEvent.name) && curEvent.lose_map?.[playerid] === card) {
        const eventCard = curEvent.card;
        const eventCards = curEvent.cards;
        const isCard = eventCard?.isCard && eventCards?.length == 1;
        const isCard2 = eventCards?.length == 1 && eventCard != null && ["name", "suit", "number", "nature"].every((key) => {
          let singleCard = eventCards[0];
          if (key == "nature") {
            if (singleCard.nature == void 0 && eventCard.nature === false) {
              return true;
            }
          }
          return singleCard[key] == eventCard[key];
        });
        if (lib.config.card_animation_info && nodes.length && (!isCard || !isCard2) && (eventCards?.length ?? 0) >= 1) {
          async function makeViewAsCard(event, lastCardid) {
            const isThrownCard = (node) => node instanceof HTMLDivElement;
            const getThrownCardId2 = (node) => {
              return node._cardid;
            };
            const getThrownNodeMap = (node) => {
              const nodeMap = node.node;
              if (!nodeMap) return;
              if (typeof nodeMap !== "object" && typeof nodeMap !== "function") {
                throw new TypeError("thrown node map must be an object");
              }
              return nodeMap;
            };
            const getThrownCardsetion = (node) => {
              const cardsetion2 = getThrownNodeMap(node)?.cardsetion;
              if (cardsetion2 === void 0) return;
              if (!(cardsetion2 instanceof Node)) {
                throw new TypeError("thrown card section must be a Node");
              }
              return cardsetion2;
            };
            const vcard = event.card;
            const throwns = Array.from(ui.arena.querySelectorAll(".card.thrown")).reverse();
            const lastCard = throwns.find((c) => {
              return isThrownCard(c) && getThrownCardId2(c) == lastCardid;
            });
            if (!isThrownCard(lastCard)) return;
            const curCards = event.cards;
            function waitForTransition(node, time2) {
              return new Promise((resolve) => {
                node.listenTransition(() => {
                  resolve();
                }, time2);
              });
            }
            function waitForAnimation(node, keyframes, options) {
              return new Promise((resolve) => {
                node.animate(keyframes, options).onfinish = () => {
                  resolve();
                };
              });
            }
            function reinitClonedCard(card2, data) {
              const cardNode = getThrownNodeMap(card2);
              if (!cardNode || !card2.init) return;
              const Card = lib.element.Card;
              const oldPrototype = Object.getPrototypeOf(card2);
              Object.setPrototypeOf(card2, Card.prototype);
              if (!(card2 instanceof Card)) {
                throw new TypeError("cloned card must adopt the Card prototype");
              }
              const init2 = card2.init;
              if (typeof init2 !== "function") {
                throw new TypeError("cloned card init method must be callable");
              }
              cardNode.name2 = {};
              cardNode.range = {};
              init2.call(card2, data);
              delete cardNode.name2;
              delete cardNode.range;
              Object.setPrototypeOf(card2, oldPrototype);
            }
            await waitForTransition(lastCard, 500);
            const number = get.number(vcard, false);
            let vcardStr = "转化", vcardSkill;
            if (event.skill) {
              vcardSkill = event.skill;
            } else {
              const modSkills = Object.values(event.modSkill).find((name) => {
                return name && lib.translate[name];
              });
              if (modSkills) {
                vcardSkill = modSkills;
                vcardStr = "视为";
              }
            }
            if (typeof vcardSkill != "string" || !lib.translate[vcardSkill]) {
              vcardSkill = "";
            }
            let suit = get.suit(vcard, false), color = get.color(vcard, false), color2 = color == "red" ? "red" : "black";
            const numberText = typeof number == "number" ? String(number) : `<span style="color:${color2}">${vcardStr}</span>`;
            const initData = [suit, numberText, get.name(vcard, false) || "", get.nature(vcard, false)];
            const position = getThrownCardsetion(lastCard);
            const initMask = ui.create.div(".initmask");
            if (position) lastCard.insertBefore(initMask, position);
            else lastCard.appendChild(initMask);
            await waitForAnimation(initMask, [{ opacity: 0 }, { opacity: 1 }], {
              duration: 150,
              fill: "forwards",
              iterations: 1
            });
            reinitClonedCard(lastCard, initData);
            await waitForAnimation(initMask, [{ opacity: 1 }, { opacity: 0 }], {
              duration: 150,
              fill: "forwards",
              iterations: 1
            });
            initMask.remove();
            lastCard.style.pointerEvents = "all";
            lastCard.addEventListener(
              lib.config.touchscreen ? "touchend" : "click",
              function(e) {
                lastCard._customintro = function(uiintro, evt) {
                  delete lastCard._customintro;
                  const newUiintro = get.nodeintro(lastCard, false, evt);
                  if (!newUiintro) {
                    return false;
                  }
                  newUiintro.add('<div class="text center">由' + get.translation(vcardSkill) + vcardStr + "</div>");
                  newUiintro.add(curCards);
                  const first = newUiintro.content.firstElementChild;
                  const buttons = newUiintro.content.lastElementChild;
                  if (first && buttons) {
                    newUiintro.content.insertBefore(buttons, first.nextSibling);
                  }
                  uiintro.contentContainer.insertBefore(newUiintro.content, uiintro.content);
                  uiintro.contentContainer.removeChild(uiintro.content);
                  uiintro.content = newUiintro.content;
                  newUiintro.close();
                };
                if (e instanceof TouchEvent && e.changedTouches[0]) {
                  e = e.changedTouches[0];
                }
                return ui.click.intro.call(lastCard, e);
              },
              true
            );
          }
          let lastNode = nodes[nodes.length - 1];
          const loseMap = get.event().lose_map;
          if (loseMap) {
            const id2 = this.playerid;
            let ids = [];
            for (let key in loseMap) {
              if (key != "noowner" && loseMap[key].length > 0) {
                ids.add(key);
              }
            }
            if (!id2 || ids.indexOf(id2) == -1 || ids.indexOf(id2) != ids.length - 1) {
              lastNode = {
                _cardid: -1
              };
            }
          }
          const lastCardId = lastNode && isThrownNode(lastNode) ? getThrownCardId(lastNode) : void 0;
          if (init !== "nobroadcast") game.broadcastAll(makeViewAsCard, curEvent, lastCardId);
          else makeViewAsCard(curEvent, lastCardId);
        }
      }
      return nodes[nodes.length - 1];
    } else {
      let node;
      if (card == void 0 || card.length == 0) return;
      let cardx = card.copy("thrown");
      if (id) cardx.node.throw_id = id;
      node = this.$throwordered(cardx, nosource, cardsetion);
      if (time != void 0) {
        node.fixed = true;
        setTimeout(function() {
          node.delete();
        }, time);
      }
      lib.listenEnd(node);
      return node;
    }
  }
};
export {
  throwAnimationMethods
};
