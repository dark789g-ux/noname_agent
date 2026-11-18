import "../../noname.js";
import { Get } from "./Get.js";
import { addDict } from "../../node_modules/.pnpm/pinyin-pro@3.28.0/node_modules/pinyin-pro/dist/index.js";
import dictionary from "./pinyins/noname-dict.js";
import { replaceGet, get } from "./binding.js";
import { lib } from "../library/index.js";
addDict(dictionary);
replaceGet(new Get());
const setGet = (instance) => {
  replaceGet(instance || new Get());
  if (lib.config.dev) window.get = get;
};
export {
  get,
  setGet
};
