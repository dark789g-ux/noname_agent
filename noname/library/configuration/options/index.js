import "../../../../noname.js";
import { createConfigMenuGeneral } from "./general.js";
import { createConfigMenuAppearence } from "./appearence.js";
import { createConfigMenuView } from "./view.js";
import { createConfigMenuAudio } from "./audio.js";
import { createConfigMenuLlm } from "./llm.js";
import { createConfigMenuOthers } from "./others.js";
import { lib } from "../../index.js";
function createConfigMenu() {
  return {
    general: createConfigMenuGeneral(),
    appearence: createConfigMenuAppearence(),
    view: createConfigMenuView(),
    audio: createConfigMenuAudio(),
    skill: {
      name: "技能",
      config: {
        update: function(config, map) {
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
        }
      }
    },
    llm: createConfigMenuLlm(),
    others: createConfigMenuOthers()
  };
}
export {
  createConfigMenu
};
