import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olhuanhuo" | "olqingshi">} */
export const groupSkills = {
	//魔貂蝉
	olhuanhuo: {
		audio: 2,
		trigger: { global: "roundStart" },
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			await player.draw(2);
			const num = Math.min(
				2,
				game.countPlayer(target => target != player)
			);
			if (!num) {
				return;
			}
			const result = await player
				.chooseCardTarget({
					prompt: get.prompt(event.name),
					prompt2: `弃置至多两张牌并选择等量其他角色，这些角色下回合出牌阶段强制选中一张可以使用的手牌，且使用一张牌后随机弃置一张牌，直到其使用了两张牌`,
					filterCard: lib.filter.cardDiscardable,
					selectCard: [1, num],
					filterTarget: lib.filter.notMe,
					selectTarget: [1, num],
					complexCard: true,
					position: "he",
					filterOk() {
						if (!ui.selected.cards.length) {
							return false;
						}
						return ui.selected.cards.length == ui.selected.targets.length;
					},
					ai1(card) {
						return get.event().resultAI.cards.includes(card);
					},
					ai2(target) {
						return get.event().resultAI.targets.includes(target);
					},
				})
				.set(
					"resultAI",
					(function () {
						let cards = player.getDiscardableCards(player, "he", card => get.value(card) < 7.5).sort((a, b) => get.value(a) - get.value(b)),
							targets = game
								.filterPlayer(current => current != player && -get.attitude(player, current) * current.countCards("hs") > 0)
								.sort((a, b) => {
									let num1 = -get.attitude(get.player(), a) * a.countCards("hs"),
										num2 = -get.attitude(get.player(), b) * b.countCards("hs");
									return num2 - num1;
								});
						const num2 = Math.min(cards.length, targets.length, num);
						cards = cards.slice(0, num2);
						targets = targets.slice(0, num2);
						return { cards, targets };
					})()
				)
				.forResult();
			if (result?.cards?.length && result.targets?.length) {
				const { cards, targets } = result;
				await player.discard(cards);
				player.line(targets);
				targets.forEach(target => target.addSkill(event.name + "_mark"));
			}
		},
		subSkill: {
			backup: {
				filterCard(card, player, event) {
					return get.itemtype(card) == "card" && card == get.event().olhuanhuo_debuff;
				},
				viewAs(cards, player) {
					if (cards.length) {
						const card = get.event().olhuanhuo_debuff;
						return {
							name: get.name(card, player),
							nature: get.nature(card, player),
							cards: [card],
							isCard: true,
						};
					}
					return null;
				},
				popname: true,
				log: false,
			},
			mark: {
				charlotte: true,
				mark: true,
				intro: { content: "下回合出牌阶段强制选中一张可以使用的手牌，且使用一张牌后随机弃置一张牌，直到使用了两张牌" },
				trigger: { player: "phaseBegin" },
				firstDo: true,
				silent: true,
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					player.addTempSkill("olhuanhuo_limit");
				},
			},
			limit: {
				charlotte: true,
				trigger: { player: "phaseUseBegin" },
				silent: true,
				async content(event, trigger, player) {
					player.addTempSkill("olhuanhuo_debuff", "phaseUseAfter");
					player.addMark("olhuanhuo_debuff", 2, false);
				},
			},
			debuff: {
				charlotte: true,
				onremove: true,
				intro: { content: "当前“幻惑”剩余次数：#" },
				trigger: { player: ["chooseToUseBegin", "useCardAfter"] },
				filter(event, player) {
					if (event.name == "chooseToUse") {
						return event.type == "phase";
					}
					return event.isPhaseUsing(player);
				},
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					if (trigger.name == "useCard") {
						player.removeMark(event.name, 1, false);
						const hs = player.getDiscardableCards(player, "h"),
							es = player.getDiscardableCards(player, "e");
						const card = hs.length ? hs.randomGet() : es?.randomGet();
						if (card) {
							await player.discard(card);
						}
						if (!player.hasMark(event.name)) {
							player.removeSkill(event.name);
						}
					} else {
						game.broadcastAll(() => (_status._olhuanhuo_debuff_check = true));
						const cards = player.getCards("h", card => player.hasUseTarget(card, null, trigger));
						game.broadcastAll(() => delete _status._olhuanhuo_debuff_check);
						if (!cards.length) {
							return;
						}
						const card = cards.randomGet();
						trigger.set(event.name, card);
						const name = "olhuanhuo_backup";
						trigger.set("openskilldialog", `受【${get.translation(event.name)}】影响，须使用${get.translation(card)}`);
						trigger.set("norestore", true);
						trigger.set("_backupevent", name);
						trigger.set("custom", {
							add: {},
							replace: { window() {} },
						});
						trigger.backup(name);
					}
				},
			},
		},
	},
	olqingshi: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return !player.hasSkill("olrumo") || !game.hasPlayer(target => target.countCards("h", card => card.hasGaintag("olqingshi_tag")));
		},
		async cost(event, trigger, player) {
			let result;
			if (!player.hasSkill("olrumo")) {
				result = await player.chooseBool(get.prompt2(event.skill)).set("choice", true).forResult();
			} else {
				result = { bool: true };
			}
			if (result.bool) {
				event.result = {
					bool: true,
					targets: game.filterPlayer().sortBySeat(),
				};
			}
		},
		async content(event, trigger, player) {
			if (!player.hasSkill("olrumo")) {
				const name = event.name + "_animate";
				player.trySkillAnimate(name, name, player.checkShow(name));
				player.addSkill("olrumo");
			}
			const { targets } = event;
			const effect = async target => {
				const card = get.cardPile(card => {
					const info = get.info(card);
					return get.is.damageCard(card) && info.selectTarget && get.select(info.selectTarget).every(num => num == 1);
				});
				if (card) {
					const next = target.gain(card, "draw");
					next.gaintag.add("olqingshi_tag");
					await next;
				} else {
					target.chat("无牌可拿");
				}
			};
			await game.doAsyncInOrder(targets, effect);
		},
		group: ["olqingshi_effect"],
		subSkill: {
			tag: {},
			animate: {
				skillAnimation: true,
				animationColor: "metal",
			},
			effect: {
				audio: "olqingshi",
				trigger: {
					global: ["damageSource", "loseAfter", "cardsDiscardAfter", "loseAsyncAfter", "useCardToPlayer"],
				},
				filter(event, player, name) {
					const tag = "olqingshi_tag";
					if (name == "useCardToPlayer") {
						const evtx = event.getParent();
						return (
							event.targets.length == 1 &&
							event.player != player &&
							event.isFirstTarget &&
							game.hasPlayer2(target => {
								return target.hasHistory("lose", evt => {
									if ((evt.relatedEvent || evt.getParent()) != evtx) {
										return false;
									}
									return Object.values(evt.gaintag_map || {})
										.flat()
										.includes(tag);
								});
							})
						);
					} else if (event.name == "damage") {
						return (
							event.card &&
							event.cards &&
							game.hasPlayer2(target => {
								return target.hasHistory("lose", evt => {
									if (evt.getParent().card != event.card || evt.relatedEvent?.card == event.card) {
										return false;
									}
									return Object.values(evt.gaintag_map || {})
										.flat()
										.includes(tag);
								});
							})
						);
					}
					if (event.name.indexOf("lose") == 0) {
						if (event.getlx === false || event.position != ui.discardPile) {
							return false;
						}
					} else {
						var evt = event.getParent();
						if (evt.relatedEvent?.name == "useCard") {
							return false;
						}
					}
					return lib.skill.olqingshi_effect.getCards(event, tag).length;
				},
				getCards(event, tag) {
					const cards = [];
					const targets = game.filterPlayer2();
					for (const target of targets) {
						if (event.name.startsWith("lose")) {
							const evt = event.getl(target);
							cards.addArray(evt.cards2.filter(card => evt.gaintag_map?.[card.cardid]?.includes(tag) && get.position(card) == "d"));
						} else {
							game.checkGlobalHistory("cardMove", evt => {
								if (evt.name != "cardsDiscard" || evt != event) {
									return false;
								}
								const evtx = evt.getParent();
								if (evtx.name != "orderingDiscard") {
									return false;
								}
								const evt2 = evtx.relatedEvent || evtx.getParent();
								target.checkHistory("lose", evt3 => {
									const evt4 = evt3.relatedEvent || evt3.getParent();
									if (evt2 != evt4) {
										return false;
									}
									cards.addArray(evt3.getl(target).cards2.filter(card => evt3.gaintag_map?.[card.cardid]?.includes(tag) && get.position(card) == "d"));
								});
							});
						}
					}
					return cards;
				},
				async cost(event, trigger, player) {
					const name = event.triggername;
					if (name == "useCardToPlayer") {
						const targets = game.filterPlayer(target => lib.filter.targetEnabled2(trigger.card, trigger.player, target));
						const next = player.chooseCardTarget({
							prompt: `###${get.prompt(event.skill, trigger.player)}###弃置一张牌，为${get.translation(trigger.card)}重新指定目标（无距离限制）`,
							filterCard: lib.filter.cardDiscardable,
							position: "he",
							filterTarget(card, player, target) {
								return get.event().targets.includes(target);
							},
							ai1(card) {
								if (get.event().goon) {
									return 7 - get.value(card);
								}
								return 0;
							},
							ai2(target) {
								return get.effect(target, get.event().getTrigger().card, get.event().getTrigger().player, get.player());
							},
							targets: targets,
							goon: Math.max(...targets.filter(target => target != trigger.target).map(target => get.effect(target, trigger.card, trigger.player, player))) > get.effect(trigger.target, trigger.card, trigger.player, player),
						});
						next.targetprompt2.add(target => {
							if (!target.isIn() || target != get.event().getTrigger().target) {
								return false;
							}
							return "原目标";
						});
						event.result = await next.forResult();
					} else {
						event.result = {
							bool: true,
						};
					}
				},
				async content(event, trigger, player) {
					const name = event.triggername;
					if (name == "useCardToPlayer") {
						const { cards, targets } = event;
						await player.discard(cards);
						const evt = trigger.getParent();
						player.line(targets);
						evt.targets.length = 0;
						evt.targets.addArray(targets);
						game.log(targets, "成为了", trigger.card, "的新目标");
					} else if (trigger.name == "damage") {
						await player.draw();
					} else {
						const cards = lib.skill[event.name].getCards(trigger, "olqingshi_tag");
						await player.gain(cards, "gain2");
					}
				},
			},
		},
	},
};
