import { rootURL } from "../../noname.js";
import * as index from "../../node_modules/.pnpm/pinyin-pro@3.28.0/node_modules/pinyin-pro/dist/index.js";
import { default as default2 } from "./pinyins/noname-dict.js";
import { AsyncFunction, AsyncGeneratorFunction, GeneratorFunction, userAgentLowerCase } from "../util/index.js";
import "../util/sandbox.js";
import { default as default3 } from "../../_virtual/index4.js";
import { HTMLPoptipElement } from "../library/poptip.js";
import { CacheContext } from "../library/cache/cacheContext.js";
import { getRegisteredSkill } from "../library/skillRegistry.js";
import { requireRegisteredSkill } from "../library/skillRegistry.js";
import { copyValue } from "./copy.js";
import { get } from "./binding.js";
const TYPE_KEY = "a60e024487f63a67c634d782aaaf1127";
function isPlayerSeat(seat) {
  return get.itemtype(seat) === "player";
}
function isCharacterTitlePlayer(value) {
  return get.itemtype(value) == "player";
}
function getSubfrequent(registry, key) {
  return getRegisteredSkill(registry, key)?.subfrequent;
}
export {
  AsyncFunction,
  AsyncGeneratorFunction,
  CacheContext,
  GeneratorFunction,
  HTMLPoptipElement,
  default3 as JSZip,
  default2 as NonameDictionary,
  TYPE_KEY,
  copyValue,
  get,
  getRegisteredSkill,
  getSubfrequent,
  isCharacterTitlePlayer,
  isPlayerSeat,
  index as pinyinPro,
  requireRegisteredSkill,
  rootURL,
  userAgentLowerCase
};
