import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twmiewei" | "twmiyong" | "twjinglve" | "twjinglve2" | "twjinglve3" | "twsbxingshang">} */
export const groupSkills = {
	//幻典韦
	twmiewei: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		prompt2: (event, player) =>
			`出牌阶段开始时，你可令此阶段使用【杀】的次数等同于你攻击范围内的角色数（当前为${game.countPlayer(current => player.inRange(current))}）。`,
		check(event, player) {
			return game.countPlayer(current => player.inRange(current)) > 0;
		},
		content() {
			player.addTempSkill(event.name + "_effect", "phaseUseAfter");
			player.markSkill(event.name + "_effect");
		},
		group: ["twmiewei_damage"],
		subSkill: {
			damage: {
				audio: "twmiewei",
				forced: true,
				locked: false,
				trigger: { source: "damageBegin1" },
				filter(event, player) {
					return event.notLink() && event?.card?.name == "sha" && event.getParent("useCard").targets?.includes(event.player);
				},
				logTarget: "player",
				content() {
					const num = game
						.getGlobalHistory("everything", evt => {
							return evt.name == "useCard" && evt?.card?.name == "sha" && evt.targets;
						})
						.reduce((list, evt) => {
							return list.addArray(evt.targets);
						}, []).length;
					trigger.num += Math.min(5, num);
				},
			},
			effect: {
				charlotte: true,
				mod: {
					cardUsable: function (card, player, num) {
						if (card.name == "sha") {
							return game.countPlayer(current => player.inRange(current));
						}
					},
				},
				intro: {
					markcount(storage, player) {
						return player.getCardUsable("sha");
					},
					content(storage, player, skill) {
						return `还可使用${player.getCardUsable("sha")}张【杀】`;
					},
				},
			},
		},
	},
	twmiyong: {
		audio: 2,
		limited: true,
		skillAnimation: true,
		animationColor: "thunder",
		enable: "phaseUse",
		filter(event, player) {
			return player.hasCard(card => get.name(card, player) == "sha", "h");
		},
		filterCard: (card, player) => get.name(card, player) == "sha" && !player.getStorage("twmiyong_effect").includes(card),
		check: (card, player) => player.getUseValue(card),
		position: "h",
		selectCard: [1, 2],
		lose: false,
		discard: false,
		delay: false,
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const cards = event.cards;
			const skill = "twmiyong_effect";
			await player.showCards(cards);
			player.addGaintag(cards, skill);
			player.addSkill(skill);
			cards.forEach(card => {
				card.storage[skill] = true;
			});
		},
		subSkill: {
			effect: {
				audio: "twmiyong",
				mod: {
					aiOrder(card, player, num) {},
				},
				onremove(player, skill) {
					player.removeGaintag(skill);
					delete player.storage[skill];
				},
				charlotte: true,
				forced: true,
				trigger: {
					global: ["loseAfter", "loseAsyncAfter", "cardsDiscardAfter"],
				},
				getSha(event, player) {
					let gain = []; //考虑到后续可能有重置限定技的技能，需要对每张记录的牌都判断一次是否为首次
					const cards = event.cards.filter(card => card.storage.twmiyong_effect);
					if (!cards.length) {
						return gain;
					}
					let use = [],
						respond = [],
						discard = [];
					//直接获取本回合所有有关的弃牌出牌事件
					game.checkGlobalHistory("cardMove", evt => {
						const cardsx = evt.cards;
						if (!cardsx || !cardsx.some(card => cards.includes(card))) {
							return false;
						}
						if (event.name.indexOf("lose") == 0 && ["lose", "loseAsync"].includes(evt.name)) {
							if (evt.position != ui.discardPile || evt.type != "discard" || evt.getlx === false) {
								return false;
							}
							discard.add(evt);
						} else if (evt.name == "cardsDiscard" && event.name == "cardsDiscard") {
							const evtx = evt.getParent();
							if (evtx.name !== "orderingDiscard") {
								return false;
							}
							const evt2 = evtx.relatedEvent || evtx.getParent();
							if (evt2.name == "useCard") {
								use.add(evt);
							} else if (evt2.name == "respond") {
								respond.add(evt);
							}
						}
					});
					//对每张记录牌分别判断，该事件是不是其首次
					gain.addArray(
						cards.filter(card => {
							return [use, respond, discard].some(list => list.filter(evt => evt.cards.includes(card)).indexOf(event) == 0);
						})
					);
					return gain.filterInD("d");
				},
				filter(event, player) {
					if (event.name.indexOf("lose") == 0) {
						if (event.position != ui.discardPile || event.type != "discard" || event.getlx === false) {
							return false;
						}
					} else {
						const evt = event.getParent();
						if (evt.name !== "orderingDiscard") {
							return false;
						}
						const evt2 = evt.relatedEvent || evt.getParent();
						if (!["useCard", "respond"].includes(evt2.name)) {
							return false;
						}
					}
					const cards = lib.skill.twmiyong_effect.getSha(event, player);
					if (cards.length) {
						event.set("twmiyong_effect", cards);
						return true;
					}
					return false;
				},
				async content(event, trigger, player) {
					const cards = trigger[event.name].filterInD("d");
					if (!cards.length) {
						return;
					}
					await player.showCards(cards);
					await player.gain(cards, "gain2").set("gaintag", [event.name]);
				},
			},
		},
	},
	//TW司马师
	twjinglve: {
		audio: "jinglve",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			if (player.hasSkill("twjinglve2")) {
				return false;
			}
			return game.hasPlayer(target => lib.skill.twjinglve.filterTarget(null, player, target));
		},
		filterTarget(card, player, target) {
			return target.countCards("h") > 0;
		},
		async content(event, trigger, player) {
			const target = event.target;
			player.markAuto("jinglve4", [target]);
			const result = await player
				.chooseButton(["选择一张牌作为「死士」", target.getCards("h")], true)
				.set("ai", button => {
					const card = button.link;
					const val = get.event().getParent().target.getUseValue(card);
					return Math.max(val, get.value(card));
				})
				.forResult();
			if (result.bool) {
				player.storage.twjinglve2 = target;
				player.storage.twjinglve3 = result.links[0];
				player.addSkill("twjinglve2");
			}
		},
		ai: {
			order: 12,
			result: { target: -1 },
		},
	},
	twjinglve2: {
		mark: true,
		intro: {
			name: "死士",
			mark(dialog, content, player) {
				dialog.addText("记录目标");
				dialog.add([content]);
				if (player == game.me || player.isUnderControl()) {
					dialog.addText("死士牌");
					dialog.add([player.storage.twjinglve3]);
				}
			},
		},
		sourceSkill: "twjinglve",
		onremove(player) {
			delete player.storage.twjinglve2;
			delete player.storage.twjinglve3;
		},
		charlotte: true,
		trigger: { global: "dieEnd" },
		filter(event, player) {
			return event.player === player.storage.twjinglve2;
		},
		silent: true,
		lastDo: true,
		content() {
			player.removeSkill("twjinglve2");
		},
		group: "twjinglve3",
	},
	twjinglve3: {
		charlotte: true,
		audio: "jinglve",
		trigger: { global: ["useCard", "phaseAfter"] },
		sourceSkill: "twjinglve",
		filter(event, player) {
			if (event.player !== player.storage.twjinglve2) {
				return false;
			}
			const card = player.storage.twjinglve3;
			if (event.name == "useCard") {
				return event.cards?.includes(card);
			}
			return get.cardPile(card, "filed") || game.hasPlayer(target => target.getCards("h").includes(card));
		},
		forced: true,
		logTarget: "player",
		async content(event, trigger, player) {
			if (trigger.name == "useCard") {
				trigger.all_excluded = true;
				trigger.targets.length = 0;
				game.log(trigger.card, "被无效了");
			} else {
				const card = player.storage.twjinglve3;
				await player.gain(card, ...(get.owner(card) ? [get.owner(card), "give"] : ["gain2"]));
			}
			player.removeSkill("twjinglve2");
		},
	},
	//外服谋曹丕
	twsbxingshang: {
		audio: "sbxingshang",
		trigger: {
			global: "die",
			player: "phaseUseEnd",
		},
		filter(event, player) {
			if (event.name == "die") {
				return event.player.countCards("hej") > 0;
			}
			return game.hasPlayer(current => {
				return current.countCards("hej") > current.getHp();
			});
		},
		async cost(event, trigger, player) {
			if (trigger.name != "die") {
				event.result = await player
					.chooseTarget(`###${get.prompt(event.skill)}###将一名角色区域里的牌数弃置至与其体力值相同`, (card, player, target) => {
						return target.countCards("hej") > target.getHp();
					})
					.set("ai", target => {
						const num = target.countCards("hej") - target.getHp(),
							player = get.player();
						return num * get.effect(target, { name: "guohe" }, player, player);
					})
					.forResult();
				return;
			}
			const cards = trigger.player.getCards("hej").slice(0),
				give_map = new Map();
			if (_status.connectMode) {
				game.broadcastAll(function () {
					_status.noclearcountdown = true;
				});
			}
			do {
				const prompt1 = give_map.size > 0 ? "行殇：继续分配剩余牌" : "行殇：是否分配本次弃置的牌？",
					prompt2 =
						give_map.size > 0 ? `行殇：将${get.translation(cards)}分配给一名角色` : `行殇：是否令一名角色获得${get.translation(cards)}？`;
				const result =
					cards.length > 1
						? await player
								.chooseButtonTarget({
									createDialog: [prompt1, cards],
									selectButton: [1, Infinity],
									cardsx: cards,
									forced: give_map.size > 0,
									source: trigger.player,
									filterTarget(card, player, target) {
										return target != get.event().source;
									},
									ai1(button) {
										return get.value(button.link);
									},
									canHidden: true,
									ai2(target) {
										const player = get.player();
										const card = ui.selected.buttons[0].link;
										if (card) {
											return get.value(card, target) * get.attitude(player, target);
										}
										return 1;
									},
								})
								.set("allowChooseAll", true)
								.forResult()
						: await player
								.chooseTarget(prompt2, (card, player, target) => {
									return target != get.event().source;
								})
								.set("forced", give_map.size > 0)
								.set("ai", target => {
									const att = get.attitude(_status.event.player, target);
									if (_status.event.enemy) {
										return -att;
									} else if (att > 0) {
										return att / (1 + target.countCards("h"));
									} else {
										return att / 100;
									}
								})
								.set("source", trigger.player)
								.set("enemy", get.value(cards[0], player, "raw") < 0)
								.forResult();
				if (result?.bool) {
					if (!result.links?.length) {
						result.links = cards.slice(0);
					}
					cards.removeArray(result.links);
					const target = result.targets[0],
						list = give_map.has(target) ? give_map.get(target) : [];
					give_map.set(target, [...list, ...result.links]);
				} else {
					break;
				}
			} while (cards.length > 0);
			if (_status.connectMode) {
				game.broadcastAll(function () {
					delete _status.noclearcountdown;
					game.stopCountChoose();
				});
			}
			const targets = Array.from(give_map.keys()),
				lose_list = [];
			for (let i of targets) {
				lose_list.add([i, give_map.get(i)]);
			}
			event.result = {
				bool: targets.length > 0,
				targets: targets?.sortBySeat(),
				cost_data: lose_list,
			};
		},
		async content(event, trigger, player) {
			if (trigger.name != "die") {
				const target = event.targets[0];
				const discards = target.getDiscardableCards(player, "hej"),
					num = target.countCards("hej") - target.getHp();
				const result =
					discards.length > num
						? await player.discardPlayerCard(target, num, "hej", true).forResult()
						: {
								bool: true,
								links: discards,
							};
				if (result?.bool && result.links?.length && target.getHp() > 0) {
					const cards = [],
						num = target.getHp();
					while (cards.length < num) {
						const canUse = result.links.filter(card => {
							return get.position(card) == "d" && !cards.includes(card) && player.hasUseTarget(card);
						});
						if (!canUse?.length) {
							break;
						}
						const result2 = await player
							.chooseButton(["行殇：是否使用其中一张牌？", canUse])
							.set("ai", button => {
								const player = get.player();
								return player.getUseValue(button.link);
							})
							.forResult();
						if (result2?.bool) {
							cards.addArray(result2.links);
							const card = result2.links[0];
							if (player.hasUseTarget(card)) {
								await player.chooseUseTarget(card, true, false);
							}
						} else {
							break;
						}
					}
				}
				return;
			}
			await game
				.loseAsync({
					gain_list: event.cost_data,
					giver: trigger.player,
					animate: "gain2",
				})
				.setContent("gaincardMultiple");
		},
	},
};
