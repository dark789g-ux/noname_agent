import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twdanfa" | "twlingbao">} */
export const groupSkills = {
	/*twdanfa: {
		audio: 2,
		trigger: { player: ["phaseZhunbeiBegin", "phaseJieshuBegin", "useCard"] },
		filter(event, player) {
			if (event.name != "useCard") {
				return player.countCards("he");
			}
			const cards = player.getExpansions("twdanfa");
			if (!cards.length) {
				return false;
			}
			const suit = get.suit(event.card, false);
			if (player.getStorage("twdanfa_used").includes(suit)) {
				return false;
			}
			return cards.some(card => get.suit(card, false) == suit);
		},
		async cost(event, trigger, player) {
			if (trigger.name == "useCard") {
				event.result = { bool: true };
			} else {
				event.result = await player
					.chooseCard("he", get.prompt2(event.skill))
					.set("ai", card => {
						const player = get.player();
						const cards = player.getExpansions("twdanfa");
						if (cards.some(cardx => get.suit(cardx, false) == get.suit(card))) {
							return 4 - get.value(card);
						}
						if (!player.hasValueTarget(card) && player.hasCard(cardx => player.hasValueTarget(cardx) && card != cardx, "hs")) {
							return 10;
						}
						return 5.5 - get.value(card);
					})
					.forResult();
			}
		},
		async content(event, trigger, player) {
			if (trigger.name == "useCard") {
				const effect = event.name + "_used";
				player.addTempSkill(effect);
				player.markAuto(effect, [get.suit(trigger.card)]);
				player.storage[effect].sort((a, b) => lib.suit.indexOf(b) - lib.suit.indexOf(a));
				player.addTip(effect, get.translation(effect) + player.getStorage(effect).reduce((str, suit) => str + get.translation(suit), ""));
				await player.draw();
			} else {
				const next = player.addToExpansion(event.cards, player, "giveAuto");
				next.gaintag.add(event.name);
				await next;
			}
		},
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove(player, skill) {
					delete player.storage[skill];
					player.removeTip(skill);
				},
				intro: { content: "本回合已触发花色：$" },
			},
		},
	},
	twlingbao: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return (
				player
					.getExpansions("twdanfa")
					.map(card => get.suit(card))
					.toUniqued().length > 1
			);
		},
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("灵宝", player.getExpansions("twdanfa"));
			},
			filter(button, player) {
				if (!ui.selected.buttons.length) {
					return true;
				}
				if (get.suit(button.link) == get.suit(ui.selected.buttons[0].link)) {
					return false;
				}
				if (ui.selected.buttons.every(card => get.color(card) == "red")) {
					return game.hasPlayer(current => current.isDamaged());
				}
				if (ui.selected.buttons.every(card => get.color(card) == "black")) {
					return game.hasPlayer(current => current.countDiscardableCards(player, "hej"));
				}
				return game.hasPlayer(current => game.hasPlayer(currentx => current != currentx && current.countCards("he")));
			},
			select: 2,
			backup(links) {
				const obj = get.copy(lib.skill["twlingbao_" + get.color(links)]);
				obj.cards = links;
				obj.audio = "twlingbao";
				obj.filterCard = () => false;
				obj.selectCard = -1;
				return obj;
			},
			prompt(links) {
				return lib.skill["twlingbao_" + get.color(links)].prompt;
			},
			check(button) {
				const storage = get.player().getExpansions("twdanfa");
				storage.remove(button.link);
				if (storage.some(card => card.suit == button.link.suit)) {
					return 1 + Math.random();
				}
				return 0;
			},
		},
		subSkill: {
			red: {
				filterTarget(card, player, target) {
					return target.isDamaged();
				},
				delay: false,
				prompt: "令一名角色回复1点体力",
				async content(event, trigger, player) {
					const { target } = event;
					const { cards } = get.info("twlingbao_backup");
					await player.loseToDiscardpile(cards);
					await game.delayx();
					await target.recover();
				},
				ai: {
					tag: { recover: 1 },
					result: { target: 1.5 },
				},
			},
			black: {
				filterTarget(card, player, target) {
					return target.countDiscardableCards(player, "hej");
				},
				delay: false,
				prompt: "弃置一名角色区域内至多两张区域不同的牌",
				async content(event, trigger, player) {
					const { target } = event;
					const { cards } = get.info("twlingbao_backup");
					await player.loseToDiscardpile(cards);
					await game.delayx();
					const num = ["h", "e", "j"].filter(position => target.countDiscardableCards(player, position)).length;
					if (num) {
						await player.discardPlayerCard(target, [1, Math.max(2, num)], "hej", true).set("filterButton", button => {
							const { link } = button;
							return !ui.selected.buttons.reduce((list, buttonx) => list.add(get.position(buttonx.link)), []).includes(get.position(link));
						});
					}
				},
				ai: {
					tag: {
						lose: 1.5,
						loseCard: 1.5,
						discard: 1.5,
					},
					result: {
						target(player, target) {
							if (
								get.attitude(player, target) > 0 &&
								target.countCards("e", card => {
									return get.value(card, target) <= 0;
								}) > 0 &&
								target.countCards("j", card => {
									return get.effect(target, card, target, target) < 0;
								}) > 8
							) {
								return 3;
							}
							if (
								target.countCards("h") > 0 &&
								target.countCards("e", card => {
									return get.value(card, target) > 0;
								}) > 0
							) {
								return -2;
							}
							return 0;
						},
					},
				},
			},
			none: {
				selectTarget: 2,
				filterTarget(card, player, target) {
					if (!ui.selected.targets.length) {
						return true;
					}
					return target.countCards("he") > 0;
				},
				complexSelect: true,
				targetprompt: ["摸牌", "弃牌"],
				delay: false,
				prompt: "令一名角色摸一张牌并令另一名角色弃置一张牌",
				multitarget: true,
				multiline: true,
				async content(event, trigger, player) {
					const { targets } = event;
					const { cards } = get.info("twlingbao_backup");
					await player.loseToDiscardpile(cards);
					await game.delayx();
					await targets[0].draw();
					if (targets[1].countCards("he")) {
						await targets[1].chooseToDiscard("he", true);
					}
				},
				ai: {
					result: {
						target(player, target) {
							if (!ui.selected.targets.length) {
								return 1;
							}
							if (
								target.countCards("e", card => {
									return get.value(card, target) <= 0;
								}) > 0
							) {
								return 1;
							}
							return -1;
						},
					},
				},
			},
			backup: {},
		},
		ai: {
			order(item, player) {
				if (player.countExpansions("twdanfa") > 4) {
					return 10;
				}
				return 1;
			},
			result: { player: 1 },
			combo: "twdanfa",
		},
	},*/
	twdanfa: {
		audio: 2,
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		check: () => true,
		trigger: { player: ["useCardAfter", "respondAfter"] },
		filter(event, player) {
			return (
				event.cards?.some(card => get.owner(card) == player || !get.owner(card)) &&
				!player.getExpansions("twdanfa").some(card => get.suit(card) == get.suit(event.card))
			);
		},
		async content(event, trigger, player) {
			await player
				.addToExpansion(
					trigger.cards.filter(card => get.owner(card) == player || !get.owner(card)),
					"gain2"
				)
				.set("gaintag", [event.name]);
			//await player.draw();
		},
	},
	twlingbao: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return (
				player
					.getExpansions("twdanfa")
					.map(card => get.suit(card))
					.unique().length > 1
			);
		},
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("灵宝", player.getExpansions("twdanfa"));
			},
			filter(button) {
				const buttons = ui.selected.buttons;
				if (!buttons.length) {
					return true;
				}
				return get.suit(buttons[0].link) != get.suit(button.link);
			},
			complexSelect: true,
			check(button) {
				const card = button.link;
				const suits = get
					.player()
					.getHistory("lose", evt => {
						return evt.getParent().name == "discard" && evt.getParent(2).skill == "twlingbao_backup";
					})
					.map(evt => evt.cards.map(card => get.suit(card)))
					.flat();
				if (!suits.includes(get.suit(card))) {
					return 2;
				}
				return 1;
			},
			select: 2,
			backup(links, player) {
				return {
					audio: "twlingbao",
					filterCard(card) {
						return links.includes(card);
					},
					selectCard: -1,
					position: "x",
					async content(event, trigger, player) {
						const cards = links,
							colors = cards.map(card => get.color(card)).unique();
						await player.draw(2);
						if (colors.length == 1 && colors[0] == "red") {
							const result = await player
								.chooseTarget(`灵宝：令一名角色从牌堆中获得两张基本牌`, true)
								.set("ai", target => get.effect(target, { name: "wuzhong" }, get.player(), get.player()))
								.forResult();
							if (result?.targets?.length) {
								const target = result.targets[0];
								player.line(target);
								const gain = [];
								while (gain.length < 2) {
									const card = get.cardPile(cardx => get.type(cardx) == "basic" && !gain.includes(cardx));
									if (card) {
										gain.push(card);
									} else {
										break;
									}
								}
								if (gain.length) {
									await target.gain(gain, "gain2");
								}
							}
						}
						if (colors.length == 1 && colors[0] == "black" && game.hasPlayer(target => target.countDiscardableCards(player, "hej"))) {
							const result = await player
								.chooseTarget(`灵宝：你弃置一名角色至多两个不同区域的共计至多两张牌`, true, (card, player, target) => {
									return target.countDiscardableCards(player, "hej");
								})
								.set("ai", target => get.effect(target, { name: "guohe_copy" }, get.player(), get.player()))
								.forResult();
							if (result?.targets?.length) {
								const target = result.targets[0];
								player.line(target);
								await player.discardPlayerCard(target, "hej", [1, 2], true);
							}
						}
						if (colors.length > 1) {
							const canDiscard = game.hasPlayer(target => target.countDiscardableCards(target, "hej"));
							const result = await player
								.chooseTarget(
									`灵宝：你令一名角色摸两张牌` + (canDiscard ? `，另一名角色弃置一张牌` : ``),
									true,
									(card, player, target) => {
										if (!ui.selected.targets.length) {
											return true;
										}
										return target.countDiscardableCards(target, "hej");
									}
								)
								.set("selectTarget", canDiscard ? 2 : 1)
								.set("ai", target => {
									const player = get.player();
									if (!ui.selected.targets.length) {
										return get.effect(target, { name: "wuzhong" }, player, player);
									}
									return get.effect(target, { name: "guohe_copy" }, player, player);
								})
								.set("complexTarget", true)
								.set("complexSelect", true)
								.set("targetprompt", ["摸牌", "弃牌"])
								.forResult();
							if (result?.targets?.length) {
								const draw = result.targets[0],
									discard = result.targets[1];
								player.line(result.targets);
								await draw.draw(2);
								if (discard) {
									await discard.chooseToDiscard("he", true);
								}
							}
						}
						const suits = player
							.getHistory("lose", evt => {
								return evt.getParent().name == "discard" && evt.getParent(2).skill == "twlingbao_backup";
							})
							.map(evt => evt.cards.map(card => get.suit(card)))
							.flat();
						if (suits.length != suits.unique().length) {
							player.tempBanSkill("twlingbao");
						}
					},
				};
			},
		},
		ai: {
			order: 7,
			result: {
				player: 1,
			},
		},
		subSkill: {
			backup: {},
		},
	},
};
