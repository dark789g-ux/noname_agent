import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zhiren" | "yaner">} */
export const groupSkills = {
	//潘淑
	zhiren: {
		audio: 2,
		trigger: { player: "useCard" },
		filter(event, player) {
			if (!(player == _status.currentPhase || player.hasSkill("yaner_zhiren"))) {
				return false;
			}
			return (
				player
					.getHistory("useCard", evt => {
						return !evt.cards?.length || evt.card.isCard;
					})
					.indexOf(event) == 0
			);
		},
		frequent: true,
		locked: false,
		content() {
			"step 0";
			event.num = get.translation(trigger.card.name).length;
			player.chooseToGuanxing(event.num);
			if (event.num < 2) {
				event.finish();
			}
			"step 1";
			if (
				!game.hasPlayer(function (current) {
					return current.countDiscardableCards(player, "e") > 0;
				})
			) {
				event.goto(3);
			} else {
				player
					.chooseTarget("织纴：是否弃置一名角色装备区内的一张牌？", function (card, player, target) {
						return target.countDiscardableCards(player, "e") > 0;
					})
					.set("ai", function (target) {
						var player = _status.event.player,
							att = get.attitude(player, target),
							es = target.getCards("e"),
							val = 0;
						for (var i of es) {
							var eff = -(get.value(i, target) - 0.1) * att;
							if (eff > val) {
								val = eff;
							}
						}
						return eff;
					});
			}
			"step 2";
			if (result.bool) {
				var target = result.targets[0];
				player.addExpose(0.15);
				player.line(target, "green");
				player.discardPlayerCard(target, "e", true);
			} else {
				event.goto(5);
			}
			if (event.num < 3) {
				event.finish();
			} else if (get.mode() == "guozhan") {
				event.goto(5);
			}
			"step 3";
			if (
				!game.hasPlayer(function (current) {
					return current.countDiscardableCards(player, "j") > 0;
				})
			) {
				if (event.num < 3) {
					event.finish();
				} else {
					event.goto(5);
				}
			} else {
				player
					.chooseTarget("织纴：是否弃置一名角色判定区内的一张牌？", function (card, player, target) {
						return target.countDiscardableCards(player, "j") > 0;
					})
					.set("ai", function (target) {
						var player = _status.event.player,
							att = get.attitude(player, target),
							es = target.getCards("j"),
							val = 0;
						for (var i of es) {
							var eff = -get.effect(target, i, target, player);
							if (eff > val) {
								val = eff;
							}
						}
						return eff;
					});
			}
			"step 4";
			if (result.bool) {
				var target = result.targets[0];
				player.addExpose(0.15);
				player.line(target, "green");
				player.discardPlayerCard(target, "j", true);
			}
			if (event.num < 3) {
				event.finish();
			}
			"step 5";
			player.recover();
			if (event.num < 4) {
				event.finish();
			}
			"step 6";
			player.draw(get.mode() == "guozhan" ? 2 : 3);
		},
		mod: {
			aiOrder(player, card, num) {
				if (
					player == _status.currentPhase &&
					!player.getHistory("useCard", function (evt) {
						return evt.card.isCard;
					}).length
				) {
					return num + Math.pow(get.translation(card.name).length, 2);
				}
			},
		},
	},
	yaner: {
		audio: 2,
		trigger: {
			global: ["equipAfter", "addJudgeAfter", "loseAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		filter(event, player) {
			var current = _status.currentPhase;
			if (!current || current == player || !current.isIn() || !current.isPhaseUsing()) {
				return false;
			}
			var evt = event.getl(current);
			return evt && evt.hs && evt.hs.length && current.countCards("h") == 0;
		},
		usable: 1,
		logTarget() {
			return _status.currentPhase;
		},
		prompt2: "与该角色各摸两张牌",
		check(event, player) {
			return get.attitude(player, _status.currentPhase) > 0;
		},
		content() {
			"step 0";
			game.asyncDraw([_status.currentPhase, player], 2);
			"step 1";
			var e1 = player.getHistory("gain", function (evt) {
				return evt.getParent(2) == event;
			})[0];
			if (e1 && e1.cards && e1.cards.length == 2 && get.type(e1.cards[0]) == get.type(e1.cards[1])) {
				player.addTempSkill("yaner_zhiren", { player: "phaseBegin" });
				game.log(player, "修改了技能", "#g【织纴】");
			}
			var target = _status.currentPhase;
			if (target.isIn() && target.isDamaged()) {
				var e2 = target.getHistory("gain", function (evt) {
					return evt.getParent(2) == event;
				})[0];
				if (e2 && e2.cards && e2.cards.length == 2 && get.type(e2.cards[0]) == get.type(e2.cards[1])) {
					target.recover();
				}
			}
			"step 2";
			game.delayx();
		},
		subSkill: {
			zhiren: { charlotte: true },
		},
		ai: {
			expose: 0.5,
		},
	},
};
