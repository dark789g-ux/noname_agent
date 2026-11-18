import { _status, game, get, lib } from "noname";

/** @type {Record<"zf_xushi" | "zf_xuezhan" | "zf_xuezhan2" | "zf_xuezhan3" | "zf_yanxian" | "zf_yaoli" | "zf_yaoli3" | "zf_yaoli4" | "zf_yaoli2" | "zf_yinyangshufa" | "zf_yingjifangan" | "zf_yingjizhanshu" | "zf_yingjizhanlve" | "zf_yongzhan" | "zf_yongzhan2" | "zf_yuzhanyuyong3" | "zf_yuzhanyuyong2" | "zf_yuzhanyuyong" | "zf_yuanzhu" | "zf_yuanzhu2" | "zf_yuanzhu3" | "zf_yuanjiji" | "zf_yuanmou", import("../zhanfa.js").ZhanfaDefinition>} */
export const xushiEffects = {
	//蓄势
	zf_xushi: {
		rarity: "rare",
		translate: "蓄势",
		info: "本回合没出杀，则下回合杀伤害+1（最多+1）",
		card: {
			ai: { basic: { value: 6 } },
		},
		skill: {
			inherit: "zf_cardDamage",
			filter(event, player) {
				if (event.card.name != "sha" || _status.currentPhase != player || player.actionHistory.length < 2) {
					return false;
				}
				/** @type {false | ActionHistory} */
				let history = false;
				for (let i = player.actionHistory.length - 2; i >= 0; i--) {
					if (player.actionHistory[i]?.isMe) {
						history = player.actionHistory[i];
						break;
					}
				}
				return history && !history["useCard"]?.some(evt => evt.card.name == "sha");
			},
		},
	},
	//血战Ⅰ
	zf_xuezhan: {
		rarity: "common",
		translate: "血战Ⅰ",
		info: "体力上限-1（最低为1），每轮开始时回复1点体力",
		card: {
			ai: { basic: { value: 6.3 } },
		},
		skill: {
			inherit: "zf_loseMaxHp",
			onremove(player, skill) {
				player.addTempSkill(`${skill}_onremove`);
				player.removeSkill(`${skill}_effect`);
			},
			getNum(event, player, target) {
				const { num } = get.info(event.name);
				return Math.min(target.maxHp - 1, num);
			},
			async callback(event, player, target) {
				target.addSkill(`${event.name}_effect`);
				target.setMark(`${event.name}_effect`, get.info(event.name).num, false);
			},
			num: 1,
			subSkill: {
				effect: {
					charlotte: true,
					onremove: true,
					trigger: { global: "roundStart" },
					async content(event, trigger, player) {
						await player.recover({ num: player.countMark(event.name) });
					},
				},
				onremove: {
					inherit: "zf_loseMaxHp_onremove",
				},
			},
		},
	},
	//血战Ⅱ
	zf_xuezhan2: {
		rarity: "rare",
		translate: "血战Ⅱ",
		info: "体力上限-2（最低为1），每轮开始时回复2点体力",
		card: {
			cardimage: "zf_xuezhan",
			ai: { basic: { value: 5.6 } },
		},
		skill: {
			inherit: "zf_xuezhan",
			num: 2,
		},
	},
	//血战Ⅲ
	zf_xuezhan3: {
		rarity: "legend",
		translate: "血战Ⅲ",
		info: "体力上限-3（最低为1），每轮开始时回复3点体力",
		card: {
			cardimage: "zf_xuezhan",
			ai: { basic: { value: 4.3 } },
		},
		skill: {
			inherit: "zf_xuezhan",
			num: 3,
		},
	},
	//眼线
	zf_yanxian: {
		rarity: "common",
		translate: "眼线",
		info: "【过河拆桥】时目标手牌可见",
		card: {
			ai: { basic: { value: 6.2 } },
		},
		skill: {
			trigger: { player: "discardPlayerCardBegin" },
			filter(event, player) {
				return event.getParent()?.name == "guohe";
			},
			async content(event, trigger, player) {
				trigger.set("visible", true);
			},
		},
	},
	//药理
	zf_yaoli: {
		rarity: "epic",
		translate: "药理",
		info: "每回合首次回复体力时，额外回复1点",
		card: {
			ai: { basic: { value: 6.5 } },
		},
		skill: {
			trigger: { player: "recoverBegin" },
			filter(event, player) {
				return game.getGlobalHistory("everything", evt => evt.name == "recover" && evt.player == player).indexOf(event) == 0;
			},
			num: 1,
			async content(event, trigger, player) {
				trigger.num += get.info(event.name).num;
			},
		},
	},
	//药理
	zf_yaoli3: {
		rarity: "epic",
		translate: "药理",
		info: "回复体力时，额外回复1点",
		card: {
			cardimage: "zf_yaoli",
			ai: { basic: { value: 7.5 } },
		},
		skill: {
			inherit: "zf_yaoli",
			filter(event, player) {
				return true;
			},
		},
	},
	//药理
	zf_yaoli4: {
		rarity: "legend",
		translate: "药理",
		info: "每回合前3次回复体力时，额外回复1点",
		card: {
			cardimage: "zf_yaoli",
			ai: { basic: { value: 7.2 } },
		},
		skill: {
			inherit: "zf_yaoli",
			filter(event, player) {
				const index = game.getGlobalHistory("everything", evt => evt.name == "recover" && evt.player == player).indexOf(event);
				return index >= 0 && index < 3;
			},
		},
	},
	//药理Ⅱ
	zf_yaoli2: {
		rarity: "legend",
		translate: "药理Ⅱ",
		info: "回复体力时，额外回复2点",
		card: {
			cardimage: "zf_yaoli",
			ai: { basic: { value: 8.5 } },
		},
		skill: {
			inherit: "zf_yaoli",
			filter(event, player) {
				return true;
			},
			num: 2,
		},
	},
	//阴阳术法
	zf_yinyangshufa: {
		rarity: "legend",
		translate: "阴阳术法",
		info: "敌方无法响应你的伤害型锦囊牌",
		card: {
			ai: { basic: { value: 9.5 } },
		},
		skill: {
			trigger: { player: "useCard" },
			filter(event, player) {
				return get.type(event.card) == "trick" && get.is.damageCard(event.card);
			},
			async content(event, trigger, player) {
				if (Array.isArray(trigger.directHit)) {
					trigger.directHit.addArray(player.getEnemies(() => true, false));
				}
			},
		},
	},
	//应急方案
	zf_yingjifangan: {
		rarity: "epic",
		translate: "应急方案",
		info: "回合外成为敌方角色基本牌唯一目标，随机弃置来源一张牌",
		card: {
			ai: { basic: { value: 7.5 } },
		},
		skill: {
			trigger: { target: "useCardToTarget" },
			filter(event, player) {
				if (_status.currentPhase == player || event.getTargets().length != 1) {
					return false;
				}
				const eventPlayer = event.getPlayer();
				return get.type2(event.card) == "basic" && eventPlayer.isEnemiesOf(player, false) && eventPlayer.countDiscardableCards(player, "he") > 0;
			},
			logTarget: "player",
			async content(event, trigger, player) {
				const [target] = event.getTargets();
				if (!target) {
					throw new TypeError("yingjifangan target is required");
				}
				await target.randomDiscard({ discarder: player, position: "he" });
			},
		},
	},
	//应急战术
	zf_yingjizhanshu: {
		rarity: "epic",
		translate: "应急战术",
		info: "回合外成为敌方角色锦囊牌唯一目标，随机弃置来源一张牌",
		card: {
			ai: { basic: { value: 7.5 } },
		},
		skill: {
			inherit: "zf_yingjifangan",
			filter(event, player) {
				if (_status.currentPhase == player || event.getTargets().length != 1) {
					return false;
				}
				const eventPlayer = event.getPlayer();
				return get.type2(event.card) == "trick" && eventPlayer.isEnemiesOf(player, false) && eventPlayer.countDiscardableCards(player, "he") > 0;
			},
		},
	},
	//应急战略
	zf_yingjizhanlve: {
		rarity: "legend",
		translate: "应急战略",
		info: "回合外成为敌方角色使用牌唯一目标，随机弃置来源一张牌",
		card: {
			ai: { basic: { value: 9.5 } },
		},
		skill: {
			inherit: "zf_yingjifangan",
			filter(event, player) {
				if (_status.currentPhase == player || event.getTargets().length != 1) {
					return false;
				}
				const eventPlayer = event.getPlayer();
				return eventPlayer.isEnemiesOf(player, false) && eventPlayer.countDiscardableCards(player, "he") > 0;
			},
		},
	},
	//勇战Ⅰ
	zf_yongzhan: {
		rarity: "epic",
		translate: "勇战Ⅰ",
		info: "	你离开濒死时，对所有敌方造成1点伤害",
		card: {
			ai: { basic: { value: 7 } },
		},
		skill: {
			inherit: "zf_directDamage",
			trigger: { player: "dyingAfter" },
			select: "all",
		},
	},
	//勇战Ⅱ
	zf_yongzhan2: {
		rarity: "legend",
		translate: "勇战Ⅱ",
		info: "	你离开濒死时，对所有敌方造成2点伤害",
		card: {
			cardimage: "zf_yongzhan",
			ai: { basic: { value: 9 } },
		},
		skill: {
			inherit: "zf_yongzhan",
			num: 2,
		},
	},
	//愈战愈勇Ⅲ
	zf_yuzhanyuyong3: {
		rarity: "common",
		translate: "愈战愈勇Ⅲ",
		info: "从第7轮开始，你的【杀】造成的伤害+1",
		card: {
			cardimage: "zf_yuzhanyuyong",
			ai: { basic: { value: 5.5 } },
		},
		skill: {
			inherit: "zf_cardDamage",
			filter(event, player) {
				return event.card.name == "sha" && game.roundNumber >= 7;
			},
		},
	},
	//愈战愈勇Ⅱ
	zf_yuzhanyuyong2: {
		rarity: "rare",
		translate: "愈战愈勇Ⅱ",
		info: "从第5轮开始，你的【杀】造成的伤害+1",
		card: {
			cardimage: "zf_yuzhanyuyong",
			ai: { basic: { value: 6.5 } },
		},
		skill: {
			inherit: "zf_cardDamage",
			filter(event, player) {
				return event.card.name == "sha" && game.roundNumber >= 5;
			},
		},
	},
	//愈战愈勇
	zf_yuzhanyuyong: {
		rarity: "epic",
		translate: "愈战愈勇",
		info: "从第3轮开始，你的【杀】造成的伤害+1",
		card: {
			ai: { basic: { value: 7.5 } },
		},
		skill: {
			inherit: "zf_cardDamage",
			filter(event, player) {
				return event.card.name == "sha" && game.roundNumber >= 3;
			},
		},
	},
	//援助
	zf_yuanzhu: {
		rarity: "rare",
		translate: "援助",
		info: "回合结束时，你摸一张牌",
		card: {
			ai: { basic: { value: 6 } },
		},
		skill: {
			inherit: "zf_anyDraw",
			trigger: { player: "phaseEnd" },
		},
	},
	//援助Ⅱ
	zf_yuanzhu2: {
		rarity: "legend",
		translate: "援助Ⅱ",
		info: "回合结束时，你摸两张牌",
		card: {
			cardimage: "zf_yuanzhu",
			ai: { basic: { value: 7 } },
		},
		skill: {
			inherit: "zf_yuanzhu",
			num: 2,
		},
	},
	//援助Ⅲ
	zf_yuanzhu3: {
		rarity: "legend",
		translate: "援助Ⅲ",
		info: "回合结束时，你摸三张牌",
		card: {
			cardimage: "zf_yuanzhu",
			ai: { basic: { value: 8 } },
		},
		skill: {
			inherit: "zf_yuanzhu",
			num: 3,
		},
	},
	//远击技
	zf_yuanjiji: {
		rarity: "common",
		translate: "远击技",
		info: "造成伤害时，若你与其距离大于1，此伤害+1",
		card: {
			ai: { basic: { value: 6.7 } },
		},
		skill: {
			inherit: "zf_anyDamage",
			filter(event, player) {
				return get.distance(player, event.player) > 1;
			},
		},
	},
	//远谋Ⅰ
	zf_yuanmou: {
		rarity: "common",
		translate: "远谋Ⅰ",
		info: "第3轮你的回合开始时，你回复2点体力",
		card: {
			ai: { basic: { value: 6 } },
		},
		skill: {
			num: 2,
			trigger: { player: "phaseBegin" },
			filter(event, player) {
				return game.roundNumber == 3;
			},
			async content(event, trigger, player) {
				await player.recover(get.info(event.name).num);
			},
		},
	},
};
