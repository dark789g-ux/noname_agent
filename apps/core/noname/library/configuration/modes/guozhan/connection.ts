import { lib } from "noname";

export function createModeGuozhanNameGroup() {
	return {
		name: "国战",
		connect: {
			connect_guozhan_mode: {
				name: "游戏模式",
				init: "normal",
				item: {
					normal: "势备",
					yingbian: "应变",
					old: "怀旧",
				} as Record<string, string>,
				frequent: true,
				restart: true,
				intro: "<li>势备：默认模式，使用线下《君临天下·势备篇》的牌堆进行游戏。<br><li>应变：使用OL的应变国战牌堆进行游戏。<br><li>怀旧：使用传统国战的牌堆进行游戏。",
			},
			connect_player_number: {
				name: "游戏人数",
				init: "8",
				get item() {
					return lib.mode.guozhan.config.player_number.item;
				},
				frequent: true,
				restart: true,
			},
			connect_aozhan: {
				name: "鏖战模式",
				init: true,
				intro: "若开启此选项，则将在游戏中引入“鏖战模式”的规则：<br>当游戏中仅剩四名或更少角色时（七人以下游戏时改为三名或更少），若此时全场没有超过一名势力相同的角色，则从一个新的回合开始，游戏进入鏖战模式直至游戏结束。<br>◇在鏖战模式下，【桃】只能当做【杀】或【闪】使用或打出，不能用来回复体力。<br>注：进入鏖战模式后，即使之后有两名或者更多势力相同的角色出现，仍然不会取消鏖战模式。",
				frequent: true,
				restart: true,
			},
			get connect_separatism() {
				return lib.mode.guozhan.config.separatism;
			},
			get connect_shenInGuozhan() {
				return lib.mode.guozhan.config.shenInGuozhan;
			},
			connect_initshow_draw: {
				name: "首亮奖励",
				item: {
					off: "关闭",
					draw: "摸牌",
					mark: "标记",
				} as Record<string, string>,
				init: "mark",
				frequent: true,
				intro: "第一个明置武将牌的角色可获得首亮奖励",
			},
			connect_viewnext: {
				name: "观看下家副将",
				init: false,
				intro: "若开启此选项，所有的玩家将在挑选武将后，分发起始手牌之前，分别观看自己下家的副将。",
			},
			connect_zhulian: {
				name: "珠联璧合",
				init: true,
				// frequent:true,
				intro: "主将和副将都明置后，若为特定组合，可获得【珠联璧合】标记",
			},
			connect_junzhu: {
				name: "替换君主",
				init: true,
				// frequent:true,
				restart: true,
				intro: "若开启此选项，玩家的第一个回合开始时，若其主武将牌有对应的君主武将牌且场上没有同势力的君主，则其可以将此武将牌替换为对应的君主武将牌，然后重新调整体力上限。若玩家的体力上限因此增大，则玩家回复等量的体力。",
			},
			connect_jinEx: {
				name: "文德武备",
				init: true,
				restart: true,
				intro: "若开启此选项，晋势力武将将使用OL【文德武备】版本；否则使用线下【紫气东来】【受命于天】版本。",
			},
			connect_change_card: {
				name: "启用手气卡",
				init: false,
				frequent: true,
				restart: true,
			},
		},
	};
}
