import "../../../../noname.js";
import { requireRegisteredSkill } from "../../skillRegistry.js";
import { _status } from "../../../status/index.js";
import { lib } from "../../index.js";
import { ui } from "../../../ui/index.js";
import { game } from "../../../game/index.js";
import { get } from "../../../get/binding.js";
const triggerMethods = {
  addTrigger(skills, player) {
    if (!player || !skills) {
      return this;
    }
    let evt = this;
    if (typeof skills == "string") {
      skills = [skills];
    }
    while (true) {
      evt = evt.getParent("arrangeTrigger", true);
      if (!evt || evt.name != "arrangeTrigger" || !evt.doingList) {
        return this;
      }
      const arrangeTrigger = evt;
      const doing = evt.doingList.find((i) => i.player === player);
      const firstDo = evt.doingList.find((i) => i.player === "firstDo");
      const lastDo = evt.doingList.find((i) => i.player === "lastDo");
      for (const skill of skills) {
        const info = requireRegisteredSkill(lib.skill, skill);
        if (!info.trigger) {
          continue;
        }
        if (!Object.keys(info.trigger).some((i) => {
          if (Array.isArray(info.trigger?.[i])) {
            return info.trigger[i].includes(arrangeTrigger.triggername);
          }
          return info.trigger?.[i] === arrangeTrigger.triggername;
        })) {
          continue;
        }
        let toadds = [];
        const priority = get.priority(skill);
        if (typeof info.getIndex === "function") {
          const trigger = arrangeTrigger.getTrigger();
          if (!trigger) {
            continue;
          }
          const triggerName = arrangeTrigger.triggername;
          if (typeof triggerName !== "string") {
            throw new TypeError("arrangeTrigger requires triggername");
          }
          const indexedResult = info.getIndex(trigger, player, triggerName);
          if (typeof indexedResult === "number") {
            for (let i = 0; i < indexedResult; i++) {
              toadds.push({
                skill,
                player,
                priority,
                indexedData: true
              });
            }
          } else if (indexedResult != null && typeof indexedResult !== "string" && typeof indexedResult[Symbol.iterator] === "function") {
            for (const indexedData of indexedResult) {
              toadds.push({
                skill,
                player,
                priority,
                indexedData
              });
            }
          }
        } else {
          toadds.push({
            skill,
            player,
            priority
          });
        }
        const map = info.firstDo ? firstDo : info.lastDo ? lastDo : doing;
        if (!map) {
          continue;
        }
        for (const toadd of toadds) {
          if (!toadd.indexedData) {
            if (map.doneList.some((i) => i.skill === toadd.skill && i.player === toadd.player)) {
              continue;
            }
            if (map.todoList.some((i) => i.skill === toadd.skill && i.player === toadd.player)) {
              continue;
            }
          }
          map.todoList.add(toadd);
        }
        if (typeof map.player === "string") {
          const playerMap = arrangeTrigger.playerMap;
          if (!Array.isArray(playerMap)) {
            throw new TypeError("arrangeTrigger requires playerMap");
          }
          map.todoList.sort((a, b) => b.priority - a.priority || playerMap.indexOf(a) - playerMap.indexOf(b));
        } else {
          map.todoList.sort((a, b) => b.priority - a.priority);
        }
      }
    }
  },
  removeTrigger(skills, player) {
    if (!player || !skills) {
      return this;
    }
    let evt = this;
    if (typeof skills == "string") {
      skills = [skills];
    }
    game.expandSkills(skills);
    while (true) {
      evt = evt.getParent("arrangeTrigger", true);
      if (!evt || evt.name != "arrangeTrigger" || !evt.doingList) {
        return this;
      }
      const doing = evt.doingList.find((i) => i.player == player);
      const firstDo = evt.doingList.find((i) => i.player == "firstDo");
      const lastDo = evt.doingList.find((i) => i.player == "lastDo");
      skills.forEach(
        (skill) => [doing, firstDo, lastDo].forEach((map) => {
          if (!map) {
            return;
          }
          const toremove = map.todoList.filter((i) => i.skill == skill && i.player == player);
          if (toremove.length > 0) {
            map.todoList.removeArray(toremove);
          }
        })
      );
    }
  },
  trigger(name) {
    if (_status.video) {
      return;
    }
    if (!_status.gameDrawed && ["lose", "gain", "loseAsync", "equip", "addJudge", "addToExpansion"].includes(this.name)) {
      return;
    }
    if (name === "gameDrawEnd") {
      _status.gameDrawed = true;
    }
    if (name === "gameStart") {
      lib.announce.publish("Noname.Game.Event.GameStart", {});
      lib.announce.publish("gameStart", {});
      if (_status.brawl && _status.brawl.gameStart) {
        _status.brawl.gameStart();
      }
      if (lib.config.show_cardpile) {
        ui.cardPileButton.style.display = "";
      }
      if (lib.config.show_commonCardpile) {
        ui.commonCardPileButton.style.display = "";
      }
      _status.gameStarted = true;
      game.showHistory();
    }
    if (name === "roundStart") {
      lib.announce.publish("roundStart", { roundNumber: game.roundNumber });
    }
    if (!lib.hookmap[name]) {
      return;
    }
    if (!game.players || !game.players.length) {
      return;
    }
    const event = this;
    if (event.filterStop && event.filterStop()) {
      return;
    }
    let start = [_status.currentPhase, event.source, event.player, game.me, game.players[0]].find((i) => get.itemtype(i) == "player");
    if (!start) {
      return;
    }
    if (!game.players.includes(start) && !game.dead.includes(start)) {
      start = game.findNext(start);
    }
    const firstDo = {
      player: "firstDo",
      todoList: [],
      doneList: []
    };
    const lastDo = {
      player: "lastDo",
      todoList: [],
      doneList: []
    };
    const doingList = [];
    const roles = ["player", "source", "target", "global"], map = lib.relatedTrigger, names = Object.keys(map);
    const playerMap = game.players.concat(game.dead).sortBySeat(start);
    let player = start;
    let allbool = false;
    do {
      const doing = {
        player,
        todoList: [],
        doneList: []
      };
      const listAdded = {};
      const addList = (skill) => {
        if (!skill) {
          return;
        }
        if (Array.isArray(skill)) {
          return skill.forEach(addList);
        }
        if (listAdded[skill]) {
          return;
        }
        listAdded[skill] = true;
        const info = requireRegisteredSkill(lib.skill, skill);
        const list = info.firstDo ? firstDo.todoList : info.lastDo ? lastDo.todoList : doing.todoList;
        const priority = get.priority(skill);
        if (typeof info.getIndex === "function") {
          const indexedResult = info.getIndex(event, player, name);
          if (typeof indexedResult === "number") {
            for (let i = 0; i < indexedResult; i++) {
              list.push({
                skill,
                player: doing.player,
                priority,
                indexedData: true
              });
            }
          } else if (indexedResult != null && typeof indexedResult !== "string" && typeof indexedResult[Symbol.iterator] === "function") {
            for (const indexedData of indexedResult) {
              list.push({
                skill,
                player: doing.player,
                priority,
                indexedData
              });
            }
          }
        } else {
          list.push({
            skill,
            player: doing.player,
            priority: get.priority(skill)
          });
        }
        if (typeof doing.player == "string") {
          list.sort((a, b) => b.priority - a.priority || playerMap.indexOf(a.player) - playerMap.indexOf(b.player));
        } else {
          list.sort((a, b) => b.priority - a.priority);
        }
        allbool = true;
      };
      const notemp = player.skills.slice();
      for (const j in player.additionalSkills) {
        if (!j.startsWith("hidden:")) {
          notemp.addArray(player.additionalSkills[j]);
        }
      }
      Object.keys(player.tempSkills).filter((skill) => {
        if (notemp.includes(skill)) {
          return false;
        }
        const expire = player.tempSkills[skill];
        if (typeof expire === "function") {
          return expire(event, player, name);
        }
        if (typeof expire === "object" && !Array.isArray(expire)) {
          return roles.some((role) => {
            if (role !== "global" && player !== event[role]) {
              return false;
            }
            const checkTrigger = (trigger) => {
              if (trigger == name) {
                return true;
              }
              const evt = names.find((evt2) => trigger?.startsWith(evt2));
              if (!evt) {
                return false;
              }
              return map[evt].some((rawTrigger) => {
                return `${rawTrigger}${trigger.slice(evt.length)}` == name;
              });
            };
            const roleExpire = expire[role];
            if (Array.isArray(roleExpire)) {
              return roleExpire.length && roleExpire.some(checkTrigger);
            }
            return checkTrigger(roleExpire);
          });
        }
      }).forEach((skill) => {
        delete player.tempSkills[skill];
        player.removeSkill(skill);
      });
      roles.forEach((role) => {
        addList(lib.hook.globalskill[role + "_" + name]);
        addList(lib.hook[player.playerid + "_" + role + "_" + name]);
      });
      doingList.push(doing);
      player = player.nextSeat;
    } while (player && player !== start);
    doingList.unshift(firstDo);
    doingList.push(lastDo);
    if (allbool) {
      const next = game.createEvent("arrangeTrigger", false, event);
      next.setContent("arrangeTrigger");
      const arranged = Object.assign(next, {
        doingList,
        _trigger: event,
        triggername: name,
        playerMap
      });
      event._triggering = arranged;
      arranged.then(() => event._triggering = void 0);
      return arranged;
    }
    return null;
  },
  // @todo 奇怪的参数
  /**
   * @param {boolean | "currentOnly"} all
   */
  untrigger(all = true, player) {
    if (all) {
      if (all !== "currentOnly") {
        this._triggered = 5;
      }
      if (this._triggering) {
        this._triggering.finish();
      }
    } else if (player) {
      this._notrigger.add(player);
    }
    return this;
  }
};
export {
  triggerMethods
};
