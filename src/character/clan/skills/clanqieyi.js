import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clanqieyi" | "clanjianzhi" | "clanquhuo" | "clangaojin">} */
export const groupSkills = {
	//族杨赐
	clanqieyi: {
		audio: 2,
		trigger: { player: ["phaseUseBegin", "useCardAfter"] },
		filter(event, player) {
			if (event.name == "useCard") {
				if (!player.hasSkill("clanqieyi_effect") || !lib.suits.includes(get.suit(event.card))) {
					return false;
				}
				const history = player.getHistory("useCard", evt => get.suit(evt.card) == get.suit(event.card));
				return history.indexOf(event) == 0;
			}
			return true;
		},
		async cost(event, trigger, player) {
			if (trigger.name == "phaseUse") {
				event.result = await player
					.chooseBool(get.prompt2(event.skill))
					.set("ai", () => true)
					.forResult();
			} else {
				event.result = { bool: true };
			}
		},
		async content(event, trigger, player) {
			if (trigger.name == "phaseUse") {
				player.addTempSkill(event.name + "_effect");
				const cards = get.cards(2, true);
				await player.viewCards("切议", cards);
			} else {
				const card = get.cards(1, true)[0];
				await player.showCards([card]);
				if (get.color(card) == get.color(trigger.card) || get.type2(card) == get.type2(trigger.card)) {
					await player.gain(card, "gain2");
				} else {
					if (!player.countCards("he")) {
						return;
					}
					const result = await player.chooseCard(`切议：将一张牌置于牌堆顶`, "he", true).forResult();
					const card = result.cards[0];
					player.$throw(get.position(card) == "h" ? 1 : card, 1000);
					game.log(player, "将", get.position(card) == "h" ? "一张牌" : card, "置于牌堆顶");
					await player.lose(card, ui.cardPile, "insert");
					await game.delayx();
				}
			}
		},
		subSkill: {
			effect: {
				init(player, skill) {
					const suits = player
						.getHistory("useCard", evt => lib.suits.includes(get.suit(evt.card)))
						.map(evt => get.suit(evt.card))
						.unique()
						.sort((a, b) => lib.suit.indexOf(b) - lib.suit.indexOf(a));
					player.markAuto(skill, suits);
					if (suits.length) {
						player.addTip(skill, get.translation(skill) + suits.reduce((str, i) => str + get.translation(i), ""));
					}
				},
				onremove(player, skill) {
					delete player.storage[skill];
					player.removeTip(skill);
				},
				mark: true,
				intro: {
					content: "已使用过的花色：$",
					onunmark(storage, player) {
						player.removeTip("clanqieyi_effect");
					},
				},
				silent: true,
				charlotte: true,
				trigger: { player: "useCard" },
				async content(event, trigger, player) {
					lib.skill.clanqieyi_effect.init?.(player, event.name);
				},
			},
		},
	},
	clanjianzhi: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		forced: true,
		filter(event, player) {
			const num = player.getHistory("useSkill", evt => evt.skill == "clanqieyi").length;
			return num > 0;
		},
		async content(event, trigger, player) {
			const list = Array.from({
				length: player.getHistory("useSkill", evt => evt.skill == "clanqieyi").length,
			}).map((_, i) => get.cnNumber(i + 1, true));
			const result = await player
				.chooseControl(list)
				.set("prompt", `###谏直###进行至多${get.cnNumber(list.length)}次判定，并执行后续效果`)
				.set("ai", () => get.event().list.length - 1)
				.set("list", list)
				.forResult();
			if (typeof result?.index !== "number") {
				return;
			}
			let num = result.index + 1,
				judge = [];
			while (num--) {
				const judgeEvent = player.judge();
				judgeEvent.judge2 = result => result.bool;
				judgeEvent.set("callback", async event => {
					event.getParent().orderingCards.remove(event.card);
				});
				const result = await judgeEvent.forResult();
				if (!result?.card) {
					break;
				} else {
					judge.push(result.card);
				}
			}
			const suits = player
				.getHistory("useCard")
				.map(evt => get.suit(evt.card))
				.unique();
			const cards = judge.filter(card => suits.includes(get.suit(card, false)));
			if (cards.length) {
				if (_status.connectMode) {
					game.broadcastAll(() => {
						_status.noclearcountdown = true;
					});
				}
				const given_map = new Map();
				let result;
				while (cards.length) {
					if (cards.length > 1) {
						result = await player
							.chooseButtonTarget({
								createDialog: ["谏直：请选择要分配的牌", cards],
								forced: true,
								selectButton: [1, Infinity],
								ai1(button) {
									if (ui.selected.buttons.length) {
										return 0;
									}
									return get.buttonValue(button);
								},
								ai2(target) {
									const { player, given_map: map } = get.event(),
										att = get.attitude(player, target),
										card = ui.selected.buttons?.[0]?.link;
									if (!card) {
										return 0;
									}
									if (get.value(card, player, "raw") < 0) {
										return Math.max(0.01, 100 - att);
									} else if (att > 0) {
										const cards = map.has(target) ? map.get(target) : [];
										return Math.max(0.1, att / Math.sqrt(1 + target.countCards("h") + cards.length));
									} else {
										return 0;
									}
								},
								given_map: given_map,
							})
							.forResult();
					} else if (cards.length === 1) {
						result = await player
							.chooseTarget(`选择一名角色获得${get.translation(cards)}`, true)
							.set("ai", target => {
								const { player, given_map: map, toGive: card } = get.event(),
									att = get.attitude(player, target);
								if (!card) {
									return 0;
								}
								if (get.value(card, player, "raw") < 0) {
									return Math.max(0.01, 100 - att);
								} else if (att > 0) {
									const cards = map.has(target) ? map.get(target) : [];
									return Math.max(0.1, att / Math.sqrt(1 + target.countCards("h") + cards.length));
								} else {
									return 0;
								}
							})
							.set("given_map", given_map)
							.set("toGive", cards[0])
							.forResult();
						result.links = cards.slice(0);
					} else {
						break;
					}
					if (result.bool) {
						const {
							links: toGive,
							targets: [target],
						} = result;
						cards.removeArray(toGive);
						const given = (given_map.get(target) ?? []).concat(toGive);
						given_map.set(target, given);
						if (!cards.length) {
							break;
						}
					}
				}
				if (_status.connectMode) {
					game.broadcastAll(() => {
						delete _status.noclearcountdown;
						game.stopCountChoose();
					});
				}
				const gain_list = Array.from(given_map.entries());
				for (const info of gain_list) {
					player.line(info[0], "green");
					game.log(info[0], "获得了", info[1]);
				}
				await game
					.loseAsync({
						gain_list,
						giver: player,
						animate: "gain2",
					})
					.setContent("gaincardMultiple");
			}
			if (judge.some(card => !suits.includes(get.suit(card, false)))) {
				await player.damage("nosource", "thunder");
			}
		},
		ai: { combo: "clanqieyi" },
	},
	clanquhuo: {
		audio: 2,
		clanSkill: true,
		audioname: ["clan_yangci", "clan_yangxiu", "clan_yangbiao", "clan_yangzhong"],
		trigger: {
			player: "loseAfter",
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		filter(event, player) {
			const evt = event.getl(player);
			if (!evt?.hs?.length) {
				return false;
			}
			const hs = evt.hs;
			if (!hs.some(card => get.type(card) == "equip" || get.name(card) == "jiu")) {
				return false;
			}
			//排除因使用、打出、弃置而失去牌的情况
			if (event.name.indexOf("lose") == 0) {
				if (event.type === "discard") {
					return false;
				}
				if (["useCard", "respond"].includes(event.getParent()?.name)) {
					return false;
				}
			}
			const history = player
				.getHistory("lose", evtx => {
					if (evtx.type == "discard") {
						return false;
					}
					const evt2 = evtx.relatedEvent || evtx.getParent();
					if (["useCard", "respond"].includes(evt2?.name)) {
						return false;
					}
					return evtx?.hs.some(card => get.type(card) == "equip" || get.name(card) == "jiu");
				})
				.map(evtx => (event.name == "lose" ? evtx : evtx.getParent()));
			return (
				history.indexOf(event) == 0 &&
				game.hasPlayer(target => {
					return target.isDamaged() && (target.hasClan("弘农杨氏") || target == player);
				})
			);
		},
		async cost(event, trigger, player) {
			const targets = game.filterPlayer(target => {
				return target.isDamaged() && (target.hasClan("弘农杨氏") || target == player);
			});
			if (!targets.length) {
				return;
			}
			if (targets.length == 1) {
				const result = await player
					.chooseBool(get.prompt2(event.skill, targets))
					.set("ai", () => {
						return get.attitude(get.player(), get.event().target) > 0;
					})
					.set("target", targets[0])
					.forResult();
				if (result.bool) {
					event.result = {
						bool: true,
						targets: targets,
					};
				}
			} else {
				event.result = await player
					.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
						return target.isDamaged() && (target.hasClan("弘农杨氏") || target == player);
					})
					.set("ai", target => {
						return get.recoverEffect(target, get.player());
					})
					.forResult();
			}
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await target.recover();
		},
	},
	//族吴懿
	clangaojin: {
		audio: 2,
		trigger: { player: "useCard" },
		filter(event, player) {
			return player.getHistory("useCard", evt => evt.card).indexOf(event) == player.getHandcardLimit() - 1;
		},
		async content(event, trigger, player) {
			player.addTempSkill(event.name + "_effect");
			const result = await player
				.chooseButton([
					`高劲：你可以选择至多两项`,
					[
						[
							[0, "手牌上限-1"],
							[1, `摸${player.getHp()}张牌`],
							[2, `手牌上限+1`],
						],
						"tdnodes",
					],
				])
				.set("selectButton", [1, 2])
				.set("ai", button => {
					if (button.link == 1) {
						return get.player().getHp();
					}
					return 0;
				})
				.forResult();
			if (result?.links?.length) {
				const links = result.links;
				if (links.includes(0)) {
					lib.skill.chenliuwushi.change(player, -1);
				}
				if (links.includes(1)) {
					await player.draw(player.getHp());
				}
				if (links.includes(2)) {
					lib.skill.chenliuwushi.change(player, 1);
				}
				if (links.length > 1 && Math.abs(links[0] - links[1]) == 1) {
					await player.chooseToDiscard("he", player.getHandcardLimit(), true);
				}
			}
		},
		subSkill: {
			effect: {
				mod: {
					cardUsable: () => Infinity,
					targetInRange: () => true,
				},
				trigger: {
					player: "useCard1",
				},
				forced: true,
				charlotte: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					const { name: skillName } = event;
					player.removeSkill(skillName);
					if (trigger.addCount !== false) {
						trigger.addCount = false;
						const stat = player.getStat().card;
						const name = trigger.card.name;
						if (typeof stat[name] === "number") {
							stat[name]--;
						}
					}
				},
				mark: true,
				intro: {
					content: "使用下一张牌无距离和次数限制",
				},
			},
		},
	},
};
