import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olhuanfu" | "olqingyi">} */
export const groupSkills = {
	//夏侯玄
	olhuanfu: {
		audio: 2,
		trigger: {
			player: "useCardToPlayered",
			target: "useCardToTargeted",
		},
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			if (player == event.player && !event.isFirstTarget) {
				return false;
			}
			if (event.olhuanfu_map && event.olhuanfu_map[player.playerid]) {
				return false;
			}
			return player.maxHp > 0 && player.countCards("he") > 0;
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseToDiscard("he", [1, player.maxHp], get.prompt("olhuanfu"), "通过弃牌，预测" + (player == trigger.player ? "你" : get.translation(trigger.player)) + "使用的" + get.translation(trigger.card) + "能造成多少伤害。如果弃置的牌数等于总伤害，则你摸两倍的牌。", "allowChooseAll")
				.set(
					"predict",
					(function () {
						var target = trigger.target;
						if (player == target) {
							if (trigger.targets.length > 1 || player.hasShan() || get.effect(player, trigger.card, trigger.player, player) == 0) {
								return 0;
							}
						} else {
							var target = trigger.target;
							if (trigger.targets.length > 1 || target.mayHaveShan(player, "use")) {
								return 0;
							}
						}
						var num = trigger.getParent().baseDamage;
						var map = trigger.getParent().customArgs,
							id = target.playerid;
						if (map[id]) {
							if (typeof map[id].baseDamage == "number") {
								num = map[id].baseDamage;
							}
							if (typeof map[id].extraDamage == "number") {
								num += map[id].extraDamage;
							}
						}
						if (
							target.hasSkillTag("filterDamage", null, {
								player: trigger.player,
								card: trigger.card,
							})
						) {
							num = 1;
						}
						return num;
					})()
				)
				.set("ai", function (card) {
					var num = _status.event.predict,
						player = _status.event.player;
					if (ui.selected.cards.length >= num) {
						return 0;
					}
					if (
						player.countCards("he", function (card) {
							return get.value(card) < 6 + num;
						}) < num
					) {
						return 0;
					}
					return 6 + num - get.value(card);
				}).logSkill = "olhuanfu";
			"step 1";
			if (result.bool) {
				player.addTempSkill("olhuanfu_lottery");
				var evt = trigger.getParent();
				if (!evt.olhuanfu_map) {
					evt.olhuanfu_map = {};
				}
				evt.olhuanfu_map[player.playerid] = result.cards.length;
			}
		},
		ai: {
			effect: {
				target_use(card, player, target, current) {
					if (card.name == "sha" && target.hp > 0 && current < 0 && target.countCards("he") > 0) {
						return 0.7;
					}
				},
			},
		},
		subSkill: {
			lottery: {
				audio: "olhuanfu",
				trigger: { global: "useCardAfter" },
				forced: true,
				charlotte: true,
				filter(event, player) {
					var map = event.olhuanfu_map;
					if (!map || !map[player.playerid]) {
						return false;
					}
					var num = 0;
					event.player.getHistory("sourceDamage", function (evt) {
						if (evt.card == event.card && evt.getParent().type == "card") {
							num += evt.num;
						}
					});
					return num == map[player.playerid];
				},
				content() {
					player.draw(2 * trigger.olhuanfu_map[player.playerid]);
				},
			},
		},
	},
	olqingyi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return (
				player.hasCard(function (card) {
					return lib.filter.cardDiscardable(card, player, "olqingyi");
				}, "he") && game.hasPlayer(current => lib.skill.olqingyi.filterTarget(null, player, current))
			);
		},
		selectTarget: [1, 2],
		filterTarget(card, player, target) {
			return target != player && target.countCards("he") > 0;
		},
		multitarget: true,
		multiline: true,
		content() {
			"step 0";
			var list = [player];
			list.addArray(targets);
			list.sortBySeat();
			event.list = list;
			for (var target of event.list) {
				if (
					!target.hasCard(function (card) {
						return lib.filter.cardDiscardable(card, target, "olqingyi");
					}, "he")
				) {
					event.finish();
					break;
				}
			}
			"step 1";
			player
				.chooseCardOL(event.list, "he", true, "清议：选择弃置一张牌", function (card, player) {
					return lib.filter.cardDiscardable(card, player, "olqingyi");
				})
				.set("ai", get.unuseful);
			"step 2";
			var lose_list = [],
				cards = [];
			for (var i = 0; i < result.length; i++) {
				var current = event.list[i],
					card = result[i].cards[0];
				lose_list.push([current, result[i].cards]);
				cards.push(card);
			}
			game.loseAsync({
				lose_list: lose_list,
			}).setContent("discardMultiple");
			var type = get.type2(cards[0]);
			for (var i = 1; i < cards.length; i++) {
				if (get.type2(cards[i]) != type) {
					event.finish();
				}
			}
			"step 3";
			event.goto(1);
			for (var target of event.list) {
				if (
					!target.hasCard(function (card) {
						return lib.filter.cardDiscardable(card, target, "olqingyi");
					}, "he")
				) {
					event.finish();
					break;
				}
			}
		},
		ai: {
			threaten: 1.2,
			order: 9.1,
			result: {
				player(player) {
					let min = 24;
					player.countCards("he", function (card) {
						min = Math.min(min, get.value(card));
					});
					if (ui.selected.targets.length == 1) {
						return 1 - min / 6;
					}
					return 0.75 - min / 48;
				},
				target(player, target) {
					if (
						target.hasCard(function (card) {
							return lib.filter.cardDiscardable(card, player, "olqingyi");
						}, "he")
					) {
						return -1;
					}
					return 0;
				},
			},
		},
		group: "olqingyi_gain",
		subSkill: {
			gain: {
				audio: "olqingyi",
				trigger: { player: "phaseJieshuBegin" },
				direct: true,
				filter(event, player) {
					var history = player.getHistory("useSkill", evt => evt.skill == "olqingyi");
					if (!history.length) {
						return false;
					}
					var color = false;
					for (var evt of history) {
						var list = [player];
						list.addArray(evt.targets);
						for (var target of list) {
							target.getHistory("lose", function (evtx) {
								if (color === true || evtx.getParent(2).name != "olqingyi") {
									return false;
								}
								for (var card of evtx.cards) {
									if (color === true || get.position(card, true) != "d") {
										continue;
									}
									var color2 = get.color(card, false);
									if (!color) {
										color = color2;
									} else if (color != color2) {
										color = true;
									}
								}
							});
							if (color === true) {
								return true;
							}
						}
					}
					return false;
				},
				content() {
					"step 0";
					var history = player.getHistory("useSkill", evt => evt.skill == "olqingyi"),
						cards = [];
					for (var evt of history) {
						var list = [player];
						list.addArray(evt.targets);
						for (var target of list) {
							target.getHistory("lose", function (evtx) {
								if (evtx.getParent(2).name != "olqingyi") {
									return false;
								}
								for (var card of evtx.cards) {
									if (get.position(card, true) == "d") {
										cards.add(card);
									}
								}
							});
						}
					}
					player
						.chooseButton(["清议：选择获得两张异色牌", cards], 2)
						.set("filterButton", function (button) {
							if (!ui.selected.buttons.length) {
								return true;
							}
							return get.color(button.link, false) != get.color(ui.selected.buttons[0].link, false);
						})
						.set("ai", function (button) {
							return get.value(button.link, _status.event.player);
						});
					"step 1";
					if (result.bool) {
						player.logSkill("olqingyi_gain");
						player.gain(result.links, "gain2");
					}
				},
			},
		},
	},
};
