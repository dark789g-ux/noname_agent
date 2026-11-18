import "../../../../noname.js";
import { game } from "../../../game/index.js";
import { ui } from "../../../ui/index.js";
function createMoveDrag(event, clearSelected, selectButtons) {
  let touchStartX = 0;
  let touchStartY = 0;
  let elementOffsetX = 0;
  let elementOffsetY = 0;
  let currentElement;
  const dragStart = (e) => {
    if (event.isPlayingAnimation) {
      return;
    }
    const container = e.currentTarget;
    if (!(container instanceof HTMLElement)) {
      return;
    }
    if (e instanceof MouseEvent) {
      if (e.which != 1) {
        return;
      }
    }
    if (window.TouchEvent && e instanceof TouchEvent) {
      if (e.touches.length != 1) {
        return;
      }
      e = e.touches[0];
    }
    const cards = Array.from(container.children).filter((element) => element instanceof HTMLDivElement);
    const target = cards.find(
      (card) => (
        // Node.contains()
        e.target instanceof Node && card.contains(e.target)
      )
    );
    if (target) {
      if (!target.copy) {
        const copy = target.cloneNode(true);
        if (!(copy instanceof HTMLDivElement)) {
          return;
        }
        copy.style.opacity = "0.75";
        copy.style.pointerEvents = "none";
        target.copy = copy;
      }
      touchStartX = e.clientX / game.documentZoom;
      touchStartY = e.clientY / game.documentZoom;
      elementOffsetX = target.getBoundingClientRect().x / game.documentZoom - touchStartX;
      elementOffsetY = target.getBoundingClientRect().y / game.documentZoom - touchStartY;
      currentElement = target;
    }
  };
  const onDrag = (e) => {
    if (event.isPlayingAnimation) {
      return;
    }
    if (e instanceof MouseEvent) {
      if (e.which != 1) {
        return;
      }
    }
    if (window.TouchEvent && e instanceof TouchEvent) {
      if (e.touches.length != 1) {
        return;
      }
      e = e.touches[0];
    }
    if (!currentElement || !currentElement.copy) {
      return;
    }
    const ex = e.clientX / game.documentZoom;
    const ey = e.clientY / game.documentZoom;
    if (!document.contains(currentElement.copy)) {
      if (Math.abs(ex - touchStartX) < 10 && Math.abs(ey - touchStartY) < 10) {
        return;
      }
    }
    clearSelected();
    selectButtons(currentElement);
    const copy = currentElement.copy;
    if (!ui.window.contains(copy)) {
      copy.style.position = "absolute";
      copy.style.transition = "none";
      copy.style.zIndex = "100";
      copy.css({
        boxShadow: "0px 0px 7px 2px rgba(233, 30, 77, 0.95)"
      });
      ui.window.appendChild(copy);
    }
    copy.style.left = `${ex + elementOffsetX}px`;
    copy.style.top = `${ey + elementOffsetY}px`;
    const bounds = event.dialog.getBoundingClientRect();
    const relY = e.clientY - bounds.top;
    const minY = bounds.height * 0.1;
    const maxY = bounds.height * 0.9;
    if (relY < minY) {
      event.dialog.content.parentElement.scrollTop -= 15;
    } else if (relY > maxY) {
      event.dialog.content.parentElement.scrollTop += 15;
    }
  };
  return {
    dragStart,
    onDrag,
    resetDrag() {
      currentElement = void 0;
    }
  };
}
export {
  createMoveDrag
};
