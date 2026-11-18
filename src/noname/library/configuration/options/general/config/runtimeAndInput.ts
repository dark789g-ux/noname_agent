import { get } from "noname";
import { game } from "noname";
import { ui } from "noname";
import { lib } from "noname";

export function createGeneralRuntimeAndInputOptions() {
	return {
		low_performance: {
			name: "流畅模式",
			init: false,
			intro: "减少部分游戏特效，提高游戏速度",
			onclick(bool) {
				game.saveConfig("low_performance", bool);
				if (bool) {
					ui.window.classList.add("low_performance");
				} else {
					ui.window.classList.remove("low_performance");
				}
			},
		},
		compatible: {
			name: "兼容模式",
			init: true,
			intro: "提供部分即将废弃api的实现，使用老扩展时建议开启。<br/>注：这些api将在下个版本移除，扩展作者请关闭此选项以进行适配。（重启后生效）",
			restart: true,
		},
		ignore_error: {
			name: "无视报错",
			init: false,
			intro: "不以弹窗形式报错。<br/>注：此选项仅保证部分不影响运行的错误不会令游戏卡死，不保证报错后结算正常。影响游戏运行的错误请通知扩展作者适配。",
		},
		confirm_exit: {
			name: "确认退出",
			init: false,
			intro: "离开游戏前弹出确认对话框",
		},
		show_splash: {
			name: "显示开始界面",
			intro: "游戏开始前进入模式选择画面",
			init: "init",
			item: {
				off: "关闭",
				init: "首次启动",
				always: "保持开启",
			} as Record<string, string>,
		},
		game_speed: {
			name: "游戏速度",
			init: "mid",
			item: {
				vslow: "慢",
				slow: "较慢",
				mid: "中",
				fast: "较快",
				vfast: "快",
				vvfast: "很快",
			} as Record<string, string>,
			intro: "设置不同游戏操作间的时间间隔",
		},
		sync_speed: {
			name: "限制结算速度",
			intro: "在动画结算完成前不执行下一步操作，开启后游戏操作的间隔更长但画面更流畅，在游戏较卡时建议开启",
			init: true,
		},
		keep_awake: {
			name: "屏幕常亮",
			init: false,
			unfrequent: true,
			intro: "防止屏幕自动关闭<br>注：旧版本通过NoSleep.js实现的屏幕常亮可能会影响外置音频的音量",
			onclick(bool) {
				game.saveConfig("keep_awake", bool);
				const noSleep = window.noSleep;
				if (bool) {
					if (window.plugins && window.plugins.insomnia) {
						window.plugins.insomnia.keepAwake();
					} else if (noSleep) {
						document.addEventListener(
							lib.config.touchscreen ? "touchend" : "click",
							function enableNoSleepX() {
								document.removeEventListener(lib.config.touchscreen ? "touchend" : "click", enableNoSleepX, false);
								noSleep.enable();
							},
							false
						);
					}
				} else {
					if (window.plugins && window.plugins.insomnia) {
						window.plugins.insomnia.allowSleepAgain();
					} else if (noSleep) {
						noSleep.disable();
					}
				}
			},
		},
		mount_combine: {
			name: "合并坐骑栏",
			init: false,
			unfrequent: true,
			intro: "<li>将进攻坐骑栏和防御坐骑栏合并为同一个位置（重启后生效）。",
			restart: true,
		},
		auto_confirm: {
			name: "自动确认",
			init: true,
			unfrequent: true,
			intro: "当候选目标只有1个时，点击目标后无需再点击确认",
		},
		skip_shan: {
			name: "无闪自动取消",
			init: false,
			unfrequent: true,
			intro: "当自己需要使用或打出【闪】时，若自己没有【闪】，则跳过该步骤",
		},
		unauto_choose: {
			name: "拆顺手牌选择",
			init: false,
			unfrequent: true,
			intro: "拆牌或者顺牌时，就算只能选择对方的手牌依然手动选择",
		},
		wuxie_self: {
			name: "不无懈自己",
			init: true,
			unfrequent: true,
			intro: "自己使用的单目标普通锦囊即将生效时，不询问无懈",
		},
		tao_enemy: {
			name: "不对敌方出桃",
			init: false,
			intro: "双方阵营明确的模式中（如对决），敌方角色濒死时不询问出桃",
			unfrequent: true,
		},
		enable_drag: {
			name: "启用拖拽",
			init: true,
			intro: "按住卡牌后可将卡牌拖至目标",
			unfrequent: true,
		},
		enable_dragline: {
			name: "拖拽指示线",
			init: true,
			unfrequent: true,
			intro: "拖拽时显示虚线，可能降低游戏速度",
		},
		enable_touchdragline: {
			name: "拖拽指示线",
			init: false,
			unfrequent: true,
			intro: "拖拽时显示虚线，可能降低游戏速度",
		},
		// enable_pressure:{
		// 	name:'启用压感',
		// 	init:false,
		// 	intro:'开启后可通过按压执行操作',
		// 	unfrequent:true,
		// },
		// pressure_taptic:{
		// 	name:'触觉反馈',
		// 	init:false,
		// 	intro:'开启后按压操作执行时将产生震动',
		// 	unfrequent:true,
		// },
		// pressure_click:{
		// 	name:'按压操作',
		// 	init:'pause',
		// 	intro:'在空白区域按压时的操作',
		// 	unfrequent:true,
		// 	item:{
		// 		pause:'暂停',
		// 		config:'选项',
		// 		auto:'托管',
		// 	}
		// },
		touchscreen: {
			name: "触屏模式",
			init: false,
			restart: true,
			unfrequent: true,
			intro: "开启后可使触屏设备反应更快，但无法使用鼠标操作",
			onclick(bool) {
				if (get.is.nomenu("touchscreen", bool)) {
					return false;
				}
				game.saveConfig("touchscreen", bool);
			},
		},
		swipe: {
			name: "滑动手势",
			init: true,
			unfrequent: true,
			intro: "在非滚动区域向四个方向滑动可执行对应操作",
		},
		swipe_down: {
			name: "下划操作",
			init: "menu",
			unfrequent: true,
			intro: "向下滑动时执行的操作",
			item: {
				system: "显示按钮",
				menu: "打开菜单",
				pause: "切换暂停",
				auto: "切换托管",
				chat: "显示聊天",
				off: "关闭",
			} as Record<string, string>,
			onclick(item) {
				if (get.is.nomenu("swipe_down", item)) {
					return false;
				}
				game.saveConfig("swipe_down", item);
			},
		},
		swipe_up: {
			name: "上划操作",
			intro: "向上滑动时执行的操作",
			init: "auto",
			unfrequent: true,
			item: {
				system: "显示按钮",
				menu: "打开菜单",
				pause: "切换暂停",
				auto: "切换托管",
				chat: "显示聊天",
				off: "关闭",
			} as Record<string, string>,
			onclick(item) {
				if (get.is.nomenu("swipe_up", item)) {
					return false;
				}
				game.saveConfig("swipe_up", item);
			},
		},
		swipe_left: {
			name: "左划操作",
			intro: "向左滑动时执行的操作",
			init: "system",
			unfrequent: true,
			item: {
				system: "显示按钮",
				menu: "打开菜单",
				pause: "切换暂停",
				auto: "切换托管",
				chat: "显示聊天",
				off: "关闭",
			} as Record<string, string>,
			onclick(item) {
				if (get.is.nomenu("swipe_left", item)) {
					return false;
				}
				game.saveConfig("swipe_left", item);
			},
		},
		swipe_right: {
			name: "右划操作",
			intro: "向右滑动时执行的操作",
			init: "system",
			unfrequent: true,
			item: {
				system: "显示按钮",
				menu: "打开菜单",
				pause: "切换暂停",
				auto: "切换托管",
				chat: "显示聊天",
				off: "关闭",
			} as Record<string, string>,
			onclick(item) {
				if (get.is.nomenu("swipe_right", item)) {
					return false;
				}
				game.saveConfig("swipe_right", item);
			},
		},
		round_menu_func: {
			name: "触屏按钮操作",
			intro: "点击屏幕中圆形按钮时执行的操作",
			init: "system",
			unfrequent: true,
			item: {
				system: "显示按钮",
				menu: "打开菜单",
				pause: "切换暂停",
				auto: "切换托管",
			} as Record<string, string>,
			onclick(item) {
				if (get.is.nomenu("round_menu_func", item)) {
					return false;
				}
				game.saveConfig("round_menu_func", item);
			},
		},
		enable_vibrate: {
			name: "开启震动",
			intro: "回合开始时使手机震动",
			init: false,
		},
		right_click: {
			name: "右键操作",
			init: "pause",
			intro: "在空白区域点击右键时的操作",
			unfrequent: true,
			item: {
				pause: "暂停",
				shortcut: "工具",
				config: "选项",
				auto: "托管",
			} as Record<string, string>,
			onclick(item) {
				if (get.is.nomenu("right_click", item)) {
					return false;
				}
				game.saveConfig("right_click", item);
			},
		},
		longpress_info: {
			name: "长按显示信息",
			init: true,
			unfrequent: true,
			restart: true,
			intro: "长按后弹出菜单",
		},
		right_info: {
			name: "右键显示信息",
			init: true,
			unfrequent: true,
			restart: true,
			intro: "右键点击后弹出菜单",
		},
		hover_all: {
			name: "悬停显示信息",
			init: true,
			unfrequent: true,
			restart: true,
			intro: "悬停后弹出菜单",
		},
		hover_handcard: {
			name: "悬停手牌显示信息",
			init: true,
			unfrequent: true,
			intro: "悬停手牌后弹出菜单",
		},
	};
}
