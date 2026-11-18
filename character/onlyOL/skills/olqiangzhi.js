import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olqiangzhi" | "olxiantu" | "olqiongtu" | "olxianzhu" | "olshouxi" | "olhuimin">} */
export const groupSkills = {
	//界张松
	olqiangzhi: {
		audio: 2,
		trigger: {
			player: "phaseUseBegin",
		},
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current != player && current.countCards("h") > 0;
			});
		},
		subfrequent: ["draw"],
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2(event.skill),
					filterTarget(card, player, target) {
						return target != player && target.countCards("h") > 0;
					},
					ai: () => Math.random(),
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			await player.viewHandcards(target);
			const check = card => player.hasUseTarget(card, void 0, true) || (get.info(card).notarget && lib.filter.cardEnabled(card, player));
			const hs = player.getCards("h", card => check(card));
			const map = Object.groupBy(hs, card => get.type2(card));
			const types = Object.keys(map).sort((a, b) => map[a] - map[b]);
			const result = await player
				.choosePlayerCard({
					prompt: "强识：请选择要展示的牌",
					visible: true,
					target,
					forced: true,
					position: "h",
					ai(button) {
						const { types } = get.event();
						return types.indexOf(get.type2(button.link)) + 2;
					},
				})
				.set("types", types)
				.forResult();
			if (result.cards?.length) {
				const {
					cards: [card],
				} = result;
				await player.showCards(card, `${get.translation(player)}发动了【强识】`);
				player.addTempSkill(`${event.name}_draw`, "phaseChange");
				player.markAuto(`${event.name}_draw`, get.type2(card));
			}
		},
		subSkill: {
			draw: {
				trigger: {
					player: "useCard",
				},
				frequent: true,
				popup: false,
				charlotte: true,
				prompt: "是否执行【强识】的效果摸一张牌？",
				filter(event, player) {
					return player.getStorage("olqiangzhi_draw").includes(get.type2(event.card));
				},
				async content(event, trigger, player) {
					await player.draw({ nodelay: true });
				},
				onremove: true,
				mark: true,
				intro: {
					content: "使用$牌时，可以摸一张牌",
				},
			},
		},
	},
	olxiantu: {
		audio: 2,
		trigger: {
			global: "phaseUseBegin",
		},
		filter(event, player) {
			return event.player != player;
		},
		logTarget: "player",
		check(event, player) {
			if (get.attitude(_status.event.player, event.player) < 1) {
				return false;
			}
			return player.hp > 1 || player.hasCard(card => (get.name(card) === "tao" || get.name(card) === "jiu") && lib.filter.cardEnabled(card, player), "hs");
		},
		async cost(event, trigger, player) {
			const target = trigger.player;
			const result = await player
				.chooseControl({
					prompt: get.prompt2(event.skill, target),
					controls: ["一张", "两张", "cancel2"],
					choice: (() => {
						if (get.attitude(player, target) < 1) {
							return 2;
						}
						if (player.hp > 1 || player.hasCard(card => (get.name(card) === "tao" || get.name(card) === "jiu") && lib.filter.cardEnabled(card, player), "hs")) {
							return 1;
						}
						return 2;
					})(),
				})
				.forResult();
			event.result = {
				bool: result.control != "cancel2",
				cost_data: { num: result.index + 1 },
			};
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
				cost_data: { num },
			} = event;
			await player.draw({ num });
			await player.chooseToGive({
				target,
				selectCard: num,
				position: "he",
				forced: true,
				ai(card) {
					if (ui.selected.cards.length && card.name == ui.selected.cards[0].name) {
						return -1;
					}
					if (get.is.damageCard(card)) {
						return 1;
					}
					if (get.type(card) == "equip") {
						return 1;
					}
					return 0;
				},
			});
			player
				.when({ global: "phaseAnyEnd" })
				.filter(evt => evt == trigger)
				.then(async (event, trigger, player) => {
					const numx = target.getHistory("sourceDamage", evt => evt.num > 0).reduce((sum, evt) => sum + evt.num, 0);
					if (numx < num) {
						player.popup("杯具");
						await player.loseHp();
					}
				});
		},
		ai: {
			threaten(player, target) {
				return (
					1 +
					game.countPlayer(current => {
						if (current != target && get.attitude(target, current) > 0) {
							return true;
						}
						return false;
					})
				);
			},
			expose: 0.3,
		},
	},
	//闪张郃
	olqiongtu: {
		audio: "jsrgqiongtu",
		enable: "chooseToUse",
		groupSkill: "qun",
		viewAs: {
			name: "wuxie",
			isCard: true,
		},
		viewAsFilter(player) {
			return player.group == "qun";
		},
		filterCard: () => false,
		selectCard: 0,
		usable: 1,
		log: false,
		async precontent(event, trigger, player) {
			player.logSkill("olqiongtu");
			player.addTempSkill("olqiongtu_effect");
		},
		intro: {
			markcount: "expansion",
			content: "expansion",
		},
		subSkill: {
			effect: {
				charlotte: true,
				forced: true,
				popup: false,
				trigger: { player: ["useCard", "useCardAfter"] },
				filter(event, player) {
					return event.skill == "olqiongtu";
				},
				async content(event, trigger, player) {
					if (event.triggername == "useCard") {
						await player.draw();
					} else {
						const skill = "olqiongtu";
						let result;
						if (!player.hasCard(card => get.type(card) != "basic", "he")) {
							result = { bool: false };
						} else {
							result = await player
								.chooseCard({
									prompt: "穷途：将一张非基本牌置于武将牌上",
									forced: true,
									position: "he",
									filterCard(card) {
										return get.type(card) != "basic";
									},
									ai(card) {
										return -get.value(card);
									},
								})
								.forResult();
						}
						if (result.bool && result.cards?.length) {
							const { cards } = result;
							await player.addToExpansion({ cards, gaintag: [skill], animate: "give", source: player });
						} else {
							const cards = player.getExpansions(skill);
							if (cards.length) {
								await player.gain({ cards, animate: "give", source: player });
							}
							await player.changeGroup("wei");
						}
					}
				},
			},
		},
	},
	olxianzhu: {
		audio: "jsrgxianzhu",
		enable: "phaseUse",
		filter(event, player) {
			const types = ["equip", "trick"].removeArray(player.getStorage("olxianzhu_used"));
			return (
				player.group == "wei" &&
				types.length > 0 &&
				player.countDiscardableCards(player, "he", card => {
					const type = get.type2(card);
					return types.includes(type);
				}) > 0
			);
		},
		groupSkill: "wei",
		locked: false,
		viewAs: {
			name: "sha",
			isCard: true,
			cards: [],
			storage: {
				olxianzhu: true,
			},
		},
		ignoreMod: true,
		log: false,
		position: "he",
		filterCard(card, player) {
			const types = ["equip", "trick"].removeArray(player.getStorage("olxianzhu_used"));
			return types.includes(get.type2(card)) && lib.filter.cardDiscardable(card, player, "olxianzhu");
		},
		check(card) {
			const player = _status.event.player;
			const cardx = get.info("olxianzhu").viewAs;
			if (
				game.hasPlayer(current => {
					return player.canUse(cardx, current) && get.effect(current, card, player, player) > 0 && get.effect(current, cardx, player, player) > 0;
				})
			) {
				return 15 - get.value(card);
			}
			return 0;
		},
		async precontent(event, trigger, player) {
			const skill = "olxianzhu";
			const { cards } = event.result;
			player.logSkill(skill);
			player.addTempSkill(`${skill}_used`, "phaseChange");
			player.markAuto(`${skill}_used`, get.type2(cards?.[0]));
			await player.discard({ cards });
			event.result.cards = [];
			event.getParent().oncard = () => {
				const { card, player } = get.event();
				player
					.when("useCardAfter")
					.filter(evt => evt.card == card)
					.then(async (event, trigger, player) => {
						if (game.hasPlayer2(target => target.hasHistory("damage", evt => evt.card == trigger.card))) {
							await player.chooseUseTarget({ card: cards?.[0], addCount: false });
						}
					});
			};
			event.getParent().addCount = false;
		},
		mod: {
			cardUsable(card) {
				if (card.storage && card.storage.olxianzhu) {
					return Infinity;
				}
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "已弃置过： $",
				},
			},
		},
	},
	//界曹节
	olshouxi: {
		audio: 2,
		trigger: {
			target: "useCardToTargeted",
		},
		usable: 1,
		filter(event, player) {
			return get.is.damageCard(event.card) && player.countDiscardableCards(player, "he", card => get.is.damageCard(card)) > 0;
		},
		async cost(event, trigger, player) {
			const { player: source, card } = trigger;
			event.result = await player
				.chooseToDiscard({
					prompt: get.prompt2(event.skill, source),
					selectCard: [1, Infinity],
					position: "he",
					chooseonly: true,
					filterCard: card => get.is.damageCard(card),
					ai(card) {
						const { sourcex, cardx, player } = get.event();
						if (get.effect(player, cardx, sourcex, player) >= 0 || get.damageEffect(sourcex, player, player) <= 0) {
							return 0;
						}
						return 7 - get.value(card);
					},
				})
				.set("sourcex", source)
				.set("cardx", card)
				.forResult();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const {
				cards,
				targets: [target],
			} = event;
			await player.modedDiscard(cards);
			await target.damage();
			player
				.when({ global: "useCardAfter" })
				.filter(evt => evt.card == trigger.card)
				.step(async (event, trigger, player) => {
					if (!player.hasHistory("damage", evt => evt.card == trigger.card)) {
						await player.drawTo(player.getHandcardLimit());
					}
				});
		},
	},
	olhuimin: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(target => get.info("olhuimin").filterTarget(void 0, player, target));
		},
		selectTarget: [1, Infinity],
		filterTarget(card, player, target) {
			return target.countCards("h") <= target.getHp();
		},
		multiline: true,
		multitarget: true,
		async content(event, trigger, player) {
			const { targets } = event;
			await game.asyncDraw(targets.sortBySeat());
			const num = targets.filter(target => target.countCards("h") > target.getHp()).length;
			if (num > 0) {
				player.addTempSkill(`${event.name}_effect`, { player: "phaseBeforeStart" });
				player.addMark(`${event.name}_effect`, num, false);
			}
		},
		ai: {
			order: 3,
			result: {
				target: 1,
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "手牌上限+#",
				},
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("olhuimin_effect");
					},
				},
			},
		},
	},
};
