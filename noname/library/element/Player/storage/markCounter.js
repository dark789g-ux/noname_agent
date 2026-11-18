import "../../../../../noname.js";
import { getRegisteredSkill } from "../../../skillRegistry.js";
import { isMarkNode, hasFixedMarkInfo, getMarkCount, deleteMarkNode } from "../dom/nodeGuards.js";
import "../contracts/instanceFieldsContract.js";
import "../contracts/storageHistoryContract.js";
import { game } from "../../../../game/index.js";
import { _status } from "../../../../status/index.js";
import { lib } from "../../../index.js";
import { ui } from "../../../../ui/index.js";
import { get } from "../../../../get/binding.js";
const markCounterMethods = {
  clearMark(i, log) {
    let num = this.countMark(i);
    if (num > 0) {
      this.removeMark(i, num, log);
    }
  },
  removeMark(i, num, log) {
    if (typeof num != "number" || !num) {
      num = 1;
    }
    if (typeof this.storage[i] != "number" || !this.storage[i]) {
      return;
    }
    if (num > this.storage[i]) {
      num = this.storage[i];
    }
    this.storage[i] -= num;
    if (log !== false) {
      const info2 = get.info(i);
      const markName = info2?.intro && (info2.intro.name2 || info2.intro.name);
      const str = markName ? String(markName) : lib.translate[i] || "";
      if (str) {
        game.log(this, "移去了", get.cnNumber(num), "个", "#g【" + str + "】");
      }
    }
    this.syncStorage(i);
    const info = getRegisteredSkill(lib.skill, i);
    this[this.storage[i] || info?.mark ? "markSkill" : "unmarkSkill"](i);
    const next = game.createEvent("removeMark", false, get.event());
    next.player = this;
    next.num = num;
    next.markName = i;
    next.log = log;
    next.forceDie = true;
    next.includeOut = true;
    next.setContent("emptyEvent");
  },
  addMark(i, num, log) {
    if (typeof num != "number" || !num) {
      num = 1;
    }
    if (typeof this.storage[i] != "number") {
      this.storage[i] = 0;
    }
    this.storage[i] += num;
    if (log !== false) {
      const info = get.info(i);
      const markName = info?.intro && (info.intro.name2 || info.intro.name);
      const str = markName ? String(markName) : lib.translate[i] || "";
      if (str) {
        game.log(this, "获得了", get.cnNumber(num), "个", "#g【" + str + "】");
      }
    }
    this.syncStorage(i);
    this.markSkill(i);
    const next = game.createEvent("addMark", false, get.event());
    next.player = this;
    next.num = num;
    next.markName = i;
    next.log = log;
    next.forceDie = true;
    next.includeOut = true;
    next.setContent("emptyEvent");
  },
  setMark(name, num, log) {
    const count = this.countMark(name);
    if (count > num) {
      this.removeMark(name, count - num, log);
    } else if (count < num) {
      this.addMark(name, num - count, log);
    }
  },
  countMark(i) {
    if (this.storage[i] == void 0) {
      return 0;
    }
    if (typeof this.storage[i] == "number") {
      return this.storage[i];
    }
    if (Array.isArray(this.storage[i])) {
      return this.storage[i].length;
    }
    return 0;
  },
  hasMark(i) {
    return this.countMark(i) > 0;
  },
  updateMark(i, storage) {
    const skill = getRegisteredSkill(lib.skill, i);
    const intro = skill?.intro;
    if (!this.marks[i]) {
      if (skill && intro && (this.storage[i] || intro.markcount)) {
        this.markSkill(i);
        if (!this.marks[i]) {
          return this;
        }
      } else {
        return this;
      }
    }
    if (storage && this.storage[i]) {
      this.syncStorage(i);
    }
    const mark = this.marks[i];
    if (!isMarkNode(mark)) {
      return this;
    }
    if (i == "ghujia" || (!mark.querySelector(".image") || this.storage[i + "_markcount"]) && skill && intro && !intro.nocount && (this.storage[i] || this.storage[i + "_markcount"] || intro.markcount)) {
      mark.classList.add("overflowmark");
      let num = 0;
      const markcount = intro?.markcount;
      if (typeof markcount == "function") {
        const markcountWithSkill = markcount;
        num = markcountWithSkill(this.storage[i], this, i);
      } else if (markcount == "expansion") {
        num = this.countCards("x", (card) => card.hasGaintag(i));
      } else if (typeof this.storage[i + "_markcount"] == "number") {
        num = this.storage[i + "_markcount"];
      } else if (i == "ghujia") {
        num = this.hujia;
      } else if (typeof this.storage[i] == "number") {
        num = this.storage[i];
      } else if (Array.isArray(this.storage[i])) {
        num = this.storage[i].length;
      }
      if (num) {
        if (num == Infinity) {
          num = "∞";
        }
        let markcountNode = getMarkCount(mark);
        if (!markcountNode) {
          markcountNode = ui.create.div(".markcount.menubutton", mark);
          mark.markcount = markcountNode;
        }
        markcountNode.innerHTML = String(num);
      } else {
        const markcountNode = getMarkCount(mark);
        if (markcountNode) {
          deleteMarkNode(markcountNode);
          delete mark.markcount;
        }
      }
    } else {
      const markcountNode = getMarkCount(mark);
      if (markcountNode) {
        deleteMarkNode(markcountNode);
        delete mark.markcount;
      }
      if (skill?.mark == "auto") {
        this.unmarkSkill(i);
      }
    }
    return this;
  },
  updateMarks(connect) {
    if (typeof connect == "string" && _status.connectMode && !game.online) {
      game.broadcast(
        function(player, storage, skill) {
          player.storage[skill] = storage;
          player.updateMarks();
        },
        this,
        this.storage[connect],
        connect
      );
    }
    for (const i in this.marks) {
      this.updateMark(i);
    }
  },
  markAuto(name, info) {
    if (typeof info != "undefined") {
      if (!Array.isArray(this.storage[name])) {
        this.storage[name] = [];
      }
      if (Array.isArray(info)) {
        this.storage[name].addArray(info);
      } else {
        this.storage[name].add(info);
      }
      this.markSkill(name);
    } else {
      const storage = this.storage[name];
      if (Array.isArray(storage)) {
        this[storage.length > 0 ? "markSkill" : "unmarkSkill"](name);
      } else if (typeof storage == "number") {
        this[storage > 0 ? "markSkill" : "unmarkSkill"](name);
      } else if (storage) {
        this.markSkill(name);
      } else {
        this.unmarkSkill(name);
      }
    }
  },
  unmarkAuto(name, info) {
    const storage = this.storage[name];
    if (Array.isArray(storage)) {
      if (Array.isArray(info)) {
        storage.removeArray(info.slice(0));
      } else {
        storage.remove(info);
      }
      this[storage.length > 0 ? "markSkill" : "unmarkSkill"](name);
    }
  },
  checkMarks() {
    const skills = this.getSkills();
    game.expandSkills(skills);
    for (const i in this.marks) {
      const mark = this.marks[i];
      if (!skills.includes(i) && (!isMarkNode(mark) || !hasFixedMarkInfo(mark))) {
        this.unmarkSkill(i);
      }
    }
    return this;
  }
};
export {
  markCounterMethods
};
