import "../../../../noname.js";
import "../../dependencies.js";
import { _status } from "../../../status/index.js";
import { get } from "../../binding.js";
import { ui } from "../../../ui/index.js";
import { game } from "../../../game/index.js";
import { lib } from "../../../library/index.js";
const eventCardsetionMethods = {
  /**
   * 获取当前事件是由何skill/card事件衍生并生成相应的卡牌信息提示
   * @overload
   * @param {Player} player
   * @param {false} [sourceEvent]
   * @returns {string | undefined}
   *
   * @overload
   * @param {Player | null} player
   * @param {true} sourceEvent
   * @returns {import("../library/element/gameEvent.js").GameEvent<import("../library/element/gameEvent.js").GameEventNumberValue> | GameEventParentFallback | false | undefined}
   */
  cardsetion(player, sourceEvent) {
    if (game.online) {
      return;
    }
    if (!player && sourceEvent) {
      player = game.me;
    }
    const info = lib.translate;
    const { name, targets, judgestr } = _status.event;
    const playername = get.slimName(player?.name);
    if (!player) throw new TypeError("Card animation information requires a player");
    const SeatNum = player.getSeatNum();
    const addSeat = game.hasPlayer2((current) => current != player && get.slimName(current?.name) == playername, true) && typeof SeatNum == "number";
    let border = get.groupnature(get.bordergroup(player?.name, void 0), void 0);
    let eventInfo = `<span style="font-weight:700"><span data-nature=${border}><span style="letter-spacing:0.1em">${playername}${addSeat ? "[" + SeatNum + "]" : ""}</span></span><br/><span style="color:#FFD700">`;
    let name1 = name;
    let name2 = _status.event.getParent().name;
    let th_skill = false;
    let evt1 = get.event();
    let evt2 = get.event().getParent();
    if (["lose", "loseAsync"].includes(name) && typeof name2 === "string" && !lib.skill[name2] && _status.event.getParent(2).name != "die" || name == "gain" && !info[String(get.event().getParent().name)]) {
      name1 = _status.event.getParent(2).name;
      evt1 = _status.event.getParent(2);
      name2 = _status.event.getParent(3).name;
      evt2 = _status.event.getParent(3);
    }
    if (name1 == "compareMultiple" || name2 == "compareMultiple" || typeof name1 === "string" && name1.indexOf("Callback") != -1 || typeof name2 === "string" && name2.indexOf("Callback") != -1) {
      name1 = _status.event.getParent(4).name;
      evt1 = _status.event.getParent(4);
      name2 = _status.event.getParent(5).name;
      evt2 = _status.event.getParent(5);
    } else if (name1 == "useCard" && name2 == "chooseUseTarget" && !evt1.skill) {
      name1 = _status.event.getParent(2).name;
      evt1 = _status.event.getParent(2);
      name2 = _status.event.getParent(3).name;
      evt2 = _status.event.getParent(3);
    }
    const banned = ["phaseJudge", "equip", "phaseUse"], bannedEvent = ["phase"];
    if (typeof name1 === "string" && banned.includes(name1) || bannedEvent.includes(String(evt1.name))) {
      name1 = false;
      evt1 = false;
    }
    if (typeof name2 === "string" && banned.includes(name2) || bannedEvent.includes(String(evt2.name))) {
      name2 = false;
      evt2 = false;
    }
    if (name1 && !info[name1]) {
      if (name1.indexOf("equip_") == 0) {
        name1 = name1.slice(6);
      } else if (name1.indexOf("pre_") == 0) {
        name1 = name1.slice(4);
        if (name1.indexOf("_backup") != -1 && !info[name1]) {
          name1 = name1.slice(0, name1.indexOf("_backup"));
        }
      } else if (name1.indexOf("lose_") == 0) {
        name1 = name1.slice(5);
      } else if (name1.indexOf("_lose") != -1 && name1.length - name1.indexOf("_lose") == 5) {
        name1 = name1.slice(0, name1.length - 5);
      }
    }
    if (typeof name2 === "string" && !info[name2]) {
      if ((name2 == "chooseToUse" || name2 == "chooseToRespond" || name2 == "_wuxie") && evt2 !== false && evt2.childEvents) {
        let tempEvt;
        for (let key of evt2.childEvents) {
          if (key.name.indexOf("pre_") == 0) {
            tempEvt = key;
            break;
          }
        }
        if (tempEvt) {
          name2 = tempEvt.name;
        } else if (name2 == "chooseToUse") {
          if (!(evt2 instanceof lib.element.GameEvent)) throw new TypeError("Card information requires an existing source event");
          const infoParent = evt2.getParent();
          if (info[String(infoParent.name)]) {
            const skillParent = evt2.getParent();
            if (lib.skill[String(skillParent.name)]) {
              const bannedParent = evt2.getParent();
              if (!banned.includes(String(bannedParent.name))) {
                const parent = evt2.getParent();
                evt2 = parent;
                name2 = parent.name;
              }
            }
          }
        }
      }
      if (typeof name2 === "string") {
        if (name2.indexOf("equip_") == 0) {
          name2 = name2.slice(6);
        } else if (name2.indexOf("pre_") == 0) {
          name2 = name2.slice(4);
          if (name2.indexOf("_backup") != -1) {
            name2 = name2.slice(0, name2.indexOf("_backup"));
          }
        } else if (name2.indexOf("lose_") == 0) {
          name2 = name2.slice(5);
        } else if (name2.indexOf("_lose") != -1 && name2.length - name2.indexOf("_lose") == 5) {
          name2 = name2.slice(0, name2.length - 5);
        }
      }
    }
    if (name1 == "useSkill" && evt1 !== false) {
      name1 = get.sourceSkillFor(evt1.skill);
    }
    if (name2 == "useSkill" && evt2 !== false) {
      name2 = get.sourceSkillFor(evt2.skill);
    }
    if (_status.event.skill) {
      let skill = _status.event.skill;
      if (info[get.sourceSkillFor(skill)]) {
        th_skill = true;
        eventInfo += info[get.sourceSkillFor(skill)];
        if (sourceEvent) {
          return _status.event;
        }
      }
    } else if (name1 && info[name1] || evt1 !== false && evt1.skill && info[get.sourceSkillFor(evt1.skill)]) {
      if (name1 && info[name1]) {
        if (evt1 !== false && lib.card[name1] && evt1.card && evt1.card.nature && info[String(evt1.card.nature)]) {
          eventInfo += info[String(evt1.card.nature)];
        }
        eventInfo += info[name1];
      } else if (evt1 !== false && evt1.skill) {
        eventInfo += info[get.sourceSkillFor(evt1.skill)];
      }
      th_skill = true;
      if (sourceEvent) {
        return evt1;
      }
    } else if (name2 && info[name2] || evt2 !== false && evt2.skill && info[get.sourceSkillFor(evt2.skill)]) {
      if (name2 && info[name2]) {
        if (evt2 !== false && lib.card[name2] && evt2.card && evt2.card.nature && info[String(evt2.card.nature)]) {
          eventInfo += info[String(evt2.card.nature)];
        }
        eventInfo += info[name2];
      } else if (evt2 !== false && evt2.skill) {
        eventInfo += info[get.sourceSkillFor(evt2.skill)];
      }
      th_skill = true;
      if (sourceEvent) {
        return evt2;
      }
    }
    eventInfo += "</span>";
    if (sourceEvent) {
      return false;
    }
    switch (name) {
      case "chooseToCompare": {
        eventInfo += "拼点";
        break;
      }
      case "phaseJudge": {
        let card = _status.event.card;
        if (!card) {
          throw new TypeError("Judgment information requires its card");
        }
        let cardName = card.viewAs || card.name;
        eventInfo += get.translation(cardName);
        break;
      }
      case "useCard": {
        eventInfo += "使用";
        break;
      }
      case "lose": {
        let event = _status.event, evt = event.getParent();
        if (event.type && event.type == "discard") {
          eventInfo += "弃置";
        } else if (event.getParent(2).name == "recast" && event.getParent(3).name != "_recasting") {
          eventInfo += "重铸";
        }
        break;
      }
      case "loseAsync": {
        let event = _status.event;
        if (event.type && event.type == "discard") {
          eventInfo += "弃置";
        }
        break;
      }
      case "useSkill": {
        let skill = _status.event.skill;
        break;
      }
      case "respond": {
        eventInfo += "打出";
        break;
      }
      case "judge": {
        eventInfo += (!th_skill && judgestr ? judgestr : "") + "判定";
        break;
      }
    }
    eventInfo += "</span>";
    return eventInfo;
  },
  distance(from, to, method) {
    if (from == to) {
      return 0;
    }
    if (!game.players.includes(from) && !game.dead.includes(from)) {
      return Infinity;
    }
    if (!game.players.includes(to) && !game.dead.includes(to)) {
      return Infinity;
    }
    let n = 1;
    if (game.chess) {
      let fxy = from.getXY(), txy = to.getXY();
      n = Math.abs(fxy[0] - txy[0]) + Math.abs(fxy[1] - txy[1]);
      if (method == "raw" || method == "pure" || method == "absolute") {
        return n;
      }
    } else if (to.isMin(true) || from.isMin(true)) {
      if (method == "raw" || method == "pure" || method == "absolute") {
        return n;
      }
    } else {
      let player = from, length = game.players.length;
      const totalPopulation = game.players.length + game.dead.length + 1;
      for (let iwhile = 0; iwhile < totalPopulation; iwhile++) {
        if (player.nextSeat != to) {
          player = player.nextSeat;
          if (player.isAlive() && !player.isOut() && !player.hasSkill("undist") && !player.isMin(true)) {
            n++;
          }
        } else {
          break;
        }
      }
      for (let i = 0; i < game.players.length; i++) {
        if (game.players[i].isOut() || game.players[i].hasSkill("undist") || game.players[i].isMin(true)) {
          length--;
        }
      }
      if (method == "absolute") {
        return n;
      }
      if (from.isDead()) {
        length++;
      }
      if (to.isDead()) {
        length++;
      }
      const left = from.hasSkillTag("left_hand"), right = from.hasSkillTag("right_hand");
      if (left === right) {
        n = Math.min(n, length - n);
      } else if (left == true) {
        n = length - n;
      }
      if (method == "raw" || method == "pure") {
        return n;
      }
    }
    n = game.checkMod(from, to, n, "globalFrom", from);
    n = game.checkMod(from, to, n, "globalTo", to);
    const equips1 = from.getVCards("e", function(card) {
      return !card.cards?.some((card2) => {
        return ui.selected.cards?.includes(card2);
      });
    }), equips2 = to.getVCards("e", function(card) {
      return !card.cards?.some((card2) => {
        return ui.selected.cards?.includes(card2);
      });
    });
    for (let i = 0; i < equips1.length; i++) {
      let info = get.info(equips1[i]).distance;
      if (!info) {
        continue;
      }
      if (info.globalFrom) {
        n += info.globalFrom;
      }
    }
    for (let i = 0; i < equips2.length; i++) {
      let info = get.info(equips2[i]).distance;
      if (!info) {
        continue;
      }
      if (info.globalTo) {
        n += info.globalTo;
      }
    }
    if (method == "attack") {
      let m = n;
      m = game.checkMod(from, to, m, "attackFrom", from);
      m = game.checkMod(from, to, m, "attackTo", to);
      for (const equip of equips2) {
        const info = get.info(equip).distance;
        if (info?.attackTo) {
          m += info.attackTo;
        }
      }
      return m;
    } else if (method == "unchecked") {
      return n;
    }
    return Math.max(1, n);
  },
  /**
   * @param { number | Select | (() => number | Select) } [select]
   * @returns { Select }
   */
  select(select) {
    if (typeof select == "function") {
      let result = get.select(select());
      if (typeof result == "number") {
        return [result, result];
      }
      return result;
    } else if (typeof select == "number") {
      return [select, select];
    } else if (select && get.itemtype(select) == "select") {
      return select;
    }
    return [1, 1];
  },
  card(original) {
    if (_status.event.skill) {
      const info = get.info(_status.event.skill);
      const viewAs = info.viewAs;
      let card;
      if (typeof viewAs == "function") {
        const player = _status.event.player;
        if (!player) throw new TypeError("A view-as callback requires an event player");
        card = viewAs(ui.selected.cards, player);
      } else {
        card = viewAs;
      }
      if (card) {
        const cardData = typeof card == "string" ? { name: card } : card;
        if (!cardData || typeof cardData != "object") {
          return card;
        }
        if (!ui.selected.cards.length) {
          const sourceCards = "cards" in cardData && Array.isArray(cardData.cards) ? cardData.cards : void 0;
          return get.autoViewAs(cardData, sourceCards);
        }
        return get.autoViewAs(cardData, ui.selected.cards);
      }
    }
    if (_status.event._get_card) {
      return _status.event._get_card;
    }
    const selectedCard = ui.selected.cards[0];
    if (original) {
      return selectedCard;
    }
    if (selectedCard) {
      return get.autoViewAs(selectedCard, ui.selected.cards);
    }
    return selectedCard;
  },
  /**
   * @returns {GameEvent}
   */
  event() {
    return _status.event;
  }
};
export {
  eventCardsetionMethods
};
