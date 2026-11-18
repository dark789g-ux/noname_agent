import "../../../../noname.js";
import { TYPE_KEY } from "../../dependencies.js";
import { get } from "../../binding.js";
import { lib } from "../../../library/index.js";
import { security } from "../../../util/sandbox/security.js";
import { ErrorManager, CodeSnippet } from "../../../util/sandbox/error.js";
import { ui } from "../../../ui/index.js";
import { game } from "../../../game/index.js";
const serializationParamToCacheKeyMethods = {
  /**
   * 用于将参数转换为字符串，作为缓存的key。
   */
  paramToCacheKey() {
    let str = "";
    for (let arg of arguments) {
      if (arg === null || arg === void 0) {
        str += arg + "-";
        continue;
      }
      if (arg.playerid) {
        str += "p:" + arg.playerid;
      } else if (arg.cardid) {
        str += "c:" + arg.cardid;
      } else if (arg.name) {
        str += "n:" + arg.name;
      } else {
        str += "s:" + arg;
      }
      str += "-";
    }
    return str;
  },
  infoCardOL(info) {
    if (!lib.cardOL) {
      return info;
    }
    let card;
    try {
      info = JSON.parse(info.slice(13));
      let id = info.shift();
      if (!id) {
        card = ui.create.card();
        if (info && info[2]) {
          card.init(info);
        }
      } else if (lib.cardOL[id]) {
        if (lib.cardOL[id].name != info[2]) {
          if (info && info[2]) {
            lib.cardOL[id].init(info);
          }
        }
        card = lib.cardOL[id];
      } else if (game.online) {
        card = ui.create.card();
        card.cardid = id;
        if (info && info[2]) {
          card.init(info);
        }
        lib.cardOL[id] = card;
      }
    } catch (e) {
      console.log(e);
    }
    return card || info;
  },
  cardsInfoOL(cards) {
    return Array.from(cards || []).map(get.cardInfoOL);
  },
  infoCardsOL(infos) {
    return Array.from(infos || []).map(get.infoCardOL);
  },
  playerInfoOL(player) {
    return "_noname_player:" + player.playerid;
  },
  infoPlayerOL(info) {
    return lib.playerOL ? lib.playerOL[info.slice(15)] || info : info;
  },
  playersInfoOL(players) {
    return Array.from(players || []).map(get.playerInfoOL);
  },
  infoPlayersOL(infos) {
    return Array.from(infos || []).map(get.infoPlayerOL);
  },
  /**
   * ```plain
   * 测试一段代码是否为函数参数列表
   * ```
   *
   * @param {string} paramstr
   * @returns { boolean }
   */
  isFunctionParam(paramstr) {
    if (paramstr.length == 0) {
      return true;
    }
    const canCreateFunction = security.isSandboxRequired() && security.importSandbox().Marshal.canCreateFunction;
    if (canCreateFunction) {
      return canCreateFunction(paramstr, "");
    }
    try {
      new Function(paramstr, "");
      return true;
    } catch (e) {
      return false;
    }
  },
  funcInfoOL(func) {
    if (typeof func == "function") {
      if (func._filter_args) {
        return "_noname_func:" + JSON.stringify(get.stringifiedResult(func._filter_args, 3, void 0));
      }
      const decompileFunction = security.isSandboxRequired() ? security.importSandbox().Marshal.decompileFunction : Function.prototype.call.bind(Function.prototype.toString);
      const str = decompileFunction(func);
      if (/\{\s*\[native code\]\s*\}/.test(str)) {
        return "_noname_func:function () {}";
      }
      return "_noname_func:" + get.pureFunctionStr(str);
    }
    return "";
  },
  infoFuncOL(info) {
    let func;
    if ("sandbox" in window) {
      console.log("[infoFuncOL] info:", info);
    }
    const str = get.pureFunctionStr(info.slice(13), true);
    if ("sandbox" in window) {
      console.log("[infoFuncOL] pured:", str);
    }
    try {
      if (/\{\s*\[native code\]\s*\}/.test(str)) {
        return function() {
        };
      }
      if (security.isSandboxRequired()) {
        const loadStr = `return (${str});`;
        const box = security.currentSandbox();
        if (!box) {
          throw new ReferenceError("没有找到当前沙盒");
        }
        func = box.exec(loadStr);
        ErrorManager.setCodeSnippet(func, new CodeSnippet(str, 5));
      } else {
        func = security.exec(`return (${str});`);
        ErrorManager.setCodeSnippet(func, new CodeSnippet(str, 3));
      }
    } catch (e) {
      console.error(`${e} in 
${str}`);
      return function() {
      };
    }
    if (Array.isArray(func)) {
      func = get.filter.apply(this, get.parsedResult(func));
    }
    return func;
  },
  eventInfoOL(item, level, noMore) {
    return get.itemtype(item) == "event" ? `_noname_event:${JSON.stringify(
      Object.entries(item).reduce((stringifying, entry) => {
        const key = entry[0];
        if (key == "_trigger") {
          if (noMore !== false) {
            stringifying[key] = get.eventInfoOL(entry[1], null, false);
          }
        } else if (!lib.element.GameEvent.prototype[key] && key != "content" && get.itemtype(entry[1]) != "event") {
          stringifying[key] = get.stringifiedResult(entry[1], null, false);
        }
        return stringifying;
      }, {})
    )}` : "";
  },
  /**
   * @param {string} item
   */
  infoEventOL(item) {
    const evt = new lib.element.GameEvent();
    try {
      Object.entries(JSON.parse(item.slice(14))).forEach((entry) => {
        const key = entry[0];
        if (typeof evt[key] != "function") {
          evt[key] = get.parsedResult(entry[1]);
        }
      });
    } catch (error) {
      console.log(error);
    }
    return evt || item;
  },
  vcardInfoOL(item) {
    return "_noname_vcard:" + JSON.stringify(
      Object.entries(item).reduce((stringifying, entry) => {
        const key = entry[0];
        stringifying[key] = get.stringifiedResult(entry[1], void 0, void 0);
        return stringifying;
      }, {})
    );
  },
  vcardsInfoOL(cards) {
    return Array.from(cards || []).map(get.vcardInfoOL);
  },
  infoVCardOL(item) {
    const rawCard = JSON.parse(item.slice(14));
    const getWireEntries = (value) => {
      if (value === null || value === void 0) {
        throw new TypeError("Cannot convert undefined or null to object");
      }
      return Object.entries(value);
    };
    const getVCardCacheKey = (value) => typeof value === "symbol" ? value : String(value);
    const datas = getWireEntries(rawCard).reduce((vcard, entry) => {
      const key = entry[0];
      vcard[key] = get.parsedResult(entry[1]);
      return vcard;
    }, {});
    const vid = datas.vcardID;
    if (!vid || !lib.vcardOL) {
      return new lib.element.VCard(datas);
    }
    if (getVCardCacheKey(vid) in lib.vcardOL) {
      const vcard = lib.vcardOL[getVCardCacheKey(vid)];
      Object.keys(vcard).forEach((entry) => {
        delete vcard[entry];
      });
      Object.keys(datas).forEach((key) => {
        const value = datas[key];
        if (Array.isArray(value)) {
          vcard[key] = value.slice();
        }
        vcard[key] = value;
      });
      return vcard;
    } else {
      const card = new lib.element.VCard(datas);
      lib.vcardOL[getVCardCacheKey(vid)] = card;
      return card;
    }
  },
  infoVCardsOL(infos) {
    return Array.from(infos || []).map(get.infoVCardOL);
  },
  /**
   * @param {Map} map 要序列化的Map
   * @param {number} [level] 最大的序列化嵌套层级
   * @param {false | null} [nomore] 传递false取消内部事件的序列化
   */
  mapInfoOL(map, level, nomore) {
    const info = {};
    for (const [key, value] of map.entries()) {
      Array.prototype.push.call(info, [get.stringifiedResult(key, level, nomore), get.stringifiedResult(value, level, nomore)]);
    }
    info[TYPE_KEY] = "map";
    return info;
  },
  /**
   * @param {Set} set 要序列化的Set
   * @param {number} [level] 最大的序列化嵌套层级
   * @param {false | null} [nomore] 传递false取消内部事件的序列化
   */
  setInfoOL(set, level, nomore) {
    const info = {};
    for (const value of set) {
      Array.prototype.push.call(info, get.stringifiedResult(value, level, nomore));
    }
    info[TYPE_KEY] = "set";
    return info;
  },
  infoMapOL(item) {
    const map = /* @__PURE__ */ new Map();
    for (const index in item) {
      if (!isFinite(Number(index))) {
        break;
      }
      const pair = item[index];
      if (!Array.isArray(pair) || pair.length !== 2) {
        continue;
      }
      map.set(get.parsedResult(pair[0]), get.parsedResult(pair[1]));
    }
    return map;
  },
  infoSetOL(item) {
    const set = /* @__PURE__ */ new Set();
    for (const index in item) {
      if (!isFinite(Number(index))) {
        break;
      }
      set.add(get.parsedResult(item[index]));
    }
    return set;
  }
};
export {
  serializationParamToCacheKeyMethods
};
