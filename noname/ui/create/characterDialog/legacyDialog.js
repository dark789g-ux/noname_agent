import "../../../../noname.js";
import { lib } from "../../../library/index.js";
import { ui } from "../../index.js";
import { get } from "../../../get/binding.js";
const legacyCharacterDialogMethods = {
  cardDialog(...args) {
    return ui.create.characterDialog.apply(this, ["thisiscard", ...args]);
  },
  characterDialog2(filter) {
    const list = [];
    for (const i in lib.character) {
      if (lib.character[i].isMinskin) {
        continue;
      }
      if (lib.character[i].isBoss || lib.character[i].isHiddenBoss) {
        if (lib.config.mode == "boss") {
          continue;
        }
        if (!lib.character[i].isBossAllowed) {
          continue;
        }
      }
      if (lib.character[i].isHiddenInStoneMode) {
        continue;
      }
      if (lib.config.banned.includes(i)) {
        continue;
      }
      if (filter && filter(i)) {
        continue;
      }
      list.push(i);
    }
    const dialog = ui.create.dialog("hidden");
    dialog.classList.add("noupdate");
    dialog.classList.add("scroll1");
    dialog.classList.add("scroll2");
    dialog.classList.add("scroll3");
    list.sort(lib.sort.character);
    dialog.classList.add("character");
    dialog.classList.add("choose-character");
    const packnode = ui.create.div(".packnode", dialog);
    lib.setScroll(packnode);
    const clickCapt = function() {
      const parent = this.parentNode;
      if (!parent) {
        throw new Error("character pack selector must have a container");
      }
      const active = parent.querySelector(".active");
      if (active) {
        active.classList.remove("active");
      }
      this.classList.add("active");
      for (let i = 0; i < dialog.buttons.length; i++) {
        if (this.pack && !this.pack.includes(dialog.buttons[i].link)) {
          dialog.buttons[i].classList.add("nodisplay");
        } else {
          dialog.buttons[i].classList.remove("nodisplay");
        }
      }
    };
    const createNode = function(packname) {
      let pack = null;
      if (packname == "最近") {
        pack = get.config("recentCharacter") || [];
      } else if (packname == "收藏") {
        pack = lib.config.favouriteCharacter;
      }
      return Object.assign(ui.create.div(".dialogbutton.menubutton.large", packname, packnode, clickCapt), { pack });
    };
    dialog.add([list, "character"]);
    let bool = true;
    let node;
    const recent = get.config("recentCharacter");
    if (recent && recent.length) {
      node = createNode("最近");
      if (lib.config.character_dialog_tool == "最近") {
        clickCapt.call(node);
        bool = false;
      }
    }
    if (lib.config.favouriteCharacter.length) {
      node = createNode("收藏");
      if (lib.config.character_dialog_tool == "收藏") {
        clickCapt.call(node);
        bool = false;
      }
    }
    node = createNode("全部");
    if (lib.config.character_dialog_tool == "all") {
      clickCapt.call(node);
      bool = false;
    }
    if (bool) {
      const firstPackNode = packnode.firstElementChild;
      if (!(firstPackNode instanceof HTMLDivElement)) {
        throw new Error("character pack selector must have an initial button");
      }
      clickCapt.call(firstPackNode);
    }
    ui.create.div(".dialogbutton.menubutton.large", "筛选", packnode);
    return dialog;
  }
};
export {
  legacyCharacterDialogMethods
};
