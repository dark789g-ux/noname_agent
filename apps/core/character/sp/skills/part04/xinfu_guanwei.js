import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xinfu_guanwei" | "xinfu_gongqing_gz_panjun" | "xinfu_gongqing" | "xinfu_andong" | "xinfu_yingshi" | "yingshi_heart" | "yingshi_die" | "xinfu_duanfa" | "xinfu_youdi">} */
export const groupSkills = {
	xinfu_guanwei: {
		audio: 2,
		usable: 1,
		init: () => {
			game.addGlobalSkill("xinfu_guanwei_ai");
		},
		onremove: () => {
			if (!game.hasPlayer(i => i.hasSkill("xinfu_guanwei", null, null, false), true)) {
				game.removeGlobalSkill("xinfu_guanwei_ai");
			}
		},
		trigger: { global: "phaseUseEnd" },
		filter(event, player) {
			var history = event.player.getHistory("useCard");
			var num = 0;
			var suit = false;
			for (var i = 0; i < history.length; i++) {
				var suit2 = get.suit(history[i].card);
				if (!lib.suit.includes(suit2)) {
					return false;
				}
				if (suit && suit != suit2) {
					return false;
				}
				suit = suit2;
				num++;
			}
			return num > 1;
		},
		async cost(event, trigger, player) {
			const { player: target } = trigger;
			event.result = await player
				.chooseToDiscard({
					prompt: get.prompt(event.skill, target),
					prompt2: "弃置一张牌，令其摸两张牌并进行一个额外的出牌阶段",
					position: "he",
					ai(card) {
						const { player, targetx } = get.event();
						if (get.attitude(player, targetx) < 1) {
							return 0;
						}
						return 9 - get.value(card);
					},
					chooseonly: true,
				})
				.set("targetx", target)
				.forResult();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const { player: target } = trigger;
			const { cards } = event;
			await player.modedDiscard(cards);
			player.line(target, "green");
			await target.draw(2);
			const evt = trigger.getParent("phase", true);
			if (evt) {
				evt.phaseList.splice(evt.num + 1, 0, `phaseUse|${event.name}`);
			}
		},
		ai: { expose: 0.5 },
		subSkill: {
			ai: {
				trigger: { player: "dieAfter" },
				filter: () => {
					return !game.hasPlayer(i => i.hasSkill("xinfu_guanwei", null, null, false), true);
				},
				silent: true,
				forceDie: true,
				content: () => {
					game.removeGlobalSkill("xinfu_guanwei_ai");
				},
				ai: {
					effect: {
						player_use(card, player, target) {
							if (typeof card != "object" || !player.isPhaseUsing()) {
								return;
							}
							var hasPanjun = game.hasPlayer(function (current) {
								return (
									current.hasSkill("xinfu_guanwei") &&
									(!current.storage.counttrigger || !current.storage.counttrigger.xinfu_guanwei) &&
									get.attitude(current, player) >= 1 &&
									current.hasCard(function (card) {
										return get.value(card) < 7 || (current != game.me && !current.isUnderControl() && !current.isOnline() && get.value(card) < 9);
									}, "he")
								);
							});
							if (!hasPanjun) {
								return;
							}
							var suitx = get.suit(card);
							var history = player.getHistory("useCard");
							if (!history.length) {
								var val = 0;
								if (
									player.hasCard(function (cardx) {
										return get.suit(cardx) == suitx && card != cardx && (!card.cards || !card.cards.includes(cardx)) && player.hasValueTarget(cardx);
									}, "hs")
								) {
									val = [2, 0.1];
								}
								if (val) {
									return val;
								}
								return;
							}
							var num = 0;
							var suit = false;
							for (var i = 0; i < history.length; i++) {
								var suit2 = get.suit(history[i].card);
								if (!lib.suit.includes(suit2)) {
									return;
								}
								if (suit && suit != suit2) {
									return;
								}
								suit = suit2;
								num++;
							}
							if (suitx == suit && num == 1) {
								return [1, 0.1];
							}
							if (
								suitx != suit &&
								(num > 1 ||
									(num <= 1 &&
										player.hasCard(function (cardx) {
											return get.suit(cardx) == suit && player.hasValueTarget(cardx);
										}, "hs")))
							) {
								return "zeroplayertarget";
							}
						},
					},
				},
			},
		},
	},
	xinfu_gongqing_gz_panjun: { audio: 2 },
	xinfu_gongqing: {
		audio: 2,
		audioname2: { gz_panjun: "xinfu_gongqing_gz_panjun" },
		trigger: {
			player: ["damageBegin3", "damageBegin4"],
		},
		forced: true,
		filter(event, player, name) {
			if (!event.source) {
				return false;
			}
			var range = event.source.getAttackRange();
			if (name == "damageBegin3") {
				return range > 3;
			}
			return event.num > 1 && range < 3;
		},
		preHidden: true,
		content() {
			trigger.num = event.triggername == "damageBegin4" ? 1 : trigger.num + 1;
		},
		ai: {
			filterDamage: true,
			skillTagFilter(player, tag, arg) {
				if (arg && arg.player) {
					if (arg.player.hasSkillTag("jueqing", false, player)) {
						return false;
					}
					if (arg.player.getAttackRange() < 3) {
						return true;
					}
				}
				return false;
			},
		},
	},
	xinfu_andong: {
		subSkill: {
			add: {
				sub: true,
				mod: {
					ignoredHandcard(card, player) {
						if (get.suit(card) == "heart") {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name == "phaseDiscard" && get.suit(card) == "heart") {
							return false;
						}
					},
				},
			},
		},
		audio: 2,
		trigger: {
			player: "damageBegin4",
		},
		filter(event, player) {
			return event.source && event.source.isIn() && event.source != player;
		},
		logTarget: "source",
		content() {
			"step 0";
			if (!trigger.source.countCards("h")) {
				event._result = { index: 1 };
			} else {
				trigger.source.chooseControlList(["令" + get.translation(player) + "观看你的手牌，并获得其中所有的红桃牌。", "防止即将对" + get.translation(player) + "造成的伤害，并使自己本回合内的红桃手牌不计入手牌上限。"], true).set("ai", function (event, player) {
					var target = _status.event.getParent().player;
					var player = _status.event.player;
					if (get.attitude(player, target) > 0) {
						return 1;
					}
					return 0;
				});
			}
			"step 1";
			if (result.index == 1) {
				trigger.cancel();
				trigger.source.addTempSkill("xinfu_andong_add");
				event.finish();
			} else {
				player.viewHandcards(trigger.source);
			}
			"step 2";
			var cards = trigger.source.getCards("h");
			var togain = [];
			for (var i = 0; i < cards.length; i++) {
				if (get.suit(cards[i]) == "heart") {
					togain.push(cards[i]);
				}
			}
			if (togain.length) {
				player.gain(togain, trigger.source, "giveAuto", "bySelf");
			}
		},
	},
	xinfu_yingshi: {
		audio: 2,
		group: ["yingshi_die"],
		trigger: {
			player: "phaseUseBegin",
		},
		direct: true,
		filter(event, player) {
			return (
				player.countCards("he", { suit: "heart" }) > 0 &&
				!game.hasPlayer(function (current) {
					return current.hasSkill("yingshi_heart");
				})
			);
		},
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt2("xinfu_yingshi"), function (card, player, target) {
					return target != player;
				})
				.set("ai", function () {
					return -1;
				});
			"step 1";
			if (result.bool) {
				var cards = player.getCards("he", { suit: "heart" });
				var target = result.targets[0];
				player.logSkill("xinfu_yingshi", target);
				target.addSkill("yingshi_heart");
				target.addToExpansion(cards, player, "give").gaintag.add("xinfu_yingshi");
			}
		},
		marktext: "酬",
		intro: {
			markcount: "expansion",
			content: "expansion",
			onunmark(storage, player) {
				player.removeSkill("yingshi_heart");
			},
		},
	},
	yingshi_heart: {
		charlotte: true,
		trigger: { player: "damageEnd" },
		sourceSkill: "xinfu_yingshi",
		filter(event, player) {
			return event.source && event.source.isIn() && event.card && event.card.name == "sha" && player.getExpansions("xinfu_yingshi").length > 0;
		},
		forced: true,
		logTarget: "source",
		content() {
			"step 0";
			trigger.source.chooseCardButton("应势：选择获得一张“酬”", player.getExpansions("xinfu_yingshi"), true);
			"step 1";
			if (result.bool) {
				trigger.source.gain(result.links, player, "give");
			}
		},
	},
	yingshi_die: {
		audio: "xinfu_yingshi",
		forced: true,
		trigger: { global: "die" },
		logTarget: "player",
		sourceSkill: "xinfu_yingshi",
		filter(event, player) {
			return event.player.getExpansions("xinfu_yingshi").length > 0;
		},
		content() {
			var target = trigger.player;
			player.gain(target.getExpansions("xinfu_yingshi"), target, "give", "bySelf");
		},
	},
	xinfu_duanfa: {
		init(player) {
			player.storage.xinfu_duanfa = 0;
		},
		audio: 2,
		enable: "phaseUse",
		position: "he",
		filter(card, player) {
			return player.storage.xinfu_duanfa < player.maxHp;
		},
		filterCard(card, player) {
			if (!lib.filter.cardDiscardable(card, player)) {
				return false;
			}
			return get.color(card) == "black";
		},
		selectCard() {
			var player = _status.event.player;
			return [1, player.maxHp - player.storage.xinfu_duanfa];
		},
		check(card) {
			return 6 - get.value(card);
		},
		delay: false,
		allowChooseAll: true,
		content() {
			player.draw(cards.length);
			player.storage.xinfu_duanfa += cards.length;
		},
		group: "xinfu_duanfa_clear",
		subSkill: {
			clear: {
				trigger: {
					player: "phaseBefore",
				},
				forced: true,
				silent: true,
				popup: false,
				content() {
					player.storage.xinfu_duanfa = 0;
				},
				sub: true,
			},
		},
		ai: {
			order: 1,
			result: {
				player: 1,
			},
		},
	},
	xinfu_youdi: {
		audio: 2,
		trigger: {
			player: "phaseJieshuBegin",
		},
		direct: true,
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt2("xinfu_youdi"), function (card, player, target) {
					return player != target;
				})
				.set("ai", function (target) {
					var player = _status.event.player;
					if (player.countCards("h", "sha") > player.countCards("h") / 3 && player.countCards("h", { color: "red" }) > player.countCards("h") / 2) {
						return 0;
					}
					if (target.countCards("he") == 0) {
						return 0.1;
					}
					return -get.attitude(_status.event.player, target);
				});
			"step 1";
			if (result.bool) {
				game.delay();
				player.logSkill("xinfu_youdi", result.targets);
				event.target = result.targets[0];
				event.target.discardPlayerCard(player, "h", true);
			} else {
				event.finish();
			}
			"step 2";
			if (get.color(result.links[0]) != "black") {
				player.draw("nodelay");
			}
			if (result.links[0].name != "sha" && event.target.countCards("he")) {
				player.gainPlayerCard("he", event.target, true);
			}
		},
		ai: {
			expose: 0.3,
			threaten: 1.4,
		},
	},
};
