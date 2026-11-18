import { __vitePreload } from "../../../_virtual/preload-helper.js";
import "../../../noname.js";
import { cloneCardPileEntry } from "../card/cardMoveProducers.js";
import { game } from "../index.js";
import { _status } from "../../status/index.js";
import { ui } from "../../ui/index.js";
import { lib } from "../../library/index.js";
import { ai } from "../../ai/index.js";
import { get } from "../../get/binding.js";
const modeAndStartMethods = {
  /**
   * @todo deprecate
   */
  loadModeAsync(name, callback, onerror = (e) => console.error(e)) {
    let promise = (async () => {
      window.game = game;
      let exports$1;
      let isESM = true;
      try {
        exports$1 = await __vitePreload(() => import(
          /* @vite-ignore */
          `../../mode/${name}/index.js`
        ), true ? [] : void 0, import.meta.url);
      } catch {
        try {
          exports$1 = await __vitePreload(() => import(
            /* @vite-ignore */
            `../../mode/${name}.js`
          ), true ? [] : void 0, import.meta.url);
        } catch {
          isESM = false;
          await lib.init.promises.js(`${lib.assetURL}mode`, name);
        }
      }
      if (isESM) {
        if (!["object", "function"].includes(typeof exports$1.default)) {
          throw new Error(`导入的模式[${name}]格式不正确！`);
        }
        game.import("mode", exports$1.default);
      }
      if (_status.importing) await Promise.allSettled(_status.importing.mode);
      if (!lib.config.dev) {
        delete window.game;
      }
      const content = lib.imported && lib.imported.mode ? lib.imported.mode[name] : void 0;
      if (!content) {
        throw new Error(`导入的模式[${name}]格式不正确！`);
      }
      if (lib.imported && lib.imported.mode) {
        delete lib.imported.mode[name];
        if (get.is.empty(lib.imported.mode)) {
          delete lib.imported.mode;
        }
      }
      return content;
    })();
    if (callback) {
      promise = promise.then(callback, onerror);
    }
    return promise;
  },
  switchMode(name, configx) {
    if (!lib.layoutfixed.includes(name)) {
      if (lib.config.layout != game.layout) {
        lib.init.layout(lib.config.layout);
      } else if (lib.config.mode == "brawl") {
        if (lib.config.player_border == "normal" && (game.layout == "long" || game.layout == "long2")) {
          ui.arena.classList.add("lslim_player");
        }
      }
    }
    game.loadModeAsync(name, async (exports$1) => {
      _status.sourcemode = lib.config.mode;
      lib.config.mode = name;
      for (const i in exports$1.element) {
        if (!lib.element[i]) {
          lib.element[i] = [];
        }
        for (const j in exports$1.element[i]) {
          if (j == "init") {
            if (!lib.element[i].inits) {
              lib.element[i].inits = [];
            }
            lib.element[i].inits.push(exports$1.element[i][j]);
          } else {
            lib.element[i][j] = exports$1.element[i][j];
          }
        }
      }
      for (const i in exports$1.ai) {
        if (typeof exports$1.ai[i] == "object") {
          if (ai[i] == void 0) ai[i] = {};
          for (const j in exports$1.ai[i]) {
            ai[i][j] = exports$1.ai[i][j];
          }
        } else {
          ai[i] = exports$1.ai[i];
        }
      }
      for (const i in exports$1.ui) {
        if (typeof exports$1.ui[i] == "object") {
          if (ui[i] == void 0) ui[i] = {};
          for (const j in exports$1.ui[i]) {
            ui[i][j] = exports$1.ui[i][j];
          }
        } else {
          ui[i] = exports$1.ui[i];
        }
      }
      for (const i in exports$1.game) {
        game[i] = exports$1.game[i];
      }
      for (const i in exports$1.get) {
        get[i] = exports$1.get[i];
      }
      if (game.onwash) {
        lib.onwash.push(game.onwash);
        delete game.onwash;
      }
      if (game.onover) {
        lib.onover.push(game.onover);
        delete game.onover;
      }
      lib.config.banned = lib.config[lib.config.mode + "_banned"] || [];
      lib.config.bannedcards = lib.config[lib.config.mode + "_bannedcards"] || [];
      for (const i in exports$1) {
        if (["element", "game", "ai", "ui", "get", "config", "start", "startBefore"].includes(i)) {
          continue;
        }
        if (lib[i] == void 0) {
          lib[i] = Array.isArray(exports$1[i]) ? [] : {};
        }
        for (const j in exports$1[i]) {
          lib[i][j] = exports$1[i][j];
        }
      }
      _status.event = lib.element.GameEvent.initialGameEvent();
      _status.paused = false;
      if (_status.connectMode && lib.mode[name].connect) {
        game.saveConfig("connect_mode", name);
        game.clearConnect();
        lib.configOL.mode = name;
        if (configx) {
          for (const i in configx) {
            lib.configOL[i] = configx[i];
          }
        } else {
          for (const i in lib.mode[name].connect) {
            if (i == "update") continue;
            lib.configOL[i.slice(8)] = get.config(i);
          }
          lib.configOL.zhinang_tricks = lib.config.connect_zhinang_tricks;
          lib.configOL.characterPack = lib.connectCharacterPack.slice(0);
          lib.configOL.cardPack = lib.connectCardPack.slice(0);
          for (let i = 0; i < lib.config.connect_characters.length; i++) {
            lib.configOL.characterPack.remove(lib.config.connect_characters[i]);
          }
          for (let i = 0; i < lib.config.connect_cards.length; i++) {
            lib.configOL.cardPack.remove(lib.config.connect_cards[i]);
          }
          lib.configOL.banned = lib.config["connect_" + name + "_banned"];
          lib.configOL.bannedcards = lib.config["connect_" + name + "_bannedcards"];
        }
        lib.configOL.version = lib.versionOL;
        for (const i in lib.cardPackList) {
          if (lib.configOL.cardPack.includes(i)) {
            lib.card.list = lib.card.list.concat(lib.cardPackList[i]);
          }
        }
        for (let i = 0; i < lib.card.list.length; i++) {
          if (lib.card.list[i][2] == "huosha") {
            lib.card.list[i] = cloneCardPileEntry(lib.card.list[i]);
            lib.card.list[i][2] = "sha";
            lib.card.list[i][3] = "fire";
          } else if (lib.card.list[i][2] == "leisha") {
            lib.card.list[i] = cloneCardPileEntry(lib.card.list[i]);
            lib.card.list[i][2] = "sha";
            lib.card.list[i][3] = "thunder";
          }
          if (!lib.card[lib.card.list[i][2]]) {
            lib.card.list.splice(i, 1);
            i--;
          } else if (lib.card[lib.card.list[i][2]].mode && lib.card[lib.card.list[i][2]].mode.includes(lib.config.mode) == false) {
            lib.card.list.splice(i, 1);
            i--;
          }
        }
      }
      if (!lib.config.show_playerids || !game.showIdentity) {
        ui.playerids.style.display = "none";
      } else {
        ui.playerids.style.display = "";
      }
      if (exports$1.startBefore) {
        exports$1.startBefore();
      }
      game.createEvent("game", false).setContent(exports$1.start);
      if (lib.mode[lib.config.mode] && lib.mode[lib.config.mode].fromextension) {
        const startstr = exports$1.start.toString();
        if (startstr.indexOf("onfree") == -1) {
          setTimeout(lib.init.onfree, 500);
        }
      }
      if (!lib.db) {
        try {
          lib.storage = JSON.parse(localStorage.getItem(lib.configprefix + lib.config.mode) ?? "null");
          if (typeof lib.storage != "object" || lib.storage == null) {
            throw new Error("err");
          }
        } catch {
          lib.storage = {};
          localStorage.setItem(lib.configprefix + lib.config.mode, "{}");
        }
        game.loop();
      } else {
        game.getDB("data", lib.config.mode, (obj) => {
          lib.storage = obj || {};
          game.loop();
        });
      }
    });
  },
  /**
   * @todo deprecate
   */
  loadMode(mode) {
    const next = game.createEvent("loadMode", false);
    next.mode = mode;
    next.setContent("loadMode");
  },
  loadPackage(...args) {
    const next = game.createEvent("loadPackage");
    next.packages = [];
    for (let i = 0; i < args.length; i++) {
      if (typeof args[i] == "string") {
        next.packages.push(args[i]);
      }
    }
    next.setContent("loadPackage");
  },
  phaseLoop(player) {
    const next = game.createEvent("phaseLoop");
    next.player = player;
    next._isStandardLoop = true;
    next.setContent("phaseLoop");
    return next;
  },
  gameDraw(player = game.me, num = 4, targets = game.players) {
    const next = game.createEvent("gameDraw");
    const initialized = Object.assign(next, { player, num, targets });
    initialized.setContent("gameDraw");
    return initialized;
  },
  updateRoundNumber() {
    game.broadcastAll(
      (roundNumber, pileTop, pileNumber) => {
        if (game.roundNumber != roundNumber) {
          game.roundNumber = roundNumber;
        }
        if (_status.pileTop != pileTop) {
          _status.pileTop = pileTop;
        }
        ui.updateRoundNumber(roundNumber, pileNumber);
      },
      game.roundNumber,
      ui.cardPile.firstChild,
      ui.cardPile.childElementCount
    );
  },
  asyncDraw(players, num, drawDeck, bottom) {
    return Promise.all(
      players.map((player, index) => {
        let num2 = 1;
        if (typeof num === "number") {
          num2 = num;
        } else if (Array.isArray(num)) {
          num2 = num[index];
        } else if (typeof num === "function") {
          num2 = num(player);
        }
        if (drawDeck && drawDeck.drawDeck) {
          return player.draw(num2, false, drawDeck);
        }
        if (bottom) {
          return player.draw(num2, "nodelay", "bottom");
        }
        return player.draw(num2, "nodelay");
      })
    );
  },
  asyncDrawAuto(players, num, drawDeck) {
    if (players.length > 1) {
      Reflect.apply(game.asyncDraw, this, [players, num, drawDeck]);
      return;
    }
    let num2 = 1;
    if (typeof num == "number") {
      num2 = num;
    } else if (Array.isArray(num)) {
      num2 = num[0];
    } else if (typeof num == "function") {
      num2 = num(players[0]);
    }
    if (drawDeck && drawDeck.drawDeck) {
      players[0].draw(num2, drawDeck);
    } else {
      players[0].draw(num2);
    }
  }
};
export {
  modeAndStartMethods
};
