import { ui } from "noname";
import { lib } from "noname";

export function setIntro(node, func, left) {
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
	// if(!left){
	// 	lib.setPressure(node,ui.click.rightpressure);
	// }
	if (func) {
		node._customintro = func;
	}
}
