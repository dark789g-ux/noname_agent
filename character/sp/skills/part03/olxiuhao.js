import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olxiuhao" | "olsujian" | "fuwei" | "yuejian">} */
export const groupSkills = {
	//邓芝
	olxiuhao: {
		audio: 2,
		trigger: { global: "damageBegin4" },
		usable: 1,
		filter(event, player) {
			return event.source && event.source.isIn() && [event.source, event.player].includes(player) && event.source != event.player;
		},
		logTarget(event, player) {
			return player == event.player ? event.source : event.player;
		},
		check(event, player) {
			_status.olxiuhao_judging = true;
			var bool = false;
			if (get.attitude(player, event.player) > 0) {
				bool = true;
			} else if (2 * get.effect(event.source, { name: "draw" }, player, _status.event.player) + event.num * get.damageEffect(player, event.source, _status.event.player, event.nature) > 0) {
				bool = true;
			} else if (event.source.hasSkillTag("nogain")) {
				bool = true;
			}
			delete _status.olxiuhao_judging;
			return bool;
		},
		content() {
			trigger.cancel();
			trigger.source.draw(2);
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (!_status.olxiuhao_judging && get.tag(card, "damage") && get.attitude(target, player) > 0 && player != target && !target.storage.counttrigger?.olxiuhao) {
						return [0, 0.5, 0, 0.5];
					}
				},
				player(card, player, target) {
					if (!_status.olxiuhao_judging && get.tag(card, "damage") && get.attitude(player, target) > 0 && player != target && !player.storage.counttrigger?.olxiuhao) {
						return [0, 0.5, 0, 0.5];
					}
				},
			},
		},
	},
	olsujian: {
		audio: 2,
		trigger: { player: "phaseDiscardBefore" },
		forced: true,
		content() {
			trigger.setContent(lib.skill.olsujian.phaseDiscard);
		},
		phaseDiscard() {
			"step 0";
			game.log(player, "进入了弃牌阶段");
			game.broadcastAll(function (player) {
				if (lib.config.show_phase_prompt) {
					player.popup("弃牌阶段", null, false);
				}
			}, player);
			event.trigger("phaseDiscard");
			"step 1";
			var cards = lib.skill.olsujian.update(player);
			if (!cards.length) {
				event.finish();
			} else {
				event.cards = cards;
				var str = get.translation(cards);
				player
					.chooseControl()
					.set("choiceList", ["将" + str + "分配给任意名其他角色", "弃置" + str + "并弃置一名其他角色至多等量的牌"])
					.set("ai", function () {
						var cards = _status.event.getParent().cards,
							player = _status.event.player;
						if (
							!game.hasPlayer(function (current) {
								return player !== current && get.attitude(player, current) > 0;
							})
						) {
							return 1;
						}
						if (
							game.hasPlayer(function (current) {
								var att = get.attitude(player, current);
								return (
									att &&
									current.countDiscardableCards(player, "he", function (i) {
										if (att > 0) {
											return get.value(i, current) < 0;
										}
										return get.value(i, current) >= 4;
									}) >= cards.length &&
									get.effect(current, { name: "guohe_copy2" }, player, player) > 0
								);
							})
						) {
							return 1;
						}
						return 0;
					});
			}
			"step 2";
			if (result.index == 1) {
				cards = event.cards.filter(function (i) {
					return lib.filter.cardDiscardable(i, player, "olsujian");
				});
				if (cards.length) {
					event.num = cards.length;
					player.discard(cards);
					event.cards = cards;
				} else {
					event.finish();
				}
			} else {
				event.goto(5);
			}
			"step 3";
			if (
				game.hasPlayer(function (current) {
					return current != player && current.countDiscardableCards(player, "he") > 0;
				})
			) {
				player
					.chooseTarget(true, "弃置一名其他角色的至多" + get.cnNumber(num) + "张牌", function (card, player, current) {
						return current != player && current.countDiscardableCards(player, "he") > 0;
					})
					.set("ai", function (current) {
						var att = get.attitude(player, current);
						if (
							current.countDiscardableCards(player, "he", function (i) {
								if (att > 0) {
									return get.value(i, current) >= 4;
								}
								return get.value(i, current) <= 0;
							}) >= num
						) {
							return 4 * get.effect(current, { name: "guohe_copy2" }, player, player);
						}
						return get.effect(current, { name: "guohe_copy2" }, player, player);
					});
			} else {
				event.finish();
			}
			"step 4";
			if (result.bool) {
				var target = result.targets[0];
				player.line(target, "green");
				player.discardPlayerCard(target, true, [1, num]);
			}
			event.finish();
			"step 5";
			if (_status.connectMode) {
				game.broadcastAll(function () {
					_status.noclearcountdown = true;
				});
			}
			event.given_map = {};
			"step 6";
			player.chooseCardTarget({
				filterCard(card) {
					return card.hasGaintag("olsujian");
				},
				filterTarget: lib.filter.notMe,
				selectCard: [1, cards.length],
				forced: true,
				prompt: "请选择要分配的卡牌和目标",
				ai1(card) {
					if (!ui.selected.cards.length) {
						return 1;
					}
					return 0;
				},
				ai2(target) {
					var player = _status.event.player,
						card = ui.selected.cards[0];
					var val = target.getUseValue(card);
					if (val > 0) {
						return val * get.attitude(player, target) * 2;
					}
					return get.value(card, target) * get.attitude(player, target);
				},
			});
			"step 7";
			if (result.bool) {
				var res = result.cards,
					target = result.targets[0].playerid;
				player.removeGaintag("olsujian", res);
				player.addGaintag(res, "olsujian_given");
				cards.removeArray(res);
				if (!event.given_map[target]) {
					event.given_map[target] = [];
				}
				event.given_map[target].addArray(res);
				if (cards.length) {
					event.goto(6);
				}
			} else {
				event.finish();
			}
			"step 8";
			if (_status.connectMode) {
				game.broadcastAll(function () {
					delete _status.noclearcountdown;
					game.stopCountChoose();
				});
			}
			var map = [],
				cards = [];
			for (var i in event.given_map) {
				var source = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
				player.line(source, "green");
				map.push([source, event.given_map[i]]);
				cards.addArray(event.given_map[i]);
			}
			if (map.length) {
				game.loseAsync({
					gain_list: map,
					player: player,
					cards: cards,
					giver: player,
					animate: "giveAuto",
				}).setContent("gaincardMultiple");
			}
			"step 9";
			event.cards = [];
		},
		update(player) {
			player.removeGaintag("olsujian");
			var hs = player.getCards("h");
			player.getHistory("gain", function (evt) {
				hs.removeArray(evt.cards);
			});
			if (hs.length) {
				player.addGaintag(hs, "olsujian");
			}
			return hs;
		},
		group: "olsujian_sync",
		subSkill: {
			sync: {
				trigger: { player: ["phaseBeginStart", "gainBegin"] },
				forced: true,
				popup: false,
				firstDo: true,
				filter(event, player) {
					if (event.name == "gain") {
						return player == _status.currentPhase && event.getParent("olsujian").player != player;
					}
					return true;
				},
				content() {
					lib.skill.olsujian.update(player);
				},
			},
		},
	},
	//卞夫人
	fuwei: {
		audio: "wanwei",
		trigger: {
			player: "loseAfter",
			global: ["gainAfter", "loseAsyncAfter"],
		},
		filter(event, player) {
			const evt = event.getl(player);
			if (!(evt?.cards2 ?? []).length) {
				return false;
			}
			if (event.name === "gain" || event.type === "gain") {
				if (
					evt.cards2.some(card => {
						return game.hasPlayer(target => {
							if (target === player) {
								return false;
							}
							return event.getg?.(target)?.includes(card);
						});
					})
				) {
					return true;
				}
			}
			if (event.type === "discard" && event.getlx !== false) {
				const discarder = event.discarder || event.getParent(2).player;
				if (discarder && discarder !== player) {
					return true;
				}
			}
			return false;
		},
		prompt2(event, player) {
			const evt = event.getl(player);
			let origins = evt.cards2;
			if (event.name === "gain" || event.type === "gain") {
				origins = origins.filter(card => {
					return game.hasPlayer(target => {
						if (target === player) {
							return false;
						}
						return event.getg?.(target)?.includes(card);
					});
				});
			}
			return "从牌堆中获得" + get.translation(origins.map(i => i.name)) + "；若没有则改为摸一张牌";
		},
		usable: 1,
		async content(event, trigger, player) {
			const evt = trigger.getl(player);
			let origins = evt.cards2;
			if (trigger.name === "gain" || trigger.type === "gain") {
				origins = origins.filter(card => {
					return game.hasPlayer(target => {
						if (target === player) {
							return false;
						}
						return trigger.getg?.(target)?.includes(card);
					});
				});
			}
			let cards = [],
				num = 0;
			for (const card of origins) {
				const card2 = get.cardPile2(card2 => card2.name === card.name);
				if (card2) {
					cards.push(card2);
				} else {
					num++;
				}
			}
			if (cards.length) {
				await player.gain(cards, "gain2");
			}
			if (num) {
				await player.draw(num);
			}
		},
	},
	yuejian: {
		audio: 2,
		usable: 2,
		trigger: { global: "useCardAfter" },
		filter(event, player) {
			return player != event.player && event.targets && event.targets.includes(player) && player.countCards("h") > 0;
		},
		prompt2(event, player) {
			var suit = get.suit(event.card),
				hs = player.getCards("h"),
				cards = event.cards.filterInD();
			if (!lib.suit.includes(suit) || !cards.length) {
				return "展示所有手牌，然后无事发生";
			}
			for (var i of hs) {
				if (get.suit(i) == suit) {
					return "展示所有手牌，然后无事发生";
				}
			}
			return '展示所有手牌，然后<span class="yellowtext">获得' + get.translation(cards) + "</span>";
		},
		check(event, player) {
			var suit = get.suit(event.card),
				hs = player.getCards("h"),
				cards = event.cards.filterInD();
			if (!lib.suit.includes(suit) || !cards.length) {
				return false;
			}
			for (var i of hs) {
				if (get.suit(i) == suit) {
					return false;
				}
			}
			return true;
		},
		content() {
			"step 0";
			player.showHandcards(get.translation(player) + "发动了【约俭】");
			var suit = get.suit(trigger.card),
				hs = player.getCards("h");
			if (!lib.suit.includes(suit)) {
				event.finish();
				return;
			}
			for (var i of hs) {
				if (get.suit(i) == suit) {
					event.finish();
					return;
				}
			}
			"step 1";
			var cards = trigger.cards.filterInD();
			if (cards.length) {
				player.gain(cards, "gain2");
			}
		},
	},
};
