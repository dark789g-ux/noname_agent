import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olpingzhong" | "olsuyi" | "oljiyun" | "olshuliang">} */
export const groupSkills = {
	//OL杨阜 —— by 刘巴
	olpingzhong: {
		group: "olpingzhong_add",
		audio: 2,
		trigger: {
			player: "damageEnd",
		},
		forced: true,
		async content(event, trigger, player) {
			await player.draw(game.countPlayer(c => !c.countCards("h")) + 1);
		},
		subSkill: {
			add: {
				audio: "olpingzhong",
				trigger: {
					player: "useCard2",
				},
				locked: true,
				filter(event, player) {
					if (player.countUsed(null, true) > game.countPlayer(c => !c.countCards("h")) + 1 || !["trick", "basic"].includes(get.type(event.card))) {
						return false;
					}
					const info = get.info(event.card);
					if (info.allowMultiple == false) {
						return false;
					}
					if (event.targets && !info.multitarget) {
						return game.hasPlayer(target => !event.targets.includes(target) && lib.filter.targetEnabled2(event.card, player, target) && lib.filter.targetInRange(event.card, player, target));
					}
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget(
							get.prompt2("olpingzhong"),
							(card, player, target) => {
								const trigger = get.event().getTrigger();
								if (trigger.targets.includes(target)) {
									return false;
								}
								return lib.filter.targetEnabled2(trigger.card, get.player(), target) && lib.filter.targetInRange(trigger.card, get.player(), target);
							},
							[1, game.countPlayer(c => !c.countCards("h")) + 1]
						)
						.set("ai", target => {
							const trigger = get.event().getTrigger();
							return get.effect(target, trigger.card, trigger.player, get.player());
						})
						.forResult();
				},
				async content(event, trigger, player) {
					trigger.targets.addArray(event.targets);
					game.log(event.targets, "成为了", trigger.card, "的额外目标");
				},
			},
		},
	},
	olsuyi: {
		enable: "phaseUse",
		usable: 1,
		audio: 2,
		filterTarget: lib.filter.notMe,
		async content(event, trigger, player) {
			const target = event.targets[0];
			const card = get.cardPile(card => get.type(card) === "equip" && target.hasUseTarget(card));
			if (!card) {
				target.chat("孩子们，牌堆没有可以用的装备牌了");
			} else {
				target.$gain2(card);
				await target.chooseUseTarget(card, true);
			}
			if (target.isIn() && player.canUse("sha", target, false, false)) {
				await player.useCard({ name: "sha", isCard: true }, target, false);
			}
		},
		ai: {
			order: 10,
			expose: 0.2,
			result: {
				target(player, target) {
					if (get.effect(target, { name: "sha", isCard: true }, player, player)) {
						return -1;
					}
					return 0;
				},
			},
		},
	},
	//OL李丰
	oljiyun: {
		audio: 2,
		trigger: {
			player: "phaseZhunbeiBegin",
			global: "useCardAfter",
		},
		filter(event, player) {
			if (event.name == "phaseZhunbei") {
				return true;
			}
			return (
				event.player.hasHistory("lose", evt => {
					const evtx = evt.relatedEvent || evt.getParent();
					if (evtx != event) {
						return false;
					}
					return Object.values(evt.gaintag_map).flat().includes("oljiyun_effect");
				}) && player.getExpansions("oljiyun")?.length < 3
			);
		},
		async cost(event, trigger, player) {
			if (trigger.name == "phaseZhunbei") {
				const max = Math.max(1, player.getExpansions(event.skill).length);
				event.result = await player
					.chooseTarget(`###${get.prompt(event.skill)}###令至多${get.cnNumber(max)}名角色各摸一张牌`, [1, max])
					.set("ai", target => {
						const player = get.player();
						return get.effect(target, { name: "draw" }, player, player);
					})
					.forResult();
			} else {
				let cards = [];
				trigger.player.checkHistory("lose", evt => {
					if ((evt.relatedEvent || evt.getParent()) != trigger) {
						return false;
					}
					//还原下OL神必结算
					cards.addArray(evt.cards.filter(card => evt.gaintag_map[card.cardid]?.includes("oljiyun_effect") && ["e", "o", "d"].includes(get.position(card))));
				});
				if (cards.length > 3 - player.getExpansions(event.skill).length) {
					const num = 3 - player.getExpansions(event.skill).length;
					const result = await player
						.chooseCardButton(`集运：请将${num}张牌作为「粮」置于武将牌上`, cards, num, true)
						.set("ai", button => {
							return get.buttonValue(button);
						})
						.forResult();
					cards = result.links;
				}
				if (!cards.length) {
					return;
				} else {
					event.result = {
						bool: true,
						cost_data: cards,
					};
				}
			}
		},
		async content(event, trigger, player) {
			if (trigger.name == "phaseZhunbei") {
				const targets = event.targets?.sortBySeat();
				for (const target of targets) {
					await target.draw("nodelay").set("gaintag", ["oljiyun_effect"]);
				}
				await game.delayx();
			} else {
				const cards = event.cost_data;
				await player.addToExpansion(cards, "gain2").set("gaintag", ["oljiyun"]);
			}
		},
		marktext: "粮",
		intro: {
			name: "粮（集运）",
			markcount: "expansion",
			content: "expansion",
		},
		onremove: true,
		group: ["oljiyun_init"],
		subSkill: {
			init: {
				audio: "oljiyun",
				trigger: {
					player: "enterGame",
					global: "phaseBefore",
				},
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				forced: true,
				content() {
					const cards = [];
					for (const type of ["basic", "trick", "equip"]) {
						const card = get.cardPile2(cardx => get.type2(cardx) == type && !cards.includes(cardx));
						if (card) {
							cards.push(card);
						}
					}
					if (cards.length) {
						player.addToExpansion(cards, "gain2").gaintag.add("oljiyun");
					}
				},
			},
		},
	},
	olshuliang: {
		audio: 2,
		enable: ["chooseToUse", "chooseToRespond"],
		hiddenCard(player, name) {
			if (player.getExpansions("oljiyun").some(card => card.name == name)) {
				return true;
			}
		},
		filter(event, player) {
			if (event.responded || event.olshuliang) {
				return false;
			}
			return player.getExpansions("oljiyun").some(card => event.filterCard(card, player, event));
		},
		usable: 1,
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("输粮", player.getExpansions("oljiyun"), "hidden");
			},
			filter(button, player) {
				const evt = _status.event.getParent();
				return evt.filterCard(button.link, player, evt);
			},
			check(button) {
				const card = button.link,
					player = get.player();
				if (get.event().getParent().type != "phase") {
					return 1;
				}
				return player.getUseValue(card);
			},
			backup(links, player) {
				return {
					audio: "olshuliang",
					filterCard(card) {
						return card === lib.skill.olshuliang_backup.card;
					},
					selectCard: -1,
					viewAs: links[0],
					card: links[0],
					position: "x",
				};
			},
			prompt(links, player) {
				return "输粮：请选择" + get.translation(links[0]) + "的目标";
			},
		},
		ai: {
			combo: "oljiyun",
			effect: {
				target(card, player, target, effect) {
					if (get.tag(card, "respondShan")) {
						return 0.7;
					}
					if (get.tag(card, "respondSha")) {
						return 0.7;
					}
				},
			},
			order: 9,
			respondShan: true,
			respondSha: true,
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
		group: ["olshuliang_allocate"],
		subSkill: {
			backup: { audio: "olshuliang" },
			allocate: {
				audio: "olshuliang",
				trigger: { player: "phaseJieshuBegin" },
				filter(event, player) {
					return player.getExpansions("oljiyun").length > 0;
				},
				async cost(event, trigger, player) {
					const cards = player.getExpansions("oljiyun");
					event.result = await player
						.chooseBool()
						.set("createDialog", [`###${get.prompt(event.skill)}###将任意张「集运」牌分配给至多等量角色`, cards])
						.set("ai", () => {
							return true;
						})
						.forResult();
				},
				async content(event, trigger, player) {
					if (_status.connectMode) {
						game.broadcastAll(() => (_status.noclearcountdown = true));
					}
					const cards = player.getExpansions("oljiyun"),
						map = {};
					while (cards.length) {
						const result = await player
							.chooseButtonTarget({
								createDialog: [`集运：请选择要分配的牌和目标`, cards],
								forced: Object.keys(map).length == 0,
								selectButton: [1, cards.length],
								cardsx: cards,
								map: map,
								filterTarget: true,
								ai1(button) {
									if (get.event().cardsx.length < 2) {
										return false;
									}
									const { player, map } = get.event();
									return Math.max(
										...game.filterPlayer().map(target => {
											return [...ui.selected.cards, button.link, ...(map[target.playerid] || [])].reduce((sum, card) => {
												return get.value(card, target) * get.attitude(player, target);
											}, 0);
										})
									);
								},
								ai2(target) {
									const player = get.player();
									const card = ui.selected.buttons[0].link;
									if (card) {
										return get.value(card, target) * get.attitude(player, target);
									}
									return 0;
								},
							})
							.forResult();
						if (result?.bool && result.targets?.length && result.links?.length) {
							cards.removeArray(result.links);
							const id = result.targets[0].playerid;
							if (!map[id]) {
								map[id] = [];
							}
							map[id].addArray(result.links);
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
					if (Object.keys(map).length) {
						const gain_list = [];
						for (const i in map) {
							const source = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
							player.line(source, "green");
							gain_list.push([source, map[i]]);
							game.log(source, "获得了", map[i]);
						}
						await game
							.loseAsync({
								gain_list: gain_list,
								giver: player,
								animate: "gain2",
							})
							.setContent("gaincardMultiple");
					}
				},
			},
		},
	},
};
