function createBatchMove(event) {
  const filterMove = event.filterMove ?? (() => true);
  const filterBatchMove = (buttonList, buttonsDiv, position) => {
    const parent = buttonList[0]?.parentElement;
    if (!parent) {
      return [];
    }
    const original = Array.from(parent.children);
    const filtered = [];
    const movedButtons = /* @__PURE__ */ new Set();
    const eventMoved = Object.assign({}, event.moved);
    const addChildren = position === "first" ? (b) => buttonsDiv.insertBefore(b, buttonsDiv.firstChild) : (b) => buttonsDiv.appendChild(b);
    const addMovedList = position === "first" ? (l) => event.moved[buttonsDiv._link].unshift(l) : (l) => event.moved[buttonsDiv._link].push(l);
    for (const button of buttonList) {
      if (button.parentElement !== parent) {
        continue;
      }
      if (!filterMove(button, buttonsDiv._link, event.moved)) {
        continue;
      }
      filtered.push(button);
      movedButtons.add(button);
      addChildren(button);
      addMovedList(button.link);
    }
    let previous = null;
    for (const button of original) {
      if (!movedButtons.has(button)) {
        previous = button;
        continue;
      }
      if (!previous) {
        parent.insertBefore(button, parent.firstChild);
      } else {
        parent.insertBefore(button, previous.nextSibling);
      }
      previous = button;
    }
    Object.assign(event.moved, eventMoved);
    return filtered;
  };
  return filterBatchMove;
}
export {
  createBatchMove
};
