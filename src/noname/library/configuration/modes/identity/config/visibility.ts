/* eslint-disable no-var -- 保留原实现的函数作用域及 arguments 协议。 */
import { get } from "noname";
import { game } from "noname";
import { _status } from "noname";
import { ui } from "noname";
import { readMaximumNumberOfPlayers } from "@/library/playerLimit.js";

export function createIdentityVisibilityOptions() {
	return {
		update: function (config, map) {
			if (config.identity_mode == "stratagem") {
				map.round_one_use_fury.show();
				map.nei_auto_mark_camouflage.show();
			} else {
				map.round_one_use_fury.hide();
				map.nei_auto_mark_camouflage.hide();
			}
			if (config.identity_mode == "zhong") {
				map.player_number.hide();
				map.enhance_zhu.hide();
				map.enable_mingcha.hide();
				map.double_nei.hide();
				map.auto_identity.hide();
				map.choice_zhu.hide();
				map.limit_zhu.hide();
				map.choice_zhong.hide();
				map.choice_nei.hide();
				map.choice_fan.hide();
				map.enable_commoner.hide();
				map.choice_commoner.hide();
				map.enable_year_limit.show();
				map.ban_identity.hide();
				map.ban_identity2.hide();
				map.ban_identity3.hide();
				map.zhong_card.show();
				map.special_identity.hide();
				map.choose_group.show();
				map.change_choice.show();
				map.auto_mark_identity.show();
				map.double_character.show();
				map.free_choose.show();
				map.change_identity.show();
				if (config.double_character) {
					map.double_hp.show();
				} else {
					map.double_hp.hide();
				}
				map.continue_game.show();
			} else if (config.identity_mode == "stratagem") {
				map.continue_game.show();
				map.player_number.show();
				map.enhance_zhu.hide();
				map.enable_mingcha.hide();
				map.auto_identity.hide();
				if (config.player_number != "2") {
					map.double_nei.show();
				} else {
					map.double_nei.hide();
				}
				map.choice_zhu.show();
				map.limit_zhu.hide();
				map.choice_zhong.show();
				map.choice_nei.show();
				map.choice_fan.show();
				map.enable_commoner.hide();
				map.choice_commoner.hide();
				map.enable_year_limit.show();
				map.ban_identity.show();
				if (config.ban_identity == "off") {
					map.ban_identity2.hide();
				} else {
					map.ban_identity2.show();
				}
				if (config.ban_identity == "off" || config.ban_identity2 == "off") {
					map.ban_identity3.hide();
				} else {
					map.ban_identity3.show();
				}
				map.zhong_card.hide();
				map.choose_group.show();
				map.auto_mark_identity.hide();
				map.change_choice.show();
				map.free_choose.show();
				map.change_identity.show();
				map.special_identity.hide();
				map.double_character.show();
				if (config.double_character) {
					map.double_hp.show();
				} else {
					map.double_hp.hide();
				}
			} else if (config.identity_mode == "purple") {
				map.player_number.hide();
				map.enhance_zhu.hide();
				map.enable_mingcha.hide();
				map.double_nei.hide();
				map.auto_identity.hide();
				map.choice_zhu.hide();
				map.limit_zhu.hide();
				map.choice_zhong.hide();
				map.choice_nei.hide();
				map.choice_fan.hide();
				map.enable_commoner.hide();
				map.choice_commoner.hide();
				map.enable_year_limit.hide();
				map.ban_identity.hide();
				map.ban_identity2.hide();
				map.ban_identity3.hide();
				map.zhong_card.hide();
				map.special_identity.hide();
				map.double_character.hide();
				map.double_hp.hide();
				map.choose_group.hide();
				map.auto_mark_identity.hide();
				map.change_choice.hide();
				map.free_choose.hide();
				map.change_identity.hide();
				map.continue_game.hide();
			} else {
				map.continue_game.show();
				map.player_number.show();
				map.enhance_zhu.show();
				map.enable_mingcha.show();
				map.auto_identity.show();
				map.double_nei[config.player_number != "2" && !config.enable_commoner ? "show" : "hide"]();
				map.choice_zhu.show();
				map.limit_zhu.show();
				map.choice_zhong.show();
				map.choice_nei.show();
				map.choice_fan.show();
				map.enable_commoner[config.player_number != "2" && !config.double_nei ? "show" : "hide"]();
				map.choice_commoner[config.enable_commoner ? "show" : "hide"]();
				map.enable_year_limit.show();
				map.ban_identity.show();
				if (config.ban_identity == "off") {
					map.ban_identity2.hide();
				} else {
					map.ban_identity2.show();
				}
				if (config.ban_identity == "off" || config.ban_identity2 == "off") {
					map.ban_identity3.hide();
				} else {
					map.ban_identity3.show();
				}
				map.zhong_card.hide();
				map.choose_group.show();
				map.auto_mark_identity.show();
				map.change_choice.show();
				map.free_choose.show();
				map.change_identity.show();
				if (config.player_number == "8") {
					map.special_identity.show();
				} else {
					map.special_identity.hide();
				}
				map.double_character.show();
				if (config.double_character) {
					map.double_hp.show();
				} else {
					map.double_hp.hide();
				}
			}
		},
		identity_mode: {
			name: "游戏模式",
			init: "normal",
			item: {
				normal: "标准",
				zhong: "明忠",
				stratagem: "谋攻",
				purple: "3v3v2",
			} as Record<string, string>,
			restart: true,
			frequent: true,
			intro: "明忠模式与谋攻模式详见帮助",
		},
		player_number: {
			name: "游戏人数",
			init: "8",
			get item() {
				const minimumNumberOfPlayers = 2,
					maximumNumberOfPlayers = readMaximumNumberOfPlayers(_status, 10, minimumNumberOfPlayers),
					item = {};
				for (let playerNumber = minimumNumberOfPlayers; playerNumber <= maximumNumberOfPlayers; playerNumber++) {
					item[playerNumber] = `${get.cnNumber(playerNumber)}人`;
				}
				return item;
			},
			frequent: true,
			restart: true,
		},
		double_nei: {
			name: "双内奸",
			init: false,
			restart: true,
			frequent: true,
			intro: "若游戏人数不大于9，则开启后游戏中将有两个内奸（内奸胜利条件仍为主内1v1时击杀主公）",
		},
		choose_group: {
			name: "神武将选择势力",
			init: true,
			restart: true,
			frequent: true,
			intro: "若开启此选项，选择神武将的玩家需在亮出自己的武将牌之前为自己选择一个势力。",
		},
		nei_fullscreenpop: {
			name: "主内单挑特效",
			intro: "在进入主内单挑时，弹出全屏文字特效",
			init: true,
			unfrequent: true,
		},
		double_character: {
			name: "双将模式",
			init: false,
			frequent: true,
			restart: true,
		},
		special_identity: {
			name: "特殊身份",
			init: false,
			restart: true,
			frequent: true,
			intro: "开启后游戏中将增加军师、大将、贼首三个身份",
		},
		zhong_card: {
			name: "明忠卡牌替换",
			init: true,
			frequent: true,
			restart: true,
		},
		double_hp: {
			name: "双将体力上限",
			init: "pingjun",
			item: {
				hejiansan: "和减三",
				pingjun: "平均值",
				zuidazhi: "最大值",
				zuixiaozhi: "最小值",
				zonghe: "相加",
			} as Record<string, string>,
			restart: true,
		},
		auto_identity: {
			name: "自动显示身份",
			item: {
				off: "关闭",
				one: "一轮",
				two: "两轮",
				three: "三轮",
				always: "始终",
			} as Record<string, string>,
			init: "off",
			onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode, bool) {
				game.saveConfig("auto_identity", bool, this._link.config.mode);
				if (get.config("identity_mode") == "zhong") {
					return;
				}
				var num;
				switch (bool) {
					case "一轮":
						num = 1;
						break;
					case "两轮":
						num = 2;
						break;
					case "三轮":
						num = 3;
						break;
					default:
						num = 0;
						break;
				}
				if (num & +!_status.identityShown && game.phaseNumber > game.players.length * num && game.showIdentity) {
					_status.identityShown = true;
					game.showIdentity(false);
				}
			},
			intro: "游戏进行若干轮将自动显示所有角色的身份",
		},
		auto_mark_identity: {
			name: "自动标记身份",
			init: false,
			intro: "根据角色的出牌行为自动标记可能的身份",
		},
		enhance_zhu: {
			name: "加强主公",
			init: "off",
			item: {
				off: "关闭",
				sixiang: "四象标记",
				specific: "专属技能",
			} as Record<string, string>,
			restart: true,
			intro: "为主公增加一个额外技能。<br><li>四象标记：主公随机获得一个四象标记（限发动一次）；每个回合结束时，若场上没有反贼，主公失去此标记。<br><li>专属技能：至少三名反贼的身份场，主公获得一个专属技能（无则改为〖天命〗）；一名角色阵亡后，若存活反贼数小于3，主公失去此技能。",
		},
		free_choose: {
			name: "自由选将",
			init: true,
			onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode, bool) {
				game.saveConfig("free_choose", bool, this._link.config.mode);
				if (get.mode() != this._link.config.mode || (!_status.event.getParent().showConfig && !_status.event.showConfig)) {
					return;
				}
				if (!ui.cheat2 && get.config("free_choose")) {
					ui.create.cheat2?.();
				} else if (ui.cheat2 && !get.config("free_choose")) {
					ui.cheat2.close();
					delete ui.cheat2;
				}
			},
		},
		change_identity: {
			name: "自由选择身份和座位",
			init: true,
			onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode, bool) {
				game.saveConfig("change_identity", bool, this._link.config.mode);
				if (get.mode() != "identity" || (!_status.event.getParent().showConfig && !_status.event.showConfig)) {
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
			},
		},
	};
}
