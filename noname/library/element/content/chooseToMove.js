import "../../../../noname.js";
import { normalizeSelectionResult, applyLLMDecision } from "./selectionResults.js";
import { showMoveDialog } from "./moveDialog.js";
import { _status } from "../../../status/index.js";
import { game } from "../../../game/index.js";
import { lib } from "../../index.js";
import { ui } from "../../../ui/index.js";
const chooseToMoveContent = {
  async chooseToMove(event, trigger, player) {
    if (event.chooseTime && _status.connectMode && !game.online) {
      event.time = lib.configOL.choose_timeout;
      game.broadcastAll((time) => {
        lib.configOL.choose_timeout = time;
      }, event.chooseTime);
    }
    let result;
    if (event.isMine()) {
      result = await showMoveDialog(event);
      delete ui.selected.guanxing_button;
      delete ui.selected.guanxing_buttons;
    } else if (event.isOnline()) {
      result = normalizeSelectionResult(await event.sendAsync());
    } else {
      result = "ai";
      if (await applyLLMDecision(event)) result = event.result;
    }
    if (event.time) {
      game.broadcastAll((time) => {
        lib.configOL.choose_timeout = time;
      }, event.time);
    }
    if ((!result || result == "ai" || event.forced && !result.bool) && event.processAI) {
      const moved = event.processAI(event.list);
      if (moved) {
        result = {
          bool: true,
          moved
        };
      } else {
        result = { bool: false };
      }
    }
    event.result = result;
  }
};
export {
  chooseToMoveContent
};
