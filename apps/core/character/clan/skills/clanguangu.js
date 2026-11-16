import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clanguangu" | "clanxiaoyong" | "clanbaozu">} */
export const groupSkills = {
	//族钟琰
	clanguangu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		zhuanhuanji: true,
		mark: true,
		marktext: "☯",
		intro: {
			content(storage) {
				return "转换技。出牌阶段限一次，你可以观看" + (storage ? "一名角色的至多四张手" : "牌堆顶的至多四张") + "牌，然后可以使用其中的一张牌。";
			},
		},
		filter(event, player) {
			if (player.storage.clanguangu) {
				return game.hasPlayer(current => {
					return current.countCards("h");
				});
			}
			return true;
		},
		chooseButton: {
			dialog(event, player) {
				var dialog = ui.create.dialog("观骨：选择观看牌堆的牌数", "hidden");
				if (player.storage.clanguangu) {
					dialog.forceDirect = true;
				}
				return dialog;
			},
			chooseControl(event, player) {
				var list = [1, 2, 3, 4].map(i => {
					return get.cnNumber(i, true);
				});
				list.push("cancel2");
				return list;
			},
			check(button, player) {
				var ret;
				if (!player.hasSkill("clanxiaoyong")) {
					ret = 4;
				} else {
					var list = [4, 3, 2, 1];
					player.getHistory("useCard", evt => {
						var len = get.cardNameLength(evt.card);
						list.remove(len);
					});
					if (list.length) {
						ret = list[0];
					} else {
						ret = 4;
					}
				}
				return get.cnNumber(ret, true);
			},
			backup(result, player) {
				return {
					audio: "clanguangu",
					filterCard: () => false,
					selectCard: -1,
					filterTarget(card, player, target) {
						if (player.storage.clanguangu) {
							return true;
						}
						return false;
					},
					selectTarget() {
						var player = _status.event.player;
						if (player.storage.clanguangu) {
							return 1;
						}
						return -1;
					},
					num: result.index + 1,
					async content(event, trigger, player) {
						const { targets } = event;
						player.changeZhuanhuanji("clanguangu");
						let cards;
						if (!targets?.length) {
							const num = lib.skill["clanguangu_backup"].num;
							cards = get.cards(num, true);
						} else {
							const [target] = targets;
							let ret;
							if (!player.hasSkill("clanxiaoyong")) {
								ret = 4;
							} else {
								const list = [4, 3, 2, 1];
								player.getHistory("useCard", evt => {
									var len = get.cardNameLength(evt.card);
									list.remove(len);
								});
								if (list.length) {
									ret = list[0];
								} else {
									ret = 4;
								}
							}
							const result = await player
								.choosePlayerCard(target, "h", true, [1, 4])
								.set("prompt", "观骨：观看" + get.translation(target) + "的至多四张牌")
								.set("ai", button => {
									if (ui.selected.buttons.length >= _status.event.num) {
										return 0;
									}
									return Math.random();
								})
								.set("num", ret)
								.forResult();
							cards = result.cards;
						}
						if (cards?.length) {
							const count = cards.length;
							event.getParent().viewedCount = count;
							const result = await player
								.chooseButton(["观骨：是否使用其中一张牌？", cards])
								.set("filterButton", button => {
									var player = _status.event.player;
									var card = button.link;
									var cardx = {
										name: get.name(card, get.owner(card)),
										nature: get.nature(card, get.owner(card)),
										cards: [card],
									};
									return player.hasUseTarget(cardx, null, false);
								})
								.set("ai", button => {
									var len = _status.event.len;
									var card = button.link;
									var fix = 1;
									if (get.cardNameLength(card) == len) {
										fix = 2;
									}
									return fix * _status.event.player.getUseValue(card);
								})
								.set(
									"len",
									(function () {
										if (!player.hasSkill("clanxiaoyong")) {
											return 0;
										}
										var list = [];
										player.getHistory("useCard", evt => {
											var len = get.cardNameLength(evt.card);
											list.add(len);
										});
										if (!list.includes(count)) {
											return count;
										}
										if (list.length) {
											return list.randomGet();
										}
										return 4;
									})()
								)
								.forResult();
							if (result.bool && result.links?.length) {
								const {
									links: [card],
								} = result;
								cards.remove(card);
								const cardx = {
									name: get.name(card, get.owner(card)),
									nature: get.nature(card, get.owner(card)),
									cards: [card],
								};
								const next = player.chooseUseTarget(cardx, [card], true, false);
								if (card.name === cardx.name && get.is.sameNature(card, cardx, true)) {
									next.viewAs = false;
								}
								await next;
							}
						}
					},
					ai: {
						order: 10,
						result: {
							target(player, target) {
								return -Math.min(target.countCards("h"), 4) / 2;
							},
						},
					},
				};
			},
			prompt(result, player) {
				if (!player.storage.clanguangu) {
					return "点击“确定”以观看牌堆顶牌";
				}
				return "观骨：选择观看牌的目标";
			},
		},
		subSkill: {
			backup: {},
		},
		ai: {
			order: 10,
			result: {
				player: 1,
			},
		},
	},
	clanxiaoyong: {
		derivation: "clanguangu",
		init(player, skill) {
			player.addSkill(skill + "_mark");
		},
		onremove(player, skill) {
			player.removeSkill(skill + "_mark");
		},
		audio: 2,
		trigger: { player: "useCard" },
		filter(event, player) {
			const len = get.cardNameLength(event.card);
			if (player.hasHistory("useCard", evt => evt != event && get.cardNameLength(evt.card) == len, event)) {
				return false;
			}
			if (!player.getStat().skill.clanguangu) {
				return false;
			}
			const history = player
				.getAllHistory("useSkill", evt => {
					return evt.skill == "clanguangu_backup";
				})
				.map(evt => evt.event);
			if (!history.length) {
				return false;
			}
			let num = 0;
			for (let i = history.length - 1; i >= 0; i--) {
				const evt = history[i];
				if (evt.viewedCount) {
					num = evt.viewedCount;
					break;
				}
			}
			if (num && len == num) {
				return true;
			}
			return false;
		},
		forced: true,
		async content(event, trigger, player) {
			delete player.getStat().skill.clanguangu;
			game.log(player, "重置了", "#g【观骨】");
		},
		ai: { combo: "clanguangu" },
		mod: {
			aiOrder(player, card, num) {
				if (!player.hasSkill("clanguangu") || !player.getStat().skill.clanguangu) {
					return;
				}
				const history = player
					.getAllHistory("useSkill", evt => {
						return evt.skill == "clanguangu_backup";
					})
					.map(evt => evt.event);
				if (!history.length) {
					return;
				}
				let numx = 0;
				for (let i = history.length - 1; i >= 0; i--) {
					const evt = history[i];
					if (evt.viewedCount) {
						numx = evt.viewedCount;
						break;
					}
				}
				if (numx == get.cardNameLength(card)) {
					if (!player.hasHistory("useCard", evt => numx == get.cardNameLength(evt.card))) {
						return num + 9;
					}
				}
			},
		},
		subSkill: {
			mark: {
				init(player, skill) {
					const list = player
						.getHistory("useCard")
						.map(evt => get.cardNameLength(evt.card))
						.toUniqued();
					if (list.length) {
						player.markAuto(skill, list);
						player.storage[skill].sort((a, b) => a - b);
						player.addTip(
							skill,
							`${get.translation(skill)} ${player
								.getStorage(skill)
								.map(num => get.translation(num))
								.join("/")}`
						);
					}
				},
				charlotte: true,
				onremove(player, skill) {
					delete player.storage[skill];
					player.removeTip(skill);
				},
				trigger: { player: ["useCard1", "phaseAfter"] },
				filter(event, player) {
					if (event.name == "phase") {
						return true;
					}
					return player.getHistory("useCard", evt => get.cardNameLength(evt.card) == get.cardNameLength(event.card)).indexOf(event) == 0;
				},
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					if (trigger.name == "phase") {
						delete player.storage[event.name];
						player.removeTip(event.name);
						player.unmarkSkill(event.name);
					} else {
						player.markAuto(event.name, [get.cardNameLength(trigger.card)]);
						player.storage[event.name].sort((a, b) => a - b);
						player.addTip(
							event.name,
							`${get.translation(event.name)} ${player
								.getStorage(event.name)
								.map(num => get.translation(num))
								.join("/")}`
						);
					}
				},
				marktext: "咏",
				intro: { content: "本回合已使用牌名字数：$" },
			},
		},
	},
	clanbaozu: {
		audio: 2,
		audioname: ["clan_zhongyan", "clan_zhongyu", "clan_zhongyao"],
		audioname2: { clan_zhonghui: "clanbaozu_clan_zhonghui" },
		trigger: { global: "dying" },
		clanSkill: true,
		limited: true,
		skillAnimation: true,
		animationColor: "water",
		filter(event, player) {
			return (event.player == player || event.player.hasClan("颍川钟氏")) && event.player.hp <= 0 && !event.player.isLinked();
		},
		logTarget: "player",
		check(event, player) {
			return lib.skill.wanlan.check(event, player);
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await trigger.player.link(true);
			await trigger.player.recover();
		},
		subSkill: { clan_zhonghui: { audio: 6 } },
	},
};
