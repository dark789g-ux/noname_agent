import { get } from "noname";
import { game } from "noname";
import { _status } from "noname";
import { ui } from "noname";

export function createModeSingle() {
	return {
		name: "单挑",
		connect: {
			connect_single_mode: {
				name: "游戏模式",
				init: "normal",
				item: {
					normal: "新1v1",
					dianjiang: "点将单挑",
					changban: "血战长坂坡",
					wuxianhuoli: "无限火力",
				} as Record<string, string>,
				restart: true,
				frequent: true,
				intro: "血战长坂坡和无限火力模式详见帮助",
			},
			connect_enable_jin: {
				name: "启用晋势力武将",
				init: false,
				restart: true,
				frequent: true,
			},
			connect_change_card: {
				name: "启用手气卡",
				init: false,
				frequent: true,
			},
			connect_double_character: {
				name: "启用双将",
				init: "single",
				item: {
					single: "不启用",
					double: "启用双将",
					singble: "单双任选",
				} as Record<string, string>,
				restart: true,
			},
			connect_double_hp: {
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
			update: function (config, map) {
				if (config.connect_single_mode != "normal") {
					map.connect_enable_jin.hide();
				} else {
					map.connect_enable_jin.show();
				}
				if (config.connect_single_mode != "wuxianhuoli") {
					map.connect_change_card.hide();
				} else {
					map.connect_change_card.show();
				}
				if (config.connect_single_mode != "dianjiang") {
					map.connect_double_character.hide();
					map.connect_double_hp.hide();
				} else {
					map.connect_double_character.show();
					if (["double", "singble"].includes(config.connect_double_character)) {
						map.connect_double_hp.show();
					} else {
						map.connect_double_hp.hide();
					}
				}
			},
		},
		config: {
			single_mode: {
				name: "游戏模式",
				init: "normal",
				item: {
					normal: "新1v1",
					dianjiang: "点将单挑",
					changban: "血战长坂坡",
					wuxianhuoli: "无限火力",
				} as Record<string, string>,
				restart: true,
				frequent: true,
				intro: "血战长坂坡和无限火力模式详见帮助",
			},
			enable_jin: {
				name: "启用晋势力武将",
				init: false,
				restart: true,
				frequent: true,
			},
			change_card: {
				name: "开启手气卡",
				init: "disabled",
				item: {
					disabled: "禁用",
					once: "一次",
					twice: "两次",
					unlimited: "无限",
				} as Record<string, string>,
			},
			double_character: {
				name: "启用双将",
				init: "single",
				item: {
					single: "不启用",
					double: "启用双将",
					singble: "单双任选",
				} as Record<string, string>,
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
			single_control: {
				name: "单人控制",
				intro: "由玩家操作点将单挑的两名游戏角色",
				init: false,
				restart: true,
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
			update: function (config, map) {
				if (config.single_mode != "normal") {
					map.enable_jin.hide();
				} else {
					map.enable_jin.show();
				}
				if (config.single_mode != "wuxianhuoli") {
					map.change_card.hide();
				} else {
					map.change_card.show();
				}
				if (config.single_mode != "dianjiang") {
					map.double_character.hide();
					map.double_hp.hide();
					map.single_control.hide();
				} else {
					map.double_character.show();
					map.single_control.show();
					if (["double", "singble"].includes(config.double_character)) {
						map.double_hp.show();
					} else {
						map.double_hp.hide();
					}
				}
				if (config.single_mode == "wuxianhuoli" || config.single_mode == "dianjiang") {
					map.free_choose.show();
				} else {
					map.free_choose.hide();
				}
			},
		},
	};
}
