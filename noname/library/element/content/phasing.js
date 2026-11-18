import "../../../../noname.js";
import { isSelectionResultObject } from "./selectionResults.js";
import { get } from "../../../get/binding.js";
import { game } from "../../../game/index.js";
import { _status } from "../../../status/index.js";
import { ui } from "../../../ui/index.js";
import { lib } from "../../index.js";
const phasingContent = {
  /*----分界线----*/
  async phasing(event, trigger, player) {
    while (ui.dialogs.length) {
      ui.dialogs[0].close();
    }
    game.phaseNumber++;
    player.phaseNumber++;
    game.broadcastAll(
      (player2, player22, num, popup) => {
        if (lib.config.glow_phase) {
          if (player22) {
            player22.classList.remove("glow_phase");
          }
          player2.classList.add("glow_phase");
        }
        player2.phaseNumber = num;
        if (popup && lib.config.show_phase_prompt) {
          player2.popup("回合开始", void 0, false);
        }
      },
      player,
      _status.currentPhase,
      player.phaseNumber,
      !player.noPhaseDelay
    );
    _status.currentPhase = player;
    _status.discarded = [];
    game.syncState();
    game.addVideo("phaseChange", player);
    if (game.phaseNumber >= 1 && !lib.configOL.observeReady) {
      delete player._start_cards;
      if (lib.configOL.observe) {
        lib.configOL.observeReady = true;
        game.send("server", "config", lib.configOL);
      }
    }
    game.log();
    game.log(player, "的回合开始");
    player._noVibrate = true;
    if (get.config("identity_mode") != "zhong" && get.config("identity_mode") != "purple" && !_status.connectMode) {
      let num;
      switch (get.config("auto_identity")) {
        case "one":
          num = 1;
          break;
        case "two":
          num = 2;
          break;
        case "three":
          num = 3;
          break;
        case "always":
          num = -1;
          break;
        default:
          num = 0;
          break;
      }
      if (num && !_status.identityShown && game.phaseNumber > game.players.length * num && game.showIdentity) {
        if (!_status.video) {
          player.popup("显示身份");
        }
        _status.identityShown = true;
        game.showIdentity(false);
      }
    }
    player.ai.tempIgnore = [];
    if (ui.land && ui.land.player == player) {
      game.addVideo("destroyLand");
      ui.land.destroy();
    }
    await event.trigger("phaseBeginStart");
  },
  async toggleSubPlayer(event, trigger, player) {
    const list = event.list || player.storage.subplayer.skills.slice(0);
    list.remove(player.storage.subplayer.name2);
    event.list = list;
    if (!event.directresult) {
      if (list.length > 1) {
        const dialog = ui.create.dialog("更换一个随从", "hidden");
        dialog.add([list, "character"]);
        const result = await player.chooseButton(dialog, true).forResult();
        if (result && typeof result == "object" && "bool" in result && result.bool && "links" in result && Array.isArray(result.links) && typeof result.links[0] == "string") {
          event.directresult = result.links[0];
        }
      } else if (list.length == 1) {
        event.directresult = list[0];
      } else {
        return;
      }
    } else {
      if (!list.includes(event.directresult)) {
        return;
      }
    }
    if (!event.directresult) {
      return;
    }
    let waiting = null;
    if (player.storage.subplayer) {
      const current = player.storage.subplayer.name2;
      if (event.directresult == current) {
        return;
      }
      player.storage[current].hp = player.hp;
      player.storage[current].maxHp = player.maxHp;
      player.storage[current].hujia = player.hujia;
      player.storage[current].hs = player.getCards("h");
      player.storage[current].es = player.getVCards("e");
      const next = player.lose({ cards: player.getCards("he"), position: ui.special });
      next._triggered = null;
      waiting = next;
      const cfg = player.storage[event.directresult];
      player.storage.subplayer.name2 = event.directresult;
      player.reinit(current, event.directresult, [cfg.hp, cfg.maxHp, cfg.hujia]);
      if (player.name == event.directresult || player.name1 == event.directresult) {
        const groupx = cfg.group || "qun";
        player.group = groupx;
        player.node.name.dataset.nature = get.groupnature(groupx);
      }
      if (cfg.hs.length) {
        player.directgain(cfg.hs);
      }
      if (cfg.es.length) {
        player.directequip(cfg.es);
      }
    }
    if (waiting != null) {
      await waiting;
    }
  },
  async exitSubPlayer(event, trigger, player) {
    if (player.storage.subplayer) {
      const current = player.storage.subplayer.name2;
      const goon = player.name == current || player.name1 == current;
      if (event.remove) {
        player.lose({ cards: player.getCards("he"), position: ui.discardPile })._triggered = null;
      } else {
        player.storage[current].hp = player.hp;
        player.storage[current].maxHp = player.maxHp;
        player.storage[current].hujia = player.hujia;
        player.storage[current].hs = player.getCards("h");
        player.storage[current].es = player.getVCards("e");
        player.lose({ cards: player.getCards("he"), position: ui.special })._triggered = null;
      }
      player.reinit(current, player.storage.subplayer.name, [player.storage.subplayer.hp, player.storage.subplayer.maxHp, player.storage.subplayer.hujia]);
      if (goon) {
        const groupx = player.storage.subplayer.group || "qun";
        player.group = groupx;
        player.node.name.dataset.nature = get.groupnature(groupx);
      }
      player.update();
      if (event.remove) {
        if (player.storage[current].onremove) {
          player.storage[current].onremove(player, current);
        }
        delete player.storage[current];
        player.storage.subplayer.skills.remove(current);
        game.log(player, "牺牲了随从", `#g${current}`);
      } else {
        game.log(player, "收回了随从", `#g${current}`);
      }
      player.addSkill(player.storage.subplayer.skills);
    }
    if (player.storage.subplayer) {
      player.directgain(player.storage.subplayer.hs);
      player.directequip(player.storage.subplayer.es);
    }
    player.removeSkill("subplayer");
    if (event.remove) {
      await event.trigger("subPlayerDie");
    }
  },
  async callSubPlayer(event, trigger, player) {
    const list = player.getSubPlayers(event.tag);
    event.list = list;
    if (!event.directresult) {
      if (list.length > 1) {
        const dialog = ui.create.dialog("调遣一个随从", "hidden");
        dialog.add([list, "character"]);
        const result = await player.chooseButton(dialog, true).forResult();
        if (typeof result !== "string" && result.bool && Array.isArray(result.links) && result.links[0]) {
          event.directresult = result.links[0];
        }
      } else if (list.length == 1) {
        event.directresult = list[0];
      } else {
        return;
      }
    } else {
      if (!list.includes(event.directresult)) {
        return;
      }
    }
    if (!event.directresult) {
      await game.delay();
      return;
    }
    const cfg = player.storage[event.directresult];
    const source = cfg.source || player.name;
    const name = event.directresult;
    game.log(player, "调遣了随从", `#g${name}`);
    player.storage.subplayer = {
      name: source,
      name2: event.directresult,
      hp: player.hp,
      maxHp: player.maxHp,
      hujia: player.hujia,
      skills: event.list.slice(0),
      hs: player.getCards("h"),
      es: player.getVCards("e"),
      intro2: cfg.intro2,
      group: player.group
    };
    player.removeSkill(event.list);
    player.reinit(source, name, [cfg.hp, cfg.maxHp, cfg.hujia]);
    if (player.name == name || player.name1 == name) {
      const groupx = cfg.group || "qun";
      player.group = groupx;
      player.node.name.dataset.nature = get.groupnature(groupx);
    }
    player.addSkill("subplayer");
    player.lose(player.getCards("he"), ui.special)._triggered = null;
    if (cfg.hs.length) {
      player.directgain(cfg.hs);
    }
    if (cfg.es.length) {
      player.directequip(cfg.es);
    }
    await game.delay();
  },
  async addExtraTarget(event, trigger, player) {
    const { card } = event;
    const targets = event.getTargets();
    const info = get.info(card);
    for (const target of targets) {
      let result;
      if (target == event.target && event.addedTarget) {
        event.addedTargets.push(event.addedTarget);
        result = { bool: false };
      } else if (game.hasPlayer((current) => info.filterAddedTarget(card, player, current, target))) {
        const next = player.chooseTarget({
          prompt: `${get.translation(event.card)}：选择${get.translation(target)}对应的指向目标`,
          filterTarget: (_card, player2, target2) => {
            const card2 = get.card();
            const info2 = get.info(card2);
            return info2.filterAddedTarget(card2, player2, target2, _status.event.preTarget);
          },
          forced: true,
          ai: (target2) => get.effect(target2, get.card(), player, _status.event.player)
        });
        next.set("_get_card", card);
        next.set("preTarget", target);
        const nextResult = await next.forResult();
        if (!isSelectionResultObject(nextResult)) {
          result = { bool: false };
        } else {
          result = nextResult;
        }
      } else {
        event.addedTargets.push(false);
        result = { bool: false };
      }
      if (result.bool && Array.isArray(result.targets) && result.targets[0]) {
        event.addedTargets.push(result.targets[0]);
        player.line2([target, result.targets[0]]);
      }
    }
  },
  async reverseOrder(event, trigger, player) {
    const { card } = event;
    await game.delay();
    let choice;
    if (get.tag(card, "multineg")) {
      choice = player.previous.side == player.side ? "逆时针" : "顺时针";
    } else {
      choice = player.next.side == player.side ? "逆时针" : "顺时针";
    }
    const result = await player.chooseControl({ controls: ["顺时针", "逆时针"], ai: (event2, player2) => _status.event.choice || "逆时针" }).set("prompt", `选择${get.translation(card)}的结算方向`).set("choice", choice).set("forceDie", true).forResult();
    if (typeof result !== "string" && result.control == "顺时针") {
      const evt = event.getParent(void 0, true);
      if (!evt) {
        throw new Error(`${event.name} event requires a parent to sort its targets.`);
      }
      const targets = evt.getTargets();
      const sorter = _status.currentPhase || player;
      evt.fixedSeat = true;
      targets.sortBySeat(sorter);
      targets.reverse();
      const lastTarget = targets[targets.length - 1];
      if (lastTarget == sorter) {
        targets.pop();
        targets.unshift(lastTarget);
      }
    }
  },
  async addJudgeCard(event) {
    const { card, cards } = event;
    const target = event.getTarget();
    if ((!card?.cards || !card.cards.some((card2) => get.position(card2, true) !== "o")) && target.canAddJudge(card)) {
      await target.addJudge(card, cards);
    }
  },
  async equipCard(event) {
    const { card } = event;
    const target = event.getTarget();
    if (!card?.cards || !card.cards.some((card2) => get.position(card2, true) !== "o")) {
      await target.equip(card);
    }
  }
};
export {
  phasingContent
};
