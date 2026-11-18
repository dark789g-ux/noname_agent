import "../../../../noname.js";
import { game } from "../../../game/index.js";
import { _status } from "../../../status/index.js";
import { ui } from "../../../ui/index.js";
import { get } from "../../../get/binding.js";
function createModeStone() {
  return {
    name: "炉石",
    config: {
      // update:function(config,map){
      // 	if(config.stone_mode=='deck'){
      // 		// map.deck_length.show();
      // 		// map.deck_repeat.show();
      // 		map.random_length.hide();
      // 		map.skill_bar.show();
      // 	}
      // 	else{
      // 		// map.deck_length.hide();
      // 		// map.deck_repeat.hide();
      // 		map.random_length.show();
      // 		map.skill_bar.hide();
      // 	}
      // },
      // stone_mode:{
      // 	name:'游戏模式',
      // 	init:'deck',
      // 	item:{
      // 		deck:'构筑',
      // 		random:'随机'
      // 	},
      // 	restart:true,
      // 	frequent:true,
      // },
      // deck_length:{
      // 	name:'卡组长度',
      // 	init:'30',
      // 	item:{
      // 		'30':'30张',
      // 		'50':'50张',
      // 		'80':'80张',
      // 	},
      // 	frequent:true,
      // },
      // deck_repeat:{
      // 	name:'重复卡牌',
      // 	init:'2',
      // 	item:{
      // 		'2':'2张',
      // 		'3':'3张',
      // 		'5':'5张',
      // 		'80':'无限',
      // 	},
      // 	frequent:true,
      // },
      // random_length:{
      // 	name:'随从牌数量',
      // 	init:'1/80',
      // 	item:{
      // 		'1/120':'少',
      // 		'1/80':'中',
      // 		'1/50':'多',
      // 	},
      // 	frequent:true,
      // },
      battle_number: {
        name: "出场人数",
        init: "1",
        frequent: true,
        item: {
          1: "一人",
          2: "两人",
          3: "三人",
          4: "四人",
          6: "六人",
          8: "八人",
          10: "十人"
        },
        onclick(num) {
          game.saveConfig("battle_number", num, this._link.config.mode);
          if (_status.connectMode) {
            return;
          }
          if (!_status.event.getParent().showConfig && !_status.event.showConfig) {
            return;
          }
          if (_status.event.getParent().changeDialog) {
            _status.event.getParent().changeDialog();
          }
        }
      },
      mana_mode: {
        name: "行动值变化",
        init: "inc",
        item: {
          inf: "涨落",
          inc: "递增"
        },
        frequent: true
      },
      skill_bar: {
        name: "怒气值",
        init: true,
        frequent: true,
        restart: true
      },
      double_character: {
        name: "双将模式",
        init: false,
        frequent: true,
        restart: function() {
          return _status.event.getParent().name != "chooseCharacter" || _status.event.name != "chooseButton";
        }
      },
      free_choose: {
        name: "自由选将",
        init: true,
        onclick(bool) {
          game.saveConfig("free_choose", bool, this._link.config.mode);
          if (_status.connectMode) {
            return;
          }
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
      change_choice: {
        name: "开启换将卡",
        init: true,
        onclick(bool) {
          game.saveConfig("change_choice", bool, this._link.config.mode);
          if (_status.connectMode) {
            return;
          }
          if (!_status.event.getParent().showConfig && !_status.event.showConfig) {
            return;
          }
          if (!ui.cheat && get.config("change_choice")) {
            ui.create.cheat?.();
          } else if (ui.cheat && !get.config("change_choice")) {
            ui.cheat.close();
            delete ui.cheat;
          }
        }
      }
    }
  };
}
export {
  createModeStone
};
