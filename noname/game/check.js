import "../../noname.js";
import "../library/selection/index.js";
import { ui } from "../ui/index.js";
import { get } from "../get/binding.js";
import { lib } from "../library/index.js";
import { game } from "./index.js";
import { SelectionValidator } from "../library/selection/validator.js";
import { _status } from "../status/index.js";
function readEventNoConfirm(event) {
  return Reflect.get(event, "noconfirm");
}
class Check {
  processSelection({ type, items, event, useCache, isSelectable }) {
    let ok = true, auto;
    const uppercaseType = (type2) => type2[0].toUpperCase() + type2.slice(1);
    const uiSelected = ui.selected[`${type}s`];
    const range = get.select(event[`select${uppercaseType(type)}`]);
    if (event.forceAuto && uiSelected.length === range[1]) {
      auto = true;
    } else if (range[0] !== range[1] || range[0] > 1) {
      auto = false;
    }
    let cache;
    let firstCheck = false;
    if (useCache) {
      if (!event[`_${type}Choice`]) {
        event[`_${type}Choice`] = {};
      }
      let cacheId = 0;
      for (let Type of ["button", "card", "target"]) {
        if (type === Type) {
          break;
        }
        if (Type === "target") {
          Type = "player";
        }
        ui.selected[`${Type}s`].forEach((i) => cacheId ^= i[`${Type}id`]);
      }
      if (!event[`_${type}Choice`][cacheId]) {
        event[`_${type}Choice`][cacheId] = [];
        firstCheck = true;
      }
      cache = event[`_${type}Choice`][cacheId];
    }
    const getSelectable = (item) => {
      if (!useCache) {
        return isSelectable(item, event);
      }
      if (!firstCheck) {
        return cache.includes(item);
      }
      const selectable = isSelectable(item, event);
      if (selectable) {
        cache.push(item);
      }
      return selectable;
    };
    if (range[1] <= -1) {
      let selectableItems = false;
      items.forEach((item) => {
        const selectable = lib.filter.cardAiIncluded(item) && getSelectable(item);
        if (selectable) {
          item.classList.add("selected");
          uiSelected.add(item);
          selectableItems = true;
        } else {
          item.classList.remove("selected");
          uiSelected.remove(item);
        }
        if (item.updateTransform) {
          item.updateTransform(selectable);
        }
        if (!item.classList.contains("selectable") && item.classList.contains("selected")) {
          item.classList.add("selectable");
        }
        game.callHook(`check${uppercaseType(type)}`, [item, event]);
      });
      if (event[`${type}Required`] && uiSelected.length === 0) {
        ok = false;
      } else if (uiSelected.length < range[0] && (!event.forced || selectableItems || event.complexSelect)) {
        ok = false;
      }
      if (typeof event.custom?.add?.[type] == "function") {
        event.custom.add[type]();
      }
      return { ok, auto };
    }
    const evaluation = SelectionValidator.inspect({
      type,
      items,
      selected: uiSelected,
      range,
      isIncluded: (item) => lib.filter.cardAiIncluded(item),
      isSelectable: getSelectable
    });
    evaluation.entries.forEach(({ item, available: selectable }) => {
      if (selectable && uiSelected.length < range[1]) {
        item.classList.add("selectable");
      } else {
        item.classList.remove("selectable");
      }
      if (!item.classList.contains("selectable") && item.classList.contains("selected")) {
        item.classList.add("selectable");
      }
      game.callHook(`check${uppercaseType(type)}`, [item, event]);
    });
    const outcome = SelectionValidator.complete({
      type,
      selected: uiSelected,
      inspection: evaluation,
      required: event[`${type}Required`],
      forced: event.forced,
      complex: event.complexSelect,
      strict: false,
      enforceMax: false
    });
    ok = outcome.ok;
    if (typeof event.custom?.add?.[type] == "function") {
      event.custom.add[type]();
    }
    return { ok, auto };
  }
  button(event, useCache) {
    const player = event.player;
    const buttons = event.dialog.buttons;
    const isSelectable = (button, event2) => {
      if (!lib.filter.buttonIncluded(button)) {
        return false;
      }
      if (button.classList.contains("unselectable")) {
        return false;
      }
      return event2.filterButton(button, player);
    };
    return game.Check.processSelection({ type: "button", items: buttons, event, useCache, isSelectable });
  }
  card(event, useCache) {
    const player = event.player;
    const cards = player.getCards(event.position);
    const isSelectable = (card, event2) => {
      if (card.classList.contains("uncheck")) {
        return false;
      }
      if (player.isOut()) {
        return false;
      }
      if (!lib.filter.cardRespondable(card, player)) {
        return false;
      }
      return event2.filterCard(card, player);
    };
    return game.Check.processSelection({ type: "card", items: cards, event, useCache, isSelectable });
  }
  target(event, useCache) {
    const player = event.player;
    const card = get.card();
    const targets = game.players.slice();
    if (event.deadTarget || card && get.info(card)?.deadTarget) {
      targets.addArray(game.dead);
    }
    const isSelectable = (target, event2) => {
      if (game.chess && !(event2.chessForceAll || card && get.info(card)?.chessForceAll) && player && get.distance(player, target, "pure") > 7) {
        return false;
      }
      if (target.isOut() && !event2.includeOut && !(event2.skill && get.info(event2.skill)?.includeOut) && !(card && get.info(card)?.includeOut)) {
        return false;
      }
      return event2.filterTarget(card, player, target);
    };
    return game.Check.processSelection({ type: "target", items: targets, event, useCache, isSelectable });
  }
  skill(event) {
    if (ui.skills) {
      ui.skills.close();
    }
    if (ui.skills2) {
      ui.skills2.close();
    }
    if (ui.skills3) {
      ui.skills3.close();
    }
    if (event.skill || !get.noSelected() || _status.noconfirm) {
      return;
    }
    const player = event.player;
    if (!event._skillChoice) {
      event._skillChoice = game.expandSkills(player.getSkills("invisible").concat(lib.skill.global)).filter((skill) => lib.filter.filterEnable(event, player, skill));
    }
    const skills = event._skillChoice.filter((i) => event.isMine() || !event._aiexclude.includes(i));
    const globallist = game.expandSkills(lib.skill.global.slice());
    const ownedlist = game.expandSkills(player.getSkills("invisible", false));
    const ownedSkills = [], globalSkills = [], equipSkills = [];
    skills.forEach((skill) => {
      if (globallist.includes(skill)) {
        globalSkills.push(skill);
      } else if (!ownedlist.includes(skill)) {
        equipSkills.push(skill);
      } else {
        ownedSkills.push(skill);
      }
    });
    if (ownedSkills.length) {
      ui.create.skills(ownedSkills);
    }
    if (globalSkills.length) {
      ui.create.skills2(globalSkills);
    }
    if (equipSkills.length) {
      ui.create.skills3(equipSkills);
    }
  }
  confirm(event, confirm) {
    ui.arena.classList.add("selecting");
    if (event.filterTarget && (!event.filterCard || !event.position || typeof event.position == "string" && !event.position.includes("e"))) {
      ui.arena.classList.add("tempnoe");
    }
    game.countChoose();
    if (!_status.noconfirm && !readEventNoConfirm(_status.event) && (_status.mouseleft || !_status.mousedown)) {
      ui.create.confirm(confirm);
    }
  }
}
export {
  Check
};
