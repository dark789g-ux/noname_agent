import "../../../../noname.js";
import { _status } from "../../../status/index.js";
import { get } from "../../../get/binding.js";
import { game } from "../../../game/index.js";
import { lib } from "../../index.js";
const stateMethods = {
  getParent(level = 1, forced, includeSelf) {
    let event = this;
    let i = 0;
    const toreturn = forced ? void 0 : {};
    const historys = [];
    const filter = typeof level === "function" ? level : typeof level === "number" ? (evt) => i === level : (evt) => evt.name === level;
    while (true) {
      if (!event) {
        return toreturn;
      }
      historys.push(event);
      if (filter(event) && (includeSelf || i !== 0)) {
        return event;
      }
      if (game.online && event._modparent) {
        event = event._modparent;
      } else {
        event = event.parent;
      }
      if (event && historys.includes(event)) {
        return toreturn;
      }
      i++;
    }
  },
  async checkSkipped() {
    if (!this.player || !this.player.skipList.includes(this.name) && !this.isSkipped) {
      return false;
    }
    this.player.skipList.remove(this.name);
    if (lib.phaseName.includes(this.name)) {
      this.player.getHistory("skipped").add(this.name);
    }
    this.finish();
    await this.trigger(this.name + "Skipped");
    return true;
  },
  finish() {
    this.finished = true;
  },
  // @todo 奇怪的参数
  cancel(all, player, notrigger) {
    this.untrigger(all, player);
    let next;
    if (!notrigger) {
      if (this.player && lib.phaseName.includes(this.name)) {
        this.player.getHistory("skipped").add(this.name);
      }
      this._cancelled = true;
      next = this.trigger(this.name + "Cancelled");
    }
    this.finish();
    return next;
  },
  async neutralize(event = _status.event) {
    if (this._neutralized) {
      return this._triggering;
    }
    this._neutralized = true;
    this._neutralize_event = event;
    const next = this.trigger("eventNeutralized");
    if (next) {
      next.filterStop = function() {
        if (!this._neutralized) {
          delete this.filterStop;
          return true;
        }
        return false;
      };
    }
    await next;
    if (this._neutralized == true) {
      this.untrigger();
      this.finish();
    }
  },
  unneutralize() {
    if (!this._neutralized) {
      return;
    }
    this._neutralized = false;
    if (this.type == "card" && this.card && this.name == "sha") {
      this.directHit = true;
    }
  },
  goto(step) {
    this.step = step;
    return this;
  },
  redo() {
    this.goto(this.step);
    return this;
  },
  getPlayer() {
    const player = this.player;
    if (!player) {
      throw new Error(`${this.name || "unnamed"} event requires a player`);
    }
    return player;
  },
  getPlayers() {
    const players = this.players;
    if (!players) {
      throw new Error(`${this.name || "unnamed"} event requires players`);
    }
    return players;
  },
  getTarget() {
    const target = this.target;
    if (!target || target === "cardPile") {
      throw new Error(`${this.name || "unnamed"} event requires a target`);
    }
    return target;
  },
  getTargets() {
    const targets = this.targets;
    if (!targets) {
      throw new Error(`${this.name || "unnamed"} event requires targets`);
    }
    return targets;
  },
  changeToZero() {
    Object.assign(this, { num: 0, numFixed: true });
    return this;
  },
  setHiddenSkill(skill) {
    if (!this.player) {
      return this;
    }
    const hidden = this.player.hiddenSkills.slice(0);
    game.expandSkills(hidden);
    if (hidden.includes(skill)) {
      this.set("hsskill", skill);
    }
    return this;
  },
  getLogv() {
    for (let i = 1; i <= 3; i++) {
      const event = this.getParent(i);
      if (event && event.logvid) {
        return event.logvid;
      }
    }
    return null;
  },
  getRand(name) {
    if (name) {
      if (!this._rand_map) {
        this._rand_map = {};
      }
      if (!this._rand_map[name]) {
        this._rand_map[name] = Math.random();
      }
      return this._rand_map[name];
    }
    if (!this._rand) {
      this._rand = Math.random();
    }
    return this._rand;
  },
  isMine() {
    return this.player?.isMine();
  },
  isOnline() {
    return this.player?.isOnline();
  },
  notLink() {
    return this.getParent().name != "_lianhuan" && this.getParent().name != "_lianhuan2";
  },
  isPhaseUsing(player) {
    const evt = this.getParent("phaseUse");
    if (!evt || evt.name != "phaseUse") {
      return false;
    }
    return !player || player == evt.player;
  },
  putStepCache(key, value) {
    if (!this._stepCache) {
      this._stepCache = {};
    }
    this._stepCache[key] = value;
    return this;
  },
  getStepCache(key) {
    if (!this._stepCache) {
      return void 0;
    }
    return this._stepCache[key];
  },
  clearStepCache(key) {
    if (key !== void 0 && key !== null) {
      const cache = this._stepCache;
      if (!cache) {
        throw new TypeError("Cannot clear an uninitialized step cache");
      }
      delete cache[key];
    }
    delete this._stepCache;
    return this;
  },
  callFuncUseStepCache(prefix, func, params) {
    if (typeof func != "function") {
      return;
    }
    if (_status.closeStepCache) {
      return func.apply(null, params);
    }
    const cacheKey = "[" + prefix + "]" + get.paramToCacheKey.apply(null, params);
    let ret = this.getStepCache(cacheKey);
    if (ret === void 0 || ret === null) {
      ret = func.apply(null, params);
      this.putStepCache(cacheKey, ret);
    }
    return ret;
  },
  putTempCache(key1, key2, value) {
    if (!this._tempCache) {
      this._tempCache = {};
    }
    if (!this._tempCache[key1]) {
      this._tempCache[key1] = {};
    }
    this._tempCache[key1][key2] = value;
    return value;
  },
  getTempCache(key1, key2) {
    if (!this._tempCache) {
      return void 0;
    }
    if (!this._tempCache[key1]) {
      return void 0;
    }
    return this._tempCache[key1][key2];
  }
};
export {
  stateMethods
};
