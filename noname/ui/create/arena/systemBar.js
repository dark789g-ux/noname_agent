import "../../../../noname.js";
import { requireOnFree } from "../../../library/init/onfree.js";
import { initDeckMonitor } from "./deckMonitor.js";
import { ui } from "../../index.js";
import { lib } from "../../../library/index.js";
import { get } from "../../../get/binding.js";
import { _status } from "../../../status/index.js";
import { game } from "../../../game/index.js";
function initRoundMenu() {
  const roundMenuInitialState = { _position: [180, 210] };
  ui.roundmenu = Object.assign(ui.create.div("#roundmenu.roundarenabutton.menubutton.round", ui.arena), roundMenuInitialState);
  for (let i = 0; i < 15; i++) {
    ui.create.div(ui.roundmenu);
  }
  if (lib.config.show_time2) {
    ui.roundmenu.classList.add("clock");
  }
  ui.roundmenu.dataset.watchface = lib.config.watchface || "none";
  let time3Node;
  if (get.is.phoneLayout()) {
    if (lib.config.show_time3) {
      time3Node = ui.create.div(".touchinfo.left", ui.window);
    }
    ui.cardPileNumber = ui.create.div(".touchinfo.right", ui.window);
  } else {
    if (lib.config.show_time3) {
      time3Node = ui.create.div(ui.gameinfo);
    }
    ui.cardPileNumber = ui.create.div(ui.gameinfo);
  }
  if (!lib.config.show_cardpile_number) {
    ui.cardPileNumber.style.display = "none";
  }
  if (get.is.phoneLayout()) {
    ui.aiModeIndicator = ui.create.div(".touchinfo.right.ai-mode-indicator", ui.window);
  } else {
    ui.aiModeIndicator = ui.create.div(".ai-mode-indicator", ui.gameinfo);
  }
  ui.updateAIModeIndicator();
  const time3 = time3Node;
  if (time3) {
    const starttime = get.utc();
    const interval = setInterval(function() {
      const num = Math.round((get.utc() - starttime) / 1e3);
      if (num >= 3600) {
        const num1 = Math.floor(num / 3600);
        const num2 = Math.floor((num - num1 * 3600) / 60);
        const num2Text = num2 < 10 ? "0" + num2 : num2.toString();
        const num3 = num - num1 * 3600 - num2 * 60;
        const num3Text = num3 < 10 ? "0" + num3 : num3.toString();
        time3.innerHTML = num1 + ":" + num2Text + ":" + num3Text;
      } else {
        const num1 = Math.floor(num / 60);
        const num2 = num - num1 * 60;
        const num2Text = num2 < 10 ? "0" + num2 : num2.toString();
        time3.innerHTML = num1 + ":" + num2Text;
      }
    }, 1e3);
    ui.time3 = Object.assign(time3, { starttime, interval });
  }
  if (get.is.nomenu("", false)) {
    if (!["menu", "system"].includes(lib.config.round_menu_func)) {
      lib.config.round_menu_func = "system";
    }
  } else if (!lib.config.show_round_menu) {
    ui.roundmenu.style.display = "none";
  }
  const resetround = function(e) {
    _status.draggingroundmenu = false;
    ui.roundmenu.style.transform = "";
    ui.roundmenu._dragtransform = [0, 0];
    ui.roundmenu.style.transition = "all 0.3s";
    delete ui.roundmenu._dragtouches;
    delete ui.roundmenu._dragorigin;
    delete ui.roundmenu._dragorigintransform;
    setTimeout(function() {
      ui.roundmenu.style.transition = "";
    }, 500);
    game.saveConfig("roundmenu_transform", [0, 0]);
    if (e) {
      e.stopPropagation();
    }
    return false;
  };
  ui.click.resetround = resetround;
  if (lib.config.touchscreen) {
    ui.roundmenu.addEventListener("touchstart", function(e) {
      _status.draggingroundmenu = true;
      ui.roundmenu._dragorigin = {
        clientX: e.touches[0].clientX,
        clientY: e.touches[0].clientY
      };
      if (!ui.roundmenu._dragtransform) {
        ui.roundmenu._dragtransform = [0, 0];
      }
      ui.roundmenu._dragorigintransform = [...ui.roundmenu._dragtransform];
      ui.roundmenu._resetTimeout = setTimeout(function() {
        resetround();
        delete ui.roundmenu._resetTimeout;
      }, 1e3);
    });
  } else {
    ui.roundmenu.oncontextmenu = resetround;
  }
  if (!lib.config.remember_round_button) {
    game.saveConfig("roundmenu_transform", void 0);
  }
  if (lib.config.roundmenu_transform) {
    const translate = lib.config.roundmenu_transform;
    ui.roundmenu._dragtransform = translate;
    ui.roundmenu.style.transform = "translate(" + translate[0] + "px," + translate[1] + "px)";
    ui.click.checkroundtranslate();
  }
}
function initSystemBars() {
  initRoundMenu();
  if (get.is.phoneLayout()) {
    ui.arena.classList.add("phone");
  }
  ui.sidebar = ui.create.div("#sidebar");
  ui.sidebar3 = ui.create.div("#sidebar3");
  ui.canvas = document.createElement("canvas");
  ui.arena.appendChild(ui.canvas);
  ui.canvas.id = "canvas";
  const context = ui.canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to initialize the canvas rendering context");
  }
  ui.ctx = context;
  ui.sidebar.ontouchstart = (event) => ui.click.touchStart.call(ui.sidebar, event);
  ui.sidebar.ontouchmove = (event) => ui.click.touchScroll.call(ui.sidebar, event);
  ui.sidebar.style.setProperty("-webkit-overflow-scrolling", "touch");
  let zoom = Number.parseInt(lib.config.ui_zoom);
  if (isNaN(zoom) || zoom < 50 || zoom > 300) {
    zoom = 100;
    game.saveConfig("ui_zoom", `${zoom}%`);
  }
  game.documentZoom = game.deviceZoom * zoom / 100;
  zoom !== 100 && ui.updatez();
  if (get.mode() === "doudizhu") {
    if (typeof get.config("choice_zhu", "doudizhu") !== "number") {
      game.saveConfig("choice_zhu", 5, "doudizhu");
    }
    if (typeof get.config("choice_fan", "doudizhu") !== "number") {
      game.saveConfig("choice_fan", 3, "doudizhu");
    }
  }
  ui.system1 = ui.create.div("#system1", ui.system);
  ui.system2 = ui.create.div("#system2", ui.system);
  ui.replay = ui.create.system("重来", game.reload, true);
  ui.replay.id = "restartbutton";
  ui.config2 = ui.create.system("选项", ui.click.config);
  ui.pause = ui.create.system("暂停", ui.click.pause);
  ui.pause.id = "pausebutton";
  if (!_status.video) {
    ui.pause.hide();
  }
  if (!lib.config.touchscreen) {
    lib.setPopped(ui.pause, ui.click.pausehistory, 220, 400, null, true);
  }
  if (!lib.config.show_pause) {
    ui.pause.style.display = "none";
  }
  ui.cardPileButton = ui.create.system("牌堆", null, true);
  ui.cardPileButton.style.display = "none";
  lib.setPopped(ui.cardPileButton, ui.click.cardPileButton, 220);
  ui.commonCardPileButton = ui.create.system("公共区域", null, true);
  ui.commonCardPileButton.style.display = "none";
  lib.setPopped(ui.commonCardPileButton, ui.click.commonCardPileButton, 220);
  ui.wuxie = ui.create.system("不询问无懈", ui.click.wuxie, true);
  if (!lib.config.touchscreen) {
    lib.setPopped(ui.config2, ui.click.pauseconfig, 170);
  }
  ui.auto = ui.create.system("托管", ui.click.auto);
  if (!game.syncMenu) {
    ui.config2.classList.add("hidden");
    ui.config2.style.transition = "all 0.5s";
    ui.roundmenu.classList.add("transparent2");
    ui.auto.style.opacity = "0.5";
    ui.auto.style.transition = "all 0.5s";
    requireOnFree(lib.onfree).push(function() {
      ui.auto.style.opacity = "";
      setTimeout(function() {
        ui.auto.style.transition = "";
      }, 500);
    });
  }
  ui.auto.id = "autobutton";
  ui.autonode = ui.create.div("#autonode", "<div>托管中...</div>", ui.arena);
  ui.autonode.listen(ui.click.auto);
  if (lib.config.mode == "connect") {
    ui.auto.hide();
    ui.pause.hide();
  }
  if (lib.forcehide) {
    for (const key of ["replay", "auto", "pause", "wuxie", "cardPileButton"]) {
      if (lib.forcehide.includes(key)) {
        ui[key].classList.add("forcehide");
      }
    }
  }
  ui.volumn = ui.create.system("♫");
  lib.setPopped(ui.volumn, ui.click.volumn, 200);
  if (!lib.config.show_volumn) {
    ui.volumn.style.display = "none";
  }
  if (!lib.config.show_auto) {
    ui.auto.style.display = "none";
  }
  if (!lib.config.show_wuxie) {
    ui.wuxie.style.display = "none";
  }
  ui.sortCard = ui.create.system("整理手牌", function() {
    if (!game.me) {
      return;
    }
    const sort = Reflect.get(_status, "tempHandcardSort");
    game.me.sortHandcardOL(sort);
  });
  if (!lib.config.show_sortcard) {
    ui.sortCard.style.display = "none";
  }
  initDeckMonitor();
  ui.playerids = ui.create.system(
    "显示身份",
    function() {
      if (game.showIdentity) {
        game.showIdentity();
        _status.identityShown = true;
      }
    },
    true
  );
  if (!lib.config.show_playerids || !game.showIdentity) {
    ui.playerids.style.display = "none";
  }
  if (!lib.config.show_replay) {
    ui.replay.style.display = "none";
  }
  ui.control = ui.create.div("#control", ui.arena).addTempClass("nozoom");
  ui.cardPile = ui.create.div("#cardPile");
  ui.discardPile = ui.create.div("#discardPile");
  ui.special = ui.create.div("#special");
  ui.ordering = ui.create.div("#ordering");
  ui.dialogs = [];
  ui.controls = [];
  ui.style = {};
}
export {
  initSystemBars
};
