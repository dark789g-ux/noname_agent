import "../../noname.js";
import { game } from "./index.js";
import { lib } from "../library/index.js";
class GameBroadcast {
  broadcastAll(func, ...args) {
    if (game.online) {
      return;
    }
    Reflect.apply(game.broadcast, game, [func, ...args]);
    const handler = typeof func === "string" ? lib.message.client[func] : func;
    if (typeof handler === "function") {
      Reflect.apply(handler, void 0, args);
    }
  }
}
export {
  GameBroadcast
};
