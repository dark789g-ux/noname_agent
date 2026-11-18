import { _status, game, get, lib } from "noname";

/** @type {Record<"zf_chenqibubei" | "zf_chenqibubei2" | "zf_chijiuzhan" | "zf_chijiuzhan4" | "zf_chijiuzhan3" | "zf_cuixue" | "zf_cuixue2" | "zf_danliangboduo" | "zf_dangtouyibang" | "zf_dangtouyibang2" | "zf_dushu" | "zf_dushu2" | "zf_duanliangcao2" | "zf_duoduoyishan" | "zf_duoduoyishan2" | "zf_duoduoyishan3" | "zf_erlianji" | "zf_sanlianji" | "zf_ershengsan" | "zf_fanci" | "zf_fenjin" | "zf_fengshounian" | "zf_fuyiqusha" | "zf_fuyiquhuo", import("../zhanfa.js").ZhanfaDefinition>} */
export const chenqibubeiEffects = {
	//趁其不备
	zf_chenqibubei: {
		rarity: "epic",
		translate: "趁其不备",
		info: "你使用【过河拆桥】时，至多弃置目标两张牌",
		card: {
			ai: { basic: { value: 5.5 } },
		},
		skill: {
			trigger: { player: "discardPlayerCardBegin" },
			filter(event, player) {
				return event.getParent()?.name == "guohe";
			},
			num: 2,
			async content(event, trigger, player) {
				const num = get.info(event.name).num;
				const range = get.select(trigger.selectButton);
				if (range[1] < num && range[1] > 0) {
					range[1] = num;
					trigger.selectButton = range;
				}
			},
		},
	},
	//趁其不备Ⅱ
	zf_chenqibubei2: {
		rarity: "legend",
		translate: "趁其不备Ⅱ",
		info: "你使用【过河拆桥】时，至多弃置目标三张牌",
		card: {
			cardimage: "zf_chenqibubei",
			ai: { basic: { value: 7.5 } },
		},
		skill: {
			inherit: "zf_chenqibubei",
			num: 3,
		},
	},
	//持久战Ⅰ
	zf_chijiuzhan: {
		rarity: "common",
		translate: "持久战Ⅰ",
		info: "虎符数量达到3后，手牌上限+1",
		card: {
			ai: { basic: { value: 5.7 } },
		},
		skill: {
			inherit: "zf_maxHandcard",
			modNum: (player, num) => {
				if (player.countMark("danqi_hufu") >= 3) {
					return num + 1;
				}
			},
		},
	},
	//持久战Ⅳ
	zf_chijiuzhan4: {
		rarity: "rare",
		translate: "持久战Ⅳ",
		info: "虎符数量达到3后，出杀次数+1",
		card: {
			ai: { basic: { value: 6.3 } },
		},
		skill: {
			inherit: "zf_cardUsable",
			modNum(card, player, num) {
				if (card.name == "sha" && player.countMark("danqi_hufu") >= 3) {
					return num + 1;
				}
			},
		},
	},
	//持久战Ⅲ
	zf_chijiuzhan3: {
		rarity: "rare",
		translate: "持久战Ⅲ",
		info: "虎符数量达到7后，摸牌数+1",
		card: {
			ai: { basic: { value: 5.3 } },
		},
		skill: {
			inherit: "zf_phaseDraw",
			filter(event, player) {
				return player.countMark("danqi_hufu") >= 7;
			},
		},
	},
	//淬血
	zf_cuixue: {
		rarity: "rare",
		translate: "淬血",
		info: "你每轮【杀】首次造成伤害后摸一张牌",
		card: {
			ai: { basic: { value: 6.1 } },
		},
		skill: {
			inherit: "zf_anyDraw",
			filter(event, player) {
				return player.getRoundHistory("sourceDamage", evt => evt.card?.name == "sha").indexOf(event) == 0;
			},
		},
	},
	//淬血Ⅱ
	zf_cuixue2: {
		rarity: "epic",
		translate: "淬血Ⅱ",
		info: "你每轮【杀】首次造成伤害后摸两张牌",
		card: {
			cardimage: "zf_cuixue",
			ai: { basic: { value: 7.6 } },
		},
		skill: {
			inherit: "zf_cuixue",
			num: 2,
		},
	},
	//胆量剥夺
	zf_danliangboduo: {
		rarity: "epic",
		translate: "胆量剥夺",
		info: "敌方的出杀次数-1，最低为1",
		card: {
			ai: { basic: { value: 6.7 } },
		},
		skill: {
			global: "zf_danliangboduo_global",
			subSkill: {
				global: {
					charlotte: true,
					mod: {
						cardUsable(card, player, num) {
							if (card.name == "sha") {
								const count = player.getEnemies(target => target.hasSkill("zf_danliangboduo", null, null, false), false).length;
								if (count && typeof num === "number") {
									return Math.max(1, num - count);
								}
							}
						},
					},
				},
			},
		},
	},
	//当头一棒
	zf_dangtouyibang: {
		rarity: "epic",
		translate: "当头一棒",
		info: "每轮，你的首张【杀】伤害+1",
		card: {
			ai: { basic: { value: 7.5 } },
		},
		skill: {
			inherit: "zf_cardDamage",
			filter(event, player) {
				return player.getRoundHistory("useCard", evt => evt.card.name == "sha").indexOf(event) == 0;
			},
		},
	},
	//当头一棒Ⅱ
	zf_dangtouyibang2: {
		rarity: "legend",
		translate: "当头一棒Ⅱ",
		info: "每轮，你的首张【杀】伤害+2",
		card: {
			cardimage: "zf_dangtouyibang",
			ai: { basic: { value: 8.5 } },
		},
		skill: {
			inherit: "zf_dangtouyibang",
			num: 2,
		},
	},
	//赌术
	zf_dushu: {
		rarity: "common",
		translate: "赌术",
		info: "	你的拼点牌点数+3（最大为K）",
		card: {
			ai: { basic: { value: 4.5 } },
		},
		skill: {
			trigger: {
				player: "compare",
				target: "compare",
			},
			filter(event, player) {
				if (event.player == player) {
					return !event.iwhile;
				}
				return true;
			},
			num: 3,
			async content(event, trigger, player) {
				const { num } = get.info(event.name);
				if (player == trigger.player) {
					trigger.num1 += num;
					if (trigger.num1 > 13) {
						trigger.num1 = 13;
					}
				} else {
					trigger.num2 += num;
					if (trigger.num2 > 13) {
						trigger.num2 = 13;
					}
				}
				game.log(player, `的拼点牌点数+${num}`);
			},
		},
	},
	//赌术Ⅱ
	zf_dushu2: {
		rarity: "rare",
		translate: "赌术Ⅱ",
		info: "	你的拼点牌点数+6（最大为K）",
		card: {
			ai: { basic: { value: 4.8 } },
		},
		skill: {
			inherit: "zf_dushu",
			num: 6,
		},
	},
	//断粮草Ⅱ
	zf_duanliangcao2: {
		rarity: "epic",
		translate: "断粮草Ⅱ",
		info: "敌方摸牌数-1，最低为2",
		card: {
			ai: { basic: { value: 6.2 } },
		},
		skill: {
			global: "zf_duanliangcao2_global",
			subSkill: {
				global: {
					silent: true,
					trigger: { player: "phaseDrawBegin2" },
					filter(event, player) {
						return !event.numFixed;
					},
					async content(event, trigger, player) {
						const num = player.getEnemies(target => target.hasSkill("zf_duanliangcao2", null, null, false), false).length;
						trigger.num = Math.max(2, Number(trigger.num) - num);
					},
				},
			},
		},
	},
	//多多益善
	zf_duoduoyishan: {
		rarity: "common",
		translate: "多多益善",
		info: "每回合你第5次摸牌后,你摸一张牌",
		card: {
			ai: { basic: { value: 5.8 } },
		},
		skill: {
			inherit: "zf_anyDraw",
			trigger: { player: "drawEnd" },
			filter(event, player) {
				return (
					player
						.getHistory("gain", evt => evt.getParent()?.name == "draw")
						.map(evt => evt.getParent())
						.indexOf(event) == 4
				);
			},
		},
	},
	//多多益善Ⅱ
	zf_duoduoyishan2: {
		rarity: "rare",
		translate: "多多益善Ⅱ",
		info: "每回合你第3次摸牌后,你摸一张牌",
		card: {
			cardimage: "zf_duoduoyishan",
			ai: { basic: { value: 6.7 } },
		},
		skill: {
			inherit: "zf_duoduoyishan",
			filter(event, player) {
				return (
					player
						.getHistory("gain", evt => evt.getParent()?.name == "draw")
						.map(evt => evt.getParent())
						.indexOf(event) == 2
				);
			},
		},
	},
	//多多益善Ⅲ
	zf_duoduoyishan3: {
		rarity: "legend",
		translate: "多多益善Ⅲ",
		info: "每回合你第3次摸牌后,你摸两张牌",
		card: {
			cardimage: "zf_duoduoyishan",
			ai: { basic: { value: 7.4 } },
		},
		skill: {
			inherit: "zf_duoduoyishan2",
			num: 2,
		},
	},
	//二连击
	zf_erlianji: {
		rarity: "rare",
		translate: "二连击",
		info: "你的出牌阶段，你的出杀次数+1",
		card: {
			ai: { basic: { value: 7 } },
		},
		skill: {
			inherit: "zf_cardUsable",
			cardFilter: "sha",
		},
	},
	//三连击
	zf_sanlianji: {
		rarity: "legend",
		translate: "三连击",
		info: "你的出牌阶段，你的出杀次数+2",
		card: {
			cardimage: "zf_erlianji",
			ai: { basic: { value: 8.6 } },
		},
		skill: {
			inherit: "zf_erlianji",
			modNum: 2,
		},
	},
	//二生三
	zf_ershengsan: {
		rarity: "common",
		translate: "二生三",
		info: "【无中生有】额外摸1张牌",
		card: {
			ai: { basic: { value: 5.2 } },
		},
		skill: {
			trigger: { player: "drawBegin" },
			filter(event, player) {
				return event.getParent()?.name == "wuzhong";
			},
			async content(event, trigger, player) {
				trigger.num = Number(trigger.num) + 1;
			},
		},
	},
	//反刺
	zf_fanci: {
		rarity: "legend",
		translate: "反刺",
		info: "每回合首次受到伤害后对所有敌方造成1点伤害",
		card: {
			ai: { basic: { value: 8.7 } },
		},
		skill: {
			inherit: "zf_directDamage",
			filter(event, player) {
				return player.getHistory("damage", evt => Number(evt.num) > 0).indexOf(event) == 0 && player.getEnemies(() => true, false).length;
			},
			select: "all",
		},
	},
	//奋进
	zf_fenjin: {
		rarity: "common",
		translate: "奋进",
		info: "当体力大于2点，回合开始时失去1点体力并摸两张牌",
		card: {
			ai: { basic: { value: 4.2 } },
		},
		skill: {
			trigger: { player: "phaseBegin" },
			filter(event, player) {
				return player.getHp() > 2;
			},
			async content(event, trigger, player) {
				await player.loseHp();
				await player.draw({ num: 2 });
			},
		},
	},
	//丰收年
	zf_fengshounian: {
		rarity: "rare",
		translate: "丰收年",
		info: "你使用的【五谷丰登】仅友方角色可以获得牌",
		card: {
			ai: { basic: { value: 5.1 } },
		},
		skill: {
			trigger: { player: "useCard" },
			filter(event, player) {
				return event.card.name == "wugu";
			},
			async content(event, trigger, player) {
				const targets = player.getEnemies(target => trigger.getTargets().includes(target), false);
				trigger.excluded.addArray(targets);
			},
		},
	},
	//拂衣去杀
	zf_fuyiqusha: {
		rarity: "rare",
		translate: "拂衣去·杀",
		info: "你的回合开始时，你获得一张【杀】",
		card: {
			ai: { basic: { value: 5.9 } },
		},
		skill: {
			inherit: "zf_anyGain",
			cardFilter: "sha",
		},
	},
	//拂衣去火
	zf_fuyiquhuo: {
		rarity: "rare",
		translate: "拂衣去·火",
		info: "你的回合开始时，你获得一张【火攻】",
		card: {
			cardimage: "zf_fuyiqusha",
			ai: { basic: { value: 5 } },
		},
		skill: {
			inherit: "zf_anyGain",
			cardFilter: "huogong",
		},
	},
};
