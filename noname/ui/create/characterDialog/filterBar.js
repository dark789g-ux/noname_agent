import "../../../../noname.js";
import { _status } from "../../../status/index.js";
import { get } from "../../../get/binding.js";
import { lib } from "../../../library/index.js";
import { ui } from "../../index.js";
function getCharacterCapt(str) {
  let capt;
  if (str.indexOf("_") == -1) {
    capt = str[0];
  } else {
    capt = str[str.lastIndexOf("_") + 1];
  }
  capt = capt.toLowerCase();
  if (!/[a-z]/i.test(capt)) {
    capt = "自定义";
  }
  return capt;
}
function getButtonCapt(dialog, button, noalph) {
  if (typeof button.link != "string" || typeof button.capt != "string") return null;
  return dialog.getCurrentCapt?.(button.link, button.capt, noalph);
}
function clearRecentCapt(dialog, currentTarget) {
  const captnode2 = dialog.currentcaptnode2;
  if (dialog.currentcapt2 == "最近" && captnode2 && captnode2 != currentTarget && !captnode2.inited) {
    dialog.currentcapt2 = null;
    captnode2.classList.remove("thundertext");
    captnode2.inited = true;
    dialog.currentcaptnode2 = null;
  }
}
function createCaptClickHandler(state) {
  return function clickCapt(e) {
    const dialog = state.dialog;
    if (!dialog || _status.dragged) {
      return;
    }
    clearRecentCapt(dialog, this);
    if (this.alphabet) {
      if (this.classList.contains("thundertext")) {
        dialog.currentcapt = null;
        dialog.currentcaptnode = null;
        this.classList.remove("thundertext");
        this.touchlink?.classList.remove("active");
        for (const button of dialog.buttons) {
          state.restoreState(button);
          if (dialog.currentgroup && button.group != dialog.currentgroup) {
            button.classList.add("nodisplay");
          } else if (dialog.currentcapt2 && button.capt != getButtonCapt(dialog, button, true)) {
            button.classList.add("nodisplay");
          } else {
            button.classList.remove("nodisplay");
          }
        }
      } else {
        const currentCaptnode = dialog.currentcaptnode;
        if (currentCaptnode) {
          currentCaptnode.classList.remove("thundertext");
          currentCaptnode.touchlink?.classList.remove("active");
        }
        dialog.currentcapt = this.link;
        dialog.currentcaptnode = this;
        this.classList.add("thundertext");
        this.touchlink?.classList.add("active");
        for (const button of dialog.buttons) {
          state.restoreState(button);
          if (button.capt != getButtonCapt(dialog, button)) {
            button.classList.add("nodisplay");
          } else if (dialog.currentcapt2 && button.capt != getButtonCapt(dialog, button, true)) {
            button.classList.add("nodisplay");
          } else if (dialog.currentgroup && button.group != dialog.currentgroup) {
            button.classList.add("nodisplay");
          } else {
            button.classList.remove("nodisplay");
          }
        }
      }
    } else {
      if (state.newlined2 && state.packsource) {
        state.newlined2.style.display = "none";
        if (!state.packsource.onlypack) {
          state.packsource.classList.remove("thundertext");
          if (!get.is.phoneLayout() || !lib.config.filternode_button) {
            state.packsource.innerHTML = "武将包";
          }
        }
      }
      if (this.classList.contains("thundertext")) {
        dialog.currentcapt2 = null;
        dialog.currentcaptnode2 = null;
        this.classList.remove("thundertext");
        this.touchlink?.classList.remove("active");
        for (const button of dialog.buttons) {
          state.restoreState(button);
          if (dialog.currentgroup && button.group != dialog.currentgroup) {
            button.classList.add("nodisplay");
          } else if (dialog.currentcapt && button.capt != getButtonCapt(dialog, button)) {
            button.classList.add("nodisplay");
          } else {
            button.classList.remove("nodisplay");
          }
        }
      } else {
        const currentCaptnode2 = dialog.currentcaptnode2;
        if (currentCaptnode2) {
          currentCaptnode2.classList.remove("thundertext");
          currentCaptnode2.touchlink?.classList.remove("active");
        }
        dialog.currentcapt2 = this.link;
        dialog.currentcaptnode2 = this;
        this.classList.add("thundertext");
        if (this.touchlink) {
          this.touchlink.classList.add("active");
        } else if (this.parentNode == state.newlined2 && state.packsource) {
          state.packsource.innerHTML = this.innerHTML;
          state.packsource.classList.add("thundertext");
        }
        for (const button of dialog.buttons) {
          state.restoreState(button);
          if (dialog.currentcapt && button.capt != getButtonCapt(dialog, button)) {
            button.classList.add("nodisplay");
          } else if (button.capt != getButtonCapt(dialog, button, true)) {
            button.classList.add("nodisplay");
          } else if (dialog.currentgroup && button.group != dialog.currentgroup) {
            button.classList.add("nodisplay");
          } else {
            button.activate?.();
            button.classList.remove("nodisplay");
          }
        }
      }
    }
    if (dialog.seperate) {
      for (const sep of dialog.seperate) {
        const next = sep.nextElementSibling;
        if (!(next instanceof HTMLElement)) continue;
        if (!next.querySelector(".button:not(.nodisplay)")) {
          sep.style.display = "none";
          next.style.display = "none";
        } else {
          sep.style.display = "";
          next.style.display = "";
        }
      }
    }
    if (state.filternode && state.packsource) {
      if (state.filternode.querySelector(".active")) {
        state.packsource.classList.add("thundertext");
      } else {
        state.packsource.classList.remove("thundertext");
      }
    }
    state.updatePagination();
    if (e) {
      e.stopPropagation();
    }
  };
}
function createGroupClickHandler(state) {
  return function clickGroup() {
    const dialog = state.dialog;
    if (!dialog || _status.dragged) {
      return;
    }
    clearRecentCapt(dialog, this);
    const node = this;
    const link = this.link;
    if (node.classList.contains("thundertext")) {
      dialog.currentgroup = null;
      dialog.currentgroupnode = null;
      node.classList.remove("thundertext");
      for (const button of dialog.buttons) {
        state.restoreState(button);
        if (dialog.currentcapt && button.capt != getButtonCapt(dialog, button)) {
          button.classList.add("nodisplay");
        } else if (dialog.currentcapt2 && button.capt != getButtonCapt(dialog, button, true)) {
          button.classList.add("nodisplay");
        } else {
          button.classList.remove("nodisplay");
        }
      }
    } else {
      if (dialog.currentgroupnode) {
        dialog.currentgroupnode.classList.remove("thundertext");
      }
      dialog.currentgroup = link;
      dialog.currentgroupnode = node;
      node.classList.add("thundertext");
      for (const button of dialog.buttons) {
        state.restoreState(button);
        if (dialog.currentcapt && button.capt != getButtonCapt(dialog, button)) {
          button.classList.add("nodisplay");
        } else if (dialog.currentcapt2 && button.capt != getButtonCapt(dialog, button, true)) {
          button.classList.add("nodisplay");
        } else if (dialog.currentgroup == "double") {
          button.classList.toggle("nodisplay", !button._changeGroup);
        } else if (dialog.currentgroup == "ye") {
          button.classList.toggle("nodisplay", button.group != "ye");
        } else {
          button.classList.toggle("nodisplay", Boolean(button._changeGroup) || button.group != dialog.currentgroup);
        }
      }
    }
    state.updatePagination();
  };
}
function collectPackList() {
  const packlist = [];
  for (let i = 0; i < lib.config.all.characters.length; i++) {
    if (!lib.config.characters.includes(lib.config.all.characters[i])) {
      continue;
    }
    packlist.add(lib.config.all.characters[i]);
  }
  for (let i = 0; i < lib.config.characters.length; i++) {
    if (lib.config.all.characters.includes(lib.config.characters[i])) {
      continue;
    }
    if (!lib.characterPack[lib.config.characters[i]]) {
      continue;
    }
    if (!lib.translate[lib.config.characters[i] + "_character_config"]) {
      continue;
    }
    packlist.add(lib.config.characters[i]);
  }
  Object.keys(lib.characterPack).filter((key) => {
    if (key.indexOf("mode_extension") != 0) {
      return false;
    }
    const extName = key.slice(15);
    return lib.config[`extension_${extName}_characters_enable`] === true;
  }).forEach((key) => packlist.add(key));
  return packlist;
}
function buildCharacterDialogFilterBar(state) {
  const { node, namecapt, thisiscard, groups, onlypack } = state;
  const clickCapt = createCaptClickHandler(state);
  let newlined = null;
  const eventName = lib.config.touchscreen ? "touchend" : "click";
  for (let i = 0; i < namecapt.length; i++) {
    if (namecapt[i] == "newline") {
      newlined = document.createElement("div");
      newlined.style.marginTop = "5px";
      newlined.style.display = "block";
      newlined.style.fontSize = get.is.phoneLayout() ? "32px" : "22px";
      newlined.style.textAlign = "center";
      node.appendChild(newlined);
    } else if (newlined) {
      const captionButton = ui.create.div(".tdnode.pointerdiv.shadowed.reduce_radius");
      captionButton.style.margin = "3px";
      captionButton.style.width = "auto";
      captionButton.innerHTML = " " + namecapt[i].toUpperCase() + " ";
      captionButton.link = namecapt[i];
      captionButton.addEventListener(eventName, clickCapt);
      newlined.appendChild(captionButton);
      node[namecapt[i]] = captionButton;
      captionButton._nature = namecapt[i] == "收藏" ? "fire" : "wood";
    } else {
      const alphabetButton = document.createElement("span");
      alphabetButton.innerHTML = " " + namecapt[i].toUpperCase() + " ";
      alphabetButton.link = namecapt[i];
      alphabetButton.alphabet = true;
      alphabetButton.addEventListener(eventName, clickCapt);
      node.appendChild(alphabetButton);
    }
  }
  if (!thisiscard && newlined) {
    const groupFilterContainer = newlined;
    const natures = ["water", "soil", "wood", "metal"];
    const groupSpacer = document.createElement("span");
    groupFilterContainer.appendChild(groupSpacer);
    groupSpacer.style.margin = "8px";
    const clickGroup = createGroupClickHandler(state);
    for (let i = 0; i < groups.length; i++) {
      const groupButton = Object.assign(ui.create.div(".tdnode.pointerdiv.shadowed.reduce_radius.reduce_margin"), { link: groups[i] });
      groupButton.style.margin = "3px";
      groupFilterContainer.appendChild(groupButton);
      groupButton.innerHTML = get.translation(groups[i]);
      groupButton.link = groups[i];
      groupButton._nature = natures[i];
      groupButton.addEventListener(eventName, clickGroup);
    }
    const packSpacer = document.createElement("span");
    groupFilterContainer.appendChild(packSpacer);
    packSpacer.style.margin = "8px";
    const packsource = ui.create.div(".tdnode.pointerdiv.shadowed.reduce_radius.reduce_margin");
    packsource.style.margin = "3px";
    groupFilterContainer.appendChild(packsource);
    state.packsource = packsource;
    const clickCaptNode = function(e) {
      delete _status.filterCharacter;
      ui.window.classList.remove("shortcutpaused");
      state.filternode?.delete();
      state.filternode?.classList.remove("shown");
      clickCapt.call(this.link, e);
    };
    if (get.is.phoneLayout() && lib.config.filternode_button) {
      groupFilterContainer.style.marginTop = "";
      packsource.innerHTML = "筛选";
      const filternode = ui.create.div(".popup-container.filter-character.modenopause");
      state.filternode = filternode;
      ui.create.div(filternode);
      filternode.listen(function(e) {
        if (this.classList.contains("removing")) {
          return;
        }
        delete _status.filterCharacter;
        ui.window.classList.remove("shortcutpaused");
        this.delete();
        this.classList.remove("shown");
        e.stopPropagation();
      });
      for (let i = 0; i < node.childElementCount; i++) {
        const child = node.children[i];
        if (!(child instanceof HTMLElement) || child.tagName.toLowerCase() != "span") {
          continue;
        }
        child.style.display = "none";
        const touchlink = Object.assign(ui.create.div(filternode.firstChild, clickCaptNode, ".menubutton.large.capt", child.innerHTML), { link: child });
        Object.assign(child, { touchlink });
      }
      ui.create.node("br", filternode.firstChild);
    } else if (onlypack) {
      packsource.onlypack = true;
      packsource.innerHTML = get.translation(onlypack + "_character_config");
      packsource.style.display = "none";
      const previous = packsource.previousElementSibling;
      if (previous instanceof HTMLElement) previous.style.display = "none";
    } else {
      packsource.innerHTML = "武将包";
    }
    const newlined2 = document.createElement("div");
    newlined2.style.marginTop = "5px";
    newlined2.style.display = "none";
    newlined2.style.fontFamily = "xinwei";
    newlined2.classList.add("pointernode");
    newlined2.style.fontSize = get.is.phoneLayout() ? "32px" : "22px";
    newlined2.style.textAlign = "center";
    node.appendChild(newlined2);
    state.newlined2 = newlined2;
    packsource.addEventListener(eventName, function() {
      if (packsource.onlypack || _status.dragged) {
        return;
      }
      const filternode = state.filternode;
      if (get.is.phoneLayout() && lib.config.filternode_button && filternode) {
        _status.filterCharacter = true;
        ui.window.classList.add("shortcutpaused");
        ui.window.appendChild(filternode);
        ui.refresh(filternode);
        filternode.classList.add("shown");
        const firstChild = filternode.firstChild;
        const dh = filternode.offsetHeight - firstChild.offsetHeight;
        firstChild.style.top = dh > 0 ? dh / 2 + "px" : "";
      } else {
        newlined2.style.display = newlined2.style.display == "none" ? "block" : "none";
      }
    });
    const packlist = collectPackList();
    for (let i = 0; i < packlist.length; i++) {
      const packButton = document.createElement("div");
      packButton.style.display = "inline-block";
      packButton.style.width = "auto";
      packButton.style.margin = "5px";
      packButton.style.fontSize = get.is.phoneLayout() ? "32px" : "22px";
      packButton.innerHTML = String(lib.translate[packlist[i] + "_character_config"]);
      packButton.link = packlist[i];
      packButton.addEventListener(eventName, clickCapt);
      newlined2.appendChild(packButton);
      if (state.filternode && !onlypack) {
        packButton.touchlink = ui.create.div(state.filternode.firstChild, clickCaptNode, ".menubutton.large", packButton.innerHTML);
        packButton.touchlink.link = packButton;
      }
    }
  }
  return clickCapt;
}
export {
  buildCharacterDialogFilterBar,
  getCharacterCapt
};
