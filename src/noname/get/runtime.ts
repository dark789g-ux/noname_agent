import { lib } from "noname";
import { Get } from "./Get.js";
import * as pinyinPro from "pinyin-pro";
import NonameDictionary from "./pinyins/noname-dict.js";
import { get, replaceGet } from "./binding.js";
pinyinPro.addDict(NonameDictionary);
replaceGet(new Get());
export { get } from "./binding.js";
export const setGet = (instance?: Get): void => {
	replaceGet(instance || new Get());
	if (lib.config.dev) window.get = get;
};
