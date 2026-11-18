import "../../../../../noname.js";
import { readMaximumNumberOfPlayers } from "../../../playerLimit.js";
import { game } from "../../../../game/index.js";
import { get } from "../../../../get/binding.js";
import { ui } from "../../../../ui/index.js";
import { _status } from "../../../../status/index.js";
import { lib } from "../../../index.js";
function createModeGuozhanConfigGroup() {
  return {
    config: {
      update: function(config, map) {
        if (config.onlyguozhan) {
          map.junzhu.show();
        } else {
          map.junzhu.hide();
        }
        ui.aozhan_bgm = map.aozhan_bgm;
        map.aozhan_bgm._link.config.updatex.call(map.aozhan_bgm, []);
      },
      guozhan_mode: {
        name: "游戏模式",
        init: "normal",
        item: {
          normal: "势备",
          yingbian: "应变",
          old: "怀旧",
          free: "自由"
        },
        frequent: true,
        restart: true,
        intro: "<li>势备：默认模式，使用线下《君临天下·势备篇》的牌堆进行游戏。<br><li>应变：使用OL的应变国战牌堆进行游戏。<br><li>怀旧：使用传统国战的牌堆进行游戏。<br><li>自由：使用玩家的自定义牌堆进行游戏。"
      },
      player_number: {
        name: "游戏人数",
        init: "8",
        get item() {
          const minimumNumberOfPlayers = 2, maximumNumberOfPlayers = readMaximumNumberOfPlayers(_status, 12, minimumNumberOfPlayers), item = {};
          for (let playerNumber = minimumNumberOfPlayers; playerNumber <= maximumNumberOfPlayers; playerNumber++) {
            item[playerNumber] = `${get.cnNumber(playerNumber)}人`;
          }
          return item;
        },
        frequent: true,
        restart: true
      },
      aozhan: {
        name: "鏖战模式",
        init: true,
        frequent: true,
        restart: true,
        intro: "若开启此选项，则将在游戏中引入“鏖战模式”的规则：<br>当游戏中仅剩四名或更少角色时（七人以下游戏时改为三名或更少），若此时全场没有超过一名势力相同的角色，则从一个新的回合开始，游戏进入鏖战模式直至游戏结束。<br>◇在鏖战模式下，【桃】只能当做【杀】或【闪】使用或打出，不能用来回复体力。<br>注：进入鏖战模式后，即使之后有两名或者更多势力相同的角色出现，仍然不会取消鏖战模式。"
      },
      separatism: {
        name: "群雄割据",
        init: false,
        frequent: true,
        restart: true,
        intro: "开放不同势力组合，以优先亮出的武将牌作为自己的势力，双势力武将则使用列表的第一个势力"
      },
      banGroup: {
        name: "势力禁用",
        init: false,
        frequent: true,
        restart: true,
        intro: "选将前将随机禁用一个势力"
      },
      shenInGuozhan: {
        name: "神武将选择势力",
        init: false,
        frequent: true,
        restart: true,
        intro: `线下拓展包【国战无双】的机制，启用后神将势力规则改为：<span style="font-family:xinwei">
						<br>①神势力武将牌单独明置时，若当前势力为神或由神势力提供，可自选势力
						<br>②两张神势力武将牌同时明置时，可自选势力
						<br>③神势力武将牌和确定势力的武将牌A同时明置时，势力为A武将牌的势力`
      },
      initshow_draw: {
        name: "首亮奖励",
        item: {
          off: "关闭",
          draw: "摸牌",
          mark: "标记"
        },
        init: "mark",
        frequent: true,
        intro: "第一个明置身份牌的角色可获得摸牌奖励"
      },
      viewnext: {
        name: "观看下家副将",
        init: false,
        intro: "若开启此选项，所有的玩家将在挑选武将后，分发起始手牌之前，分别观看自己下家的副将。"
      },
      aozhan_bgm: {
        updatex: function() {
          this.lastChild.innerHTML = this._link.config.item[lib.config.mode_config.guozhan.aozhan_bgm];
          if (!Array.isArray(_status.aozhanBGMToRemove)) {
            return;
          }
          const menu = this._link.menu;
          for (let i = 0; i < menu.childElementCount; i++) {
            const link = menu.childNodes[i]._link;
            if (["disabled", "random"].includes(link) || !_status.aozhanBGMToRemove.includes(link)) {
              continue;
            }
            _status.aozhanBGMToRemove.remove(link);
            menu.childNodes[i].delete();
          }
        },
        name: "鏖战背景音乐",
        item: {
          disabled: "不启用",
          shousha: "逐鹿天下",
          online: "Online",
          rewrite: "Rewrite",
          chaoming: "潮鸣",
          random: "随机播放"
        },
        init: "rewrite",
        onclick(item) {
          game.saveConfig("aozhan_bgm", item, this._link.config.mode);
          if (_status._aozhan == true) {
            game.playBackgroundMusic();
          }
        }
      },
      zhulian: {
        name: "珠联璧合",
        init: true,
        // frequent:true,
        intro: "主将和副将都明置后，若为特定组合，可获得【珠联璧合】标记"
      },
      changeViceType: {
        name: "副将变更方式",
        init: "default",
        item: {
          default: "发现式",
          online: "随机式"
        },
        frequent: true,
        restart: true
      },
      onlyguozhan: {
        name: "使用国战武将",
        init: true,
        frequent: true,
        restart: true,
        intro: "开启武将技能将替换为国战版本并禁用非国战武将"
      },
      guozhanSkin: {
        name: "使用国战皮肤",
        init: true,
        frequent: true,
        restart: true,
        intro: "开启此选项后，将会把有国战专属皮肤的武将替换为国战皮肤"
      },
      junzhu: {
        name: "替换君主",
        init: true,
        // frequent:true,
        restart: true,
        intro: "若开启此选项，玩家的第一个回合开始时，若其主武将牌有对应的君主武将牌，则其可以将此武将牌替换为对应的君主武将牌，然后重新调整体力上限。若玩家的体力上限因此增大，则玩家回复等量的体力。"
      },
      jinEx: {
        name: "文德武备",
        init: true,
        restart: true,
        intro: "若开启此选项，晋势力武将将使用OL【文德武备】版本；否则使用线下【紫气东来】【受命于天】版本。"
      },
      double_hp: {
        name: "双将体力上限",
        init: "pingjun",
        item: {
          hejiansan: "和减三",
          pingjun: "平均值",
          zuidazhi: "最大值",
          zuixiaozhi: "最小值",
          zonghe: "相加"
        },
        restart: true
      },
      free_choose: {
        name: "自由选将",
        init: true,
        onclick(bool) {
          game.saveConfig("free_choose", bool, this._link.config.mode);
          if (get.mode() != this._link.config.mode || !_status.event.getParent().showConfig && !_status.event.showConfig) {
            return;
          }
          if (!ui.cheat2 && get.config("free_choose")) {
            ui.create.cheat2?.();
          } else if (ui.cheat2 && !get.config("free_choose")) {
            ui.cheat2.close();
            delete ui.cheat2;
          }
        }
      },
      onlyguozhanexpand: {
        name: "默认展开自由选将",
        init: false,
        restart: true,
        intro: "开启后自由选将对话框将默认显示全部武将"
      },
      change_identity: {
        name: "自由选择座位",
        init: true,
        onclick(bool) {
          game.saveConfig("change_identity", bool, this._link.config.mode);
          if (get.mode() != "guozhan" || !_status.event.getParent().showConfig && !_status.event.showConfig) {
            return;
          }
          var dialog;
          if (ui.cheat2 && ui.cheat2.backup) {
            dialog = ui.cheat2.backup;
          } else {
            dialog = _status.event.dialog;
          }
          if (!_status.brawl || !_status.brawl.noAddSetting) {
            if (!dialog.querySelector("table") && get.config("change_identity")) {
              _status.event.getParent().addSetting(dialog);
            } else {
              _status.event.getParent().removeSetting(dialog);
            }
          }
          ui.update();
        }
      },
      change_choice: {
        name: "开启换将卡",
        init: true,
        onclick(bool) {
          game.saveConfig("change_choice", bool, this._link.config.mode);
          if (get.mode() != "guozhan" || !_status.event.getParent().showConfig && !_status.event.showConfig) {
            return;
          }
          if (!ui.cheat && get.config("change_choice")) {
            ui.create.cheat?.();
          } else if (ui.cheat && !get.config("change_choice")) {
            ui.cheat.close();
            delete ui.cheat;
          }
        }
      },
      change_card: {
        name: "开启手气卡",
        init: "disabled",
        item: {
          disabled: "禁用",
          once: "一次",
          twice: "两次",
          unlimited: "无限"
        }
      },
      continue_game: {
        name: "显示再战",
        init: true,
        intro: "游戏结束后可选择用相同的武将再进行一局游戏",
        onclick(bool) {
          game.saveConfig("continue_game", bool, this._link.config.mode);
          if (get.config("continue_game") && get.mode() == "guozhan") {
            if (!ui.continue_game && _status.over && !_status.brawl && !game.no_continue_game) {
              ui.continue_game = ui.create.control("再战", game.reloadCurrent);
            }
          } else if (ui.continue_game) {
            ui.continue_game.close();
            delete ui.continue_game;
          }
        }
      },
      dierestart: {
        name: "死亡后显示重来",
        init: true,
        onclick(bool) {
          game.saveConfig("dierestart", bool, this._link.config.mode);
          if (get.config("dierestart") && get.mode() == "guozhan") {
            if (!ui.restart && game.getMe().isDead() && !_status.connectMode) {
              ui.restart = ui.create.control("restart", game.reload);
            }
          } else if (ui.restart) {
            ui.restart.close();
            delete ui.restart;
          }
        }
      },
      revive: {
        name: "死亡后显示复活",
        init: false,
        onclick(bool) {
          game.saveConfig("revive", bool, this._link.config.mode);
          if (get.config("revive") && get.mode() == "guozhan") {
            if (!ui.revive && game.getMe().isDead()) {
              ui.revive = ui.create.control("revive", ui.click.dierevive);
            }
          } else if (ui.revive) {
            ui.revive.close();
            delete ui.revive;
          }
        }
      },
      difficulty: {
        name: "AI对人类态度",
        init: "normal",
        item: {
          easy: "友好",
          normal: "一般",
          hard: "仇视"
        }
      },
      choice_num: {
        name: "候选武将数",
        init: "7",
        restart: true,
        item: {
          5: "五",
          6: "六",
          7: "七",
          8: "八",
          9: "九",
          10: "十"
        }
      }
    }
  };
}
export {
  createModeGuozhanConfigGroup
};
