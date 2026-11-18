import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcbinji" | "dczangmao" | "dczhangguan" | "dccongfeng">} */
export const groupSkills = {
	//张世平
	dcbinji: {
		audio: 2,
		trigger: { global: "roundStart" },
		filter(event, player) {
			return true;
		},
		check: () => true,
		async content(event, trigger, player) {
			await player.draw(3);
			if (!player.hasCards("he") || !game.hasPlayer(current => current != player)) {
				return;
			}
			const result = await player
				.chooseCardTarget({
					prompt: `镔济：交给至多三名其他角色各一张牌`,
					filterTarget: lib.filter.notMe,
					selectTarget: [1, 3],
					filterCard: true,
					forced: true,
					selectCard: [1, 3],
					position: "he",
					complexSelect: true,
					targetprompt() {
						const links = ui.selected.cards;
						return ["获得", get.translation(links[ui.selected.targets.length - 1])].join("<br>");
					},
					filterOk() {
						return ui.selected.cards.length == ui.selected.targets.length;
					},
					ai1(card) {
						return 1 / Math.max(0.1, get.value(card));
					},
					ai2(target) {
						const player = get.player();
						let att = get.attitude(player, target);
						if (target.hasSkillTag("nogain")) {
							att /= 9;
						}
						return 4 + att;
					},
				})
				.forResult();
			if (result?.bool) {
				const { cards, targets } = result;
				player.addSkill(`${event.name}_gain`);
				await game
					.loseAsync({
						gain_list: targets.map((target, i) => [target, cards[i]]),
						giver: player,
						player: player,
						cards: cards,
						gaintag: [event.name],
						animate: "giveAuto",
					})
					.setContent("gaincardMultiple");
			}
		},
		subSkill: {
			gain: {
				audio: "dcbinji",
				charlotte: true,
				forced: true,
				trigger: { global: ["loseAfter", "loseAsyncAfter", "addToExpansionAfter", "equipAfter", "addJudgeAfter", "gainAfter"] },
				getIndex(event, player) {
					return game
						.filterPlayer(target => {
							const evt = event.getl?.(target);
							return evt?.hs?.length > 0 && Object.values(evt.gaintag_map).flat().includes("dcbinji");
						})
						.sortBySeat();
				},
				filter(event, player, name, target) {
					return true;
				},
				logTarget(event, player, name, target) {
					return target;
				},
				async content(event, trigger, player) {
					const {
						targets: [target],
					} = event;
					const card = get.cardPile(card => get.subtype(card) == "equip1", void 0, "random");
					if (card) {
						await target.gain(card, "gain2");
					} else {
						target.chat("匹夫之勇，愚蠢之至！");
					}
					await player.draw();
				},
			},
		},
	},
	dczangmao: {
		audio: 2,
		enable: "phaseUse",
		usable: 3,
		map: {
			discard: ["弃置任意张方块牌，然后从牌堆或弃牌堆随机获得等量张坐骑牌", () => get.player().countDiscardableCards(get.player(), "he", { suit: "diamond" })],
			give: ["交给一名其他角色一张方块牌，然后获得其装备区一张坐骑牌", () => get.player().countCards("he", { suit: "diamond" })],
			equip: ["将一张坐骑牌置入一名其他角色装备区， 然后其交给你两张手牌", () => get.player().countCards("he", card => ["equip3", "equip4", "equip3_4"].includes(get.subtype(card)))],
		},
		chooseButton: {
			dialog(event, player) {
				const map = get.info("dczangmao").map;
				const keys = Object.keys(map);
				return ui.create.dialog("驵贸：请选择一项", [keys.map(key => [key, map[key][0]]), "textbutton"], "hidden");
			},
			filter(button) {
				const map = get.info("dczangmao").map;
				return map[button.link][1]();
			},
			check(button) {
				return Math.random();
			},
			backup(links, player) {
				return {
					audio: "dczangmao",
					position: "he",
					...(links[0] == "discard" ? {} : { lose: false, discard: false, delay: false }),
					check(card) {
						return 6 - get.value(card);
					},
					...{
						discard: {
							filterCard(card, player) {
								return get.suit(card) == "diamond" && lib.filter.cardDiscardable(card, player, "dczangmao");
							},
							selectCard: [1, Infinity],
							async content(event, trigger, player) {
								const { cards } = event;
								const gain = [];
								while (gain.length < cards.length) {
									const card = get.cardPile(card => ["equip3", "equip4", "equip3_4"].includes(get.subtype(card)) && !gain.includes(card), void 0, "random");
									if (card) {
										gain.push(card);
									} else {
										break;
									}
								}
								if (gain.length) {
									await player.gain(gain, "gain2");
								} else {
									player.chat("塞翁失马，焉知非福");
								}
							},
						},
						give: {
							filterCard: { suit: "diamond" },
							filterTarget: lib.filter.notMe,
							async content(event, trigger, player) {
								const { cards, target } = event;
								await player.give(cards, target);
								if (target.countGainableCards(player, "e", card => ["equip3", "equip4", "equip3_4"].includes(get.subtype(card)))) {
									await player.gainPlayerCard(target, "e", true).set("filterButton", button => ["equip3", "equip4", "equip3_4"].includes(get.subtype(button.link)));
								} else {
									player.chat("其真无马邪？");
								}
							},
							ai: {
								result: {
									target: 1,
								},
							},
						},
						equip: {
							filterCard(card, player) {
								return ["equip3", "equip4", "equip3_4"].includes(get.subtype(card));
							},
							filterTarget(card, player, target) {
								return target != player && target.canEquip(ui.selected.cards[0], true);
							},
							async content(event, trigger, player) {
								const { cards, target } = event;
								player.$giveAuto(cards, target, false);
								await target.equip(cards[0]);
								const cardsx = target.getGainableCards(player, "h");
								if (cardsx?.length) {
									await target.chooseToGive({
										target: player,
										position: "h",
										selectCard: 2,
										forced: true,
									});
								} else {
									player.chat("其真不知马也！");
								}
							},
							ai: {
								result: {
									target: -1,
								},
							},
						},
					}[links[0]],
				};
			},
			prompt(links, player) {
				return `驵贸：${get.info("dczangmao").map[links[0]][0]}`;
			},
		},
		subSkill: {
			backup: {},
		},
		ai: {
			order: 6,
			result: {
				player: 1,
			},
		},
	},
	//马邈
	dczhangguan: {
		audio: 2,
		trigger: {
			global: "phaseBegin",
		},
		async cost(event, trigger, player) {
			const num = player.countCards("h") - player.hp;
			if (num > 0) {
				event.result = await player
					.chooseToDiscard(get.prompt2(event.skill), "h", num)
					.set("ai", card => {
						if (get.event().eff) {
							return 10 - get.value(card);
						}
						return 0;
					})
					.set(
						"eff",
						(() => {
							const target = _status.currentPhase;
							if (!target?.countGainableCards(player, "he")) {
								return false;
							}
							const eff = get.effect(target, { name: "shunshou_copy2" }, player, player);
							if (eff < 0 || get.attitude(player, target) > 0) {
								return false;
							}
							const bonos = player.hasSkill("dccongfeng") ? 3 : 6;
							return eff > Math.sqrt(num) * bonos;
						})()
					)
					.set("chooseonly", true)
					.forResult();
			} else {
				event.result = await player
					.chooseBool(get.prompt2(event.skill))
					//.set("choice", player.isDamaged() || num < -1 || get.attitude(player, trigger.player) > 0)
					.forResult();
			}
		},
		async content(event, trigger, player) {
			const count = player.countCards("h");
			if (count < player.hp) {
				await player.drawTo(player.hp);
			}
			if (event.cards?.length) {
				await player.modedDiscard(event.cards);
			}
			const num = player.countCards("h") - count;
			if (num == 0) {
				await player.recover();
			}
			if (num < 0) {
				const target = _status.currentPhase;
				if (target?.isIn() && target.countGainableCards(player, "he")) {
					await player.gainPlayerCard(target, "he", true);
				}
			}
			//player.addTempSkill("dczhangguan_effect");
		},
		subSkill: {
			effect: {
				trigger: {
					global: "useCard",
				},
				charlotte: true,
				filter(event, player) {
					if (event.player == player) {
						return false;
					}
					const evts = game.getGlobalHistory("useCard", evt => evt.player != player);
					return evts?.length > 0 && get.color(event.card) == get.color(evts[0].card);
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					trigger.directHit.add(player);
				},
			},
		},
	},
	dccongfeng: {
		audio: 2,
		trigger: {
			global: ["gainAfter", "loseAsyncAfter"],
		},
		getIndex(event, player) {
			if (!event.getl || !event.getg) {
				return [];
			}
			const list = [],
				gains = event.getg(player),
				loses = event.getl(player).cards2;
			game.filterPlayer(current => {
				const gains2 = event.getg(current),
					loses2 = event.getl(current).cards2;
				if (current == player) {
					return false;
				}
				if (gains2.length && loses.length && gains2.containsSome(...loses)) {
					list.add([current, player]);
				}
				if (gains.length && loses2.length && loses2.containsSome(...gains)) {
					list.add([player, current]);
				}
				return true;
			});
			return list;
		},
		filter(event, player, name, list) {
			if (event.getParent().name == "dccongfeng") {
				return false;
			}
			const [gain, lose] = list;
			return lose.countGainableCards(gain, "he");
		},
		async cost(event, trigger, player) {
			const [gain, lose] = event.indexedData;
			event.result = await gain
				.chooseBool(get.prompt(event.skill, lose, gain), "随机获得其一张牌")
				.set("choice", get.effect(lose, { name: "shunshou_copy2" }, gain, gain) > 0)
				.forResult();
		},
		logTarget(event, player, name, list) {
			return list.find(current => current != player);
		},
		async content(event, trigger, player) {
			const [gain, lose] = event.indexedData;
			const cards = lose.getGainableCards(gain, "he");
			if (cards?.length) {
				await gain.gain(cards.randomGets(1), "giveAuto");
			}
		},
	},
};
