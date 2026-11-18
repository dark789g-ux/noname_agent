import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twjimeng" | "twgongsun" | "twgongsun_shadow" | "twgongsun_shadow2">} */
export const groupSkills = {
	//邓芝
	twjimeng: {
		audio: "jimeng",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current.countGainableCards(player, "he") > 0;
			});
		},
		filterTarget(card, player, target) {
			return target != player && target.countGainableCards(player, "hej") > 0;
		},
		content() {
			"step 0";
			player.gainPlayerCard(target, "hej", true);
			"step 1";
			var hs = player.getCards("he");
			if (hs.length) {
				if (hs.length == 1) {
					event._result = { bool: true, cards: hs };
				} else {
					player.chooseCard(true, "交给" + get.translation(target) + "一张牌", "he", true);
				}
			} else {
				event.finish();
			}
			"step 2";
			player.give(result.cards, target);
			"step 3";
			if (target.hp >= player.hp) {
				player.draw();
			}
		},
		ai: {
			order: 8,
			result: {
				player(player, target) {
					if (target.hp >= player.hp) {
						return 1;
					}
					return 0;
				},
				target(player, target) {
					return get.effect(target, { name: "shunshou" }, player, target) / 10;
				},
			},
		},
	},
	//杨仪
	twgongsun: {
		audio: "gongsun",
		trigger: { player: "phaseUseBegin" },
		locked: true,
		filter(event, player) {
			return game.hasPlayer(current => player.inRange(current));
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseButtonTarget({
					createDialog: [
						"共损：选择一名攻击范围内的其他角色，封印一种花色",
						[
							lib.suit.map(suit => {
								return ["", "", `lukai_${suit}`];
							}),
							"vcard",
						],
					],
					filterTarget(card, player, target) {
						return player != target && player.inRange(target);
					},
					forced: true,
					ai1(button) {
						return Math.random();
					},
					ai2(target) {
						const player = get.player();
						return -get.attitude(player, target) * (1 + target.countCards("h"));
					},
				})
				.forResult();
			if (!result?.bool || !result.links?.length || !result.targets?.length) {
				return;
			}
			event.result = {
				bool: true,
				targets: result.targets,
				cost_data: result.links[0][2],
			};
		},
		async content(event, trigger, player) {
			const target = event.targets[0],
				suit = event.cost_data.slice(6),
				skill = `${event.name}_shadow`;
			player.popup(suit + 2, "soil");
			game.log(player, "选择了", suit + 2);
			player.addTempSkill(skill, { player: ["phaseBegin", "die"] });
			player.markAuto(skill, [[target, suit]]);
		},
		subSkill: {
			shadow: {
				marktext: "损",
				onremove: true,
				intro: {
					content(shadow) {
						if (!shadow?.length) {
							return "无效果";
						}
						return shadow.map(list => `${get.translation(list[0])}：${get.translation(list[1])}`).join("<br>");
					},
				},
				global: "twgongsun_shadow2",
			},
			shadow2: {
				mod: {
					cardEnabled(card, player) {
						const suits = [];
						game.countPlayer(current => {
							const list = current.getStorage("twgongsun_shadow");
							if (!list?.length) {
								return false;
							}
							list.forEach(info => {
								if (info[0] == player || current == player) {
									suits.add(info[1]);
								}
							});
						});
						const hs = player.getCards("h", card => suits.includes(get.suit(card, player))),
							cards = [card];
						if (card.cards && Array.isArray(card.cards)) {
							cards.addArray(card.cards);
						}
						if (cards.containsSome(...hs)) {
							return false;
						}
					},
					cardRespondable(card, player) {
						return lib.skill.twgongsun_shadow2.mod.cardEnabled.apply(this, arguments);
					},
					cardSavable(card, player) {
						return lib.skill.twgongsun_shadow2.mod.cardEnabled.apply(this, arguments);
					},
					cardDiscardable(card, player) {
						const suits = [];
						game.countPlayer(current => {
							const list = current.getStorage("twgongsun_shadow");
							if (!list?.length) {
								return false;
							}
							list.forEach(info => {
								if (info[0] == player || current == player) {
									suits.add(info[1]);
								}
							});
						});
						if (suits.includes(get.suit(card, player))) {
							return false;
						}
					},
				},
			},
		},
	},
	twgongsun_shadow: {
		global: "twgongsun_shadow2",
		sourceSkill: "twgongsun",
		init(player, skill) {
			if (!player.storage[skill]) {
				player.storage[skill] = [];
			}
		},
		marktext: "损",
		onremove: true,
		intro: {
			content(shadow) {
				var str = "";
				for (var i = 0; i < shadow.length; i++) {
					if (i > 0) {
						str += "<br>";
					}
					str += get.translation(shadow[i][0]);
					str += "：";
					str += get.translation(shadow[i][1]);
				}
				return str;
			},
		},
		mod: {
			cardEnabled(card, player) {
				var list = player.storage.twgongsun_shadow;
				for (var i = 0; i < list.length; i++) {
					if (list[i][1] == card.suit) {
						return false;
					}
				}
			},
			cardRespondable(card, player) {
				var list = player.storage.twgongsun_shadow;
				for (var i = 0; i < list.length; i++) {
					if (list[i][1] == card.suit) {
						return false;
					}
				}
			},
			cardSavable(card, player) {
				var list = player.storage.twgongsun_shadow;
				for (var i = 0; i < list.length; i++) {
					if (list[i][1] == card.suit) {
						return false;
					}
				}
			},
			cardDiscardable(card, player) {
				var list = player.storage.twgongsun_shadow;
				for (var i = 0; i < list.length; i++) {
					if (list[i][1] == card.suit) {
						return false;
					}
				}
			},
		},
	},
	twgongsun_shadow2: {
		mod: {
			cardEnabled(card, player) {
				if (
					game.hasPlayer(function (current) {
						var list = current.storage.twgongsun_shadow;
						if (!list) {
							return false;
						}
						for (var i = 0; i < list.length; i++) {
							if (list[i][0] == player && list[i][1] == card.suit) {
								return true;
							}
						}
						return false;
					})
				) {
					return false;
				}
			},
			cardSavable(card, player) {
				if (
					game.hasPlayer(function (current) {
						var list = current.storage.twgongsun_shadow;
						if (!list) {
							return false;
						}
						for (var i = 0; i < list.length; i++) {
							if (list[i][0] == player && list[i][1] == card.suit) {
								return true;
							}
						}
						return false;
					})
				) {
					return false;
				}
			},
			cardRespondable(card, player) {
				if (
					game.hasPlayer(function (current) {
						var list = current.storage.twgongsun_shadow;
						if (!list) {
							return false;
						}
						for (var i = 0; i < list.length; i++) {
							if (list[i][0] == player && list[i][1] == card.suit) {
								return true;
							}
						}
						return false;
					})
				) {
					return false;
				}
			},
			cardDiscardable(card, player) {
				if (
					game.hasPlayer(function (current) {
						var list = current.storage.twgongsun_shadow;
						if (!list) {
							return false;
						}
						for (var i = 0; i < list.length; i++) {
							if (list[i][0] == player && list[i][1] == card.suit) {
								return true;
							}
						}
						return false;
					})
				) {
					return false;
				}
			},
		},
	},
};
