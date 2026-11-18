import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olwuniang" | "olwuniang2" | "olxushen" | "olzhennan" | "olzhennan2" | "guanxu" | "yashi" | "wangong" | "wangong2">} */
export const groupSkills = {
	//OL鲍三娘
	olwuniang: {
		audio: "xinfu_wuniang",
		trigger: { player: "useCardAfter" },
		usable: 1,
		filter(event, player) {
			return event.card.name == "sha" && event.targets.length == 1 && event.targets[0].isIn();
		},
		logTarget: "targets",
		content() {
			"step 0";
			var target = trigger.targets[0];
			target
				.chooseToUse(
					function (card, player, event) {
						if (get.name(card) != "sha") {
							return false;
						}
						return lib.filter.filterCard.apply(this, arguments);
					},
					"武娘：是否对" + get.translation(player) + "使用一张杀？"
				)
				.set("targetRequired", true)
				.set("complexSelect", true)
				.set("complexTarget", true)
				.set("filterTarget", function (card, player, target) {
					if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
						return false;
					}
					return lib.filter.filterTarget.apply(this, arguments);
				})
				.set("sourcex", player);
			"step 1";
			player.addTempSkill("olwuniang2");
			player.addMark("olwuniang2", 1, false);
			player.draw();
		},
	},
	olwuniang2: {
		onremove: true,
		charlotte: true,
		mod: {
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return num + player.countMark("olwuniang2");
				}
			},
		},
	},
	olxushen: {
		derivation: "olzhennan",
		audio: "xinfu_xushen",
		trigger: { player: "dying" },
		limited: true,
		skillAnimation: true,
		animationColor: "fire",
		filter(event, player) {
			return player.hp < 1;
		},
		content() {
			"step 0";
			player.awakenSkill(event.name);
			player.addSkills("olzhennan");
			player.recover(1 - player.hp);
			"step 1";
			if (
				!player.isDying() &&
				!game.hasPlayer(function (current) {
					return current.name1 == "guansuo" || current.name2 == "guansuo";
				})
			) {
				player
					.chooseTarget(function (card, player, current) {
						return current != player && current.hasSex("male");
					}, "许身：是否令一名其他男性角色选择是否将其武将牌替换为“关索”？")
					.set("ai", function (target) {
						return get.attitude(_status.event.player, target) - 4;
					});
			} else {
				event.finish();
			}
			"step 2";
			if (!result.bool) {
				event.finish();
				return;
			}
			var target = result.targets[0];
			event.target = target;
			player.line(target, "fire");
			target.chooseBool("许身：是否将自己的一张武将牌替换为“关索”？");
			"step 3";
			if (result.bool) {
				if (target.name2 != undefined) {
					target.chooseControl(target.name1, target.name2).set("prompt", "请选择要更换的武将牌");
				} else {
					event._result = { control: target.name1 };
				}
			} else {
				event.finish();
			}
			"step 4";
			target.reinitCharacter(result.control, "guansuo");
		},
	},
	olzhennan: {
		audio: "xinfu_zhennan",
		enable: "phaseUse",
		usable: 1,
		viewAs: { name: "nanman" },
		filterCard: true,
		selectCard() {
			if (ui.selected.targets.length) {
				return [ui.selected.targets.length, Math.min(ui.selected.targets.length + 1, game.players.length - 1)];
			}
			return [1, Infinity];
		},
		check(card) {
			var player = _status.event.player;
			if (
				game.countPlayer(function (current) {
					return current != player && player.canUse("nanman", current) && get.effect(current, { name: "nanman" }, player, player) > 0;
				}) <= ui.selected.cards.length
			) {
				return 0;
			}
			return 6 - get.value(card);
		},
		selectTarget() {
			return ui.selected.cards.length;
		},
		allowChooseAll: true,
		ai: {
			order: 2,
		},
		group: "olzhennan2",
	},
	olzhennan2: {
		trigger: { target: "useCardToBefore" },
		forced: true,
		locked: false,
		audio: "olzhennan",
		sourceSkill: "olzhennan",
		filter(event, player) {
			return event.card.name == "nanman";
		},
		content() {
			trigger.cancel();
		},
	},
	//黄承彦
	guanxu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(current => lib.skill.guanxu.filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			return target != player && target.countCards("h") > 0;
		},
		content() {
			"step 0";
			var cards = get.cards(5, true);
			game.updateRoundNumber();
			var hs = target.getCards("h");
			var dialog = ["观虚：选择要操作的牌", '<div class="text center">' + get.translation(target) + "的手牌</div>", hs, '<div class="text center">牌堆顶</div>', cards];
			player
				.chooseButton(dialog, 2)
				.set("filterButton", function (button) {
					if (ui.selected.buttons.length) {
						return get.position(button.link) != get.position(ui.selected.buttons[0].link);
					}
					return true;
				})
				.set("cards1", hs)
				.set("cards2", cards)
				.set("ai", function (button) {
					var card = button.link,
						cards1 = _status.event.cards1.slice(0);
					var cards2 = _status.event.cards2.slice(0),
						target = _status.event.getParent().target;
					if (!ui.selected.buttons.length) {
						if (!cards1.includes(card)) {
							return 0;
						}
						cards1.remove(card);
						var suits = cards2.map(function (i) {
							return get.suit(i, target);
						});
						for (var i of lib.suit) {
							var num = cards1.filter(function (c) {
								return get.suit(c, target) == i;
							}).length;
							if (num > 2 || (num > 1 && suits.includes(i))) {
								return 20 + get.value(card);
							}
						}
						return get.value(card);
					}
					cards1.remove(ui.selected.buttons[0].link);
					cards1.push(card);
					for (var i of lib.suit) {
						if (
							cards1.filter(function (c) {
								return get.suit(c, target) == i;
							}).length > 2
						) {
							return 20 - get.value(card);
						}
						return get.value(ui.selected.buttons[0].link) - get.value(card);
					}
				});
			"step 1";
			if (result.bool) {
				var cards = result.links;
				if (get.position(cards[0]) != "h") {
					cards.reverse();
				}
				var next = target.lose(cards[0], ui.cardPile);
				next.insert_index_card = cards[1];
				next.insert_index = function (event) {
					return event.insert_index_card;
				};
				target.gain(cards[1], "draw");
			} else {
				event.finish();
			}
			"step 2";
			game.updateRoundNumber();
			var suits = [],
				map = {},
				hs = target.getCards("h");
			if (hs.length) {
				for (var i of hs) {
					if (!lib.filter.canBeDiscarded(i, player, target, "guanxu")) {
						continue;
					}
					var suit = get.suit(i, target);
					if (!map[suit]) {
						map[suit] = 1;
					} else {
						map[suit]++;
					}
					if (map[suit] > 2) {
						suits.add(suit);
					}
				}
				var next = player.discardPlayerCard(target, 3, "visible", "h");
				next.set("suits", suits);
				next.set("filterButton", function (button) {
					var suit = get.suit(button.link);
					if (!ui.selected.buttons.length) {
						return _status.event.suits.includes(suit);
					}
					return suit == get.suit(ui.selected.buttons[0].link);
				});
				if (suits.length) {
					next.set("forced", true);
				}
			}
		},
		ai: {
			order: 9,
			result: {
				target(player, target) {
					if (target.countCards("h") > 3) {
						return -5;
					}
					if (target.countCards("h") == 3) {
						return -3;
					}
					return -0.5;
				},
			},
		},
	},
	yashi: {
		audio: 2,
		trigger: { player: "damageEnd" },
		direct: true,
		filter(event, player) {
			if (event.source && event.source.isIn()) {
				return true;
			}
			return game.hasPlayer(current => lib.skill.guanxu.filterTarget(null, player, current));
		},
		content() {
			"step 0";
			event.addIndex = 0;
			var choiceList = [];
			if (trigger.source && trigger.source.isIn()) {
				choiceList.push("令" + get.translation(trigger.source) + "的所有非锁定技失效");
			} else {
				event.addIndex++;
			}
			if (game.hasPlayer(current => lib.skill.guanxu.filterTarget(null, player, current))) {
				choiceList.push("发动一次〖观虚〗");
			}
			player
				.chooseControl("cancel2")
				.set("prompt", get.prompt("yashi"))
				.set("choiceList", choiceList)
				.set("ai", function () {
					var player = _status.event.player,
						source = _status.event.getTrigger().source,
						index = _status.event.getParent().addIndex;
					if (
						game.hasPlayer(function (current) {
							return current != player && current.countCards("h") > 3 && get.attitude(player, current) < 0;
						})
					) {
						return 1 - index;
					}
					if (source && source.isIn() && get.attitude(player, source) < 0 && !source.hasSkill("fengyin")) {
						return 0;
					}
					if (
						game.hasPlayer(function (current) {
							return current != player && current.countCards("h") > 0 && get.attitude(player, current) < 0;
						})
					) {
						return 1 - index;
					}
					return "cancel2";
				});
			"step 1";
			if (result.control != "cancel2") {
				if (result.index + event.addIndex == 0) {
					var target = trigger.source;
					player.logSkill("yashi", target);
					//target.removeSkill('fengyin');
					target.addTempSkill("fengyin", { player: "phaseBegin" });
					event.finish();
				} else {
					player.chooseTarget(true, "请选择〖观虚〗的目标", lib.skill.guanxu.filterTarget).set("ai", function (target) {
						var player = _status.event.player;
						return get.effect(target, "guanxu", player, player);
					});
				}
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("yashi", target);
				var next = game.createEvent("yashi_guanxu");
				next.player = player;
				next.target = target;
				next.setContent(lib.skill.guanxu.content);
			}
		},
	},
	//黄祖
	wangong: {
		audio: 2,
		trigger: { player: "useCard" },
		forced: true,
		filter(event, player) {
			return get.type(event.card, null, false) == "basic";
		},
		content() {
			player.addSkill("wangong2");
		},
	},
	wangong2: {
		trigger: { player: "useCard1" },
		forced: true,
		popup: false,
		firstDo: true,
		charlotte: true,
		sourceSkill: "wangong",
		content() {
			player.removeSkill("wangong2");
			if (trigger.card.name == "sha") {
				trigger.baseDamage++;
			}
		},
		mod: {
			cardUsable(card) {
				if (card.name == "sha") {
					return Infinity;
				}
			},
			targetInRange(card) {
				if (card.name == "sha") {
					return true;
				}
			},
		},
		mark: true,
		intro: {
			content: "使用【杀】无距离和次数限制且伤害+1",
		},
	},
};
