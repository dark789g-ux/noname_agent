import { ui } from "noname";

export function setHover(node, func, hoveration, width) {
	node._hoverfunc = func;
	if (typeof hoveration == "number") {
		node._hoveration = hoveration;
	}
	if (typeof width == "number") {
		node._hoverwidth = width;
	}
	node.addEventListener("mouseenter", ui.click.mouseenter);
	node.addEventListener("mouseleave", ui.click.mouseleave);
	node.addEventListener("mousedown", ui.click.mousedown);
	node.addEventListener("mousemove", ui.click.mousemove);
	return node;
}
