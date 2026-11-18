import "../../../../../noname.js";
import "../contracts/storageHistoryContract.js";
import { lib } from "../../../index.js";
const historyAndStatsMethods = {
  countUsed(card, type) {
    let num;
    if (type === true) {
      num = 0;
      const history = this.getHistory("useCard");
      for (let i = 0; i < history.length; i++) {
        const usedCard = history[i].card;
        if (!card) {
          num++;
        } else if (typeof card == "string" && usedCard && card == usedCard.name) {
          num++;
        } else if (typeof card == "object" && usedCard && card.name == usedCard.name) {
          num++;
        }
      }
      return num;
    }
    const stat = this.getStat("card");
    if (!card) {
      num = 0;
      for (const i in stat) {
        const count = stat[i];
        if (typeof count == "number") {
          num += count;
        }
      }
      return num;
    }
    const cardName = typeof card == "object" ? card.name : card;
    num = cardName !== void 0 ? stat[cardName] : stat["undefined"];
    if (typeof num != "number") {
      return 0;
    }
    return num;
  },
  countSkill(skill) {
    const info = lib.skill[skill];
    if (!info) {
      console.warn("“" + skill + "”为无效技能ID！");
      return 0;
    }
    if (typeof this.getStat("skill")[skill] === "number" || typeof this.getStat("triggerSkill")[skill] === "number") {
      return Number(this.getStat("skill")?.[skill] ?? 0) + Number(this.getStat("triggerSkill")?.[skill] ?? 0);
    }
    return this.getHistory("useSkill", (evt) => evt.skill === skill).length;
  },
  *iterRoundHistory(key, filter, num, keep, last) {
    num ??= 0;
    if (filter != null && !filter) {
      filter = void 0;
    }
    const allHistories = this.actionHistory;
    let startIndex = allHistories.length;
    let endIndex = allHistories.length;
    for (let i = allHistories.length - 1; i >= 0; i--) {
      if (keep || num === 0) {
        startIndex = i;
      }
      if (allHistories[i].isRound) {
        if (num <= 0) {
          break;
        }
        num--;
        if (!keep) {
          endIndex = i;
        }
      }
    }
    if (startIndex >= endIndex) {
      return;
    }
    for (let i = startIndex; i < endIndex; i++) {
      const histories = allHistories[i][key];
      for (const history of histories) {
        if (filter == null || filter(history)) {
          yield history;
        }
        if (history === last) {
          return;
        }
      }
    }
  },
  getRoundHistory(key, filter, num, keep, last) {
    return this.iterRoundHistory(key, filter, num, keep, last).toArray();
  },
  countRoundHistory(key, filter, num, keep, last) {
    let count = 0;
    for (const _ of this.iterRoundHistory(key, filter, num, keep, last)) {
      count++;
    }
    return count;
  },
  hasRoundHistory(key, filter, num, keep, last) {
    for (const _ of this.iterRoundHistory(key, filter, num, keep, last)) {
      return true;
    }
    return false;
  },
  *iterHistory(key, filter, last) {
    const currentHistory = this.actionHistory[this.actionHistory.length - 1];
    const histories = currentHistory[key];
    if (filter == null && last == null) {
      yield* histories;
      return;
    }
    if (last != null && !histories.includes(last)) {
      return;
    }
    for (const history of histories) {
      if (filter == null || filter(history)) {
        yield history;
      }
      if (history === last) {
        break;
      }
    }
  },
  getHistory(key, filter, last) {
    if (!key) {
      return this.actionHistory[this.actionHistory.length - 1];
    }
    if (key === "isRound" || key === "isMe" || key === "isSkipped" || !filter) {
      return this.actionHistory[this.actionHistory.length - 1][key];
    }
    return this.iterHistory(key, filter, last).toArray();
  },
  checkHistory(key, content, last) {
    if (!key || !content) {
      return;
    }
    for (const event of this.iterHistory(key, void 0, last)) {
      content(event);
    }
  },
  countHistory(key, filter, last) {
    let count = 0;
    for (const _ of this.iterHistory(key, filter, last)) {
      count++;
    }
    return count;
  },
  hasHistory(key, filter, last) {
    for (const _ of this.iterHistory(key, filter, last)) {
      return true;
    }
    return false;
  },
  *iterLastHistory(key, filter, last) {
    let currentHistory;
    for (let i = this.actionHistory.length - 1; i >= 0; i--) {
      if (this.actionHistory[i].isMe) {
        currentHistory = this.actionHistory[i];
        break;
      }
    }
    if (currentHistory == null) {
      return;
    }
    const histories = currentHistory[key];
    if (filter == null && last == null) {
      yield* histories;
      return;
    }
    if (last != null && !histories.includes(last)) {
      return;
    }
    for (const history of histories) {
      if (filter == null || filter(history)) {
        yield history;
      }
      if (history === last) {
        break;
      }
    }
  },
  getLastHistory(key, filter, last) {
    if (key != null && key !== "isRound" && key !== "isMe" && key !== "isSkipped" && filter != null && filter !== false) {
      return this.iterLastHistory(key, filter, last).toArray();
    }
    let currentHistory;
    for (let i = this.actionHistory.length - 1; i >= 0; i--) {
      if (this.actionHistory[i].isMe) {
        currentHistory = this.actionHistory[i];
        break;
      }
    }
    if (currentHistory == null) {
      return null;
    }
    return key ? currentHistory[key] : currentHistory;
  },
  countLastHistory(key, filter, last) {
    let count = 0;
    for (const _ of this.iterLastHistory(key, filter, last)) {
      count++;
    }
    return count;
  },
  hasLastHistory(key, filter, last) {
    for (const _ of this.iterLastHistory(key, filter, last)) {
      return true;
    }
    return false;
  },
  *iterAllHistory(key, filter, last) {
    if (!key) {
      for (const histories of this.actionHistory) {
        yield histories;
      }
      return;
    }
    if (last != null) {
      if (!this.actionHistory.some((histories) => histories[key].includes(last))) {
        return;
      }
    }
    for (const currentHistories of this.actionHistory) {
      const histories = currentHistories[key];
      if (filter == null && last == null) {
        yield* histories;
        continue;
      }
      for (const history of histories) {
        if (filter == null || filter(history)) {
          yield history;
        }
        if (history === last) {
          return;
        }
      }
    }
  },
  checkAllHistory(key, content, last) {
    if (!key || !content) {
      return;
    }
    for (const event of this.iterAllHistory(key, void 0, last)) {
      content(event);
    }
  },
  getAllHistory(key, filter, last) {
    return this.iterAllHistory(key, filter, last).toArray();
  },
  countAllHistory(key, filter, last) {
    let count = 0;
    for (const _ of this.iterAllHistory(key, filter, last)) {
      count++;
    }
    return count;
  },
  hasAllHistory(key, filter, last) {
    for (const _ of this.iterAllHistory(key, filter, last)) {
      return true;
    }
    return false;
  },
  getLastUsed(num) {
    if (typeof num != "number") {
      num = 0;
    }
    const history = this.getHistory("useCard");
    if (history.length <= num) {
      return null;
    }
    return history[history.length - num - 1];
  },
  getStat(key) {
    if (!key) {
      return this.stat[this.stat.length - 1];
    }
    return this.stat[this.stat.length - 1][key];
  },
  getLastStat(key) {
    let stat = false;
    for (let i = this.stat.length - 1; i >= 0; i--) {
      if (this.stat[i].isMe) {
        stat = this.stat[i];
        break;
      }
    }
    if (!stat) {
      return null;
    }
    if (!key) {
      return stat;
    }
    return stat[key];
  }
};
export {
  historyAndStatsMethods
};
