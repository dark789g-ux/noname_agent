import "../../../../noname.js";
import { ui } from "../../index.js";
import { game } from "../../../game/index.js";
import { _status } from "../../../status/index.js";
import { lib } from "../../../library/index.js";
import { get } from "../../../get/binding.js";
const hoverAndIntroMethods = {
  touchpop(forced) {
    if (lib.config.touchscreen || forced) {
      _status.touchpopping = true;
      clearTimeout(_status.touchpoppingtimeout);
      _status.touchpoppingtimeout = setTimeout(function() {
        _status.touchpopping = false;
      }, 600);
    }
  },
  buttonnameenter() {
    if (this.buttonscrollinterval) {
      clearInterval(this.buttonscrollinterval);
    }
    const node = this.node.name;
    if (node.offsetHeight < node.scrollHeight) {
      const that = this;
      let num = 40;
      that.buttonscrollinterval = setInterval(function() {
        if (node.scrollTop + node.offsetHeight >= node.scrollHeight) {
          clearInterval(that.buttonscrollinterval);
          delete that.buttonscrollinterval;
        } else if (num > 0) {
          num--;
        } else {
          node.scrollTop += 2;
        }
      }, 16);
    }
  },
  buttonnameleave() {
    if (this.buttonscrollinterval) {
      clearInterval(this.buttonscrollinterval);
    }
    const node = this.node.name;
    if (node.offsetHeight < node.scrollHeight) {
      const that = this;
      that.buttonscrollinterval = setInterval(function() {
        if (node.scrollTop == 0) {
          clearInterval(that.buttonscrollinterval);
          delete that.buttonscrollinterval;
        } else {
          node.scrollTop -= 2;
        }
      }, 16);
    }
  },
  hoverpopped() {
    if (this._uiintro || !this._poppedfunc) {
      return;
    }
    ui.click.touchpop(this.forceclick);
    const uiintro = this._poppedfunc();
    if (!uiintro) {
      return;
    }
    if (ui.currentpopped && ui.currentpopped._uiintro) {
      ui.currentpopped._uiintro.delete();
      delete ui.currentpopped._uiintro;
    }
    ui.currentpopped = this;
    uiintro.classList.add("popped");
    uiintro.classList.add("hoverdialog");
    uiintro.classList.add("static");
    this._uiintro = uiintro;
    ui.window.appendChild(uiintro);
    let width = this._poppedwidth || 330;
    uiintro.style.width = width + "px";
    if (get.is.phoneLayout()) {
      width *= 1.3;
    }
    if (uiintro._heightfixed) {
      uiintro.style.height = uiintro.content.scrollHeight + "px";
    } else {
      const height = this._poppedheight || uiintro.content.scrollHeight;
      const height2 = get.is.phoneLayout() ? (ui.window.offsetHeight - 80) / 1.3 : ui.window.offsetHeight - 260;
      uiintro.style.height = Math.min(height2, height) + "px";
    }
    uiintro.style.top = get.is.phoneLayout() ? "70px" : "50px";
    const parent = this.parentNode;
    if (!(parent instanceof HTMLElement)) {
      throw new TypeError("popped target parent is not an HTMLElement");
    }
    let left = parent.offsetLeft + this.offsetLeft + this.offsetWidth / 2 - width / 2;
    if (left < 10) {
      left = 10;
    } else if (left + width > ui.window.offsetWidth - 10) {
      left = ui.window.offsetWidth - width - 10;
    }
    uiintro.style.left = left + "px";
    uiintro._poppedorigin = this;
    if (!lib.config.touchscreen) {
      uiintro.addEventListener("mouseleave", ui.click.leavehoverpopped);
    }
    ui.click.shortcut(false);
    if (uiintro._onopen) {
      uiintro._onopen();
    }
    if (this._paused2 && !lib.config.touchscreen) {
      const intro = uiintro;
      game.pause2();
      uiintro.classList.add("static");
      const layer = ui.create.div(".poplayer", ui.window);
      const clicklayer = function(e) {
        intro.delete();
        layer.remove();
        game.resume2();
        e.stopPropagation();
        return false;
      };
      intro.style.zIndex = "21";
      layer.onclick = clicklayer;
      layer.oncontextmenu = clicklayer;
      intro.addEventListener("mouseleave", clicklayer);
      intro.addEventListener("click", clicklayer);
    }
  },
  hoverpopped_leave() {
    this._poppedalready = false;
  },
  leavehoverpopped() {
    if (_status.dragged || this.classList.contains("noleave")) {
      return;
    }
    this.delete();
    const button = this._poppedorigin;
    const uiintro = this;
    setTimeout(function() {
      if (button && button._uiintro == uiintro) {
        delete button._uiintro;
      }
    }, 500);
  },
  touchintro() {
    const rect = this.getBoundingClientRect();
    ui.click.touchpop();
    ui.click.intro.call(this, {
      clientX: rect.left + 18,
      clientY: rect.top + 12
    });
    _status.clicked = false;
  },
  intro(e) {
    if (_status.dragged) {
      return;
    }
    _status.clicked = true;
    if (this.classList.contains("player") && !this.name) {
      return;
    }
    if (this.parentNode == ui.historybar) {
      if (ui.historybar.style.zIndex == "22") {
        if (_status.removePop) {
          if (_status.removePop(this) == false) {
            return;
          }
        } else {
          return;
        }
      }
      ui.historybar.style.zIndex = "22";
    }
    let uiintro;
    const parent = this.parentElement;
    const owner = parent?.parentElement;
    if (this.classList.contains("card") && parent?.classList.contains("equips") && owner instanceof lib.element.Player && get.is.phoneLayout() && !get.is.mobileMe(owner)) {
      uiintro = get.nodeintro(owner, false, e);
    }
    uiintro = uiintro || get.nodeintro(this, false, e);
    if (!uiintro) {
      return;
    }
    const activeIntro = uiintro;
    activeIntro.classList.add("popped");
    activeIntro.classList.add("static");
    ui.window.appendChild(activeIntro);
    const layer = ui.create.div(".poplayer", ui.window);
    const clicklayer = function(evt) {
      if (_status.touchpopping) {
        return;
      }
      delete ui.throwEmotion;
      delete _status.removePop;
      game.closePoptipDialog();
      activeIntro.delete();
      this.remove();
      ui.historybar.style.zIndex = "";
      delete _status.currentlogv;
      if (!ui.arena.classList.contains("menupaused") && !activeIntro.noresume) {
        game.resume2();
      }
      if (evt && evt.stopPropagation) {
        evt.stopPropagation();
      }
      if (activeIntro._onclose) {
        activeIntro._onclose();
      }
      return false;
    };
    layer.addEventListener(lib.config.touchscreen ? "touchend" : "click", clicklayer);
    if (!lib.config.touchscreen) {
      layer.oncontextmenu = function(evt) {
        return clicklayer.call(layer, evt);
      };
    }
    if (this.parentNode == ui.historybar && lib.config.touchscreen) {
      const rect = this.getBoundingClientRect();
      e = { clientX: 0, clientY: rect.top + 30 };
    }
    lib.placePoppedDialog(activeIntro, e);
    if (this.parentNode == ui.historybar) {
      if (lib.config.show_history == "right") {
        activeIntro.style.left = ui.historybar.offsetLeft - 230 + "px";
      } else {
        activeIntro.style.left = ui.historybar.offsetLeft + 60 + "px";
      }
    }
    activeIntro.style.zIndex = "21";
    const clickintro = function(evt) {
      const relatedTarget = evt.relatedTarget;
      const poptip = relatedTarget?.parentNode?.parentNode;
      const target = evt.target;
      const isPoptip = target?.matches("noname-poptip") || poptip && poptip === _status.poptip?.[0];
      if (_status.touchpopping || isPoptip) {
        return;
      }
      delete _status.removePop;
      game.closePoptipDialog();
      layer.remove();
      this.delete();
      ui.historybar.style.zIndex = "";
      delete _status.currentlogv;
      if (!ui.arena.classList.contains("menupaused") && !activeIntro.noresume) {
        game.resume2();
      }
      if (activeIntro._onclose) {
        activeIntro._onclose();
      }
    };
    const currentpop = this;
    _status.removePop = function(node) {
      if (node == currentpop) {
        return false;
      }
      layer.remove();
      activeIntro.delete();
      delete _status.removePop;
      return true;
    };
    if (activeIntro.clickintro) {
      activeIntro.listen(function() {
        _status.clicked = true;
      });
      activeIntro._clickintro = clicklayer;
    } else if (!lib.config.touchscreen) {
      activeIntro.addEventListener("mouseleave", clickintro);
      activeIntro.addEventListener("click", clickintro);
    } else if (activeIntro.touchclose) {
      activeIntro.listen(clickintro);
    }
    activeIntro._close = clicklayer;
    game.pause2();
    return activeIntro;
  },
  intro2() {
    if (ui.intro) {
      ui.intro.close();
      if (ui.intro.source == this) {
        delete ui.intro;
        ui.control.show();
        game.resume2();
        return;
      }
    }
  }
};
export {
  hoverAndIntroMethods
};
