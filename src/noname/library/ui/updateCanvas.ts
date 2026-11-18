/* eslint-disable no-var -- 保留原实现的函数作用域及 arguments 协议。 */
import { ui } from "noname";
import { lib } from "noname";

export function updateCanvas(time) {
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
	// ctx.lineCap='round';
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
