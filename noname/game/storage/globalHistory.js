import "../../../noname.js";
import { game } from "../index.js";
import { readHistoryEvents } from "../historyTypes.js";
import { lib } from "../../library/index.js";
import { _status } from "../../status/index.js";
const globalHistoryMethods = {
  hasGlobalHistory(key, filter, last) {
    if (!key || !filter) {
      return false;
    }
    const history = game.getGlobalHistory(key);
    if (last) {
      const lastIndex = history.indexOf(last);
      return history.some((event, index) => {
        if (index > lastIndex) {
          return false;
        }
        return filter(event);
      });
    }
    return history.some(filter);
  },
  checkGlobalHistory(key, filter, last) {
    if (!key || !filter) {
      return;
    }
    const history = game.getGlobalHistory(key);
    if (last) {
      const lastIndex = history.indexOf(last);
      history.forEach((event, index) => {
        if (index > lastIndex) {
          return false;
        }
        return filter(event);
      });
    } else {
      history.forEach(filter);
    }
  },
  getGlobalHistory(key, filter, last) {
    if (!key) {
      return _status.globalHistory[_status.globalHistory.length - 1];
    }
    if (!filter) {
      return _status.globalHistory[_status.globalHistory.length - 1][key];
    }
    const history = game.getGlobalHistory(key);
    if (last) {
      const lastIndex = history.indexOf(last);
      return history.filter((event, index) => {
        if (index > lastIndex) {
          return false;
        }
        return filter(event);
      });
    }
    return history.filter(filter);
  },
  hasAllGlobalHistory(key, filter, last) {
    if (!key || !filter) {
      return false;
    }
    return _status.globalHistory.some((value) => {
      if (readHistoryEvents(value, key)) {
        if (last && readHistoryEvents(value, key).includes(last)) {
          const lastIndex = readHistoryEvents(value, key).indexOf(last);
          if (readHistoryEvents(value, key).some((event, index) => {
            if (index > lastIndex) {
              return false;
            }
            return filter(event);
          })) {
            return true;
          }
        } else if (readHistoryEvents(value, key).some(filter)) {
          return true;
        }
      }
      return false;
    });
  },
  checkAllGlobalHistory(key, filter, last) {
    if (!key || !filter) {
      return;
    }
    let stopped = false;
    _status.globalHistory.forEach((value) => {
      if (readHistoryEvents(value, key)) {
        if (last && readHistoryEvents(value, key).includes(last) && !stopped) {
          stopped = true;
          const lastIndex = readHistoryEvents(value, key).indexOf(last);
          readHistoryEvents(value, key).forEach((event, index) => {
            if (index > lastIndex) {
              return false;
            }
            return filter(event);
          });
        } else {
          readHistoryEvents(value, key).forEach(filter);
        }
      }
    });
  },
  getAllGlobalHistory(key, filter, last) {
    const history = [];
    _status.globalHistory.forEach((value) => {
      if (!key || !readHistoryEvents(value, key)) {
        history.push(value);
      } else {
        history.push(...readHistoryEvents(value, key));
      }
    });
    if (filter) {
      if (last) {
        const lastIndex = history.indexOf(last);
        return history.filter((event, index) => {
          if (index > lastIndex) {
            return false;
          }
          return filter(event);
        });
      }
      return history.filter(filter);
    }
    return history;
  },
  /**
   * 快速获取当前轮次/倒数第X轮次游戏的历史
   */
  getRoundHistory(key, filter = lib.filter.all, last, num = 0, keep) {
    const history = _status.globalHistory;
    if (!filter || typeof filter != "function") {
      filter = lib.filter.all;
    }
    const evts = [];
    for (let i = history.length - 1; i >= 0; i--) {
      if (keep === true || num == 0) {
        const currentHistory = readHistoryEvents(history[i], key);
        const filteredHistory = filter ? currentHistory.filter(filter) : currentHistory;
        evts.addArray(filteredHistory.slice().reverse());
      }
      if (history[i].isRound) {
        if (num > 0) {
          num--;
        } else {
          break;
        }
      }
    }
    evts.reverse();
    if (last && evts.includes(last)) {
      const lastIndex = evts.indexOf(last);
      return evts.filter((evt) => evts.indexOf(evt) <= lastIndex);
    }
    return evts;
  }
};
export {
  globalHistoryMethods
};
