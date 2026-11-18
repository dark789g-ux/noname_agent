import "../../../noname.js";
import { lib } from "../../library/index.js";
import { game } from "../../game/index.js";
import { ui } from "../index.js";
import { get } from "../../get/binding.js";
import { _status } from "../../status/index.js";
function isControlNode(node) {
  return node instanceof lib.element.Control;
}
const controlAndJudgeLayoutMethods = {
  updatec() {
    if (_status.noupdatec) {
      return;
    }
    let length = 0;
    let minoffset = -Infinity;
    const controls = [];
    let widths = [];
    const leftwidths = [];
    const add = function(node, first) {
      let thiswidth = parseInt(node.style.width);
      if (thiswidth) {
        thiswidth += 8;
        length += thiswidth;
        if (first) {
          leftwidths.push(thiswidth);
        } else {
          widths.push(thiswidth);
        }
      } else {
        length += node.offsetWidth;
        if (first) {
          leftwidths.push(node.offsetWidth);
        } else {
          widths.push(node.offsetWidth);
        }
      }
      if (first) {
        controls.unshift(node);
      } else {
        controls.push(node);
      }
    };
    widths = leftwidths.concat(widths);
    const staylefts = [];
    for (const node of ui.control.children) {
      if (!isControlNode(node) || node.classList.contains("removing")) {
        continue;
      }
      if (lib.config.wuxie_right && node.stayleft) {
        staylefts.push(node);
      } else {
        add(node);
      }
    }
    if (staylefts.length) {
      let fullwidth = 0;
      const playerCount = Number.parseInt(ui.arena.dataset.number || "", 10);
      const fullright = game.layout == "long" || game.layout == "long2" || game.chess || game.layout != "nova" && playerCount <= 5;
      for (let i = 0; i < widths.length; i++) {
        fullwidth += widths[i] + 6;
        if (get.is.phoneLayout()) {
          fullwidth += 6;
        }
      }
      fullwidth /= 2;
      let currentLeft = 0;
      for (const stayleft of staylefts) {
        stayleft.currentLeft = currentLeft;
        fullwidth += stayleft.offsetWidth;
        currentLeft += stayleft.offsetWidth;
        if (get.is.phoneLayout()) {
          fullwidth += 18;
          currentLeft += 18;
        } else {
          fullwidth += 12;
          currentLeft += 12;
        }
      }
      if (fullright) {
        fullwidth += 124;
        if ((game.layout == "long2" || game.layout == "nova") && playerCount == 8 && get.mode() != "boss") {
          fullwidth += game.getMe().getLeft();
        }
      } else {
        fullwidth += 154;
      }
      for (const stayleft of staylefts) {
        const controlLeft = stayleft.currentLeft;
        if (typeof controlLeft != "number") {
          continue;
        }
        if (game.layout != "default") {
          const current_offset = stayleft._offset;
          if (fullright) {
            stayleft._offset = Math.ceil(-ui.arena.offsetWidth / 2) + 135;
            if ((game.layout == "long2" || game.layout == "nova") && playerCount == 8 && get.mode() != "boss") {
              stayleft._offset += game.getMe().getLeft();
            }
          } else {
            stayleft._offset = Math.ceil(-ui.arena.offsetWidth / 2) + 165;
          }
          stayleft._offset += controlLeft;
          if (current_offset != stayleft._offset) {
            stayleft.addTempClass("controlpressdownx", 500);
            stayleft.style.transform = "translateX(" + stayleft._offset + "px)";
          }
        } else {
          add(stayleft, true);
        }
      }
      if (staylefts.length && controls.length) {
        const last = staylefts[staylefts.length - 1];
        if (typeof last._offset == "number") {
          minoffset = last._offset + last.offsetWidth + (get.is.phoneLayout() ? 18 : 12);
        }
      }
    }
    if (!controls.length) {
      return;
    }
    let offset = -length / 2;
    if (minoffset > offset) {
      offset = minoffset;
    }
    const firstControl = controls.shift();
    if (!firstControl) {
      return;
    }
    if (firstControl._offset != offset) {
      firstControl.addTempClass("controlpressdownx", 500);
      firstControl.style.transform = "translateX(" + offset + "px)";
      firstControl._offset = offset;
    }
    while (controls.length) {
      const control = controls.shift();
      const width = widths.shift();
      if (!control || typeof width != "number") {
        break;
      }
      offset += width + 6;
      if (get.is.phoneLayout()) {
        offset += 6;
      }
      if (control._offset != offset) {
        control.addTempClass("controlpressdownx", 500);
        control.style.transform = "translateX(" + offset + "px)";
        control._offset = offset;
      }
    }
  },
  updatex() {
    ui.update();
    ui.updatehl();
    for (let i = 0; i < lib.onresize.length; i++) {
      lib.onresize[i]();
    }
    const cfg = game.documentZoom / game.deviceZoom;
    ui.updated();
    game.documentZoom = cfg * game.deviceZoom;
    ui.updatez();
    delete ui._updatexr;
  },
  updatexr() {
    if (ui._updatexr) {
      clearTimeout(ui._updatexr);
    }
    ui._updatexr = setTimeout(ui.updatex, 500);
  },
  updatejm(player, nodes, start, inv) {
    if (typeof start != "number") {
      start = 0;
    }
    let str;
    if (get.is.mobileMe(player) || game.layout == "default" || player.classList.contains("linked")) {
      str = "translateX(";
      if (inv) {
        str += "-";
      }
    } else {
      str = "translateY(";
    }
    for (let i = 0; i < nodes.childElementCount; i++) {
      const node = nodes.childNodes[i];
      if (i < start) {
        node.style.transform = "";
      } else if (node.classList.contains("removing")) {
        start++;
      } else {
        ui.refresh(node);
        node.classList.remove("drawinghidden");
        node._transform = str + (i - start) * 28 + "px)";
        node.style.transform = node._transform;
      }
    }
  },
  updatem(player) {
    if (player) {
      let start = 0;
      if (!player.classList.contains("linked2") || !ui.arena.classList.contains("nolink")) {
        start = 1;
      }
      ui.updatejm(player, player.node.marks, start, get.is.mobileMe(player));
    } else {
      for (let i = 0; i < game.players.length; i++) {
        ui.updatem(game.players[i]);
      }
    }
  },
  updatej(player) {
    if (player) {
      ui.updatejm(player, player.node.judges);
    } else {
      for (let i = 0; i < game.players.length; i++) {
        ui.updatej(game.players[i]);
      }
    }
  },
  updated() {
    if (document.documentElement.offsetWidth < 900 || document.documentElement.offsetHeight < 500) {
      game.deviceZoom = Math.min(Math.round(document.documentElement.offsetWidth / 98) / 10, Math.round(document.documentElement.offsetHeight / 50) / 10);
    } else {
      game.deviceZoom = 1;
    }
  },
  updatez() {
    const width = document.documentElement.offsetWidth;
    const height = document.documentElement.offsetHeight;
    const zoom = game.documentZoom;
    if (zoom != 1) {
      document.body.style.width = Math.round(width / zoom) + "px";
      document.body.style.height = Math.round(height / zoom) + "px";
      document.body.style.transform = "scale(" + Math.floor(zoom * 100) / 100 + ")";
    } else {
      document.body.style.width = width + "px";
      document.body.style.height = height + "px";
      document.body.style.transform = "";
    }
  }
};
export {
  controlAndJudgeLayoutMethods
};
