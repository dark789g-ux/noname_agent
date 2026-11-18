import "../../../../../noname.js";
import { getRegisteredSkill } from "../../../skillRegistry.js";
import { isMarkNode, hasMarkName, hasMarkIdentifier, deleteMarkNode, hasHtmlDivParent } from "../dom/nodeGuards.js";
import "../contracts/storageHistoryContract.js";
import { get } from "../../../../get/binding.js";
import { game } from "../../../../game/index.js";
import { ui } from "../../../../ui/index.js";
import { lib } from "../../../index.js";
function isCardItem(value) {
  return get.itemtype(value) == "card";
}
function isCardsItem(value) {
  return get.itemtype(value) == "cards";
}
const markRenderMethods = {
  localMarkSkill(skill, target, event) {
    const func = (skill2, player) => {
      let name = skill2, info;
      if (player.marks[name]) {
        player.updateMarks();
      }
      const skillInfo = lib.getSkill(name);
      if (skillInfo) {
        info = skillInfo.intro;
      }
      if (!info) {
        return;
      }
      const existing = player.marks[name];
      if (existing) {
        existing.info = info;
      } else {
        player.marks[name] = player.mark(name, info);
      }
      player.updateMarks();
    };
    if (event.player == game.me) {
      func(skill, target);
    } else if (event.isOnline()) {
      this.send(func, skill, target);
    }
  },
  markSkill(name, info, card, nobroadcast) {
    if (info === true) {
      this.syncStorage(name);
      info = null;
    }
    if (isCardItem(card)) {
      game.addVideo("markSkill", this, [name, get.cardInfo(card)]);
    } else {
      game.addVideo("markSkill", this, [name]);
    }
    const func = function(storage, player, name2, info2, card2) {
      player.storage[name2] = storage;
      if (!info2) {
        if (player.marks[name2]) {
          player.updateMarks();
          return;
        }
        const skillInfo = lib.getSkill(name2);
        if (skillInfo) {
          info2 = skillInfo.intro;
        }
        if (!info2) {
          return;
        }
      }
      const existing = player.marks[name2];
      if (existing) {
        existing.info = info2;
      } else {
        if (card2) {
          player.marks[name2] = player.mark(card2, info2, name2);
        } else {
          player.marks[name2] = player.mark(name2, info2);
        }
      }
      player.updateMarks();
    };
    func(this.storage[name], this, name, info, card);
    if (!nobroadcast) {
      game.broadcast(func, this.storage[name], this, name, info, card);
    }
    return this;
  },
  unmarkSkill(name, nobroadcast) {
    game.addVideo("unmarkSkill", this, name);
    if (!nobroadcast) {
      game.broadcast(
        function(player, name2) {
          if (player.marks[name2]) {
            player.marks[name2].delete();
            player.marks[name2].style.transform += " scale(0.2)";
            delete player.marks[name2];
            ui.updatem(player);
          }
        },
        this,
        name
      );
    }
    if (this.marks[name]) {
      this.marks[name].delete();
      this.marks[name].style.transform += " scale(0.2)";
      delete this.marks[name];
      ui.updatem(this);
      const info = getRegisteredSkill(lib.skill, name);
      if (!game.online && info && info.intro && info.intro.onunmark) {
        if (info.intro.onunmark == "throw") {
          if (isCardsItem(this.storage[name])) {
            this.$throw(this.storage[name], 1e3);
            game.cardsDiscard(this.storage[name]);
            game.log(this.storage[name], "进入了弃牌堆");
            this.storage[name].length = 0;
          }
        } else if (typeof info.intro.onunmark == "function") {
          info.intro.onunmark(this.storage[name], this, name);
        } else {
          delete this.storage[name];
        }
      }
    }
    return this;
  },
  markSkillCharacter(id, target, name, content, nobroadcast) {
    const targetName = typeof target == "object" ? String(target.name ?? "") : target;
    const func = function(player, target2, name2, content2, id2) {
      const existing = player.marks[id2];
      if (existing) {
        existing.name = name2 + "_charactermark";
        existing._name = target2;
        existing.info = {
          name: name2,
          content: content2,
          id: id2
        };
        existing.setBackground(target2, "character");
        game.addVideo("changeMarkCharacter", player, {
          id: id2,
          name: name2,
          content: content2,
          target: target2
        });
      } else {
        const created = player.markCharacter(target2, {
          name: name2,
          content: content2,
          id: id2
        });
        if (created) {
          player.marks[id2] = created;
          created._name = target2;
        }
        game.addVideo("markCharacter", player, {
          name: name2,
          content: content2,
          id: id2,
          target: target2
        });
      }
    };
    func(this, targetName, name, content, id);
    if (!nobroadcast) {
      game.broadcast(func, this, targetName, name, content, id);
    }
    return this;
  },
  markCharacter(name, info, learn, learn2) {
    const charName = typeof name == "object" ? String(name.name ?? "") : name;
    let node;
    if (charName.startsWith("unknown")) {
      node = ui.create.div(".card.mark.drawinghidden");
      ui.create.div(".background.skillmark", node).innerHTML = get.translation(charName)[0];
    } else {
      if (!get.character(charName)) {
        return;
      }
      node = ui.create.div(".card.mark.drawinghidden").setBackground(charName, "character");
    }
    this.node.marks.insertBefore(node, this.node.marks.childNodes[1]);
    node.name = charName + "_charactermark";
    if (!info) {
      info = {};
    }
    if (!info.name) {
      info.name = get.translation(charName);
    }
    if (!info.content) {
      info.content = get.skillintro(charName, learn, learn2);
    }
    node.info = info;
    node.addEventListener(lib.config.touchscreen ? "touchend" : "click", ui.click.card);
    if (!lib.config.touchscreen) {
      if (lib.config.hover_all) {
        lib.setHover(node, ui.click.hoverplayer);
      }
      if (lib.config.right_info) {
        node.oncontextmenu = (e) => {
          if (!hasHtmlDivParent(node)) return false;
          return ui.click.rightplayer.call(node, e);
        };
      }
    }
    ui.updatem(this);
    return node;
  },
  mark(name, info, skill) {
    if (isCardsItem(name)) {
      const marks = [];
      for (let i = 0; i < name.length; i++) {
        marks.push(this.mark(name[i], info));
      }
      return marks;
    }
    let node;
    let markName;
    if (isCardItem(name)) {
      const copied = name.copy("mark");
      node = copied;
      node.classList.add("drawinghidden");
      this.node.marks.insertBefore(node, this.node.marks.childNodes[1]);
      node.suit = name.suit;
      node.number = name.number;
      if (name.classList.contains("fullborder")) {
        node.classList.add("fakejudge");
        node.classList.add("fakemark");
        (node.querySelector(".background") || ui.create.div(".background", node)).innerHTML = lib.translate[name.name + "_bg"] || get.translation(name.name)[0];
      }
      markName = name.name;
    } else {
      node = ui.create.div(".card.mark.drawinghidden");
      this.node.marks.insertBefore(node, this.node.marks.childNodes[1]);
      const skillInfo = getRegisteredSkill(lib.skill, name);
      if (skillInfo?.markimage) {
        node.setBackgroundImage(skillInfo.markimage);
        node.style["box-shadow"] = "none";
        node.style["background-size"] = "contain";
      } else if (skillInfo?.markimage2) {
        const img = ui.create.div(".background.skillmark", node);
        img.setBackgroundImage(skillInfo.markimage2);
        img.style["background-size"] = "contain";
      } else {
        let str = lib.translate[name + "_bg"];
        if (!str || str[0] == "+" || str[0] == "-") {
          str = get.translation(name)[0];
        }
        ui.create.div(".background.skillmark", node).innerHTML = str;
      }
      markName = name;
    }
    node.name = markName;
    node.skill = skill || markName;
    if (info && typeof info == "object") {
      node.info = info;
    } else if (typeof info == "string") {
      node.markidentifer = info;
    }
    node.addEventListener(lib.config.touchscreen ? "touchend" : "click", ui.click.card);
    if (!lib.config.touchscreen) {
      if (lib.config.hover_all) {
        lib.setHover(node, ui.click.hoverplayer);
      }
      if (lib.config.right_info) {
        const markNode = node;
        node.oncontextmenu = (e) => {
          if (!hasHtmlDivParent(markNode)) return false;
          return ui.click.rightplayer.call(markNode, e);
        };
      }
    }
    this.updateMarks();
    ui.updatem(this);
    return node;
  },
  unmark(name, info) {
    game.addVideo("unmarkname", this, name);
    if (isCardItem(name)) {
      this.unmark(name.name, info);
    } else if (isCardsItem(name)) {
      for (let i = 0; i < name.length; i++) {
        this.unmark(name[i].name, info);
      }
    } else {
      for (let i = 0; i < this.node.marks.childNodes.length; i++) {
        const mark = this.node.marks.childNodes[i];
        if (!isMarkNode(mark)) {
          continue;
        }
        if (hasMarkName(mark, name) && (!info || hasMarkIdentifier(mark, info))) {
          deleteMarkNode(mark);
          mark.style.transform += " scale(0.2)";
          ui.updatem(this);
          return;
        }
      }
    }
  }
};
export {
  markRenderMethods
};
