import "../../../../../../noname.js";
import { game } from "../../../../../game/index.js";
import { get } from "../../../../../get/binding.js";
import { lib } from "../../../../index.js";
import { ui } from "../../../../../ui/index.js";
function createVersusTeamsOptions() {
  return {
    edit_character_three: {
      name: "编辑统率将池",
      clear: true,
      onclick() {
        if (get.mode() != "versus") {
          alert("请进入对决模式，然后再编辑将池");
          return;
        }
        var map = get.config("character_three") || lib.choiceThree;
        ui.create.editor({
          language: "json",
          value: JSON.stringify(map, null, 2),
          saveInput: (result) => {
            const character = JSON.parse(result);
            if (!Array.isArray(character)) {
              throw new Error("代码格式有错误，请对比示例代码仔细检查");
            }
            game.saveConfig("character_three", character, "versus");
          }
        });
      }
    },
    reset_character_three: {
      name: "重置统率将池",
      intro: "将统率三军模式下的将池重置为默认将池",
      clear: true,
      onclick() {
        if (confirm("该操作不可撤销！是否清除统率三军模式的自定义将池，并将其重置为默认将池？")) {
          game.saveConfig("character_three", null, "versus");
          alert("将池已重置");
        }
      }
    },
    edit_character_four: {
      name: "编辑4v4将池",
      clear: true,
      onclick() {
        if (get.mode() != "versus") {
          alert("请进入对决模式，然后再编辑将池");
          return;
        }
        var map = get.config("character_four") || lib.choiceFour;
        ui.create.editor({
          language: "json",
          value: JSON.stringify(map, null, 2),
          saveInput: (result) => {
            const character = JSON.parse(result);
            if (!Array.isArray(character)) {
              throw new Error("代码格式有错误，请对比示例代码仔细检查");
            }
            game.saveConfig("character_four", character, "versus");
          }
        });
      }
    },
    reset_character_four: {
      name: "重置4v4将池",
      intro: "将4v4模式下的将池重置为默认将池",
      clear: true,
      onclick() {
        if (confirm("该操作不可撤销！是否清除4v4模式的自定义将池，并将其重置为默认将池？")) {
          game.saveConfig("character_four", null, "versus");
          alert("将池已重置");
        }
      }
    }
  };
}
export {
  createVersusTeamsOptions
};
