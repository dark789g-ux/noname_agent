import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "baobian" | "chongzhen" | "lihun" | "lihun2" | "yuanhu" | "tianming" | "mizhao" | "gongao" | "juyi" | "benghuai_zhugedan" | "weizhong">} */
export const groupSkills = {
	baobian: {
		trigger: { player: ["phaseBefore", "changeHp"] },
		forced: true,
		popup: false,
		init(player) {
			if (game.online) {
				return;
			}
			player.removeAdditionalSkill("baobian");
			var list = [];
			if (player.hp <= 3) {
				//if(trigger.num!=undefined&&trigger.num<0&&player.hp-trigger.num>1) player.logSkill('baobian');
				list.push("oltiaoxin");
			}
			if (player.hp <= 2) {
				list.push("olpaoxiao");
			}
			if (player.hp <= 1) {
				list.push("xinshensu");
			}
			if (list.length) {
				player.addAdditionalSkill("baobian", list);
			}
		},
		derivation: ["oltiaoxin", "olpaoxiao", "xinshensu"],
		content() {
			player.removeAdditionalSkill("baobian");
			var list = [];
			if (player.hp <= 3) {
				if (trigger.num != undefined && trigger.num < 0 && player.hp - trigger.num > 1) {
					player.logSkill("baobian");
				}
				list.push("oltiaoxin");
			}
			if (player.hp <= 2) {
				list.push("olpaoxiao");
			}
			if (player.hp <= 1) {
				list.push("xinshensu");
			}
			if (list.length) {
				player.addAdditionalSkill("baobian", list);
			}
		},
		ai: {
			maixie: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (!target.hasFriend()) {
							return;
						}
						if (target.hp >= 4) {
							return [0, 1];
						}
					}
					if (get.tag(card, "recover") && player.hp >= player.maxHp - 1) {
						return [0, 0];
					}
				},
			},
		},
	},
	chongzhen: {
		audio: 2,
		audioname: ["huan_zhaoyun"],
		trigger: { player: ["useCard", "respond"] },
		filter(event, player) {
			if (event.card.name != "sha" && event.card.name != "shan") {
				return false;
			}
			if (!event.skill || event.skill.indexOf("fanghun") + event.skill.indexOf("longdan") == -2) {
				return false;
			}
			var target = lib.skill.chongzhen.logTarget(event, player);
			return target && target.countGainableCards(player, "h") > 0;
		},
		logTarget(event, player) {
			if (event.name == "respond") {
				return event.source;
			}
			if (event.card.name == "sha") {
				return event.targets[0];
			}
			return event.respondTo[0];
		},
		prompt2(event, player) {
			var target = lib.skill.chongzhen.logTarget(event, player);
			return "获得" + get.translation(target) + "的一张手牌";
		},
		content() {
			var target = lib.skill.chongzhen.logTarget(trigger, player);
			player.gainPlayerCard(target, "h", true);
		},
		ai: {
			combo: "ollongdan",
			mingzhi: false,
			effect: {
				target(card, player, target, current) {
					if (get.tag(card, "respondShan") || get.tag(card, "respondSha")) {
						if (get.attitude(target, player) <= 0) {
							if (current > 0) {
								return;
							}
							if (target.countCards("h") == 0) {
								return 1.6;
							}
							if (target.countCards("h") == 1) {
								return 1.2;
							}
							if (target.countCards("h") == 2) {
								return [0.8, 0.2, 0, -0.2];
							}
							return [0.4, 0.7, 0, -0.7];
						}
					}
				},
			},
		},
	},
	lihun: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return player != target && target.hasSex("male");
		},
		filterCard: true,
		position: "he",
		logAudio: () => 1,
		async content(event, trigger, player) {
			const { target } = event;
			await player.gainPlayerCard(target, true, "h", target.countCards("h"));
			await player.turnOver();
			player.addSkill("lihun2");
			player.markAuto("lihun2", target);
		},
		check(card) {
			return 8 - get.value(card);
		},
		ai: {
			order: 10,
			result: {
				player(player) {
					if (player.classList.contains("turnedover")) {
						return 10;
					}
					return 0;
				},
				target(player, target) {
					if (target.countCards("h") > target.hp) {
						return target.hp - target.countCards("h");
					}
					return 0;
				},
			},
			threaten: 1.5,
		},
	},
	lihun2: {
		trigger: { player: "phaseUseEnd" },
		forced: true,
		audio: "lihun2.mp3",
		sourceSkill: "lihun",
		onremove: true,
		async content(event, trigger, player) {
			player.storage.lihun2 = player.storage.lihun2.sortBySeat();
			for (let i of player.storage.lihun2) {
				if (!i.isIn() || i.hp <= 0) {
					continue;
				}
				if (!player.countCards("he")) {
					break;
				}
				let cards = player.getCards("he");
				if (cards.length > i.hp) {
					const next = await player.chooseCard("he", true, i.hp, "离魂：选择要交给" + get.translation(i) + "的牌").forResult();
					cards = next.cards;
				}
				await player.give(cards, i);
			}
			player.removeSkill("lihun2");
		},
	},
	yuanhu: {
		audio: 3,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return player.countCards("he", { type: "equip" }) > 0;
		},
		logAudio(_1, _2, _3, _4, result) {
			return "yuanhu" + Math.min(get.equipNum(result.cards[0]), 3) + ".mp3";
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					filterCard(card) {
						return get.type(card) == "equip";
					},
					position: "he",
					filterTarget(card, player, target) {
						return target.canEquip(card);
					},
					ai1(card) {
						return 6 - get.value(card);
					},
					ai2(target) {
						return get.attitude(_status.event.player, target) - 3;
					},
					prompt: get.prompt2(event.skill),
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			const card = event.cards[0];
			await target.equip(card);
			if (target != player) {
				player.$give(card, target, false);
			}
			switch (get.subtype(card)) {
				case "equip1": {
					if (
						!game.hasPlayer(function (current) {
							return get.distance(target, current) <= 1;
						})
					) {
						return;
					}
					await game.delay();
					const { targets } = await player
						.chooseTarget(
							true,
							function (card, player, target) {
								return get.distance(_status.event.thisTarget, target) <= 1 && target.countCards("hej");
							},
							"选择一名与" + get.translation(target) + "距离1以内的角色，弃置其一张牌"
						)
						.set("ai", function (target) {
							var attitude = get.attitude(_status.event.player, target);
							if (attitude > 0 && target.countCards("j")) {
								return attitude * 1.5;
							}
							return -attitude;
						})
						.set("thisTarget", target)
						.forResult();
					if (targets.length) {
						await player.discardPlayerCard(true, targets[0], "hej");
					}
					return;
				}
				case "equip2":
					await target.draw();
					return;
				case "equip5":
					return;
				default:
					await target.recover();
					return;
			}
		},
	},
	tianming: {
		audio: 2,
		audioname2: { caoteng: "tianming_caoteng" },
		trigger: { target: "useCardToTargeted" },
		check(event, player) {
			var cards = player.getCards("h");
			if (cards.length <= 2) {
				for (var i = 0; i < cards.length; i++) {
					if (cards[i].name == "shan" || cards[i].name == "tao") {
						return false;
					}
				}
			}
			return true;
		},
		filter(event, player) {
			return event.card.name == "sha";
		},
		content() {
			"step 0";
			player.chooseToDiscard(2, true, "he");
			player.draw(2);
			var players = game.filterPlayer();
			players.sort(function (a, b) {
				return b.hp - a.hp;
			});
			if (players[0].hp > players[1].hp && players[0] != player) {
				players[0].chooseBool(get.prompt2("tianming"));
				event.player = players[0];
			} else {
				event.finish();
			}
			"step 1";
			if (result.bool) {
				player.chooseToDiscard(2, true, "he");
				player.draw(2);
			}
		},
		ai: {
			effect: {
				target_use(card, player, target, current) {
					if (card.name == "sha") {
						return [1, 0.5];
					}
				},
			},
		},
	},
	mizhao: {
		enable: "phaseUse",
		usable: 1,
		audio: 2,
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		filterCard: true,
		selectCard: -1,
		filterTarget(card, player, target) {
			return player != target;
		},
		discard: false,
		lose: false,
		delay: false,
		ai: {
			order: 1,
			result: {
				player: 0,
				target(player, target) {
					if (target.hasSkillTag("nogain")) {
						return 0;
					}
					if (player.countCards("h") > 1) {
						return 1;
					}
					var players = game.filterPlayer();
					for (var i = 0; i < players.length; i++) {
						if (players[i].countCards("h") && players[i] != target && players[i] != player && get.attitude(player, players[i]) < 0) {
							break;
						}
					}
					if (i == players.length) {
						return 1;
					}
					return -2 / (target.countCards("h") + 1);
				},
			},
		},
		content() {
			"step 0";
			event.target1 = targets[0];
			player.give(cards, targets[0], false);
			"step 1";
			if (!targets[0].countCards("h")) {
				event.finish();
				return;
			}
			var players = game.filterPlayer();
			for (var i = 0; i < players.length; i++) {
				if (players[i] != event.target1 && players[i] != player && event.target1.canCompare(players[i])) {
					break;
				}
			}
			if (i == players.length) {
				event.finish();
			}
			"step 2";
			player
				.chooseTarget(true, "选择拼点目标", function (card, player, target) {
					return _status.event.target1.canCompare(target) && target != player;
				})
				.set("ai", function (target) {
					var player = _status.event.player;
					var eff = get.effect(target, { name: "sha" }, _status.event.target1, player);
					var att = get.attitude(player, target);
					if (att > 0) {
						return eff - 10;
					}
					return eff;
				})
				.set("target1", event.target1)
				.set("forceDie", true);
			"step 3";
			if (result.targets.length) {
				event.target2 = result.targets[0];
				event.target1.line(event.target2);
				event.target1.chooseToCompare(event.target2);
			} else {
				event.finish();
			}
			"step 4";
			if (!result.tie) {
				if (result.bool) {
					if (event.target1.canUse({ name: "sha", isCard: true }, event.target2, false)) {
						event.target1.useCard({ name: "sha", isCard: true }, event.target2);
					}
				} else if (event.target2.canUse({ name: "sha", isCard: true }, event.target1, false)) {
					event.target2.useCard({ name: "sha", isCard: true }, event.target1);
				}
			}
		},
	},
	gongao: {
		audio: 2,
		trigger: { global: "dieAfter" },
		forced: true,
		content() {
			player.gainMaxHp();
			player.recover();
		},
		ai: {
			threaten: 1.5,
		},
	},
	juyi: {
		skillAnimation: true,
		animationColor: "thunder",
		audio: 2,
		derivation: ["benghuai", "weizhong"],
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.maxHp > game.countPlayer();
		},
		forced: true,
		juexingji: true,
		content() {
			player.awakenSkill(event.name);
			player.draw(player.maxHp);
			player.addSkills(["benghuai", "weizhong"]);
		},
	},
	benghuai_zhugedan: { audio: 1 },
	weizhong: {
		audio: 1,
		trigger: { player: ["gainMaxHpEnd", "loseMaxHpEnd"] },
		forced: true,
		content() {
			player.draw(player.isMinHandcard() ? 2 : 1);
		},
	},
};
