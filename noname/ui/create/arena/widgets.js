import "../../../../noname.js";
import { ui } from "../../index.js";
import { lib } from "../../../library/index.js";
import { get } from "../../../get/binding.js";
import { _status } from "../../../status/index.js";
import { game } from "../../../game/index.js";
function initArenaWidgets() {
  ui.time = ui.create.div(ui.gameinfo);
  const timeInterval = function() {
    const date = /* @__PURE__ */ new Date();
    const hours = date.getHours();
    const minuteValue = date.getMinutes();
    let minutes = minuteValue;
    const hourHand = ui.roundmenu.children[13];
    if (hourHand instanceof HTMLDivElement) {
      if (lib.config.watchface == "simple") {
        hourHand.style.transform = "rotate(" + get.round((hours + 9) * 30, 2) + "deg)";
      } else {
        hourHand.style.transform = "rotate(" + get.round((hours + minuteValue / 60 + 9) * 30, 2) + "deg)";
      }
    }
    const minuteHand = ui.roundmenu.children[12];
    if (minuteHand instanceof HTMLDivElement) {
      minuteHand.style.transform = "rotate(" + (minutes + 45) * 6 + "deg)";
    }
    if (minutes < 10) {
      minutes = "0" + minutes.toString();
    }
    ui.time.innerHTML = hours + ":" + minutes;
  };
  _status.timeInterval = setInterval(timeInterval, 3e4);
  timeInterval();
  if (!lib.config.show_time) {
    ui.time.style.display = "none";
  }
  const timer = ui.create.div(".skillbar.shadowed.playerbg.hidden");
  timer.id = "timer";
  ui.create.div(".skillbarshadow", timer);
  ui.create.div(".skillbarfill", timer);
  const fillnode = ui.create.div(timer.lastChild);
  const popnode = ui.create.div(".skillbartext", timer);
  popnode.style.opacity = "1";
  ui.timer = Object.assign(timer, {
    fillnode,
    popnode,
    position: 4,
    set(text, percentage) {
      if (typeof text === "string" || typeof text === "number") {
        popnode.innerHTML = String(text);
      }
      fillnode.style.top = (1 - percentage) * 100 + "%";
    }
  });
  ui.timer.style.zIndex = "5";
  const setTimerPosition = function() {
    if (!("position" in this) || typeof this.position !== "number") {
      return;
    }
    this.position++;
    if (this.position > 4) {
      this.position = 1;
    }
    let left1 = "180px";
    let left2 = "calc(100% - 245px)";
    let top1 = "210px";
    let top2 = "calc(100% - 245px)";
    if (game.layout == "default") {
      left1 = "265px";
      top1 = "160px";
      left2 = "calc(100% - 330px)";
      top2 = "calc(100% - 235px)";
    }
    if (this.position == 1 || this.position == 2) {
      this.style.top = top2;
    } else {
      this.style.top = top1;
    }
    if (this.position == 1 || this.position == 4) {
      this.style.left = left2;
    } else {
      this.style.left = left1;
    }
  };
  ui.timer.listen(setTimerPosition);
  const shortcut = ui.create.div("#shortcut.hidden", ui.window);
  shortcut.listen(ui.click.shortcut);
  ui.create.div(shortcut, function(e) {
    e.stopPropagation();
  });
  ui.create.div(".menubutton.round", "<span>重来</span>", shortcut, game.reload).dataset.position = "1";
  ui.create.div(".menubutton.round", "<span>退出</span>", shortcut, game.exit).dataset.position = "3";
  ui.create.div(".menubutton.round", "<span>记录</span>", shortcut, ui.click.pause).dataset.position = "4";
  const autobutton = ui.create.div(".menubutton.round", "<span>托管</span>", shortcut, ui.click.auto);
  autobutton.dataset.position = "2";
  ui.shortcut = Object.assign(shortcut, { autobutton });
  const updateFavouriteModeList = function() {
    const favouriteMode = lib.config.favouriteMode;
    let removed = false;
    for (let index = 0; index < favouriteMode.length; index++) {
      if (typeof favouriteMode[index] == "string") {
        continue;
      }
      favouriteMode.splice(index--, 1);
      if (!removed) {
        removed = true;
      }
    }
    if (removed) {
      game.saveConfigValue("favouriteMode");
    }
    this.innerHTML = "";
    favouriteMode.slice(0, 6).forEach((value, index) => this.add(value, index));
    let mode = lib.config.mode;
    const config = get.config(`${mode}_mode`);
    if (typeof config == "string") {
      mode += `|${config}`;
    }
    if (favouriteMode.includes(mode)) {
      ui.favmode.classList.add("glow");
    } else {
      ui.favmode.classList.remove("glow");
    }
  };
  const addFavouriteMode = function(name, index) {
    const info = name.split("|"), mode = info[0], submode = info[1], node = ui.create.div(".menubutton.large", this), dataset = node.dataset;
    dataset.type = Math.min(6, lib.config.favouriteMode.length) % 2 == 0 ? "even" : "odd";
    dataset.position = String(index);
    let str = lib.translate[name] || lib.translate[mode] || "";
    if (str.length == 2) {
      str += "模式";
    }
    node.innerHTML = str;
    node.listen(() => {
      game.saveConfig("mode", mode);
      if (submode) {
        game.saveConfig(`${mode}_mode`, submode, mode);
      }
      game.reload();
    });
  };
  ui.favmodelist = Object.assign(ui.create.div(".favmodelist", shortcut), {
    update: updateFavouriteModeList,
    add: addFavouriteMode
  });
  ui.favmode = ui.create.system("收藏", function() {
    const mode = typeof _status.mode == "string" ? `${lib.config.mode}|${_status.mode}` : lib.config.mode;
    if (this.classList.contains("glow")) {
      this.classList.remove("glow");
      lib.config.favouriteMode.remove(mode);
    } else {
      this.classList.add("glow");
      lib.config.favouriteMode.add(mode);
    }
    game.saveConfig("favouriteMode", lib.config.favouriteMode);
    ui.favmodelist.update();
    _status.clicked = true;
  });
  ui.favmode.style.display = "none";
  ui.favmodelist.update();
  return setTimerPosition;
}
export {
  initArenaWidgets
};
