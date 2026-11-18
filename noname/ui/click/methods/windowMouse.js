import "../../../../noname.js";
import { isDraggingDialog } from "../contracts/domTargetsContract.js";
import { _status } from "../../../status/index.js";
import { game } from "../../../game/index.js";
import { ui } from "../../index.js";
import { get } from "../../../get/binding.js";
import { lib } from "../../../library/index.js";
const windowMouseMethods = {
  windowmousewheel(e) {
    _status.tempunpopup = e;
  },
  windowmousemove(e) {
    if (window.inSplash) {
      return;
    }
    if (_status.tempunpopup && get.evtDistance(_status.tempunpopup, e) > 5) {
      delete _status.tempunpopup;
    }
    if (e.button == 2) {
      return;
    }
    const dialogs = document.querySelectorAll("#window>.dialog.popped:not(.static)");
    for (let i = 0; i < dialogs.length; i++) {
      dialogs[i].delete();
    }
    const node = _status.currentmouseenter;
    let sourceitem = document.elementFromPoint(e.clientX, e.clientY);
    if (game.chess && ui.selected.cards.length) {
      const itemtype = get.itemtype(sourceitem);
      if (itemtype != "card" && itemtype != "button") {
        for (let i = 0; i < game.players.length; i++) {
          const ex = e.clientX / game.documentZoom - ui.arena.offsetLeft;
          const ey = e.clientY / game.documentZoom - ui.arena.offsetTop;
          const left = -ui.chessContainer.chessLeft + ui.chess.offsetLeft + game.players[i].getLeft();
          const top = -ui.chessContainer.chessTop + ui.chess.offsetTop + game.players[i].getTop();
          const width = game.players[i].offsetWidth;
          const height = game.players[i].offsetHeight;
          if (ex > left && ex < left + width && ey > top && ey < top + height) {
            sourceitem = game.players[i];
            break;
          }
        }
      }
    }
    let item = sourceitem;
    if (_status.mousedragging) {
      e.preventDefault();
      if (lib.config.enable_dragline) {
        ui.canvas.width = ui.arena.offsetWidth;
        ui.canvas.height = ui.arena.offsetHeight;
        const ctx = ui.canvas.getContext("2d");
        if (ctx) {
          ctx.shadowBlur = 5;
          ctx.shadowColor = "rgba(0,0,0,0.3)";
          ctx.strokeStyle = "white";
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 2]);
          ctx.beginPath();
          ctx.moveTo(_status.mousedragging.clientX / game.documentZoom - ui.arena.offsetLeft, _status.mousedragging.clientY / game.documentZoom - ui.arena.offsetTop);
          if (_status.multitarget) {
            for (let i = 0; i < _status.lastdragchange.length; i++) {
              const exy = _status.lastdragchange[i]._lastdragchange;
              ctx.lineTo(exy[0], exy[1]);
            }
          }
          if (!_status.selectionfull) {
            ctx.lineTo(e.clientX / game.documentZoom - ui.arena.offsetLeft, e.clientY / game.documentZoom - ui.arena.offsetTop);
          }
          ctx.stroke();
        }
        if (ctx && !_status.multitarget) {
          for (let i = 0; i < _status.lastdragchange.length; i++) {
            ctx.moveTo(_status.mousedragging.clientX / game.documentZoom - ui.arena.offsetLeft, _status.mousedragging.clientY / game.documentZoom - ui.arena.offsetTop);
            const exy = _status.lastdragchange[i]._lastdragchange;
            ctx.lineTo(exy[0], exy[1]);
            ctx.stroke();
          }
        }
      }
      while (item) {
        if (!(item instanceof HTMLElement)) {
          item = item.parentElement;
          continue;
        }
        if (item == _status.mousedragorigin) {
          if (_status.mouseleft) {
            _status.mousedragging = null;
            _status.mousedragorigin = null;
            _status.clicked = false;
            if (_status.event.type == "phase" && !_status.event.skill && ui.confirm) {
              ui.confirm.classList.add("removing");
            }
            game.uncheck();
            game.check();
            _status.clicked = true;
          }
          return;
        }
        const itemtype = get.itemtype(item);
        if (itemtype == "card" || itemtype == "button" || itemtype == "player") {
          _status.mouseleft = true;
          if (ui.selected.cards.length) {
            ui.selected.cards[0].updateTransform(true, 100);
          }
          let ex = e.clientX / game.documentZoom - ui.arena.offsetLeft;
          let ey = e.clientY / game.documentZoom - ui.arena.offsetTop;
          const exx = ex;
          const eyy = ey;
          if (game.chess) {
            ex -= -ui.chessContainer.chessLeft + ui.chess.offsetLeft;
            ey -= -ui.chessContainer.chessTop + ui.chess.offsetTop;
          }
          if (itemtype != "player" || game.chess || ex > item.offsetLeft && ex < item.offsetLeft + item.offsetWidth && ey > item.offsetTop && ey < item.offsetTop + item.offsetHeight) {
            let targetfixed = false;
            if (itemtype == "player" && get.select(_status.event.selectTarget)[1] <= -1) {
              targetfixed = true;
            }
            if (!targetfixed && item.classList.contains("selectable") && _status.dragstatuschanged != item) {
              _status.mouseleft = true;
              _status.dragstatuschanged = item;
              _status.clicked = false;
              const notbefore = itemtype == "player" && !item.classList.contains("selected");
              if (itemtype == "card" && item instanceof lib.element.Card) {
                ui.click.card.call(item);
              } else if (itemtype == "button" && item instanceof HTMLDivElement) {
                ui.click.button.call(item);
              } else if (itemtype == "player" && item instanceof lib.element.Player) {
                ui.click.player.call(item);
              }
              if (item.classList.contains("selected")) {
                if (notbefore) {
                  _status.lastdragchange.push(item);
                  const dragItem = item;
                  dragItem._lastdragchange = [exx, eyy];
                }
              } else {
                _status.lastdragchange.remove(item);
              }
              _status.selectionfull = true;
              if (_status.event.filterButton && ui.selected.buttons.length < get.select(_status.event.selectButton)[1]) {
                _status.selectionfull = false;
              } else if (_status.event.filterCard && ui.selected.cards.length < get.select(_status.event.selectCard)[1]) {
                _status.selectionfull = false;
              } else if (_status.event.filterTarget && ui.selected.targets.length < get.select(_status.event.selectTarget)[1]) {
                _status.selectionfull = false;
              }
            }
          }
          return;
        }
        item = item.parentElement;
      }
      if (!_status.mouseleft) {
        _status.mouseleft = true;
        game.check();
        for (let i = 0; i < ui.selected.cards.length; i++) {
          ui.selected.cards[i].updateTransform(true);
        }
      }
      _status.dragstatuschanged = null;
    } else {
      while (item) {
        if (item == node && !node._mouseentercreated) {
          ui.click.mouseentercancel();
          let hoveration;
          if (typeof node._hoveration == "number") {
            hoveration = node._hoveration;
          } else {
            hoveration = parseInt(lib.config.hoveration);
            if (node.classList.contains("button") || (node.parentNode && node.parentNode.parentNode) == ui.me) {
              hoveration += 500;
            }
          }
          _status._mouseentertimeout = setTimeout(function() {
            if (!node || _status.currentmouseenter != node || node._mouseentercreated || _status.tempunpopup || _status.mousedragging || _status.mousedown || !node.offsetWidth || !node.offsetHeight) {
              return;
            }
            if (node._hoverfunc && !node._nopup) {
              const dialog = node._hoverfunc.call(node, e);
              if (dialog) {
                dialog.classList.add("popped");
                ui.window.appendChild(dialog);
                lib.placePoppedDialog(dialog, e);
                if (node._hoverwidth) {
                  dialog.style.width = node._hoverwidth + "px";
                  dialog._hovercustomed = true;
                }
                node._mouseenterdialog = dialog;
                node._mouseentercreated = true;
              }
            }
          }, hoveration);
          break;
        }
        item = item.parentElement;
      }
      if (_status.draggingdialog) {
        const ddialog = _status.draggingdialog;
        if (ddialog._dragorigin && ddialog._dragtransform) {
          const translate = ddialog._dragtransform.slice(0);
          translate[0] += e.clientX / game.documentZoom - ddialog._dragorigin.clientX / game.documentZoom;
          translate[1] += e.clientY / game.documentZoom - ddialog._dragorigin.clientY / game.documentZoom;
          ui.click.checkdialogtranslate(translate, ddialog);
        }
        _status.clicked = true;
      }
      if (_status.draggingroundmenu) {
        if (ui.roundmenu._dragorigin && ui.roundmenu._dragtransform) {
          const translate = ui.roundmenu._dragtransform.slice(0);
          translate[0] += e.clientX / game.documentZoom - ui.roundmenu._dragorigin.clientX / game.documentZoom;
          translate[1] += e.clientY / game.documentZoom - ui.roundmenu._dragorigin.clientY / game.documentZoom;
          ui.click.checkroundtranslate(translate);
        }
        _status.clicked = true;
      }
    }
  },
  windowmousedown(e) {
    if (window.inSplash || !ui.window || e.button == 2) {
      return;
    }
    _status.mousedown = true;
    const dialogs = ui.window.querySelectorAll("#window>.dialog.popped:not(.static)");
    for (let i = 0; i < dialogs.length; i++) {
      dialogs[i].delete();
    }
    const sourceitem = document.elementFromPoint(e.clientX, e.clientY);
    let item = sourceitem;
    while (item) {
      const itemtype = get.itemtype(item);
      if (itemtype == "button") {
        break;
      }
      if (isDraggingDialog(item, itemtype) && !item.classList.contains("popped") && !item.classList.contains("fixed")) {
        const ddialog = item;
        _status.draggingdialog = ddialog;
        ddialog._dragorigin = e;
        if (!ddialog._dragtransform) {
          ddialog._dragtransform = [0, 0];
        }
        return;
      }
      if (item == ui.roundmenu) {
        _status.draggingroundmenu = true;
        ui.roundmenu._dragorigin = e;
        if (!ui.roundmenu._dragtransform) {
          ui.roundmenu._dragtransform = [0, 0];
        }
        return;
      }
      item = item.parentElement;
    }
    const evt = _status.event;
    if (!lib.config.enable_drag || !ui.arena.classList.contains("selecting") || !evt.isMine()) {
      return;
    }
    item = sourceitem;
    while (item) {
      const itemtype = get.itemtype(item);
      if (itemtype == "card" || itemtype == "button" || itemtype == "player") {
        if (item.classList.contains("selectable") && !item.classList.contains("selected") && !item.classList.contains("noclick")) {
          _status.clicked = false;
          if (itemtype == "card" && item instanceof lib.element.Card) {
            ui.click.card.call(item);
          } else if (itemtype == "button" && item instanceof HTMLDivElement) {
            ui.click.button.call(item);
          } else if (itemtype == "player" && item instanceof lib.element.Player) {
            ui.click.player.call(item);
          }
          if (item.classList.contains("selected")) {
            _status.mousedragging = e;
            if (item instanceof HTMLDivElement) {
              _status.mousedragorigin = item;
            }
            _status.mouseleft = false;
            _status.selectionfull = false;
            _status.multitarget = false;
            _status.lastmouseutc = get.utc();
            ui.arena.classList.add("dragging");
          }
        }
        return;
      }
      item = item.parentElement;
    }
  },
  windowmouseup(e) {
    delete _status.force;
    if (window.inSplash) {
      return;
    }
    if (_status.draggingdialog) {
      const ddialog = _status.draggingdialog;
      let translate;
      const dragTransform = ddialog._dragtransform;
      if (ddialog._dragorigin && dragTransform) {
        translate = dragTransform;
        dragTransform[0] += e.clientX / game.documentZoom - ddialog._dragorigin.clientX / game.documentZoom;
        dragTransform[1] += e.clientY / game.documentZoom - ddialog._dragorigin.clientY / game.documentZoom;
        ui.click.checkdialogtranslate(null, ddialog);
        delete ddialog._dragorigin;
      }
      game.saveConfig("dialog_transform", translate);
      delete _status.draggingdialog;
    }
    if (_status.draggingroundmenu) {
      let translate;
      if (ui.roundmenu._dragorigin && ui.roundmenu._dragtransform) {
        const dx = e.clientX / game.documentZoom - ui.roundmenu._dragorigin.clientX / game.documentZoom;
        const dy = e.clientY / game.documentZoom - ui.roundmenu._dragorigin.clientY / game.documentZoom;
        if (dx * dx + dy * dy < 25) {
          ui.click.roundmenu();
        }
        translate = ui.roundmenu._dragtransform;
        translate[0] += dx;
        translate[1] += dy;
        ui.click.checkroundtranslate();
        delete ui.roundmenu._dragorigin;
      }
      game.saveConfig("roundmenu_transform", translate);
      delete _status.draggingroundmenu;
    }
    if (e.button == 2) {
      if (_status.mousedragging) {
        _status.mousedragging = null;
        _status.mouseleft = false;
        _status.mousedragorigin = null;
        _status.dragstatuschanged = false;
        game.uncheck();
        game.check();
        _status.noright = true;
      }
    } else {
      let tmpflag = false;
      _status.mousedown = false;
      for (let i = 0; i < ui.selected.cards.length; i++) {
        ui.selected.cards[i].updateTransform(true);
      }
      if (_status.mousedragging && _status.mouseleft) {
        if (game.check()) {
          if (ui.confirm) {
            ui.confirm.close();
          }
          const event = _status.event;
          if (!event.filterOk || event.filterOk()) {
            ui.click.ok();
          }
        } else {
          game.uncheck();
          game.check();
        }
      } else if (_status.mousedragging && _status.mousedragorigin) {
        tmpflag = _status.mousedragorigin;
      }
      _status.lastdragchange.length = 0;
      _status.mousedragging = null;
      _status.mouseleft = false;
      _status.mousedragorigin = null;
      _status.dragstatuschanged = false;
      if (ui.arena) {
        ui.canvas.width = ui.arena.offsetWidth;
        ui.canvas.height = ui.arena.offsetHeight;
      }
      if (tmpflag) {
        const click = ui.click;
        const itemType = get.itemtype(tmpflag);
        click[itemType === void 0 ? "undefined" : itemType].call(tmpflag);
        game.check();
      }
    }
    if (ui.arena) {
      ui.arena.classList.remove("dragging");
    }
  }
};
export {
  windowMouseMethods
};
