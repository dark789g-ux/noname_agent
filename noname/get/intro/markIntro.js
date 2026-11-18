import "../../../noname.js";
import "../dependencies.js";
import { finishIntro } from "./finish.js";
import { get } from "../binding.js";
import { _status } from "../../status/index.js";
import { lib } from "../../library/index.js";
import { ui } from "../../ui/index.js";
function markIntro(node, simple, evt, uiintro, createButtons) {
  let stint, placetext;
  let i, translation, intro, str;
  let info = node.info;
  let player = node.parentNode.parentNode;
  if (info.name) {
    if (typeof info.name == "function") {
      let named = info.name(player.storage[node.skill], player);
      if (named) {
        uiintro.add(named);
      }
    } else {
      uiintro.add(info.name);
    }
  } else if (info.name !== false) {
    uiintro.add(get.translation(node.skill));
  }
  if (typeof info.id == "string" && info.id.startsWith("subplayer") && player.isUnderControl(true) && player.storage[info.id] && !_status.video) {
    let storage = player.storage[info.id];
    uiintro.addText("当前体力：" + storage.hp + "/" + storage.maxHp);
    if (storage.hs.length) {
      uiintro.addText("手牌区");
      uiintro.addSmall(storage.hs);
    }
    if (storage.es.length) {
      uiintro.addText("装备区");
      uiintro.addSmall(storage.es);
    }
  }
  if (typeof info.mark == "function") {
    stint = info.mark(uiintro, player.storage[node.skill], player, evt, node.skill);
    if (stint instanceof Promise) {
      uiintro.hide();
      stint.then(() => {
        uiintro.show();
        if (evt) {
          lib.placePoppedDialog(uiintro, evt);
        }
      });
    } else if (stint) {
      placetext = uiintro.add('<div class="text" style="display:inline">' + stint + "</div>");
      if (!stint.startsWith('<div class="skill"')) {
        uiintro._place_text = placetext;
      }
    }
  } else {
    stint = get.storageintro(info.content, player.storage[node.skill], player, uiintro, node.skill);
    if (stint) {
      if (stint[0] == "@") {
        uiintro.add('<div class="caption">' + stint.slice(1) + "</div>");
      } else {
        placetext = uiintro.add('<div class="text" style="display:inline">' + stint + "</div>");
        if (!stint.startsWith('<div class="skill"')) {
          uiintro._place_text = placetext;
        }
      }
    }
  }
  uiintro.add(ui.create.div(".placeholder.slim"));
  return finishIntro(uiintro);
}
export {
  markIntro
};
