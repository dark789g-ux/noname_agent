import "../../../noname.js";
import { game } from "../index.js";
import { setupDoubleCharacterBoard } from "./doubleCharacterBoard.js";
import { get } from "../../get/binding.js";
import { lib } from "../../library/index.js";
import { ui } from "../../ui/index.js";
import { _status } from "../../status/index.js";
const chooseCharacterDoubleMethods = {
  chooseCharacterDouble(...args) {
    const next = game.createEvent("chooseCharacter");
    let config, width, num, ratio, func, update, list, first;
    for (let i = 0; i < args.length; i++) {
      if (typeof args[i] == "number") {
        if (!width) {
          width = args[i];
        } else if (!num) {
          num = args[i];
        } else {
          ratio = args[i];
        }
      } else if (typeof args[i] == "function") {
        if (!func) {
          func = args[i];
        } else {
          update = args[i];
        }
      } else if (Array.isArray(args[i])) {
        list = args[i];
      } else if (get.objtype(args[i]) == "object") {
        config = args[i];
      }
    }
    if (!config) {
      list = config;
      config = {};
    }
    config.width = config.width || width || 8;
    config.height = 4;
    config.size = config.width * config.height;
    config.num = config.num || num || 3;
    config.ratio = config.ratio || ratio || 1.2;
    config.update = config.update || update;
    if (!("first" in config)) {
      if (typeof first == "boolean") {
        config.first = first;
      } else {
        config.first = "rand";
      }
    }
    if (!list) {
      list = [];
      for (const i in lib.character) {
        if (typeof func == "function") {
          if (!func(i)) {
            continue;
          }
        } else {
          if (lib.filter.characterDisabled(i)) {
            continue;
          }
        }
        list.push(i);
      }
    }
    next.config = config;
    next.list = list;
    next.setContent([
      (event) => {
        setupDoubleCharacterBoard(event);
        event.aiMove = function(friend) {
          const list2 = [];
          for (let i = 0; i < event.avatars.length; i++) {
            if (!event.avatars[i].classList.contains("moved")) {
              list2.push(event.avatars[i]);
            }
          }
          for (let i = 0; i < list2.length; i++) {
            if (Math.random() < 0.7 || i == list2.length - 1) {
              if (friend) {
                event.moveAvatar(list2[i], event.friend.length + event.config.width * (event.config.height - 1));
                event.friend.push(list2[i]);
              } else {
                event.moveAvatar(list2[i], event.enemy.length);
                event.enemy.push(list2[i]);
              }
              list2[i].classList.add("moved");
              break;
            }
          }
        };
        event.clickAvatar = function() {
          if (event.deciding) {
            if (this.index < event.config.width) {
              return;
            }
            if (event.friendlist.includes(this)) {
              event.friendlist.remove(this);
              event.moveNode(this, this.index);
              this.nodename.innerHTML = get.slimName(this.link);
            } else {
              event.friendlist.push(this);
            }
            if (event.friendlist.length == event.config.num) {
              event.deciding = false;
              event.prompt("比赛即将开始");
              setTimeout(game.resume, 1e3);
            }
            if (event.config.update) {
              for (let i = 0; i < event.friendlist.length; i++) {
                event.friendlist[i].nodename.innerHTML = event.config.update(i, event.friendlist.length) || event.friendlist[i].nodename.innerHTML;
              }
            }
            const str = "px," + (event.margin / 2 - event.height * 0.5) + "px)";
            for (let i = 0; i < event.friendlist.length; i++) {
              event.friendlist[i].style.transform = "scale(1.2) translate(" + (-(event.width + 14) * event.friendlist.length / 2 + 7 + i * (event.width + 14)) + str;
            }
          } else {
            if (!event.imchoosing) {
              return;
            }
            if (event.replacing) {
              this.link = event.replacing;
              this.setBackground(event.replacing, "character");
              this.nodename.innerHTML = get.slimName(event.replacing);
              this.nodename.dataset.nature = get.groupnature(lib.character[event.replacing][1]);
              delete event.replacing;
              if (this.classList.contains("moved")) {
                event.custom.add.window();
              }
            }
            if (this.classList.contains("moved")) {
              return;
            }
            event.moveAvatar(this, event.friend.length + event.config.width * (event.config.height - 1));
            event.friend.push(this);
            this.classList.add("moved");
            game.resume();
          }
        };
        if (get.config("change_choice")) {
          event.reselectnode = ui.create.system(
            "重选",
            function() {
              event.promptbar.hide();
              event.list2 = event.list2.concat(event.friend.map((node) => node.link)).concat(event.enemy.map((node) => node.link));
              event.friend.length = 0;
              event.enemy.length = 0;
              for (let i = 0; i < event.avatars.length; i++) {
                if (event.avatars[i].classList.contains("moved")) {
                  event.moveAvatar(event.avatars[i], event.blank.randomRemove());
                  event.avatars[i].classList.remove("moved");
                }
              }
              event.redoing = true;
              if (event.imchoosing) {
                game.resume();
              }
            },
            true
          );
        }
        ui.auto.hide();
        ui.wuxie.hide();
        event.resize();
        for (let i = 0; i < event.config.size; i++) {
          ui.window.appendChild(event.nodes[i]);
        }
      },
      (event) => {
        let rand1 = event.config.first;
        if (rand1 == "rand") {
          rand1 = Math.random() < 0.5;
        }
        if (rand1) {
          _status.color = true;
          event.side = 1;
        } else {
          _status.color = false;
          event.side = 3;
        }
        if (!event.list2) {
          event.list2 = event.list.randomGets(event.config.width * 2);
          for (let i = 0; i < event.config.width * 2; i++) {
            event.avatars.push(ui.create.div(".shadowed.shadowed2.reduce_radius.character.choosedouble", event.clickAvatar));
            const name = event.list2[i];
            event.avatars[i].setBackground(name, "character");
            event.avatars[i].link = name;
            event.avatars[i].nodename = ui.create.div(".name", event.avatars[i], get.slimName(name));
            event.avatars[i].nodename.style.fontFamily = lib.config.name_font;
            event.avatars[i].index = i + event.config.width;
            event.avatars[i].addTempClass("start");
            event.nodes[event.avatars[i].index].style.display = "none";
            event.avatars[i].nodename.dataset.nature = get.groupnature(lib.character[name][1]);
            lib.setIntro(event.avatars[i]);
          }
          event.resize();
          for (let i = 0; i < event.avatars.length; i++) {
            ui.window.appendChild(event.avatars[i]);
          }
          event.avatars.sort(function(a, b) {
            return Number(get.rank(b.link, true)) - Number(get.rank(a.link, true));
          });
        }
        game.delay();
        lib.init.onfree();
      },
      (event) => {
        if (event.checkredo()) {
          return;
        }
        if (event._skiprest) {
          return;
        }
        if (event.side < 2) {
          event.imchoosing = true;
          if (event.side == 0) {
            event.prompt("请选择两名武将");
          } else {
            event.prompt("请选择一名武将");
            event.fast = get.time();
          }
          game.pause();
        } else {
          event.aiMove();
          game.delay();
        }
      },
      (event) => {
        if (typeof event.fast == "number" && get.time() - event.fast <= 1e3) {
          event.fast = true;
        } else {
          event.fast = false;
        }
        delete event.imchoosing;
        if (event.checkredo()) {
          return;
        }
        if (event._skiprest) {
          while (event.enemy.length < event.config.width) {
            event.aiMove();
          }
          while (event.friend.length < event.config.width) {
            event.aiMove(true);
          }
        } else if (event.friend.length + event.enemy.length < event.config.width * 2 - 1) {
          if (event.side == 1) {
            game.delay(event.fast ? 1 : 2);
            event.promptbar.hide();
          }
          event.side++;
          if (event.side > 3) {
            event.side = 0;
          }
          event.goto(2);
        } else {
          event.promptbar.hide();
          event.side++;
          if (event.side > 3) {
            event.side = 0;
          }
          if (event.side >= 2) {
            game.delay();
          }
        }
      },
      (event) => {
        if (event.checkredo()) {
          return;
        }
        if (event.skipnode) event.skipnode.delete();
        if (event.replacenode) event.replacenode.delete();
        if (event.reselectnode) event.reselectnode.delete();
        if (event.freechoosenode) event.freechoosenode.delete();
        for (let i = 0; i < event.avatars.length; i++) {
          if (!event.avatars[i].classList.contains("moved")) {
            if (event.side < 2) {
              event.moveAvatar(event.avatars[i], event.friend.length + event.config.width * (event.config.height - 1));
              event.friend.push(event.avatars[i]);
            } else {
              event.moveAvatar(event.avatars[i], event.enemy.length);
              event.enemy.push(event.avatars[i]);
            }
            event.avatars[i].classList.add("moved");
          }
        }
        game.delay();
      },
      (event) => {
        event.prompt("选择" + get.cnNumber(event.config.num) + "名出场武将");
        event.enemylist = [];
        for (let i = 0; i < event.avatars.length; i++) {
          if (event.avatars[i].index > event.config.width) {
            event.avatars[i].classList.add("selecting");
          }
        }
        const rand = [];
        for (let i = 0; i < event.config.width; i++) {
          for (let j = 0; j < event.config.width - i; j++) {
            rand.push(i);
          }
        }
        for (let i = 0; i < event.config.num; i++) {
          const rand2 = rand.randomGet();
          for (let j = 0; j < rand.length; j++) {
            if (rand[j] == rand2) {
              rand.splice(j--, 1);
            }
          }
          event.enemylist.push(event.enemy[rand2]);
        }
        event.enemylist.randomSort();
        event.friendlist = [];
        event.deciding = true;
        for (let i = 0; i < event.config.size; i++) {
          event.nodes[i].hide();
        }
        game.pause();
      },
      (event) => {
        event.promptbar.delete();
        if (ui.cardPileButton) {
          ui.cardPileButton.style.display = "";
        }
        lib.onresize.remove(event.resize);
        ui.wuxie.show();
        ui.auto.show();
        for (let i = 0; i < event.avatars.length; i++) {
          event.avatars[i].delete();
        }
        for (let i = 0; i < event.nodes.length; i++) {
          event.nodes[i].delete();
        }
        event.result = { friend: [], enemy: [] };
        for (let i = 0; i < event.config.num; i++) {
          event.result.friend[i] = event.friendlist[i].link;
          event.result.enemy[i] = event.enemylist[i].link;
        }
      }
    ]);
  }
};
export {
  chooseCharacterDoubleMethods
};
