import "../../../noname.js";
import { _status } from "../../status/index.js";
import { game } from "../../game/index.js";
import { lib } from "../index.js";
function saveVideo() {
  if (_status.videoToSave) {
    game.export(lib.init.encode(JSON.stringify(_status.videoToSave)), "无名杀 - 录像 - " + _status.videoToSave.name[0] + " - " + _status.videoToSave.name[1]);
  }
}
export {
  saveVideo
};
