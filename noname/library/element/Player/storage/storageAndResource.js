import "../../../../../noname.js";
import dedent from "../../../../../node_modules/.pnpm/dedent@1.7.1/node_modules/dedent/dist/dedent.js";
import "../contracts/instanceFieldsContract.js";
import "../contracts/storageHistoryContract.js";
import { get } from "../../../../get/binding.js";
import { game } from "../../../../game/index.js";
import { lib } from "../../../index.js";
import { _status } from "../../../../status/index.js";
import { ui } from "../../../../ui/index.js";
const storageAndResourceMethods = {
  addTip(index, message, isTemp = false, css = {}) {
    const player = this;
    if (player.getHiddenSkills(true, true).includes(index)) {
      return;
    }
    game.broadcastAll(
      (player2, index2, message2, css2) => {
        player2.node.tipContainer ??= ui.create.div(".tipContainer", player2);
        player2.tips ??= /* @__PURE__ */ new Map();
        if (!player2.tips.has(index2)) {
          player2.tips.set(index2, ui.create.div(".tip", player2.node.tipContainer));
        }
        const tip = player2.tips.get(index2);
        if (tip) {
          tip.innerHTML = message2.replace(/ /g, "&nbsp;").replace(/(?:♥︎|♦︎)/g, '<span style="color: red; ">$&</span>').replace(/\n/g, "<br>");
          tip.css(css2);
        }
        let double = player2.classList.contains("fullskin2") && lib.config.layout !== "long2";
        const width = player2.node.avatar.clientWidth;
        let w = width * (double ? 2 : 1);
        player2.style.setProperty("--w", `${w}px`);
        game.callHook("checkTipBottom", [player2]);
      },
      player,
      index,
      message,
      css
    );
    if (isTemp && !player.storage[`temp_tip_${index}`]) {
      player.storage[`temp_tip_${index}`] = true;
      const expire = isTemp === true ? { global: ["phaseAfter", "phaseBeforeStart"] } : typeof isTemp == "string" || Array.isArray(isTemp) ? { global: isTemp } : isTemp;
      player.when(expire, false).assign({
        firstDo: true,
        priority: Infinity
      }).step(async (event, trigger, player2) => {
        delete player2.storage[`temp_tip_${index}`];
        player2.removeTip(index);
      }).finish();
    }
  },
  removeTip(index) {
    game.broadcastAll(
      (player, index2) => {
        if (index2 == void 0) {
          player.tips?.clear();
        } else {
          if (player.tips?.has(index2)) {
            player.tips.get(index2)?.remove();
            player.tips.delete(index2);
          }
        }
        if (!player.tips?.size) {
          player.node.tipContainer?.remove();
          delete player.node.tipContainer;
        }
      },
      this,
      index
    );
  },
  changeFury(amount, limit) {
    if (typeof this.storage.stratagem_fury != "number") {
      this.storage.stratagem_fury = 0;
    }
    if (!amount) {
      return;
    }
    const furyBefore = this.storage.stratagem_fury;
    if (limit === true && typeof _status.stratagemFuryMax == "number") {
      this.storage.stratagem_fury = Math.min(Math.max(furyBefore + amount, 0), _status.stratagemFuryMax);
    } else {
      this.storage.stratagem_fury = Math.max(furyBefore + amount, 0);
    }
    const difference = this.storage.stratagem_fury - furyBefore;
    if (!difference) {
      return;
    }
    game.log(this, difference > 0 ? "获得了" : "失去了", get.cnNumber(Math.abs(difference)), "点", "#r怒气");
    this.markSkill("stratagem_fury");
  },
  addCharge(num, log) {
    if (typeof num != "number" || !num) {
      num = 1;
    }
    let maxCharge = this.getMaxCharge();
    if (maxCharge == Infinity) {
      this.addMark("charge", num, log);
    } else {
      num = Math.min(num, maxCharge - this.countMark("charge"));
      if (num > 0) {
        this.addMark("charge", num, log);
      }
    }
  },
  removeCharge(num, log) {
    if (typeof num != "number" || !num) {
      num = 1;
    }
    num = Math.min(num, this.countMark("charge"));
    if (num > 0) {
      this.removeMark("charge", num, log);
    }
  },
  countCharge(max) {
    if (max) {
      if (this.getMaxCharge() == Infinity) {
        return Infinity;
      }
      return this.getMaxCharge() - this.countMark("charge");
    }
    return this.countMark("charge");
  },
  getMaxCharge() {
    let skills = game.expandSkills(this.getSkills(null, null, false).concat(lib.skill.global));
    let max = 0;
    for (let skill of skills) {
      const info = get.info(skill);
      if (!info || typeof info.chargeSkill != "number") {
        continue;
      }
      if (info.chargeSkill == Infinity) {
        return Infinity;
      }
      max += info.chargeSkill;
    }
    max = game.checkMod(this, max, "maxCharge", this);
    return typeof max == "number" ? Math.max(0, max) : Infinity;
  },
  getCacheKey(similar) {
    let prefix = "[object:";
    if (similar !== false) {
      prefix = "[player:";
    }
    if (this.playerid) {
      return prefix + this.playerid + "]";
    }
    return prefix + dedent`
			${this.name}+${this.sex}+${this.group}+${this.hp}+${this.maxHp}+${this.hujia}+${"[" + this.skills.join(",") + "]"}+${this.name1}+${this.name2}]
		`;
  },
  syncStorage(skill) {
    switch (get.itemtype(this.storage[skill])) {
      case "cards":
        game.addVideo("storage", this, [skill, get.cardsInfo(this.storage[skill]), "cards"]);
        break;
      case "card":
        game.addVideo("storage", this, [skill, get.cardInfo(this.storage[skill]), "card"]);
        break;
      default:
        try {
          game.addVideo("storage", this, [skill, JSON.parse(JSON.stringify(this.storage[skill]))]);
        } catch (e) {
          console.log(this.storage[skill]);
        }
    }
  },
  setStorage(name, value, mark) {
    this.storage[name] = value;
    if (mark) {
      this.markAuto(name);
    }
    return value;
  },
  getStorage(name, defaultValue = []) {
    return this.storage[name] || defaultValue;
  },
  hasStorage(name, value) {
    if (!(name in this.storage)) {
      return false;
    }
    if (typeof value == "undefined") {
      return true;
    }
    const storage = this.storage[name];
    if (storage === value) {
      return true;
    }
    return Array.isArray(storage) && storage.includes(value);
  },
  hasStorageAny(name, values) {
    const storage = this.storage[name];
    if (!Array.isArray(values)) {
      values = Array.from(arguments).slice(1);
    }
    if (!storage) {
      return false;
    }
    if (!Array.isArray(storage)) {
      return values.includes(storage);
    }
    return values.some((item) => storage.includes(item));
  },
  hasStorageAll(name, values) {
    const storage = this.storage[name];
    if (!Array.isArray(values)) {
      values = Array.from(arguments).slice(1);
    }
    if (!storage) {
      return false;
    }
    if (!Array.isArray(storage)) {
      return false;
    }
    return values.every((item) => storage.includes(item));
  },
  initStorage(name, value, mark) {
    return this.hasStorage(name) ? this.getStorage(name) : this.setStorage(name, value, mark);
  },
  updateStorage(name, operation, mark) {
    return this.setStorage(name, operation(this.getStorage(name)), mark);
  },
  updateStorageAsync(name, operation, mark) {
    return Promise.resolve(this.getStorage(name)).then((value) => operation(value)).then((value) => this.setStorage(name, value, mark));
  },
  removeStorage(name, mark) {
    if (!this.hasStorage(name)) {
      return false;
    }
    delete this.storage[name];
    if (mark) {
      this.unmarkSkill(name);
    }
    return true;
  }
};
export {
  storageAndResourceMethods
};
