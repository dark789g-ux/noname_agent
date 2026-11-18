import "../../../../noname.js";
import { normalizeSelectionResult, applyLLMDecision } from "./selectionResults.js";
import { game } from "../../../game/index.js";
import { get } from "../../../get/binding.js";
import { lib } from "../../index.js";
import { _status } from "../../../status/index.js";
import { ui } from "../../../ui/index.js";
import { ai } from "../../../ai/index.js";
const discoverCardContent = {
  async discoverCard(event, trigger, player) {
    if (typeof event.result === "string") event.result = {};
    const { num = 3 } = event;
    let choice;
    if (typeof event.list == "string" || typeof event.list == "function") {
      choice = get.inpile(event.list).randomGets(num);
    } else if (Array.isArray(event.list)) {
      choice = event.list.randomGets(num);
    } else {
      choice = Array.from(event.list).randomGets(num);
    }
    if (!choice.length) {
      return;
    }
    let prompt = event.prompt;
    if (!prompt) {
      prompt = "选择一张牌";
      if (event.use) {
        prompt += "使用之";
      } else if (!event.nogain) {
        prompt += "获得之";
      }
    }
    let next;
    if (typeof choice[0] === "string") {
      next = player.chooseVCardButton(choice, prompt, event.forced);
      if (event.ai) {
        next.set("ai", event.ai);
      }
    } else if (get.itemtype(choice[0]) == "card") {
      next = player.chooseCardButton(choice, prompt, event.forced);
      if (event.ai) {
        next.set("ai", event.ai);
      }
    } else {
      return;
    }
    const result = await next.forResult();
    if (typeof result === "string" || !result.bool || !Array.isArray(result.links) || !result.links.length) {
      event.result = { bool: typeof result !== "string" && result.bool === true, card: void 0, choice: void 0 };
      return;
    }
    event.result = {
      bool: true,
      card: void 0,
      choice: void 0
    };
    if (result.links.length) {
      const link = result.links[0];
      let togain;
      if (get.itemtype(link) == "card") {
        event.result.card = link;
        togain = link;
      } else if (Array.isArray(link)) {
        const choiceName = link[2];
        if (typeof choiceName == "string") {
          event.result.choice = choiceName;
          togain = game.createCard(choiceName);
        }
      }
      if (togain) {
        if (event.use) {
          await player.chooseUseTarget({ card: togain });
        } else if (!event.nogain) {
          game.log(player, "获得了一张牌");
          await player.gain({ cards: [togain], animate: "draw" });
        }
      }
    }
  },
  chooseButton: [
    async (event, trigger, player) => {
      if (typeof event.dialog == "number") {
        event.dialog = get.idDialog(event.dialog);
      }
      if (event.createDialog && !event.dialog) {
        if (Array.isArray(event.createDialog)) {
          event.createDialog.add("hidden");
          event.dialog = ui.create.dialog.apply(void 0, event.createDialog);
        }
        event.closeDialog = true;
      }
      if (event.dialog == void 0) {
        event.dialog = ui.dialog;
      }
      if (event.isMine() || event.dialogdisplay) {
        event.dialog.style.display = "";
        event.dialog.open();
      }
      const filterButton = event.filterButton ?? (() => true);
      const selectButton = get.select(event.selectButton);
      const buttons = event.dialog.buttons;
      const buttonsx = [];
      let num = 0;
      for (const button of buttons) {
        if (filterButton(button, player)) {
          num++;
          buttonsx.add(button);
        }
      }
      if (event.isMine()) {
        if (event.hsskill && !event.forced && _status.prehidden_skills.includes(event.hsskill)) {
          ui.click.cancel();
          return;
        } else if (event.direct && num == selectButton[0] || event.forceDirect) {
          const buttons2 = buttonsx.slice(0, num);
          event.result = {
            bool: true,
            button: [buttons2],
            links: get.links(buttons2)
          };
          event.dialog.close();
        } else {
          ui.create.buttonChooseAll();
          game.check();
          game.pause();
        }
      } else if (event.isOnline()) {
        if (event.direct && num == 1 || event.forceDirect) {
          const buttons2 = buttonsx.slice(0, num);
          event.result = {
            bool: true,
            button: [buttons2],
            links: get.links(buttons2)
          };
          event.dialog.close();
        } else {
          event.send();
        }
        delete event.callback;
      } else {
        event.result = "ai";
      }
      if (event.onfree) {
        lib.init.onfree();
      }
    },
    async (event, trigger, player) => {
      const { forced } = event;
      if (event.result == "ai") {
        if (await applyLLMDecision(event)) {
        } else if (event.processAI) {
          event.result = event.processAI();
        } else {
          game.check();
          const aiResult = typeof event.ai == "function" ? ai.basic.chooseButton(event.ai) : false;
          if ((aiResult || forced) && (!event.filterOk || event.filterOk())) {
            ui.click.ok();
          } else {
            ui.click.cancel();
          }
        }
      }
      if (event.closeDialog) {
        event.dialog.close();
      }
      if (event.callback) {
        event.callback(event.player, event.result);
      }
      event.resume();
    }
  ],
  async chooseCardOL(event, trigger, player) {
    const targets = event.list;
    event.targets = targets.slice(0);
    const applySet = (next, set) => {
      for (const [key, value] of set) {
        next.set(key, value);
      }
      return next;
    };
    const chooseRemote = (args, set) => {
      const next = game.getMe().chooseCard(...args);
      for (const [key, value] of set) {
        next.set(key, value);
      }
      game.resume();
    };
    const chooseLocal = (current) => {
      return applySet(current.chooseCard(...event._args), event._set);
    };
    const resolveAiCard = (target) => {
      try {
        return event.aiCard ? event.aiCard(target) : { bool: false, cards: [] };
      } catch {
        return {};
      }
    };
    const choose = (current) => {
      return new Promise((resolve) => {
        if (current.isOnline()) {
          current.wait((result) => resolve(result ?? {}));
          current.send(chooseRemote, event._args, event._set);
          return;
        } else if (current === game.me) {
          const next = chooseLocal(game.getMe());
          game.getMe().wait((result) => resolve(result ?? {}));
          next.forResult().then((result) => game.getMe().unwait(result)).catch(() => resolve({}));
        } else {
          const next = chooseLocal(current);
          next.forResult().then(resolve).catch(() => resolve({}));
        }
      });
    };
    const toCardResult = (result, target) => {
      if (result === "ai") {
        return resolveAiCard(target);
      }
      if (result === "cancelled") {
        return { bool: false, cards: [] };
      }
      return result;
    };
    let results;
    if (_status.connectMode) {
      const events = targets.map(async (target) => {
        try {
          const result = await choose(target);
          return toCardResult(result, target);
        } catch {
          return {};
        }
      });
      results = await Promise.all(events);
    } else {
      results = [];
      for (const target of targets) {
        const result = await chooseLocal(target).forResult().catch(() => ({}));
        results.push(toCardResult(result, target));
      }
    }
    event.result = results;
  },
  async chooseButtonOL(event, trigger, player) {
    const list = event.list;
    const chooseRemote = (args, callback, switchToAuto, processAI) => {
      const next = game.getMe().chooseButton(...args);
      next.callback = callback;
      next.switchToAuto = switchToAuto;
      next.processAI = processAI;
      next.complexSelect = true;
      game.resume();
    };
    const chooseLocal = (current, args) => {
      const next = current.chooseButton(...args);
      next.callback = event.callback;
      next.switchToAuto = event.switchToAuto;
      next.processAI = event.processAI;
      return next;
    };
    const choose = (current, args) => {
      return new Promise((resolve) => {
        let settled = false;
        const finish = (result) => {
          if (settled) {
            return;
          }
          settled = true;
          resolve(result);
        };
        const chooseAuto = () => {
          if (settled) {
            return;
          }
          const next = chooseLocal(current, args);
          next.forResult().then((result) => finish(normalizeSelectionResult(result))).catch(() => finish({}));
        };
        if (current.isOnline()) {
          current.wait((result) => {
            if (result === "ai") {
              chooseAuto();
              return () => game.resume();
            }
            finish(result ?? {});
          });
          current.send(chooseRemote, args, event.callback, event.switchToAuto, event.processAI);
          return;
        } else if (current === game.me) {
          const next = chooseLocal(game.getMe(), args);
          game.getMe().wait((result) => finish(result ?? {}));
          next.forResult().then((result) => game.getMe().unwait(result)).catch(() => finish({}));
        } else {
          const next = chooseLocal(current, args);
          next.forResult().then((result) => finish(normalizeSelectionResult(result))).catch(() => finish({}));
        }
      });
    };
    let results;
    if (_status.connectMode) {
      const events = list.map(async ([target, ...args]) => {
        try {
          const result = await choose(target, args);
          return { target, result };
        } catch {
          return { target, result: {} };
        }
      });
      results = {};
      for (const { target, result } of await Promise.all(events)) {
        if (typeof target.playerid == "string") {
          results[target.playerid] = result === "cancelled" ? { bool: false, buttons: [] } : result;
        }
      }
    } else {
      results = {};
      for (const [target, ...args] of list) {
        const result = await chooseLocal(target, args).forResult().catch(() => ({}));
        if (typeof target.playerid == "string") {
          results[target.playerid] = result === "cancelled" ? { bool: false, buttons: [] } : result;
        }
      }
    }
    event.result = results;
  },
  async chooseAnyOL(event, trigger, player) {
    const { func, args } = event;
    const targets = event.getTargets();
    const map = /* @__PURE__ */ new Map();
    const locals = targets.slice();
    const humans = targets.filter((current) => current === game.me || current.isOnline());
    locals.removeArray(humans);
    const eventId = get.id();
    const send = (...sendArgs) => {
      const [func2, ...args2] = sendArgs;
      func2(...args2);
      game.resume();
    };
    event._global_waiting = true;
    let time = 1e4;
    if (lib.configOL && lib.configOL.choose_timeout) {
      time = parseInt(lib.configOL.choose_timeout) * 1e3;
    }
    targets.forEach((current) => current.showTimer(time));
    if (humans.length > 0) {
      const solve = (resolve, reject) => (result, player2) => {
        if (result) {
          map.set(player2, result);
        }
        resolve();
      };
      await Promise.all(
        humans.map(
          (current) => new Promise((resolve, reject) => {
            if (current.isOnline()) {
              current.send(send, func, current, ...args, eventId);
              current.wait(solve(resolve, reject));
            } else {
              const next = func(current, ...args, eventId);
              const solver = solve(resolve, reject);
              if (_status.connectMode) {
                game.getMe().wait(solver);
              }
              return next.forResult().then((result) => {
                if (_status.connectMode) {
                  game.getMe().unwait(result, current);
                } else {
                  solver(result, current);
                }
              });
            }
          })
        )
      ).catch(() => {
      });
      game.broadcastAll("cancel", eventId);
    }
    if (locals.length > 0) {
      for (const current of locals.randomSort()) {
        const result = await func(current, ...args, eventId).forResult();
        if (result) {
          map.set(current, result);
        }
      }
    }
    delete event._global_waiting;
    targets.forEach((current) => current.hideTimer(time));
    event.result = map;
  }
};
export {
  discoverCardContent
};
