import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olniluan" | "olxiaoxi" | "olsaogu">} */
export const groupSkills = {
	//韩遂
	olniluan: {
		audio: "niluan",
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			return event.player.getHp() > player.getHp() && event.player.getHistory("useCard", card => card.card.name == "sha").length && player.countCards("hes", card => get.color(card, player) == "black" && player.canUse(get.autoViewAs({ name: "sha" }, [card]), event.player, false));
		},
		direct: true,
		clearTime: true,
		content() {
			var next = player.chooseToUse();
			next.set("openskilldialog", "逆乱：是否将一张黑色牌当作【杀】对" + get.translation(trigger.player) + "使用？");
			next.set("norestore", true);
			next.set("_backupevent", `${event.name}_backup`);
			next.set("custom", {
				add: {},
				replace: { window() {} },
			});
			next.backup(`${event.name}_backup`);
			next.set("targetRequired", true);
			next.set("complexTarget", true);
			next.set("complexSelect", true);
			next.set("filterTarget", function (card, player, target) {
				if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
					return false;
				}
				return lib.filter.targetEnabled.apply(this, arguments);
			});
			next.set("sourcex", trigger.player);
			next.set("addCount", false);
			next.logSkill = "olniluan";
		},
		subSkill: {
			backup: {
				viewAs: { name: "sha" },
				filterCard: { color: "black" },
				position: "hes",
				selectCard: 1,
				check(card) {
					return 5 - get.value(card);
				},
				log: false,
			},
		},
	},
	olxiaoxi: {
		audio: "xiaoxi",
		audioname: ["machao", "hansui", "pangde"],
		trigger: { global: "phaseBegin" },
		filter(event, player) {
			if (!player.hasUseTarget({ name: "sha" }, false)) {
				return false;
			}
			return !game.hasPlayer(current => {
				var history = current.actionHistory;
				for (var num = history.length - 1; num >= 0; num--) {
					if (history[num].isRound) {
						break;
					}
					if (history[num].isSkipped) {
						continue;
					}
					return true;
				}
				return false;
			});
		},
		direct: true,
		content() {
			player.chooseUseTarget({ name: "sha" }, get.prompt("olxiaoxi"), "视为使用一张无距离限制的【杀】", false, "nodistance").logSkill = "olxiaoxi";
		},
	},
	//段颎
	olsaogu: {
		audio: 2,
		zhuanhuanji: true,
		mark: true,
		marktext: "☯",
		intro: {
			content(storage) {
				if (storage) {
					return "转换技。①出牌阶段，你可以摸一张牌。②结束阶段，你可以弃置一张牌，令一名其他角色摸一张牌。";
				}
				return "转换技。①出牌阶段，你可以弃置两张牌（不能包含你本阶段弃置过的花色），然后使用其中的【杀】。②结束阶段，你可以弃置一张牌，令一名其他角色弃置两张牌，然后其使用弃置的【杀】。";
			},
		},
		onChooseToUse(event) {
			if (!game.online && !event.olsaogu) {
				var list = [],
					player = event.player;
				var evtx = event.getParent("phaseUse");
				player.getHistory("lose", evt => {
					if (evt.type == "discard" && evt.getParent("phaseUse") == evtx) {
						list.addArray(evt.cards2);
					}
				});
				event.set("olsaogu", list);
			}
		},
		enable: "phaseUse",
		filter(event, player) {
			var storage = player.storage.olsaogu;
			if (storage) {
				return true;
			}
			return (
				player.getDiscardableCards(player, "he").filter(card => {
					if (event.olsaogu && event.olsaogu.some(cardx => get.suit(cardx, false) == get.suit(card, player))) {
						return false;
					}
					return true;
				}).length > 1
			);
		},
		filterCard(card, player) {
			if (player.storage.olsaogu) {
				return false;
			}
			if (_status.event.olsaogu && _status.event.olsaogu.some(cardx => get.suit(cardx, false) == get.suit(card, player))) {
				return false;
			}
			return true;
		},
		selectCard() {
			var player = _status.event.player;
			return player.storage.olsaogu ? -1 : 2;
		},
		position: "he",
		check(card) {
			const player = get.player(),
				event = get.event();
			if (card.name == "sha") {
				if (event.getStepCache("useShaValue") === undefined) {
					event.putStepCache("useShaValue", player.getUseValue("sha", true, false));
				}
				return event.getStepCache("useShaValue") > 0 ? 10 : -1;
			}
			return 6 - get.value(card);
		},
		prompt() {
			var player = _status.event.player;
			var storage = player.storage.olsaogu;
			if (storage) {
				return "摸一张牌";
			}
			var list = _status.event.olsaogu,
				str = "";
			if (list && list.length) {
				var text = "",
					suits = list
						.reduce(function (list, card) {
							return (list.add(get.suit(card, false)), list);
						}, [])
						.sort((a, b) => lib.suit.indexOf(b) - lib.suit.indexOf(a));
				for (var i = 0; i < suits.length; i++) {
					text += get.translation(suits[i]);
				}
				str += "（不能弃置" + text + "花色的牌）";
			}
			return "弃置两张牌" + str + "，然后使用其中的【杀】";
		},
		content() {
			player.changeZhuanhuanji("olsaogu");
			if (!cards.length) {
				player.draw();
			} else {
				var cardx = cards.filter(card => card.name == "sha");
				if (cardx.length) {
					var next = game.createEvent("olsaogu_chooseToUseSha");
					next.player = player;
					next.cards = cardx;
					next.setContent(lib.skill.olsaogu.chooseToUseSha);
				}
			}
		},
		ai: {
			order(item, player) {
				return get.order({ name: "sha" }, player) - 0.2;
			},
			result: {
				player(player) {
					var storage = player.storage.olsaogu;
					if (storage) {
						return 1;
					}
					if (
						player.getDiscardableCards(player, "he").filter(card => {
							if (card.name != "sha") {
								return false;
							}
							if (_status.event.olsaogu && _status.event.olsaogu.some(cardx => get.suit(cardx, false) == get.suit(card, player))) {
								return false;
							}
							return true;
						}).length
					) {
						return 1;
					}
					return 0;
				},
			},
		},
		group: "olsaogu_effect",
		subSkill: {
			effect: {
				trigger: { player: "phaseJieshuBegin" },
				filter(event, player) {
					if (_status.connectMode) {
						return player.countCards("he");
					}
					return player.countDiscardableCards(player, "he");
				},
				direct: true,
				content() {
					"step 0";
					var list = [];
					player.getHistory("lose", evt => {
						if (evt.type == "discard" && evt.getParent("phaseJieshu").name == "phaseJieshu") {
							list.addArray(evt.cards2);
						}
					});
					event.list = list;
					var str,
						storage = player.storage.olsaogu;
					if (storage) {
						str = "弃置一张牌，令一名其他角色摸一张牌。";
					} else {
						str = "弃置一张牌，令一名其他角色弃置两张牌（不能包含你本阶段弃置过的花色），然后其使用弃置的【杀】。";
						if (list.length) {
							var text = "",
								suits = list
									.reduce(function (list, card) {
										return (list.add(get.suit(card, false)), list);
									}, [])
									.sort((a, b) => lib.suit.indexOf(b) - lib.suit.indexOf(a));
							for (var i = 0; i < suits.length; i++) {
								text += get.translation(suits[i]);
							}
							str += "<br>本阶段已弃置过" + text + "花色的牌。";
						}
					}
					player
						.chooseCardTarget({
							prompt: get.prompt("olsaogu"),
							prompt2: str,
							filterTarget(card, player, target) {
								return player != target && target.countCards("he") > 1;
							},
							filterCard: lib.filter.cardDiscardable,
							position: "he",
							complexCard: true,
							complexSelect: true,
							ai1(card) {
								var player = _status.event.player;
								if (!player.storage.olsaogu && _status.event.list.some(cardx => get.suit(cardx, false) == get.suit(card, player))) {
									return 7 - get.value(card);
								}
								return 5 - get.value(card);
							},
							ai2(target) {
								var player = _status.event.player;
								var att = get.attitude(player, target);
								if (player.storage.olsaogu) {
									return att;
								}
								var list = _status.event.list.slice();
								if (ui.selected.cards.length) {
									list.addArray(ui.selected.cards);
								}
								var cards = target.getCards("he", card => {
									if (card.name != "sha" || list.some(cardx => get.suit(cardx, false) == get.suit(card, target))) {
										return false;
									}
									return (
										lib.filter.cardDiscardable(card, target) &&
										game.hasPlayer(function (current) {
											if (!current.canUse(card, target, false)) {
												return false;
											}
											return get.effect(current, card, target, target) > 0 && get.effect(current, card, target, player) > 0;
										})
									);
								});
								if (cards.length && att > 0) {
									return (
										Math.sqrt(Math.min(2, cards.length)) *
										cards.reduce(function (num, card) {
											var players = game.filterPlayer(current => target.canUse(card, current, false));
											players.sort((a, b) => get.effect(b, card, target, target) * get.effect(b, card, target, player) - get.effect(a, card, target, target) * get.effect(a, card, target, player));
											return (num = get.effect(players[0], card, target, target) * get.effect(players[0], card, target, player));
										}, 0)
									);
								}
								return (
									get.effect(target, { name: "guohe_copy2" }, player, player) *
									Math.sqrt(
										Math.min(
											2,
											target.getDiscardableCards(player, "he").filter(card => {
												return !list.some(cardx => get.suit(cardx, false) == get.suit(card, target));
											}).length
										)
									)
								);
							},
						})
						.set("list", list);
					"step 1";
					if (result.bool) {
						var cards = result.cards,
							target = result.targets[0];
						player.logSkill("olsaogu", target);
						player.discard(cards);
						if (player.storage.olsaogu) {
							target.draw();
							event.finish();
						} else {
							event.target = target;
							var list = result.cards.slice();
							player.getHistory("lose", evt => {
								if (evt.type == "discard" && evt.getParent("phaseJieshu").name == "phaseJieshu") {
									list.addArray(evt.cards2);
								}
							});
							var cards = target.getCards("he", card => {
								return lib.filter.cardDiscardable(card, target) && !list.some(cardx => get.suit(cardx, false) == get.suit(card, target));
							});
							if (cards.length) {
								var text = "",
									suits = list
										.reduce(function (list, card) {
											return (list.add(get.suit(card, false)), list);
										}, [])
										.sort((a, b) => lib.suit.indexOf(b) - lib.suit.indexOf(a));
								for (var i = 0; i < suits.length; i++) {
									text += get.translation(suits[i]);
								}
								target
									.chooseToDiscard(
										"he",
										"扫谷：弃置两张牌（不能弃置" + text + "花色的牌），然后使用其中的【杀】",
										function (card, player) {
											var list = _status.event.list;
											return !list.some(cardx => get.suit(cardx, false) == get.suit(card, player));
										},
										Math.min(cards.length, 2),
										true
									)
									.set("ai", function (card) {
										var player = _status.event.player;
										if (card.name == "sha" && player.hasValueTarget(card)) {
											return 10;
										}
										return -get.value(card);
									})
									.set("list", list)
									.set("complexCard", true);
							} else {
								event.finish();
							}
						}
					} else {
						event.finish();
					}
					"step 2";
					if (result.bool) {
						var cards = result.cards.filter(card => card.name == "sha");
						if (cards.length) {
							var next = game.createEvent("olsaogu_chooseToUseSha");
							next.player = target;
							next.cards = cards;
							next.setContent(lib.skill.olsaogu.chooseToUseSha);
						}
					}
				},
			},
		},
		chooseToUseSha() {
			"step 0";
			event.cards2 = cards.filter(i => get.position(i, true) == "d" && player.hasUseTarget(i));
			if (!event.cards2.length) {
				event.finish();
			}
			"step 1";
			if (event.cards2.length == 1) {
				event._result = { bool: true, links: event.cards2 };
			} else {
				player
					.chooseButton(["扫谷：请使用其中的【杀】", event.cards2], true)
					.set("filterButton", button => {
						return _status.event.player.hasUseTarget(button.link, false);
					})
					.set("ai", button => {
						return _status.event.player.getUseValue(button.link);
					});
			}
			"step 2";
			if (result.bool) {
				var card = result.links[0];
				event.cards2.remove(card);
				player.$gain2(card, false);
				game.delayx();
				player.chooseUseTarget(true, card, false);
			} else {
				event.finish();
			}
			"step 3";
			if (event.cards2.length) {
				event.goto(1);
			}
		},
	},
};
