/* eslint-disable no-var -- 保留原实现的函数作用域及 arguments 协议。 */
import { lib } from "noname";
import { createConfigMenuGeneral } from "./general.js";
import { createConfigMenuAppearence } from "./appearence.js";
import { createConfigMenuView } from "./view.js";
import { createConfigMenuAudio } from "./audio.js";
import { createConfigMenuLlm } from "./llm.js";
import { createConfigMenuOthers } from "./others.js";
export function createConfigMenu() {
	return {
		general: createConfigMenuGeneral(),
		appearence: createConfigMenuAppearence(),
		view: createConfigMenuView(),
		audio: createConfigMenuAudio(),
		skill: {
			name: "技能",
			config: {
				update: function (config, map) {
					for (var i in map) {
						if (map[i]._link.config.type == "autoskill") {
							if (!lib.config.autoskilllist.includes(i)) {
								map[i].classList.add("on");
							} else {
								map[i].classList.remove("on");
							}
						} else if (map[i]._link.config.type == "banskill") {
							if (!lib.config.forbidlist.includes(i)) {
								map[i].classList.add("on");
							} else {
								map[i].classList.remove("on");
							}
						}
					}
				},
			},
		},
		llm: createConfigMenuLlm(),
		others: createConfigMenuOthers(),
	};
}
