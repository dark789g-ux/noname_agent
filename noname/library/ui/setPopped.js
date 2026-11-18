import "../../../noname.js";
import { lib } from "../index.js";
import { ui } from "../../ui/index.js";
function setPopped(node, func, width, height, forceclick, paused2) {
  node._poppedfunc = func;
  node._poppedwidth = width;
  node._poppedheight = height;
  if (forceclick) {
    node.forceclick = true;
  }
  if (lib.config.touchscreen || forceclick) {
    node.listen(ui.click.hoverpopped);
  } else {
    node.addEventListener("mouseenter", ui.click.hoverpopped);
  }
  if (paused2) {
    node._paused2 = true;
  }
}
export {
  setPopped
};
