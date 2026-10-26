import { _status, game, get, lib } from "noname";

/** @type {Record<"zf_fuyiqushan" | "zf_fuyiqutao" | "zf_fuyiquchai" | "zf_fuyiqujue" | "zf_fuyiqusuo" | "zf_fuyiqushun" | "zf_geshandaniu" | "zf_guandaozhiji" | "zf_guangongren" | "zf_hanzhan" | "zf_haoshenfa" | "zf_hengjiangsuo" | "zf_hengfeng" | "zf_hengfeng2" | "zf_houfaxianzhi" | "zf_houshi" | "zf_houshi2" | "zf_hugujiu" | "zf_hugujiu2" | "zf_hujia" | "zf_hujia2", import("../zhanfa.js").ZhanfaDefinition>} */
export const fuyiqushanEffects = {
	//拂衣去闪
	zf_fuyiqushan: {
		rarity: "rare",
		translate: "拂衣去·闪",
		info: "你的回合开始时，你获得一张【闪】",
		card: {
			cardimage: "zf_fuyiqusha",
			ai: { basic: { value: 6.2 } },
		},
		skill: {
			inherit: "zf_anyGain",
			cardFilter: "shan",
		},
	},
	//拂衣去桃
	zf_fuyiqutao: {
		rarity: "epic",
		translate: "拂衣去·桃",
		info: "你的回合开始时，你获得一张【桃】",
		card: {
			cardimage: "zf_fuyiqusha",
			ai: { basic: { value: 9 } },
		},
		skill: {
			inherit: "zf_anyGain",
			cardFilter: "tao",
		},
	},
	//拂衣去拆
	zf_fuyiquchai: {
		rarity: "epic",
		translate: "拂衣去·拆",
		info: "你的回合开始时，你获得一张【过河拆桥】",
		card: {
			cardimage: "zf_fuyiqusha",
			ai: { basic: { value: 8.1 } },
		},
		skill: {
			inherit: "zf_anyGain",
			cardFilter: "guohe",
		},
	},
	//拂衣去决
	zf_fuyiqujue: {
		rarity: "epic",
		translate: "拂衣去·决",
		info: "你的回合开始时，你获得一张【决斗】",
		card: {
			cardimage: "zf_fuyiqusha",
			ai: { basic: { value: 8 } },
		},
		skill: {
			inherit: "zf_anyGain",
			cardFilter: "juedou",
		},
	},
	//拂衣去锁
	zf_fuyiqusuo: {
		rarity: "epic",
		translate: "拂衣去·锁",
		info: "你的回合开始时，你获得一张【铁索连环】",
		card: {
			cardimage: "zf_fuyiqusha",
			ai: { basic: { value: 7.8 } },
		},
		skill: {
			inherit: "zf_anyGain",
			cardFilter: "tiesuo",
		},
	},
	//拂衣去顺
	zf_fuyiqushun: {
		rarity: "legend",
		translate: "拂衣去·顺",
		info: "你的回合开始时，你获得一张【顺手牵羊】",
		card: {
			cardimage: "zf_fuyiqusha",
			ai: { basic: { value: 9.2 } },
		},
		skill: {
			inherit: "zf_anyGain",
			cardFilter: "shunshou",
		},
	},
	//隔山打牛
	zf_geshandaniu: {
		rarity: "common",
		translate: "隔山打牛",
		info: "你对其他人造成伤害时，无视其护甲",
		card: {
			ai: { basic: { value: 6.3 } },
		},
		skill: {
			trigger: { source: "damageBegin" },
			filter(event, player) {
				return event.player != player;
			},
			async content(event, trigger, player) {
				trigger.set("nohujia", true);
			},
		},
	},
	//关刀之脊
	zf_guandaozhiji: {
		rarity: "common",
		translate: "关刀之脊",
		info: "方片【杀】无距离限制",
		card: {
			ai: { basic: { value: 4.5 } },
		},
		skill: {
			mod: {
				targetInRange(card) {
					if (get.suit(card) == "diamond" && get.name(card) == "sha") {
						return true;
					}
				},
			},
		},
	},
	//关公刃
	zf_guangongren: {
		rarity: "rare",
		translate: "关公刃",
		info: "	红桃【杀】伤害+1",
		card: {
			ai: { basic: { value: 7.5 } },
		},
		skill: {
			inherit: "zf_cardDamage",
			filter(event, player) {
				return event.card.name == "sha" && get.suit(event.card) == "heart";
			},
		},
	},
	//酣战
	zf_hanzhan: {
		rarity: "common",
		translate: "酣战",
		info: "你使用/受到的【决斗】对方需要两张杀",
		card: {
			ai: { basic: { value: 5.7 } },
		},
		skill: {
			trigger: {
				player: "useCardToPlayered",
				target: "useCardToTargeted",
			},
			filter(event, player) {
				return event.card.name == "juedou";
			},
			async content(event, trigger, player) {
				const triggerPlayer = trigger.getPlayer(),
					triggerTarget = trigger.getTarget();
				const id = (player == triggerPlayer ? triggerTarget : triggerPlayer)["playerid"];
				const idt = triggerTarget.playerid;
				const idKey = id === undefined ? "undefined" : id;
				const idtKey = idt === undefined ? "undefined" : idt;
				const map = trigger.getParent()?.customArgs;
				if (!map[idtKey]) {
					map[idtKey] = {};
				}
				if (!map[idtKey].shaReq) {
					map[idtKey].shaReq = {};
				}
				if (!map[idtKey].shaReq[idKey]) {
					map[idtKey].shaReq[idKey] = 1;
				}
				map[idtKey].shaReq[idKey]++;
			},
			ai: {
				directHit_ai: true,
				skillTagFilter(player, tag, arg) {
					if (arg.card.name != "juedou" || Math.floor(arg.target.countCards("h", "sha") / 2) > player.countCards("h", "sha")) {
						return false;
					}
				},
			},
		},
	},
	//好身法
	zf_haoshenfa: {
		rarity: "epic",
		translate: "好身法",
		info: "【闪】不计入手牌上限",
		card: {
			ai: { basic: { value: 6.8 } },
		},
		skill: {
			mod: {
				ignoredHandcard(card, player) {
					if (get.name(card) == "shan") {
						return true;
					}
				},
				cardDiscardable(card, player, name) {
					if (name === "phaseDiscard" && get.name(card) == "shan") {
						return false;
					}
				},
			},
		},
	},
	//横江锁
	zf_hengjiangsuo: {
		rarity: "epic",
		translate: "横江锁",
		info: "【铁索连环】能指定任意个目标",
		card: {
			ai: { basic: { value: 6.1 } },
		},
		skill: {
			mod: {
				selectTarget(card, player, range) {
					if (get.name(card) == "tiesuo" && range[1] > 0) {
						range[1] = Infinity;
					}
				},
			},
		},
	},
	//衡锋Ⅰ
	zf_hengfeng: {
		rarity: "rare",
		translate: "衡锋Ⅰ",
		info: "回合内首次造成的伤害+1，回合外首次受到的伤害+1",
		card: {
			ai: { basic: { value: 7.2 } },
		},
		skill: {
			num: 1,
			trigger: {
				player: "damageBegin3",
				source: "damageBegin1",
			},
			filter(event, player, name) {
				if (name == "damageBegin1") {
					return _status.currentPhase == player && game.getGlobalHistory("everything", evt => evt.name == "damage" && evt.source == player).indexOf(event) == 0;
				} else {
					return _status.currentPhase != player && !player.hasSkill("zf_hengfeng_triggered");
				}
			},
			async content(event, trigger, player) {
				if (event.triggername == "damageBegin3") {
					player.addTempSkill(`${event.name}_triggered`, { player: "phaseBeginStart" });
				}
				trigger.num += get.info(event.name).num;
			},
			init(player, skill) {
				const histories = player.actionHistory.slice();
				for (const history of histories.reverse()) {
					if (history.isMe) {
						break;
					}
					if (history["damage"].length) {
						player.addTempSkill(`${skill}_triggered`, { player: "phaseBeginStart" });
						break;
					}
				}
			},
			subSkill: {
				triggered: {
					charlotte: true,
				},
			},
		},
	},
	//衡锋Ⅱ
	zf_hengfeng2: {
		rarity: "epic",
		translate: "衡锋Ⅱ",
		info: "回合内首次造成的伤害+2，回合外首次受到的伤害+2",
		card: {
			cardimage: "zf_hengfeng",
			ai: { basic: { value: 8.3 } },
		},
		skill: {
			inherit: "zf_hengfeng",
			num: 2,
			filter(event, player, name) {
				if (name == "damageBegin1") {
					return _status.currentPhase == player && game.getGlobalHistory("everything", evt => evt.name == "damage" && evt.source == player).indexOf(event) == 0;
				} else {
					return _status.currentPhase != player && !player.hasSkill("zf_hengfeng2_triggered");
				}
			},
		},
	},
	//后发先至
	zf_houfaxianzhi: {
		rarity: "rare",
		translate: "后发先至",
		info: "摸牌阶段，你的摸牌数-1；你的回合结束时，你摸3张牌",
		card: {
			ai: { basic: { value: 7.35 } },
		},
		skill: {
			trigger: {
				player: ["phaseDrawBegin2", "phaseEnd"],
			},
			filter(event, player) {
				if (event.name == "phase") {
					return true;
				}
				return !event.numFixed;
			},
			async content(event, trigger, player) {
				if (trigger.name == "phase") {
					await player.draw({ num: 3 });
				} else {
					trigger.num = Number(trigger.num) - 1;
				}
			},
		},
	},
	//厚实Ⅰ
	zf_houshi: {
		rarity: "epic",
		translate: "厚实Ⅰ",
		info: "每轮你受到的首次伤害-1",
		card: {
			ai: { basic: { value: 7.5 } },
		},
		skill: {
			trigger: { player: "damageBegin3" },
			filter(event, player, name) {
				const index = game.getRoundHistory("everything", evt => evt.name == "damage" && evt.player == player).indexOf(event);
				return index == 0;
			},
			async content(event, trigger, player) {
				trigger.num = Number(trigger.num) - 1;
			},
		},
	},
	//厚实Ⅱ
	zf_houshi2: {
		rarity: "legend",
		translate: "厚实Ⅱ",
		info: "每轮你前两次受到的伤害-1",
		card: {
			cardimage: "zf_houshi",
			ai: { basic: { value: 9.5 } },
		},
		skill: {
			inherit: "zf_houshi",
			filter(event, player, name) {
				const index = game.getRoundHistory("everything", evt => evt.name == "damage" && evt.player == player).indexOf(event);
				return index >= 0 && index < 2;
			},
		},
	},
	//虎骨酒
	zf_hugujiu: {
		rarity: "common",
		translate: "虎骨酒",
		info: "每回合，你可以额外使用1次【酒】",
		card: {
			ai: { basic: { value: 6 } },
		},
		skill: {
			inherit: "zf_cardUsable",
			cardFilter: "jiu",
		},
	},
	//虎骨酒Ⅱ
	zf_hugujiu2: {
		rarity: "legend",
		translate: "虎骨酒Ⅱ",
		info: "每回合，你可以额外使用2次【酒】",
		card: {
			cardimage: "zf_hugujiu",
			ai: { basic: { value: 7.5 } },
		},
		skill: {
			inherit: "zf_hugujiu",
			modNum: 2,
		},
	},
	//护甲Ⅰ
	zf_hujia: {
		rarity: "epic",
		translate: "护甲Ⅰ",
		info: "每轮开始时，你获得1点护甲",
		card: {
			ai: { basic: { value: 6.9 } },
		},
		skill: {
			trigger: { global: "roundStart" },
			num: 1,
			async content(event, trigger, player) {
				await player.changeHujia(get.info(event.name).num);
			},
		},
	},
	//护甲Ⅱ
	zf_hujia2: {
		rarity: "legend",
		translate: "护甲Ⅱ",
		info: "每轮开始时，你获得2点护甲",
		card: {
			cardimage: "zf_hujia",
			ai: { basic: { value: 8.9 } },
		},
		skill: {
			inherit: "zf_hujia",
			num: 2,
		},
	},
};
