import { createBatchMove } from "./moveBatch.js";
import "../../../../noname.js";
import { createMoveDrag } from "./moveDrag.js";
import { ui } from "../../../ui/index.js";
import { lib } from "../../index.js";
import { game } from "../../../game/index.js";
import { _status } from "../../../status/index.js";
import { get } from "../../../get/binding.js";
function showMoveDialog(event) {
  return new Promise((resolve) => {
    ui.selected.guanxing_button = null;
    ui.selected.guanxing_buttons = [];
    const list = event.list;
    const filterMove = event.filterMove ?? (() => true);
    const filterOk = event.filterOk ?? (() => true);
    const canMultiselect = list.length > 1 && lib.config.choose_all_button && event.allowChooseAll;
    event.settleed = false;
    event.dialog = ui.create.dialog(event.prompt || "请选择要操作的牌", "hidden", "forcebutton");
    event.switchToAuto = () => {
      if (!filterOk(event.moved)) {
        if (!event.forced) {
          event._result = { bool: false };
        } else {
          event._result = "ai";
        }
      } else {
        event._result = {
          bool: true,
          moved: event.moved
        };
      }
      event.dialog.close();
      if (ui.confirm) {
        ui.confirm.close();
      }
      game.resume();
      _status.imchoosing = false;
      setTimeout(() => {
        ui.arena.classList.remove("choose-to-move");
      }, 500);
      resolve(event._result);
    };
    event.dialog.classList.add("scroll1");
    event.dialog.classList.add("scroll2");
    event.dialog.classList.add("fullwidth");
    if (list.length > 2) {
      ui.arena.classList.add("choose-to-move");
      event.dialog.classList.add("fullheight");
    }
    const moved = [];
    event.moved = moved;
    const buttonss = [];
    event.buttonss = buttonss;
    event.isPlayingAnimation = false;
    const animationDuration = lib.config.animation_choose_to_move ? 300 : 0;
    const updateButtons = () => {
      for (const i of buttonss) {
        event.moved[i._link] = get.links(Array.from(i.children));
        if (typeof i.textPrompt == "function") {
          const previousSibling = i.previousSibling;
          if (previousSibling instanceof HTMLElement) {
            previousSibling.innerHTML = `<div class="text center">${i.textPrompt(event.moved[i._link])}</div>`;
          }
        }
      }
      if (filterOk(event.moved)) {
        ui.create.confirm("o");
      } else {
        if (!event.forced) {
          ui.create.confirm("c");
        } else if (ui.confirm) {
          ui.confirm.close();
        }
      }
    };
    const filterBatchMove = createBatchMove(event);
    const updateSelectAllButtons = () => {
      const buttons = Array.from(event.dialog.querySelectorAll(".select-all")).filter((button) => button instanceof HTMLElement);
      for (const button of buttons) {
        const nextElementSibling = button.nextElementSibling;
        const hasSelected = nextElementSibling instanceof HTMLElement && nextElementSibling.querySelector(".glow2");
        button.innerHTML = hasSelected ? "反选" : "全选";
      }
    };
    const clearSelected = (filter) => {
      for (let i = ui.selected.guanxing_buttons.length; i--; ) {
        const button = ui.selected.guanxing_buttons[i];
        if (!filter || filter(button)) {
          ui.selected.guanxing_buttons.splice(i, 1);
          button.classList.remove("glow2");
        }
      }
      ui.selected.guanxing_button = ui.selected.guanxing_buttons[0] || null;
      updateSelectAllButtons();
    };
    const selectButtons = (...buttons) => {
      if (!buttons.length) {
        return;
      }
      const container = buttons[0].parentElement;
      clearSelected((button) => button.parentElement !== container);
      buttons = buttons.filter((button) => button.parentElement === container);
      buttons.forEach((button) => {
        button.classList.add("glow2");
      });
      ui.selected.guanxing_buttons.addArray(buttons);
      ui.selected.guanxing_button = ui.selected.guanxing_buttons[0] || null;
      updateSelectAllButtons();
    };
    const toggleButton = (button) => {
      const nextState = !button.classList.contains("glow2");
      if (!nextState) {
        button.classList.remove("glow2");
        ui.selected.guanxing_buttons.remove(button);
        ui.selected.guanxing_button = ui.selected.guanxing_buttons[0] || null;
        updateSelectAllButtons();
      } else {
        if (!canMultiselect) {
          clearSelected();
        }
        selectButtons(button);
      }
      return nextState;
    };
    const revertSelection = (container) => {
      const selecteds = new Set(ui.selected.guanxing_buttons.filter((button) => button.parentElement === container));
      const nextSelecteds = Array.from(container.children).filter((button) => button instanceof HTMLDivElement && !selecteds.has(button));
      clearSelected();
      selectButtons(...nextSelecteds);
    };
    const { dragStart, onDrag, resetDrag } = createMoveDrag(event, clearSelected, selectButtons);
    const dragEnd = (e) => {
      if (event.isPlayingAnimation) {
        return;
      }
      if (e instanceof MouseEvent) {
        if (e.which != 1) {
          return;
        }
      }
      if (window.TouchEvent && e instanceof TouchEvent) {
        if (e.changedTouches.length != 1) {
          return;
        }
        e = e.changedTouches[0];
      }
      const isDragging = ui.selected.guanxing_buttons.length === 1 && document.contains(ui.selected.guanxing_buttons[0]?.copy);
      buttonss.forEach((btn) => {
        Array.from(btn.children).filter((element) => element instanceof HTMLDivElement).forEach((element) => {
          if (element.copy && ui.window.contains(element.copy)) {
            ui.window.removeChild(element.copy);
          }
        });
      });
      if (e.target.classList.contains("select-all")) {
        return;
      }
      const clientX = e.clientX / game.documentZoom;
      const clientY = e.clientY / game.documentZoom;
      let aniamtionPromise;
      let spannedSingle = false;
      if (!isDragging && ui.selected.guanxing_buttons.length === 1) {
        const curCard = ui.selected.guanxing_buttons[0];
        const target = e.target;
        if (!curCard.contains(target)) {
          const buttons = buttonss.find((b) => b.contains(target));
          if (buttons && !buttons.contains(curCard)) {
            spannedSingle = true;
          }
        }
      }
      if (isDragging || !canMultiselect && ui.selected.guanxing_buttons.length === 1 || spannedSingle) {
        const curCard = ui.selected.guanxing_buttons[0];
        const target = document.elementFromPoint(clientX * game.documentZoom, clientY * game.documentZoom);
        if (curCard.contains(target)) {
          return;
        }
        const buttons = buttonss.find(
          (b) => (
            // Node.contains()
            b.contains(target)
          )
        );
        if (!buttons) {
          return;
        }
        const children = Array.from(buttons.children).filter((element) => element instanceof HTMLDivElement);
        const card = children.find((element) => element.contains(target));
        if (!card) {
          if (!filterMove(curCard, buttons._link, event.moved)) {
            return;
          }
        } else {
          if (!filterMove(card, curCard, event.moved)) {
            return;
          }
        }
        if (!card) {
          let position;
          if (buttons.children.length) {
            const firstChild = buttons.firstElementChild;
            if (firstChild && clientX < firstChild.getBoundingClientRect().left / game.documentZoom) {
              position = "first";
            }
          } else {
            position = "last";
          }
          aniamtionPromise = game.$elementGoto(curCard, buttons, position, animationDuration);
        } else {
          const buttons2 = curCard.parentElement;
          const pos1 = card.nextElementSibling || "last";
          const pos2 = curCard.nextElementSibling || "last";
          aniamtionPromise = game.$elementSwap(curCard, card, animationDuration);
        }
        clearSelected();
      } else if (ui.selected.guanxing_buttons.length) {
        const target = e.target;
        const buttons = buttonss.find((b) => b.contains(target));
        if (!buttons || buttons !== target) {
          return;
        }
        let position;
        if (buttons.children.length) {
          const firstChild = buttons.firstElementChild;
          if (firstChild && clientX < firstChild.getBoundingClientRect().left / game.documentZoom) {
            position = firstChild;
          }
        } else {
          position = "last";
        }
        const selected = filterBatchMove(ui.selected.guanxing_buttons, buttons, position !== "last" ? "first" : "last");
        const subPromises = [];
        for (const element of selected) {
          subPromises.push(game.$elementGoto(element, buttons, position, animationDuration));
        }
        aniamtionPromise = Promise.all(subPromises).then(() => void 0);
        clearSelected();
      }
      if (aniamtionPromise) {
        event.isPlayingAnimation = true;
        aniamtionPromise.then(() => {
          event.isPlayingAnimation = false;
          updateButtons();
        });
      }
      resetDrag();
    };
    for (const [i, item] of list.entries()) {
      const tex2 = event.dialog.add(`<div class="text center">${item[0]}</div>`);
      tex2.classList.add("choosetomove");
      if (canMultiselect) {
        const selectAll = ui.create.div(".select-all.popup.pointerdiv", event.dialog.content);
        selectAll.innerHTML = "全选";
        selectAll.listen((e) => {
          if (!(e.target instanceof Element) || !(e.target.nextElementSibling instanceof HTMLDivElement)) {
            return;
          }
          revertSelection(e.target.nextElementSibling);
        });
      }
      const buttons = Object.assign(ui.create.div(".buttons.popup.guanxing", event.dialog.content), { _link: i });
      buttons.addEventListener(lib.config.touchscreen ? "touchstart" : "mousedown", dragStart, true);
      event.dialog.addEventListener(lib.config.touchscreen ? "touchmove" : "mousemove", onDrag, true);
      event.dialog.addEventListener(lib.config.touchscreen ? "touchend" : "mouseup", dragEnd, true);
      buttonss.push(buttons);
      if (item[1]) {
        if (get.itemtype(item[1]) == "cards") {
          const cardsb = ui.create.buttons(item[1], "card", buttons);
          if (item[2] && typeof item[2] == "string") {
            for (const ij of cardsb) {
              if (typeof ij === "object" && ij !== null && "node" in ij && typeof ij.node === "object" && ij.node !== null && "gaintag" in ij.node && ij.node.gaintag instanceof HTMLElement) {
                ij.node.gaintag.innerHTML = get.translation(item[2]);
              }
            }
          }
        } else if (item[1].length == 2) {
          ui.create.buttons(item[1][0], item[1][1], buttons);
        }
      }
      if (item[2] && typeof item[2] == "function") {
        buttons.textPrompt = item[2];
      }
    }
    const tex = event.dialog.add('<div class="text center">点击或拖动两张牌以交换位置；点击一张牌并点击其他区域或拖动到其他区域以移动卡牌</div>');
    tex.classList.add("choosetomove");
    event.dialog.open();
    updateButtons();
    event.custom.replace.button = (button) => {
      if (event.isPlayingAnimation) {
        return;
      }
      const node = button.parentNode;
      if (!(node instanceof HTMLDivElement) || !buttonss.includes(node)) {
        return;
      }
      toggleButton(button);
    };
    event.custom.replace.confirm = (bool) => {
      if (event.isPlayingAnimation) {
        return;
      }
      buttonss.forEach((btn) => {
        for (const element of Array.from(btn.children).filter((child) => child instanceof HTMLDivElement)) {
          if (element.copy && ui.window.contains(element.copy)) {
            ui.window.removeChild(element.copy);
            delete element.copy;
          }
        }
      });
      if (bool) {
        event._result = {
          bool: true,
          moved: event.moved
        };
      } else {
        event._result = { bool: false };
      }
      event.dialog.close();
      if (ui.confirm) {
        ui.confirm.close();
      }
      game.resume();
      _status.imchoosing = false;
      setTimeout(() => {
        ui.arena.classList.remove("choose-to-move");
      }, 500);
      resolve(event._result);
    };
    game.pause();
    game.countChoose();
    event.choosing = true;
  });
}
export {
  showMoveDialog
};
