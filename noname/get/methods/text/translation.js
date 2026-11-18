import "../../../../noname.js";
import "../../dependencies.js";
import { HTMLPoptipElement } from "../../../library/poptip.js";
import { lib } from "../../../library/index.js";
import { get } from "../../binding.js";
import { _status } from "../../../status/index.js";
const textTranslationMethods = {
  /**
   * @overload
   * @param str
   * @param {"skill" | "viewAs" | undefined} [arg]
   * @returns {string}
   */
  /**
   * @overload
   * @param str
   * @param {string} [arg]
   * @returns {string | NonNullable<Skill["prompt"]>}
   */
  /**
   * @param str
   * @param {string} [arg]
   * @returns {string | NonNullable<Skill["prompt"]>}
   */
  translation(str, arg) {
    let str2;
    if (str && typeof str == "object" && (str.name || str._tempTranslate)) {
      if (str._tempTranslate) {
        return str._tempTranslate;
      }
      if (arg == "viewAs" && str.viewAs) {
        str2 = get.translation(str.viewAs);
      } else {
        str2 = get.translation(str.name);
      }
      if (str2 == "杀") {
        str2 = "";
        if (typeof str.nature == "string") {
          let natures = str.nature.split(lib.natureSeparator).sort(lib.sort.nature);
          for (let nature of natures) {
            str2 += lib.translate["nature_" + nature] || lib.translate[nature] || "";
          }
        }
        str2 += "杀";
      }
      if (get.itemtype(str) == "card" || str.isCard) {
        if (_status.cardtag && str.cardid) {
          let tagstr = "";
          for (let i in _status.cardtag) {
            if (_status.cardtag[i].includes(str.cardid)) {
              tagstr += lib.translate[i + "_tag"];
            }
          }
          if (tagstr) {
            str2 += "·" + tagstr;
          }
        }
        if (str.suit && str.number || str.isCard) {
          let cardnum = get.strNumber(get.number(str, false), true) || "";
          if (arg == "viewAs" && str.viewAs != str.name && str.viewAs) {
            str2 += "（" + get.translation(str) + "）";
          } else {
            str2 += "【" + get.translation(get.suit(str, false)) + cardnum + "】";
          }
        }
      }
      return str2;
    }
    if (Array.isArray(str)) {
      let str22 = get.translation(str[0], arg);
      for (let i = 1; i < str.length; i++) {
        str22 += "、" + get.translation(str[i], arg);
      }
      return str22;
    }
    if (get.itemtype(str) == "natures") {
      let natures = str.split(lib.natureSeparator).sort(lib.sort.nature);
      let str22 = "";
      for (let nature of natures) {
        str22 += lib.translate["nature_" + nature] || lib.translate[nature] || "";
      }
      return str22;
    }
    if (arg == "skill") {
      const abbreviation = lib.translate[str + "_ab"];
      if (abbreviation) {
        return abbreviation;
      }
      if (lib.translate[str]) {
        return lib.translate[str].slice(0, 2);
      }
      return str;
    } else if (arg == "info") {
      let translatedInfo = lib.translate[str + "_info"];
      if (translatedInfo) {
        return translatedInfo;
      }
      str2 = str.slice(0, str.length - 1);
      translatedInfo = lib.translate[str2 + "_info"];
      if (translatedInfo) {
        return translatedInfo;
      }
      if (str.lastIndexOf("_") > 0) {
        str2 = str.slice(0, str.lastIndexOf("_"));
        translatedInfo = lib.translate[str2 + "_info"];
        if (translatedInfo) {
          return translatedInfo;
        }
      }
      str2 = str.slice(0, str.length - 2);
      translatedInfo = lib.translate[str2 + "_info"];
      if (translatedInfo) {
        return translatedInfo;
      }
      if (lib.skill[str] && lib.skill[str].prompt) {
        return lib.skill[str].prompt;
      }
    }
    if (lib.translate[str]) {
      return lib.translate[str];
    }
    if (typeof str == "string") {
      const natureTranslation = lib.translate["nature_" + str];
      if (natureTranslation) {
        return natureTranslation;
      }
      return str;
    }
    if (typeof str == "number" || typeof str == "boolean") {
      return str.toString();
    }
    if (str && str.toString) {
      return str.toString();
    }
    return "";
  },
  /**
   * 返回数字在扑克牌中的表示形式
   * @param { number | "unsure" | null | undefined } num
   * @param { boolean } [forced] 未获取点数字母对应元素时，若此参数不为false，则返回字符串格式
   * @returns { string | undefined }
   */
  strNumber(num, forced) {
    if (typeof num !== "number") {
      return;
    }
    let result = lib.numstrList.get(num);
    if (result === void 0 && forced !== false) {
      result = num.toString();
    }
    return result;
  },
  /**
   * 返回扑克牌中的表示形式对应的数字
   * @param { string } str
   * @param { boolean } [forced] 未获取字母点数对应元素时，若此参数不为false，则返回数字格式
   * @returns { number | undefined }
   */
  numString(str, forced) {
    if (typeof str !== "string") {
      return;
    }
    let result = lib.numstrList.entries().reduce((map, list) => {
      map[list[1]] = list[0];
      return map;
    }, {})[str];
    if (result === void 0 && forced !== false) {
      result = parseInt(str);
    }
    return result;
  },
  /**
   * 将阿拉伯数字转换为中文的表达形式
   * @param { number | undefined } num
   * @param { boolean } [ordinal]
   * @returns { string | number }
   */
  cnNumber(num, ordinal) {
    if (num === void 0 || isNaN(num)) {
      return "";
    }
    let numStr = "" + num;
    if (numStr === "Infinity") {
      return "∞";
    }
    if (numStr === "-Infinity") {
      return "-∞";
    }
    if (!/^\d+$/.test(numStr)) {
      return num;
    }
    const chars = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
    const units = ["", "十", "百", "千"];
    if (numStr.length <= 2) {
      if (numStr.length === 1) {
        return !ordinal && num === 2 ? "两" : chars[num];
      }
      return `${numStr[0] === "1" ? "" : chars[numStr[0]]}十${numStr[1] === "0" ? "" : chars[numStr[1]]}`;
    }
    const numGroups = numStr.replace(/(?=(\d{4})+$)/g, ",").split(",").filter(Boolean);
    const handleZero = (str) => {
      let result2 = str.replace(/零{2,}/g, "零");
      if (result2.length > 1) {
        result2 = result2.replace(/零+$/g, "");
      }
      return result2;
    };
    const _transform = (str) => {
      if (str === "2" && !ordinal) {
        return "两";
      }
      let result2 = "";
      for (let i = 0; i < str.length; i++) {
        const part = str[str.length - 1 - i];
        let char = chars[+part];
        let unit = units[i];
        if (char === "零") {
          unit = "";
        } else if (char === "一" && i === 1 && str.length === 2) {
          char = "";
        } else if (char === "二" && i > 1 && !ordinal) {
          char = "两";
        }
        result2 = char + unit + result2;
      }
      result2 = handleZero(result2);
      return result2;
    };
    let result = "";
    let tempYi = "";
    for (let i = 0; i < numGroups.length; i++) {
      const part = numGroups[numGroups.length - 1 - i];
      let char = _transform(part);
      let unit = "";
      if (i % 2) {
        [unit, tempYi] = ["万" + tempYi, ""];
        if (char === "零") {
          unit = "";
        }
      } else {
        unit = "亿".repeat(i / 2);
        if (char === "零") {
          [unit, tempYi] = ["", unit];
        }
      }
      result = char + unit + result;
    }
    result = handleZero(result);
    return result;
  },
  /**
   * 用于将HTML代码转换为纯文本。
   * @param { string } htmlContent
   * @returns { string }
   */
  plainText(htmlContent) {
    if (htmlContent.includes("<") || htmlContent.includes(">")) {
      if (this.plainTextMap.has(htmlContent)) {
        return this.plainTextMap.get(htmlContent);
      }
      const parser = new DOMParser(), doc = parser.parseFromString(htmlContent || "", "text/html");
      doc.querySelectorAll("noname-poptip").forEach((poptip) => {
        Object.setPrototypeOf(poptip, HTMLPoptipElement.prototype);
        poptip.createdCallback();
      });
      const text = doc.body.textContent || doc.body.innerText;
      this.plainTextMap.set(htmlContent, text);
      return text;
    }
    return htmlContent;
  }
};
export {
  textTranslationMethods
};
