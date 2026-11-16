import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "reqiaoshui" | "qiaoshui" | "qiaoshui2" | "qiaoshui3" | "qiaoshui4" | "jyzongshi_old" | "shenxing">} */
export const groupSkills = {
	reqiaoshui: {
		audio: 2,
		enable: "phaseUse",
		filterTarget(card, player, target) {
			return player.canCompare(target);
		},
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		async content(event, trigger, player) {
			const target = event.target;
			const result = await player.chooseToCompare(target).forResult();
			if (result.bool) {
				player.addTempSkill("reqiaoshui_target", "phaseUseEnd");
			} else {
				player.addTempSkill("qiaoshui4");
				event.getParent(3).skipped = true;
			}
		},
		subSkill: {
			target: {
				audio: "reqiaoshui",
				inherit: "qiaoshui3",
				sourceSkill: "reqiaoshui",
			},
		},
		ai: {
			order(item, player) {
				if (
					player.countCards("h", function (card) {
						return player.hasValueTarget(card);
					})
				) {
					return 10;
				}
				return 1;
			},
			result: {
				target(player, target) {
					if (
						player.countCards("h", function (card) {
							return player.hasValueTarget(card);
						})
					) {
						if (player.hasSkill("reqiaoshui_target")) {
							return 0;
						}
						var nd = !player.needsToDiscard();
						if (
							player.hasCard(function (card) {
								if (get.position(card) != "h") {
									return false;
								}
								var val = get.value(card);
								if (nd && val < 0) {
									return true;
								}
								if (val <= 5) {
									return get.number(card) >= 12;
								}
								if (val <= 6) {
									return get.number(card) >= 13;
								}
								return false;
							})
						) {
							return -1;
						}
						return 0;
					}
					return -1;
				},
			},
		},
	},
	qiaoshui: {
		audio: 2,
		audioname2: {
			re_jianyong: "reqiaoshui",
			xin_jianyong: "xinqiaoshui",
		},
		trigger: {
			player: "phaseUseBegin",
		},
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2("qiaoshui"),
					filterTarget(card, player, target) {
						return player.canCompare(target);
					},
					ai(target) {
						const player = get.player();
						return -get.attitude(player, target) / target.countCards("h");
					},
				})
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const target = event.targets[0];
			const result = await player.chooseToCompare(target).forResult();
			player.addTempSkill(result.bool ? "qiaoshui3" : "qiaoshui2");
		},
		ai: {
			expose: 0.1,
		},
	},
	qiaoshui2: {
		charlotte: true,
		mod: {
			cardEnabled(card) {
				if (get.type(card, "trick") == "trick") {
					return false;
				}
			},
		},
	},
	qiaoshui3: {
		audio: "qiaoshui",
		trigger: {
			player: "useCard2",
		},
		silent: true,
		charlotte: true,
		sourceSkill: "qiaoshui",
		filter(event, player) {
			const type = get.type(event.card);
			return type == "basic" || type == "trick";
		},
		async content(event, trigger, player) {
			player.removeSkill(event.name);

			// 00，01，10，11分别表示是否可以增加目标和是否可以减少目标
			// 0b00: Neither，0b01: Add，0b10: Remove，0b11: Both
			let flags = 0;

			// 是否能增加目标
			const info = get.info(trigger.card);
			if (trigger.targets && !info.multitarget) {
				const players = game.filterPlayer();
				for (const target of players) {
					if (lib.filter.targetEnabled2(trigger.card, player, target) && !trigger.targets.includes(target)) {
						flags |= 0b01;
						break;
					}
				}
			}

			// 是否能减少目标
			if (!info.multitarget && trigger.targets && trigger.targets.length > 1) {
				flags |= 0b10;
			}

			if (flags === 0) {
				return;
			}

			// 增加目标的流程
			const addTarget = async forced => {
				const result = await player
					.chooseTarget({
						prompt: forced ? `巧说：为${get.translation(trigger.card)}额外指定一名目标` : `巧说：是否为${get.translation(trigger.card)}额外指定一名目标？`,
						filterTarget(card, player, target) {
							const currentEvent = get.event();
							if (currentEvent.targets.includes(target)) {
								return false;
							}
							return lib.filter.targetEnabled2(currentEvent.card, currentEvent.player, target);
						},
						forced,
						ai(target) {
							const trigger = _status.event.getTrigger();
							const player = _status.event.player;
							return get.effect(target, trigger.card, player, player);
						},
					})
					.set("targets", trigger.targets)
					.set("card", trigger.card)
					.forResult();

				if (!result.bool || !result.targets?.length) {
					return;
				}

				if (!event.isMine()) {
					await game.delayx();
				}
				const target = result.targets[0];
				player.logSkill("qiaoshui3", target);
				trigger.targets.add(target);
			};

			// 减少目标的流程
			const removeTarget = async forced => {
				const result = await player
					.chooseTarget({
						prompt: forced ? `巧说：减少一名${get.translation(trigger.card)}的目标` : `巧说：是否减少一名${get.translation(trigger.card)}的目标？`,
						filterTarget(card, player, target) {
							return get.event().targets.includes(target);
						},
						forced,
						ai(target) {
							const trigger = get.event().getTrigger();
							return -get.effect(target, trigger.card, trigger.player, get.player());
						},
					})
					.set("targets", trigger.targets)
					.forResult();

				if (!result.bool || !result.targets?.length) {
					return;
				}

				const target = result.targets[0];
				if (event.isMine()) {
					player.logSkill("qiaoshui3", target);
				}
				trigger.targets.remove(target);
				await game.delay();
				if (!event.isMine()) {
					player.logSkill("qiaoshui3", target);
				}
			};

			const items = [addTarget, removeTarget];

			switch (flags) {
				case 0b01:
				case 0b10:
					await items[flags - 1](false);
					break;
				case 0b11: {
					const result = await player
						.chooseControlList({
							prompt: get.prompt("qiaoshui3"),
							list: [`为${get.translation(trigger.card)}增加一个目标`, `为${get.translation(trigger.card)}减少一个目标`],
							ai() {
								return get.event().add ? 0 : 1;
							},
						})
						.set("add", get.effect(player, trigger.card, trigger.player, player) >= 0)
						.forResult();

					if (result.control === "cancel2") {
						return;
					}

					await items[result.index](true);
				}
			}
		},
	},
	qiaoshui4: {
		mod: {
			ignoredHandcard(card, player) {
				if (get.type(card, "trick", player) == "trick") {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name == "phaseDiscard" && get.type(card, "trick", player) == "trick") {
					return false;
				}
			},
		},
	},
	jyzongshi_old: {
		audio: 2,
		trigger: { target: "useCardToBegin" },
		filter(event, player) {
			if (event.targets && event.targets.length > 1) {
				return false;
			}
			return event.card && get.type(event.card) == "trick" && event.player != player;
		},
		frequent: true,
		async content(event, trigger, player) {
			player.draw();
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (get.type(card) == "trick" && player !== target) {
						return [1, 1];
					}
				},
			},
		},
	},
	shenxing: {
		audio: 2,
		enable: "phaseUse",
		position: "he",
		filterCard: lib.filter.cardDiscardable,
		selectCard: 2,
		prompt: "弃置两张牌并摸一张牌",
		check(card) {
			var player = _status.event.player;
			if (!player.hasSkill("olbingyi") || player.hasSkill("olbingyi_blocker", null, null, false)) {
				return 4 - get.value(card);
			}
			var red = 0,
				black = 0,
				hs = player.getCards("h");
			for (var i of hs) {
				if (ui.selected.cards.includes(i)) {
					continue;
				}
				var color = get.color(i, player);
				if (color == "red") {
					red++;
				}
				if (color == "black") {
					black++;
				}
			}
			if (red > 2 && black > 2) {
				return 4 - get.value(card);
			}
			if (red == 0 || black == 0) {
				return 8 - get.value(card);
			}
			var color = get.color(card);
			if (black <= red) {
				return (color == "black" && get.position(card) == "h" ? 8 : 4) - get.value(card);
			}
			return (color == "red" && get.position(card) == "h" ? 8 : 4) - get.value(card);
		},
		async content(event, trigger, player) {
			await player.draw();
		},
		ai: {
			order: 9,
			result: {
				player(player, target) {
					if (!ui.selected.cards.length) {
						return 1;
					}
					if (!player.hasSkill("olbingyi") || player.hasSkill("olbingyi_blocker", null, null, false)) {
						return 1;
					}
					var red = 0,
						black = 0,
						hs = player.getCards("h");
					for (var i of hs) {
						if (ui.selected.cards.includes(i)) {
							continue;
						}
						var color = get.color(i);
						if (color == "red") {
							red++;
						}
						if (color == "black") {
							black++;
						}
					}
					var val = 0;
					for (var i of ui.selected.cards) {
						val += get.value(i, player);
					}
					if (red == 0 || black == 0) {
						if (red + black == 0) {
							return 0;
						}
						var num =
							Math.min(
								red + black,
								game.countPlayer(function (current) {
									return current != player && get.attitude(player, current) > 0 && !current.hasSkillTag("nogain");
								})
							) + 1;
						if (num * 7 > val) {
							return 1;
						}
					}
					if (val < 8) {
						return 1;
					}
					return 0;
				},
			},
		},
	},
};
