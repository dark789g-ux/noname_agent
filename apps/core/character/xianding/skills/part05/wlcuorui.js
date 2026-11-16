import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "wlcuorui">} */
export const groupSkills = {
	//吴兰雷铜
	wlcuorui: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			if (!["identity", "guozhan"].includes(get.mode())) {
				return game.hasPlayer(function (current) {
					return current.isFriendOf(player) && current.countDiscardableCards(player, "hej") > 0;
				});
			}
			return game.hasPlayer(current => {
				return get.distance(player, current) <= 1 && current.countDiscardableCards(player, "hej") > 0;
			});
		},
		async cost(event, trigger, player) {
			if (!["identity", "guozhan"].includes(get.mode())) {
				event.result = await player
					.chooseTarget(function (card, player, target) {
						return target.isFriendOf(player) && target.countDiscardableCards(player, "hej") > 0;
					}, get.prompt2(event.skill))
					.set("ai", function (target) {
						let min = 6;
						if (
							target.hasCard(card => {
								const val = get.value(card, target);
								if (val < 0 && card.name !== "tengjia") {
									return true;
								}
								if (val < min) {
									min = val;
								}
							}, "e")
						) {
							return 10;
						}
						if (
							target.hasCard(card => {
								const eff = get.effect(
									target,
									{
										name: card.viewAs || card.name,
										cards: [card],
									},
									target,
									target
								);
								if (eff < 0) {
									return true;
								}
								if (eff < min) {
									min = eff;
								}
							}, "j")
						) {
							return 10;
						}
						if (!get.event().discard) {
							return 0;
						}
						if (min > 6 && target.countCards("h")) {
							min = 6;
						}
						return 7 - min - 1 / (1 + target.countCards("h"));
					})
					.set(
						"discard",
						game.hasPlayer(current => {
							if (current.isFriendOf(player)) {
								return false;
							}
							let values = {};
							current.countCards("e", card => {
								const color = get.color(card);
								if (!values[color]) {
									values[color] = 0;
								}
								values[color] += Math.max(0, get.value(card));
							});
							if (Math.max(...Object.values(values)) > 8) {
								return true;
							}
							return current.hasCards("h");
						})
					)
					.forResult();
			} else {
				event.result = await player
					.chooseTarget(function (card, player, target) {
						return get.distance(player, target) <= 1 && target.countDiscardableCards(player, "hej") > 0;
					}, get.prompt2(event.skill))
					.set("ai", function (target) {
						let min = 6;
						const player = get.event().player,
							att = get.attitude(player, target);
						if (att === 0) {
							min = 0;
						}
						if (
							target.hasCards("e", card => {
								const val = get.value(card, target);
								if (att < 0) {
									if (val > 0) {
										min = Math.min(min, -val - 6);
									}
									return false;
								}
								if (val < 0 && card.name !== "tengjia") {
									return true;
								}
								if (val < min) {
									min = val;
								}
							})
						) {
							return 12;
						}
						if (
							target.hasCards("j", card => {
								const eff = get.effect(
									target,
									{
										name: card.viewAs || card.name,
										cards: [card],
									},
									target,
									target
								);
								if (att < 0) {
									if (eff < 0) {
										min = Math.min(min, eff - 6);
									}
									return false;
								}
								if (eff < 0) {
									return true;
								}
								if (eff < min) {
									min = eff;
								}
							})
						) {
							return 14;
						}
						if (
							!game.hasPlayer(current => {
								if (player === current || target === current || get.attitude(player, current) > 0) {
									return false;
								}
								let values = {};
								current.countCards("e", card => {
									const color = get.color(card);
									if (!values[color]) {
										values[color] = 0;
									}
									values[color] += Math.max(0, get.value(card));
								});
								if (Math.max(...Object.values(values)) > 8) {
									return true;
								}
								return current.hasCards("h");
							})
						) {
							return 0;
						}
						if (att <= 0) {
							return 7 - min + (1 / (1 + target.countCards("hej"))) * att;
						}
						if (min > 6 && target.countCards("h")) {
							min = 6;
						}
						return 7 - min - (1 / (1 + target.countCards("hej"))) * att;
					})
					.forResult();
			}
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			const result = await player.discardPlayerCard(target, "hej", true).forResult();
			const card = result.cards[0];
			const str = ["identity", "guozhan"].includes(get.mode()) ? "另一名其他角色" : "对手";
			const filter = ["identity", "guozhan"].includes(get.mode())
				? current => {
						if (current == player || current == target) {
							return false;
						}
						return true;
					}
				: current => {
						return current.isEnemyOf(player);
					};
			const list = [];
			if (
				game.hasPlayer(function (current) {
					return filter(current) && current.countCards("h");
				})
			) {
				list.push("展示手牌");
			}
			if (
				game.hasPlayer(function (current) {
					return filter(current) && current.countCards("e", { color: get.color(card) });
				})
			) {
				list.push("弃置装备");
			}
			if (!list.length) {
				return;
			}
			let result2;
			if (list.length == 1) {
				result2 = { control: list[0] };
			} else {
				result2 = await player
					.chooseControl(list)
					.set("prompt", "挫锐：展示" + str + "的至多两张手牌，或弃置" + str + "装备区内至多两张" + get.translation(get.color(card)) + "牌")
					.set(
						"resultx",
						(function () {
							let color = get.color(card);
							if (
								game.hasPlayer(current => {
									if (!filter(current) || get.attitude(player, current) > 0) {
										return false;
									}
									return (
										current.countCards("e", card => {
											if (get.color(card) === color) {
												return Math.max(0, get.value(card));
											}
											return 0;
										}) > 8
									);
								})
							) {
								return 1;
							}
							return 0;
						})()
					)
					.set("ai", () => _status.event.resultx)
					.forResult();
			}
			if (result2.control == "展示手牌") {
				let dialog = ["请选择要展示的牌"];
				let targets = game
					.filterPlayer(function (current) {
						return filter(current) && current.countCards("h");
					})
					.sortBySeat();
				for (let i of targets) {
					dialog.push('<div class="text center">' + get.translation(i) + "</div>");
					if (player.hasSkillTag("viewHandcard", null, i, true)) {
						dialog.push(i.getCards("h"));
					} else {
						dialog.push([i.getCards("h"), "blank"]);
					}
				}
				const result3 = await player
					.chooseButton([1, 2], true)
					.set("createDialog", dialog)
					.set("color", get.color(card))
					.set("filterButton", button => {
						if (!["identity", "guozhan"].includes(get.mode())) {
							return true;
						}
						if (!ui.selected.buttons.length) {
							return true;
						}
						return get.owner(button.link) == get.owner(ui.selected.buttons[0].link);
					})
					.set("ai", button => {
						let color = get.color(button.link) == _status.event.color;
						return color ? Math.random() : 0.35;
					})
					.forResult();
				await player.showCards(result3.links);
				let map = {};
				let map2 = {};
				for (let i of result3.links) {
					let id = get.owner(i).playerid;
					if (!map[id]) {
						map[id] = [];
					}
					map[id].push(i);
					if (get.color(i) != get.color(card)) {
						continue;
					}
					if (!map2[id]) {
						map2[id] = [];
					}
					map2[id].push(i);
				}
				for (let i in map) {
					let source = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
					if (map2[i]) {
						player.line(source);
						await player.gain(map2[i], source, "bySelf", "give");
					}
				}
			} else {
				let dialog = ["请选择要弃置的牌"];
				let targets = game
					.filterPlayer(function (current) {
						return (
							filter(current) &&
							current.countCards("e", function (cardx) {
								return get.color(card) == get.color(cardx);
							})
						);
					})
					.sortBySeat();
				for (let i of targets) {
					dialog.push('<div class="text center">' + get.translation(i) + "</div>");
					dialog.push(
						i.getCards("e", function (cardx) {
							return get.color(card) == get.color(cardx);
						})
					);
				}
				const result3 = await player
					.chooseButton([1, 2], true)
					.set("createDialog", dialog)
					.set("filterButton", button => {
						if (!["identity", "guozhan"].includes(get.mode())) {
							return true;
						}
						if (!ui.selected.buttons.length) {
							return true;
						}
						return get.owner(button.link) == get.owner(ui.selected.buttons[0].link);
					})
					.set("ai", function (button) {
						let owner = get.owner(button.link);
						return get.value(button.link, owner);
					})
					.forResult();
				let map = {};
				for (let i of result3.links) {
					if (get.color(i) != get.color(card)) {
						continue;
					}
					let id = get.owner(i).playerid;
					if (!map[id]) {
						map[id] = [];
					}
					map[id].push(i);
				}
				for (let i in map) {
					await (_status.connectMode ? lib.playerOL : game.playerMap)[i].modedDiscard(map[i], player);
				}
			}
		},
	},
};
