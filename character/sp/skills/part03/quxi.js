import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "quxi" | "bixiong" | "bixiong2" | "juguan">} */
export const groupSkills = {
	//杜袭
	quxi: {
		audio: 2,
		trigger: { player: "phaseUseEnd" },
		direct: true,
		limited: true,
		skillAnimation: true,
		animationColor: "water",
		filter(event, player) {
			if (player.isTurnedOver()) {
				return false;
			}
			var list = game.filterPlayer(target => target != player && !target.hasMark("quxi_gain") && !target.hasMark("quxi_lose"));
			if (list.length < 2) {
				return false;
			}
			var nf = list[0].countCards("h");
			for (var i = 1; i < list.length; i++) {
				if (list[i].countCards("h") != nf) {
					return true;
				}
			}
			return false;
		},
		content() {
			"step 0";
			player
				.chooseTarget(2, get.prompt("quxi"), "选择两名手牌数不同的其他角色。你将翻至背面，令这两名角色中手牌数较少的角色获得另一名角色的一张牌并获得一枚“丰”，另一名角色获得一枚“歉”。", function (card, player, target) {
					if (player == target || target.hasMark("quxi_gain") || target.hasMark("quxi_lose")) {
						return false;
					}
					if (!ui.selected.targets.length) {
						return true;
					}
					return target.countCards("h") != ui.selected.targets[0].countCards("h");
				})
				.set("complexTarget", true)
				.set("ai", function (target) {
					if (!ui.selected.targets.length) {
						var player = _status.event.player,
							hs = target.countCards("h");
						if (
							game.hasPlayer(function (current) {
								return current != player && current != target && current.countCards("h") > hs && !current.hasMark("quxi_gain") && !current.hasMark("quxi_lose");
							})
						) {
							return get.attitude(player, target) / Math.sqrt(1 + target.countCards("h"));
						}
						return 0;
					}
					if (target.countCards("h") > ui.selected.targets[0].countCards("h")) {
						return -get.attitude(_status.event.player, target);
					}
					return 0;
				});
			"step 1";
			if (result.bool) {
				player.logSkill("quxi", result.targets);
				player.awakenSkill(event.name);
				player.skip("phaseDiscard");
				if (result.targets[0].countCards("h") > result.targets[1].countCards("h")) {
					result.targets.reverse();
				}
				event.gainner = result.targets[0];
				event.giver = result.targets[1];
				player.turnOver();
			} else {
				event.finish();
			}
			"step 2";
			event.gainner.gainPlayerCard(event.giver, true, "he");
			"step 3";
			player.addSkill("quxi_effect");
			event.gainner.addMark("quxi_gain", 1);
			event.giver.addMark("quxi_lose", 1);
		},
		subSkill: {
			effect: {
				global: "quxi_gainlose",
				trigger: { global: ["roundStart", "die"] },
				charlotte: true,
				direct: true,
				filter(event, player) {
					if (event.name == "die") {
						return event.player.countMark("quxi_gain") > 0 || event.player.countMark("quxi_lose") > 0;
					}
					return game.hasPlayer(function (target) {
						return target != player && (target.countMark("quxi_gain") > 0 || target.countMark("quxi_lose") > 0);
					});
				},
				content() {
					"step 0";
					if (trigger.name == "die") {
						var gain = trigger.player.countMark("quxi_gain"),
							lose = trigger.player.countMark("quxi_lose");
						player
							.chooseTarget("是否令一名角色获得" + get.translation(trigger.player) + "的“" + (gain && lose ? "丰”和“歉" : gain ? "丰" : "歉") + "”标记？", function (card, player, target) {
								return !target.hasMark("quxi_gain") && !target.hasMark("quxi_lose");
							})
							.set("goon", gain - lose)
							.set("ai", function (target) {
								var evt = _status.event;
								return evt.goon * get.attitude(evt.player, target);
							});
					} else {
						event.goto(2);
					}
					"step 1";
					if (result.bool) {
						var targets = result.targets;
						if (targets.length < 2) {
							targets.unshift(trigger.player);
						}
						player.logSkill("quxi_effect", targets, false);
						player.line2(targets);
						var gain = targets[0].countMark("quxi_gain"),
							lose = targets[0].countMark("quxi_lose");
						if (gain) {
							targets[0].removeMark("quxi_gain", gain);
							targets[1].addMark("quxi_gain", gain);
						}
						if (lose) {
							targets[0].removeMark("quxi_lose", lose);
							targets[1].addMark("quxi_lose", lose);
						}
						game.delayx();
						event.finish();
					}
					"step 2";
					if (
						game.hasPlayer(function (target) {
							return target.countMark("quxi_gain") > 0;
						})
					) {
						player
							.chooseTarget(2, "是否转移“丰”标记？", function (card, player, target) {
								if (ui.selected.targets.length) {
									return !target.hasMark("quxi_gain") && !target.hasMark("quxi_lose");
								}
								return target.countMark("quxi_gain") > 0;
							})
							.set("complexTarget", true)
							.set("complexSelect", true)
							.set("targetprompt", ["移走标记", "获得标记"])
							.set("ai", function (target) {
								var player = _status.event.player;
								if (!ui.selected.targets.length) {
									return -get.attitude(player, target);
								}
								return get.attitude(player, target);
							});
					} else {
						event.goto(4);
					}
					"step 3";
					if (result.bool) {
						var targets = result.targets;
						player.logSkill("quxi_effect", targets, false);
						player.line2(targets);
						var gain = targets[0].countMark("quxi_gain");
						if (gain) {
							targets[0].removeMark("quxi_gain", gain);
							targets[1].addMark("quxi_gain", gain);
						}
						game.delayx();
					}
					"step 4";
					if (
						game.hasPlayer(function (target) {
							return target.countMark("quxi_lose") > 0;
						})
					) {
						player
							.chooseTarget(2, "是否转移“歉”标记？", function (card, player, target) {
								if (ui.selected.targets.length) {
									return !target.hasMark("quxi_gain") && !target.hasMark("quxi_lose");
								}
								return target.countMark("quxi_lose") > 0;
							})
							.set("complexTarget", true)
							.set("complexSelect", true)
							.set("targetprompt", ["移走标记", "获得标记"])
							.set("ai", function (target) {
								var player = _status.event.player;
								if (!ui.selected.targets.length) {
									return get.attitude(player, target);
								}
								return -get.attitude(player, target);
							});
					} else {
						event.finish();
					}
					"step 5";
					if (result.bool) {
						var targets = result.targets;
						player.logSkill("quxi_effect", targets, false);
						player.line2(targets);
						var gain = targets[0].countMark("quxi_lose");
						if (gain) {
							targets[0].removeMark("quxi_lose", gain);
							targets[1].addMark("quxi_lose", gain);
						}
						game.delayx();
					}
				},
			},
			gainlose: {
				trigger: { player: "phaseDrawBegin" },
				forced: true,
				filter(event, player) {
					if (event.numFixed) {
						return false;
					}
					return player.countMark("quxi_gain") - player.countMark("quxi_lose") != 0;
				},
				content() {
					trigger.num += player.countMark("quxi_gain") - player.countMark("quxi_lose");
				},
			},
			gain: {
				marktext: "丰",
				intro: {
					name: "驱徙(丰)",
					name2: "丰",
					content: "mark",
				},
			},
			lose: {
				marktext: "歉",
				intro: {
					name: "驱徙(歉)",
					name2: "歉",
					content: "mark",
				},
			},
		},
	},
	bixiong: {
		audio: 2,
		trigger: {
			player: "loseAfter",
			global: "loseAsyncAfter",
		},
		forced: true,
		filter(event, player) {
			if (event.type != "discard" || event.getlx === false || event.getParent("phaseDiscard").player != player) {
				return false;
			}
			var evt = event.getl(player);
			return evt && evt.hs && evt.hs.length > 0;
		},
		content() {
			var cards = [],
				hs = trigger.getl(player).hs;
			for (var i of hs) {
				cards.add(get.suit(i, player));
			}
			player.addTempSkill("bixiong2", { player: "phaseBegin" });
			player.markAuto("bixiong2", cards);
		},
	},
	bixiong2: {
		onremove: true,
		mod: {
			targetEnabled(card, player, target) {
				if (player !== target && target.getStorage("bixiong2").includes(get.suit(card))) {
					return false;
				}
			},
		},
		intro: { content: "不能成为其他角色$牌的目标" },
	},
	//高干
	juguan: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return (
				event.filterCard(
					{
						name: "sha",
					},
					player,
					event
				) ||
				event.filterCard(
					{
						name: "juedou",
					},
					player,
					event
				)
			);
		},
		chooseButton: {
			dialog() {
				return ui.create.dialog("拒关", [["sha", "juedou"], "vcard"]);
			},
			filter(button, player) {
				var evt = _status.event.getParent();
				return evt.filterCard(
					{
						name: button.link[2],
					},
					player,
					evt
				);
			},
			check(button) {
				return (
					_status.event.player.getUseValue({
						name: button.link[2],
					}) * (button.link[2] == "juedou" ? 3 : 1)
				);
			},
			backup(links) {
				return {
					audio: "juguan",
					viewAs: { name: links[0][2] },
					filterCard: true,
					check(card) {
						return 6 - get.value(card);
					},
					position: "hs",
					onuse(result, player) {
						player.addTempSkill("juguan_effect");
					},
				};
			},
			prompt(links) {
				return "将一张手牌当做" + get.translation(links[0][2]) + "使用";
			},
		},
		ai: {
			order(item, player) {
				return Math.max(get.order({ name: "sha" }), get.order({ name: "juedou" })) + 0.2;
			},
			result: { player: 1 },
		},
		subSkill: {
			effect: {
				trigger: { global: "damage" },
				forced: true,
				charlotte: true,
				firstDo: true,
				silent: true,
				popup: false,
				filter(event, player) {
					var evt = event.getParent("useCard");
					return event.card && evt && event.card == evt.card && evt.skill == "juguan_backup" && evt.player == player;
				},
				content() {
					player.addSkill("juguan_draw");
					player.markAuto("juguan_draw", [trigger.player]);
				},
			},
			draw: {
				audio: "juguan",
				trigger: { player: "phaseDrawBegin" },
				forced: true,
				charlotte: true,
				onremove: true,
				content() {
					player.removeSkill("juguan_draw");
					if (!trigger.numFixed) {
						trigger.num += 2;
					}
				},
				group: "juguan_clear",
				intro: {
					content: "若没有受到$的伤害，则下个摸牌阶段多摸两张牌",
				},
			},
			clear: {
				trigger: { player: "damage" },
				forced: true,
				charlotte: true,
				firstDo: true,
				silent: true,
				popup: false,
				filter(event, player) {
					return player.storage.juguan_draw && player.storage.juguan_draw.includes(event.source);
				},
				content() {
					player.unmarkAuto("juguan_draw", [trigger.source]);
					if (!player.storage.juguan_draw || !player.storage.juguan_draw.length) {
						player.removeSkill("juguan_draw");
					}
				},
			},
		},
	},
};
