import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "guidao" | "huangtian" | "huangtian2" | "huangtian3" | "xinfu_guhuo">} */
export const groupSkills = {
	guidao: {
		audio: 2,
		audioname: ["sp_zhangjiao"],
		trigger: { global: "judge" },
		filter(event, player) {
			return player.countCards("hes", { color: "black" }) > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard(`${get.translation(trigger.player)}的${trigger.judgestr || ""}判定为${get.translation(trigger.player.judging[0])}，${get.prompt(event.skill)}`, "hes", card => {
					const player = get.player();
					if (get.color(card) !== "black") {
						return false;
					}
					const mod2 = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
					if (mod2 != "unchanged") {
						return mod2;
					}
					const mod = game.checkMod(card, player, "unchanged", "cardRespondable", player);
					if (mod != "unchanged") {
						return mod;
					}
					return true;
				})
				.set("ai", card => {
					const trigger = get.event().getTrigger();
					const { player, judging } = get.event();
					const result = trigger.judge(card) - trigger.judge(judging);
					const attitude = get.attitude(player, trigger.player);
					let val = get.value(card);
					if (get.subtype(card) == "equip2") {
						val /= 2;
					} else {
						val /= 6;
					}
					if (attitude == 0 || result == 0) {
						return 0;
					}
					if (attitude > 0) {
						return result - val;
					}
					return -result - val;
				})
				.set("judging", trigger.player.judging[0])
				.forResult();
		},
		popup: false,
		async content(event, trigger, player) {
			const next = player.respond(event.cards, event.name, "highlight", "noOrdering");
			await next;
			const { cards } = next;
			if (cards?.length) {
				player.$gain2(trigger.player.judging[0]);
				await player.gain(trigger.player.judging[0]);
				trigger.player.judging[0] = cards[0];
				trigger.orderingCards.addArray(cards);
				game.log(trigger.player, "的判定牌改为", cards);
				await game.delay(2);
			}
		},
		ai: {
			rejudge: true,
			tag: { rejudge: 1 },
		},
	},
	// 蛊惑（guhuo）技能错误，请勿引用
	/*
	guhuo:{
		enable:'phaseUse',
		usable:1,
		audio:2,
		filter:function(event,player){
			return player.countCards('hs')>0
		},
		chooseButton:{
			dialog:function(){
				const list=['sha','tao','jiu','taoyuan','wugu','juedou','huogong','jiedao','tiesuo','guohe','shunshou','wuzhong','wanjian','nanman'];
				for(let i=0;i<list.length;i++){
					if(i<3){
						list[i]=['基本','',list[i]];
					}
					else{
						list[i]=['锦囊','',list[i]];
					}
				}
				return ui.create.dialog([list,'vcard']);
			},
			filter:function(button,player){
				return lib.filter.filterCard({name:button.link[2]},player,_status.event.getParent());
			},
			check:function(button){
				const player=_status.event.player;
				if(player.countCards('h','wuzhong')){
					if(player.hp==1&&player.countCards('h','tao')){
						return button.link=='tao'?1:0;
					}
					return button.link=='wuzhong'?1:0;
				}
				if(player.hp<player.maxHp){
					if(player.countCards('h','tao')){
						return button.link=='tao'?1:0;
					}
				}
			},
			backup:function(links,player){
				return {
					filterCard:true,
					selectCard:-1,
					audio:2,
					popname:true,
					viewAs:{name:links[0][2]},
				}
			},
			prompt:function(links,player){
				return '将全部手牌当'+get.translation(links[0][2])+'使用';
			}
		},
		ai:{
			order:1,
			result:{
				player:function(player){
					const cards=player.getCards('h');
					let num=0;
					if(cards.length>=3&&player.hp>=3) return 0;
					for(let i=0;i<cards.length;i++){
						num+=Math.max(0,get.value(cards[i],player,'raw'));
					}
					num/=cards.length;
					num*=Math.min(cards.length,player.hp);
					return 12-num;
				}
			},
			threaten:1.6,
		}
	},
	*/
	huangtian: {
		audio: "huangtian2",
		audioname: ["zhangjiao", "re_zhangjiao"],
		audioname2: {
			pe_jun_zhangjiao: ["xinhuangtian2_re_zhangjiao1.mp3", "xinhuangtian2_re_zhangjiao2.mp3"],
		},
		global: "huangtian2",
		zhuSkill: true,
	},
	huangtian2: {
		audio: 2,
		enable: "phaseUse",
		discard: false,
		lose: false,
		delay: false,
		line: true,
		prepare(cards, player, targets) {
			targets[0].logSkill("huangtian");
		},
		prompt() {
			const player = _status.event.player;
			const list = game.filterPlayer(function (target) {
				return target != player && target.hasZhuSkill("huangtian", player);
			});
			let str = "将一张【闪】或【闪电】交给" + get.translation(list);
			if (list.length > 1) {
				str += "中的一人";
			}
			return str;
		},
		filter(event, player) {
			if (player.group != "qun") {
				return false;
			}
			if (player.countCards("h", "shan") + player.countCards("h", "shandian") == 0) {
				return 0;
			}
			return game.hasPlayer(function (target) {
				return target != player && target.hasZhuSkill("huangtian", player) && !target.hasSkill("huangtian3");
			});
		},
		filterCard(card) {
			return card.name == "shan" || card.name == "shandian";
		},
		log: false,
		visible: true,
		filterTarget(card, player, target) {
			return target != player && target.hasZhuSkill("huangtian", player) && !target.hasSkill("huangtian3");
		},
		//usable:1,
		//forceaudio:true,
		async content(event, trigger, player) {
			await player.give(event.cards, event.target);
			event.target.addTempSkill("huangtian3", "phaseUseEnd");
		},
		ai: {
			expose: 0.3,
			order: 10,
			result: {
				target: 5,
			},
		},
	},
	huangtian3: {},
	xinfu_guhuo: {
		audio: "guhuo_guess",
		derivation: ["chanyuan"],
		enable: ["chooseToUse", "chooseToRespond"],
		hiddenCard(player, name) {
			return lib.inpile.includes(name) && player.countCards("hs") > 0 && !player.hasSkill("guhuo_phase");
		},
		filter(event, player) {
			if (player.hasSkill("guhuo_phase")) {
				return false;
			}
			if (!player.countCards("hs")) {
				return false;
			}
			for (const i of lib.inpile) {
				const type = get.type(i);
				if ((type == "basic" || type == "trick") && event.filterCard(get.autoViewAs({ name: i }, "unsure"), player, event)) {
					return true;
				}
				if (i == "sha") {
					for (const j of lib.inpile_nature) {
						if (event.filterCard(get.autoViewAs({ name: i, nature: j }, "unsure"), player, event)) {
							return true;
						}
					}
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				const list = [];
				for (const i of lib.inpile) {
					if (event.type != "phase") {
						if (!event.filterCard(get.autoViewAs({ name: i }, "unsure"), player, event)) {
							continue;
						}
					}
					const type = get.type(i);
					if (type == "basic" || type == "trick") {
						list.push([type, "", i]);
					}
					if (i == "sha") {
						for (const j of lib.inpile_nature) {
							if (event.type != "phase") {
								if (!event.filterCard(get.autoViewAs({ name: i, nature: j }, "unsure"), player, event)) {
									continue;
								}
							}
							list.push(["基本", "", "sha", j]);
						}
					}
				}
				return ui.create.dialog("蛊惑", [list, "vcard"]);
			},
			filter(button, player) {
				const evt = _status.event.getParent();
				return evt.filterCard({ name: button.link[2], nature: button.link[3] }, player, evt);
			},
			check(button) {
				const player = _status.event.player;
				const enemyNum = game.countPlayer(function (current) {
					return current != player && !current.hasSkill("chanyuan") && (get.realAttitude || get.attitude)(current, player) < 0;
				});
				const card = { name: button.link[2], nature: button.link[3] };
				const val = _status.event.getParent().type == "phase" ? player.getUseValue(card) : 1;
				if (val <= 0) {
					return 0;
				}
				if (enemyNum) {
					if (
						!player.hasCard(function (cardx) {
							if (card.name == cardx.name) {
								if (card.name != "sha") {
									return true;
								}
								return get.is.sameNature(card, cardx);
							}
							return false;
						}, "hs")
					) {
						if (get.value(card, player, "raw") < 6) {
							return Math.sqrt(val) * (0.25 + Math.random() / 1.5);
						}
						if (enemyNum <= 2) {
							return Math.sqrt(val) / 1.5;
						}
						return 0;
					}
					return 3 * val;
				}
				return val;
			},
			backup(links, player) {
				return {
					filterCard(card, player, target) {
						let result = true;
						const suit = card.suit,
							number = card.number;
						card.suit = "none";
						card.number = null;
						const mod = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
						if (mod != "unchanged") {
							result = mod;
						}
						card.suit = suit;
						card.number = number;
						return result;
					},
					selectCard: 1,
					position: "hs",
					ignoreMod: true,
					aiUse: Math.random(),
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						suit: "none",
						number: null,
					},
					ai1(card) {
						const player = _status.event.player;
						const enemyNum = game.countPlayer(function (current) {
							return current != player && !current.hasSkill("chanyuan") && (get.realAttitude || get.attitude)(current, player) < 0;
						});
						const cardx = lib.skill.xinfu_guhuo_backup.viewAs;
						if (enemyNum) {
							if (card.name == cardx.name && (card.name != "sha" || get.is.sameNature(card, cardx))) {
								return 2 + Math.random() * 3;
							} else if (lib.skill.xinfu_guhuo_backup.aiUse < 0.5 && !player.isDying()) {
								return 0;
							}
						}
						return 6 - get.value(card);
					},
					async precontent(event, trigger, player) {
						player.logSkill("xinfu_guhuo");
						player.addTempSkill("guhuo_guess");
						const [card] = event.result.cards;
						event.result.card.suit = get.suit(card);
						event.result.card.number = get.number(card);
					},
				};
			},
			prompt(links, player) {
				return "将一张手牌当做" + get.translation(links[0][2]) + (_status.event.name == "chooseToRespond" ? "打出" : "使用");
			},
		},
		ai: {
			save: true,
			respondSha: true,
			respondShan: true,
			fireAttack: true,
			skillTagFilter(player) {
				if (!player.countCards("hs") || player.hasSkill("guhuo_phase")) {
					return false;
				}
			},
			threaten: 1.2,
			order: 8.1,
			result: { player: 1 },
		},
	},
};
