import "../../../noname.js";
import { lib } from "../index.js";
import { ui } from "../../ui/index.js";
function setIntro(node, func, left) {
  if (lib.config.touchscreen) {
    if (left) {
      node.listen(ui.click.touchintro);
    } else {
      lib.setLongPress(node, ui.click.intro);
    }
  } else {
    if (left) {
      node.listen(ui.click.intro);
    }
    if (lib.config.hover_all && !lib.device) {
      lib.setHover(node, ui.click.hoverplayer);
    }
    if (lib.config.right_info) {
      node.oncontextmenu = ui.click.rightplayer;
    }
  }
  if (func) {
    node._customintro = func;
  }
}
export {
  setIntro
};
