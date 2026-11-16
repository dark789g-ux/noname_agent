import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olbiguo" | "oldouyu" | "olhexu" | "olzeguang" | "olchengen">} */
export const groupSkills = {
	//逄纪
	olbiguo: {
		audio: 2,
		trigger: { player: "phaseDrawEnd" },
		filter(event, player) {
			return player.hasDiscardableCards(player, "he");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard({
					prompt: get.prompt2(event.skill),
					position: "he",
					ai(card) {
						return 6 - get.value(card);
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { cards: discard } = event;
			await player.modedDiscard({ cards: discard });
			const cards = ["basic", "trick", "equip"].map(type => get.cardPile2(card => get.type2(card) == type));
			if (cards.length) {
				await player.showCards(cards, get.translation(player) + "发动了【愎果】");
				await player.gain({ cards, animate: "gain2" });
			}
			player.addTempSkill(`${event.name}_effect`);
		},
		subSkill: {
			effect: {
				charlotte: true,
				trigger: {
					target: "useCardToTargeted",
				},
				filter(event, player) {
					return game.hasPlayer(target => player.canCompare(target));
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget({
							prompt: get.prompt(event.skill),
							prompt2: "可以与一名其他角色拼点，没赢的角色本回合不能使用或打出与双方拼点牌类型相同的牌",
							filterTarget(card, player, target) {
								return player.canCompare(target);
							},
							ai(target) {
								return -get.attitude(_status.event.player, target) / target.countCards("h");
							},
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const {
						targets: [target],
					} = event;
					const result = await player.chooseToCompare(target).set("small", player.hasSkill("oldouyu")).forResult();
					const types = [get.type2(result.player), get.type2(result.target)].unique();
					[player, target].forEach(target => {
						if (target != result.winner) {
							target.addTempSkill("olbiguo_debuff");
							target.markAuto("olbiguo_debuff", types);
						}
					});
				},
			},
			debuff: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "不能使用或打出$牌",
				},
				mod: {
					cardEnabled(card, player) {
						if (player.getStorage("olbiguo_debuff").includes(get.type2(card))) {
							return false;
						}
					},
					cardSavable(card, player) {
						if (player.getStorage("olbiguo_debuff").includes(get.type2(card))) {
							return false;
						}
					},
					cardRespondable(card, player) {
						if (player.getStorage("olbiguo_debuff").includes(get.type2(card))) {
							return false;
						}
					},
				},
			},
		},
	},
	oldouyu: {
		audio: 2,
		trigger: {
			global: "compareCardShowBefore",
		},
		filter(event, player) {
			if (event.player == player) {
				return true;
			}
			if (event.targets?.length) {
				return event.targets.includes(player);
			} else {
				return event.target == player;
			}
		},
		async cost(event, trigger, player) {
			if (trigger.targets?.length) {
				const targets = [trigger.player, ...trigger.targets].remove(player);
				event.result = await player
					.chooseTarget({
						prompt: get.prompt2(event.skill),
						filterTarget(card, player, target) {
							return get.event().targets.includes(target);
						},
						ai(target) {
							return Math.random() - 0.5;
						},
					})
					.set("targets", targets)
					.forResult();
			} else {
				const target = trigger.player == player ? trigger.target : trigger.player;
				event.result = await player
					.chooseBool({
						prompt: get.prompt2(event.skill, target),
						choice: true,
					})
					.forResult();
				event.result.targets = [target];
			}
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const targets = [player, target];
			game.log(targets, "交换了拼点牌");
			if (trigger.targets?.length) {
				const { cardlist, lose_list } = trigger;
				const [card1] = lose_list.find(i => i[0] === targets[0])[1];
				const [card2] = lose_list.find(i => i[0] === targets[1])[1];
				const index1 = cardlist.indexOf(card1);
				const index2 = cardlist.indexOf(card2);
				if (index1 >= 0 && index2 >= 0) {
					[cardlist[index1], cardlist[index2]] = [cardlist[index2], cardlist[index1]];
				} else {
					trigger.card1 = index1 < 0 ? card2 : card1;
					cardlist[index1 < 0 ? index2 : index1] = index1 < 0 ? card1 : card2;
				}
			} else {
				const list = [trigger.card1, trigger.card2];
				trigger.card1 = list[1];
				trigger.card2 = list[0];
			}
			player
				.when({ global: ["chooseToCompareAfter", "compareMultipleAfter"] })
				.filter(evt => {
					if (evt.name == "chooseToCompare") {
						return evt == trigger;
					}
					return evt.getParent() == trigger;
				})
				.then(async (event, trigger, player) => {
					const winner = trigger.winner || trigger.result.winner;
					if (winner == player) {
						await player.draw(2);
					}
				});
		},
	},
	//董予安
	olhexu: {
		audio: 2,
		mod: {
			maxHandcard(player, num) {
				return (
					num +
					player
						.getCards("h", card => !get.is.damageCard(card))
						.map(card => get.type2(card))
						.unique().length
				);
			},
		},
	},
	olzeguang: {
		audio: 2,
		usable: 1,
		trigger: {
			target: "useCardToTargeted",
		},
		filter(event, player) {
			return get.is.damageCard(event.card) && player.hasCards("he", card => player.canRecast(card));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard({
					prompt: get.prompt2(event.skill),
					position: "he",
					selectCard: Math.min(
						player.countCards("he", card => player.canRecast(card)),
						3
					),
					filterCard: (card, player) => player.canRecast(card),
					ai(card) {
						return 6 - get.value(card);
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { cards } = event;
			await player.recast(cards);
			player.addTempSkill(event.name + "_give");
			player.markAuto(event.name + "_give", [[trigger, cards]]);
		},
		subSkill: {
			give: {
				charlotte: true,
				onremove: true,
				trigger: {
					global: "damageSource",
				},
				filter(event, player) {
					return player.getStorage("olzeguang_give").some(arr => arr[0].card == event.card && arr[1].someInD("d"));
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const cards = player.getStorage(event.name).find(arr => arr[0].card == trigger.card)?.[1];
					const toGive = cards.filterInD("d");
					const result = await player
						.chooseTarget({
							createDialog: ["泽光：你可以令一名角色获得这些牌", toGive, [dialog => dialog.buttons.forEach(i => i.style.setProperty("opacity", 1)), "handle"]],
							ai(target) {
								const { cards, player } = get.event();
								return get.attitude(player, target) * get.value(cards, target);
							},
						})
						.set("cards", toGive)
						.forResult();
					if (result.bool && result.targets?.length) {
						const {
							targets: [target],
						} = result;
						player.line(target);
						await target.gain({ cards: toGive, animate: "gain2" });
					}
				},
			},
		},
	},
	olchengen: {
		audio: 2,
		trigger: {
			global: ["phaseEnd"],
		},
		filter(event, player) {
			const current = _status.currentPhase;
			return current?.countCards("h") <= player.countCards("h") && game.hasPlayer(target => player.canCompare(target));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2(event.skill),
					filterTarget(card, player, target) {
						return player.canCompare(target);
					},
					ai(target) {
						return -get.attitude(_status.event.player, target) / target.countCards("h");
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const result = await player.chooseToCompare(target).forResult();
			if (result.bool) {
				const cards = [result.player, result.target];
				while (cards.length) {
					if (!cards.some(card => get.position(card) == "d" && (player.hasUseTarget(card, void 0, false) || (get.info(card).notarget && lib.filter.cardEnabled(card, player))))) {
						break;
					}
					const result = await player
						.chooseCardButton({
							cards: cards.filterInD("d"),
							prompt: "承恩：请选择要使用的拼点牌",
							filterButton(button) {
								const card = button.link;
								const player = get.player();
								return player.hasUseTarget(card, void 0, false) || (get.info(card).notarget && lib.filter.cardEnabled(card, player));
							},
							ai(button) {
								return get.player().getUseValue(button.link);
							},
						})
						.forResult();
					const { links } = result;
					if (links?.length) {
						cards.remove(links[0]);
						await player.chooseUseTarget({ card: links[0], addCount: false });
					} else {
						break;
					}
				}
			} else {
				await target
					.chooseToUse({
						prompt: `承恩：是否对${get.translation(player)}使用一张【杀】`,
						filterCard(card, player, event) {
							if (get.itemtype(card) !== "card" || get.name(card) != "sha") {
								return false;
							}
							return lib.filter.filterCard.call(this, card, player, event);
						},
						filterTarget(card, player, target) {
							const { sourcex } = get.event();
							if (target != sourcex && !ui.selected.targets.includes(sourcex)) {
								return false;
							}
							return lib.filter.filterTarget.apply(this, arguments);
						},
						complexTarget: true,
					})
					.set("targetRequired", true)
					.set("complexSelect", true)
					.set("sourcex", player)
					.forResult();
			}
		},
	},
};
