import "../../../noname.js";
import { lib } from "../index.js";
import { ui } from "../../ui/index.js";
function updateCanvas(time) {
  if (lib.canvasUpdates.length === 0) {
    lib.status.canvas = false;
    return false;
  }
  ui.canvas.width = ui.arena.offsetWidth;
  ui.canvas.height = ui.arena.offsetHeight;
  var ctx = ui.ctx;
  ctx.shadowBlur = 5;
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.strokeStyle = "white";
  ctx.lineWidth = 3;
  ctx.save();
  for (var i = 0; i < lib.canvasUpdates.length; i++) {
    ctx.restore();
    ctx.save();
    var update = lib.canvasUpdates[i];
    if (!update.starttime) {
      update.starttime = time;
    }
    if (update(time - update.starttime, ctx) === false) {
      lib.canvasUpdates.splice(i--, 1);
    }
  }
}
export {
  updateCanvas
};
