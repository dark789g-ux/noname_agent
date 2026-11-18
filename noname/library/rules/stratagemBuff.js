import "../../../noname.js";
import { get } from "../../get/binding.js";
import { game } from "../../game/index.js";
import { lib } from "../index.js";
function createStratagemBuff() {
  return {
    cost: /* @__PURE__ */ new Map([
      ["sha", 1],
      ["shan", 1],
      ["juedou", 2],
      ["huogong", 2],
      ["tao", 3]
    ]),
    // step hook
    effect: /* @__PURE__ */ new Map([
      [
        "sha",
        (event, option) => {
          if (event.step != 0 || option.state != "end") {
            return;
          }
          game.log(event.player, "触发了强化效果");
          game.log(
            event.card,
            "抵消所需要的",
            new lib.element.VCard({
              name: "shan"
            }),
            "数+1"
          );
          const map = event.customArgs;
          game.players.concat(game.dead).forEach((current) => {
            const id = String(current.playerid);
            if (!map[id]) {
              map[id] = {};
            }
            if (typeof map[id].shanRequired == "number") {
              map[id].shanRequired++;
            } else {
              map[id].shanRequired = 2;
            }
          });
        }
      ],
      [
        "shan",
        (event, option) => {
          if (event.step != 0 || option.state != "end") {
            return;
          }
          game.log(event.player, "触发了强化效果");
          game.log(
            "使用",
            event.card,
            "时视为两张",
            new lib.element.VCard({
              name: "shan"
            }),
            "的效果"
          );
          event.player.when("useCard").filter((evt) => evt == event).step(async (event2, trigger, player) => {
            const evt = trigger.getParent(2);
            if (!evt.shanRequired) {
              evt.shanRequired = 0;
            }
            evt.shanRequired--;
          });
        }
      ],
      [
        "juedou",
        (event, option) => {
          if (event.step != 0 || option.state != "end") {
            return;
          }
          game.log(event.player, "触发了强化效果");
          game.log("对", event.card, "的目标造成伤害时，伤害+1");
          event.player.when({
            source: "damageBegin1"
          }).filter((evt) => evt.getParent(2) == event && event.targets.includes(evt.player)).step(async (event2, trigger) => {
            trigger.num++;
          });
        }
      ],
      [
        "huogong",
        (event, option) => {
          if (event.step != 0 || option.state != "end") {
            return;
          }
          game.log(event.player, "触发了强化效果");
          game.log(event.card, "造成的伤害+1");
          event.baseDamage++;
        }
      ],
      [
        "tao",
        (event, option) => {
          if (event.step != 0 || option.state != "end") {
            return;
          }
          game.log(event.player, "触发了强化效果");
          game.log(event.card, "回复的体力+1");
          event.baseDamage++;
        }
      ]
    ]),
    prompt: /* @__PURE__ */ new Map([
      [
        "sha",
        /**
         * @type {() => string}
         */
        () => `抵消所需要的【${get.translation("shan")}】数+1。`
      ],
      [
        "shan",
        /**
         * @type {() => string}
         */
        () => `使用时视为两张【${get.translation("shan")}】的效果。`
      ],
      ["juedou", () => "对此牌的目标造成伤害时，伤害+1。"],
      ["huogong", () => "造成的伤害+1。"],
      ["tao", () => "回复的体力+1。"]
    ])
  };
}
export {
  createStratagemBuff
};
