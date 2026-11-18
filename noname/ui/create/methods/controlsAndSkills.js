import "../../../../noname.js";
import { ui } from "../../index.js";
import { _status } from "../../../status/index.js";
import { get } from "../../../get/binding.js";
import { lib } from "../../../library/index.js";
import { game } from "../../../game/index.js";
function createSkillControl(slot, skills) {
  const existing = ui[slot];
  if (existing) {
    let same = false;
    if (skills && existing.skills && existing.skills.length == skills.length && existing.style.display != "none") {
      same = true;
      for (let i = 0; i < skills.length; i++) {
        if (!existing.skills.includes(skills[i])) {
          same = false;
          break;
        }
      }
    }
    if (same) {
      return;
    }
    existing.close();
    delete ui[slot];
  }
  if (skills == void 0 || skills.length == 0) {
    return;
  }
  if (!_status.event.isMine()) {
    _status.noupdatec = true;
  }
  const created = ui.create.control(skills.concat([ui.click.skill]));
  ui[slot] = created;
  for (let i = 0; i < created.childNodes.length; i++) {
    const child = created.childNodes[i];
    if (child instanceof HTMLElement && "link" in child && typeof child.link == "string") {
      child.innerHTML = get.skillTranslation(child.link, _status.event.player, true);
    }
  }
  if (!_status.event.isMine()) {
    created.style.display = "none";
  } else {
    ui.updatec();
  }
  _status.noupdatec = false;
  created.skills = skills;
  return created;
}
const controlsAndSkillsMethods = {
  groupControl(dialog) {
    return ui.create.control("wei", "shu", "wu", "qun", "jin", "western", "key", function(link, node) {
      if (link == "全部") {
        dialog.currentcapt = "";
        dialog.currentgroup = "";
        for (let i = 0; i < dialog.buttons.length; i++) {
          dialog.buttons[i].style.display = "";
        }
      } else if (node.classList.contains("thundertext")) {
        dialog.currentgroup = null;
        dialog.currentgroupnode = null;
        node.classList.remove("thundertext");
        for (let i = 0; i < dialog.buttons.length; i++) {
          if (dialog.currentcapt && dialog.buttons[i].capt != dialog.getCurrentCapt?.(String(dialog.buttons[i].link), dialog.buttons[i].capt ?? "")) {
            dialog.buttons[i].classList.add("nodisplay");
          } else {
            dialog.buttons[i].classList.remove("nodisplay");
          }
        }
      } else {
        if (dialog.currentgroupnode) {
          dialog.currentgroupnode.classList.remove("thundertext");
        }
        dialog.currentgroup = link;
        dialog.currentgroupnode = node;
        node.classList.add("thundertext");
        for (let i = 0; i < dialog.buttons.length; i++) {
          if (dialog.buttons[i].group != link || dialog.currentcapt && dialog.buttons[i].capt != dialog.getCurrentCapt?.(String(dialog.buttons[i].link), dialog.buttons[i].capt ?? "")) {
            dialog.buttons[i].classList.add("nodisplay");
          } else {
            dialog.buttons[i].classList.remove("nodisplay");
          }
        }
      }
    });
  },
  control(...args) {
    return new lib.element.Control(...args);
  },
  confirm(str, func) {
    if (ui.confirm && ui.confirm.str == str) {
      return;
    }
    if (str == "o") {
      if (ui.confirm) {
        ui.confirm.replace("ok");
      } else {
        ui.confirm = ui.create.control("ok");
      }
    } else if (str == "oc" || str == "co") {
      if (ui.confirm) {
        ui.confirm.replace("ok", "cancel");
      } else {
        ui.confirm = ui.create.control("ok", "cancel");
      }
    } else if (str == "c") {
      if (ui.confirm) {
        ui.confirm.replace("cancel");
      } else {
        ui.confirm = ui.create.control("cancel");
      }
    } else if (ui.confirm) {
      ui.confirm.close();
      delete ui.confirm;
    }
    if (ui.confirm) {
      ui.confirm.str = str;
      if (func) {
        ui.confirm.custom = func;
      } else {
        delete ui.confirm.custom;
      }
    }
  },
  skills(skills) {
    return createSkillControl("skills", skills);
  },
  skills2(skills) {
    return createSkillControl("skills2", skills);
  },
  skills3(skills) {
    return createSkillControl("skills3", skills);
  },
  /**
   * 向当前事件注入牌的全选/反选按钮
   */
  cardChooseAll() {
    const event = get.event();
    if (!event.isMine() || !event.allowChooseAll || event.complexCard || event.complexSelect || !lib.config.choose_all_button) {
      return null;
    }
    const range = get.select(event.selectCard);
    if (range[1] <= 1) {
      return null;
    }
    return event.cardChooseAll = ui.create.control("全选", function() {
      const evt = get.event();
      const selecteds = [...ui.selected.cards];
      ui.selected.cards.length = 0;
      game.check();
      const selectables = get.selectableCards();
      const cards = selecteds.length ? [...new Set(selectables).difference(new Set(selecteds))] : selectables;
      if (cards.length <= range[1]) {
        ui.selected.cards.push(...cards);
      } else {
        ui.selected.cards.push(...cards.randomGets(range[1]));
      }
      for (const card of ui.selected.cards) {
        card.classList.add("selected");
        card.updateTransform(true, 0);
      }
      for (const card of selecteds) {
        card.classList.remove("selected");
        card.updateTransform(false, 0);
      }
      game.check();
      if (typeof evt.custom?.add?.card == "function") {
        evt.custom.add.card();
      }
    });
  },
  /**
   * 向当前事件注入按钮的全选/反选按钮
   */
  buttonChooseAll() {
    const event = get.event();
    if (!event.isMine() || !(event.dialog instanceof lib.element.Dialog) || !event.allowChooseAll || event.complexSelect || !lib.config.choose_all_button) {
      return null;
    }
    const range = get.select(event.selectButton);
    if (range[1] <= 1) {
      return null;
    }
    const caption = event.dialog.content.querySelector(".caption");
    if (!event.dialog.content.contains(caption)) {
      return null;
    }
    const buttonChooseAll = ui.create.div(".select-all.popup.pointerdiv");
    event.buttonChooseAll = buttonChooseAll;
    buttonChooseAll.listen(function(e) {
      const evt = get.event();
      const selecteds = [...ui.selected.buttons];
      ui.selected.buttons.length = 0;
      game.check();
      const selectables = get.selectableButtons();
      const buttons = selecteds.length ? [...new Set(selectables).difference(new Set(selecteds))] : selectables;
      if (buttons.length <= range[1]) {
        ui.selected.buttons.push(...buttons);
      } else {
        ui.selected.buttons.push(...buttons.randomGets(range[1]));
      }
      for (const button of ui.selected.buttons) {
        button.classList.add("selected");
      }
      for (const button of selecteds) {
        button.classList.remove("selected");
      }
      game.check();
      if (typeof evt.custom?.add?.button == "function") {
        evt.custom.add.button();
      }
      e.stopPropagation();
    });
    event.dialog.content.insertBefore(buttonChooseAll, caption);
    return buttonChooseAll;
  },
  system(str, func, right, before) {
    const parent = right ? ui.system2 : ui.system1;
    const node = ui.create.div();
    if (before) {
      parent.insertBefore(node, parent.firstChild);
    } else {
      parent.appendChild(node);
    }
    node.innerHTML = str;
    if (func) {
      node.listen(func);
    }
    if (lib.config.button_press) {
      node.addEventListener(lib.config.touchscreen ? "touchstart" : "mousedown", function() {
        if (!node.classList.contains("hidden")) {
          node.classList.add("pressdown");
        }
      });
      node.addEventListener(lib.config.touchscreen ? "touchend" : "mouseup", function() {
        node.classList.remove("pressdown");
      });
      node.addEventListener(lib.config.touchscreen ? "touchmove" : "mousemove", function() {
        node.classList.remove("pressdown");
      });
    }
    return node;
  },
  pause() {
    if (_status.pausing) {
      return;
    }
    ui.click.shortcut(false);
    const node = ui.create.div(".pausedbg", ui.window);
    _status.pausing = true;
    setTimeout(function() {
      _status.pausing = false;
    }, 500);
    if (lib.config.touchscreen) {
      setTimeout(function() {
        node.addEventListener("touchend", ui.click.resume);
      }, 500);
    } else {
      node.addEventListener("click", ui.click.resume);
    }
    if (!lib.config.touchscreen) {
      node.oncontextmenu = function(e) {
        return ui.click.resume.call(node, e);
      };
    }
    const node2 = ui.create.div(node);
    node2.innerHTML = _status.connectMode ? "" : "已暂停";
    return node;
  }
};
export {
  controlsAndSkillsMethods
};
