import { _status, game, get, lib } from "noname";

/** @type {Record<"zf_yuanmou3" | "zf_yuanmou2" | "zf_zengshou" | "zf_zengshou2" | "zf_zhandouxuexi2" | "zf_zhandouxuexi3" | "zf_zhandouxuexi" | "zf_zhongjiji" | "zf_zhudao" | "zf_zhudao2" | "zf_zuiquan", import("../zhanfa.js").ZhanfaDefinition>} */
export const yuanmou3Effects = {
	//远谋Ⅲ
	zf_yuanmou3: {
		rarity: "common",
		translate: "远谋Ⅲ",
		info: "第2轮你的回合开始时，你回复2点体力",
		card: {
			cardimage: "zf_yuanmou",
			ai: { basic: { value: 6.5 } },
		},
		skill: {
			inherit: "zf_yuanmou",
			num: 2,
			filter(event, player) {
				return game.roundNumber == 2;
			},
		},
	},
	//远谋Ⅱ
	zf_yuanmou2: {
		rarity: "rare",
		translate: "远谋Ⅱ",
		info: "第3轮你的回合开始时，你回复3点体力",
		card: {
			cardimage: "zf_yuanmou",
			ai: { basic: { value: 7 } },
		},
		skill: {
			inherit: "zf_yuanmou",
			num: 3,
			filter(event, player) {
				return game.roundNumber == 3;
			},
		},
	},
	//增寿Ⅰ
	zf_zengshou: {
		rarity: "rare",
		translate: "增寿Ⅰ",
		info: "体力上限+1（不改变当前体力) ",
		card: {
			ai: { basic: { value: 6 } },
		},
		skill: {
			num: 1,
			inherit: "zf_onAdd",
			async callback(event, trigger, player) {
				const { num } = get.info(event.name);
				await player.gainMaxHp(num);
			},
		},
	},
	//增寿Ⅱ
	zf_zengshou2: {
		rarity: "legend",
		translate: "增寿Ⅱ",
		info: "体力上限+2（不改变当前体力) ",
		card: {
			ai: { basic: { value: 7 } },
		},
		skill: {
			inherit: "zf_zengshou",
			num: 2,
		},
	},
	//战斗学习Ⅱ
	zf_zhandouxuexi2: {
		rarity: "common",
		translate: "战斗学习Ⅱ",
		info: "从第4轮开始，你的出杀+1",
		card: {
			cardimage: "zf_zhandouxuexi",
			ai: { basic: { value: 6.2 } },
		},
		skill: {
			inherit: "zf_cardUsable",
			modNum(card, player, num) {
				if (card.name == "sha" && game.roundNumber >= 4) {
					return num + 1;
				}
			},
		},
	},
	//战斗学习Ⅲ
	zf_zhandouxuexi3: {
		rarity: "common",
		translate: "战斗学习Ⅲ",
		info: "从第7轮开始，你的出杀+1",
		card: {
			cardimage: "zf_zhandouxuexi",
			ai: { basic: { value: 5.3 } },
		},
		skill: {
			inherit: "zf_cardUsable",
			modNum(card, player, num) {
				if (card.name == "sha" && game.roundNumber >= 7) {
					return num + 1;
				}
			},
		},
	},
	//战斗学习
	zf_zhandouxuexi: {
		rarity: "rare",
		translate: "战斗学习",
		info: "从第3轮开始，你的出杀+1",
		card: {
			ai: { basic: { value: 6.7 } },
		},
		skill: {
			inherit: "zf_cardUsable",
			modNum(card, player, num) {
				if (card.name == "sha" && game.roundNumber >= 3) {
					return num + 1;
				}
			},
		},
	},
	//重击技
	zf_zhongjiji: {
		rarity: "common",
		translate: "重击技",
		info: "对敌方造成伤害一次大于等于3点时，摸一张牌",
		card: {
			ai: { basic: { value: 6.3 } },
		},
		skill: {
			inherit: "zf_anyDraw",
			filter(event, player) {
				return event.getPlayer().isEnemiesOf(player, false) && Number(event.num) >= 3;
			},
		},
	},
	//铸刀
	zf_zhudao: {
		rarity: "rare",
		translate: "铸刀",
		info: "	你使用【杀】后可以至多重铸一张牌",
		card: {
			ai: { basic: { value: 7.2 } },
		},
		skill: {
			select: 1,
			trigger: { player: "useCardAfter" },
			filter(event, player) {
				return event.card.name == "sha" && player.hasCard(card => player.canRecast(card), "he");
			},
			forced: false,
			async cost(event, trigger, player) {
				const skill = event.skill;
				if (!skill) {
					throw new TypeError("recast cost requires an event skill");
				}
				const { select } = get.info(skill);
				event.result = await player
					.chooseCard({
						prompt: get.prompt2(skill),
						selectCard: select,
						filterCard: (card, player) => player.canRecast(card),
						position: "he",
					})
					.set("ai", card => 6 - get.value(card))
					.forResult();
			},
			async content(event, trigger, player) {
				const { cards } = event;
				await player.recast(cards);
			},
		},
	},
	//铸刀Ⅱ
	zf_zhudao2: {
		rarity: "epic",
		translate: "铸刀Ⅱ",
		info: "	你使用【杀】后可以至多重铸两张牌",
		card: {
			cardimage: "zf_zhudao",
			ai: { basic: { value: 7.7 } },
		},
		skill: {
			inherit: "zf_zhudao",
			select: [1, 2],
		},
	},
	//醉拳
	zf_zuiquan: {
		rarity: "epic",
		translate: "醉拳",
		info: "【酒】【杀】不能被抵消",
		card: {
			ai: { basic: { value: 6.8 } },
		},
		skill: {
			trigger: { player: "useCard" },
			filter(event, player) {
				return event.card.name == "sha" && event.jiu;
			},
			async content(event, trigger, player) {
				trigger.customArgs.default.directHit2 = true;
			},
		},
	},
};
