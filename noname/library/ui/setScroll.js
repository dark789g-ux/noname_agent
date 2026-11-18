import "../../../noname.js";
import { ui } from "../../ui/index.js";
function setScroll(node) {
  node.ontouchstart = ui.click.touchStart;
  node.ontouchmove = ui.click.touchScroll;
  node.style.webkitOverflowScrolling = "touch";
  return node;
}
export {
  setScroll
};
