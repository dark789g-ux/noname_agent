import "../../../../noname.js";
import { get } from "../../../get/binding.js";
import { game } from "../../../game/index.js";
import { lib } from "../../index.js";
import { ui } from "../../../ui/index.js";
import { _status } from "../../../status/index.js";
const useSkillContent = {
  useSkill: [
    async (event, trigger, player) => {
      const { cards, skill } = event;
      const targets = event.getTargets();
      if (!skill) {
        throw new TypeError("useSkill requires an event skill");
      }
      const info = get.info(skill);
      if (!info.noForceDie) {
        event.forceDie = true;
      }
      if (!info.noForceOut) {
        event.includeOut = true;
      }
      event._skill = skill;
      const checkShow = player.checkShow(skill);
      const waitings = [];
      let losecard = null;
      if (info.discard != false && info.lose != false && !info.viewAs) {
        const next = player.discard({ cards });
        next.delay = false;
        if (lib.config.low_performance) {
          event.discardTransition = true;
        }
        waitings.push(next);
      } else {
        if (info.lose != false) {
          if (info.losetrigger == false) {
            const next = player.lose({ cards, position: ui.special });
            losecard = next;
            next._triggered = null;
          } else {
            const next = player.lose({ cards, position: ui.special });
            losecard = next;
            if (info.visible) {
              next.visible = true;
            }
            if (info.loseTo) {
              next.position = ui[info.loseTo];
            }
            if (info.insert) {
              next.insert_card = true;
            }
            if (next.position == ui.special && info.toStorage) {
              next.toStorage = true;
            }
          }
        }
        if (!info.prepare && info.viewAs) {
          player.$throw(cards);
          if (losecard) {
            losecard.visible = true;
          }
          if (lib.config.sync_speed && cards[0] && cards[0].clone) {
            const waitingForTransition = get.time();
            event.waitingForTransition = waitingForTransition;
            cards[0].clone.listenTransition(() => {
              if (_status.waitingForTransition == waitingForTransition && _status.paused) {
                game.resume();
              }
              delete event.waitingForTransition;
            }, 1e3);
          }
        }
      }
      if (losecard) {
        waitings.push(losecard);
      }
      if (info.line != false && targets.length) {
        const config = {};
        const line = info.line;
        if (line && typeof line === "object" && "color" in line && Array.isArray(line.color)) {
          config.color = line.color;
        } else if (info.line == "fire") {
          config.color = "fire";
        } else if (info.line == "thunder") {
          config.color = "thunder";
        } else if (info.line === void 0 || info.line == "green") {
          config.color = "green";
        }
        if (info.multitarget && !info.multiline && targets.length > 1) {
          player.line2(targets, config);
        } else {
          player.line(targets, config);
        }
      }
      let str = "";
      if (targets && targets.length && info.log != "notarget") {
        str += `对<span class="bluetext">${targets[0] == player ? "自己" : get.translation(targets[0])}`;
        for (const target of targets.slice(1)) {
          str += `、${target == player ? "自己" : get.translation(target)}`;
        }
        str += "</span>";
      }
      str += "发动了";
      if (!info.direct && info.log !== false) {
        game.trySkillAudio(skill, player, void 0, void 0, null, [event, event.player]);
        game.log(player, str, `【${get.skillTranslation(skill, player)}】`);
        if (info.logv !== false) {
          game.logv(player, skill, targets);
        }
        player.trySkillAnimate(skill, skill, checkShow);
      }
      const stat = player.stat[player.stat.length - 1];
      if (stat) {
        if (event.addCount != false) {
          if (stat.skill[skill] == void 0) {
            stat.skill[skill] = 1;
          } else {
            stat.skill[skill]++;
          }
          const sourceSkill = get.info(skill).sourceSkill;
          if (sourceSkill) {
            if (stat.skill[sourceSkill] == void 0) {
              stat.skill[sourceSkill] = 1;
            } else {
              stat.skill[sourceSkill]++;
            }
          }
        }
        if (stat.allSkills == void 0) {
          stat.allSkills = 1;
        } else {
          stat.allSkills++;
        }
      }
      if (info.prepare) {
        switch (info.prepare) {
          case "give":
            if (losecard) {
              losecard.visible = true;
            }
            player.$give(cards, targets[0]);
            break;
          case "give2":
            player.$give(cards.length, targets[0]);
            break;
          case "throw":
            if (losecard) {
              losecard.visible = true;
            }
            player.$throw(cards);
            break;
          case "throw2":
            player.$throw(cards.length);
            break;
          default:
            if (typeof info.prepare === "function") {
              info.prepare(cards, player, targets);
            }
        }
      }
      if (info.round) {
        const roundname = `${skill}_roundcount`;
        player.storage[roundname] = game.roundNumber;
        player.syncStorage(roundname);
        player.markSkill(roundname);
      }
      const name = skill;
      const players = player.getSkills(false, false, false);
      const equips = player.getSkills("e");
      const global = lib.skill.global.slice(0);
      const logInfo = {
        skill: name,
        targets: targets ?? false,
        event: _status.event
      };
      if (info.sourceSkill) {
        logInfo.sourceSkill = info.sourceSkill;
        if (global.includes(info.sourceSkill)) {
          logInfo.type = "global";
        } else if (players.includes(info.sourceSkill)) {
          logInfo.type = "player";
        } else if (equips.includes(info.sourceSkill)) {
          logInfo.type = "equip";
        }
      } else {
        if (global.includes(name)) {
          logInfo.sourceSkill = name;
          logInfo.type = "global";
        } else if (players.includes(name)) {
          logInfo.sourceSkill = name;
          logInfo.type = "player";
        } else if (equips.includes(name)) {
          logInfo.sourceSkill = name;
          logInfo.type = "equip";
        } else {
          let bool = false;
          for (const skill2 of players) {
            const expand = [skill2];
            game.expandSkills(expand);
            if (expand.includes(name)) {
              bool = true;
              logInfo.sourceSkill = skill2;
              logInfo.type = "player";
              break;
            }
          }
          if (!bool) {
            for (const skill2 of players) {
              const expand = [skill2];
              game.expandSkills(expand);
              if (expand.includes(name)) {
                logInfo.sourceSkill = skill2;
                logInfo.type = "equip";
                break;
              }
            }
          }
        }
      }
      if (logInfo.sourceSkill !== void 0) {
        event.sourceSkill = logInfo.sourceSkill;
      }
      if (logInfo.type !== void 0) {
        event.type = logInfo.type;
      }
      if (!info.direct && info.log !== false) {
        player.getHistory("useSkill").push(logInfo);
        await event.trigger("useSkill");
      }
      return Promise.all(waitings);
    },
    async (event, trigger, player) => {
      const { cards, targets } = event;
      const skill = event.skill;
      if (!skill) {
        return;
      }
      const info = get.info(skill);
      if (info && info.contentBefore) {
        const next = game.createEvent(`${skill}ContentBefore`);
        next.setContent(info.contentBefore);
        next.targets = targets;
        next.cards = cards;
        next.player = player;
        next.skill = skill;
        if (event.forceDie) {
          next.forceDie = true;
        }
        if (event.includeOut) {
          next.includeOut = true;
        }
        return next.forResult();
      }
    },
    async (event, trigger, player) => {
      const { cards } = event;
      const num = Number(event.num);
      const targets = event.getTargets();
      if (!event.skill) {
        const currentPlayer = event.getPlayer();
        console.log("error: no skill", get.translation(currentPlayer), currentPlayer.getSkills());
        if (event._skill) {
          event.skill = event._skill;
          console.log(event._skill);
        } else {
          event.finish();
          return;
        }
      }
      const skill = event.skill;
      if (!skill) {
        event.finish();
        return;
      }
      const info = get.info(skill);
      if (targets[num] && targets[num].isDead() && !info?.deadTarget || targets[num] && targets[num].isOut() && !info?.includeOut || targets[num] && targets[num].removed) {
        if (!info.multitarget && num < targets.length - 1) {
          event.num = Number(event.num) + 1;
          event.redo();
        }
        return;
      }
      if (!info?.content) {
        event.finish();
        return;
      }
      const next = game.createEvent(skill);
      next.setContent(info.content);
      next.targets = targets;
      next.cards = cards;
      next.player = player;
      next.num = num;
      next.multitarget = info.multitarget;
      if (num == 0 && next.targets.length > 1) {
        if (!info.multitarget) {
          lib.tempSortSeat = player;
          targets.sort(lib.sort.seat);
          delete lib.tempSortSeat;
        }
        for (const target of targets) {
          target.addTempClass("target");
        }
      }
      next.target = targets[num];
      if (event.forceDie) {
        next.forceDie = true;
      }
      if (event.includeOut) {
        next.includeOut = true;
      }
      if (next.target && !info.multitarget) {
        if (num == 0 && targets.length > 1) {
        } else {
          next.target.addTempClass("target");
        }
      }
      if (num == 0) {
        if (typeof info.delay == "number") {
          game.delay(info.delay);
        } else if (info.delay !== false) {
          if (event.waitingForTransition) {
            _status.waitingForTransition = event.waitingForTransition;
            game.pause();
          } else {
            await game.delayx();
          }
        }
      } else {
        await game.delayx(0.5);
      }
      if (!info.multitarget && num < targets.length - 1) {
        event.num = Number(event.num) + 1;
        event.redo();
      }
    },
    async (event, trigger, player) => {
      const { cards } = event;
      const targets = event.getTargets();
      const skill = event.skill;
      if (!skill) {
        return;
      }
      const info = get.info(skill);
      if (info && info.contentAfter) {
        const next = game.createEvent(`${skill}ContentAfter`);
        next.setContent(info.contentAfter);
        next.targets = targets;
        next.cards = cards;
        next.player = player;
        next.skill = skill;
        if (event.forceDie) {
          next.forceDie = true;
        }
        if (event.includeOut) {
          next.includeOut = true;
        }
        return next.forResult();
      }
    },
    async (event, trigger, player) => {
      const allSkills = player.getStat().allSkills;
      if (allSkills !== void 0 && allSkills > 200) {
        player._noSkill = true;
        console.log(player.name, event.skill);
      }
      if (document.getElementsByClassName("thrown").length) {
        if (event.skill && get.info(event.skill).delay !== false && get.info(event.skill).delay !== 0) {
          await game.delayx();
        }
      } else {
        event.finish();
      }
    },
    async () => {
      ui.clear();
    }
  ],
  async draw(event, trigger, player) {
    let num = Number(event.num);
    if (typeof event.minnum == "number" && num < event.minnum) {
      num = event.minnum;
    }
    if (event.drawDeck) {
      if (event.drawDeck > num) {
        event.drawDeck = num;
      }
      num -= event.drawDeck;
    }
    let logList;
    if (event.log != false) {
      logList = [player];
      if (num > 0) {
        if (event.bottom) {
          logList.add(`从牌堆底摸了${get.cnNumber(num)}张牌`);
        } else {
          logList.add(`摸了${get.cnNumber(num)}张牌`);
        }
      }
      if (event.drawDeck) {
        logList.add(`从牌库中获得了${get.cnNumber(event.drawDeck)}张牌`);
      }
    }
    let cards = [];
    if (num > 0) {
      if (event.otherGetCards) {
        cards.addArray(event.otherGetCards(num));
      } else if (event.bottom) {
        cards.addArray(get.bottomCards(num));
      } else if (player.getTopCards) {
        cards.addArray(player.getTopCards(num));
      } else {
        cards.addArray(get.cards(num));
      }
    } else {
      cards = [];
    }
    if (event.drawDeck) {
      cards = cards.concat(player.getDeckCards(event.drawDeck));
    }
    if (get.itemtype(cards) == "cards") {
      let next;
      if (event.animate != false) {
        if (event.visible) {
          next = player.gain({ cards: cards.slice(), animate: "gain2", log: false });
          logList.addArray(["（", cards, "）"]);
        } else {
          next = player.gain({ cards: cards.slice(), animate: "draw" });
        }
      } else {
        next = player.gain({ cards: cards.slice() });
        if (event.$draw) {
          player.$draw(cards.length);
        }
      }
      if (logList?.length) {
        game.log(...logList);
      }
      next.gaintag.addArray(event.gaintag);
      await next;
    }
    event.result = {
      bool: true,
      cards
    };
  }
};
export {
  useSkillContent
};
