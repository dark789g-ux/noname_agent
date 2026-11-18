function isCharacterSkillButton(node) {
  return node instanceof HTMLDivElement && "link" in node && typeof node.link == "string" && "linkname" in node && typeof node.linkname == "string";
}
function isTouchScrollTarget(node) {
  return "startX" in node && typeof node.startX === "number" && "startY" in node && typeof node.startY === "number";
}
function isSkillToggleTarget(node) {
  return "link" in node && typeof node.link === "string";
}
function isDraggingDialog(item, itemtype) {
  return itemtype === "dialog";
}
export {
  isCharacterSkillButton,
  isDraggingDialog,
  isSkillToggleTarget,
  isTouchScrollTarget
};
