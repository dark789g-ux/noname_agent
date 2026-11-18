import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twzhenhu" | "twlvren">} */
export const groupSkills = {
	//李彦
	twzhenhu: {
		audio: 2,
		trigger: { player: "useCardToPlayer" },
		filter(event, player) {
			if (!event.isFirstTarget || !get.is.damageCard(event.card)) {
				return false;
			}
			return (
				!player.hasSkillTag("noCompareSource") &&
				game.hasPlayer(target => {
					return player.canCompare(target, true);
				})
			);
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt2("twzhenhu"), [1, 3], function (card, player, target) {
					return player.canCompare(target, true);
				})
				.set("ai", function (target) {
					var player = _status.event.player,
						targets = _status.event.getTrigger().targets;
					var num = 0;
					if (player.hasSkill("twlvren")) {
						num += 2 * (ui.selected.targets.length + 1);
					}
					if (player.hasSkill("twchuanshu_effect")) {
						num += 3;
					}
					var hs = player.getCards("h").sort((a, b) => get.number(b) - get.number(a));
					if (hs.length == 0) {
						return -1;
					}
					var ts = target.getCards("h").sort((a, b) => get.number(b) - get.number(a));
					if (Math.min(13, get.number(hs[0]) + num) <= get.number(ts[0])) {
						return -1;
					}
					return (
						get.effect(target, { name: "guohe_copy2" }, player, player) / 2 +
						(targets.includes(target) ? get.damageEffect(target, player, player) : 0)
					);
				});
			"step 1";
			if (result.bool) {
				var targets = result.targets.sortBySeat();
				event.targets = targets;
				player.logSkill("twzhenhu", targets);
				player.draw();
			} else {
				event.finish();
			}
			"step 2";
			player
				.chooseToCompare(targets, function (card) {
					return get.number(card);
				})
				.setContent("chooseToCompareMeanwhile");
			"step 3";
			if (result.winner && result.winner == player) {
				event.targets.remove(result.winner);
				player.line(event.targets, trigger.card.nature);
				player.addTempSkill("twzhenhu_add");
				if (!trigger.card.storage) {
					trigger.card.storage = {};
				}
				trigger.card.storage.twzhenhu = event.targets;
			} else {
				player.loseHp();
			}
		},
		subSkill: {
			add: {
				charlotte: true,
				onremove: true,
				forced: true,
				popup: false,
				trigger: { global: "damageBegin1" },
				filter(event, player) {
					if (!event.card || !event.card.storage) {
						return false;
					}
					var targets = event.card.storage.twzhenhu;
					return targets && targets.includes(event.player);
				},
				content() {
					trigger.num++;
				},
			},
		},
	},
	twlvren: {
		audio: 2,
		trigger: { source: "damageBegin3" },
		filter(event, player) {
			return event.player != player && event.player.isIn() && !event.player.hasMark("twlvren");
		},
		logTarget: "player",
		forced: true,
		locked: false,
		group: ["twlvren_more", "twlvren_add"],
		content() {
			trigger.player.addMark("twlvren", 1);
		},
		ai: {
			effect: {
				player(card, player, target) {
					if (target && target.hasMark("twlvren")) {
						return 0.33;
					}
				},
			},
		},
		marktext: "刃",
		intro: { name2: "刃", content: "mark" },
		subSkill: {
			more: {
				audio: "twlvren",
				trigger: { player: "useCard2" },
				filter(event, player) {
					var card = event.card,
						info = get.info(card);
					if (info.allowMultiple == false) {
						return false;
					}
					if (event.targets && !info.multitarget) {
						return (
							get.is.damageCard(event.card) &&
							event.targets &&
							game.hasPlayer(function (target) {
								return (
									target.hasMark("twlvren") && !event.targets.includes(target) && lib.filter.targetEnabled2(card, player, target)
								);
							})
						);
					}
					return false;
				},
				direct: true,
				content() {
					"step 0";
					player
						.chooseTarget(
							get.prompt("twlvren"),
							"为" + get.translation(trigger.card) + "额外指定一个有“刃”的角色为目标",
							function (card, player, target) {
								var evt = _status.event.getTrigger();
								return (
									target.hasMark("twlvren") && !evt.targets.includes(target) && lib.filter.targetEnabled2(evt.card, player, target)
								);
							}
						)
						.set("ai", function (target) {
							return get.effect(target, _status.event.getTrigger().card, _status.event.player);
						});
					"step 1";
					if (result.bool) {
						var targets = result.targets;
						player.logSkill("twlvren", targets);
						player.line(targets, trigger.card.nature);
						trigger.targets.addArray(targets);
						for (var i of targets) {
							i.removeMark("twlvren", i.countMark("twlvren"), false);
						}
					}
				},
			},
			add: {
				audio: "twlvren",
				trigger: { player: "compare", target: "compare" },
				filter(event, player) {
					if (player != event.target && event.iwhile) {
						return false;
					}
					return true;
				},
				forced: true,
				locked: false,
				content() {
					var num = 2 * trigger.lose_list.length;
					if (player == trigger.player) {
						trigger.num1 += num;
						if (trigger.num1 > 13) {
							trigger.num1 = 13;
						}
					} else {
						trigger.num2 += num;
						if (trigger.num2 > 13) {
							trigger.num2 = 13;
						}
					}
					game.log(player, "的拼点牌点数+", num);
				},
			},
		},
	},
};
