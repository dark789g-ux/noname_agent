import "../../../noname.js";
import { game } from "../../game/index.js";
import { lib } from "../index.js";
import { _status } from "../../status/index.js";
import { get } from "../../get/binding.js";
import { ui } from "../../ui/index.js";
function createCheatGame() {
  return {
    /**
     * 指定的玩家或自己立即获得诸葛连弩，青龙刀，八卦阵，的卢，赤兔，木牛
     * @param { Player } [target]
     */
    ge(target) {
      if (target) {
        lib.cheat.gx("zhuge", target);
        lib.cheat.gx("qinglong", target);
        lib.cheat.gx("bagua", target);
        lib.cheat.gx("dilu", target);
        lib.cheat.gx("chitu", target);
        lib.cheat.gx("muniu", target);
      } else {
        lib.cheat.g("zhuge");
        lib.cheat.g("qinglong");
        lib.cheat.g("bagua");
        lib.cheat.g("dilu");
        lib.cheat.g("chitu");
        lib.cheat.g("muniu");
      }
    },
    /**
     * 自己立即获得闪电，火山，洪水，乐不思蜀，鬼幽结
     */
    gj() {
      lib.cheat.g("shandian");
      lib.cheat.g("huoshan");
      lib.cheat.g("hongshui");
      lib.cheat.g("lebu");
      lib.cheat.g("bingliang");
      lib.cheat.g("guiyoujie");
    },
    /**
     * 自己立即获得所有食物牌各一张
     */
    gf() {
      for (let i in lib.card) {
        if (lib.card[i].type == "food") {
          lib.cheat.g(i);
        }
      }
    },
    /**
     * 自己立刻获取牌堆顶num张牌
     * @param { number } [num]
     * @param { Player } [target]
     */
    d(num = 1, target) {
      const me = game.getMe();
      const cards = get.cards(num);
      for (let i = 0; i < num; i++) {
        const card = cards[i];
        me.node.handcards1.appendChild(card);
        delete _status.event._buttonChoice;
        delete _status.event._cardChoice;
        delete _status.event._targetChoice;
        delete _status.event._skillChoice;
        game.check();
        me.update();
        ui.updatehl();
      }
    },
    /**
     * 给自己立刻添加一个或多个技能
     * @param {...string} args 技能名
     */
    s(...args) {
      const me = game.getMe();
      for (var i = 0; i < args.length; i++) {
        me.addSkill(args[i], true);
      }
      delete _status.event._buttonChoice;
      delete _status.event._cardChoice;
      delete _status.event._targetChoice;
      delete _status.event._skillChoice;
      game.check();
    },
    /**
     * 弃置指定位置玩家的所有牌
     *
     * 不传入num默认为弃置所有玩家的所有牌
     *
     * @param { number | Player } [num]
     */
    t(num) {
      if (num == void 0) {
        for (let i = 0; i < game.players.length; i++) {
          lib.cheat.t(i);
        }
        return;
      }
      const index = typeof num === "number" ? num : game.players.indexOf(num);
      const player = game.players[index];
      const cards = player.getCards("hej");
      for (let i = 0; i < cards.length; i++) {
        cards[i].discard();
      }
      player.removeEquipTrigger();
      player.update();
    },
    /**
     *  自己以外的其他玩家弃置所有牌
     */
    to() {
      game.players.filter((player) => player != game.me).forEach((_, i) => {
        lib.cheat.t(i);
      });
    },
    /**
     * 弃置自己所有牌
     */
    tm() {
      lib.cheat.t(game.getMe());
    },
    /**
     * 指定一个目标，弃置所有牌，血量变1，并且自己获得一张"juedou"
     * @param i 从自己开始算起，自己为0，不填默认1，即自己下家
     */
    k(i = 1) {
      game.players[i].hp = 1;
      lib.cheat.t(i);
      lib.cheat.g("juedou");
    },
    /**
     * 重新设置当前的主公的武将牌，且血量上限+1(不论当局人数是否大于3)
     * @param { string } name
     */
    z(name) {
      switch (name) {
        case "cc":
          name = "re_caocao";
          break;
        case "lb":
          name = "re_liubei";
          break;
        case "sq":
          name = "sunquan";
          break;
        case "dz":
          name = "dongzhuo";
          break;
        case "ys":
          name = "re_yuanshao";
          break;
        case "zj":
          name = "sp_zhangjiao";
          break;
        case "ls":
          name = "liushan";
          break;
        case "sc":
          name = "sunce";
          break;
        case "cp":
          name = "caopi";
          break;
        case "cr":
          name = "caorui";
          break;
        case "sx":
          name = "sunxiu";
          break;
        case "lc":
          name = "liuchen";
          break;
        case "sh":
          name = "sunhao";
          break;
      }
      game.zhu.init(name);
      game.zhu.maxHp = Number(game.zhu.maxHp) + 1;
      game.zhu.hp = Number(game.zhu.hp) + 1;
      game.zhu.update();
    }
  };
}
export {
  createCheatGame
};
