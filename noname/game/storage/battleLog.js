import "../../../noname.js";
import { getRegisteredSkill } from "../../library/skillRegistry.js";
import { game } from "../index.js";
import { _status } from "../../status/index.js";
import { get } from "../../get/binding.js";
import { ui } from "../../ui/index.js";
import { lib } from "../../library/index.js";
function isHistoryLogNode(value) {
  if (!(value instanceof HTMLDivElement) || !("node" in value) || !value.node || typeof value.node != "object" || !("logvid" in value) || typeof value.logvid != "string" || !("added" in value) || !Array.isArray(value.added)) {
    return false;
  }
  const details = value.node;
  return (!("avatar" in details) || details.avatar === void 0 || details.avatar instanceof HTMLDivElement) && (!("avatar2" in details) || details.avatar2 === void 0 || details.avatar2 instanceof HTMLDivElement) && (!("text" in details) || details.text === void 0 || details.text instanceof HTMLDivElement);
}
function isArenaLogNode(value) {
  return value instanceof HTMLDivElement && (!("timeout" in value) || value.timeout === void 0 || typeof value.timeout == "number");
}
const battleLogMethods = {
  log(...args) {
    let str = "", str2 = "", logvid = null;
    const color = /* @__PURE__ */ new Map([
      ["r", "fire"],
      ["y", "yellow"],
      ["g", "green"],
      ["b", "blue"]
    ]);
    args.forEach((value) => {
      const itemtype = get.itemtype(value);
      if (itemtype == "player" || itemtype == "players") {
        str += `<span class="bluetext">${get.translation(value)}</span>`;
        str2 += get.translation(value);
      } else if (itemtype == "cards" || itemtype == "card" || typeof value == "object" && value && value.name) {
        str += `<span class="yellowtext">${get.translation(value)}</span>`;
        str2 += get.translation(value);
      } else if (typeof value == "object") {
        if (value.parentNode == ui.historybar) {
          logvid = value.logvid;
        } else {
          str += get.translation(value);
          str2 += get.translation(value);
        }
      } else if (typeof value == "string") {
        if (value[0] == "【" && value[value.length - 1] == "】") {
          str += `<span class="greentext">${get.translation(value)}</span>`;
          str2 += get.translation(value);
        } else if (value[0] == "#") {
          str += `<span class="${color.get(value[1]) || ""}text">${get.translation(value.slice(2))}</span>`;
          str2 += get.translation(value.slice(2));
        } else {
          str += get.translation(value);
          str2 += get.translation(value);
        }
      } else {
        str += value;
        str2 += value;
      }
    });
    const node = ui.create.div();
    node.innerHTML = lib.config.log_highlight ? str : str2;
    ui.sidebar.insertBefore(node, ui.sidebar.firstChild);
    game.addVideo("log", null, lib.config.log_highlight ? str : str2);
    game.broadcast((str3, str22) => game.log(lib.config.log_highlight ? str3 : str22), str, str2);
    if (!_status.video && !game.online) {
      if (logvid) {
        game.logv(logvid, `<div class="text center">${lib.config.log_highlight ? str : str2}</div>`);
      } else {
        logvid = _status.event.getLogv();
      }
    }
    if (lib.config.show_log == "off" || game.chess) {
      return;
    }
    const nodeentry = node.cloneNode(true);
    if (!isArenaLogNode(nodeentry)) {
      return;
    }
    ui.arenalog.insertBefore(nodeentry, ui.arenalog.firstChild);
    if (!lib.config.clear_log) {
      while (ui.arenalog.childNodes.length && ui.arenalog.scrollHeight > ui.arenalog.offsetHeight) {
        const lastEntry = ui.arenalog.lastElementChild;
        if (!(lastEntry instanceof HTMLDivElement)) {
          break;
        }
        lastEntry.remove();
      }
    }
    if (!lib.config.low_performance) {
      nodeentry.style.transition = "all 0s";
      nodeentry.style.marginBottom = `-${nodeentry.offsetHeight}px`;
      ui.refresh(nodeentry);
      nodeentry.style.transition = "";
      nodeentry.style.marginBottom = "";
    }
    if (!lib.config.clear_log) {
      return;
    }
    nodeentry.timeout = window.setTimeout(() => nodeentry.delete(), 1e3);
    Array.from(ui.arenalog.childNodes).forEach((value) => {
      if (!isArenaLogNode(value)) {
        return;
      }
      if (!value.timeout) {
        value.remove();
      }
    });
  },
  logv(player, card, targets, event, forced, logvid) {
    if (!player) {
      player = _status.event.getParent().logvid;
      if (!player) {
        return;
      }
    }
    logvid = logvid || get.id();
    const node = Object.assign(ui.create.div(".hidden"), {
      node: {},
      logvid,
      added: []
    });
    game.broadcast(game.logv, player, card, targets, event, forced, logvid);
    if (typeof player == "string") {
      const childNode = Array.from(ui.historybar.childNodes).filter(isHistoryLogNode).find((value) => value.logvid == player);
      if (childNode) {
        childNode.added.push(card);
      }
      return;
    }
    if (typeof card == "string") {
      if (card != "die") {
        const skill = getRegisteredSkill(lib.skill, card);
        if (skill && skill.logv === false && !forced) {
          return;
        }
        if (!lib.translate[card]) {
          return;
        }
      }
      let avatar;
      if (!player.isUnseen(0)) {
        avatar = player.node.avatar.cloneNode();
      } else if (!player.isUnseen(1)) {
        avatar = player.node.avatar2.cloneNode();
      } else {
        return;
      }
      if (!(avatar instanceof HTMLDivElement)) {
        return;
      }
      node.node.avatar = avatar;
      avatar.style.transform = "";
      avatar.className = "avatar";
      if (card == "die") {
        node.dead = true;
        node.player = player;
        const avatar2 = avatar.cloneNode();
        if (!(avatar2 instanceof HTMLDivElement)) {
          return;
        }
        avatar2.className = "avatarbg grayscale1";
        avatar.appendChild(avatar2);
        avatar.style.opacity = "0.6";
      } else {
        const text = ui.create.div("", get.translation(card, "skill"), avatar);
        text.dataset.nature = "water";
        node.node.text = text;
        node.skill = card;
      }
      node.appendChild(avatar);
      if (card == "die" && targets && targets != player) {
        node.source = targets;
        if (Array.isArray(targets)) {
          throw new TypeError("player.isUnseen is not a function");
        }
        player = targets;
        if (!player.isUnseen(0)) {
          avatar = player.node.avatar.cloneNode();
        } else if (!player.isUnseen(1)) {
          avatar = player.node.avatar2.cloneNode();
        } else if (get.mode() == "guozhan" && player.node && player.node.name_seat) {
          avatar = ui.create.div(".avatar.cardbg");
          avatar.innerHTML = player.node.name_seat.innerHTML[0];
        } else {
          return;
        }
        if (!(avatar instanceof HTMLDivElement)) {
          return;
        }
        avatar.style.transform = "";
        node.node.avatar2 = avatar;
        avatar.classList.add("avatar2");
        node.appendChild(avatar);
      }
    } else if (Array.isArray(card)) {
      node.cards = card[1].slice(0);
      let cardItem = card[0];
      const info = {
        suit: get.plainText(cardItem.suit || ""),
        number: cardItem.number || "",
        name: cardItem.name || "",
        nature: typeof cardItem.nature == "string" || typeof cardItem.nature == "boolean" ? cardItem.nature : ""
      };
      if (!Array.isArray(node.cards) || !node.cards.length) {
        node.cards = [ui.create.card(node, "noclick", true).init(info)];
      }
      if (cardItem.name == "wuxie") {
        const previous = ui.historybar.firstElementChild;
        if (isHistoryLogNode(previous) && previous.type == "wuxie" && Array.isArray(previous.players) && Array.isArray(previous.cards)) {
          previous.players.push(player);
          previous.cards.addArray(node.cards);
          return;
        }
        node.type = "wuxie";
        node.players = [player];
      }
      if (cardItem instanceof lib.element.Card) {
        cardItem.copy(node, false);
      } else {
        cardItem = ui.create.card(node, "noclick", true);
        cardItem.init(info);
      }
      let avatar;
      if (!player.isUnseen(0)) {
        avatar = player.node.avatar.cloneNode();
      } else if (!player.isUnseen(1)) {
        avatar = player.node.avatar2.cloneNode();
      } else if (get.mode() == "guozhan" && player.node && player.node.name_seat) {
        avatar = ui.create.div(".avatar.cardbg");
        avatar.innerHTML = player.node.name_seat.innerHTML[0];
      } else {
        return;
      }
      if (!(avatar instanceof HTMLDivElement)) {
        return;
      }
      node.node.avatar = avatar;
      avatar.style.transform = "";
      avatar.classList.add("avatar2");
      node.appendChild(avatar);
      if (Array.isArray(targets) && targets.length == 1 && targets[0] != player && get.itemtype(targets[0]) == "player") {
        (() => {
          let avatar2;
          const target = targets[0];
          if (!("isUnseen" in target)) {
            throw new TypeError("A player history avatar requires a player target");
          }
          if (!target.isUnseen(0)) {
            avatar2 = target.node.avatar.cloneNode();
          } else if (!player.isUnseen(1)) {
            avatar2 = target.node.avatar2.cloneNode();
          } else if (get.mode() == "guozhan" && target.node && target.node.name_seat) {
            avatar2 = ui.create.div(".avatar.cardbg");
            avatar2.innerHTML = target.node.name_seat.innerHTML[0];
          } else {
            return;
          }
          if (!(avatar2 instanceof HTMLDivElement)) {
            return;
          }
          node.node.avatar2 = avatar2;
          avatar2.style.transform = "";
          avatar2.classList.add("avatar2");
          avatar2.classList.add("avatar3");
          node.insertBefore(avatar2, avatar);
        })();
      }
    }
    if (Array.isArray(targets) && targets.length) {
      if (targets.length == 1 && targets[0] == player) {
        node.targets = [];
      } else {
        node.targets = targets;
      }
    }
    const fullheight = ui.historybar.offsetHeight, num = Math.round((fullheight - 8) / 50), margin = (fullheight - 42 * num) / (num + 1);
    node.style.transform = "scale(0.8)";
    ui.historybar.insertBefore(node, ui.historybar.firstChild);
    ui.refresh(node);
    node.classList.remove("hidden");
    Array.from(ui.historybar.childNodes).forEach((value, index) => {
      if (!isHistoryLogNode(value)) {
        return;
      }
      if (index < num) {
        value.style.transform = `scale(1) translateY(${margin + index * (42 + margin) - 4}px)`;
        return;
      }
      if (value.removetimeout) {
        return;
      }
      value.style.opacity = "0";
      value.style.transform = `scale(1) translateY(${fullheight}px)`;
      value.removetimeout = setTimeout(
        /* @__PURE__ */ ((current) => () => current.remove())(value),
        500
      );
    });
    if (lib.config.touchscreen) {
      node.addEventListener("touchstart", ui.click.intro);
    } else {
      node.addEventListener(lib.config.pop_logv ? "mousemove" : "click", ui.click.logv);
      node.addEventListener("mouseleave", ui.click.logvleave);
    }
    if (!game.online) {
      event = event || _status.event;
      event.logvid = node.logvid;
    }
    return node;
  }
};
export {
  battleLogMethods,
  isArenaLogNode,
  isHistoryLogNode
};
