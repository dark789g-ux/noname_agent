import "../../../noname.js";
import "../skillRegistry.js";
import { get } from "../../get/binding.js";
import { lib } from "../index.js";
const cooperationSkills = {
  cooperation: {
    charlotte: true,
    trigger: {
      global: ["phaseAfter", "dieAfter"]
    },
    forced: true,
    lastDo: true,
    filter: function(event, player) {
      const eventPlayer = event.player;
      if (event.name == "die" && event.getPlayer().isAlive()) {
        return false;
      }
      if (!eventPlayer) {
        return false;
      }
      var storage = player.getStorage("cooperation");
      for (var info of storage) {
        if (info.target == eventPlayer) {
          return true;
        }
      }
      return false;
    },
    async content(event, trigger, player) {
      for (var i = 0; i < player.storage.cooperation.length; i++) {
        var info = player.storage.cooperation[i];
        if (info.target == trigger.player) {
          player.removeCooperation(info);
          i--;
        }
      }
    },
    onremove: function(player, skill) {
      var storage = player.getStorage(skill);
      var reasons = [];
      for (var i of storage) {
        reasons.add(i.type);
      }
      for (var i of reasons) {
        player.removeSkill(skill + "_" + i);
      }
      delete player.storage[i];
    },
    subSkill: {
      damage: {
        mark: true,
        trigger: { global: "damage" },
        forced: true,
        charlotte: true,
        popup: false,
        nopop: true,
        firstDo: true,
        filter: function(event, player) {
          if (!event.source) {
            return false;
          }
          var storage = player.getStorage("cooperation");
          for (var info of storage) {
            if (info.type == "damage" && (event.source == player || event.source == info.target)) {
              return true;
            }
          }
          return false;
        },
        checkx: (info) => info.damage && info.damage > 3,
        async content(event, trigger, player) {
          var source = trigger.source;
          var storage = player.getStorage("cooperation");
          for (var info of storage) {
            if (info.type == "damage" && (source == player || source == info.target)) {
              if (!info.damage) {
                info.damage = 0;
              }
              info.damage += trigger.num;
            }
          }
          player.markSkill("cooperation_damage");
        },
        marktext: "仇",
        intro: {
          name: "协力 - 同仇",
          markcount: function(storage, player) {
            return Math.max.apply(
              Math,
              player.getStorage("cooperation").map(function(info) {
                return info.damage || 0;
              })
            );
          },
          content: function(storage, player) {
            var str = "", storage = player.getStorage("cooperation");
            for (var info of storage) {
              if (info.type == "damage") {
                str += "<br><li>协力角色：" + get.translation(info.target);
                str += "<br><li>协力原因：" + get.translation(info.reason);
                str += "<br><li>协力进度：";
                var num = info.damage || 0;
                str += num;
                str += "/4";
                str += num > 3 ? " (已完成)" : " (未完成)";
                str += "<br>　　";
              }
            }
            return str.slice(4, str.length - 6);
          }
        }
      },
      draw: {
        mark: true,
        trigger: { global: "gainAfter" },
        forced: true,
        charlotte: true,
        popup: false,
        nopop: true,
        firstDo: true,
        filter: function(event, player) {
          if (event.getParent().name != "draw") {
            return false;
          }
          var storage = player.getStorage("cooperation");
          for (var info of storage) {
            if (info.type == "draw" && (event.player == player || event.player == info.target)) {
              return true;
            }
          }
          return false;
        },
        checkx: (info) => info.draw && info.draw > 7,
        async content(event, trigger, player) {
          var source = trigger.player;
          var storage = player.getStorage("cooperation");
          for (var info of storage) {
            if (info.type == "draw" && (source == player || source == info.target)) {
              if (!info.draw) {
                info.draw = 0;
              }
              info.draw += trigger.cards.length;
            }
          }
          player.markSkill("cooperation_draw");
        },
        marktext: "进",
        intro: {
          name: "协力 - 并进",
          markcount: function(storage, player) {
            return Math.max.apply(
              Math,
              player.getStorage("cooperation").map(function(info) {
                return info.draw || 0;
              })
            );
          },
          content: function(storage, player) {
            var str = "", storage = player.getStorage("cooperation");
            for (var info of storage) {
              if (info.type == "draw") {
                str += "<br><li>协力角色：" + get.translation(info.target);
                str += "<br><li>协力原因：" + get.translation(info.reason);
                str += "<br><li>协力进度：";
                var num = info.draw || 0;
                str += num;
                str += "/8";
                str += num > 7 ? " (已完成)" : " (未完成)";
                str += "<br>　　";
              }
            }
            return str.slice(4, str.length - 6);
          }
        }
      },
      discard: {
        mark: true,
        trigger: { global: "loseAfter" },
        forced: true,
        charlotte: true,
        popup: false,
        nopop: true,
        firstDo: true,
        filter: function(event, player) {
          if (event.type != "discard") {
            return false;
          }
          var storage = player.getStorage("cooperation");
          for (var info of storage) {
            if (info.type == "discard" && (event.player == player || event.player == info.target)) {
              return true;
            }
          }
          return false;
        },
        checkx: (info) => info.discard && info.discard.length > 3,
        async content(event, trigger, player) {
          var source = trigger.player;
          var storage = player.getStorage("cooperation");
          for (var info of storage) {
            if (info.type == "discard" && (source == player || source == info.target)) {
              if (!info.discard) {
                info.discard = [];
              }
              for (var i of trigger.cards2) {
                var suit = get.suit(i, player);
                if (suit != null && lib.suit.includes(suit)) {
                  info.discard.add(suit);
                }
              }
            }
          }
          player.markSkill("cooperation_discard");
        },
        marktext: "财",
        intro: {
          name: "协力 - 疏财",
          markcount: function(storage, player) {
            return Math.max.apply(
              Math,
              player.getStorage("cooperation").map(function(info) {
                return info.discard ? info.discard.length : 0;
              })
            );
          },
          content: function(storage, player) {
            var str = "", storage = player.getStorage("cooperation");
            for (var info of storage) {
              if (info.type == "discard") {
                str += "<br><li>协力角色：" + get.translation(info.target);
                str += "<br><li>协力原因：" + get.translation(info.reason);
                str += "<br><li>进度：";
                var suits = info.discard || [];
                var suits2 = [
                  ["spade", "♠", "♤"],
                  ["heart", "♥", "♡"],
                  ["club", "♣", "♧"],
                  ["diamond", "♦", "♢"]
                ];
                for (var i of suits2) {
                  str += suits.includes(i[0]) ? i[1] : i[2];
                }
                str += suits.length > 3 ? " (已完成)" : " (未完成)";
                str += "<br>　　";
              }
            }
            return str.slice(4, str.length - 6);
          }
        }
      },
      use: {
        mark: true,
        trigger: { global: "useCard1" },
        forced: true,
        charlotte: true,
        popup: false,
        nopop: true,
        firstDo: true,
        filter: function(event, player) {
          var suit = get.suit(event.card);
          if (suit == null || !lib.suit.includes(suit)) {
            return false;
          }
          var storage = player.getStorage("cooperation");
          for (var info of storage) {
            if (info.type == "use" && (event.player == player || event.player == info.target) && (!info.used || !info.used.includes(suit))) {
              return true;
            }
          }
          return false;
        },
        checkx: (info) => info.used && info.used.length > 3,
        async content(event, trigger, player) {
          var source = trigger.player, suit = get.suit(trigger.card);
          var storage = player.getStorage("cooperation");
          for (var info of storage) {
            if (info.type == "use" && (source == player || source == info.target)) {
              if (!info.used) {
                info.used = [];
              }
              info.used.add(suit);
            }
          }
          player.markSkill("cooperation_use");
        },
        marktext: "戮",
        intro: {
          name: "协力 - 戮力",
          markcount: function(storage, player) {
            return Math.max.apply(
              Math,
              player.getStorage("cooperation").map(function(info) {
                return info.used ? info.used.length : 0;
              })
            );
          },
          content: function(storage, player) {
            var str = "", storage = player.getStorage("cooperation");
            for (var info of storage) {
              if (info.type == "use") {
                str += "<br><li>协力角色：" + get.translation(info.target);
                str += "<br><li>协力原因：" + get.translation(info.reason);
                str += "<br><li>进度：";
                var suits = info.used || [];
                var suits2 = [
                  ["spade", "♠", "♤"],
                  ["heart", "♥", "♡"],
                  ["club", "♣", "♧"],
                  ["diamond", "♦", "♢"]
                ];
                for (var i of suits2) {
                  str += suits.includes(i[0]) ? i[1] : i[2];
                }
                str += suits.length > 3 ? " (已完成)" : " (未完成)";
                str += "<br>　　";
              }
            }
            return str.slice(4, str.length - 6);
          }
        }
      }
    }
  }
};
export {
  cooperationSkills
};
