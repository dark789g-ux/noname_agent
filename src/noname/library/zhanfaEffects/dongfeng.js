import { _status, game, get, lib } from "noname";

/** @type {Record<"zf_dongfeng" | "zf_qiaoqi" | "zf_qinmian" | "zf_tianrenheyi" | "zf_quanli" | "zf_xicongtianjiang" | "zf_xicongtianjiang2" | "zf_badaoshu" | "zf_badaoshu2" | "zf_banyun" | "zf_bowen" | "zf_bowen2" | "zf_bowen3" | "zf_boming" | "zf_buzhen2" | "zf_buzhen3" | "zf_buzhen" | "zf_cangtaohu" | "zf_caochuanjiejian" | "zf_cedingtianxia" | "zf_cedingtianxia2", import("../zhanfa.js").ZhanfaDefinition>} */
export const dongfengEffects = {
	/*zf_: {
		rarity: "",
		translate: "",
		info: "",
		card: {
			ai: { basic: { value: } }
		},
		skill: {

		}
	},*/
	//两个乐诸葛亮专属战法
	//东风
	zf_dongfeng: {
		rarity: "common",
		translate: "东风",
		info: "当你造成属性伤害后，本轮你造成的属性伤害+1",
		card: {
			ai: { basic: { value: 7.2 } },
		},
		skill: {
			trigger: {
				source: "damageSource",
			},
			filter(event, player) {
				return event.hasNature();
			},
			async content(event, trigger, player) {
				player.addTempSkill(`${event.name}_damage`, "roundStart");
				player.addMark(`${event.name}_damage`, 1, false);
			},
			subSkill: {
				damage: {
					inherit: "zf_anyDamage",
					filter(event, player) {
						return event.hasNature();
					},
					num(event, trigger, player) {
						return player.countMark(event.name);
					},
					onremove: true,
					markimage: "image/zhanfa/zf_dongfeng.png",
					intro: {
						content: "造成的属性伤害+#",
					},
				},
			},
		},
		filterBan: () => true,
	},
	//巧器
	zf_qiaoqi: {
		rarity: "common",
		translate: "巧器",
		info: "你每回合使用的第一张普通锦囊牌额外结算一次",
		card: {
			ai: { basic: { value: 7.5 } },
		},
		skill: {
			inherit: "zf_extraEff",
			filter(event, player) {
				return get.type(event.card) == "trick" && player.getHistory("useCard", evt => get.type(evt.card) == "trick").indexOf(event) == 0;
			},
		},
		filterBan: () => true,
	},
	//勤勉
	zf_qinmian: {
		rarity: "rare",
		translate: "勤勉",
		info: "跳过你的判定阶段",
		card: {
			ai: { basic: { value: 6.1 } },
		},
		skill: {
			trigger: { player: "phaseJudgeBefore" },
			async content(event, trigger, player) {
				game.log(player, "跳过了判定阶段");
				trigger.cancel();
			},
		},
	},
	//天人合一
	zf_tianrenheyi: {
		rarity: "epic",
		translate: "天人合一",
		info: "若你使用的牌与你判定区的某张牌花色相同，此牌造成的伤害+1",
		card: {
			ai: { basic: { value: 5.7 } },
		},
		skill: {
			inherit: "zf_cardDamage",
			filter(event, player) {
				return player.hasCard(card => get.suit(card) == get.suit(event.card), "j") && get.is.damageCard(event.card);
			},
		},
	},
	//全力
	zf_quanli: {
		rarity: "rare",
		translate: "全力",
		info: "你每回合使用的前X张普通锦囊牌额外结算一次（X为你有牌的区域数）",
		card: {
			ai: { basic: { value: 6.6 } },
		},
		skill: {
			inherit: "zf_extraEff",
			filter(event, player) {
				if (get.type(event.card) != "trick") {
					return false;
				}
				const index = player.getHistory("useCard", evt => get.type(evt.card) == "trick").indexOf(event);
				const num = ["h", "e", "j"].filter(pos => player.countCards(pos) > 0).length;
				return index < num;
			},
		},
	},
	//喜从天降
	zf_xicongtianjiang: {
		rarity: "common",
		translate: "喜从天降",
		info: "立即获得1个虎符",
		card: {
			ai: { basic: { value: 5 } },
		},
		skill: {
			init(player, skill) {
				player.addMark("danqi_hufu");
			},
		},
	},
	//喜从天降Ⅱ
	zf_xicongtianjiang2: {
		rarity: "common",
		translate: "喜从天降Ⅱ",
		info: "立即获得2个虎符",
		card: {
			ai: { basic: { value: 6 } },
		},
		skill: {
			init(player, skill) {
				player.addMark("danqi_hufu", 2);
			},
		},
	},
	//拔刀术
	zf_badaoshu: {
		rarity: "epic",
		translate: "拔刀术",
		info: "若上一轮你未造成任何伤害，则你本轮造成的所有伤害+1",
		card: {
			ai: { basic: { value: 5.8 } },
		},
		skill: {
			inherit: "zf_anyDamage",
			filter(event, player) {
				if (game.roundNumber < 2) {
					return false;
				}
				return !player.getRoundHistory("sourceDamage", evt => Number(evt.num) > 0, 1).length;
			},
		},
	},
	//拔刀术Ⅱ
	zf_badaoshu2: {
		rarity: "legend",
		translate: "拔刀术Ⅱ",
		info: "若上一轮造成的伤害小于3，则你本轮造成的所有伤害+1",
		card: {
			cardimage: "zf_badaoshu",
			ai: { basic: { value: 8.2 } },
		},
		skill: {
			inherit: "zf_anyDamage",
			filter(event, player) {
				if (game.roundNumber < 2) {
					return false;
				}
				return player.getRoundHistory("sourceDamage", evt => Number(evt.num) > 0, 1).reduce((sum, evt) => sum + Number(evt.num), 0) < 3;
			},
		},
	},
	//搬运
	zf_banyun: {
		rarity: "rare",
		translate: "搬运",
		info: "你的回合开始时，从随机敌方手牌区获得1张牌",
		card: {
			ai: { basic: { value: 6 } },
		},
		skill: {
			trigger: { player: "phaseBegin" },
			filter(event, player) {
				return player.getEnemies(target => target.countGainableCards(player, "h"), false).length;
			},
			async content(event, trigger, player) {
				const target = player.getEnemies(target => target.countGainableCards(player, "h"), false).randomGet();
				const card = target.getGainableCards(player, "h").randomGet();
				await player.gain(card, target, "giveAuto", "bySelf");
			},
		},
	},
	//博闻Ⅰ
	zf_bowen: {
		rarity: "epic",
		translate: "博闻Ⅰ",
		info: "你的回合开始时，从牌堆中获得一张随机锦囊牌",
		card: {
			ai: { basic: { value: 7 } },
		},
		skill: {
			inherit: "zf_anyGain",
			cardFilter: { type2: "trick" },
			num: 1,
		},
	},
	//博闻Ⅱ
	zf_bowen2: {
		rarity: "legend",
		translate: "博闻Ⅱ",
		info: "你的回合开始时，从牌堆中获得两张随机锦囊牌",
		card: {
			cardimage: "zf_bowen",
			ai: { basic: { value: 8 } },
		},
		skill: {
			inherit: "zf_bowen",
			num: 2,
		},
	},
	//博闻Ⅲ
	zf_bowen3: {
		rarity: "legend",
		translate: "博闻Ⅲ",
		info: "你的回合开始时，从牌堆中获得三张随机锦囊牌",
		card: {
			cardimage: "zf_bowen",
			ai: { basic: { value: 10 } },
		},
		skill: {
			inherit: "zf_bowen",
			num: 3,
		},
	},
	//搏命
	zf_boming: {
		rarity: "common",
		translate: "搏命",
		info: "手牌上限-2，出杀次数+1",
		card: {
			ai: { basic: { value: 4 } },
		},
		skill: {
			mod: {
				cardUsable(card, player, num) {
					if (card.name == "sha" && typeof num === "number") {
						return num + 1;
					}
				},
				maxHandcard(player, num) {
					return num - 2;
				},
			},
		},
	},
	//布阵Ⅱ
	zf_buzhen2: {
		rarity: "common",
		translate: "布阵Ⅱ",
		info: "从第5轮开始，你的摸牌数+1",
		card: {
			cardimage: "zf_buzhen",
			ai: { basic: { value: 4.8 } },
		},
		skill: {
			inherit: "zf_phaseDraw",
			filter(event, player) {
				return !event.numFixed && game.roundNumber >= 5;
			},
		},
	},
	//布阵Ⅲ
	zf_buzhen3: {
		rarity: "common",
		translate: "布阵Ⅲ",
		info: "从第7轮开始，你的摸牌数+1",
		card: {
			cardimage: "zf_buzhen",
			ai: { basic: { value: 4 } },
		},
		skill: {
			inherit: "zf_phaseDraw",
			filter(event, player) {
				return !event.numFixed && game.roundNumber >= 7;
			},
		},
	},
	//布阵
	zf_buzhen: {
		rarity: "rare",
		translate: "布阵",
		info: "从第3轮开始，你的摸牌数+1",
		card: {
			ai: { basic: { value: 5.4 } },
		},
		skill: {
			inherit: "zf_phaseDraw",
			filter(event, player) {
				return !event.numFixed && game.roundNumber >= 3;
			},
		},
	},
	//藏桃户
	zf_cangtaohu: {
		rarity: "common",
		translate: "藏桃户",
		info: "【桃】不计入手牌上限",
		card: {
			ai: { basic: { value: 5.3 } },
		},
		skill: {
			mod: {
				ignoredHandcard(card, player) {
					if (get.name(card) == "tao") {
						return true;
					}
				},
				cardDiscardable(card, player, name) {
					if (name === "phaseDiscard" && get.name(card) == "tao") {
						return false;
					}
				},
			},
		},
	},
	//草船借箭
	zf_caochuanjiejian: {
		rarity: "common",
		translate: "草船借箭",
		info: "【无懈可击】获得抵消的锦囊牌",
		card: {
			ai: { basic: { value: 4.9 } },
		},
		skill: {
			trigger: {
				global: ["eventNeutralized"],
				player: ["wuxieAfter"],
			},
			filter(event, player) {
				if (event.name == "wuxie") {
					const parent = event.getParent(2);
					const trigger = parent._trigger;
					if (!trigger) {
						throw new TypeError("wuxie neutralization requires a triggering event");
					}
					const cardSymbol = trigger.card.cardSymbol;
					if (!cardSymbol) {
						throw new TypeError("wuxie neutralization requires a card symbol");
					}
					return trigger.name == "phaseJudge" && trigger.cancelled && trigger.card[cardSymbol].cards.someInD();
				}
				const evt = event._neutralize_event;
				if (evt.name != "wuxie" || evt.player != player) {
					return false;
				}
				return event.cards?.someInD();
			},
			async content(event, trigger, player) {
				if (trigger.name == "wuxie") {
					const parent = trigger.getParent(2);
					const evt = parent._trigger;
					if (!evt) {
						throw new TypeError("wuxie neutralization requires a triggering event");
					}
					const cardSymbol = evt.card.cardSymbol;
					if (!cardSymbol) {
						throw new TypeError("wuxie neutralization requires a card symbol");
					}
					await player.gain(evt.card[cardSymbol].cards.filterInD(), "gain2");
					return;
				}
				await player.gain(trigger.cards.filterInD(), "gain2");
			},
		},
	},
	//策定天下
	zf_cedingtianxia: {
		rarity: "common",
		translate: "策定天下",
		info: "出牌阶段限一次，当你使用锦囊牌造成伤害后，摸一张牌",
		card: {
			ai: { basic: { value: 5.6 } },
		},
		skill: {
			inherit: "zf_anyDraw",
			filter(event, player) {
				return event.card && get.type2(event.card) == "trick" && player.isPhaseUsing();
			},
			usable: 1,
		},
	},
	//策定天下Ⅱ
	zf_cedingtianxia2: {
		rarity: "rare",
		translate: "策定天下Ⅱ",
		info: "出牌阶段限一次，当你使用锦囊牌造成伤害后，摸两张牌",
		card: {
			cardimage: "zf_cedingtianxia",
			ai: { basic: { value: 7.2 } },
		},
		skill: {
			inherit: "zf_cedingtianxia",
			num: 2,
		},
	},
};
