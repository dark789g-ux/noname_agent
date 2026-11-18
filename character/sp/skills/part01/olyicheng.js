import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olyicheng" | "olxuanzhu" | "oljiane">} */
export const groupSkills = {
	//刘辟
	olyicheng: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		async content(event, trigger, player) {
			let num = player.maxHp,
				cards = get.cards(num, true);
			await player.showCards(cards, get.translation(player) + "发动了【易城】");
			if (player.countCards("h")) {
				const sum = cards.reduce((num, card) => num + get.number(card), 0);
				const { bool, moved } = await player
					.chooseToMove("易城：请选择你要交换的牌")
					.set("filterMove", (from, to) => {
						return typeof to !== "number";
					})
					.set("selectionSpec", { move: "swap" })
					.set("list", [
						[
							"牌堆顶",
							cards,
							list => {
								const { sum } = get.event();
								const sum2 = list.reduce((num, card) => num + get.number(card, false), 0);
								return "牌堆顶（现" + sum2 + { 0: "=", "-1": "<", 1: ">" }[get.sgn(sum2 - sum).toString()] + "原" + sum + "）";
							},
						],
						["手牌", player.getCards("h")],
					])
					.set("filterOk", moved => moved[1].some(i => !get.owner(i)))
					.set("processAI", list => {
						const player = get.event().player,
							limit = Math.min(get.event().num, player.countCards("h"));
						let cards = list[0][1].slice(),
							hs = player.getCards("h");
						if (cards.reduce((num, card) => num + get.value(card), 0) > player.getCards("h").reduce((num, card) => num + get.value(card), 0)) {
							cards.sort((a, b) => get.number(a) - get.number(b));
							hs.sort((a, b) => get.number(b) - get.number(a));
							let cards2 = cards.slice(0, limit),
								hs2 = hs.slice(0, limit);
							if (hs2.reduce((num, card) => num + get.number(card), 0) > cards2.reduce((num, card) => num + get.number(card), 0)) {
								cards.removeArray(cards2);
								hs.removeArray(hs2);
								return [cards.concat(hs2), hs.concat(cards2)];
							}
							return [cards, hs];
						} else {
							cards.sort((a, b) => get.value(b) - get.value(a));
							hs.sort((a, b) => get.value(a) - get.value(b));
							let cards2 = cards.slice(0, limit),
								hs2 = hs.slice(0, limit),
								list = [cards, hs];
							for (let i = 0; i < limit; i++) {
								if (get.value(cards2[i]) > get.value(hs2[i])) {
									const change = [cards2[i], hs2[i]];
									cards[i] = change[1];
									hs[i] = change[0];
								} else {
									break;
								}
							}
							return list;
						}
					})
					.set("sum", sum)
					.set("num", num)
					.forResult();
				if (bool) {
					const puts = player.getCards("h", i => moved[0].includes(i));
					const gains = cards.filter(i => moved[1].includes(i));
					if (puts.length && gains.length) {
						player.$throw(puts, 1000);
						await player.lose(puts, ui.special);
						await player.gain(gains, "gain2");
						//调整手牌顺序
						player.getCards("h").forEach(i => i.goto(ui.special));
						player.directgain(moved[1].reverse(), false);

						cards = moved[0].slice();
						if (cards.length) {
							await game.cardsGotoOrdering(cards);
							await game.cardsGotoPile(cards.slice().reverse(), "insert");
							game.log(cards, "被放回了牌堆顶");
							game.updateRoundNumber();
						}
						await player.showCards(cards, get.translation(player) + "【易城】第一次交换后");
						if (cards.reduce((num, card) => num + get.number(card), 0) > sum && player.countCards("h")) {
							const { bool } = await player
								.chooseBool("易城：是否使用全部手牌交换" + get.translation(cards) + "？")
								.set(
									"choice",
									(() => {
										return cards.reduce((num, card) => num + get.value(card), 0) > player.getCards("h").reduce((num, card) => num + get.value(card), 0);
									})()
								)
								.forResult();
							if (bool) {
								const hs = player.getCards("h");
								player.$throw(hs, 1000);
								await player.lose(hs, ui.special);
								await player.gain(cards, "gain2");
								cards = hs.slice();
								if (cards.length) {
									await game.cardsGotoOrdering(cards);
									await game.cardsGotoPile(cards.slice().reverse(), "insert");
									game.log(cards, "被放回了牌堆顶");
									game.updateRoundNumber();
								}
								await player.showCards(cards, get.translation(player) + "【易城】第二次交换后");
							}
						}
					}
				}
			}
		},
		ai: {
			order: 9,
			result: { player: 1 },
		},
	},
	//陆凯
	olxuanzhu: {
		mark: true,
		marktext: "☯",
		zhuanhuanji: true,
		audio: 2,
		enable: "chooseToUse",
		filter(event, player) {
			if (!player.countCards("he") || event.type == "wuxie") {
				return false;
			}
			return get
				.inpileVCardList(info => {
					const name = info[2],
						type = get.type(name),
						infox = get.info({ name: name });
					if (type != "basic" && type != "trick") {
						return false;
					}
					if (type == "trick" && (!infox || !infox.filterTarget || get.info("xunshi").isXunshi({ name: name }))) {
						return false;
					}
					return (type != "basic") == (player.storage.olxuanzhu || false);
				})
				.some(card => event.filterCard({ name: card[2], nature: card[3] }, player, event));
		},
		usable: 1,
		chooseButton: {
			dialog(event, player) {
				const list = get
					.inpileVCardList(info => {
						const name = info[2],
							type = get.type(name),
							infox = get.info({ name: name });
						if (type != "basic" && type != "trick") {
							return false;
						}
						if (type == "trick" && (!infox || !infox.filterTarget || get.info("xunshi").isXunshi({ name: name }))) {
							return false;
						}
						return (type != "basic") == (player.storage.olxuanzhu || false);
					})
					.filter(card => event.filterCard({ name: card[2], nature: card[3] }, player, event));
				return ui.create.dialog("玄注", [list, "vcard"]);
			},
			check(button) {
				if (get.event().getParent().type != "phase") {
					return 1;
				}
				return get.event().player.getUseValue({ name: button.link[2], nature: button.link[3] });
			},
			backup(links, player) {
				let next = {
					audio: "olxuanzhu",
					filterCard: true,
					popname: true,
					check(card) {
						return 1 / (get.value(card) || 0.5);
					},
					position: "he",
					ignoreMod: true,
					precontent() {
						const cards = event.result.cards.slice();
						player.addToExpansion(cards, player, "give").gaintag.add("olxuanzhu");
						const viewAs = {
							name: event.result.card.name,
							nature: event.result.card.nature,
						};
						event.result.card = viewAs;
						event.result.cards = [];
						player
							.when("useCardAfter")
							.filter(evt => evt.skill == "olxuanzhu_backup")
							.step(async () => {
								const card = cards[0];
								if (get.type(card) != "equip") {
									await player.chooseToDiscard("he", true);
								} else {
									const cardx = player.getExpansions("olxuanzhu");
									if (cardx.length) {
										await player.loseToDiscardpile(cardx);
										await player.draw(cardx.length);
									}
								}
							});
					},
					onuse(result, player) {
						player.changeZhuanhuanji("olxuanzhu");
					},
				};
				const viewAs = {
					name: links[0][2],
					nature: links[0][3],
					suit: "none",
					number: null,
					isCard: true,
				};
				next.viewAs = viewAs;
				if (get.info("xunshi").isXunshi(viewAs)) {
					next.filterTarget = function (card, player, target) {
						const info = get.info(card);
						if (info.changeTarget) {
							let targets = [target];
							info.changeTarget(player, targets);
							if (targets.length > 1) {
								return false;
							}
						}
						return lib.filter.filterTarget(card, player, target);
					};
					next.selectTarget = 1;
				}
				return next;
			},
			prompt(links, player) {
				const viewAs = {
					name: links[0][2],
					nature: links[0][3],
					suit: "none",
					number: null,
					isCard: true,
				};
				const str = "将一张牌称为“玄”置于武将牌上，然后视为使用" + (get.translation(links[0][3]) || "") + "【" + get.translation(links[0][2]) + "】";
				return str + (get.info("xunshi").isXunshi(viewAs) ? "（仅能指定一个目标）" : "");
			},
		},
		hiddenCard(player, name) {
			if (!lib.inpile.includes(name) || player.getStat("skill").olxuanzhu || !player.countCards("he")) {
				return false;
			}
			return get
				.inpileVCardList(info => {
					const name = info[2],
						type = get.type(name),
						infox = get.info({ name: name });
					if (type != "basic" && type != "trick") {
						return false;
					}
					if (type == "trick" && (!infox || !infox.filterTarget || get.info("xunshi").isXunshi({ name: name }))) {
						return false;
					}
					return (type != "basic") == (player.storage.olxuanzhu || false);
				})
				.map(card => card[2])
				.includes(name);
		},
		ai: {
			order(item, player) {
				if (player && get.event().type == "phase") {
					let list = get
						.inpileVCardList(info => {
							const name = info[2],
								type = get.type(name),
								infox = get.info({ name: name });
							if (type != "basic" && type != "trick") {
								return false;
							}
							if (type == "trick" && (!infox || !infox.filterTarget || get.info("xunshi").isXunshi({ name: name }))) {
								return false;
							}
							return (type != "basic") == (player.storage.olxuanzhu || false);
						})
						.map(card => {
							return { name: card[2], nature: card[3] };
						})
						.filter(card => player.getUseValue(card, true, true) > 0);
					if (!list.length) {
						return 0;
					}
					list.sort((a, b) => {
						const getNum = function (card) {
							if (get.info("xunshi").isXunshi(card)) {
								return get.effect(
									game
										.filterPlayer(target => {
											return player.canUse(card, target, true, true);
										})
										.sort((a, b) => get.effect(b, card, player, player) - get.effect(a, card, player, player))[0],
									card,
									player,
									player
								);
							}
							return player.getUseValue(card, true, true);
						};
						return (getNum(b) || 0) - (getNum(a) || 0);
					});
					return get.order(list[0], player) * 0.99;
				}
				return 0.001;
			},
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (arg == "respond") {
					return false;
				}
				const name = tag == "respondSha" ? "sha" : "shan";
				return get.info("olxuanzhu").hiddenCard(player, name);
			},
			result: { player: 1 },
		},
		intro: {
			markcount: "expansion",
			mark(dialog, storage, player) {
				const cards = player.getExpansions("olxuanzhu");
				if (cards.length) {
					dialog.addSmall(player.getExpansions("olxuanzhu"));
				}
				dialog.addText(
					(() => {
						if (storage) {
							return "每回合限一次，你可以将一张牌称为“玄”置于武将牌上，然后视为使用任意普通锦囊牌（须指定目标且仅指定一个目标）。若此次置于武将牌上的“玄”：不为装备牌，你弃置一张牌；为装备牌，你将所有“玄”置入弃牌堆，然后摸等量的牌。";
						}
						return "每回合限一次，你可以将一张牌称为“玄”置于武将牌上，然后视为使用任意基本牌。若此次置于武将牌上的“玄”：不为装备牌，你弃置一张牌；为装备牌，你将所有“玄”置入弃牌堆，然后摸等量的牌。";
					})(storage)
				);
			},
		},
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		subSkill: { backup: {} },
	},
	oljiane: {
		audio: 2,
		trigger: { player: ["shaDamage", "useCardToEnd"] },
		filter(event, player, name) {
			if (event.type != "card" || !event.target || !event.target.isIn() || event.target == player) {
				return false;
			}
			if (name == "shaDamage") {
				return true;
			}
			return event.card.name != "sha" && !event.getParent()._neutralized;
		},
		logTarget: "target",
		forced: true,
		async content(event, trigger, player) {
			trigger.target.addTempSkill("oljiane_neutralized");
		},
		group: "oljiane_neutralize",
		global: "oljiane_ai",
		subSkill: {
			neutralize: {
				audio: "oljiane",
				trigger: {
					target: "shaMiss",
					global: "eventNeutralized",
				},
				filter(event, player, name) {
					if (event.type != "card") {
						return false;
					}
					return name == "shaMiss" || event._neutralize_event.player == player;
				},
				forced: true,
				async content(event, trigger, player) {
					player.addTempSkill("oljiane_nouse");
				},
			},
			ai: {
				ai: {
					directHit_ai: true,
					skillTagFilter(player, tag, arg) {
						if (!arg || !arg.target || !arg.target.hasSkill("oljiane_neutralized")) {
							return false;
						}
					},
				},
			},
			neutralized: {
				charlotte: true,
				mark: true,
				marktext: "牌",
				intro: { content: "本回合无法抵消牌" },
				trigger: { global: "useCard" },
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const id = player.playerid;
					const map = trigger.customArgs;
					if (!map[id]) {
						map[id] = {};
					}
					map[id].directHit2 = true;
				},
				mod: {
					wuxieJudgeEnabled: () => false,
					wuxieEnabled: () => false,
				},
			},
			nouse: {
				charlotte: true,
				mark: true,
				marktext: '<span style="text-decoration: line-through;">牌</span>',
				intro: { content: "本回合无法成为牌的目标" },
				mod: { targetEnabled: () => false },
			},
		},
	},
};
