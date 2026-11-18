import "../../../../noname.js";
import { game } from "../../../game/index.js";
import { ui } from "../../index.js";
import { _status } from "../../../status/index.js";
import { lib } from "../../../library/index.js";
import { get } from "../../../get/binding.js";
function openAvatarDetailCard(avatarNode, player, characterName, audioName) {
  if (!avatarNode._doubleClicking) {
    avatarNode._doubleClicking = true;
    setTimeout(function() {
      avatarNode._doubleClicking = false;
    }, 500);
    return;
  }
  game.pause2();
  ui.click.charactercard(characterName, null, null, true, avatarNode, audioName);
}
const gameplaySelectionMethods = {
  window() {
    const clicked = _status.clicked;
    let dialogtouched = false;
    if (_status.dialogtouched) {
      _status.dialogtouched = false;
      dialogtouched = true;
    }
    if (_status.dragged || _status.touchpopping || _status.reloading) {
      return;
    }
    if (_status.clicked || _status.clicked2) {
      _status.clicked = false;
      _status.clicked2 = false;
    } else {
      if (_status.clickingidentity) {
        for (let i = 0; i < _status.clickingidentity[1].length; i++) {
          _status.clickingidentity[1][i].delete();
          _status.clickingidentity[1][i].style.transform = "";
        }
        delete _status.clickingidentity;
      }
      if (!_status.event.isMine) {
        return;
      }
      if (ui.controls.length) {
        ui.updatec();
      }
      if (_status.editing) {
        if (_status.editing.innerHTML.length) {
          _status.editing.link = _status.editing.innerHTML;
        }
        _status.editing.innerHTML = get.translation(_status.editing.link);
        delete _status.editing;
      } else if (_status.choosing) {
        if (!_status.choosing.expand) {
          _status.choosing.parentNode.style.height = "";
          _status.choosing.nextSibling.delete();
          _status.choosing.previousSibling.show();
          delete _status.choosing;
        }
      } else if (ui.intro) {
        ui.intro.close();
        delete ui.intro;
        ui.control.show();
        game.resume2();
      } else if ((_status.event.isMine() || _status.event.forceMine) && !dialogtouched) {
        if (typeof _status.event.custom?.replace?.window == "function") {
          _status.event.custom.replace.window();
        } else if (_status.event.skill && _status.event.name == "chooseToUse") {
          ui.click.cancel();
        } else if (_status.event._checked) {
          game.uncheck();
          game.check();
        }
      }
      if (!ui.shortcut.classList.contains("hidden")) {
        ui.click.shortcut(false);
      }
      if (get.is.phoneLayout() && ui.menuContainer && ui.menuContainer.classList.contains("hidden")) {
        if (ui.system2.classList.contains("shown")) {
          _status.removinground = true;
          setTimeout(function() {
            _status.removinground = false;
          }, 200);
        }
        ui.arena.classList.remove("phonetop");
        ui.system1.classList.remove("shown");
        ui.system2.classList.remove("shown");
      }
    }
    if (_status.tempunpop) {
      _status.tempunpop = false;
    } else {
      game.closePopped();
    }
    if (typeof _status.event.custom?.add?.window == "function") {
      _status.event.custom.add.window(clicked);
    }
  },
  button() {
    if (_status.dragged || _status.clicked || _status.tempNoButton || _status.draggingtouchdialog || this.classList.contains("noclick") || _status.justdragged) {
      return;
    }
    _status.clicked = true;
    const custom = _status.event.custom;
    if (typeof custom?.replace?.button == "function") {
      custom.replace.button(this);
      return;
    }
    if (!_status.event.isMine() || !this.classList.contains("selectable")) {
      return;
    }
    if (this.classList.contains("selected")) {
      ui.selected.buttons.remove(this);
      this.classList.remove("selected");
      if (_status.multitarget || _status.event.complexSelect) {
        game.uncheck();
        game.check();
      }
    } else {
      this.classList.add("selected");
      ui.selected.buttons.add(this);
    }
    if (typeof custom?.add?.button == "function") {
      custom.add.button();
    }
    game.check();
  },
  card(mode) {
    delete this._waitingfordrag;
    if (_status.dragged || _status.clicked || ui.intro) {
      return;
    }
    _status.clicked = true;
    if (this.parentNode && (this.parentNode.classList.contains("judges") || this.parentNode.classList.contains("marks"))) {
      const rect = this.getBoundingClientRect();
      ui.click.touchpop();
      ui.click.intro.call(this, {
        clientX: rect.left + 18,
        clientY: rect.top + 12
      });
      _status.clicked = false;
      return;
    }
    const custom = _status.event.custom;
    if (typeof custom?.replace?.card == "function") {
      custom.replace.card(this);
      return;
    }
    if (!this.classList.contains("selectable")) {
      return;
    }
    if (this.classList.contains("selected")) {
      ui.selected.cards.remove(this);
      if (_status.multitarget || _status.event.complexSelect) {
        game.uncheck();
        game.check();
      } else {
        this.classList.remove("selected");
        this.updateTransform();
      }
    } else {
      ui.selected.cards.add(this);
      this.classList.add("selected");
      if (ui._handcardHover === this) {
        ui._handcardHover = null;
      }
      this.updateTransform(true);
    }
    if (game.chess && get.config("show_range") && !_status.event.skill && this.classList.contains("selected") && _status.event.isMine() && _status.event.name == "chooseToUse") {
      const player = _status.event.getPlayer();
      const range = get.info(this).range;
      if (range) {
        if (typeof range.attack === "number") {
          player.createRangeShadow(Math.min(8, player.getAttackRange(true) + range.attack - 1));
        } else if (typeof range.global === "number") {
          player.createRangeShadow(Math.min(8, player.getGlobalFrom() + range.global));
        }
      }
    }
    if (typeof custom?.add?.card == "function") {
      custom.add.card();
    }
    game.check();
    if (lib.config.popequip && get.is.phoneLayout() && mode != "popequip" && ui.arena && ui.arena.classList.contains("selecting") && this.parentNode && this.parentNode.classList.contains("popequip")) {
      const rect = this.getBoundingClientRect();
      ui.click.touchpop();
      ui.click.intro.call(this.parentNode, {
        clientX: rect.left + 18,
        clientY: rect.top + 12
      });
    }
  },
  avatar() {
    if (!lib.config.doubleclick_intro || this.parentNode.isUnseen(0) || !lib.character[String(this.parentNode.name)] || !ui.menuContainer) {
      return;
    }
    const player = this.parentNode;
    if (!game.players.includes(player) && !game.dead.includes(player)) {
      return;
    }
    const characterName = player.name1 || player.name;
    const audioName = player.skin?.name || characterName;
    openAvatarDetailCard(this, player, characterName, audioName);
  },
  avatar2() {
    if (!lib.config.doubleclick_intro || this.parentNode.classList.contains("unseen2")) {
      return;
    }
    const name2 = this.parentNode.name2;
    if (!name2 || !lib.character[name2] || !ui.menuContainer) {
      return;
    }
    const player = this.parentNode;
    if (!game.players.includes(player) && !game.dead.includes(player)) {
      return;
    }
    openAvatarDetailCard(this, player, name2, player.skin?.name2 || name2);
  },
  player(e) {
    return ui.click.target.call(this, e);
  },
  target(e) {
    if (_status.dragged || _status.clicked || ui.intro) {
      return;
    }
    if (this.classList.contains("connect")) {
      if (game.online) {
        if (game.onlinezhu && !this.playerid && game.connectPlayers) {
          if (lib.configOL.mode == "versus" || lib.configOL.mode == "doudizhu") {
            return;
          }
          if (lib.configOL.mode == "identity" && lib.configOL.identity_mode == "zhong") {
            return;
          }
          if (!this.classList.contains("unselectable2") && lib.configOL.number <= 2) {
            return;
          }
          this.classList.toggle("unselectable2");
          lib.configOL.number += this.classList.contains("unselectable2") ? -1 : 1;
          game.send("changeNumConfig", lib.configOL.number, game.connectPlayers.indexOf(this), this.classList.contains("unselectable2"));
        }
        return;
      }
      if (this.playerid) {
        if (this.ws && confirm("是否踢出" + this.nickname + "？")) {
          const onlineKey = this.ws.onlineKey;
          if (onlineKey && confirm("是否永久踢出(加入黑名单)？")) {
            const banBlacklist = lib.config.banBlacklist === void 0 ? [] : lib.config.banBlacklist;
            banBlacklist.push(onlineKey);
            game.saveConfig("banBlacklist", banBlacklist);
          }
          const id = get.id();
          this.ws.send(function(bannedId) {
            if (game.ws) {
              game.ws.close();
              game.saveConfig("reconnect_info");
              game.saveConfig("banned_info", bannedId);
            }
          }, id);
          lib.requireNodeServer().banned.push(id);
        }
      } else {
        if (lib.configOL.mode == "versus" || lib.configOL.mode == "doudizhu" || lib.configOL.mode == "single") {
          return;
        }
        if (lib.configOL.mode == "identity" && (lib.configOL.identity_mode == "zhong" || lib.configOL.identity_mode == "purple")) {
          return;
        }
        if (!this.classList.contains("unselectable2") && lib.configOL.number <= 2) {
          return;
        }
        this.classList.toggle("unselectable2");
        lib.configOL.number += this.classList.contains("unselectable2") ? -1 : 1;
        game.send("server", "config", lib.configOL);
        game.updateWaiting();
      }
      return;
    }
    _status.clicked = true;
    const custom = _status.event.custom;
    if (typeof custom?.replace?.target == "function") {
      custom.replace.target(this, e);
      return;
    }
    if (!this.classList.contains("selectable")) {
      return;
    }
    this.unprompt();
    if (this.classList.contains("selected")) {
      ui.selected.targets.remove(this);
      if (_status.multitarget || _status.event.complexSelect) {
        game.uncheck();
        game.check();
      } else {
        this.classList.remove("selected");
      }
    } else {
      ui.selected.targets.add(this);
      const currentEvent = _status.event;
      if (["chooseTarget", "chooseToUse", "chooseCardTarget", "chooseButtonTarget"].includes(currentEvent.name)) {
        let targetprompt = null;
        if (currentEvent.targetprompt) {
          targetprompt = currentEvent.targetprompt;
        } else if (currentEvent.skill && !get.info(currentEvent.skill).viewAs) {
          targetprompt = get.info(currentEvent.skill).targetprompt;
        } else if (currentEvent.name == "chooseToUse") {
          const currentcard = get.card();
          if (currentcard) {
            targetprompt = get.info(currentcard).targetprompt;
          }
        }
        if (targetprompt) {
          if (Array.isArray(targetprompt)) {
            const targets = ui.selected.targets.slice();
            let index = ui.selected.targets.indexOf(this);
            for (let i = 0; i < targetprompt.length; i++) {
              const target = targets.find((cur) => cur.node.prompt && cur.node.prompt.innerHTML === targetprompt[i]);
              if (target) {
                targets.remove(target);
              } else {
                index = i;
                break;
              }
            }
            targetprompt = targetprompt[Math.min(targetprompt.length - 1, index)];
          } else if (typeof targetprompt == "function") {
            targetprompt = targetprompt(this);
          }
          if (targetprompt && typeof targetprompt == "string") {
            this.prompt(targetprompt);
          }
        }
      }
      this.classList.add("selected");
    }
    if (typeof custom?.add?.target == "function") {
      custom.add.target();
    }
    game.check();
  }
};
export {
  gameplaySelectionMethods
};
