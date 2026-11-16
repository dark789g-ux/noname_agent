import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "jutu" | "yaohu" | "rehuaibi">} */
export const groupSkills = {
	//新刘璋
	jutu: {
		audio: "xiusheng",
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		filter(event, player) {
			return (
				player.storage.yaohu &&
				game.hasPlayer(function (current) {
					return current.group == player.storage.yaohu;
				})
			);
		},
		content() {
			"step 0";
			var cards = player.getExpansions("jutu");
			if (cards.length > 0) {
				player.gain(cards, "gain2");
			}
			"step 1";
			event.num = game.countPlayer(function (current) {
				return current.group == player.storage.yaohu;
			});
			player.draw(event.num + 1);
			if (!event.num) {
				event.finish();
			}
			"step 2";
			var he = player.getCards("he");
			if (!he.length) {
				event.finish();
			} else if (he.length < num) {
				event._result = { bool: true, cards: he };
			} else {
				player.chooseCard("he", true, num, "选择" + get.cnNumber(num) + "张牌作为生");
			}
			"step 3";
			if (result.bool) {
				var cards = result.cards;
				player.addToExpansion(player, "give", cards).gaintag.add("jutu");
			}
			"step 4";
			game.delayx();
		},
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		ai: {
			combo: "yaohu",
		},
	},
	yaohu: {
		audio: "yinlang",
		trigger: { player: "phaseBegin" },
		direct: true,
		forced: true,
		locked: false,
		filter(event, player) {
			return (
				!player.hasSkill("yaohu_round") &&
				game.hasPlayer(function (current) {
					return current.group && current.group != "unknown";
				})
			);
		},
		content() {
			"step 0";
			var list = [];
			game.countPlayer(function (current) {
				if (current.group && current.group != "unknown") {
					list.add(current.group);
				}
			});
			list.sort(function (a, b) {
				return lib.group.indexOf(a) - lib.group.indexOf(b);
			});
			if (!player.hasSkill("yaohu")) {
				list.push("cancel2");
			}
			player
				.chooseControl(list)
				.set("prompt", "邀虎：请选择一个势力")
				.set("ai", function () {
					return _status.event.choice;
				})
				.set(
					"choice",
					(function () {
						var getn = function (group) {
							return game.countPlayer(function (current) {
								if (current.group != group) {
									return false;
								}
								if (player == current) {
									return 2;
								}
								if (get.attitude(current, player) > 0) {
									return 1;
								}
								return 1.3;
							});
						};
						list.sort(function (a, b) {
							return getn(b) - getn(a);
						});
						return list[0];
					})()
				);
			"step 1";
			if (result.control != "cancel2") {
				player.logSkill(
					"yaohu",
					game.filterPlayer(function (current) {
						return current.group == result.control;
					})
				);
				game.log(player, "选择了", "#y" + get.translation(result.control + 2));
				player.storage.yaohu = result.control;
				player.markSkill("yaohu");
			}
		},
		ai: {
			combo: "jutu",
		},
		intro: { content: "已选择了$势力" },
		group: "yaohu_gain",
		subSkill: {
			round: {},
			gain: {
				audio: "yinlang",
				trigger: { global: "phaseUseBegin" },
				forced: true,
				locked: false,
				filter(event, player) {
					return event.player != player && event.player.group == player.storage.yaohu && event.player.isIn() && player.getExpansions("jutu").length > 0;
				},
				logTarget: "player",
				content() {
					"step 0";
					var target = trigger.player;
					event.target = target;
					target.chooseButton(["选择获得一张“生”", player.getExpansions("jutu")], true).set("ai", function (button) {
						return get.value(button.link, player);
					});
					"step 1";
					if (result.bool) {
						target.gain(result.links, "give", player, "bySelf");
					}
					"step 2";
					if (
						game.hasPlayer(function (current) {
							return current != player && current != target;
						})
					) {
						player
							.chooseTarget(true, "选择" + get.translation(target) + "使用【杀】的目标", function (card, player, target) {
								return target != player && target != _status.event.source;
							})
							.set("source", target)
							.set("ai", function (target) {
								var evt = _status.event;
								return get.effect(target, { name: "sha" }, evt.source, evt.player);
							});
					} else {
						event._result = { bool: false };
						event.goto(4);
					}
					"step 3";
					var target2 = result.targets[0];
					player.line(target2, "green");
					target
						.chooseToUse(
							function (card, player, event) {
								if (get.name(card) != "sha") {
									return false;
								}
								return lib.filter.filterCard.apply(this, arguments);
							},
							"对" + get.translation(target2) + "使用一张杀，否则交给其两张牌"
						)
						.set("targetRequired", true)
						.set("complexSelect", true)
						.set("complexTarget", true)
						.set("filterTarget", function (card, player, target) {
							if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
								return false;
							}
							return lib.filter.targetEnabled.apply(this, arguments);
						})
						.set("sourcex", target2)
						.set("addCount", false);
					"step 4";
					if (!result.bool) {
						var hs = target.getCards("he");
						if (!hs.length) {
							event.finish();
						} else if (hs.length <= 2) {
							event._result = { bool: true, cards: hs };
						} else {
							target.chooseCard(2, true, "交给" + get.translation(player) + "两张牌", "he");
						}
					} else {
						event.finish();
					}
					"step 5";
					if (result.bool) {
						target.give(result.cards, player);
					}
				},
			},
		},
	},
	rehuaibi: {
		audio: "huaibi",
		zhuSkill: true,
		mod: {
			maxHandcard(player, num) {
				if (player.storage.yaohu && player.hasZhuSkill("rehuaibi")) {
					return (
						num +
						game.countPlayer(function (current) {
							return current.group == player.storage.yaohu;
						})
					);
				}
			},
		},
		ai: { combo: "yaohu" },
	},
};
