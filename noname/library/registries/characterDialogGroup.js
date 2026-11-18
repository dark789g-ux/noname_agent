import "../../../noname.js";
import { get } from "../../get/binding.js";
import { lib } from "../index.js";
function createCharacterDialogGroup() {
  return {
    收藏: function(name, capt) {
      return lib.config.favouriteCharacter.includes(name) ? capt : null;
    },
    最近: function(name, capt) {
      var list = get.config("recentCharacter") || [];
      return list.includes(name) ? capt : null;
    }
  };
}
export {
  createCharacterDialogGroup
};
