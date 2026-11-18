import "../../../../noname.js";
import "../../dependencies.js";
import { lib } from "../../../library/index.js";
import { get } from "../../binding.js";
import { ui } from "../../../ui/index.js";
import { _status } from "../../../status/index.js";
import { convert, pinyin } from "../../../../node_modules/.pnpm/pinyin-pro@3.28.0/node_modules/pinyin-pro/dist/index.js";
const textPinyinMethods = {
  //装备栏 END
  /**
   * @param {string} chinese
   * @param {boolean} [withTone]
   * @returns { any[] }
   */
  pinyin(chinese, withTone) {
    let result = [];
    const pinyins = lib.pinyins;
    if (pinyins && pinyins[chinese] && Array.isArray(pinyins[chinese])) {
      result = pinyins[chinese].slice(0);
    } else {
      result = pinyin(chinese, { type: "array" });
    }
    if (withTone === false) {
      result = convert(result, { format: "toneNone" });
    }
    return result;
  },
  /**
   * @param { string } str
   * @returns { string }
   */
  yunmu(str) {
    if (lib.pinyins._metadata.zhengtirendu.includes(convert(str, { format: "toneNone" }))) {
      return "-" + str[str.length - 1];
    }
    for (let i of lib.pinyins._metadata.shengmu) {
      if (str.startsWith(i)) {
        str = str.slice(i.length);
        if (str[0] == "u" && lib.pinyins._metadata.special_shengmu.includes(i)) {
          str = "ü" + str.slice(1);
        }
        break;
      }
    }
    if (str.length > 0) {
      for (let i in lib.pinyins._metadata.feijiemu) {
        if (str[0] == i) {
          let goon = false;
          for (let j of lib.pinyins._metadata.feijiemu[i]) {
            if (str.startsWith(j)) {
              goon = true;
            }
          }
          if (!goon) {
            str = str.slice(1);
          }
          break;
        }
      }
    }
    return str;
  },
  /**
   * @param { string } str
   * @returns { string|null }
   */
  yunjiao(str) {
    str = convert(str, { format: "toneNone" });
    if (lib.pinyins._metadata.zhengtirendu.includes(str)) {
      str = "-" + str[str.length - 1];
    } else {
      for (let i of lib.pinyins._metadata.shengmu) {
        if (str.startsWith(i)) {
          str = str.slice(i.length);
          if (str[0] == "u" && lib.pinyins._metadata.special_shengmu.includes(i)) {
            str = "ü" + str.slice(1);
          }
          break;
        }
      }
    }
    for (let i in lib.pinyins._metadata.yunjiao) {
      if (lib.pinyins._metadata.yunjiao[i].includes(str)) {
        return i;
      }
    }
    return null;
  },
  /**
   *
   * @param { string } str
   * @param { Player | null } [player]
   * @param { boolean } prefix 是否考虑重复技能前缀，默认为false
   * @returns { string }
   */
  skillTranslation(str, player, prefix = false) {
    let str2;
    if (get.itemtype(player) !== "player" || prefix === false) {
      return get.translation(str);
    }
    const name = lib.translate[str];
    if (!player?.getSkills("invisible", null, false).some((skill) => {
      if (!get.skillInfoTranslation(skill, player).length || lib.translate[skill] !== name) {
        return false;
      }
      return skill != str && get.sourceSkillFor(skill) != get.sourceSkillFor(str);
    })) {
      return get.translation(str);
    }
    const info = get.info(str);
    if (info?.duplicatePrefix !== void 0) {
      const prefix2 = info.duplicatePrefix;
      if (typeof prefix2 == "function") {
        return `${prefix2(player, str)}${name}`;
      }
      return `${prefix2}${name}`;
    }
    const map = lib.duplicatePrefix;
    for (let key in map) {
      if (str.startsWith(key) && lib.skill[str.slice(key.length)]) {
        return `${map[key]}${name}`;
      }
      let key2 = `${key}_`;
      if (str.startsWith(key2)) {
        return `${map[key]}${name}`;
      }
    }
    if (_status.skillOwner?.[str] !== void 0) {
      return `${get.translation(str)}（${get.translation(_status.skillOwner[str])}）`;
    }
    return get.translation(str);
  },
  verticalStr(str, sp) {
    if (typeof str != "string") {
      return "";
    }
    return Array.from(str).filter((value) => value != "`").join("");
  },
  numStr(num, method) {
    if (num == Infinity) {
      if (method == "card") {
        return get.selectableCards().length + ui.selected.cards.length;
      }
      if (method == "target") {
        return get.selectableTargets().length + ui.selected.targets.length;
      }
      return "∞";
    }
    return num.toString();
  },
  rawName(str, noab = false) {
    let str2 = lib.translate[str];
    if (noab !== true && lib.translate[str + "_ab"]) {
      str2 = lib.translate[str + "_ab"];
    }
    if (str2) {
      const prefixTranslation = lib.translate[str + "_prefix"];
      if (prefixTranslation) {
        let prefixList = prefixTranslation.split("|");
        while (prefixList.length) {
          const prefix = prefixList.shift();
          if (prefix === void 0) {
            break;
          }
          if (str2.startsWith(prefix)) {
            str2 = str2.slice(prefix.length);
            continue;
          }
          break;
        }
      }
      return str2;
    }
    return "";
  },
  /**
   * 作用修改：只读前缀 不读_ab
   */
  rawName2(str) {
    return get.rawName(str, true);
  },
  slimNameHorizontal(str) {
    let slimName = lib.translate[`${str}_ab`] || lib.translate[str];
    if (slimName) {
      const prefixTranslation = lib.translate[`${str}_prefix`];
      if (prefixTranslation) {
        let prefixList = prefixTranslation.split("|");
        let setPrefix = [];
        while (prefixList.length) {
          const prefix = prefixList.shift();
          if (prefix === void 0) {
            break;
          }
          if (slimName.startsWith(prefix)) {
            setPrefix.push(prefix);
            slimName = slimName.slice(prefix.length);
            continue;
          }
          break;
        }
        if (setPrefix.length) {
          return `${setPrefix.map((prefix) => get.prefixSpan(prefix, str), "").join("")}<span>${slimName}</span>`;
        }
      }
      return slimName;
    }
    return "";
  },
  /**
   * @param {string} prefix
   * @param {string} [name]
   * @returns {string}
   */
  prefixSpan(prefix, name) {
    const config = lib.config.buttoncharacter_prefix;
    if (config == "off") {
      return "";
    }
    if (config == "simple") {
      const span2 = document.createElement("span");
      span2.innerHTML = prefix;
      return span2.outerHTML;
    }
    const namePrefix = lib.namePrefix.get(prefix);
    if (namePrefix && "getSpan" in namePrefix && typeof namePrefix.getSpan == "function") {
      return namePrefix.getSpan(prefix, name);
    }
    const span = document.createElement("span");
    if (namePrefix) {
      if ("color" in namePrefix && typeof namePrefix.color == "string") {
        span.style.color = namePrefix.color;
      }
      if ("nature" in namePrefix && typeof namePrefix.nature == "string") {
        span.dataset.nature = namePrefix.nature;
      }
      if ("showName" in namePrefix && typeof namePrefix.showName == "string") {
        prefix = namePrefix.showName;
      }
    } else {
      span.style.color = "#ffffff";
    }
    span.innerHTML = prefix;
    return span.outerHTML;
  },
  slimName(str) {
    return get.verticalStr(get.slimNameHorizontal(str), true);
  },
  colorspan(str) {
    if (str[0] == "#") {
      let color;
      switch (str[1]) {
        case "r":
          color = "fire";
          break;
        case "p":
          color = "legend";
          break;
        case "b":
          color = "blue";
          break;
        case "g":
          color = "green";
          break;
        default:
          return str.slice(2);
      }
      return '<span class="' + color + "text " + color + 'auto">' + str.slice(2) + "</span>";
    }
    return str;
  },
  skillInfoTranslation(name, player, noHTML = true) {
    let str = (() => {
      if (player && lib.dynamicTranslate[name]) {
        return lib.dynamicTranslate[name](player, name);
      }
      const str2 = lib.translate[name + "_info"];
      if (!str2) {
        return "";
      }
      return str2;
    })();
    if (typeof str === "string") {
      if (noHTML === true) {
        str = get.plainText(str);
      }
      return str;
    } else {
      console.warn(`孩子，你${name}的翻译传的是什么？！`);
      return "";
    }
  }
};
export {
  textPinyinMethods
};
