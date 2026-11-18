import { _status, game, get, lib } from "noname";

/** @type {Record<"zf_jishiyu" | "zf_jiyi" | "zf_jiyi2" | "zf_jiemeng" | "zf_jinnangji" | "zf_jingjijia" | "zf_jingyumoulve" | "zf_jingyumoulve2" | "zf_jueduiwuxie" | "zf_kuangbao" | "zf_kuangbao3" | "zf_kuangbao4" | "zf_kuangbao2" | "zf_laoguzhuangbei" | "zf_leihuoshi" | "zf_leihuoshi2" | "zf_leiming" | "zf_liebian" | "zf_liebian2" | "zf_liebian3" | "zf_miaoji" | "zf_miaoji2" | "zf_miaoshoukongkong" | "zf_mopai", import("../zhanfa.js").ZhanfaDefinition>} */
export const jishiyuEffects = {
	//及时雨
	zf_jishiyu: {
		rarity: "common",
		translate: "及时雨",
		info: "回合外失去最后一张手牌后，摸两张牌",
		card: {
			ai: { basic: { value: 4.9 } },
		},
		skill: {
			trigger: {
				player: "loseAfter",
				global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
			},
			filter(event, player) {
				if (player.countCards("h")) {
					return false;
				}
				const evt = event.getl(player);
				return evt && evt.player == player && evt.hs && evt.hs.length > 0 && _status.currentPhase != player;
			},
			async content(event, trigger, player) {
				await player.draw({ num: 2 });
			},
		},
	},
	//技艺Ⅰ
	zf_jiyi: {
		rarity: "rare",
		translate: "技艺Ⅰ",
		info: "当你的技能直接造成伤害时，此伤害+1",
		card: {
			ai: { basic: { value: 5.6 } },
		},
		skill: {
			inherit: "zf_anyDamage",
			filter(event, player) {
				return !event.card && !!game.findSkill(event);
			},
		},
	},
	//技艺Ⅱ
	zf_jiyi2: {
		rarity: "legend",
		translate: "技艺Ⅱ",
		info: "当你的技能直接造成伤害时，此伤害+2",
		card: {
			cardimage: "zf_jiyi",
			ai: { basic: { value: 6.6 } },
		},
		skill: {
			inherit: "zf_jiyi",
			num: 2,
		},
	},
	//结盟
	zf_jiemeng: {
		rarity: "rare",
		translate: "结盟",
		info: "你使用的【桃园结义】友方角色回复双倍体力",
		card: {
			ai: { basic: { value: 4 } },
		},
		skill: {
			trigger: { global: "recoverBegin" },
			filter(event, player) {
				return event.getPlayer().isFriendsOf(player, false) && event.getParent()?.name == "taoyuan" && event.getParent().player == player;
			},
			async content(event, trigger, player) {
				trigger.num = Number(trigger.num) * 2;
			},
		},
	},
	//锦囊计
	zf_jinnangji: {
		rarity: "rare",
		translate: "锦囊计",
		info: "手牌上限+X（X为本回合摸牌阶段摸牌数的一半）",
		card: {
			ai: { basic: { value: 5.9 } },
		},
		skill: {
			silent: true,
			trigger: { player: "phaseDrawAfter" },
			async content(event, trigger, player) {
				const num = player.getHistory("gain", evt => evt.getParent()?.name == "draw" && evt.getParent("phaseDraw") == trigger).reduce((sum, evt) => sum + evt.cards.length, 0);
				if (num) {
					player.addMark(event.name, Math.ceil(num / 2), false);
					player.when({ global: "phaseAfter" }).step(async (event, trigger, player) => {
						player.clearMark("zf_jinnangji", false);
					});
				}
			},
			mod: {
				maxHandcard(player, num) {
					return num + player.countMark("zf_jinnangji");
				},
			},
		},
	},
	//荆棘甲
	zf_jingjijia: {
		rarity: "legend",
		translate: "荆棘甲",
		info: "每次受到伤害后对伤害来源造成1点伤害",
		card: {
			ai: { basic: { value: 9.1 } },
		},
		skill: {
			inherit: "zf_directDamage",
			select: "source",
			filter(event, player) {
				return event.source?.isIn() && Number(event.num) > 0;
			},
		},
	},
	//精于谋略
	zf_jingyumoulve: {
		rarity: "rare",
		translate: "精于谋略",
		info: "你手牌数量少于4，你的【杀】伤害+1",
		card: {
			ai: { basic: { value: 5.8 } },
		},
		skill: {
			inherit: "zf_cardDamage",
			filter(event, player) {
				return event.card.name == "sha" && player.countCards("h") < 4;
			},
		},
	},
	//精于谋略Ⅱ
	zf_jingyumoulve2: {
		rarity: "epic",
		translate: "精于谋略Ⅱ",
		info: "你手牌数量少于6，你的【杀】伤害+1",
		card: {
			cardimage: "zf_jingyumoulve",
			ai: { basic: { value: 6.8 } },
		},
		skill: {
			inherit: "zf_cardDamage",
			filter(event, player) {
				return event.card.name == "sha" && player.countCards("h") < 6;
			},
		},
	},
	//绝对无懈
	zf_jueduiwuxie: {
		rarity: "common",
		translate: "绝对无懈",
		info: "其他角色无法响应你的【无懈可击】",
		card: {
			ai: { basic: { value: 5.2 } },
		},
		skill: {
			trigger: { player: "useCard" },
			filter(event, player) {
				return event.card.name == "wuxie";
			},
			async content(event, trigger, player) {
				if (Array.isArray(trigger.directHit)) {
					trigger.directHit.addArray(game.filterPlayer(target => target != player));
				}
			},
		},
	},
	//狂暴
	zf_kuangbao: {
		rarity: "common",
		translate: "狂暴",
		info: "当你的体力值不大于2时，你造成的伤害+1",
		card: {
			ai: { basic: { value: 6.5 } },
		},
		skill: {
			inherit: "zf_anyDamage",
			filter(event, player) {
				return player.getHp() <= 2;
			},
		},
	},
	//狂暴Ⅲ
	zf_kuangbao3: {
		rarity: "common",
		translate: "狂暴Ⅲ",
		info: "当你的体力值不大于3时，你摸牌数+1",
		card: {
			cardimage: "zf_kuangbao",
			ai: { basic: { value: 6.6 } },
		},
		skill: {
			inherit: "zf_phaseDraw",
			filter(event, player) {
				return !event.numFixed && player.getHp() <= 3;
			},
		},
	},
	//狂暴Ⅳ
	zf_kuangbao4: {
		rarity: "rare",
		translate: "狂暴Ⅳ",
		info: "当你的体力值不大于5时，你摸牌数+1",
		card: {
			cardimage: "zf_kuangbao",
			ai: { basic: { value: 7.3 } },
		},
		skill: {
			inherit: "zf_phaseDraw",
			filter(event, player) {
				return !event.numFixed && player.getHp() <= 5;
			},
		},
	},
	//狂暴Ⅱ
	zf_kuangbao2: {
		rarity: "epic",
		translate: "狂暴Ⅱ",
		info: "当你的体力值不大于3时，你造成的伤害+1",
		card: {
			cardimage: "zf_kuangbao",
			ai: { basic: { value: 7.2 } },
		},
		skill: {
			inherit: "zf_anyDamage",
			filter(event, player) {
				return player.getHp() <= 3;
			},
		},
	},
	//牢固装备
	zf_laoguzhuangbei: {
		rarity: "common",
		translate: "牢固装备",
		info: "你的装备不能被弃置",
		card: {
			ai: { basic: { value: 5.5 } },
		},
		skill: {
			mod: {
				canBeDiscarded(card) {
					if (get.position(card) == "e" && get.type(card) == "equip") {
						return false;
					}
				},
				cardDiscardable(card) {
					if (get.position(card) == "e" && get.type(card) == "equip") {
						return false;
					}
				},
			},
		},
	},
	//雷火势Ⅰ（雷火剑！）
	zf_leihuoshi: {
		rarity: "rare",
		translate: "雷火势Ⅰ",
		info: "每回合限一次，你使用的第一张属性【杀】伤害+1",
		card: {
			ai: { basic: { value: 5.9 } },
		},
		skill: {
			inherit: "zf_cardDamage",
			filter(event, player) {
				return player.getHistory("useCard", evt => evt.card.name == "sha" && !!evt.card.nature).indexOf(event) == 0;
			},
			usable: 1,
		},
	},
	//雷火势Ⅱ（雷火剑！）
	zf_leihuoshi2: {
		rarity: "legend",
		translate: "雷火势Ⅱ",
		info: "每回合限一次，你使用的第一张属性【杀】伤害+2",
		card: {
			cardimage: "zf_leihuoshi",
			ai: { basic: { value: 7 } },
		},
		skill: {
			inherit: "zf_leihuoshi",
			num: 2,
		},
	},
	//雷鸣
	zf_leiming: {
		rarity: "common",
		translate: "雷鸣",
		info: "所有角色在判定阶段都要进行一次【闪电】判定",
		card: {
			ai: { basic: { value: 5.6 } },
		},
		skill: {
			global: "zf_leiming_global",
			subSkill: {
				global: {
					silent: true,
					trigger: { player: "phaseJudgeBegin" },
					async content(event, trigger, player) {
						await player.executeDelayCardEffect("shandian");
					},
				},
			},
		},
	},
	//烈变
	zf_liebian: {
		rarity: "rare",
		translate: "烈变",
		info: "从第6轮开始，你的锦囊和技能造成的伤害+1",
		card: {
			ai: { basic: { value: 5.8 } },
		},
		skill: {
			inherit: "zf_anyDamage",
			filter(event, player) {
				if (game.roundNumber < 6) {
					return false;
				}
				return event.card ? get.type2(event.card) === "trick" : !!game.findSkill(event);
			},
		},
	},
	//烈变Ⅱ
	zf_liebian2: {
		rarity: "epic",
		translate: "烈变Ⅱ",
		info: "从第4轮开始，你的锦囊和技能造成的伤害+1",
		card: {
			cardimage: "zf_liebian",
			ai: { basic: { value: 6.8 } },
		},
		skill: {
			inherit: "zf_anyDamage",
			filter(event, player) {
				if (game.roundNumber < 4) {
					return false;
				}
				return event.card ? get.type2(event.card) === "trick" : !!game.findSkill(event);
			},
		},
	},
	//烈变Ⅲ
	zf_liebian3: {
		rarity: "legend",
		translate: "烈变Ⅲ",
		info: "从第2轮开始，你的锦囊和技能造成的伤害+1",
		card: {
			cardimage: "zf_liebian",
			ai: { basic: { value: 7.8 } },
		},
		skill: {
			inherit: "zf_anyDamage",
			filter(event, player) {
				if (game.roundNumber < 2) {
					return false;
				}
				return event.card ? get.type2(event.card) === "trick" : !!game.findSkill(event);
			},
		},
	},
	//妙技Ⅰ
	zf_miaoji: {
		rarity: "epic",
		translate: "妙技Ⅰ",
		info: "每回合首张锦囊造成的伤害+1",
		card: {
			ai: { basic: { value: 6.3 } },
		},
		skill: {
			inherit: "zf_cardDamage",
			filter(event, player) {
				return player.getHistory("useCard", evt => get.type2(evt.card) == "trick").indexOf(event) == 0 && get.is.damageCard(event.card);
			},
		},
	},
	//妙技Ⅱ
	zf_miaoji2: {
		rarity: "legend",
		translate: "妙技Ⅱ",
		info: "每回合前两张锦囊造成的伤害+1",
		card: {
			ai: { basic: { value: 7.6 } },
		},
		skill: {
			inherit: "zf_cardDamage",
			filter(event, player) {
				const index = player.getHistory("useCard", evt => get.type2(evt.card) == "trick").indexOf(event);
				return index >= 0 && index < 2 && get.is.damageCard(event.card);
			},
		},
	},
	//妙手空空
	zf_miaoshoukongkong: {
		rarity: "rare",
		translate: "妙手空空",
		info: "你使用的【顺手牵羊】无距离限制",
		card: {
			ai: { basic: { value: 5 } },
		},
		skill: {
			mod: {
				targetInRange(card, player) {
					if (get.name(card) == "shunshou") {
						return true;
					}
				},
			},
		},
	},
	//摸牌Ⅰ
	zf_mopai: {
		rarity: "rare",
		translate: "摸牌Ⅰ",
		info: "摸牌阶段，你的摸牌数+1",
		card: {
			ai: { basic: { value: 6.2 } },
		},
		skill: {
			inherit: "zf_phaseDraw",
		},
	},
};
