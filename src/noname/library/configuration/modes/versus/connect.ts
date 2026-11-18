export function createModeVersusConnect() {
	return {
		update: function (config, map) {
			if (config.connect_versus_mode == "1v1") {
				map.connect_choice_num.show();
				map.connect_replace_number.show();
			} else {
				map.connect_choice_num.hide();
				map.connect_replace_number.hide();
			}
			if (config.connect_versus_mode == "2v2" || config.connect_versus_mode == "3v3") {
				map.connect_replace_handcard.show();
				if (config.connect_versus_mode == "2v2") {
					map.connect_olfeiyang_four.show();
				} else {
					map.connect_olfeiyang_four.hide();
				}
			} else {
				map.connect_replace_handcard.hide();
				map.connect_olfeiyang_four.hide();
			}
		},
		connect_versus_mode: {
			name: "游戏模式",
			init: "1v1",
			item: {
				"1v1": "1v1",
				"2v2": "2v2",
				"3v3": "3v3",
				"4v4": "4v4",
				guandu: "官渡",
			} as Record<string, string>,
			frequent: true,
		},
		connect_replace_handcard: {
			name: "四号位保护",
			init: true,
			frequent: true,
			intro: "最后行动的角色起始手牌数+1",
		},
		connect_olfeiyang_four: {
			name: "四号位获得【飞扬】",
			init: true,
			frequent: true,
			intro: "最后行动的角色获得技能【飞扬】（限定技，准备阶段，你可以弃置两张牌，然后弃置判定区的一张牌）",
		},
		connect_choice_num: {
			name: "候选武将数",
			init: "20",
			frequent: true,
			item: {
				12: "12人",
				16: "16人",
				20: "20人",
				24: "24人",
				40: "40人",
			} as Record<string, string>,
		},
		connect_replace_number: {
			name: "替补人数",
			init: "2",
			frequent: true,
			item: {
				0: "无",
				1: "1人",
				2: "2人",
				3: "3人",
				4: "4人",
				5: "5人",
			} as Record<string, string>,
		},
	};
}
