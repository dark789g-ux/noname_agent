import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twboming" | "twejian" | "twxuhe">} */
export const groupSkills = {
	//许靖
	twboming: {
		audio: "boming",
		enable: "phaseUse",
		usable: 2,
		filter(event, player) {
			return player.countCards("he");
		},
		filterCard: true,
		position: "he",
		filterTarget: lib.filter.notMe,
		discard: false,
		lose: false,
		delay: false,
		content() {
			player.give(cards, target);
		},
		check(card) {
			return 5 - get.value(card);
		},
		ai: {
			order: 10,
			result: {
				target(player, target) {
					if (!ui.selected.cards.length) {
						return 0;
					}
					var card = ui.selected.cards[0];
					if (get.attitude(player, target) < 0 && player.hasSkill("twejian")) {
						var dam = get.damageEffect(target, player, target);
						if (dam > 0) {
							return dam;
						}
						var type = get.type2(card, target),
							ts = target.getCards("he", function (card) {
								return get.type(card) == type;
							});
						if (ts.length) {
							var val = get.value(ts, target);
							if (val > get.value(card)) {
								return -Math.max(1, val);
							}
							return 0;
						}
					}
					return get.value(card, target) / 1.5;
				},
			},
		},
		group: "twboming_draw",
		subSkill: {
			draw: {
				audio: "boming",
				trigger: { player: "phaseJieshuBegin" },
				forced: true,
				locked: false,
				filter(event, player) {
					var num = 0;
					for (var target of game.filterPlayer(i => i != player)) {
						target.getHistory("gain", evt => (num += evt.cards.length));
						if (num > 1) {
							return true;
						}
					}
					return false;
				},
				content() {
					player.draw(2);
				},
			},
		},
	},
	twejian: {
		audio: "ejian",
		trigger: {
			global: ["gainAfter", "loseAsyncAfter"],
		},
		filter(event, player) {
			if (event.name == "gain") {
				var cards = event.getg(event.player);
				if (!cards.length) {
					return false;
				}
				var cards2 = event.getl(player).cards2;
				for (var i of cards2) {
					if (
						cards.includes(i) &&
						event.player.countCards("he", card => {
							return card != i && get.type2(card) == get.type2(i);
						})
					) {
						return true;
					}
				}
				return false;
			} else {
				if (event.type != "gain") {
					return false;
				}
				var cards = event.getl(player).cards2;
				if (!cards.length) {
					return false;
				}
				return game.hasPlayer(current => {
					if (current == player) {
						return false;
					}
					var cardsx = event.getg(current);
					for (var i of cardsx) {
						if (
							cards.includes(i) &&
							current.countCards("he", card => {
								return card != i && get.type2(card) == get.type2(i);
							})
						) {
							return true;
						}
					}
					return false;
				});
			}
		},
		logTarget(event, player) {
			if (event.name == "gain") {
				return event.player;
			} else {
				var cards = event.getl(player).cards2;
				return game.filterPlayer(current => {
					if (current == player) {
						return false;
					}
					var cardsx = event.getg(current);
					for (var i of cardsx) {
						if (
							cards.includes(i) &&
							current.countCards("he", card => {
								return card != i && get.type2(card) == get.type2(i);
							})
						) {
							return true;
						}
					}
					return false;
				});
			}
		},
		direct: true,
		content() {
			"step 0";
			if (trigger.name == "gain") {
				event.targets = [trigger.player];
			} else {
				var cards = trigger.getl(player).cards2;
				event.targets = game.filterPlayer(current => {
					if (current == player) {
						return false;
					}
					var cardsx = trigger.getg(current);
					for (var i of cardsx) {
						if (
							cards.includes(i) &&
							current.countCards("he", card => {
								return card != i && get.type2(card) == get.type2(i);
							})
						) {
							return true;
						}
					}
					return false;
				});
			}
			"step 1";
			var target = event.targets.shift();
			event.target = target;
			player
				.chooseBool(
					get.prompt("twejian", target),
					"当其他角色得到你的牌后，若其有其他与此牌类型相同的牌，你可以令其选择一项：1.受到你造成的1点伤害；2.弃置这些牌"
				)
				.set("ai", () => {
					return get.attitude(player, _status.event.getParent().target) < 0;
				});
			"step 2";
			if (result.bool) {
				player.logSkill("twejian", target);
				var cards = trigger.getg(target);
				event.cards = cards;
				event.cardType = [];
				for (var card of cards) {
					event.cardType.add(get.type(card, "trick", target));
				}
				var list = ["选项一", "选项二"];
				target
					.chooseControl(list)
					.set("prompt", "恶荐：请选择一项")
					.set("choiceList", ["受到1点伤害", "弃置所有除" + get.translation(cards) + "外的" + get.translation(event.cardType) + "牌"])
					.set("ai", function () {
						var player = _status.event.player;
						var types = _status.event.cardType,
							cards = player.getCards("he", function (card) {
								return types.includes(get.type2(card));
							});
						if (cards.length == 1) {
							return "选项二";
						}
						if (cards.length >= 2) {
							for (var i = 0; i < cards.length; i++) {
								if (get.tag(cards[i], "save")) {
									return "选项一";
								}
							}
						}
						if (player.hp == 1) {
							return "选项二";
						}
						for (var i = 0; i < cards.length; i++) {
							if (get.value(cards[i]) >= 8) {
								return "选项一";
							}
						}
						if (cards.length > 2 && player.hp > 2) {
							return "选项一";
						}
						if (cards.length > 3) {
							return "选项一";
						}
						return "选项二";
					})
					.set("cardType", event.cardType);
			} else {
				event.goto(4);
			}
			"step 3";
			if (result.control == "选项一") {
				target.damage();
			} else {
				target.discard(
					target.getCards("he", card => {
						return event.cardType.includes(get.type2(card)) && !cards.includes(card);
					})
				);
			}
			"step 4";
			if (event.targets.length > 0) {
				event.goto(1);
			} else {
				event.finish();
			}
		},
		ai: {
			expose: 0.3,
		},
	},
	//张飞
	twxuhe: {
		audio: "retishen",
		trigger: { player: "shaMiss" },
		check(event, player) {
			return get.attitude(player, event.target) < 0;
		},
		logTarget: "target",
		content() {
			"step 0";
			trigger.target
				.chooseControl()
				.set("choiceList", [
					"受到" + get.translation(player) + "对你造成的1点伤害",
					"令" + get.translation(player) + "使用的下一张牌对你造成的伤害+2",
				])
				.set("ai", function () {
					var target = _status.event.player,
						player = _status.event.getParent().player;
					if (
						target.hp <= 3 &&
						target.hp > 1 &&
						player.countCards("hs", function (card) {
							return get.tag(card, "damage") && player.canUse(card, target);
						}) > 0
					) {
						return 0;
					}
					return 1;
				});
			"step 1";
			var target = trigger.target;
			switch (result.index) {
				case 0:
					player.line(target, "fire");
					target.damage();
					break;
				case 1:
					target.line(player, "fire");
					player.storage.twxuhe_damage = target;
					trigger.getParent().twxuhe = true;
					player.addTempSkill("twxuhe_damage");
					break;
			}
		},
		subSkill: {
			damage: {
				charlotte: true,
				onremove: true,
				mark: true,
				intro: { content: "本回合使用的下一张牌对$造成伤害时，此伤害+2" },
				trigger: {
					source: "damageBegin1",
					player: "useCardAfter",
				},
				direct: true,
				filter(event, player) {
					if (event.name == "useCard") {
						return !event.twxuhe;
					}
					if (!event.card) {
						return false;
					}
					var evt = event.getParent(2);
					var history = player.getHistory("useCard");
					return evt.name == "useCard" && history[history.indexOf(evt) - 1].twxuhe;
				},
				content() {
					if (trigger.name != "useCard") {
						trigger.num += 2;
					}
					player.removeSkill("twxuhe_damage");
				},
			},
		},
	},
};
