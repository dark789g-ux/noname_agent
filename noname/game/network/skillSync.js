import "../../../noname.js";
import { debounce } from "../../util/utils.js";
import { game } from "../index.js";
import { lib } from "../../library/index.js";
import { ui } from "../../ui/index.js";
import { get } from "../../get/binding.js";
const skillSyncDebounceByGame = /* @__PURE__ */ new WeakMap();
const skillRequestDebounceByGame = /* @__PURE__ */ new WeakMap();
const skillSyncTicks = /* @__PURE__ */ new WeakMap();
function getDebounceBucket(store, instance, skill) {
  let map = store.get(instance);
  if (!map) {
    map = {};
    store.set(instance, map);
  }
  return map[skill] ??= {};
}
const skillSyncMethods = {
  syncSkillData(skill, sync, ...args) {
    if ("observe" in game && game.observe) {
      return;
    }
    const bucket = getDebounceBucket(skillSyncDebounceByGame, game, skill);
    (bucket[sync] ??= debounce((...args2) => {
      game.send("dataSync", { type: "skill", name: skill, key: sync, args: args2 }, null);
    }))(...args);
  },
  requestSkillData(skill, sync, timeout, ...args) {
    if ("observe" in game && game.observe) {
      return Promise.resolve([false, null]);
    }
    if (!timeout || !Number.isFinite(timeout) || timeout <= 0) {
      timeout = 5e3;
    }
    const bucket = getDebounceBucket(skillRequestDebounceByGame, game, skill);
    return (bucket[sync] ??= debounce(
      (timeout2, ...args2) => {
        const id = (function() {
          while (true) {
            const id2 = Math.random().toString(36).slice(2);
            if (!(id2 in game.dataRequestMap)) {
              return id2;
            }
          }
        })();
        const { promise, resolve } = Promise.withResolvers();
        game.dataRequestMap[id] = (ok, result) => resolve([ok, result]);
        game.send("dataSync", { type: "skill", name: skill, key: sync, args: args2, timeout: timeout2 }, id);
        const timeoutPromise = new Promise((resolve2) => {
          setTimeout(() => {
            delete game.dataRequestMap[id];
            resolve2([false, game.SKILL_SYNC_RESULTS.REQUEST_TIMEOUT]);
          }, timeout2);
        });
        return Promise.any([promise, timeoutPromise]);
      },
      {
        delay: 500,
        failResult: [false, game.SKILL_SYNC_RESULTS.TOO_MANY_CALLS]
      }
    ))(timeout, ...args);
  },
  async respondSkillData(id, player, subject) {
    const { name: skill, key: sync, args, timeout } = subject;
    if (typeof skill !== "string" || typeof sync !== "string" || !Array.isArray(args) || typeof timeout !== "number") {
      return [false, game.SKILL_SYNC_RESULTS.INVALID_ARGUMENT];
    }
    const info = get.info(skill);
    if (!info) {
      return [false, game.SKILL_SYNC_RESULTS.MISSING_SKILL];
    }
    if (!lib.skill.global.includes(skill) && !player.hasSkill(skill, true, true, false)) {
      return [false, game.SKILL_SYNC_RESULTS.SKILL_NOT_GRANTED];
    }
    const syncList = info.sync;
    const targetFunction = syncList?.[sync];
    if (typeof targetFunction !== "function") {
      return [false, game.SKILL_SYNC_RESULTS.MISSING_SKILL_SYNC];
    }
    const ticksMap = skillSyncTicks.get(player);
    const lastTicks = ticksMap?.[skill]?.[sync] ?? NaN;
    if (!isNaN(lastTicks) && lastTicks > Date.now() - 500) {
      return [false, game.SKILL_SYNC_RESULTS.TOO_MANY_REQUESTS];
    }
    const newTicksMap = ticksMap ?? {};
    const newSkillTicks = newTicksMap[skill] ?? (newTicksMap[skill] = {});
    newSkillTicks[sync] ??= Date.now();
    skillSyncTicks.set(player, newTicksMap);
    return [true, await targetFunction.call(syncList, player, ...args, timeout)];
  },
  sendTo(id, message) {
    return new lib.element.Client(new lib.element.NodeWS(id), true).send(message);
  },
  createServer() {
    lib.startNodeServer();
    lib.playerOL = {};
    lib.cardOL = {};
    lib.vcardOL = {};
    lib.wsOL = {};
    ui.create.roomInfo();
    ui.create.chat();
    if (game.onlineroom) {
    } else {
      const WebSocketServer = require("ws").Server;
      const wss = new WebSocketServer({ port: 8080 });
      game.ip = get.ip();
      wss.on("connection", lib.init.connection);
    }
  }
};
export {
  skillSyncMethods
};
