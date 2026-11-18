const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["../../../../_virtual/index6.js","../../../../_virtual/_commonjsHelpers.js","../../../../node_modules/.pnpm/nosleep.js@0.12.0/node_modules/nosleep.js/src/index.js","../../../../node_modules/.pnpm/nosleep.js@0.12.0/node_modules/nosleep.js/src/media.js"])))=>i.map(i=>d[i]);
import { __vitePreload } from "../../../../_virtual/preload-helper.js";
import "../../../../noname.js";
import { requireOnFree } from "../../../library/init/onfree.js";
import { initSystemBars } from "./systemBar.js";
import { initArenaWidgets } from "./widgets.js";
import { ui } from "../../index.js";
import { lib } from "../../../library/index.js";
import { get } from "../../../get/binding.js";
import { game } from "../../../game/index.js";
import { _status } from "../../../status/index.js";
function initArenaShellAndViewport() {
  ui.window = ui.create.div("#window.hidden", document.body);
  ui.create.div("#statusbg", document.body);
  ui.refresh(ui.window);
  if (!localStorage.getItem(lib.configprefix + "playback")) {
    ui.window.show();
  } else {
    setTimeout(function() {
      ui.window.show();
    }, 1e3);
  }
  ui.window.addEventListener(lib.config.touchscreen ? "touchend" : "click", ui.click.window);
  ui.system = ui.create.div("#system.", ui.window);
  ui.arena = Object.assign(ui.create.div("#arena.nome", ui.window), {
    setNumber(num) {
      this.dataset.number = String(num);
      ui.updatePlayerPositions();
    }
  });
  if (lib.device == "ios" && !get.is.phoneLayout()) {
    ui.arena.classList.add("ipad");
  }
  if (lib.config.low_performance) {
    ui.window.classList.add("low_performance");
  }
  if (game.layout == "mobile" || game.layout == "long") {
    ui.arena.classList.add("mobile");
  }
  if (game.layout == "long" || game.layout == "long2") {
    ui.arena.classList.add("long");
  }
  if (game.layout == "default") {
    ui.arena.classList.add("oldlayout");
  }
  if (lib.config.player_border != "wide" || game.layout == "long" || game.layout == "long2") {
    ui.arena.classList.add("slim_player");
  }
  if (lib.config.player_border == "slim") {
    ui.arena.classList.add("uslim_player");
  }
  if (lib.config.player_border == "narrow") {
    ui.arena.classList.add("mslim_player");
  }
  if (lib.config.player_border == "normal" && lib.config.mode != "brawl" && (game.layout == "long" || game.layout == "long2")) {
    ui.arena.classList.add("lslim_player");
  }
  ui.window.dataset.player_border = lib.config.player_border;
  ui.window.dataset.radius_size = lib.config.radius_size || "default";
  if (game.layout == "long" || game.layout == "mobile") {
    ui.arena.classList.add("textequip");
  }
  if (game.layout == "long" || game.layout == "long2" || game.layout == "mobile" || game.layout == "nova") {
    if (lib.config.cardshape == "oblong") {
      ui.window.classList.add("oblongcard");
      ui.arena.classList.add("oblongcard");
    }
  }
  if (lib.config.blur_ui) {
    ui.window.classList.add("blur_ui");
  }
  if (lib.config.glass_ui) {
    ui.window.classList.add("glass_ui");
  }
  if (lib.config.custom_button) {
    lib.configMenu.appearence.config.custom_button.onclick("skip");
  }
  if (lib.config.show_statusbar_ios == "overlay") {
    document.body.classList.add("statusbar");
  }
  if (lib.config.keep_awake) {
    if (window.plugins && window.plugins.insomnia) {
      window.plugins.insomnia.keepAwake();
    } else {
      __vitePreload(async () => {
        const { default: NoSleep } = await import("../../../../_virtual/index6.js").then((n) => n.i);
        return { default: NoSleep };
      }, true ? __vite__mapDeps([0,1,2,3]) : void 0, import.meta.url).then(function({ default: NoSleep }) {
        const noSleep = new NoSleep();
        document.addEventListener(
          lib.config.touchscreen ? "touchend" : "click",
          function enableNoSleep() {
            document.removeEventListener(lib.config.touchscreen ? "touchend" : "click", enableNoSleep, false);
            noSleep.enable();
            window.noSleep = noSleep;
          },
          false
        );
      });
    }
  }
  lib.init.js(lib.assetURL + "game", "keyWords", function() {
  });
  lib.updateURL = lib.updateURLS[lib.config.update_link] || lib.updateURLS.coding;
  lib.init.cssstyles();
  ui.arena.dataset.player_height = lib.config.player_height || "default";
  ui.arena.dataset.player_height_nova = lib.config.player_height_nova || "default";
  ui.arena.dataset.target_shake = lib.config.target_shake || "off";
  ui.backgroundMusic = document.createElement("audio");
  ui.backgroundMusic.volume = lib.config.volumn_background / 8;
  game.playBackgroundMusic();
  ui.backgroundMusic.autoplay = true;
  ui.backgroundMusic.addEventListener("ended", game.playBackgroundMusic);
  ui.window.appendChild(ui.backgroundMusic);
  ui.window.addEventListener(
    lib.config.touchscreen ? "touchend" : "click",
    () => {
      if (!ui.backgroundMusic.played.length && lib.config.background_music != "music_off" && !isNaN(ui.backgroundMusic.duration)) {
        ui.backgroundMusic.play();
      }
    },
    { once: true }
  );
  if (lib.config.cursor_style == "pointer") {
    ui.window.classList.add("nopointer");
  }
  if (lib.config.turned_style == false) {
    ui.arena.classList.add("hide_turned");
  }
  if (lib.config.link_style2 != "chain") {
    ui.arena.classList.add("nolink");
  }
  if (lib.config.show_name == false) {
    ui.arena.classList.add("hide_name");
  }
  if (lib.config.change_skin_auto != "off") {
    _status.skintimeout = setTimeout(ui.click.autoskin, parseInt(lib.config.change_skin_auto));
  }
  if (lib.config.border_style && lib.config.border_style.startsWith("dragon_")) {
    ui.arena.dataset.framedecoration = lib.config.border_style.slice(7);
  }
  ui.gameinfo = ui.create.div("#time", ui.window);
  ui.arenalog = ui.create.div("#arenalog", ui.arena);
  if (lib.config.show_log == "off") {
    ui.arenalog.style.display = "none";
  } else {
    ui.arenalog.dataset.position = lib.config.show_log;
  }
  ui.historybar = ui.create.div("#historybar.shadowed", ui.window);
  lib.setScroll(ui.historybar);
}
const createArenaMethods = {
  arena() {
    initArenaShellAndViewport();
    initSystemBars();
    const setTimerPosition = initArenaWidgets();
    if (_status.connectMode) {
      ui.playerids.remove();
      ui.pause.innerHTML = "记录";
    }
    setTimerPosition.call(ui.timer);
    ui.arena.appendChild(ui.timer);
    if (!game.syncMenu) {
      requireOnFree(lib.onfree).push(function() {
        ui.create.menu();
        ui.config2.classList.remove("hidden");
        ui.roundmenu.classList.remove("transparent2");
        setTimeout(function() {
          ui.config2.style.transition = "";
        }, 500);
      });
    } else {
      ui.create.menu();
    }
    lib.status.date = /* @__PURE__ */ new Date();
    lib.status.dateDelayed = 0;
    while (lib.arenaReady?.length) {
      lib.arenaReady.shift()?.();
    }
    delete lib.arenaReady;
    if (localStorage.getItem(lib.configprefix + "playback")) {
      setTimeout(lib.init.onfree);
    }
    if (lib.config.test_game) {
      ui.window.classList.add("testing");
      lib.config.game_speed = "vfast";
      lib.config.low_performance = true;
      lib.config.animation = false;
      _status.auto = true;
      const auto = ui.auto;
      if (!auto) {
        throw new Error("test game requires the auto control");
      }
      auto.classList.add("glow");
      setTimeout(function() {
        const pause = ui.create.pause();
        if (!pause) {
          throw new Error("test game requires a pause dialog");
        }
        const node = pause.addTempClass("start");
        node.appendChild(ui.sidebar);
        const message = node.firstElementChild;
        if (!(message instanceof HTMLElement)) {
          throw new Error("test game pause dialog must have a message node");
        }
        message.innerHTML = "正在测试";
        node.removeEventListener("click", ui.click.resume);
      }, 500);
    }
  }
};
export {
  createArenaMethods
};
