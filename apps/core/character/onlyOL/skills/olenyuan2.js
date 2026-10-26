import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olenyuan2" | "olzhenlie" | "olmiji" | "dclihuo" | "olchunlao">} */
export const groupSkills = {
	olenyuan2: {
		inherit: "xinenyuan2",
		sourceSkill: "olenyuan",
		prompt2: event => "令" + get.translation(event.source) + "交给你一张红色手牌或失去1点体力",
		async content(event, trigger, player) {
			const result = await trigger.source
				.chooseToGive(
					"恩怨：交给" + get.translation(player) + "一张红色手牌，或失去1点体力",
					(card, player) => {
						return get.color(card) == "red";
					},
					"h",
					player
				)
				.set("ai", card => {
					const { player, target } = get.event();
					if (get.effect(player, { name: "losehp" }, player, player) >= 0) {
						return 0;
					}
					if (get.attitude(target, player) > 0) {
						return 11 - get.value(card);
					}
					return 7 - get.value(card);
				})
				.forResult();
			if (!result?.bool) {
				await trigger.source.loseHp();
			}
		},
	},
	//王异
	olzhenlie: {
		audio: 2,
		inherit: "zhenlie",
		async content(event, trigger, player) {
			const target = trigger.player;
			if (get.attitude(player, target) < 0 && target.countDiscardableCards(player, "he")) {
				player.addTempSkill("zhenlie_lose");
			}
			await player.loseHp();
			player.removeSkill("zhenlie_lose");
			trigger.getParent().excluded.add(player);
			if (!player.isIn()) {
				return;
			}
			const goon = target.hasCard(card => {
				if (get.position(card) == "h") {
					return true;
				}
				return lib.filter.canBeGained(card, player, target);
			}, "he");
			if (goon || player.isDamaged()) {
				let result;
				if (goon && player.isDamaged()) {
					result = await player
						.chooseControl()
						.set("choiceList", ["获得" + get.translation(target) + "的一张牌", "于本回合的结束阶段发动一次〖秘计〗"])
						.set("ai", () => {
							const player = get.event().player,
								target = get.event().getTrigger().player;
							return get.effect(target, { name: "shunshou_copy2" }, player, player) > get.effect(player, { name: "draw" }, player, player) * player.getDamagedHp() ? 0 : 1;
						})
						.forResult();
				} else {
					result = { index: goon ? 0 : 1 };
				}
				if (result.index == 0) {
					await player.gainPlayerCard(target, "he", true);
				} else {
					player.addTempSkill("olzhenlie_effect");
					player.addMark("olzhenlie_effect", 1, false);
				}
			}
		},
		subSkill: {
			effect: {
				audio: "olzhenlie",
				charlotte: true,
				onremove: true,
				intro: { content: "本回合的结束阶段额外发动#次〖秘计〗" },
				trigger: { global: "phaseJieshuBegin" },
				filter(event, player) {
					if (player.isHealthy()) {
						return false;
					}
					return player.hasMark("olzhenlie_effect");
				},
				getIndex(event, player) {
					return player.countMark("olzhenlie_effect");
				},
				forced: true,
				inherit: "olmiji",
			},
		},
		derivation: "olmiji",
	},
	olmiji: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return player.isDamaged();
		},
		async content(event, trigger, player) {
			let num = player.getDamagedHp();
			await player.draw(num);
			if (player.countCards("he") && game.hasPlayer(target => target != player)) {
				if (_status.connectMode) {
					game.broadcastAll(() => (_status.noclearcountdown = true));
				}
				let given_map = [];
				while (num > 0 && player.hasCard(card => !card.hasGaintag("olsujian_given"), "he") && game.hasPlayer(current => current != player)) {
					const result = await player
						.chooseCardTarget({
							filterCard(card, player) {
								return !card.hasGaintag("olsujian_given");
							},
							selectCard: [1, num],
							position: "he",
							filterTarget: lib.filter.notMe,
							prompt: "秘计：请选择要分配的卡牌和目标",
							prompt2: "（还可分配" + num + "张）",
							ai1(card) {
								return !ui.selected.cards.length && card.name == "du" ? 1 : 0;
							},
							ai2(target) {
								const player = get.event().player;
								const card = ui.selected.cards[0];
								if (card) {
									return get.value(card, target) * get.attitude(player, target);
								}
								return 0;
							},
							allowChooseAll: true,
						})
						.forResult();
					if (result?.cards?.length && result.targets?.length) {
						const {
							cards,
							targets: [target],
						} = result;
						num -= cards.length;
						if (given_map.some(i => i[0] == target)) {
							given_map[given_map.indexOf(given_map.find(i => i[0] == target))][1].addArray(cards);
						} else {
							given_map.push([target, cards]);
						}
						player.addGaintag(cards, "olsujian_given");
					} else {
						break;
					}
				}
				if (_status.connectMode) {
					game.broadcastAll(() => {
						delete _status.noclearcountdown;
						game.stopCountChoose();
					});
				}
				if (given_map.length) {
					await game
						.loseAsync({
							gain_list: given_map,
							player: player,
							cards: given_map.slice().flatMap(list => list[1]),
							giver: player,
							animate: "giveAuto",
						})
						.setContent("gaincardMultiple");
				}
			}
		},
	},
	//程普
	dclihuo: {
		audio: "relihuo",
		trigger: { player: "useCard1" },
		filter(event, player) {
			return event.card.name == "sha" && !game.hasNature(event.card, "fire");
		},
		check(event, player) {
			let card = new lib.element.VCard(get.copy(event.card));
			game.setNature(card, "fire");
			const eff1 = event.targets.reduce((sum, target) => {
				return sum + get.effect(target, event.card, player, player);
			}, 0);
			let targets = event.targets.slice();
			if (get.info("lihuo2").filter(event, player)) {
				let targetx = game.filterPlayer(target => {
					return !targets.includes(target) && player.canUse(card, target) && get.effect(target, card, player, player) > 0;
				});
				if (targetx.length) {
					targets.add(
						targetx.sort((a, b) => {
							return get.effect(b, card, player, player) - get.effect(a, card, player, player);
						})[0]
					);
				}
			}
			const eff2 = targets.reduce((sum, target) => {
				return sum + get.effect(target, card, player, player);
			}, 0);
			return eff2 > eff1;
		},
		content() {
			game.log(player, "将", trigger.card, "改为了火属性");
			game.setNature(trigger.card, "fire");
			player
				.when("useCardAfter")
				.filter(evt => evt == trigger)
				.step(async (event, trigger, player) => {
					if (
						game.hasPlayer2(target => {
							return target.getHistory("damage", evt => evt.card && evt.card == trigger.card).length;
						})
					) {
						const result = await player
							.chooseToDiscard("he", "疠火：弃置一张牌，或失去1点体力")
							.set("ai", card => {
								const player = get.event().player,
									cards = player.getCards("h");
								if ((get.name(card) == "tao" || get.name(card) == "jiu") && lib.filter.cardSavable(card, player, player)) {
									return -1;
								}
								if (player.hp <= 1) {
									if (
										cards.length < player.getEnemies().length &&
										player.hasCard(cardx => {
											return (get.name(cardx) == "tao" || get.name(cardx) == "jiu") && lib.filter.cardSavable(cardx, player, player);
										}, "hs")
									) {
										return 7 - get.value(card);
									}
									return -1;
								}
								return 24 - 5 * cards.length - 2 * Math.min(4, player.getHp()) - get.value(card);
							})
							.forResult();
						if (!result.bool) {
							await player.loseHp();
						}
					}
				});
		},
		ai: { fireAttack: true },
		group: "dclihuo_add",
		subSkill: {
			add: {
				inherit: "lihuo2",
				async content(event, trigger, player) {
					const { bool, targets } = await player
						.chooseTarget(get.prompt("dclihuo"), "为" + get.translation(trigger.card) + "增加一个目标", (card, player, target) => {
							const trigger = get.event().getTrigger();
							return !trigger.targets.includes(target) && player.canUse(trigger.card, target);
						})
						.set("card", trigger.card)
						.set("ai", target => {
							const player = get.event().player,
								trigger = get.event().getTrigger();
							return get.effect(target, trigger.card, player, player);
						})
						.forResult();
					if (bool) {
						player.logSkill("dclihuo", targets);
						trigger.targets.addArray(targets);
					}
				},
			},
		},
	},
	olchunlao: {
		audio: "chunlao",
		audioname: ["xin_chengpu"],
		trigger: { global: ["loseAfter", "loseAsyncAfter"] },
		filter(event, player) {
			if (event.type != "discard" || event.getlx === false) {
				return false;
			}
			if (player.getExpansions("olchunlao").length >= 9) {
				return false;
			}
			return game.hasPlayer(target => {
				if (![player.getPrevious(), player, player.getNext()].includes(target)) {
					return false;
				}
				return event.getl(target)?.cards2?.some(i => i.name == "sha" && get.position(i) == "d");
			});
		},
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			const cards = game
				.filterPlayer(target => {
					if (![player.getPrevious(), player, player.getNext()].includes(target)) {
						return false;
					}
					return trigger.getl(target)?.cards2?.some(i => i.name == "sha" && get.position(i) == "d");
				})
				.map(target => {
					return trigger.getl(target).cards2.filter(i => i.name == "sha" && get.position(i) == "d");
				})
				.flat()
				.unique();
			const gain = cards.slice(0, Math.min(cards.length, 9 - player.getExpansions("olchunlao").length));
			if (gain.length) {
				const gainEvent = player.addToExpansion(gain, "gain2");
				gainEvent.gaintag.add("olchunlao");
				await gainEvent;
			}
		},
		ai: {
			effect: {
				player_use(card, player, target) {
					if (_status.currentPhase != player) {
						return;
					}
					if (card.name == "sha" && !player.getExpansions("olchunlao").length && target.hp > 1) {
						return "zeroplayertarget";
					}
				},
			},
		},
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		group: ["olchunlao_save"],
		subSkill: {
			save: {
				inherit: "chunlao2",
				filter(event, player) {
					const num =
						player.getRoundHistory("useCard", evt => {
							return evt.card?.name == "jiu" && evt.card?.storage?.olchunlao;
						}).length + 1;
					return event.type == "dying" && event.dying && event.dying.hp <= 0 && player.getExpansions("olchunlao").length >= num;
				},
				async content(event, trigger, player) {
					const target = event.targets[0];
					const num =
						player.getRoundHistory("useCard", evt => {
							return evt.card?.name == "jiu" && evt.card?.storage?.olchunlao;
						}).length + 1;
					const { bool, links } = await player.chooseCardButton(get.translation("olchunlao"), player.getExpansions("olchunlao"), num).forResult();
					if (bool) {
						player.logSkill("olchunlao", target);
						await player.loseToDiscardpile(links);
						event.type = "dying";
						await target.useCard({ name: "jiu", isCard: true, storage: { olchunlao: true } }, target);
					}
				},
				ai: {
					save: true,
					skillTagFilter(player) {
						const num =
							player.getRoundHistory("useCard", evt => {
								return evt.card?.name == "jiu" && evt.card?.storage?.olchunlao;
							}).length + 1;
						return player.getExpansions("olchunlao").length >= num;
					},
					order: 6,
					result: { target: 1 },
				},
			},
			gain: {
				audio: "chunlao",
				audioname: ["xin_chengpu"],
				trigger: { global: "loseHpEnd" },
				filter(event, player) {
					return player.getExpansions("olchunlao").length;
				},
				async cost(event, trigger, player) {
					const cards = player.getExpansions("olchunlao");
					event.result = await player
						.chooseButton(["###" + get.prompt("olchunlao") + "###获得至多两张“醇”？", cards], [1, 2])
						.set("ai", button => {
							const player = get.event().player;
							return player.hasSha() ? 0 : get.value(button.link);
						})
						.forResult();
					if (event.result.bool) {
						event.result.cards = event.result.links;
					}
				},
				async content(event, trigger, player) {
					await player.gain(event.cards, player, "give");
				},
			},
		},
	},
};
