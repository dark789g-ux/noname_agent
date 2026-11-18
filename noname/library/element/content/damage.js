import "../../../../noname.js";
import { isRecord } from "./selectionResults.js";
import { _status } from "../../../status/index.js";
import { game } from "../../../game/index.js";
import { get } from "../../../get/binding.js";
import { lib } from "../../index.js";
const damageContent = {
  damage: [
    async (event, trigger, player) => {
      event.forceDie = true;
      event.includeOut = true;
      if (event.unreal) {
        event.goto(4);
        return;
      }
      game.callHook("checkDamage1", [event, player]);
      await event.trigger("damageBegin1");
    },
    async (event, trigger, player) => {
      game.callHook("checkDamage2", [event, player]);
      await event.trigger("damageBegin2");
    },
    async (event, trigger, player) => {
      game.callHook("checkDamage3", [event, player]);
      await event.trigger("damageBegin3");
    },
    async (event, trigger, player) => {
      game.callHook("checkDamage4", [event, player]);
      event.trigger("damageBegin4");
    },
    async (event, trigger, player) => {
      const { source } = event;
      const num = Number(event.num);
      if (Number(player.hujia) > 0 && !player.hasSkillTag("nohujia") && !event.nohujia) {
        let damageAudioInfo = lib.natureAudio.hujia_damage[event.nature];
        if (!damageAudioInfo || damageAudioInfo == "normal") {
          damageAudioInfo = `effect/hujia_damage${num > 1 ? "2" : ""}.mp3`;
        } else if (damageAudioInfo == "default") {
          damageAudioInfo = `effect/hujia_damage_${event.nature}${num > 1 ? "2" : ""}.mp3`;
        } else {
          damageAudioInfo = damageAudioInfo[num > 1 ? 2 : 1];
        }
        game.broadcastAll((damageAudioInfo2) => {
          if (lib.config.background_audio) {
            game.playAudio(damageAudioInfo2);
          }
        }, damageAudioInfo);
      } else {
        let damageAudioInfo = lib.natureAudio.damage[event.nature];
        if (!damageAudioInfo || damageAudioInfo == "normal") {
          damageAudioInfo = `effect/damage${num > 1 ? "2" : ""}.mp3`;
        } else if (damageAudioInfo == "default") {
          damageAudioInfo = `effect/damage_${event.nature}${num > 1 ? "2" : ""}.mp3`;
        } else {
          damageAudioInfo = damageAudioInfo[num > 1 ? 2 : 1];
        }
        game.broadcastAll((damageAudioInfo2) => {
          if (lib.config.background_audio) {
            game.playAudio(damageAudioInfo2);
          }
        }, damageAudioInfo);
      }
      let str = event.unreal ? "视为受到了" : "受到了";
      if (source) {
        str += `来自<span class="bluetext">${source == player ? "自己" : get.translation(source)}</span>的`;
      }
      str += `${get.cnNumber(num)}点`;
      if (event.nature) {
        str += `${get.translation(event.nature)}属性`;
      }
      str += "伤害";
      game.log(player, str);
      const playerStat = player.stat[player.stat.length - 1];
      if (playerStat) {
        if (playerStat.damaged == void 0) {
          playerStat.damaged = num;
        } else {
          playerStat.damaged += num;
        }
      }
      if (source) {
        source.getHistory("sourceDamage").push(event);
        const sourceStat = source.stat[source.stat.length - 1];
        if (sourceStat) {
          if (sourceStat.damage == void 0) {
            sourceStat.damage = num;
          } else {
            sourceStat.damage += num;
          }
        }
      }
      player.getHistory("damage").push(event);
      if (!event.unreal) {
        if (event.notrigger) {
          player.changeHp(-num, false)._triggered = null;
        } else {
          player.changeHp(-num, false);
        }
      }
      if (event.animate !== false) {
        player.$damage(source);
        const natures = (event.nature || "").split(lib.natureSeparator);
        game.broadcastAll(
          (natures2, player2) => {
            if (lib.config.animation && !lib.config.low_performance) {
              if (natures2.includes("fire")) {
                player2.$fire();
              }
              if (natures2.includes("thunder")) {
                player2.$thunder();
              }
            }
          },
          natures,
          player
        );
        const numx = player.hasSkillTag("nohujia") ? num : Math.max(0, num - Number(player.hujia));
        player.$damagepop(-numx, natures[0]);
      }
      if (event.unreal) {
        event.goto(6);
      }
      if (!event.notrigger) {
        if (num == 0) {
          await event.trigger("damageZero");
          event._triggered = null;
        } else {
          await event.trigger("damage");
        }
      }
    },
    async (event, trigger, player) => {
      const { source } = event;
      let next;
      if (Number(player.hp) <= 0 && player.isAlive() && !event.nodying) {
        await game.delayx();
        event._dyinged = true;
        next = player.dying(event);
      }
      if (source && lib.config.border_style == "auto") {
        let dnum = 0;
        for (const stat of source.stat) {
          if (stat.damage != void 0) {
            dnum += stat.damage;
          }
        }
        if (dnum >= 2) {
          if (lib.config.autoborder_start == "silver") {
            dnum += 4;
          } else if (lib.config.autoborder_start == "gold") {
            dnum += 8;
          }
        }
        if (lib.config.autoborder_count == "damage") {
          source.node.framebg.dataset.decoration = "";
          if (dnum >= 10) {
            source.node.framebg.dataset.auto = "gold";
            if (dnum >= 12) {
              source.node.framebg.dataset.decoration = "gold";
            }
          } else if (dnum >= 6) {
            source.node.framebg.dataset.auto = "silver";
            if (dnum >= 8) {
              source.node.framebg.dataset.decoration = "silver";
            }
          } else if (dnum >= 2) {
            source.node.framebg.dataset.auto = "bronze";
            if (dnum >= 4) {
              source.node.framebg.dataset.decoration = "bronze";
            }
          }
          if (dnum >= 2) {
            source.classList.add("topcount");
          }
        } else if (lib.config.autoborder_count == "mix") {
          source.node.framebg.dataset.decoration = "";
          switch (source.node.framebg.dataset.auto) {
            case "bronze":
              if (dnum >= 4) {
                source.node.framebg.dataset.decoration = "bronze";
              }
              break;
            case "silver":
              if (dnum >= 8) {
                source.node.framebg.dataset.decoration = "silver";
              }
              break;
            case "gold":
              if (dnum >= 12) {
                source.node.framebg.dataset.decoration = "gold";
              }
              break;
          }
        }
      }
      if (next) {
        return next.forResult();
      }
    },
    async (event, trigger, player) => {
      if (!event.notrigger) {
        await event.trigger("damageSource");
      }
    }
  ],
  async recover(event, trigger, player) {
    let num = Number(event.num);
    if (num > Number(player.maxHp) - Number(player.hp)) {
      num = Number(player.maxHp) - Number(player.hp);
      event.num = num;
    }
    if (num > 0) {
      delete event.filterStop;
      if (lib.config.background_audio) {
        game.playAudio("effect", "recover");
      }
      game.broadcast(() => {
        if (lib.config.background_audio) {
          game.playAudio("effect", "recover");
        }
      });
      game.broadcastAll((player2) => {
        if (lib.config.animation && !lib.config.low_performance) {
          player2.$recover();
        }
      }, player);
      player.$damagepop(num, "wood");
      game.log(player, `回复了${get.cnNumber(num)}点体力`);
      await player.changeHp(num, false);
    } else {
      event._triggered = null;
    }
  },
  async loseHp(event, trigger, player) {
    const num = Number(event.num);
    if (num <= 0) {
      event._triggered = null;
      return;
    }
    if (lib.config.background_audio) {
      game.playAudio("effect", "loseHp");
    }
    game.broadcast(() => {
      if (lib.config.background_audio) {
        game.playAudio("effect", "loseHp");
      }
    });
    game.log(player, `失去了${get.cnNumber(num)}点体力`);
    await player.changeHp(-num);
    if (Number(player.hp) <= 0 && !event.nodying) {
      await game.delayx();
      event._dyinged = true;
      await player.dying(event);
    }
  },
  async doubleDraw(event, trigger, player) {
    const result = await player.chooseBool({ prompt: "你的主副将体力上限之和是奇数，是否摸一张牌？" }).forResult();
    if (isRecord(result) && result.bool === true) {
      await player.draw();
    }
  },
  async loseMaxHp(event, trigger, player) {
    const num = Number(event.num);
    game.broadcastAll(() => {
      if (lib.config.background_audio) {
        game.playAudio("effect", "loseMaxHp");
      }
    });
    game.log(player, `减少了${get.cnNumber(num)}点体力上限`);
    event.originalHp = player.getHp();
    event.originalMaxHp = player.maxHp;
    player.maxHp = Number(player.maxHp) - num;
    if (isNaN(Number(player.maxHp))) {
      player.maxHp = 0;
    }
    event.changedMaxHp = Number(player.maxHp) - event.originalMaxHp;
    event.loseHp = Math.max(0, Number(player.hp) - Number(player.maxHp));
    player.update();
    event.changedHp = player.getHp() - Math.max(0, event.originalHp);
    if (Number(player.maxHp) <= 0) {
      await player.die(event);
    }
  },
  async gainMaxHp(event, trigger, player) {
    const num = Number(event.num);
    game.log(player, `增加了${get.cnNumber(num)}点体力上限`);
    event.originalHp = player.getHp();
    event.originalMaxHp = player.maxHp;
    player.maxHp = Number(player.maxHp) + num;
    event.changedMaxHp = Number(player.maxHp) - event.originalMaxHp;
    event.changedHp = 0;
    player.update();
  },
  async changeHp(event, trigger, player) {
    let num = Number(event.num);
    const { originalHp } = event;
    event.originalMaxHp = player.maxHp;
    event.changedMaxHp = 0;
    game.getGlobalHistory().changeHp.push(event);
    if (num < 0 && Number(player.hujia) > 0 && event.getParent().name == "damage" && !player.hasSkillTag("nohujia") && !event.getParent().nohujia) {
      event.hujia = Math.min(-num, Number(player.hujia));
      const parent = event.getParent(void 0, true);
      if (!parent) {
        throw new Error("damage event parent disappeared before armor absorption was recorded.");
      }
      parent.hujia = event.hujia;
      event.num = Number(event.num) + event.hujia;
      player.changeHujia(-event.hujia).type = "damage";
    }
    num = Number(event.num);
    player.hp = Number(player.hp) + num;
    if (isNaN(Number(player.hp))) {
      player.hp = 0;
    }
    if (Number(player.hp) > Number(player.maxHp)) {
      player.hp = player.maxHp;
    }
    player.update();
    event.changedHp = player.getHp() - Math.max(0, originalHp);
    if (event.popup !== false) {
      player.$damagepop(num, "water");
    }
    if (_status.dying.includes(player) && Number(player.hp) > 0) {
      _status.dying.remove(player);
      game.broadcast((list) => {
        _status.dying = list;
      }, _status.dying);
      let evt = event.getParent("_save");
      if (evt && evt.finish) {
        evt.finish();
      }
      evt = event.getParent("dying");
      if (evt && evt.finish) {
        evt.finish();
      }
    }
    await event.trigger("changeHp");
  },
  async changeHujia(event, trigger, player) {
    let num = Number(event.num);
    if (num > 0) {
      game.log(player, `获得了${get.cnNumber(num)}点护甲`);
    } else if (num < 0) {
      if (-num > Number(player.hujia)) {
        num = -Number(player.hujia);
        event.num = num;
      }
      switch (event.type) {
        case "damage":
          game.log(player, `的护甲抵挡了${get.cnNumber(-num)}点伤害`);
          break;
        case "lose":
          game.log(player, `失去了${get.cnNumber(-num)}点护甲`);
          break;
      }
    }
    player.hujia = Number(player.hujia) + num;
    player.update();
  },
  dying: [
    async (event, trigger, player) => {
      event.forceDie = true;
      if (player.isDying() || Number(player.hp) > 0) {
        event.finish();
        return;
      }
      _status.dying.unshift(player);
      game.broadcast((list) => {
        _status.dying = list;
      }, _status.dying);
      await event.trigger("dying");
      game.log(player, "濒死");
    },
    async (event, trigger, player) => {
      delete event.filterStop;
      if (Number(player.hp) > 0 || event.nodying) {
        _status.dying.remove(player);
        game.broadcast((list) => {
          _status.dying = list;
        }, _status.dying);
        event.finish();
      } else if (!event.skipTao) {
        let start = false;
        const starts = [_status.currentPhase, event.source, event.player, game.me ?? void 0, game.players[0]];
        for (const current of starts) {
          if (current != null && get.itemtype(current) == "player" && game.players.concat(game.dead).includes(current)) {
            start = game.players.slice().sortBySeat(current).find((i) => !i.isOut());
            if (start) {
              break;
            }
          }
        }
        if (start) {
          const next = game.createEvent("_save");
          next.player = start;
          next._trigger = event;
          next.triggername = "_save";
          next.forceDie = true;
          next.setContent("_save");
          await next;
        }
      }
    },
    async (event, trigger, player) => {
      _status.dying.remove(player);
      game.broadcast((list) => {
        _status.dying = list;
      }, _status.dying);
      if (Number(player.hp) <= 0 && !event.nodying && !player.nodying) {
        await player.die(event.reason);
      }
    }
  ]
};
export {
  damageContent
};
