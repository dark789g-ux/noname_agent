import "../../../../../../noname.js";
import { popupContainer } from "../index.js";
import { get } from "../../../../../get/binding.js";
import { ui } from "../../../../index.js";
import { lib } from "../../../../../library/index.js";
function openPopup(menuEl, clientX, clientY, onclose) {
  if (!popupContainer) return;
  popupContainer.innerHTML = "";
  let left = Math.round(clientX / get.menuZoom());
  let zoom = get.is.phoneLayout() ? 1.3 : 1;
  popupContainer.appendChild(menuEl);
  if (menuEl.classList.contains("visual")) {
    for (let i = 0; i < menuEl.childElementCount; i++) {
      if (menuEl.childNodes[i].update) {
        menuEl.childNodes[i].update();
      }
    }
  }
  let height = menuEl.offsetHeight;
  let idealtop = clientY / get.menuZoom();
  if (idealtop < 10) {
    idealtop = 10;
  } else if ((idealtop + height) * zoom + 10 > ui.window.offsetHeight) {
    idealtop = (ui.window.offsetHeight - 10) / zoom - height;
  }
  menuEl.style.top = idealtop + "px";
  menuEl.style.left = left + "px";
  popupContainer.classList.remove("hidden");
  popupContainer.onclose = onclose;
}
function closePopup() {
  if (!popupContainer) return;
  if (popupContainer.noclose) {
    popupContainer.noclose = false;
    return;
  }
  popupContainer.classList.add("hidden");
  if (typeof popupContainer.onclose == "function") {
    popupContainer.onclose();
  }
}
function setNoclose() {
  if (!popupContainer) return;
  popupContainer.noclose = true;
}
function openSwitcherPopup(menuEl, nodeEl) {
  const pos1 = nodeEl.lastChild.getBoundingClientRect();
  const pos2 = ui.window.getBoundingClientRect();
  const clientX = pos1.left + pos1.width + 5 - pos2.left;
  let clientY = pos1.top - pos2.top;
  if (menuEl.classList.contains("visual")) {
    openPopup(menuEl, clientX, clientY, () => {
      nodeEl.classList.remove("on");
    });
  } else if (menuEl.childElementCount > 10) {
    clientY = Math.min((ui.window.offsetHeight - 400) / 2, pos1.top - pos2.top);
    lib.setScroll(menuEl);
    openPopup(menuEl, clientX, clientY, () => {
      nodeEl.classList.remove("on");
    });
  } else {
    openPopup(menuEl, clientX, clientY, () => {
      nodeEl.classList.remove("on");
    });
  }
}
export {
  closePopup,
  openPopup,
  openSwitcherPopup,
  setNoclose
};
