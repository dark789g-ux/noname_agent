import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcquanjian" | "dctujue" | "dcyingyu" | "dcyongbi">} */
export const groupSkills = {
	//黄权
	dcquanjian: {
		audio: 2,
		enable: "phaseUse",
		usable: 2,
		filter(event, player) {
			return game.hasPlayer(current => current != player);
		},
		chooseButton: {
			dialog(event, player) {
				var dialog = ui.create.dialog("劝谏：令一名其他角色…", "hidden");
				dialog.add([
					[
						["damage", "对其攻击范围内的一名角色造成1点伤害"],
						["draw", "将其手牌数调整至手牌上限（至多摸至五张），且其本回合内不能使用手牌"],
					],
					"textbutton",
				]);
				return dialog;
			},
			filter(button, player) {
				return !player.getStorage("dcquanjian_used").includes(button.link);
			},
			check: () => 1 + Math.random(),
			backup(links) {
				return get.copy(lib.skill["dcquanjian_" + links[0]]);
			},
			prompt(links) {
				if (links[0] == "damage") {
					return "令一名其他角色对攻击范围内的另一名角色造成1点伤害";
				}
				return "令一名其他角色将手牌数调整至手牌上限（至多摸至五张）且本回合内不能使用手牌";
			},
		},
		ai: {
			order: 2,
			result: { player: 1 },
		},
		subSkill: {
			backup: { audio: "dcquanjian" },
			used: {
				charlotte: true,
				onremove: true,
			},
			damage: {
				audio: "dcquanjian",
				selectTarget: 2,
				filterTarget(card, player, target) {
					if (!ui.selected.targets.length) {
						return target != player;
					}
					return ui.selected.targets[0].inRange(target);
				},
				complexTarget: true,
				complexSelect: true,
				filterCard: () => false,
				selectCard: -1,
				targetprompt: ["造成伤害", "受到伤害"],
				multitarget: true,
				async content(event, trigger, player) {
					const { target, targets } = event;
					player.addTempSkill("dcquanjian_used", "phaseUseAfter");
					player.markAuto("dcquanjian_used", "damage");
					const result = await targets[0]
						.chooseControl()
						.set("choiceList", ["对" + get.translation(targets[1]) + "造成1点伤害", "本回合下次受到的伤害+1"])
						.set("ai", () => (_status.event.eff >= 0 ? 0 : 1))
						.set("eff", get.damageEffect(targets[1], targets[0], targets[0]))
						.forResult();
					if (result.index == 0) {
						await targets[1].damage(targets[0]);
					} else {
						target.addMark("dcquanjian_effect", 1, false);
						target.addTempSkill("dcquanjian_effect");
					}
				},
				ai: {
					result: {
						player(player, target) {
							if (ui.selected.targets.length == 0) {
								if (!game.hasPlayer(current => current.inRangeOf(target) && get.damageEffect(current, target, player) > 0)) {
									return 0;
								}
								if (get.attitude(player, target) > 0) {
									return 2;
								}
								return 1;
							}
							return get.damageEffect(target, ui.selected.targets[0], player, player);
						},
					},
				},
			},
			draw: {
				audio: "dcquanjian",
				filterTarget: lib.filter.notMe,
				filterCard: () => false,
				selectCard: -1,
				async content(event, trigger, player) {
					const { target } = event;
					let result;
					player.addTempSkill("dcquanjian_used", "phaseUseAfter");
					player.markAuto("dcquanjian_used", "draw");
					const num1 = target.countCards("h");
					const num2 = target.getHandcardLimit();
					let num = 0;
					if (num1 > num2) {
						event.index = 0;
						num = num1 - num2;
						result = await target
							.chooseControl()
							.set("choiceList", ["弃置" + get.cnNumber(num) + "张手牌，且本回合内不能使用或打出手牌", "本回合下次受到的伤害+1"])
							.set("ai", () => {
								const event = get.event();
								const player = get.player();
								if (event.number === 1 && player.hasCard(card => lib.filter.cardDiscardable(card, player, "dcquanjian_draw") && get.value(card) < 5, "h")) {
									return 0;
								}
								return 1;
							})
							.set("number", num)
							.forResult();
					} else {
						event.index = 1;
						num = Math.min(num2, 5) - num1;
						result = await target
							.chooseControl()
							.set("choiceList", [(num > 0 ? "摸" + get.cnNumber(num) + "张牌且" : "") + "本回合内不能使用或打出手牌", "本回合下次受到的伤害+1"])
							.set("ai", () => get.event().idx)
							.set("idx", num > 0 ? 0 : get.damageEffect(target, player, target) > 20 ? 0 : 1)
							.forResult();
					}
					event.num = num;
					if (result.index == 0) {
						if (event.index == 0) {
							await target.chooseToDiscard("h", true, num, "allowChooseAll");
						} else {
							await target.draw(num);
						}
						target.addTempSkill("dcquanjian_disable");
					} else {
						target.addMark("dcquanjian_effect", 1, false);
						target.addTempSkill("dcquanjian_effect");
					}
				},
				ai: {
					result: {
						target(player, target) {
							var num1 = target.countCards("h"),
								num2 = target.getHandcardLimit();
							if (num1 > num2) {
								return -1;
							}
							return Math.min(5, num2) - num1;
						},
					},
				},
			},
			effect: {
				charlotte: true,
				trigger: { player: "damageBegin3" },
				forced: true,
				onremove: true,
				marktext: "谏",
				async content(event, trigger, player) {
					trigger.num += player.countMark(event.name);
					player.removeSkill(event.name);
				},
				intro: { content: "下次受到的伤害+#" },
				ai: { threaten: 2.5 },
			},
			disable: {
				charlotte: true,
				mod: {
					cardEnabled2(card, player) {
						if (get.position(card) == "h") {
							return false;
						}
					},
				},
				mark: true,
				marktext: "禁",
				intro: { content: "不能使用或打出手牌" },
				ai: { threaten: 2.5 },
			},
		},
	},
	dctujue: {
		audio: 2,
		trigger: { player: "dying" },
		limited: true,
		skillAnimation: true,
		animationColor: "gray",
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(lib.filter.notMe, get.prompt2(event.skill))
				.set("ai", target => {
					const { skip, player } = get.event();
					if (skip) {
						return 0;
					}
					return 200 + get.attitude(player, target);
				})
				.set("skip", player.countCards("hs", { name: ["tao", "jiu"] }) + player.hp > 0)
				.forResult();
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const {
				targets: [target],
			} = event;
			const cards = player.getCards("he");
			if (!cards.length) {
				return;
			}
			const num = Math.max(5, cards.length);
			await player.give(cards, target);
			await player.recover(num);
			await player.draw(num);
		},
	},
	//尹夫人
	dcyingyu: {
		audio: 2,
		trigger: { player: ["phaseZhunbeiBegin", "phaseJieshuBegin"] },
		direct: true,
		filter(event, player) {
			if (event.name == "phaseJieshu" && !player.storage.dcyingyu) {
				return false;
			}
			return (
				game.countPlayer(function (current) {
					return current.countCards("h") > 0;
				}) > 1
			);
		},
		async content(event, trigger, player) {
			const result = await player
				.chooseTarget(2, get.prompt("dcyingyu"), "展示两名角色的各一张手牌。若这两张牌花色不同，则你可以令其中一名角色获得另一名角色的展示牌。", function (card, player, target) {
					return target.countCards("h") > 0;
				})
				.set("ai", function (target) {
					let currentPlayer = _status.event.player;
					if (!ui.selected.targets.length) {
						return get.attitude(currentPlayer, target);
					}
					return 1 - get.attitude(currentPlayer, target);
				})
				.forResult();
			if (!result.bool) {
				return;
			}

			const targets = result.targets.sortBySeat();
			const cards = [];
			player.logSkill("dcyingyu", targets);

			let cardResult = await player.choosePlayerCard(targets[0], true, "h").forResult();
			let card = cardResult.cards[0];
			player.line(targets[0]);
			await player.showCards(card, get.translation(player) + "对" + get.translation(targets[0]) + "发动了【媵予】");
			cards.push(card);

			cardResult = await player.choosePlayerCard(targets[1], true, "h").forResult();
			card = cardResult.cards[0];
			player.line(targets[1]);
			await player.showCards(card, get.translation(player) + "对" + get.translation(targets[1]) + "发动了【媵予】");
			cards.push(card);
			if (get.suit(cards[0], targets[0]) == get.suit(cards[1], targets[1])) {
				return;
			}

			const str1 = get.translation(targets[0]),
				str2 = get.translation(targets[1]);
			const controlResult = await player
				.chooseControl("cancel2")
				.set("choiceList", ["令" + str1 + "获得" + str2 + "的" + get.translation(cards[1]), "令" + str2 + "获得" + str1 + "的" + get.translation(cards[0])])
				.set("goon", get.attitude(player, targets[0]) > 0 ? 0 : 1)
				.set("ai", () => _status.event.goon)
				.forResult();
			if (controlResult.control != "cancel2") {
				const i = controlResult.index;
				await targets[1 - i].give(cards[1 - i], targets[i], "give");
			}
		},
		onremove: true,
	},
	dcyongbi: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("h") > 0 && game.hasPlayer(current => lib.skill.dcyongbi.filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			return target != player && target.hasSex("male");
		},
		selectCard: -1,
		filterCard: true,
		position: "h",
		limited: true,
		skillAnimation: true,
		animationColor: "fire",
		discard: false,
		lose: false,
		async content(event, trigger, player) {
			const cards = event.cards;
			const target = event.target;
			player.awakenSkill(event.name);
			if (player.hasSkill("dcyingyu", null, null, false)) {
				player.storage.dcyingyu = true;
			}
			await player.give(cards, target);
			const list = [];
			for (const card of cards) {
				list.add(get.suit(card, player));
				if (list.length >= 3) {
					break;
				}
			}
			if (list.length >= 2) {
				player.addMark("dcyongbi_eff1", 2, false);
				player.addSkill("dcyongbi_eff1");
				target.addMark("dcyongbi_eff1", 2, false);
				target.addSkill("dcyongbi_eff1");
			}
			if (list.length >= 3) {
				player.addMark("dcyongbi_eff2", 1, false);
				player.addSkill("dcyongbi_eff2");
				target.addMark("dcyongbi_eff2", 1, false);
				target.addSkill("dcyongbi_eff2");
			}
		},
		ai: {
			order(item, player) {
				if (player.hasUnknown()) {
					return 0;
				}
				let list = [];
				for (let i of player.getCards("h")) {
					list.add(get.suit(i, player));
					if (list.length >= 3) {
						return 10;
					}
				}
				return 0;
			},
			result: {
				player: 1.8,
				target(player, target) {
					let zhu = get.zhu(player);
					if (zhu && get.attitude(player, zhu) > 0) {
						if (target == zhu) {
							return 4;
						}
					}
					return 1.8;
				},
			},
		},
		subSkill: {
			eff1: {
				mod: {
					maxHandcard: (player, num) => num + player.countMark("dcyongbi_eff1"),
				},
				charlotte: true,
				onremove: true,
				marktext: "拥",
				intro: { content: "手牌上限+#" },
			},
			eff2: {
				audio: "dcyongbi",
				trigger: { player: "damageBegin4" },
				forced: true,
				filter(event, player) {
					return event.num > 1;
				},
				async content(event, trigger, player) {
					trigger.num -= player.countMark("dcyongbi_eff2");
				},
				charlotte: true,
				onremove: true,
				marktext: "嬖",
				intro: { content: "受到大于1的伤害时，此伤害-#" },
			},
		},
	},
};
