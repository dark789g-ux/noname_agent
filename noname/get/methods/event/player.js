import "../../../../noname.js";
import "../../dependencies.js";
import { get } from "../../binding.js";
import { lib } from "../../../library/index.js";
import { _status } from "../../../status/index.js";
import { game } from "../../../game/index.js";
const eventPlayerMethods = {
  player() {
    return _status.event.player;
  },
  /**
   * 返回玩家的数组
   * @param {*} [sort]
   * @param { boolean } [dead] 包含死人
   * @param { boolean } [out] 包含移除游戏的人
   * @returns { Player[] }
   */
  players(sort, dead, out) {
    let players = game.players.slice(0);
    if (sort != false) {
      if (typeof sort == "function") {
        players.sort(sort);
      } else {
        players.sortBySeat(get.itemtype(sort) == "player" ? sort : _status.event.player);
      }
    }
    if (dead) {
      players = players.concat(game.dead);
    }
    if (!out) {
      players = players.filter((current) => !current.isOut());
    }
    return players;
  },
  evtDistance(e1, e2) {
    let dx = (e1.clientX - e2.clientX) / game.documentZoom;
    let dy = (e1.clientY - e2.clientY) / game.documentZoom;
    return Math.sqrt(dx * dx + dy * dy);
  },
  /**
   * 设置事件的提示文本；已有主提示时写入副提示。
   *
   * @param { GameEvent } next - 需要设置提示文本的事件
   * @param { string } str - 提示文本；以"###"开头时可拆分为prompt和prompt2
   * @returns { void }
   */
  evtprompt(next, str) {
    if (next.prompt) {
      next.set("prompt2", str);
    } else {
      if (str.startsWith("###")) {
        const prompts = str.slice(3).split("###");
        if (prompts[0]) {
          next.set("prompt", prompts[0]);
        }
        if (prompts[1]) {
          next.set("prompt2", prompts[1]);
        }
      } else {
        next.set("prompt", str);
      }
    }
  },
  mode() {
    return lib[_status.connectMode ? "configOL" : "config"].mode;
  },
  config(item, mode) {
    mode = mode || lib.config.mode;
    if (!lib.config.mode_config[mode]) {
      return;
    }
    return lib.config.mode_config[mode][item];
  },
  /**
   * 返回发动技能时的询问提示文本。
   *
   * @param { string } skill - 技能名
   * @param { Player } [target] - 技能目标
   * @param { Player | null } [player] - 发动技能的玩家，默认取当前事件玩家
   * @returns { string }
   */
  prompt(skill, target, player) {
    player ??= get.player();
    if (target) {
      let str = get.translation(target);
      if (target === player) {
        str += "（你）";
      }
      return `是否对${str}发动【${get.skillTranslation(skill, player)}】？`;
    }
    return `是否发动【${get.skillTranslation(skill, player)}】？`;
  },
  /**
   * 返回发动技能时的询问提示文本，并在存在技能描述时附加描述。
   *
   * @param { string } skill - 技能名
   * @param { Player } [target] - 技能目标
   * @param { Player | null } [player] - 发动技能的玩家，默认取当前事件玩家
   * @returns { string }
   */
  prompt2(skill, target, player) {
    const str = get.prompt(skill, target, player);
    if (!lib.translate[`${skill}_info`]) {
      return str;
    }
    return `###${str}###${lib.translate[`${skill}_info`]}`;
  }
};
export {
  eventPlayerMethods
};
