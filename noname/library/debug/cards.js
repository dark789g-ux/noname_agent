import "../../../noname.js";
import { ui } from "../../ui/index.js";
import { game } from "../../game/index.js";
import { lib } from "../index.js";
import { get } from "../../get/binding.js";
function createCheatCards() {
  return {
    /**
     * 替换皮肤
     * @param { string } name 武将名称
     * @param { number | true } [i] 指定game.players的第几个元素，不填指定为自己的下家。为true时切换玩家布局
     * @param { string } [skin] 皮肤id
     */
    p(name, i, skin) {
      const list = ["swd", "hs", "pal", "gjqt", "ow", "gw"];
      if (!lib.character[name]) {
        for (let j = 0; j < list.length; j++) {
          if (lib.character[list[j] + "_" + name]) {
            name = list[j] + "_" + name;
            break;
          }
        }
      }
      let target;
      if (typeof i == "number") {
        target = game.players[i];
      } else {
        target = game.getMe().next;
      }
      if (!target) {
        throw new Error("The requested player does not exist.");
      }
      if (!lib.character[name]) {
        target.node.avatar.setBackground(name, "character");
        target.node.avatar.show();
      } else {
        target.init(name);
      }
      if (skin) {
        lib.config.skin[name] = Number(skin) - 1;
        ui.click.skin(target.node.avatar, name);
      }
      if (i === true) {
        if (lib.config.layout == "long2") {
          lib.init.layout("mobile");
        } else {
          lib.init.layout("long2");
        }
      }
    },
    /**
     * 不传参数默认装备麒麟弓，八卦阵，的卢，赤兔，木牛；也可指定玩家或卡牌名。
     * @param  {...(Player | string)} args 玩家或卡牌名
     * @returns { void }
     */
    e(...args) {
      let cards = [];
      let target = void 0;
      for (let i = 0; i < arguments.length; i++) {
        if (get.itemtype(arguments[i]) == "player") {
          target = arguments[i];
        } else {
          cards.push(game.createCard(arguments[i]));
        }
      }
      if (!cards.length) {
        cards.push(game.createCard("qilin"));
        cards.push(game.createCard("bagua"));
        cards.push(game.createCard("dilu"));
        cards.push(game.createCard("chitu"));
        cards.push(game.createCard("muniu"));
      }
      target = target || game.getMe();
      for (let i = 0; i < cards.length; i++) {
        const card = target.getEquip(cards[i]);
        if (card) {
          card.discard();
          target.removeEquipTrigger(card);
        }
        target.$equip(cards[i]);
      }
    },
    /**
     * 检测当前游戏开启的武将数，卡堆的数量分布情况
     */
    c() {
      const log = function(...args) {
        console.log(...args);
        game.print(...args);
      };
      (function() {
        let a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0;
        let sa = 0, sb = 0, sc = 0, sd = 0, se = 0, sf = 0, sg = 0;
        for (let i in lib.character) {
          switch (lib.character[i][1]) {
            case "wei":
              a++;
              if (lib.config.banned.includes(i)) {
                sa++;
              }
              break;
            case "shu":
              b++;
              if (lib.config.banned.includes(i)) {
                sb++;
              }
              break;
            case "wu":
              c++;
              if (lib.config.banned.includes(i)) {
                sc++;
              }
              break;
            case "qun":
              d++;
              if (lib.config.banned.includes(i)) {
                sd++;
              }
              break;
            case "jin":
              g++;
              if (lib.config.banned.includes(i)) {
                sg++;
              }
              break;
            case "western":
              e++;
              if (lib.config.banned.includes(i)) {
                se++;
              }
              break;
            case "key":
              f++;
              if (lib.config.banned.includes(i)) {
                sf++;
              }
              break;
          }
        }
        log("魏：" + (a - sa) + "/" + a);
        log("蜀：" + (b - sb) + "/" + b);
        log("吴：" + (c - sc) + "/" + c);
        log("群：" + (d - sd) + "/" + d);
        log("晋：" + (g - sg) + "/" + g);
        log("西：" + (e - se) + "/" + e);
        log("键：" + (f - sf) + "/" + f);
        log("已启用：" + (a + b + c + d + e + f - (sa + sb + sc + sd + se + sf)) + "/" + (a + b + c + d + e + f));
      })();
      (function() {
        let a = 0, b = 0, c = 0, d = 0;
        let aa = 0, bb = 0, cc = 0, dd = 0;
        let sa = 0, sb = 0, sc = 0, sd = 0;
        let sha = 0, shan = 0, tao = 0, jiu = 0, wuxie = 0, heisha = 0, hongsha = 0;
        let num = {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
          6: 0,
          7: 0,
          8: 0,
          9: 0,
          10: 0,
          11: 0,
          12: 0,
          13: 0
        };
        for (let i in lib.card) {
          if (get.objtype(lib.card[i]) == "object" && lib.translate[i + "_info"]) {
            switch (lib.card[i].type) {
              case "basic":
                a++;
                break;
              case "trick":
                b++;
                break;
              case "equip":
                c++;
                break;
              default:
                d++;
                break;
            }
          }
        }
        for (let i = 0; i < lib.card.list.length; i++) {
          if (typeof lib.card[lib.card.list[i][2]] == "object") {
            switch (lib.card[lib.card.list[i][2]].type) {
              case "basic":
                aa++;
                break;
              case "trick":
              case "delay":
                bb++;
                break;
              case "equip":
                cc++;
                break;
              default:
                dd++;
                break;
            }
            switch (lib.card.list[i][0]) {
              case "heart":
                sa++;
                break;
              case "diamond":
                sb++;
                break;
              case "club":
                sc++;
                break;
              case "spade":
                sd++;
                break;
            }
            if (lib.card.list[i][2] == "sha") {
              sha++;
              if (lib.card.list[i][0] == "club" || lib.card.list[i][0] == "spade") {
                heisha++;
              } else {
                hongsha++;
              }
            }
            if (lib.card.list[i][2] == "shan") {
              shan++;
            }
            if (lib.card.list[i][2] == "tao") {
              tao++;
            }
            if (lib.card.list[i][2] == "jiu") {
              jiu++;
            }
            if (lib.card.list[i][2] == "wuxie") {
              wuxie++;
            }
            num[lib.card.list[i][1]]++;
          }
        }
        let str = "基本牌" + aa + "； 锦囊牌" + bb + "； 装备牌" + cc + "； 其它牌" + dd;
        log(str);
        str = "红桃牌" + sa + "； 方片牌" + sb + "； 梅花牌" + sc + "； 黑桃牌" + sd;
        log(str);
        str = "杀" + sha + "； 黑杀" + heisha + "； 红杀" + hongsha + "； 闪" + shan + "； 桃" + tao + "； 酒" + jiu + "； 无懈" + wuxie;
        log(str);
        if (arguments[1]) {
          for (let i = 1; i <= 13; i++) {
            if (i < 10) {
              log(i + " ", num[i]);
            } else {
              log(i, num[i]);
            }
          }
        }
        let arr = [];
        for (let i = 1; i <= 13; i++) {
          arr.push(num[i]);
        }
        log(a + b + c + d + "/" + (aa + bb + cc + dd), ...arr);
      })();
    },
    /**
     * 显示场上所有的角色的身份
     */
    id() {
      game.showIdentity?.();
    },
    /**
     * 替换dialog中待选择的卡牌(或其他东西)对应的真实卡牌(或其他东西)
     * ```js
     * // 在神吕蒙涉猎时使用:
     * // 涉猎如果选择l第一张牌，那你获得的是你创造的这张杀
     * lib.cheat.b(game.createCard('sha'));
     * ```
     */
    b(...args) {
      if (!ui.dialog || !ui.dialog.buttons) {
        return;
      }
      for (let i = 0; i < Math.min(args.length, ui.dialog.buttons.length); i++) {
        ui.dialog.buttons[i].link = args[i];
      }
    }
  };
}
export {
  createCheatCards
};
