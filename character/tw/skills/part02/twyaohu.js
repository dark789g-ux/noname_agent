import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twyaohu" | "twjiaohua">} */
export const groupSkills = {
	//刘璋
	twyaohu: {
		audio: "yinlang",
		trigger: { player: "phaseBegin" },
		direct: true,
		filter(event, player) {
			return (
				!player.hasSkill("twyaohu_round") &&
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
			if (!player.hasSkill("twyaohu")) {
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
					"twyaohu",
					game.filterPlayer(function (current) {
						return current.group == result.control;
					})
				);
				game.log(player, "选择了", "#y" + get.translation(result.control + 2));
				player.storage.yaohu = result.control;
				player.storage.twyaohu = result.control;
				player.markSkill("twyaohu");
			}
		},
		ai: { combo: "jutu" },
		intro: { content: "已选择了$势力" },
		group: "twyaohu_gain",
		subSkill: {
			round: {},
			gain: {
				audio: "yinlang",
				trigger: { global: "phaseUseBegin" },
				filter(event, player) {
					return (
						player !== event.player &&
						event.player.group === player.storage.yaohu &&
						event.player.isIn() &&
						player.getExpansions("jutu").length > 0
					);
				},
				forced: true,
				locked: false,
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
						target.gain(result.links, "give", player);
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
							"对" +
								get.translation(target2) +
								"使用一张杀，否则本回合使用伤害牌指定" +
								get.translation(player) +
								"为目标时须交给" +
								get.translation(player) +
								"两张牌，否则此牌对" +
								get.translation(player) +
								"无效"
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
						player.addTempSkill("twyaohu_effect");
					}
				},
			},
			effect: {
				audio: "yinlang",
				trigger: { target: "useCardToTarget" },
				charlotte: true,
				forced: true,
				filter(event, player) {
					return event.player == _status.currentPhase && get.is.damageCard(event.card);
				},
				logTarget: "player",
				content() {
					"step 0";
					var hs = trigger.player.getCards("he");
					if (hs.length < 2) {
						event._result = { bool: false };
					} else {
						trigger.player
							.chooseCard(2, "交给" + get.translation(player) + "两张牌，否则取消" + get.translation(trigger.card) + "对其的目标", "he")
							.set("ai", card => {
								if (_status.event.goon) {
									return 5 - get.value(card);
								}
								return 0;
							})
							.set("goon", get.effect(player, trigger.card, trigger.player, trigger.player) > 0);
					}
					"step 1";
					if (result.bool) {
						trigger.player.give(result.cards, player);
					} else {
						trigger.untrigger();
						trigger.targets.remove(player);
						trigger.getParent().triggeredTargets1.remove(player);
					}
				},
			},
		},
	},
	//李遗
	twjiaohua: {
		audio: 2,
		trigger: { global: "gainAfter" },
		filter(event, player) {
			if (event.getParent().name != "draw") {
				return false;
			}
			if (event.player != player && !event.player.isMinHp()) {
				return false;
			}
			var cards = event.cards,
				list = ["basic", "trick", "equip"];
			for (var card of cards) {
				if (list.includes(get.type2(card))) {
					list.remove(get.type2(card));
				}
			}
			for (var type of event.player.getStorage("twjiaohua_gained")) {
				if (list.includes(type)) {
					list.remove(type);
				}
			}
			return list.length > 0;
		},
		check(event, player) {
			return get.attitude(player, event.player) > 0;
		},
		prompt2(event, player) {
			var cards = event.cards,
				list = ["basic", "trick", "equip"];
			for (var card of cards) {
				if (list.includes(get.type2(card))) {
					list.remove(get.type2(card));
				}
			}
			for (var type of event.player.getStorage("twjiaohua_gained")) {
				if (list.includes(type)) {
					list.remove(type);
				}
			}
			var name = event.player == player ? "你" : get.translation(event.player);
			return (
				"令" +
				name +
				"从牌堆或弃牌堆中获得一张" +
				(event.player.isUnderControl(true)
					? list
							.map(i => get.translation(i) + "牌")
							.join("、")
							.replace(/(.*)、/, "$1或")
					: "本次未获得的类别的牌")
			);
		},
		logTarget: "player",
		content() {
			trigger.player.addTempSkill("twjiaohua_gained");
			var cards = trigger.cards,
				list = ["basic", "trick", "equip"];
			for (var card of cards) {
				if (list.includes(get.type2(card))) {
					list.remove(get.type2(card));
				}
			}
			for (var type of trigger.player.getStorage("twjiaohua_gained")) {
				if (list.includes(type)) {
					list.remove(type);
				}
			}
			list.randomSort();
			var card = get.cardPile(function (card) {
				return list.includes(get.type2(card));
			});
			if (card) {
				trigger.player.gain(card, "gain2");
				trigger.player.markAuto("twjiaohua_gained", [get.type2(card)]);
			}
		},
		subSkill: {
			gained: { onremove: true, charlotte: true },
		},
	},
};
