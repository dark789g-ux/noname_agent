import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbbizuo" | "dcsbshimou" | "dcsbxianshi">} */
export const groupSkills = {
	//谋荀彧
	dcsbbizuo: {
		audio: 2,
		audioname: ["dc_sb_xunyu_shadow"],
		limited: true,
		skillAnimation: true,
		animationColor: "thunder",
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			var zhu = game.filterPlayer(current => current.getSeatNum() == 1)[0];
			if (!zhu || !zhu.isIn()) {
				return false;
			}
			return zhu.isMinHp();
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill))
				.set("ai", target => {
					let player = get.player();
					if (target.hasJudge("lebu") || target.isTurnedOver()) {
						return false;
					}
					if (get.attitude(player, target) > 4) {
						return get.threaten(target) / Math.sqrt(target.hp + 1) / Math.sqrt(target.countCards("h") + 1) > 0;
					}
					return false;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const target = event.targets[0];
			const next = target.insertPhase();
			target
				.when({ player: "phaseBegin" }, false)
				.filter(evt => {
					return evt?.skill == "dcsbbizuo";
				})
				.assign({
					firstDo: true,
				})
				.step(async () => {
					target.addTempSkill("dcsbbizuo_mark", "phaseAfter");
					game.filterPlayer(i => {
						return i !== target && i !== player;
					}).forEach(i => {
						i.addTempSkill("fengyin", "phaseAfter");
					});
				})
				.finish();
			player
				.when({ global: "phaseEnd" })
				.filter(evt => {
					return evt?.skill == "dcsbbizuo";
				})
				.step(async (event, trigger, player) => {
					let cards = game
						.getGlobalHistory("cardMove", evt => {
							if (evt.name.indexOf("lose") == 0) {
								if (evt.position !== ui.discardPile || evt.type === "discard") {
									return false;
								} //|| evt.getlx === false
								return true;
							} else if (evt.name == "cardsDiscard") {
								return true;
							}
						})
						.map(evt => {
							return evt.cards.filterInD("d");
						})
						.flat()
						.unique();
					await player.gain(cards, "draw");
					if (cards.length) {
						if (_status.connectMode) {
							game.broadcastAll(() => {
								_status.noclearcountdown = true;
							});
						}
						const given_map = new Map();
						while (true) {
							let result;
							if (cards.length > 1) {
								result = await player
									.chooseCardTarget({
										prompt: "弼佐：请选择要分配的牌",
										selectCard: [1, Infinity],
										filterTarget: lib.filter.notMe,
										filterCard(card) {
											if (get.itemtype(card) != "card" || card.hasGaintag("olsujian_given")) {
												return false;
											}
											return get.event().readyToGive.includes(card);
										},
										allowChooseAll: true,
										readyToGive: cards,
										given_map: given_map,
										ai1(card) {
											if (ui.selected.cards.length) {
												return 0;
											}
											return get.value(card);
										},
										ai2(target) {
											const { player, given_map } = get.event(),
												att = get.attitude(player, target),
												card = ui.selected.cards?.[0];
											if (!card) {
												return 0;
											}
											if (get.value(card, player, "raw") < 0) {
												return Math.max(0.01, 100 - att);
											} else if (att > 0) {
												const given = given_map.has(target) ? given_map.get(target) : [];
												return Math.max(0.1, att / Math.sqrt(1 + target.countCards("h") + given.length));
											} else {
												return 0;
											}
										},
									})
									.forResult();
							} else if (cards.length === 1) {
								result = await player
									.chooseTarget(`选择一名角色获得${get.translation(cards)}，或点取消留给自己`)
									.set("filterTarget", lib.filter.notMe)
									.set("ai", target => {
										const { player, given_map } = get.event();
										const att = get.attitude(player, target);
										if (get.event().toEnemy) {
											return Math.max(0.01, 100 - att);
										} else if (att > 0) {
											const given = given_map.has(target) ? given_map.get(target) : [];
											return Math.max(0.1, att / Math.sqrt(1 + target.countCards("h") + given.length));
										} else {
											return Math.max(0.01, (100 + att) / 200);
										}
									})
									.set("given_map", given_map)
									.set("toEnemy", get.value(cards[0], player, "raw") < 0)
									.forResult();
								result.cards = cards;
							} else {
								break;
							}
							if (result.bool) {
								cards.removeArray(result.cards);
								if (result.targets.length) {
									const target = result.targets[0];
									const giveCard = given_map.has(target) ? given_map.get(target) : [];
									giveCard.addArray(result.cards);
									given_map.set(target, giveCard);
								}
								player.addGaintag(result.cards, "olsujian_given");
								if (!cards.length) {
									break;
								}
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
						const targets = Array.from(given_map.keys());
						if (targets.length) {
							player.line(targets);
							const gain_list = targets.map(target => {
								return [target, given_map.get(target)];
							});
							await game
								.loseAsync({
									gain_list: gain_list,
									player: player,
									cards: gain_list.slice().flatMap(list => list[1]),
									giver: player,
									animate: "giveAuto",
								})
								.setContent("gaincardMultiple");
						}
					}
				});
		},
		subSkill: {
			//防呆标记
			mark: {
				charlotte: true,
				mark: true,
				intro: {
					markcount: () => 0,
					content: "当前回合为〖弼佐〗回合",
				},
			},
		},
	},
	dcsbshimou: {
		audio: 2,
		audioname: ["dc_sb_xunyu_shadow"],
		enable: "phaseUse",
		usable: 1,
		zhuanhuanji(player, skill) {
			player.storage[skill] = !player.storage[skill];
			player.changeSkin({ characterName: "dc_sb_xunyu" }, "dc_sb_xunyu" + (player.storage[skill] ? "_shadow" : ""));
		},
		marktext: "☯",
		mark: true,
		intro: {
			content(storage) {
				if (!storage) {
					return "转换技，出牌阶段限一次，你可令一名手牌数全场最低的角色将手牌调整至体力上限（至多摸五张）并视为使用一张仅指定单目标的普通锦囊牌（此牌牌名与目标由你指定）。若以此法摸牌，此牌可额外增加一个目标；若以此法弃牌，此牌额外结算一次。";
				}
				return "转换技，出牌阶段限一次，你可令一名手牌数全场最高的角色将手牌调整至体力上限（至多摸五张）并视为使用一张仅指定单目标的普通锦囊牌（此牌牌名与目标由你指定）。若以此法摸牌，此牌可额外增加一个目标；若以此法弃牌，此牌额外结算一次。";
			},
		},
		filterTarget(card, player, target) {
			if (!player.storage.dcsbshimou) {
				return target.isMinHandcard();
			}
			return target.isMaxHandcard();
		},
		selectTarget: 1,
		prompt() {
			const player = get.event().player;
			return lib.skill.dcsbshimou.intro.content(player.storage.dcsbshimou);
		},
		async content(event, trigger, player) {
			player.changeZhuanhuanji(event.name);
			const target = event.targets[0];
			let num = target.maxHp - target.countCards("h");
			if (num > 0) {
				await target.draw(Math.min(5, num));
			} else if (num < 0 && target.countDiscardableCards(target, "h") > 0) {
				await target.chooseToDiscard(-num, "h", true, "allowChooseAll");
			}
			if (!target.isIn()) {
				return;
			}
			let list = get.inpileVCardList(info => {
				if (info[0] != "trick") {
					return false;
				}
				return true;
			});
			if (
				!list.filter(info => {
					return game.hasPlayer(targetx => {
						return lib.filter.targetEnabled2({ name: info[2], isCard: true }, target, targetx);
					});
				}).length
			) {
				return;
			}
			//判断是否因此摸牌弃牌
			const bool1 = target.hasHistory("gain", evt => {
				return evt.getParent().name == "draw" && evt.getParent(2) == event;
			});
			const bool2 = target.hasHistory("lose", evt => {
				return evt.type == "discard" && evt.getParent(3) == event;
			});
			let str = `势谋：请选择${get.translation(target)}要使用的牌名`;
			if (bool1) {
				str += "（可额外增加1个目标）";
			}
			if (bool2) {
				str += "（可额外结算一次）";
			}
			const result = await player
				.chooseButton([str, [list, "vcard"]], true)
				.set("filterButton", button => {
					const source = get.event().source;
					return game.hasPlayer(target => {
						return lib.filter.targetEnabled2({ name: button.link[2], isCard: true }, source, target);
					});
				})
				.set("ai", button => {
					const card = get.autoViewAs({ name: button.link[2], isCard: true });
					return get.event().source.getUseValue(card) * Math.sign(get.attitude(get.player(), get.event().source));
				})
				.set("source", target)
				.forResult();
			const card = get.autoViewAs({ name: result.links[0][2], isCard: true, storage: { dcsbshimou: [num, target] } });
			let range = [1, 1];
			if (bool1) {
				range[1]++;
			}
			const result2 = await player
				.chooseTarget(
					`势谋：请为${get.translation(target)}选择${get.translation(card)}的目标`,
					(card, player, target) => {
						return lib.filter.targetEnabled2(get.event().cardx, get.event().source, target);
					},
					true,
					range
				)
				.set("source", target)
				.set("cardx", card)
				.set("ai", target => {
					return get.effect(target, get.event().cardx, get.event().source, get.player());
				})
				.forResult();
			const next = target.useCard(card, result2.targets, false);
			if (bool2) {
				next.set("oncard", () => {
					const event = get.event();
					event.effectCount++;
					game.log(event.card, "额外结算一次");
				});
			}
			await next;
		},
		ai: {
			//ai还有待完善
			order: 5,
			result: {
				player: 1,
				target(player, target) {
					const num = target.maxHp - target.countCards("h");
					const att = get.attitude(player, target);
					if (num > 0) {
						return num;
					} else if (num < 0) {
						if (-num < 2) {
							if (att > 0) {
								return 1.5;
							}
							return -2;
						}
						return num;
					}
					return Math.random() > 0.5;
				},
			},
		},
		locked: false,
		group: ["dcsbshimou_change"],
		subSkill: {
			change: {
				audio: "dcsbshimou",
				audioname: ["dc_sb_xunyou_shadow"],
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				prompt2(event, player) {
					return "切换【势谋】为状态" + (player.storage.dcsbshimou ? "阳" : "阴");
				},
				check: () => Math.random() > 0.5,
				content() {
					player.changeZhuanhuanji("dcsbshimou");
				},
			},
		},
	},
	dcsbxianshi: {
		audio: 2,
		trigger: { target: "useCardToTarget" },
		filter(event, player) {
			return get.type2(event.card) == "trick";
		},
		forced: true,
		popup: false,
		locked: false,
		async content(event, trigger, player) {
			player.addSkill(event.name + "_wuxie");
			player
				.when({ global: "useCardAfter" })
				.filter(evt => evt === trigger.getParent())
				.step(async (event, trigger, player) => {
					player.removeSkill("dcsbxianshi_wuxie");
					let cards = [];
					let history = game.getGlobalHistory("everything", evt => {
						if (evt == trigger) {
							return true;
						}
						return ["lose", "loseAsync", "cardsDiscard"].includes(evt.name);
					});
					const startIndex = history.indexOf(trigger);
					for (let index = startIndex + 1; index < history.length; index++) {
						const evt = history[index];
						if (evt.name.indexOf("lose") == 0 && evt.position == ui.discardPile) {
							cards.addArray(evt.cards.filterInD("d"));
						} else if (evt.name == "cardsDiscard") {
							const evtx = evt.getParent();
							if (evtx.name === "orderingDiscard") {
								const evt2 = evtx.relatedEvent || evtx.getParent();
								if (evt2.name == "useCard" && evt2.player == player) {
									continue;
								}
							}
							cards.addArray(evt.cards.filterInD("d"));
						}
					}
					if (cards.length) {
						await player.gain(cards, "gain2");
					}
				});
		},
		subSkill: {
			wuxie: {
				charlotte: true,
				audio: "dcsbxianshi",
				enable: "chooseToUse",
				filterCard: true,
				viewAsFilter(player) {
					return player.countCards("hs") > 0;
				},
				viewAs: { name: "wuxie" },
				hiddenCard(name) {
					return name === "wuxie";
				},
				position: "hs",
				popname: true,
				prompt: "将一张手牌当【无懈可击】使用",
				check(card) {
					return 8 - get.value(card);
				},
				ai: {
					basic: {
						useful: [6, 4, 3],
						value: [6, 4, 3],
					},
					result: { player: 1 },
					expose: 0.2,
				},
			},
		},
	},
};
