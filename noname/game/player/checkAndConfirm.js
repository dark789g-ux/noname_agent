import "../../../noname.js";
import { game } from "../index.js";
import { _status } from "../../status/index.js";
import { ui } from "../../ui/index.js";
import { lib } from "../../library/index.js";
import { get } from "../../get/binding.js";
const checkAndConfirmMethods = {
  check(event = _status.event) {
    game.callHook("checkBegin", [event]);
    event._checked = true;
    let ok = true, auto = true, auto_confirm = lib.config.auto_confirm;
    const uppercaseType = (type) => type[0].toUpperCase() + type.slice(1);
    if (!event.filterButton && !event.filterCard && !event.filterTarget && (!event.skill || !event._backup)) {
      if (event.choosing) {
        _status.imchoosing = true;
      }
      return false;
    }
    let useCache = !event.skill && !event.multitarget;
    const filterCache = (type) => {
      if (get.select(event[`select${uppercaseType(type)}`])[1] < 0) {
        return false;
      }
      const cardinfo2 = get.info(get.card() || {});
      if (cardinfo2 && cardinfo2.complexTarget) {
        return false;
      }
      if (type === "button") {
        type = "select";
      }
      return !event[`complex${uppercaseType(type)}`];
    };
    ["button", "card", "target"].forEach((type) => {
      if (!event[`filter${uppercaseType(type)}`]) {
        return;
      }
      if (!filterCache(type)) {
        useCache = false;
      }
      if (!ok) {
        game.uncheck(type);
      } else {
        ({ ok, auto = auto } = game.Check[type](event, useCache));
      }
    });
    game.Check.skill(event);
    _status.multitarget = false;
    const skillinfo = event.skill ? get.info(event.skill) : void 0;
    if (_status.event.multitarget) {
      _status.multitarget = true;
    } else if (_status.event.name === "chooseToUse") {
      if (skillinfo?.multitarget && !skillinfo?.multiline) {
        _status.multitarget = true;
      }
      if (skillinfo?.viewAs && typeof skillinfo.viewAs !== "function") {
        const cardinfo2 = get.info(get.card());
        if (cardinfo2 && (cardinfo2.multitarget || cardinfo2.complexSelect) && !cardinfo2.multiline) {
          _status.multitarget = true;
        }
      }
    }
    const cardinfo = get.info(get.card()) || {};
    if (_status.event.name == "chooseToUse" && (skillinfo?.manualConfirm === true || cardinfo?.manualConfirm === true)) {
      auto_confirm = false;
    }
    const checkedPlayer = event.getPlayer();
    checkedPlayer.node.equips.classList.remove("popequip");
    if (event.filterCard && lib.config.popequip && !_status.nopopequip && get.is.phoneLayout() && typeof event.position === "string" && event.position.includes("e") && checkedPlayer.node.equips.querySelector(".card.selectable")) {
      checkedPlayer.node.equips.classList.add("popequip");
      auto_confirm = false;
    }
    if (event.isMine() && game.chess && get.config("show_distance") && game.me) {
      const players = game.players.slice();
      const card = get.card();
      if (event.deadTarget || event.skill && get.info(event.skill)?.deadTarget || card && get.info(card)?.deadTarget) {
        players.addArray(game.dead);
      }
      players.forEach((player) => {
        if (player === game.me) {
          return player.node.action.hide();
        }
        player.node.action.show();
        const dist = get.distance(game.me, player, "pure");
        const dist2 = get.distance(game.me, player);
        player.node.action.innerHTML = `距离：${dist2}/${dist}`;
        if (dist > 7) {
          player.node.action.classList.add("thunder");
        } else {
          player.node.action.classList.remove("thunder");
        }
      });
    }
    ok = ok && (!event.filterOk || event.filterOk());
    let confirm = "";
    if (ok) {
      confirm += "o";
    }
    if (!event.forced && !event.fakeforce && get.noSelected()) {
      confirm += "c";
    }
    if (event.isMine()) {
      game.Check.confirm(event, confirm);
      const cardChooseAll = event.cardChooseAll;
      if (cardChooseAll instanceof HTMLDivElement) {
        const firstChild = cardChooseAll.firstElementChild;
        if (firstChild) {
          firstChild.innerHTML = ui.selected.cards.length ? "反选" : "全选";
        }
      }
      const buttonChooseAll = event.buttonChooseAll;
      if (buttonChooseAll instanceof HTMLDivElement) {
        buttonChooseAll.innerHTML = ui.selected.buttons.length ? "反选" : "全选";
      }
    }
    game.callHook("checkEnd", [event, { ok, auto, auto_confirm, autoConfirm: auto_confirm }]);
    return ok;
  },
  uncheck(...args) {
    if (args.length === 0) {
      args = ["button", "card", "target"];
    }
    const event = _status.event;
    const players = game.players.slice().concat(game.dead);
    game.callHook("uncheckBegin", [event, args]);
    if (game.chess) {
      const shadows = Array.from(ui.chessContainer.querySelectorAll(".playergrid.temp"));
      shadows.forEach((i) => i.remove());
    }
    if (event.player) {
      event.player.node.equips.classList.remove("popequip");
    }
    if (args.includes("button") && event.dialog && event.dialog.buttons) {
      event.dialog.buttons.forEach((button) => {
        button.classList.remove("selectable");
        button.classList.remove("selected");
        game.callHook("uncheckButton", [button, event]);
      });
      ui.selected.buttons.length = 0;
    }
    if (args.includes("card") && event.player) {
      const cards = event.player.getCards("hejsx");
      cards.forEach((card) => {
        card.classList.remove("selected");
        card.classList.remove("selectable");
        card.updateTransform(false);
        game.callHook("uncheckCard", [card, event]);
      });
      ui.selected.cards.length = 0;
    }
    if (args.includes("target")) {
      players.forEach((target) => {
        target.classList.remove("selected");
        target.classList.remove("selectable");
        game.callHook("uncheckTarget", [target, event]);
      });
      ui.selected.targets.length = 0;
    }
    if (args.length === 3) {
      ui.arena.classList.remove("selecting");
      ui.arena.classList.remove("tempnoe");
      _status.imchoosing = false;
      _status.lastdragchange.length = 0;
      _status.mousedragging = null;
      _status.mousedragorigin = null;
      ui.touchlines.forEach((i) => i.delete());
      ui.touchlines.length = 0;
    }
    ui.canvas.width = ui.arena.offsetWidth;
    ui.canvas.height = ui.arena.offsetHeight;
    players.forEach((i) => i.unprompt());
    _status.dragline.forEach((i) => i && i.remove());
    _status.dragline.length = 0;
    ui.arena.classList.remove("dragging");
    game.callHook("uncheckEnd", [event, args]);
  }
};
export {
  checkAndConfirmMethods
};
