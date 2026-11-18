import { ui } from "noname";

export function setLongPress(node, func) {
	node.addEventListener("touchstart", ui.click.longpressdown);
	node.addEventListener("touchend", ui.click.longpresscancel);
	node._longpresscallback = func;
	return node;
}
