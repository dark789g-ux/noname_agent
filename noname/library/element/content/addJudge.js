import "../../../../noname.js";
import { isCardMatrix } from "./selectionResults.js";
import { get } from "../../../get/binding.js";
import { game } from "../../../game/index.js";
import { _status } from "../../../status/index.js";
import { lib } from "../../index.js";
import { ui } from "../../../ui/index.js";
const addJudgeContent = {
  //暂时还是只能一次加一张牌，需要后续跟进处理
  //一次加一张够用了
  async addJudge(event, trigger, player) {
    let card;
    let cardName;
    if (typeof event.card == "string") {
      cardName = event.card;
      card = get.autoViewAs({ name: cardName }, event.cards);
      event.card = card;
    } else {
      cardName = event.card.name;
      if (get.itemtype(event.card) === "card") {
        if (event.card.cardSymbol !== void 0) {
          const cardSymbol = event.card.cardSymbol;
          const symbolCard = event.card[cardSymbol];
          if (symbolCard) {
            event.cards = symbolCard.cards;
            if (!event.card.isViewAsCard) {
              event.card = symbolCard;
            }
          }
        } else {
          card = get.autoViewAs(event.card, void 0, false);
          event.card = card;
          event.cards = event.card.cards ?? [];
        }
      } else if (!event.card.cards?.length && event.cards?.length) {
        card = get.autoViewAs({ name: cardName, isCard: true }, event.cards);
        event.card = card;
      } else if (!event.cards) {
        event.cards = [];
      }
    }
    card = event.card;
    const cards = event.cards;
    const cardInfo = lib.card[cardName];
    const visible = cardInfo && !cardInfo.blankCard;
    event.visible = visible;
    const loseCards = [];
    if (event.card instanceof lib.element.Card && event.card.isViewAsCard) {
      loseCards.add(event.card);
    } else {
      loseCards.addArray(event.cards);
    }
    if (loseCards.length) {
      const map = {};
      for (const i of loseCards) {
        const owner = get.owner(i, "judge");
        if (owner) {
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
        const next = owner.lose(map[i][0], ui.special).set("type", "addJudge").set("forceDie", true).set("getlx", false);
        if (event.visible == true) {
          next.visible = true;
        }
        await next;
        event.relatedLose = next;
      }
      let stop = false;
      const list = [];
      for (const cardx of event.cards) {
        if (cardx.willBeDestroyed("judge", player, event)) {
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
    }
    if (!cardInfo.effect && !cardInfo.noEffect) {
      if (event.cards.length) {
        await game.cardsDiscard(event.cards);
      }
      return;
    }
    game.broadcastAll(
      /**
       * @param {Player} player
       * @param {Card | VCard} card
       * @param {Card[]} cards
       */
      (player2, card2, cards2) => {
        const cardsCloned = cards2.filter((card3) => card3 instanceof lib.element.Card && card3.clone && (card3.clone.parentNode == player2.parentNode || card3.clone.parentNode == ui.arena));
        if (cardsCloned.length) {
          cardsCloned.forEach((card3) => {
            if (card3 instanceof lib.element.Card && card3.clone) {
              card3.clone.moveDelete(player2);
            }
          });
          game.addVideo("gain2", player2, get.cardsInfo(cardsCloned));
        }
      },
      player,
      event.card,
      loseCards
    );
    player.addVirtualJudge(event.card, event.cards);
    const isViewAsCard = cards?.length !== 1 || cards[0].name !== card.name || !card.isCard;
    if (isViewAsCard && cards?.length) {
      if (cardInfo.blankCard) {
        game.log(player, `被扣置了<span class="yellowtext">${get.translation(cardName)}</span>`);
      } else {
        game.log(player, `被贴上了<span class="yellowtext">${get.translation(cardName)}</span>（`, cards, "）");
      }
    } else {
      game.log(player, "被贴上了", card);
    }
    if (get.itemtype(event.card) == "card") {
      const cardSymbol = event.card.cardSymbol;
      if (cardSymbol !== void 0) {
        const symbolCard = event.card[cardSymbol];
        if (symbolCard) {
          event.card = symbolCard;
        }
      }
    }
  },
  judge: [
    async (event, trigger, player) => {
      const judgestr = `${get.translation(player)}的${event.judgestr}判定`;
      event.videoId = lib.status.videoId++;
      let rawCard = event.directresult;
      if (!rawCard) {
        if (player.getTopCards) {
          rawCard = player.getTopCards()[0];
        } else {
          rawCard = get.cards()[0];
        }
      }
      if (!rawCard) {
        event.finish();
        return;
      }
      const normalizedCard = rawCard instanceof lib.element.Card || rawCard instanceof lib.element.VCard ? rawCard : get.autoViewAs(rawCard, void 0, false);
      const cardj = normalizedCard instanceof lib.element.Card ? normalizedCard : normalizedCard?.cards?.[0];
      if (!cardj) {
        event.finish();
        return;
      }
      let waiting;
      const owner = cardj instanceof lib.element.Card ? get.owner(cardj) : void 0;
      if (owner) {
        waiting = owner.lose(cardj, "visible", ui.ordering);
      } else {
        const nextj = game.cardsGotoOrdering(cardj);
        if (event.position != ui.discardPile) {
          nextj.noOrdering = true;
        }
        waiting = nextj;
      }
      player.judging.unshift(cardj);
      game.addVideo("judge1", player, [get.cardInfo(player.judging[0]), judgestr, event.videoId]);
      game.broadcastAll(
        (player2, card, str, id, cardid) => {
          let event2;
          if (game.online) {
            event2 = {};
          } else {
            event2 = _status.event;
          }
          if (game.chess) {
            event2.node = card.copy("thrown", "center", ui.arena).addTempClass("start");
          } else {
            event2.node = player2.$throwordered(card.copy(), true);
          }
          if (lib.cardOL) {
            lib.cardOL[cardid] = event2.node;
          }
          event2.node.cardid = cardid;
          event2.node.classList.add("thrownhighlight");
          ui.arena.classList.add("thrownhighlight");
          event2.dialog = ui.create.dialog(str);
          event2.dialog.classList.add("center");
          event2.dialog.videoId = id;
        },
        player,
        player.judging[0],
        judgestr,
        event.videoId,
        get.id()
      );
      game.log(player, `进行${event.judgestr}判定，亮出的判定牌为`, player.judging[0]);
      await game.delay(2);
      if (!event.noJudgeTrigger) {
        await event.trigger("judge");
      }
      return waiting.forResult();
    },
    async (event, trigger, player) => {
      const rawJudgedCard = player.judging[0];
      const judgedCard = rawJudgedCard instanceof lib.element.Card ? rawJudgedCard : rawJudgedCard ? get.autoViewAs(rawJudgedCard, void 0, false) : void 0;
      if (!judgedCard) {
        event.finish();
        return;
      }
      event.result = {
        card: judgedCard,
        name: judgedCard.name,
        number: get.number(judgedCard),
        suit: get.suit(judgedCard),
        color: get.color(judgedCard),
        node: event.node
      };
      if (event.fixedResult) {
        for (const i in event.fixedResult) {
          event.result[i] = event.fixedResult[i];
        }
      }
      event.result.judge = event.judge(event.result);
      if (event.result.judge > 0) {
        event.result.bool = true;
      } else if (event.result.judge < 0) {
        event.result.bool = false;
      } else {
        event.result.bool = null;
      }
      player.judging.shift();
      game.checkMod(player, event.result, "judge", player);
      if (event.judge2) {
        const judge2 = event.judge2(event.result);
        if (typeof judge2 == "boolean") {
          player.tryJudgeAnimate(judge2);
        }
      }
      if (event.clearArena != false) {
        game.broadcastAll(ui.clear);
      }
      game.broadcast((id) => {
        const dialog = get.idDialog(id);
        if (dialog) {
          dialog.close();
        }
        ui.arena.classList.remove("thrownhighlight");
      }, event.videoId);
      event.dialog.close();
      game.addVideo("judge2", null, event.videoId);
      ui.arena.classList.remove("thrownhighlight");
      game.log(player, "的判定结果为", event.result.card);
      const triggerFixing = event.trigger("judgeFixing");
      let callback = null;
      if (event.callback) {
        const next = game.createEvent("judgeCallback", false);
        next.player = player;
        next.card = judgedCard;
        next.judgeResult = get.copy(event.result);
        next.setContent(event.callback);
        callback = next;
      } else {
        if (judgedCard instanceof lib.element.Card && !get.owner(judgedCard)) {
          if (event.position != ui.discardPile) {
            event.position.appendChild(judgedCard);
          }
        }
      }
      await triggerFixing;
      if (callback && event.next.includes(callback)) {
        await callback;
      }
    }
  ],
  async turnOver(event, trigger, player) {
    game.log(player, "翻面");
    game.broadcastAll((player2) => player2.classList.toggle("turnedover"), player);
    game.addVideo("turnOver", player, player.classList.contains("turnedover"));
  },
  async link(event, trigger, player) {
    const isLinked = player.isLinked();
    game.log(player, `${isLinked ? "解除" : "被"}连环`);
    game.broadcastAll(
      (player2, isLinked2) => {
        if (lib.config.background_audio) {
          game.playAudio("effect", `link${isLinked2 ? "_clear" : ""}`);
        }
        player2.classList.remove("target");
        player2.classList.toggle(get.is.linked2(player2) ? "linked2" : "linked");
        ui.updatej(player2);
        ui.updatem(player2);
      },
      player,
      isLinked
    );
    game.addVideo("link", player, player.isLinked());
  },
  async chooseToGuanxing(event, trigger, player) {
    const cards = get.cards(event.num);
    await game.cardsGotoOrdering(cards);
    const next = player.chooseToMove({ allowChooseAll: true, list: [] });
    next.set("selectionSpec", { move: "guanxing" });
    next.set("forceDie", event.forceDie);
    next.set("includeOut", event.includeOut);
    next.set("list", [["牌堆顶", cards], ["牌堆底"]]);
    next.set("prompt", event.prompt || "点击或拖动将牌移动到牌堆顶或牌堆底");
    next.processAI = event.processAI || ((list) => {
      const cards2 = list[0][1];
      const player2 = _status.event.player;
      let target = _status.currentPhase || player2;
      const name = _status.event.getTrigger()?.name;
      const countWuxie = (current) => {
        let num = current.getKnownCards(player2, (card) => get.name(card, current) === "wuxie");
        if (num && current !== player2) {
          return num;
        }
        const skills = current.getSkills("invisible").concat(lib.skill.global);
        game.expandSkills(skills);
        for (const skill of skills) {
          const ifo = get.info(skill);
          if (!ifo) {
            continue;
          }
          if (ifo.viewAs && typeof ifo.viewAs == "object" && ifo.viewAs.name == "wuxie") {
            if (!ifo.viewAsFilter || ifo.viewAsFilter(current)) {
              num++;
              break;
            }
          } else {
            const hiddenCard = ifo.hiddenCard;
            if (typeof hiddenCard == "function" && hiddenCard(current, "wuxie")) {
              num++;
              break;
            }
          }
        }
        return num;
      };
      const top2 = [];
      switch (name) {
        case "phaseJieshu":
          if (!target) {
            throw new Error("chooseToGuanxing requires a phase player.");
          }
          target = target.next;
        // [falls through]
        case "phaseZhunbei": {
          if (!target) {
            throw new Error("chooseToGuanxing requires a phase player.");
          }
          const att = get.sgn(get.attitude(player2, target));
          const judges = target.getCards("j");
          let needs = 0;
          let wuxie = countWuxie(target);
          for (let i = Math.min(cards2.length, judges.length) - 1; i >= 0; i--) {
            const j = judges[i];
            const cardj = j.viewAs ? { name: j.viewAs, cards: j.cards || [j] } : j;
            if (wuxie > 0 && get.effect(target, j, target, target) < 0) {
              wuxie--;
              continue;
            }
            const judge = get.judge(j);
            cards2.sort((a, b) => (judge(b) - judge(a)) * att);
            if (judge(cards2[0]) * att < 0) {
              needs++;
              continue;
            } else {
              top2.unshift(cards2.shift());
            }
          }
          if (needs > 0 && needs >= judges.length) {
            return [top2, cards2];
          }
          cards2.sort((a, b) => (get.value(b, target) - get.value(a, target)) * att);
          while (needs--) {
            top2.unshift(cards2.shift());
          }
          while (cards2.length) {
            if (get.value(cards2[0], target) > 6 == att > 0) {
              top2.push(cards2.shift());
            } else {
              break;
            }
          }
          return [top2, cards2];
        }
        default:
          cards2.sort((a, b) => get.value(b, target) - get.value(a, target));
          while (cards2.length) {
            if (get.value(cards2[0], target) > 6) {
              top2.push(cards2.shift());
            } else {
              break;
            }
          }
          return [top2, cards2];
      }
    });
    const result = await next.forResult();
    if (typeof result == "string" || !("moved" in result) || !isCardMatrix(result.moved)) {
      return;
    }
    const moved = result.moved;
    const top = moved[0] ?? [];
    const bottom = moved[1] ?? [];
    top.reverse();
    await game.cardsGotoPile(top.concat(bottom), ["top_cards", top], (event2, card) => {
      if (event2 && Array.isArray(event2.top_cards) && event2.top_cards.includes(card)) {
        return ui.cardPile.firstChild;
      }
      return null;
    });
    game.addCardKnower(top, [player]);
    game.addCardKnower(bottom, [player]);
    event.result = {
      bool: true,
      moved: [top, bottom]
    };
    player.popup(`${get.cnNumber(top.length)}上${get.cnNumber(bottom.length)}下`);
    game.log(player, `将${get.cnNumber(top.length)}张牌置于牌堆顶`);
    await game.delayx();
  }
};
export {
  addJudgeContent
};
