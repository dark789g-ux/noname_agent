import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "huashen2" | "xinsheng" | "huoshou" | "huoshou1" | "huoshou2" | "zaiqixx" | "zaiqi" | "juxiang" | "juxiang1" | "juxiang2" | "lieren" | "xingshang" | "fangzhu" | "fangzhu_new_simayi" | "songwei" | "songwei2" | "jiezi" | "gzduanliang" | "duanliang" | "duanliang1" | "duanliang2" | "duanliang3" | "haoshi">} */
export const groupSkills = {
	huashen2: { audio: 2 },
	xinsheng: {
		audio: 2,
		unique: true,
		trigger: { player: "damageEnd" },
		frequent: true,
		getIndex: event => event.num,
		filter(event) {
			return event.num;
		},
		async content(event, trigger, player) {
			lib.skill.huashen.addHuashens(player, 1);
		},
		ai: { combo: "huashen" },
	},
	huoshou: {
		audio: "huoshou1",
		audioname: ["re_menghuo"],
		locked: true,
		group: ["huoshou1", "huoshou2"],
		preHidden: ["huoshou1", "huoshou2"],
		ai: {
			halfneg: true,
			effect: {
				target(card, player, target) {
					if (card.name == "nanman") {
						return "zeroplayertarget";
					}
				},
			},
		},
	},
	huoshou1: {
		audio: 2,
		audioname: ["re_menghuo"],
		trigger: { target: "useCardToBefore" },
		forced: true,
		priority: 15,
		sourceSkill: "huoshou",
		filter(event, player) {
			return event.card.name == "nanman";
		},
		async content(event, trigger, player) {
			trigger.cancel();
		},
	},
	huoshou2: {
		audio: "huoshou1",
		audioname: ["re_menghuo"],
		trigger: { global: "useCard" },
		forced: true,
		sourceSkill: "huoshou",
		filter(event, player) {
			return event.card && event.card.name == "nanman" && event.player != player;
		},
		async content(event, trigger, player) {
			trigger.customArgs.default.customSource = player;
		},
	},
	zaiqixx: {
		audio: "zaiqi",
		inherit: "zaiqi",
	},
	zaiqi: {
		audio: 2,
		trigger: { player: "phaseDrawBegin1" },
		filter(event, player) {
			return !event.numFixed && player.isDamaged();
		},
		check(event, player) {
			if (player.getDamagedHp() < 2) {
				return false;
			} else if (player.getDamagedHp() == 2) {
				return player.countCards("h") >= 2;
			}
			return true;
		},
		async content(event, trigger, player) {
			trigger.changeToZero();
			let cards = get.cards(player.getDamagedHp() + (event.name == "zaiqi" ? 0 : 1), true);
			cards = (
				await player
					.showCards(cards, `${get.translation(player)}发动了〖${get.translation(event.name)}〗`, true)
					.set("delay_time", Math.min(4, cards.length))
					.forResult()
			).cards;
			let num = 0;
			for (let i = 0; i < cards.length; i++) {
				if (get.suit(cards[i]) == "heart") {
					num++;
					cards.splice(i--, 1);
				}
			}
			if (num) {
				await player.recover(num);
			}
			if (cards.length) {
				await player.gain(cards, "gain2");
			}
		},
		ai: {
			threaten(player, target) {
				if (target.hp == 1) {
					return 2;
				}
				if (target.hp == 2) {
					return 1.5;
				}
				return 1;
			},
		},
	},
	juxiang: {
		//unique:true,
		locked: true,
		audio: "juxiang1",
		audioname: ["re_zhurong", "ol_zhurong"],
		group: ["juxiang1", "juxiang2"],
		preHidden: ["juxiang1", "juxiang2"],
		ai: {
			effect: {
				target(card) {
					if (card.name == "nanman") {
						return [0, 1, 0, 0];
					}
				},
			},
		},
	},
	juxiang1: {
		audio: 2,
		audioname: ["re_zhurong", "ol_zhurong"],
		trigger: { target: "useCardToBefore" },
		forced: true,
		priority: 15,
		sourceSkill: "juxiang",
		filter(event, player) {
			return event.card.name == "nanman";
		},
		async content(event, trigger, player) {
			trigger.cancel();
		},
	},
	juxiang2: {
		audio: "juxiang1",
		audioname: ["re_zhurong", "ol_zhurong"],
		trigger: { global: "useCardAfter" },
		forced: true,
		sourceSkill: "juxiang",
		filter(event, player) {
			return event.card.name == "nanman" && event.player != player && event.cards.someInD();
		},
		async content(event, trigger, player) {
			await player.gain(trigger.cards.filterInD(), "gain2");
		},
	},
	lieren: {
		audio: 2,
		audioname: ["boss_lvbu3", "ol_zhurong"],
		trigger: { source: "damageSource" },
		filter(event, player) {
			if (event._notrigger.includes(event.player)) {
				return false;
			}
			return event.card && event.card.name == "sha" && event.getParent().name == "sha" && event.player.isIn() && player.canCompare(event.player);
		},
		check(event, player) {
			return get.attitude(player, event.player) < 0 && player.countCards("h") > 1;
		},
		//priority:5,
		async content(event, trigger, player) {
			const result = await player.chooseToCompare(trigger.player).forResult();
			if (result.bool && trigger.player.countGainableCards(player, "he")) {
				await player.gainPlayerCard(trigger.player, true, "he");
			}
		},
	},
	xingshang: {
		audio: 2,
		audioname2: { caoying: "lingren_xingshang" },
		trigger: { global: "die" },
		preHidden: true,
		filter(event) {
			return event.player.countCards("he") > 0;
		},
		async content(event, trigger, player) {
			event.togain = trigger.player.getCards("he");
			await player.gain(event.togain, trigger.player, "giveAuto", "bySelf");
		},
	},
	fangzhu: {
		audio: 2,
		audioname2: { new_simayi: "fangzhu_new_simayi", sxrm_caocao: "fangzhu_sxrm_caocao" },
		trigger: { player: "damageEnd" },
		preHidden: true,
		async cost(event, trigger, player) {
			const draw = player.getDamagedHp();
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "令一名其他角色翻面" + (draw > 0 ? "并摸" + get.cnNumber(draw) + "张牌" : ""), function (card, player, target) {
					return player != target;
				})
				.setHiddenSkill(event.skill)
				.set("ai", target => {
					if (target.hasSkillTag("noturn")) {
						return 0;
					}
					const player = _status.event.player;
					const current = _status.currentPhase;
					const dis = current ? get.distance(current, target, "absolute") : 1;
					const draw = player.getDamagedHp();
					const att = get.attitude(player, target);
					if (att == 0) {
						return target.hasJudge("lebu") ? Math.random() / 3 : Math.sqrt(get.threaten(target)) / 5 + Math.random() / 2;
					}
					if (att > 0) {
						if (target.isTurnedOver()) {
							return att + draw;
						}
						if (draw < 4) {
							return -1;
						}
						if (current && target.getSeatNum() > current.getSeatNum()) {
							return att + draw / 3;
						}
						return (10 * Math.sqrt(Math.max(0.01, get.threaten(target)))) / (3.5 - draw) + dis / (2 * game.countPlayer());
					} else {
						if (target.isTurnedOver()) {
							return att - draw;
						}
						if (draw >= 5) {
							return -1;
						}
						if (current && target.getSeatNum() <= current.getSeatNum()) {
							return -att + draw / 3;
						}
						return (4.25 - draw) * 10 * Math.sqrt(Math.max(0.01, get.threaten(target))) + (2 * game.countPlayer()) / dis;
					}
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const draw = player.getDamagedHp();
			if (draw > 0) {
				await event.targets[0].draw(draw);
			}
			await event.targets[0].turnOver();
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -2];
						}
						if (target.hp <= 1) {
							return;
						}
						if (!target.hasFriend()) {
							return;
						}
						let hastarget = false;
						let turnfriend = false;
						const players = game.filterPlayer();
						for (let i = 0; i < players.length; i++) {
							if (get.attitude(target, players[i]) < 0 && !players[i].isTurnedOver()) {
								hastarget = true;
							}
							if (get.attitude(target, players[i]) > 0 && players[i].isTurnedOver()) {
								hastarget = true;
								turnfriend = true;
							}
						}
						if (get.attitude(player, target) > 0 && !hastarget) {
							return;
						}
						if (turnfriend || target.hp == target.maxHp) {
							return [0.5, 1];
						}
						if (target.hp > 1) {
							return [1, 0.5];
						}
					}
				},
			},
		},
	},
	fangzhu_new_simayi: { audio: 1 },
	songwei: {
		group: "songwei2",
		audioname: ["re_caopi"],
		audio: "songwei2",
		zhuSkill: true,
	},
	songwei2: {
		audio: 2,
		audioname: ["re_caopi"],
		audioname2: {
			pe_jun_caopi: "sbsongwei",
		},
		forceaudio: true,
		trigger: { global: "judgeEnd" },
		sourceSkill: "songwei",
		filter(event, player) {
			if (event.player == player || event.player.group != "wei") {
				return false;
			}
			if (event.result.color != "black") {
				return false;
			}
			return player.hasZhuSkill("songwei", event.player);
		},
		async cost(event, trigger, player) {
			event.result = await trigger.player
				.chooseBool("是否发动【颂威】，令" + get.translation(player) + "摸一张牌？")
				.set("choice", get.attitude(trigger.player, player) > 0)
				.forResult();
		},
		async content(event, trigger, player) {
			trigger.player.line(player, "green");
			player.draw();
		},
	},
	jiezi: {
		trigger: { global: ["phaseDrawSkipped", "phaseDrawCancelled"] },
		audio: 2,
		forced: true,
		filter(event, player) {
			return event.player != player;
		},
		async content(event, trigger, player) {
			await player.draw();
		},
	},
	gzduanliang: {
		audio: "duanliang1",
		audioname: ["re_xuhuang"],
		group: ["duanliang1", "duanliang2"],
		ai: {
			threaten: 1.2,
		},
	},
	duanliang: {
		audio: "duanliang1",
		audioname: ["re_xuhuang"],
		group: ["duanliang1", "duanliang3"],
		ai: {
			threaten: 1.2,
		},
	},
	duanliang1: {
		audio: 2,
		audioname: ["re_xuhuang"],
		enable: "chooseToUse",
		sourceSkill: "duanliang",
		filterCard(card) {
			if (get.type(card) != "basic" && get.type(card) != "equip") {
				return false;
			}
			return get.color(card) == "black";
		},
		filter(event, player) {
			return player.countCards("hes", { type: ["basic", "equip"], color: "black" });
		},
		position: "hes",
		viewAs: { name: "bingliang" },
		prompt: "将一黑色的基本牌或装备牌当兵粮寸断使用",
		check(card) {
			return 6 - get.value(card);
		},
		ai: {
			order: 9,
		},
	},
	duanliang2: {
		mod: {
			targetInRange(card, player, target) {
				if (card.name == "bingliang") {
					if (get.distance(player, target) <= 2) {
						return true;
					}
				}
			},
		},
	},
	duanliang3: {
		mod: {
			targetInRange(card, player, target) {
				if (card.name == "bingliang") {
					if (target.countCards("h") >= player.countCards("h")) {
						return true;
					}
				}
			},
		},
	},
	haoshi: {
		audio: 2,
		trigger: { player: "phaseDrawBegin2" },
		filter(event, player) {
			return !event.numFixed;
		},
		preHidden: true,
		check(event, player) {
			return (
				player.countCards("h") + 2 + event.num <= 5 ||
				game.hasPlayer(function (target) {
					return (
						player !== target &&
						!game.hasPlayer(function (current) {
							return current !== player && current !== target && current.countCards("h") < target.countCards("h");
						}) &&
						get.attitude(player, target) > 0
					);
				})
			);
		},
		async content(event, trigger, player) {
			trigger.num += 2;
			player.addSkill("haoshi2");
		},
		ai: {
			threaten: 2,
			noh: true,
			skillTagFilter(player, tag) {
				if (tag == "noh") {
					if (player.countCards("h") != 2) {
						return false;
					}
				}
			},
		},
	},
};
