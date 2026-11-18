import "../../../../noname.js";
import { normalizeSelectionResult, applyLLMDecision } from "./selectionResults.js";
import { game } from "../../../game/index.js";
import { _status } from "../../../status/index.js";
import { lib } from "../../index.js";
import { ui } from "../../../ui/index.js";
import { get } from "../../../get/binding.js";
const chooseToMove_newContent = {
  async chooseToMove_new(event, trigger, player) {
    if (player.isUnderControl()) {
      game.swapPlayerAuto(player);
    }
    if (event.chooseTime && _status.connectMode && !game.online) {
      event.time = lib.configOL.choose_timeout;
      game.broadcastAll((time) => {
        lib.configOL.choose_timeout = time;
      }, event.chooseTime);
    }
    let result;
    if (event.isMine()) {
      let updateButtons = function() {
        event.moved = Array.from({
          length: event.list.slice().reduce((sum, currentList) => {
            if (!Array.isArray(currentList[0])) {
              currentList = [currentList];
            }
            return sum += currentList.length;
          }, 0)
        }).map((_, i) => {
          const num = 2 * (i + 1);
          const container = event.dialog.itemContainers[num];
          if (!(container instanceof HTMLDivElement)) {
            throw new TypeError("Move dialog item container is not initialized");
          }
          return Array.from(container.children).map((child) => "link" in child ? child.link : void 0);
        });
        if (event.filterOk ? event.filterOk(event.moved) : true) {
          ui.create.confirm("o");
        } else {
          if (!event.forced) {
            ui.create.confirm("c");
          } else if (ui.confirm) {
            ui.confirm.close();
          }
        }
      }, clickItem = function(card, container, allContainers) {
        if (event.dialog.isBusy) {
          return;
        }
        if (event.dialog.selectedCard) {
          if (card !== event.dialog.selectedCard && (event.filterMove ? event.filterMove(event.dialog.selectedCard, card, event.moved) : true)) {
            event.dialog.isBusy = true;
            game.$swapElement(card, event.dialog.selectedCard, animationDuration).then(() => {
              event.dialog.isBusy = false;
              updateButtons();
            });
          }
          event.dialog.selectedCard.classList.remove("selected");
          event.dialog.selectedCard = null;
        } else {
          event.dialog.selectedCard = card;
          card.classList.add("selected");
        }
      }, clickItemContainer = function(itemContainer, i, allContainers) {
        if (event.dialog.isBusy || !event.dialog.selectedCard) {
          return;
        }
        if (itemContainer.contains(event.dialog.selectedCard)) {
          return;
        }
        const index = Array.from(event.dialog.itemContainers).indexOf(itemContainer) / 2 - 1;
        if (event.filterMove ? event.filterMove(event.dialog.selectedCard, index, event.moved) : true) {
          event.dialog.isBusy = true;
          game.$elementGoto(event.dialog.selectedCard, itemContainer, void 0, animationDuration).then(() => {
            event.dialog.isBusy = false;
            updateButtons();
          });
        }
        event.dialog.selectedCard.classList.remove("selected");
        event.dialog.selectedCard = null;
      };
      const { promise, resolve } = Promise.withResolvers();
      const animationDuration = lib.config.animation_choose_to_move ? 300 : 0;
      event.switchToAuto = () => {
        if (!(event.filterOk ? event.filterOk(event.moved) : true)) {
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
        resolve(normalizeSelectionResult(event._result));
      };
      event.dialog = ui.create.dialog();
      event.dialog.addNewRow(event.prompt || "请选择要操作的牌");
      event.dialog.selectedCard = null;
      event.dialog.isBusy = false;
      event.dialog.classList.add("scroll1");
      event.dialog.classList.add("scroll2");
      event.dialog.classList.add("fullwidth");
      if (get.is.phoneLayout() || event.list.length > 2) {
        ui.arena.classList.add("choose-to-move");
        event.dialog.classList.add("fullheight");
      }
      const itemContainerCss = event.itemContainerCss || {
        justifyContent: "center",
        minHeight: "100px"
      };
      for (const item of event.list) {
        let currentList = item.slice();
        if (!Array.isArray(currentList[0])) {
          currentList = [currentList];
        }
        event.dialog.addNewRow(
          ...currentList.slice().map((listx) => [{ item: listx[0], ratio: 1 }, listx[1]?.length ? { item: listx[1], ratio: 6 / currentList.length, itemContainerCss, clickItem, clickItemContainer } : { item: listx[1], ratio: 6 / currentList.length, itemContainerCss, clickItemContainer }]).flat()
        );
      }
      event.dialog.open();
      updateButtons();
      event.custom.replace.confirm = (bool) => {
        let result2;
        if (bool) {
          result2 = {
            bool: true,
            moved: event.moved
          };
        } else {
          result2 = { bool: false };
        }
        event.dialog.close();
        if (ui.confirm) {
          ui.confirm.close();
        }
        _status.imchoosing = false;
        setTimeout(() => {
          ui.arena.classList.remove("choose-to-move");
        }, 500);
        resolve(result2);
      };
      game.countChoose();
      event.choosing = true;
      result = await promise;
    } else if (event.isOnline()) {
      const remoteResult = await event.sendAsync();
      result = normalizeSelectionResult(remoteResult);
    } else {
      result = "ai";
      if (await applyLLMDecision(event)) result = normalizeSelectionResult(event.result);
    }
    if (event.time) {
      game.broadcastAll((time) => {
        lib.configOL.choose_timeout = time;
      }, event.time);
    }
    const resultBool = typeof result == "string" ? void 0 : result?.bool;
    if ((!result || result == "ai" || event.forced && !resultBool) && event.processAI) {
      const moved = event.processAI(event.list);
      if (moved) {
        result = {
          bool: true,
          moved
        };
      } else {
        result = { bool: false };
      }
    }
    event.result = result ?? "cancelled";
  }
};
export {
  chooseToMove_newContent
};
