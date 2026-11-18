import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbjingmou" | "dcsbdingnan" | "dcsbguyi">} */
export const groupSkills = {
	//谋诸葛亮------by 清风
	dcsbjingmou: {
		audio: 2,
		audioname: ["dc_sb_zhugeliang_shadow"],
		derivation: "dcsbdingnan",
		zhuanhuanji(player, skill) {
			player.storage[skill] = !player.storage[skill];
			player.changeSkin({ characterName: "dc_sb_zhugeliang" }, "dc_sb_zhugeliang" + (player.storage[skill] ? "_shadow" : ""));
		},
		marktext: "☯",
		mark: true,
		intro: {
			content(storage, player) {
				return `任意角色出牌阶段开始时，若你未有记录的花色或牌类型，你可弃置任意张牌并秘密记录其中包含的至多三种花色与牌类型。有角色使用与你记录的花色或类型相同的牌时，移除该记录。${storage ? "此牌结算后将其交给任意一名角色" : "你可令此牌无效并弃置牌堆顶一张牌，若与此牌花色一致对其造成1点火焰伤害"}。`;
			},
		},
		trigger: { global: "phaseUseBegin" },
		filter(event, player) {
			return player.countDiscardableCards(player, "he") && !player.getStorage("dcsbjingmou_mark").length;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard({
					prompt: get.prompt(event.skill),
					prompt2: "弃置任意张牌并记录其中包含的至多三种花色与类型",
					selectCard: [1, Infinity],
					complexCard: true,
					position: "he",
					chooseonly: true,
					ai(card) {
						if (card.hasGaintag("dcsbguyi_tag")) {
							return 10 - get.value(card);
						}
						if (ui.selected.cards?.length < 3) {
							return 7 - get.value(card);
						}
						return 0;
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { cards } = event,
				types = cards.map(card => get.type2(card)).unique(),
				suits = cards.map(card => get.suit(card)).unique();
			await player.discard({ cards: cards, discarder: player });
			const typeMap = {};
			types.forEach(type => {
				typeMap[get.translation(type)] = type;
			});
			const suitMap = {};
			suits.forEach(suit => {
				suitMap[get.translation(suit)] = suit;
			});
			const result =
				types.length > 1 || suits.length > 1
					? await player
							.chooseButton({
								createDialog: [
									"靖谋：记录至多三种花色与类型",
									[
										[types.slice(0).map(type => get.translation(type)), "tdnodes"],
										[suits.slice(0).map(suit => get.translation(suit)), "tdnodes"],
									],
								],
								selectButton: [1, 6],
								complexButton: true,
								filterButton(button) {
									let { types, suits } = get.event();
									types = types.slice(0).map(type => get.translation(type));
									suits = suits.slice(0).map(suit => get.translation(suit));
									if (!ui.selected.buttons?.length) {
										return true;
									}
									const selectedTypes = ui.selected.buttons.filter(b => types.includes(b.link)).length;
									const selectedSuits = ui.selected.buttons.filter(b => suits.includes(b.link)).length;
									if (types.includes(button.link)) {
										return selectedTypes < Math.min(3, types.length);
									} else if (suits.includes(button.link)) {
										return selectedSuits < Math.min(3, suits.length);
									}
									return true;
								},
								ai(button) {
									return 1 + Math.random();
								},
							})
							.set("types", types)
							.set("suits", suits)
							.forResult()
					: { bool: true, links: types.concat(suits).map(i => get.translation(i)) };
			if (result?.bool && result.links?.length) {
				const { links } = result;
				const list = [];
				for (const link of links) {
					if (typeMap[link]) {
						list.push(typeMap[link]);
					}
					if (suitMap[link]) {
						list.push(suitMap[link]);
					}
				}
				player.markAuto(event.name + "_mark", list);
			}
		},
		group: ["dcsbjingmou_change", "dcsbjingmou_mark"],
		subSkill: {
			mark2: { charlotte: true, onremove: true },
			mark: {
				audio: "dcsbjingmou",
				forced: true,
				onremove: true,
				audioname: ["dc_sb_zhugeliang_shadow"],
				intro: {
					content(storage, player) {
						if (player.isUnderControl(true)) {
							return `已记录：${get.translation(storage)}`;
						} else {
							return `已记录${storage?.length || 0}个花色或类型数`;
						}
					},
				},
				trigger: { global: "useCard" },
				logTarget: "player",
				filter(event, player) {
					return [get.type2(event.card), get.suit(event.card)].some(link => player.getStorage("dcsbjingmou_mark").includes(link));
				},
				async content(event, trigger, player) {
					const links = [get.type2(trigger.card), get.suit(trigger.card)].filter(link => player.getStorage(event.name).includes(link));
					player.unmarkAuto(event.name, links);
					player.addSkill("dcsbjingmou_mark2");
					player.markAuto("dcsbjingmou_mark2", links);
					if (player.getStorage("dcsbjingmou_mark2").length >= 7) {
						await player.addSkills("dcsbdingnan");
					}
					const {
						targets: [target],
					} = event;
					if (!player.storage.dcsbjingmou) {
						const result = await player
							.chooseBool({
								prompt: get.prompt(event.name, target),
								prompt2: `令${get.translation(trigger.card)}无效并弃置牌堆顶的一张牌。若与此牌花色相同则对其造成一点火焰伤害`,
								ai() {
									const { player, target, card, targets } = get.event();
									let effect = 0;
									if (card.name == "wuxie" || card.name == "shan") {
										if (get.attitude(player, target) < -1) {
											effect = -1;
										}
									} else if (targets?.length) {
										for (let i = 0; i < targets.length; i++) {
											effect += get.effect(targets[i], card, target, player);
										}
									}
									if (effect < 0) {
										if (card.name == "sha") {
											const targetx = targets[0];
											if (targetx == player) {
												return !player.countCards("h", "shan");
											} else {
												return targetx.hp == 1 || (targetx.countCards("h") <= 2 && targetx.hp <= 2);
											}
										} else {
											return true;
										}
									}
									return false;
								},
							})
							.set("target", target)
							.set("targets", trigger.targets)
							.set("card", trigger.card)
							.forResult();
						if (result?.bool) {
							player.changeZhuanhuanji("dcsbjingmou");
							trigger.targets.length = 0;
							trigger.all_excluded = true;
							const cards = get.cards(1);
							await game.cardsDiscard(cards);
							game.log(player, "弃置了", cards, "#g（源自牌堆）");
							if (get.suit(trigger.card) == get.suit(cards[0])) {
								await trigger.player.damage("fire");
							}
						}
					} else {
						player
							.when({ global: "useCardAfter" })
							.filter(evt => evt == trigger && evt.cards?.filterInD("od")?.length)
							.step(async (event, trigger, player) => {
								const cards = trigger.cards.filterInD("od");
								const result = await player
									.chooseTarget({
										prompt: `靖谋：将${get.translation(cards)}交给一名角色`,
										ai(target) {
											return get.attitude(get.player(), target);
										},
									})
									.forResult();
								if (result?.bool && result.targets?.length) {
									const target = result.targets[0];
									player.changeZhuanhuanji("dcsbjingmou");
									player.line(target);
									await target.gain({
										cards: cards,
										animate: "gain2",
										giver: player,
									});
								}
							});
					}
				},
			},
			change: {
				audio: "dcsbjingmou",
				audioname: ["dc_sb_zhugeliang_shadow"],
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				prompt2(event, player) {
					return "切换【靖谋】为状态" + (player.storage.dcsbjingmou ? "阳" : "阴");
				},
				check: () => Math.random() > 0.5,
				async content(event, trigger, player) {
					player.changeZhuanhuanji("dcsbjingmou");
				},
			},
		},
	},
	dcsbdingnan: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget: true,
		selectTarget: [1, Infinity],
		multitarget: true,
		multiline: true,
		async content(event, trigger, player) {
			const { targets } = event;
			for (const target of targets.sortBySeat()) {
				const result = await target
					.chooseToRespond({
						filterCard(card, player, event) {
							if (get.name(card) !== "sha") {
								return false;
							}
							return lib.filter.cardRespondable(card, player, event);
						},
						prompt: `定南：打出一张【杀】，否则受到${get.translation(player)}的一点伤害`,
						ai(card) {
							return 1 + Math.random();
						},
					})
					.forResult();
				if (!result?.bool) {
					await target.damage();
				}
			}
		},
		ai: {
			order: 5,
			result: {
				player: 1,
				target: -1,
			},
		},
	},
	dcsbguyi: {
		audio: 2,
		forced: true,
		trigger: {
			player: "loseAfter",
			global: ["gameDrawAfter", "phaseEnd", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		onremove(player, skill) {
			player.removeGaintag(skill + "_tag");
		},
		filter(event, player) {
			if (event.name == "phase") {
				return !player.hasCard(card => card.hasGaintag("dcsbguyi_tag"), "h");
			}
			if (event.name == "gameDraw") {
				return player.hasCard(card => !card.hasGaintag("dcsbguyi_tag"), "h");
			}
			if (player.countMark("dcsbguyi_used") > 2) {
				return false;
			}
			const evt = event.getl(player);
			return evt?.cards2?.length;
		},
		getIndex(event, player) {
			if (["phase", "gameDraw"].includes(event.name)) {
				return 1;
			}
			let num = 0;
			const evt = event.getl(player);
			for (const i in evt.gaintag_map) {
				if (evt.gaintag_map[i].includes("dcsbguyi_tag")) {
					num++;
				}
			}
			return num;
		},
		async content(event, trigger, player) {
			if (trigger.name == "phase") {
				await player.draw({ num: 1, gaintag: ["dcsbguyi_tag"] });
			} else if (trigger.name == "gameDraw") {
				const result = await player
					.chooseCard({
						prompt: "孤熠：选择一张手牌标记为“熠”",
						forced: true,
						position: "h",
						ai(card) {
							return get.value(card);
						},
					})
					.forResult();
				player.addGaintag(result.cards, event.name + "_tag");
			} else {
				const num = Math.min(7, player.countMark("dcsbguyi_round") + 1);
				const cards = get.cards(num, true);
				await game.cardsGotoOrdering(cards);
				const result = await player
					.chooseToMove_new({
						prompt: "孤熠：获得一张牌标记为“熠”并将其余牌以任意顺序放回牌堆顶（靠左的在上）",
						forced: true,
						list: [["牌堆顶", cards], ["获得"]],
						filterMove(from, to, moved) {
							if (to == 1 && moved[1].length >= 1) {
								return false;
							}
							return true;
						},
						filterOk(moved) {
							return moved[1].length == 1;
						},
						processAI(list) {
							const cards = list[0][1].slice(0).sort((a, b) => {
								return get.value(b) - get.value(a);
							});
							return [cards.splice(1), cards];
						},
					})
					.forResult();
				if (result?.bool && result.moved?.length) {
					player.addTempSkill(event.name + "_used");
					player.addMark(event.name + "_used", 1, false);
					player.addTempSkill(event.name + "_round", "roundStart");
					player.addMark(event.name + "_round", 1, false);
					const { moved } = result;
					const top = moved[0];
					const gains = moved[1];
					if (gains.length) {
						await player.gain({
							cards: gains,
							animate: "gain2",
							gaintag: ["dcsbguyi_tag"],
						});
					}
					await game.cardsGotoPile(top.reverse(), "insert");
				}
			}
		},
		mod: {
			aiOrder(player, card, num) {
				if (get.itemtype(card) == "card" && card.hasGaintag("dcsbguyi_tag")) {
					return num + 0.1;
				}
			},
			aiValue(player, card, num) {
				if (get.itemtype(card) == "card" && card.hasGaintag("dcsbguyi_tag")) {
					return num / 10;
				}
			},
			aiUseful() {
				return lib.skill.dcsbguyi.mod.aiValue.apply(this, arguments);
			},
		},
		subSkill: {
			tag: {},
			used: { charlotte: true, onremove: true },
			round: { charlotte: true, onremove: true },
		},
	},
};
