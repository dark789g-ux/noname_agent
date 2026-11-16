import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "rezhoufu" | "reyingbing" | "kuiwei" | "kuiwei2" | "yanzheng" | "tongji" | "wangzun" | "wangzun2" | "wangzun3" | "kaikang" | "liangzhu" | "fanxiang" | "mingshi">} */
export const groupSkills = {
	rezhoufu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		filterCard: true,
		filterTarget(card, player, target) {
			return target != player && !target.getExpansions("rezhoufu_judge").length;
		},
		check(card) {
			return 6 - get.value(card);
		},
		position: "he",
		discard: false,
		lose: false,
		delay: false,
		content() {
			target.addToExpansion(cards, player, "give").gaintag.add("rezhoufu_judge");
			target.addSkill("rezhoufu_judge");
		},
		ai: {
			order: 1,
			result: {
				target: -1,
			},
		},
		group: ["rezhoufu_losehp"],
		subSkill: {
			judge: {
				audio: "rezhoufu",
				init: player => {
					player.storage.rezhoufu_judge_markcount = 0;
				},
				onremove: player => {
					delete player.storage.rezhoufu_judge_markcount;
					let cards = player.getExpansions("rezhoufu_judge");
					if (cards.length) {
						player.loseToDiscardpile(cards);
					}
				},
				intro: {
					content: "expansion",
				},
				trigger: { player: "judgeBefore" },
				forced: true,
				charlotte: true,
				filter(event, player) {
					return !event.directresult && player.getExpansions("rezhoufu_judge").length;
				},
				content() {
					trigger.directresult = player.getExpansions("rezhoufu_judge")[0];
					player.storage.rezhoufu_judge_markcount = 0;
				},
			},
			losehp: {
				audio: "rezhoufu",
				trigger: { global: "phaseEnd" },
				forced: true,
				filter(event, player) {
					return game.hasPlayer(function (current) {
						return current.hasHistory("lose", function (evt) {
							if (!evt || !evt.xs || !evt.xs.length) {
								return false;
							}
							for (var i in evt.gaintag_map) {
								if (evt.gaintag_map[i].includes("rezhoufu_judge")) {
									return true;
								}
							}
							return false;
						});
					});
				},
				logTarget(current) {
					return game
						.filterPlayer(function (current) {
							return current.hasHistory("lose", function (evt) {
								if (!evt || !evt.xs || !evt.xs.length) {
									return false;
								}
								for (var i in evt.gaintag_map) {
									if (evt.gaintag_map[i].includes("rezhoufu_judge")) {
										return true;
									}
								}
								return false;
							});
						})
						.sortBySeat();
				},
				content() {
					var targets = game
						.filterPlayer(function (current) {
							return current.hasHistory("lose", function (evt) {
								if (!evt || !evt.xs || !evt.xs.length) {
									return false;
								}
								for (var i in evt.gaintag_map) {
									if (evt.gaintag_map[i].includes("rezhoufu_judge")) {
										return true;
									}
								}
								return false;
							});
						})
						.sortBySeat();
					while (targets.length) {
						targets.shift().loseHp();
					}
				},
			},
		},
	},
	reyingbing: {
		audio: 2,
		trigger: { global: "useCard" },
		forced: true,
		filter(event, player) {
			var cards = event.player.getExpansions("rezhoufu_judge");
			return cards.length && get.color(cards[0]) == get.color(event.card);
		},
		logTarget: "player",
		content() {
			"step 0";
			player.draw();
			"step 1";
			trigger.player.storage.rezhoufu_judge_markcount++;
			if (trigger.player.storage.rezhoufu_judge_markcount >= 2) {
				var cards = trigger.player.getExpansions("rezhoufu_judge");
				player.gain(cards, trigger.player, "give", "bySelf");
				trigger.player.removeSkill("rezhoufu_judge");
			} else {
				trigger.player.markSkill("rezhoufu_judge");
			}
		},
		ai: {
			combo: "rezhoufu",
		},
	},
	kuiwei: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		check(event, player) {
			if (player.isTurnedOver()) {
				return true;
			}
			var num = game.countPlayer(function (current) {
				return current.getEquip(1);
			});
			return num > 1;
		},
		content() {
			"step 0";
			player.turnOver();
			"step 1";
			var num = game.countPlayer(function (current) {
				return current.getEquips(1).length;
			});
			player.draw(2 + num);
			player.addSkill("kuiwei2");
		},
	},
	kuiwei2: {
		trigger: { player: "phaseDrawBegin" },
		forced: true,
		audio: false,
		sourceSkill: "kuiwei",
		content() {
			var num = game.countPlayer(function (current) {
				return current.getEquips(1).length;
			});
			if (num >= player.countCards("he")) {
				player.discard(player.getCards("he"));
			} else if (num) {
				player.chooseToDiscard("he", num, true);
			}
			player.removeSkill("kuiwei2");
		},
	},
	yanzheng: {
		enable: "chooseToUse",
		audio: 2,
		filter(event, player) {
			return player.hp < player.countCards("h") && player.countCards("e") > 0;
		},
		viewAsFilter(player) {
			return player.hp < player.countCards("h") && player.countCards("e") > 0;
		},
		filterCard: true,
		position: "e",
		viewAs: { name: "wuxie" },
		prompt: "将一张装备区内的牌当无懈可击使用",
		check(card) {
			return 8 - get.equipValue(card);
		},
		threaten: 1.2,
	},
	tongji: {
		global: "tongji_disable",
		audio: 2,
		trigger: { global: "useCard1" },
		forced: true,
		filter(event, player) {
			return event.targets.includes(player) && player != event.player && event.card.name == "sha" && player.hp < player.countCards("h");
		},
		content() {},
		ai: { neg: true },
		gainable: true,
		subSkill: {
			disable: {
				mod: {
					targetEnabled(card, player, target) {
						if (card.name == "sha") {
							if (player.hasSkill("tongji")) {
								return;
							}
							if (target.hasSkill("tongji")) {
								return;
							}
							if (
								game.hasPlayer(function (current) {
									return current.hasSkill("tongji") && current.hp < current.countCards("h") && player.inRange(current);
								})
							) {
								return false;
							}
						}
					},
				},
			},
		},
	},
	wangzun: {
		audio: 2,
		audioname: ["old_yuanshu"],
		trigger: { global: "phaseZhunbeiBegin" },
		check(event, player) {
			var att = get.attitude(player, event.player);
			return !game.hasPlayer(function (current) {
				return get.attitude(player, current) < att;
			});
		},
		filter(event, player) {
			return event.player != player && !player.storage.wangzun;
		},
		logTarget: "player",
		content() {
			player.draw();
			player.markSkill("wangzun");
			player.storage.wangzun = trigger.player;
			trigger.player.addTempSkill("wangzun3");
		},
		ai: {
			expose: 0.2,
		},
		intro: {
			content: "player",
		},
		group: "wangzun2",
	},
	wangzun2: {
		trigger: { player: "phaseZhunbeiBegin" },
		silent: true,
		sourceSkill: "wangzun",
		content() {
			player.unmarkSkill("wangzun");
			player.storage.wangzun = null;
		},
	},
	wangzun3: {
		mod: {
			maxHandcard(player, num) {
				return num - 1;
			},
		},
	},
	kaikang: {
		audio: 2,
		trigger: { global: "useCardToTargeted" },
		filter(event, player) {
			return event.card.name == "sha" && get.distance(player, event.target) <= 1 && event.target.isIn();
		},
		check(event, player) {
			return get.attitude(player, event.target) >= 0;
		},
		preHidden: true,
		logTarget: "target",
		content() {
			"step 0";
			player.draw();
			if (trigger.target != player) {
				player.chooseCard(true, "he", "交给" + get.translation(trigger.target) + "一张牌").set("ai", function (card) {
					if (get.position(card) == "e") {
						return -1;
					}
					if (card.name == "shan") {
						return 1;
					}
					if (get.type(card) == "equip") {
						return 0.5;
					}
					return 0;
				});
			} else {
				event.finish();
			}
			"step 1";
			player.give(result.cards, trigger.target, "give");
			game.delay();
			event.card = result.cards[0];
			"step 2";
			if (trigger.target.getCards("h").includes(card) && get.type(card) == "equip") {
				trigger.target.chooseUseTarget(card);
			}
		},
		ai: {
			threaten: 1.1,
		},
	},
	liangzhu: {
		audio: 2,
		trigger: { global: "recoverAfter" },
		direct: true,
		filter(event, player) {
			return event.player.isPhaseUsing();
		},
		content() {
			"step 0";
			if (player == trigger.player) {
				player
					.chooseControl("摸一张", "摸两张", "cancel2", function () {
						return "摸两张";
					})
					.set("prompt", get.prompt2("liangzhu"));
				event.single = true;
			} else {
				player
					.chooseTarget(get.prompt2("liangzhu"), function (card, player, target) {
						return target == _status.event.player || target == _status.event.target;
					})
					.set("target", trigger.player)
					.set("ai", function (target) {
						var player = _status.event.player;
						if (player == target) {
							return 1;
						}
						return get.attitude(player, target) - 1.5;
					});
			}
			"step 1";
			if (event.single) {
				if (result.control != "cancel2") {
					player.logSkill("liangzhu", player);
					if (result.control == "摸一张") {
						player.draw();
					} else {
						player.draw(2);
						if (!player.storage.liangzhu) {
							player.storage.liangzhu = [];
						}
						player.storage.liangzhu.add(player);
					}
				}
			} else if (result.bool) {
				var target = result.targets[0];
				player.logSkill("liangzhu", target);
				if (target == player) {
					target.draw();
				} else {
					target.draw(2);
					if (target.storage.liangzhu) {
						target.storage.liangzhu.add(player);
					} else {
						target.storage.liangzhu = [player];
					}
				}
			}
		},
		ai: {
			expose: 0.1,
		},
	},
	fanxiang: {
		skillAnimation: true,
		animationColor: "fire",
		audio: 2,
		juexingji: true,
		derivation: "xiaoji",
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current.storage.liangzhu?.includes(player) && current.isDamaged();
			});
		},
		forced: true,
		content() {
			player.awakenSkill(event.name);
			player.gainMaxHp();
			player.recover();
			player.changeSkills(["xiaoji"], ["liangzhu"]);
		},
		ai: {
			combo: "liangzhu",
		},
	},
	mingshi: {
		audio: 2,
		trigger: { player: "damageBegin3" },
		direct: true,
		filter(event, player) {
			return event.source && event.source.hp > player.hp;
		},
		content() {
			"step 0";
			var next = player.chooseToDiscard(get.prompt2("mingshi"), { color: "black" });
			next.set("ai", function (card) {
				return 9 - get.value(card);
			});
			next.set("logSkill", "mingshi");
			"step 1";
			if (result.bool) {
				trigger.num--;
			}
		},
		ai: {
			threaten: 0.8,
		},
	},
};
