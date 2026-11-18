import "../../../../../noname.js";
import { lib } from "../../../index.js";
import { ui } from "../../../../ui/index.js";
function requireParentEvent(event) {
  if (!(event instanceof lib.element.GameEvent)) {
    throw new TypeError("This operation requires an existing parent event");
  }
  return event;
}
function hasHtmlDivParent(node) {
  return node.parentNode instanceof HTMLDivElement;
}
function isThrownNode(node) {
  return node instanceof HTMLDivElement;
}
function isThrownNodeMap(value) {
  return value !== null && (typeof value === "object" || typeof value === "function");
}
function getThrownCardId(node) {
  return node._cardid;
}
function isThrownCardSelected(node) {
  return Boolean(node.selectedt);
}
function selectThrownCard(node, id) {
  if (getThrownCardId(node) != id || isThrownCardSelected(node)) return false;
  node.selectedt = true;
  return true;
}
function getThrownNodeMap(node) {
  const nodeMap = node.node;
  if (!nodeMap) return;
  if (!isThrownNodeMap(nodeMap)) {
    throw new TypeError("thrown node map must be an object");
  }
  return nodeMap;
}
function getThrownCardsetion(node) {
  const nodeMap = getThrownNodeMap(node);
  const cardsetion = nodeMap?.cardsetion;
  if (cardsetion === void 0) return;
  if (!(cardsetion instanceof Node)) {
    throw new TypeError("thrown card section must be a Node");
  }
  return cardsetion;
}
function isRemovableThrownCardsetion(value) {
  return value !== null && (typeof value === "object" || typeof value === "function") && "remove" in value && typeof value.remove === "function";
}
function replaceThrownCardsetion(node, cardsetion) {
  const nodeMap = node.node;
  if (!nodeMap) {
    return;
  }
  if (!isThrownNodeMap(nodeMap)) {
    throw new TypeError("thrown node map must be an object");
  }
  const previous = nodeMap.cardsetion;
  if (previous) {
    if (!isRemovableThrownCardsetion(previous)) {
      throw new TypeError("thrown card section must be removable");
    }
    previous.remove();
    delete nodeMap.cardsetion;
  }
  nodeMap.cardsetion = cardsetion;
}
function createGainAnimationNode() {
  return Object.assign(ui.create.div(".card.thrown"), {
    moveTo: lib.element.Card.prototype.moveTo,
    moveDelete: lib.element.Card.prototype.moveDelete
  });
}
function isMarkNode(node) {
  return node instanceof HTMLDivElement;
}
function hasMarkName(node, name) {
  return node.name == name;
}
function hasMarkIdentifier(node, identifier) {
  return node.markidentifer == identifier;
}
function hasFixedMarkInfo(node) {
  const info = node.info;
  return info !== null && (typeof info === "object" || typeof info === "function") && "fixed" in info && Boolean(info.fixed);
}
function getMarkCount(node) {
  const markcount = node.markcount;
  if (!markcount) return;
  if (!(markcount instanceof HTMLDivElement)) {
    throw new TypeError("mark count must be an HTMLDivElement");
  }
  return markcount;
}
function deleteMarkNode(node) {
  const deleteMark = node.delete;
  if (typeof deleteMark !== "function") {
    throw new TypeError("mark node delete method must be callable");
  }
  deleteMark.call(node);
}
export {
  createGainAnimationNode,
  deleteMarkNode,
  getMarkCount,
  getThrownCardId,
  getThrownCardsetion,
  getThrownNodeMap,
  hasFixedMarkInfo,
  hasHtmlDivParent,
  hasMarkIdentifier,
  hasMarkName,
  isMarkNode,
  isRemovableThrownCardsetion,
  isThrownCardSelected,
  isThrownNode,
  isThrownNodeMap,
  replaceThrownCardsetion,
  requireParentEvent,
  selectThrownCard
};
