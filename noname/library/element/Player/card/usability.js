import "../../../../../noname.js";
import { CacheContext } from "../../../cache/cacheContext.js";
import { requireParentEvent } from "../dom/nodeGuards.js";
import "../contracts/cardContract.js";
import { get } from "../../../../get/binding.js";
import { game } from "../../../../game/index.js";
import { _status } from "../../../../status/index.js";
import { lib } from "../../../index.js";
const cardUsabilityMethods = {
  canRespond(event, card, type) {
    const player = this;
    if (!event.name?.startsWith("useCard")) {
      return;
    }
    const evt = event.name == "useCard" ? event : event.getParent();
    if (!evt || !evt.card) {
      return;
    }
    const responseCard = typeof card == "string" ? { name: card } : card;
    if (typeof type !== "string") {
      type = type ? "all" : "use";
    }
    const keys = get.canRespond(evt.card);
    if (get.type(evt?.card) == "trick") {
      keys.addArray(get.canRespond("trick"));
    }
    if (get.tag(evt?.card, "damage")) {
      keys.addArray(get.canRespond("damage"));
    }
    keys.addArray(get.canRespond("all"));
    if (responseCard) {
      return keys.some((key) => typeof key == "function" ? key(responseCard, player) : key == get.name(responseCard, player));
    }
    const evtx = get.event();
    let evtNames = typeof type !== "string" || type === "all" ? ["chooseToUse", "chooseToRespond"] : ["chooseTo" + type.slice(0, 1).toUpperCase() + type.slice(1)];
    const cards = player.getCards("hs", (card2) => {
      if (type === "all") {
        return true;
      }
      return evtNames.some((evtName) => {
        let evty = evtx.getParent(evtName);
        if (get.itemtype(evt) !== "event") {
          evty = evtx;
        }
        const parentEvt = evty;
        if (type === "respond") {
          return lib.filter.cardRespondable(card2, player, parentEvt);
        }
        return lib.filter.cardEnabled(card2, player, parentEvt);
      });
    });
    if (!keys.some((key) => typeof key == "function" ? cards.some((card2) => key(card2, player)) : player.hasUsableCard(key, type)) || evt.directHit === true) return false;
    const directHit = evt.directHit;
    if (!Array.isArray(directHit)) throw new TypeError("A response event requires its direct-hit player list");
    return !directHit.includes(player);
  },
  canSave(target) {
    if (this.hasSkillTag("save", true, target, true)) {
      return true;
    }
    let name = {}, hs = this.iterableGetCards("hs");
    for (let i of hs) {
      const cardName = get.name(i);
      if (cardName) {
        name[cardName] = true;
      }
    }
    for (let i in lib.card) {
      if (lib.card[i].savable && (lib.inpile.includes(i) || name[i])) {
        if (lib.filter.cardSavable({ name: i }, this, target) && (_status.connectMode || this.hasUsableCard(i))) {
          return true;
        }
      }
    }
    return false;
  },
  canSaveCard(card, target) {
    const mod2 = game.checkMod(card, this, "unchanged", "cardEnabled2", this);
    if (mod2 != "unchanged") {
      return mod2;
    }
    const mod = game.checkMod(card, this, target, "unchanged", "cardSavable", this);
    if (mod != "unchanged") {
      return mod;
    }
    let savable = get.info(card).savable;
    if (typeof savable == "function") {
      savable = savable(card, this, target);
    }
    return Boolean(savable);
  },
  hasUsableCard(name, type) {
    const player = this;
    if (typeof type !== "string") {
      type = type ? "limit" : "all";
    }
    let event = get.event();
    let evtNames = typeof type !== "string" || type === "all" ? ["chooseToUse", "chooseToRespond"] : ["chooseTo" + type.slice(0, 1).toUpperCase() + type.slice(1)];
    if (player.hasCard((i) => {
      if (get.name(i, player) !== name) {
        return false;
      }
      if (type === "all") {
        return true;
      }
      return evtNames.some((evtName) => {
        let evt = event.getParent(evtName);
        if (get.itemtype(evt) !== "event") {
          evt = event;
        }
        if (type === "respond") {
          return lib.filter.cardRespondable(i, player, requireParentEvent(evt));
        }
        return lib.filter.cardEnabled(i, player, type === "limit" ? requireParentEvent(evt) : "forceEnable");
      });
    }, "hs")) {
      return true;
    }
    const checkEnable = (enable, event2, evtName) => {
      if (typeof enable === "function") {
        return enable(event2);
      }
      if (Array.isArray(enable)) {
        return enable.some((i) => checkEnable(i, event2, evtName));
      }
      if (enable === "phaseUse") {
        return event2.type === "phase" && evtName === "chooseToUse";
      }
      if (typeof enable === "string") {
        return enable === evtName;
      }
      return false;
    };
    const skills = player.getSkills("invisible").concat(lib.skill.global);
    game.expandSkills(skills);
    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i], info = get.info(skill), hiddenCard = info.hiddenCard, usable = info.usable, viewAs = info.viewAs, viewAsFilter = info.viewAsFilter, filter = info.filter;
      if (usable !== void 0) {
        let num = usable;
        if (typeof usable === "function") {
          num = usable(skill, player);
        }
        if (typeof num === "number" && get.skillCount(skill, player) >= num) {
          continue;
        }
      }
      if (info.round && info.round - (game.roundNumber - player.storage[skill + "_roundcount"]) > 0) {
        continue;
      }
      if (player.storage[`temp_ban_${skill}`]) {
        continue;
      }
      if (viewAs && typeof viewAs === "object" && !Array.isArray(viewAs) && viewAs.name === name) {
        const goon = typeof viewAsFilter !== "function" || viewAsFilter(player) !== false;
        const bool = !filter || typeof filter === "function" && evtNames.some((evtName) => {
          let rawEvt = event.getParent(evtName);
          if (get.itemtype(rawEvt) !== "event") {
            rawEvt = get.event();
          }
          const evt = rawEvt;
          if (!evt || !checkEnable(info.enable, evt, evtName)) {
            return false;
          }
          if (evt.name === evtName && typeof evt.filterCard == "function" && !evt.filterCard(new lib.element.VCard(viewAs, "unsure"), player, evt)) {
            return false;
          }
          const onEvent = info["on" + evtName.slice(0, 1).toUpperCase() + evtName.slice(1)];
          if (evt.name === evtName && typeof onEvent === "function") {
            onEvent(evt);
          }
          return evt.name === evtName && typeof filter === "function" ? filter(requireParentEvent(evt), player, evt.triggername) : true;
        });
        if (goon && bool) {
          return true;
        }
      } else if (typeof hiddenCard == "function") {
        const goon = hiddenCard(player, name);
        const bool = !filter || info.enable && typeof filter === "function" && evtNames.some((evtName) => {
          let rawEvt = event.getParent(evtName);
          if (get.itemtype(rawEvt) !== "event") {
            rawEvt = get.event();
          }
          const evt = rawEvt;
          if (!evt || !checkEnable(info.enable, evt, evtName)) {
            return false;
          }
          const onEvent = info["on" + evtName.slice(0, 1).toUpperCase() + evtName.slice(1)];
          if (evt.name === evtName && typeof onEvent === "function") {
            onEvent(evt);
          }
          return evt.name === evtName && typeof filter === "function" ? filter(requireParentEvent(evt), player, evt.triggername) : true;
        });
        if (goon && bool) {
          return true;
        }
      }
    }
    return false;
  },
  canUse(card, target, distance, includecard) {
    if (typeof card == "string") {
      card = { name: card, isCard: true };
    }
    const info = get.info(card);
    if (info.multicheck && !info.multicheck(card, this)) {
      return false;
    }
    if (!lib.filter.cardEnabled(card, this)) {
      return false;
    }
    if (includecard) {
      const candidate = typeof includecard === "object" ? includecard : _status.event.getParent("chooseToUse");
      const evt = get.itemtype(candidate) === "event" ? requireParentEvent(candidate) : void 0;
      if (!lib.filter.cardUsable(card, this, evt)) {
        return false;
      }
    }
    if (distance !== false && !lib.filter.targetInRange(card, this, target)) {
      return false;
    }
    return lib.filter[includecard ? "targetEnabledx" : "targetEnabled"](card, this, target) ?? false;
  },
  hasUseTarget(card, distance, includecard) {
    const player = this;
    return game.hasPlayer2(function(current) {
      return player.canUse(card, current, distance, includecard);
    }, true);
  },
  hasValueTarget(card, distance, includecard) {
    if (typeof card == "string") {
      card = { name: card, isCard: true };
    }
    const player = this;
    const targets = game.filterPlayer2(void 0, void 0, true);
    const value = [];
    let min = 0;
    const info = get.info(card);
    if (!info || info.notarget) {
      return false;
    }
    let range;
    const select = get.copy(info.selectTarget);
    if (select == void 0) {
      if (info.filterTarget == void 0) {
        return true;
      }
      range = [1, 1];
    } else if (typeof select == "number") {
      range = [select, select];
    } else if (Array.isArray(select) && select.length === 2 && typeof select[0] == "number" && typeof select[1] == "number") {
      range = [select[0], select[1]];
    } else if (typeof select == "function") {
      const selectedRange = select(card, player);
      range = typeof selectedRange == "number" ? [selectedRange, selectedRange] : selectedRange;
    }
    if (info.singleCard) {
      range = [1, 1];
    }
    if (!range) {
      return false;
    }
    game.checkMod(card, player, range, "selectTarget", player);
    let cache = CacheContext.requireCacheContext();
    for (let i = 0; i < targets.length; i++) {
      if (player.canUse(card, targets[i], distance, includecard)) {
        const eff = cache.get.effect(targets[i], card, player, player);
        if (range[1] == 1 && eff > 0) {
          return true;
        }
        value.push(eff);
      }
    }
    value.sort(function(a, b) {
      return b - a;
    });
    for (let i = 0; i < value.length; i++) {
      if (i == range[1] || range[1] != -1 && value[i] <= 0) {
        break;
      }
      min += value[i];
    }
    return min > 0;
  },
  getUseValue(card, distance, includecard) {
    if (typeof card == "string") {
      card = { name: card, isCard: true };
    }
    const player = this;
    const targets = game.filterPlayer2(void 0, void 0, true);
    const value = [];
    let min = 0;
    const info = get.info(card);
    if (!info || info.notarget) {
      return 0;
    }
    let range;
    const select = get.copy(info.selectTarget);
    if (select == void 0) {
      if (info.filterTarget == void 0) {
        return 1;
      }
      range = [1, 1];
    } else if (typeof select == "number") {
      range = [select, select];
    } else if (Array.isArray(select) && select.length === 2 && typeof select[0] == "number" && typeof select[1] == "number") {
      range = [select[0], select[1]];
    } else if (typeof select == "function") {
      const selectedRange = select(card, player);
      range = typeof selectedRange == "number" ? [selectedRange, selectedRange] : selectedRange;
    }
    if (info.singleCard) {
      range = [1, 1];
    }
    if (!range) {
      return 0;
    }
    game.checkMod(card, player, range, "selectTarget", player);
    let cache = CacheContext.requireCacheContext();
    for (let i = 0; i < targets.length; i++) {
      if (player.canUse(card, targets[i], distance, includecard)) {
        const eff = cache.get.effect(targets[i], card, player, player);
        value.push(eff);
      }
    }
    value.sort(function(a, b) {
      return b - a;
    });
    for (let i = 0; i < value.length; i++) {
      if (i == range[1] || range[1] != -1 && value[i] <= 0) {
        break;
      }
      min += value[i];
    }
    return min;
  },
  getCardUsable(card, pure) {
    const player = this;
    if (typeof card == "string") {
      card = { name: card };
    }
    card = get.autoViewAs(card);
    let usable = get.info(card).usable;
    if (typeof usable == "function") {
      usable = usable(card, player);
    }
    const checked = game.checkMod(card, player, usable, "cardUsable", player);
    if (typeof checked != "number") {
      return Infinity;
    }
    if (!pure && _status.currentPhase == player) {
      return checked - player.countUsed(card);
    }
    return checked;
  }
};
export {
  cardUsabilityMethods
};
