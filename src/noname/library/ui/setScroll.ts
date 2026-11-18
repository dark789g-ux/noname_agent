import { ui } from "noname";

export function setScroll(node) {
	node.ontouchstart = ui.click.touchStart;
	node.ontouchmove = ui.click.touchScroll;
	node.style.webkitOverflowScrolling = "touch";
	return node;
}
