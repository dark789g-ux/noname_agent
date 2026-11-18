/* eslint-disable no-var -- 保留原实现的函数作用域及 arguments 协议。 */
import { get } from "noname";
import { game } from "noname";
import { ui } from "noname";
import { lib } from "noname";

export function createAppearanceButtonsAndAnimationOptions() {
	return {
		custom_button: {
			name: "自定义按钮高度",
			init: false,
			unfrequent: true,
			onclick(bool) {
				if (bool !== "skip") {
					game.saveConfig("custom_button", bool);
				}
				if (ui.css.buttonsheet) {
					ui.css.buttonsheet.remove();
				}
				if (lib.config.custom_button) {
					var cbnum1 = 6 + (parseInt(lib.config.custom_button_system_top) || 0);
					var cbnum2 = 6 + (parseInt(lib.config.custom_button_system_bottom) || 0);
					var cbnum3 = 3 + (parseInt(lib.config.custom_button_control_top) || 0);
					var cbnum4 = 3 + (parseInt(lib.config.custom_button_control_bottom) || 0);
					var cbnum5 = 2;
					var cbnum6 = 2;
					if (cbnum3 < 0) {
						cbnum5 += cbnum3;
						cbnum3 = 0;
					}
					if (cbnum4 < 0) {
						cbnum6 += cbnum4;
						cbnum4 = 0;
					}
					ui.css.buttonsheet = lib.init.sheet("#system>div>div, .caption>div>.tdnode{padding-top:" + cbnum1 + "px !important;padding-bottom:" + cbnum2 + "px !important}", "#control>.control>div{padding-top:" + cbnum3 + "px;padding-bottom:" + cbnum4 + "px}", "#control>.control{padding-top:" + cbnum5 + "px;padding-bottom:" + cbnum6 + "px}");
				}
			},
		},
		custom_button_system_top: {
			name: "菜单上部高度",
			init: "0x",
			item: {
				"-5x": "-5px",
				"-4x": "-4px",
				"-3x": "-3px",
				"-2x": "-2px",
				"-1x": "-1px",
				"0x": "默认",
				"1x": "1px",
				"2x": "2px",
				"3x": "3px",
				"4x": "4px",
				"5x": "5px",
			} as Record<string, string>,
			unfrequent: true,
			onclick(item) {
				game.saveConfig("custom_button_system_top", item);
				lib.configMenu.appearence.config.custom_button.onclick("skip");
			},
		},
		custom_button_system_bottom: {
			name: "菜单下部高度",
			init: "0x",
			item: {
				"-5x": "-5px",
				"-4x": "-4px",
				"-3x": "-3px",
				"-2x": "-2px",
				"-1x": "-1px",
				"0x": "默认",
				"1x": "1px",
				"2x": "2px",
				"3x": "3px",
				"4x": "4px",
				"5x": "5px",
			} as Record<string, string>,
			unfrequent: true,
			onclick(item) {
				game.saveConfig("custom_button_system_bottom", item);
				lib.configMenu.appearence.config.custom_button.onclick("skip");
			},
		},
		custom_button_control_top: {
			name: "技能上部高度",
			init: "0x",
			item: {
				"-5x": "-5px",
				"-4x": "-4px",
				"-3x": "-3px",
				"-2x": "-2px",
				"-1x": "-1px",
				"0x": "默认",
				"1x": "1px",
				"2x": "2px",
				"3x": "3px",
				"4x": "4px",
				"5x": "5px",
			} as Record<string, string>,
			unfrequent: true,
			onclick(item) {
				game.saveConfig("custom_button_control_top", item);
				lib.configMenu.appearence.config.custom_button.onclick("skip");
			},
		},
		custom_button_control_bottom: {
			name: "技能下部高度",
			init: "0x",
			item: {
				"-5x": "-5px",
				"-4x": "-4px",
				"-3x": "-3px",
				"-2x": "-2px",
				"-1x": "-1px",
				"0x": "默认",
				"1x": "1px",
				"2x": "2px",
				"3x": "3px",
				"4x": "4px",
				"5x": "5px",
			} as Record<string, string>,
			unfrequent: true,
			onclick(item) {
				game.saveConfig("custom_button_control_bottom", item);
				lib.configMenu.appearence.config.custom_button.onclick("skip");
			},
		},
		radius_size: {
			name: "圆角大小",
			init: "default",
			item: {
				off: "关闭",
				reduce: "减小",
				default: "默认",
				increase: "增大",
			} as Record<string, string>,
			unfrequent: true,
			onclick(item) {
				game.saveConfig("radius_size", item);
				ui.window.dataset.radius_size = item;
			},
		},
		glow_phase: {
			name: "当前回合角色高亮",
			unfrequent: true,
			init: "green",
			intro: "设置当前回合角色的边框颜色",
			item: {
				none: "无",
				yellow: "黄色",
				green: "绿色",
				purple: "紫色",
			} as Record<string, string>,
			onclick(bool) {
				game.saveConfig("glow_phase", bool);
				lib.init.cssstyles();
			},
		},
		fold_card: {
			name: "折叠手牌",
			init: true,
			unfrequent: true,
		},
		fold_mode: {
			name: "折叠模式菜单",
			intro: "关闭后模式菜单中“更多”内的项目将直接展开",
			init: true,
			unfrequent: true,
		},
		seperate_control: {
			name: "分离选项条",
			init: true,
			unfrequent: true,
			intro: "开启后玩家在进行选择时不同的选项将分开，而不是连在一起",
		},
		blur_ui: {
			name: "模糊效果",
			intro: "在暂停或打开菜单时开启模糊效果",
			init: false,
			unfrequent: true,
			onclick(bool) {
				game.saveConfig("blur_ui", bool);
				if (bool) {
					ui.window.classList.add("blur_ui");
				} else {
					ui.window.classList.remove("blur_ui");
				}
			},
		},
		glass_ui: {
			name: "玻璃主题",
			intro: "为游戏主题打开玻璃效果（手机暂不支持）",
			init: false,
			unfrequent: true,
			onclick(bool) {
				game.saveConfig("glass_ui", bool);
				if (bool) {
					ui.window.classList.add("glass_ui");
				} else {
					ui.window.classList.remove("glass_ui");
				}
			},
		},
		damage_shake: {
			name: "伤害抖动",
			intro: "角色受到伤害时的抖动效果",
			init: true,
			unfrequent: true,
		},
		button_press: {
			name: "按钮效果",
			intro: "选项条被按下时将有按下效果",
			init: true,
			unfrequent: true,
		},
		jiu_effect: {
			name: "喝酒效果",
			init: true,
			unfrequent: true,
		},
		animation: {
			name: "游戏特效",
			intro: "开启后出现属性伤害、回复体力等情况时会显示动画",
			init: false,
			unfrequent: true,
		},
		spread_card: {
			name: "手牌展开",
			intro: "手牌折叠时，点击卡牌会展开周围的手牌",
			init: true,
			unfrequent: false,
		},
		card_animation_info: {
			name: "卡牌动画信息(Beta)",
			intro: "开启后会在卡牌动画中显示一些信息来源并启用虚拟牌动画(Beta测试功能，如遇异常可关闭该功能)",
			init: false,
			unfrequent: false,
		},
		animation_choose_to_move: {
			name: "移动卡牌动画",
			intro: "开启后将启用chooseToMove（观星类）的动画",
			init: true,
			unfrequent: false,
		},
		skill_animation_type: {
			name: "技能特效",
			intro: "开启后觉醒技、限定技将显示全屏文字",
			init: "default",
			unfrequent: true,
			item: {
				default: "默认",
				old: "旧版",
				off: "关闭",
			} as Record<string, string>,
		},
		die_move: {
			name: "阵亡效果",
			intro: "阵亡后武将的显示效果",
			init: "off",
			unfrequent: true,
			item: {
				off: "关闭",
				move: "移动",
				flip: "翻面",
			} as Record<string, string>,
		},
		target_shake: {
			name: "目标效果",
			intro: "一名玩家成为卡牌或技能的目标时的显示效果",
			init: "off",
			item: {
				off: "关闭",
				zoom: "缩放",
				shake: "抖动",
			} as Record<string, string>,
			unfrequent: true,
			onclick(bool) {
				game.saveConfig("target_shake", bool);
				ui.arena.dataset.target_shake = bool;
			},
		},
		turned_style: {
			name: "翻面文字",
			intro: "角色被翻面时显示“翻面”",
			init: true,
			unfrequent: true,
			onclick(bool) {
				game.saveConfig("turned_style", bool);
				if (bool) {
					ui.arena.classList.remove("hide_turned");
				} else {
					ui.arena.classList.add("hide_turned");
				}
			},
		},
		link_style2: {
			name: "横置样式",
			intro: "设置角色被横置时的样式",
			init: "chain",
			unfrequent: true,
			item: {
				chain: "铁索",
				rotate: "横置",
				mark: "标记",
			} as Record<string, string>,
			onclick(style) {
				var list: Player[] = [];
				for (var i = 0; i < game.players.length; i++) {
					if (game.players[i].isLinked()) {
						list.push(game.players[i]);
					}
				}
				game.saveConfig("link_style2", style);
				for (var i = 0; i < list.length; i++) {
					if (get.is.linked2(list[i])) {
						list[i].classList.add("linked2");
						list[i].classList.remove("linked");
					} else {
						list[i].classList.add("linked");
						list[i].classList.remove("linked2");
					}
				}
				if (style == "chain") {
					ui.arena.classList.remove("nolink");
				} else {
					ui.arena.classList.add("nolink");
				}
				ui.updatem();
			},
		},
	};
}
