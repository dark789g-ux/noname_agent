import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olzhenying">} */
export const groupSkills = {
	//郝普
	olzhenying: {
		audio: 2,
		enable: "phaseUse",
		usable: 2,
		filter(event, player) {
			return game.hasPlayer(current => {
				return lib.skill.olzhenying.filterTarget(null, player, current);
			});
		},
		filterTarget(card, player, target) {
			return player != target && target.countCards("h") <= player.countCards("h");
		},
		content() {
			"step 0";
			var send = function () {
				var next = game.createEvent("olzhenying_adjust", false);
				next.setContent(lib.skill.olzhenying.contentx);
				game.resume();
			};
			var sendback = function (result, player) {
				if (!result && typeof result !== "number") {
					result = player.getCards("h");
					if (!result.length) {
						result = 0;
					}
				}
				event.results.push([player, result]);
			};
			event.ai_targets = [];
			event.results = [];
			var players = [player, target];
			for (var i = 0; i < players.length; i++) {
				if (_status.connectMode) {
					players[i].showTimer();
				}
				if (players[i].isOnline()) {
					event.withol = true;
					players[i].send(send);
					players[i].wait(sendback);
				} else if (players[i] == game.me) {
					event.withme = true;
					var next = game.createEvent("olzhenying_adjust", false);
					next.setContent(lib.skill.olzhenying.contentx);
					if (_status.connectMode) {
						game.me.wait(sendback);
					}
				} else {
					event.ai_targets.push(players[i]);
				}
			}
			if (event.ai_targets.length) {
				for (var i = 0; i < event.ai_targets.length; i++) {
					if (players.includes(event.ai_targets[i])) {
						var target = event.ai_targets[i];
						var cards = target.getCards("h");
						cards = cards.sort((a, b) => {
							return get.value(b) - get.value(a);
						});
						var beginInd = 1;
						var endInd = 2;
						var eff = get.effect(player, { name: "juedou" }, target, target),
							eff2 = get.effect(target, { name: "juedou" }, player, target);
						var att = get.attitude(player, target);
						if (att > 0 || eff2 > 0) {
							if (cards.length <= 2) {
								cards = 2 - cards.length;
							} else {
								beginInd = 2;
								endInd = 2;
							}
						} else {
							if (get.value(cards, target) <= 5 && !target.isZhu) {
								if (eff > 0 && Math.random() < 0.65) {
									beginInd = 0;
									endInd = 1;
								}
							}
						}
						if (typeof cards != "number") {
							cards = cards.slice([beginInd, endInd].randomGet(), cards.length);
						}
						sendback(cards, target);
						event.ai_targets.splice(i--, 1);
					}
				}
				if (event.ai_targets.length) {
					event.ai_targets.randomSort();
					setTimeout(function () {
						event.interval = setInterval(
							function () {
								var target = event.ai_targets.shift();
								var cards = target.getCards("h");
								cards = cards.sort((a, b) => {
									return get.value(b) - get.value(a);
								});
								var beginInd = 1;
								var endInd = 2;
								var eff = get.effect(player, { name: "juedou" }, target, target),
									eff2 = get.effect(target, { name: "juedou" }, player, target);
								var att = get.attitude(player, target);
								if (att > 0 || eff2 > 0) {
									if (cards.length <= 2) {
										cards = 2 - cards.length;
									} else {
										beginInd = 2;
										endInd = 2;
									}
								} else {
									if (get.value(cards, target) <= 5 && !target.isZhu) {
										if (eff > 0 && Math.random() < 0.65) {
											beginInd = 0;
											endInd = 1;
										}
									}
								}
								if (typeof cards != "number") {
									cards = cards.slice([beginInd, endInd].randomGet(), cards.length);
								}
								sendback(cards, target);
								if (!event.ai_targets.length) {
									clearInterval(event.interval);
									if (event.withai) {
										game.resume();
									}
								}
							},
							_status.connectMode ? 750 : 75
						);
					}, 500);
				}
			}
			"step 1";
			if (event.withme) {
				if (_status.connectMode) {
					game.me.unwait(result, game.me);
				} else {
					if (!result && typeof result !== "number") {
						result = game.me.getCards("h");
						if (!result.length) {
							result = 0;
						}
					}
					event.results.push([game.me, result]);
				}
			}
			"step 2";
			if (event.withol && !event.resultOL) {
				game.pause();
			}
			"step 3";
			if (event.ai_targets.length > 0) {
				event.withai = true;
				game.pause();
			}
			"step 4";
			if (_status.connectMode) {
				for (var i of [player, target]) {
					i.hideTimer();
				}
			}
			var lose_list = [];
			var draw_list = [];
			event.results.sort((a, b) => lib.sort.seat(a[0], b[0]));
			for (var res of event.results) {
				var target = res[0],
					cardsx = res[1];
				if (!target || !cardsx) {
					continue;
				}
				if (typeof cardsx === "number") {
					draw_list.push([target, cardsx]);
				} else if (cardsx.length) {
					lose_list.push([target, cardsx]);
				}
			}
			if (lose_list.length) {
				game.loseAsync({
					lose_list: lose_list,
				}).setContent("discardMultiple");
			}
			if (draw_list.length) {
				for (var list of draw_list) {
					var target = list[0],
						num = list[1];
					target.draw(num, "nodelay");
				}
			}
			"step 5";
			game.delay();
			var num1 = player.countCards("h"),
				num2 = target.countCards("h");
			if (num1 == num2) {
				event.finish();
				return;
			}
			var players = [player, target];
			if (num2 < num1) {
				players.reverse();
			}
			var card = {
				name: "juedou",
				isCard: true,
			};
			if (players[0].canUse(card, players[1])) {
				players[0].useCard(card, players[1]);
			}
		},
		contentx() {
			"step 0";
			var player = game.me;
			event.player = player;
			var num = player.countCards("h");
			if (num >= 2) {
				var cards = player.getCards("h", card => {
					return lib.filter.cardDiscardable(card, player, "olzhenying");
				});
				if (cards.length < num - 2) {
					event._result = { cards: cards };
				} else {
					player.chooseCard("镇荧：请将手牌弃置至至多两张", [num - 2, num], true, (card, player, target) => {
						return lib.filter.cardDiscardable(card, player, "olzhenying");
					});
				}
				event.goto(2);
			} else {
				var choices = ["零", "一", "二"];
				player
					.chooseControl(choices)
					.set("prompt", "镇荧：请选择要将手牌调整至的张数")
					.set("ai", () => {
						return [0, 1, 2].randomGet();
					});
			}
			"step 1";
			var num = result.index;
			var len = player.countCards("h");
			if (len > num) {
				var cards = player.getCards("h", card => {
					return lib.filter.cardDiscardable(card, player, "olzhenying");
				});
				if (num == 0 || cards.length < len - num) {
					event._result = { cards: cards };
				} else {
					player.chooseCard("镇荧：请将手牌弃置至" + get.cnNumber(num) + "张", len - num, true, (card, player, target) => {
						return lib.filter.cardDiscardable(card, player, "olzhenying");
					});
				}
			} else {
				event._result = { cards: num - len };
			}
			"step 2";
			if (result && result.cards) {
				var cards = result.cards;
			}
			event.result = cards;
		},
		ai: {
			order(item, player) {
				if (
					game.hasPlayer(current => {
						return current.countCards("h") < player.countCards("h");
					})
				) {
					return 3;
				}
				return 7;
			},
			result: {
				player(player, target) {
					var delt = 2 - player.countCards("h");
					return Math.sqrt(Math.abs(delt)) * Math.sign(delt) + 0.1;
				},
				target(player, target) {
					if (get.attitude(player, target) > 0 && target.countCards("h") + player.countCards("h") <= 3) {
						return 1;
					}
					return get.sgn(get.effect(target, { name: "juedou" }, player, target)) * 1.2;
				},
			},
		},
	},
};
