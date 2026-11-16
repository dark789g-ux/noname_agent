import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clantanfeng" | "clanjuewei" | "clanjiannan" | "clanyichi">} */
export const groupSkills = {
	//族陆景
	clantanfeng: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		viewAs: {
			name: "sha",
			isCard: true,
			storage: {
				tanfeng: true,
			},
		},
		mod: {
			cardUsable(card, player) {
				if (card?.storage?.tanfeng) {
					return Infinity;
				}
			},
		},
		async precontent(event, trigger, player) {
			if (event.getParent().addCount !== false) {
				event.getParent().addCount = false;
			}
			const target = event.result.targets[0];
			player
				.when({ player: "useCardAfter" })
				.filter(evt => evt.getParent() == event.getParent())
				.assign({
					ai: {
						unequip: true,
						unequip_ai: true,
						skillTagFilter(player, tag, arg) {
							const card = tag == "unequip_ai" ? arg : arg?.card;
							if (!card?.storage?.tanfeng) {
								return false;
							}
						},
					},
				})
				.step(async (event, trigger, player) => {
					if (player.getHistory("sourceDamage", evt => evt.card == trigger.card).length) {
						const num = Math.abs(player.countCards("e") - target.countCards("e"));
						if (num > 0) {
							await player.draw(num);
						}
					} else {
						const sha = get.autoViewAs({ name: "sha", isCard: true });
						if (!target.canUse(sha, player, false)) {
							return;
						}
						const { bool } = await target
							.chooseBool("探锋", `是否视为对${get.translation(player)}使用一张【杀】？`)
							.set("choice", get.effect(player, sha, target, target) > 0)
							.forResult();
						if (bool) {
							await target.useCard(sha, player, false);
						}
					}
				});
		},
		selectCard: -1,
		filterCard: () => false,
		selectTarget: 1,
		ai: {
			order() {
				return get.order({ name: "sha" }) + 0.1;
			},
		},
	},
	clanjuewei: {
		audio: 2,
		trigger: {
			player: "useCardToPlayered",
			target: "useCardToTargeted",
		},
		filter(event, player, name) {
			if (!event.card || !get.is.damageCard(event.card)) {
				return false;
			}
			if (name == "useCardToPlayered" && !event.isFirstTarget) {
				return false;
			}
			return player.countCards("he", card => {
				if (get.type(card, player) != "equip") {
					return false;
				}
				return lib.filter.cardDiscardable(card, player, "clanjuewei") || lib.filter.cardRecastable(card, player);
			});
		},
		usable: 1,
		async cost(event, trigger, player) {
			const prompt1 = `重铸一张装备牌，于${get.translation(trigger.card)}结算完成后视为对一名不为你的角色使用此牌`,
				prompt2 = `弃置一张装备牌，令${get.translation(trigger.card)}无效`;
			const result = await player
				.chooseButton([
					get.prompt(event.skill),
					[
						[
							["Recast", prompt1],
							["Discard", prompt2],
						],
						"textbutton",
					],
				])
				.set("filterButton", button => {
					const player = get.player(),
						source = button.link == "Recast" ? null : "clanjuewei";
					return player.countCards("he", card => {
						if (get.type(card, player) != "equip") {
							return false;
						}
						return lib.filter[`card${button.link}able`](card, player, source);
					});
				})
				.set("ai", button => {
					const player = get.player(),
						trigger = get.event().getTrigger();
					if (button.link == "Recast") {
						if (!trigger.targets || trigger.targets.every(target => target == player)) {
							return 0;
						}
						const target = trigger.targets.maxBy(
							target => {
								return get.effect(target, trigger.card, player, player);
							},
							target => target != player
						);
						return get.effect(target, trigger.card, player, player);
					}
					return (
						trigger.targets.reduce((sum, target) => {
							sum -= get.effect(target, trigger.card, trigger.player, player);
						}, 0) - 2
					);
				})
				.forResult();
			if (!result.bool) {
				return;
			}
			const link = result.links[0],
				type = `card${link}able`;
			event.result = await player
				.chooseCard(
					"绝围",
					link == "Recast" ? prompt1 : prompt2,
					card => {
						const { player, actType: type } = get.event(),
							source = type == "Recast" ? null : "clanjuewei";
						return get.type(card, player) == "equip" && lib.filter[type](card, player, source);
					},
					"he"
				)
				.set("actType", type)
				.set("ai", card => {
					return 8 - get.value(card);
				})
				.forResult();
			event.result.cost_data = link;
		},
		async content(event, trigger, player) {
			if (event.cost_data == "Recast") {
				await player.recast(event.cards);
				player
					.when({ global: "useCardAfter" })
					.filter(evt => evt == trigger.getParent())
					.step(async (event, trigger, player) => {
						const targets = trigger.targets.filter(target => target != player && target.isIn());
						if (targets?.length) {
							await player.chooseUseTarget(trigger.card, false, true, targets, 1);
						}
					});
			} else {
				await player.discard(event.cards);
				trigger.getParent().all_excluded = true;
			}
		},
	},
	//族杨彪
	clanjiannan: {
		audio: 2,
		trigger: {
			player: "phaseUseBegin",
		},
		frequent: true,
		async content(event, trigger, player) {
			const next = player.draw(2);
			next.gaintag = [event.name];
			await next;
			player.addTempSkill("clanjiannan_effect", "phaseChange");
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				sub: true,
			},
			effect: {
				audio: "clanjiannan",
				trigger: {
					global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				onremove(player) {
					game.filterPlayer().forEach(target => target.removeGaintag("clanjiannan"));
				},
				charlotte: true,
				filter(event, player, triggername, target) {
					if (_status?.dying?.length || player.getStorage("clanjiannan_used").length > 3) {
						return false;
					}
					return true;
				},
				getIndex(event, player, triggername) {
					const targets = game.filterPlayer(target => {
						const evt = event.getl(target);
						if (!target.countCards("h") && evt?.hs?.length) {
							return true;
						}
						if (!evt?.cards2?.length || target.countCards("h", card => card.hasGaintag("clanjiannan"))) {
							return false;
						}
						if (event.name == "lose") {
							return Object.values(event.gaintag_map).flat().includes("clanjiannan");
						}
						return target.hasHistory("lose", evtx => {
							if (event != evtx.getParent()) {
								return false;
							}
							return Object.values(evtx.gaintag_map).flat().includes("clanjiannan");
						});
					});
					return targets.length;
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseButtonTarget({
							createDialog: [
								"间难：令一名角色执行本回合未执行过的一项",
								[
									[
										["discard", "弃置两张牌"],
										["draw", "摸两张牌"],
										["recast", "重铸所有装备牌"],
										["put", "将一张锦囊牌置于牌堆顶或失去1点体力"],
									],
									"textbutton",
								],
							],
							forced: true,
							chooseds: player.getStorage("clanjiannan_used"),
							filterButton: button => {
								const link = button.link;
								return !get.event().chooseds.includes(link);
							},
							filterTarget: true,
							ai1: button => {
								const player = get.player();
								switch (button.link) {
									case "discard": {
										if (
											game.hasPlayer(target => {
												const att = get.attitude(player, target);
												return att < 0 && target.countCards("he");
											})
										) {
											return 2;
										}
										break;
									}
									case "draw": {
										return 4;
									}
									case "recast": {
										if (player.hasCard(card => get.type(card) == "equip", "he")) {
											return 3;
										}
										break;
									}
									case "put": {
										if (
											game.hasPlayer(target => {
												const att = get.attitude(player, target);
												return att < 0 && target.hp <= 1 && target.countCards("h") <= 3;
											})
										) {
											return 5;
										}
										break;
									}
								}
								return 1;
							},
							ai2: target => {
								const link = ui.selected.buttons[0]?.link,
									player = get.player(),
									att = get.attitude(player, target);
								if (!link) {
									return 0;
								}
								if (["draw", "recast"].includes(link)) {
									if (target == player) {
										return att * 3;
									}
									return att;
								}
								return -att;
							},
						})
						.forResult();
					if (event.result.bool) {
						event.result.cost_data = { link: event.result.links[0] };
					}
				},
				async content(event, trigger, player) {
					const target = event.targets[0];
					player.addTempSkill("clanjiannan_used");
					const link = event.cost_data.link;
					player.markAuto("clanjiannan_used", link);
					switch (link) {
						case "discard": {
							await target.chooseToDiscard("he", 2, true);
							break;
						}
						case "draw": {
							const next = target.draw(2);
							next.gaintag = ["clanjiannan"];
							await next;
							break;
						}
						case "recast": {
							await target.recast(
								target.getCards("he", card => target.canRecast(card) && get.type(card, player) == "equip"),
								null,
								(player, cards) => {
									let next = player.draw(cards.length);
									next.log = false;
									next.gaintag = ["clanjiannan"];
								}
							);
							break;
						}
						case "put": {
							const result2 = await target
								.chooseCard(
									"将一张锦囊牌置于牌堆顶，或失去1点体力",
									card => {
										return get.type2(card) == "trick";
									},
									"h"
								)
								.set("ai", function (card) {
									return 7 - get.value(card);
								})
								.forResult();
							if (result2.bool) {
								target.$throw(result2.cards.length);
								game.log(target, "将", result2.cards, "置于牌堆顶");
								await target.lose(result2.cards, ui.cardPile, "insert");
							} else {
								await target.loseHp();
							}
							break;
						}
					}
				},
			},
		},
	},
	clanyichi: {
		audio: 2,
		trigger: {
			player: "phaseJieshuBegin",
		},
		filter(event, player) {
			return game.hasPlayer(target => player.canCompare(target));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => player.canCompare(target))
				.set("ai", target => {
					const player = get.player(),
						num = player.getHistory("useSkill", evt => ["clanjiannan", "clanjiannan_effect"].includes(evt.skill)).length;
					return num > 1 ? get.attitude(player, target) : -get.attitude(player, target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0],
				{ bool } = await player.chooseToCompare(target).forResult(),
				num = player.getHistory("useSkill", evt => ["clanjiannan", "clanjiannan_effect"].includes(evt.skill)).length;
			if (bool && num > 0) {
				let count = 1;
				while (count < 5) {
					switch (count) {
						case 1: {
							if (target.countDiscardableCards(target, "he")) {
								await target.chooseToDiscard("he", 2, true);
							}
							break;
						}
						case 2: {
							await target.draw(2);
							break;
						}
						case 3: {
							await target.recast(target.getCards("he", card => target.canRecast(card) && get.type(card, player) == "equip"));
							break;
						}
						case 4: {
							const result2 = await target
								.chooseCard(
									"将一张锦囊牌置于牌堆顶，或失去1点体力",
									card => {
										return get.type2(card) == "trick";
									},
									"h"
								)
								.set("ai", function (card) {
									return 7 - get.value(card);
								})
								.forResult();
							if (result2.bool) {
								await target.lose(result2.cards, ui.cardPile, "insert");
								target.$throw(result2.cards.length);
								game.updateRoundNumber();
								game.log(target, "将", result2.cards, "置于牌堆顶");
							} else {
								await target.loseHp();
							}
							break;
						}
					}
					count++;
					if (count > num) {
						break;
					}
				}
			}
		},
	},
};
