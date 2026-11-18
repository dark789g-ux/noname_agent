import { game } from "noname";

export function createModeDoudizhuNameGroup() {
	return {
		name: "斗地主",
		connect: {
			update: function (config, map) {
				if (config.connect_doudizhu_mode == "online") {
					map.connect_change_card.hide();
				} else {
					map.connect_change_card.show();
				}
				if (config.connect_doudizhu_mode !== "normal") {
					map.connect_double_character.hide();
					if (config.connect_doudizhu_mode !== "kaihei") {
						map.connect_choice_zhu.hide();
						map.connect_choice_fan.hide();
					} else {
						map.connect_choice_zhu.show();
						map.connect_choice_fan.show();
					}
					map.connect_enhance_dizhu.hide();
					map.connect_enhance_nongmin.hide();
					map.connect_feiyang_version.hide();
				} else {
					map.connect_double_character.show();
					map.connect_choice_zhu.show();
					map.connect_choice_fan.show();
					map.connect_enhance_dizhu.show();
					map.connect_enhance_nongmin.show();
					map.connect_feiyang_version.show();
				}
			},
			connect_doudizhu_mode: {
				name: "游戏模式",
				init: "normal",
				item: {
					normal: "休闲",
					kaihei: "开黑",
					huanle: "欢乐",
					binglin: "兵临",
					online: "智斗",
				} as Record<string, string>,
				restart: true,
				frequent: true,
			},
			connect_double_character: {
				name: "双将模式",
				init: false,
				frequent: true,
				restart: true,
			},
			connect_choice_zhu: {
				name: "地主候选武将数",
				init: 5,
				input: true,
				restart: true,
				onblur(e) {
					let text = e.target,
						num = Number(text.innerText);
					if (isNaN(num) || num < 1) {
						num = 1;
					} else if (!Number.isInteger(num)) {
						num = Math.round(num);
					}
					text.innerText = num;
					game.saveConfig("connect_choice_zhu", num, "doudizhu");
				},
			},
			connect_choice_fan: {
				name: "农民候选武将数",
				init: 3,
				input: true,
				restart: true,
				onblur(e) {
					let text = e.target,
						num = Number(text.innerText);
					if (isNaN(num) || num < 1) {
						num = 1;
					} else if (!Number.isInteger(num)) {
						num = Math.round(num);
					}
					text.innerText = num;
					game.saveConfig("connect_choice_fan", num, "doudizhu");
				},
			},
			connect_change_card: {
				name: "启用手气卡",
				init: false,
				frequent: true,
				restart: true,
			},
			connect_enhance_dizhu: {
				name: "加强地主",
				init: "disabled",
				restart: true,
				item: {
					disabled: "禁用",
					yinfu: "获得〖殷富〗",
					kaihei: "获得〖强易〗",
					qiangyi: "获得削弱〖强易〗",
					oldshiqiang: "获得〖恃强〗",
					shiqiang: "获得削弱〖恃强〗",
				} as Record<string, string>,
			},
			connect_enhance_nongmin: {
				name: "农民遗产",
				init: "mobile",
				restart: true,
				item: {
					online: "OL版本",
					mobile: "手杀版本",
					decade: "十周年版本",
				} as Record<string, string>,
			},
			connect_feiyang_version: {
				name: "〖飞扬〗版本",
				init: "online",
				restart: true,
				item: {
					online: "OL版本",
					mobile: "手杀版本",
					decade: "十周年版本",
				} as Record<string, string>,
			},
		},
	};
}
