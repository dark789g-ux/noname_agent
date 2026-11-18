import "../../../noname.js";
import { ui } from "../../ui/index.js";
import { game } from "../../game/index.js";
function placePoppedDialog(dialog, e) {
  if (dialog._place_text) {
    if (dialog._place_text.firstChild.offsetWidth >= 190 || dialog._place_text.firstChild.offsetHeight >= 30) {
      dialog._place_text.style.marginLeft = "14px";
      dialog._place_text.style.marginRight = "14px";
      dialog._place_text.style.textAlign = "left";
      dialog._place_text.style.width = "calc(100% - 28px)";
    }
  }
  if (e.touches && e.touches[0]) {
    e = e.touches[0];
  }
  var height = Math.min(ui.window.offsetHeight - 20, dialog.content.scrollHeight);
  if (dialog._mod_height) {
    height += dialog._mod_height;
  }
  dialog.style.height = height + "px";
  if (e.clientX / game.documentZoom < ui.window.offsetWidth / 2) {
    dialog.style.left = e.clientX / game.documentZoom + 10 + "px";
  } else {
    dialog.style.left = e.clientX / game.documentZoom - dialog.offsetWidth - 10 + "px";
  }
  var idealtop = (e.clientY || 0) / game.documentZoom - dialog.offsetHeight / 2;
  if (typeof idealtop != "number" || isNaN(idealtop) || idealtop <= 5) {
    idealtop = 5;
  } else if (idealtop + dialog.offsetHeight + 10 > ui.window.offsetHeight) {
    idealtop = ui.window.offsetHeight - 10 - dialog.offsetHeight;
  }
  dialog.style.top = idealtop + "px";
}
export {
  placePoppedDialog
};
