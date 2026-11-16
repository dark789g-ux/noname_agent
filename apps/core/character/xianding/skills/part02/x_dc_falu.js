import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "x_dc_falu" | "x_dc_zhenyi" | "x_dc_dianhua">} */
export const groupSkills = {
	//mega张琪瑛X
	x_dc_falu: {
		audio: "xinfu_falu",
		trigger: {
			player: ["loseAfter", "enterGame"],
			target: "useCardToTarget",
			global: ["loseAsyncAfter", "phaseBefore"],
		},
		forced: true,
		locked: false,
		filter(event, player, name) {
			let suits = [];
			if (name == "useCardToTarget") {
				const suit = get.suit(event.card, event.player);
				suits.add(suit);
			} else if (event.name.indexOf("lose") != 0) {
				if (event.name != "phase" || game.phaseNumber == 0) {
					suits.addArray(lib.suit);
				}
			} else if (event.type == "discard" && event.getlx !== false) {
				suits.addArray(event.getl(player)?.cards2?.map(card => get.suit(card)));
			}
			suits = suits.filter(suit => lib.suit.includes(suit));
			return suits?.length && !player.getStorage("x_dc_falu").containsAll(...suits);
		},
		intro: {
			content(storage, player) {
				if (!storage) {
					return "未记录";
				}
				return `已记录花色：${storage.map(i => get.translation(i)).join("")}`;
			},
		},
		onremove(player, skill) {
			player.removeTip(skill);
			delete player.storage[skill];
		},
		async content(event, trigger, player) {
			let suits = [];
			if (event.triggername == "useCardToTarget") {
				const suit = get.suit(trigger.card, trigger.player);
				suits.add(suit);
			} else if (trigger.name.indexOf("lose") != 0) {
				if (trigger.name != "phase" || game.phaseNumber == 0) {
					suits.addArray(lib.suit);
				}
			} else if (trigger.type == "discard" && trigger.getlx !== false) {
				suits.addArray(trigger.getl(player)?.cards2?.map(card => get.suit(card)));
			}
			suits = suits.filter(suit => lib.suit.includes(suit) && !player.getStorage(event.name).includes(suit));
			player.markAuto(event.name, suits);
			player.storage[event.name].sort((a, b) => lib.suit.indexOf(b) - lib.suit.indexOf(a));
			game.log(player, "记录了", suits.map(i => get.translation(i)).join(""));
			const tip = player
				.getStorage(event.name)
				.map(i => get.translation(i))
				.join("");
			player.addTip(event.name, `法箓${tip}`);
		},
		ai: { combo: "x_dc_zhenyi" },
	},
	x_dc_zhenyi: {
		audio: "xinfu_zhenyi",
		trigger: { global: "useCard" },
		filter(event, player) {
			if (event.player != _status.currentPhase || !player.getStorage("x_dc_falu").length) {
				return false;
			}
			return event.player.getHistory("useCard", evt => get.type(evt.card) != "equip").indexOf(event) == 0;
		},
		filterx: {
			heartA: event => {
				const info = get.info(event.card);
				if (!event.targets?.length || info.multitarget || info.allowMultiple === false) {
					return false;
				}
				return game.hasPlayer(current => {
					return lib.filter.targetEnabled2(event.card, event.player, current) && !event.targets.includes(current);
				});
			},
			heartB: event => {
				const info = get.info(event.card);
				if (!event.targets?.length || info.multitarget || info.allowMultiple === false) {
					return false;
				}
				return event.targets.length;
			},
			clubA: event => {
				if (!event.targets?.length) {
					return false;
				}
				var type = get.type(event.card);
				if (type != "basic" && type != "trick") {
					return false;
				}
				return true;
			},
		},
		effectx: {
			heartA: (event, player) => {
				const targets = game
					.filterPlayer(current => {
						return lib.filter.targetEnabled2(event.card, player, current) && !event.targets.includes(current);
					})
					.map(current => get.effect(current, event.card, event.player, player));
				return targets.maxBy();
			},
			heartB: (event, player) => {
				const targets = event.targets.map(current => -get.effect(current, event.card, event.player, player));
				return targets.maxBy();
			},
			diamondA: (event, player) => {
				if (!get.tag(event.card, "damage") || !event.targets?.length) {
					return 0;
				}
				return event.targets.reduce((sum, current) => {
					return sum + get.damageEffect(current, event.player, player, get.natureList(event.card, event.player));
				}, 0);
			},
			diamondB: (event, player) => {
				if (!get.tag(event.card, "damage") || !event.targets?.length) {
					return 0;
				}
				return event.targets.reduce((sum, current) => {
					return sum - get.damageEffect(current, event.player, player, get.natureList(event.card, event.player));
				}, 0);
			},
			spadeA: (event, player) => {
				return 0.2 * get.attitude(player, event.player) * event.player.countCards("h");
			},
			spadeB: (event, player) => {
				return -0.2 * get.attitude(player, event.player) * event.player.countCards("h");
			},
			clubA: (event, player) => {
				return event.targets.reduce((sum, current) => {
					return sum + get.effect(current, event.card, event.player, player);
				}, 0);
			},
			clubB: (event, player) => {
				if (!event.targets?.length) {
					return get.attitude(player, event.player) >= -1 ? 0 : -2;
				}
				return event.targets.reduce((sum, current) => {
					return sum - get.effect(current, event.card, event.player, player);
				}, 0);
			},
		},
		async cost(event, trigger, player) {
			const suit = get.suit(trigger.card),
				result = await player
					.chooseButton([
						get.prompt(event.skill, trigger.player),
						[
							[
								["heartA", "♥：此牌目标+1"],
								["heartB", "♥：此牌目标-1"],
							],
							"tdnodes",
						],
						[
							[
								["diamondA", "♦：此牌伤害+1"],
								["diamondB", "♦：此牌伤害-1"],
							],
							"tdnodes",
						],
						[
							[
								["spadeA", `♠：其使用${get.translation(suit)}牌时摸一张牌`],
								["spadeB", `♠：其不能使用${get.translation(suit)}牌`],
							],
							"tdnodes",
						],
						[
							[
								["clubA", "♣：此牌额外结算一次"],
								["clubB", "♣：此牌无效"],
							],
							"tdnodes",
						],
					])
					.set("filterButton", button => {
						const player = get.player(),
							list = player.getStorage("x_dc_falu"),
							trigger = get.event().getTrigger(),
							filterx = get.info("x_dc_zhenyi").filterx;
						if (!list.includes(button.link.slice(0, -1))) {
							return false;
						}
						return !filterx[button.link] || filterx[button.link](trigger);
					})
					.set("ai", button => {
						const player = get.player(),
							check = get.info("x_dc_zhenyi")?.effectx,
							trigger = get.event().getTrigger();
						return check[button.link](trigger, player);
					})
					.forResult();
			if (result.bool && result.links) {
				const link = result.links[0];
				event.result = {
					bool: true,
					targets: [trigger.player],
					cost_data: [link.slice(0, -1), link.slice(-1)],
				};
			}
		},
		async content(event, trigger, player) {
			const [suit, type] = event.cost_data;
			player.unmarkAuto("x_dc_falu", suit);
			game.log(player, "移去了记录", get.translation(suit));
			const tip = player
				.getStorage("x_dc_falu")
				.map(i => get.translation(i))
				.join("");
			tip.length > 0 ? player.addTip("x_dc_falu", `法箓${tip}`) : player.removeTip("x_dc_falu");
			switch (suit) {
				case "heart": {
					const result = await player
						.chooseTarget(
							`真仪：为${get.translation(trigger.card)}${type == "A" ? "增加" : "减少"}一个目标`,
							(card, player, target) => {
								const trigger = get.event().getTrigger(),
									{ resultType: type } = get.event();
								if (type == "A") {
									return lib.filter.targetEnabled2(trigger.card, player, target) && !trigger.targets.includes(target);
								}
								return trigger.targets.includes(target);
							},
							true
						)
						.set("resultType", type)
						.set("ai", target => {
							const trigger = get.event().getTrigger(),
								{ resultType: type, player } = get.event();
							let eff = get.effect(target, trigger.card, trigger.player, player);
							return type == "A" ? eff : -eff;
						})
						.forResult();
					if (result.bool && result.targets) {
						player.line(result.targets, "green");
						game.log(player, "令", result.targets, type == "A" ? "成为了" : "移出了", trigger.card, "的目标");
						trigger.targets[type == "A" ? "addArray" : "removeArray"](result.targets);
					}
					break;
				}
				case "diamond": {
					const map = trigger.customArgs;
					if (map) {
						for (const target of game.players) {
							const id = target.playerid;
							if (!map[id]) {
								map[id] = {};
							}
							if (typeof map[id].extraDamage != "number") {
								map[id].extraDamage = 0;
							}
							map[id].extraDamage += type == "A" ? 1 : -1;
						}
					}
					game.log(player, "令", trigger.card, "造成的伤害", type == "A" ? "+1" : "-1");
					break;
				}
				case "spade": {
					trigger.player.addTempSkill(`x_dc_zhenyi_${type}`);
					const suit = get.suit(trigger.card);
					trigger.player.markAuto(`x_dc_zhenyi_${type}`, suit);
					game.log(player, "令", trigger.player, type == "A" ? "使用" : "无法使用", suit, type == "A" ? "牌时摸一张牌" : "牌");
					break;
				}
				case "club": {
					if (type == "A") {
						trigger.effectCount++;
					} else {
						trigger.targets.length = 0;
						trigger.all_excluded = true;
					}
					game.log(player, "令", trigger.card, type == "A" ? "额外结算一次" : "无效");
					break;
				}
			}
		},
		ai: { combo: "x_dc_falu" },
		subSkill: {
			A: {
				intro: {
					markcount(storage, player) {
						return storage ? storage.map(i => get.translation(i)).join("") : null;
					},
					content(storage, player) {
						if (storage) {
							return `使用${storage.map(i => get.translation(i)).join("")}牌时摸一张牌`;
						}
						return "未记录";
					},
				},
				charlotte: true,
				onremove: true,
				trigger: { player: "useCard" },
				filter(event, player) {
					return player.getStorage("x_dc_zhenyi_A").includes(get.suit(event.card));
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					await player.draw();
				},
			},
			B: {
				intro: {
					markcount(storage, player) {
						return storage ? storage.map(i => get.translation(i)).join("") : null;
					},
					content(storage, player) {
						if (storage) {
							return `无法使用${storage.map(i => get.translation(i)).join("")}牌`;
						}
						return "未记录";
					},
				},
				charlotte: true,
				onremove: true,
				mod: {
					cardEnabled(card, player) {
						if (player.getStorage("x_dc_zhenyi_B").includes(get.suit(card))) {
							return false;
						}
					},
					cardSavable(card, player) {
						if (player.getStorage("x_dc_zhenyi_B").includes(get.suit(card))) {
							return false;
						}
					},
				},
			},
		},
	},
	x_dc_dianhua: {
		audio: "xinfu_dianhua",
		trigger: { player: ["phaseZhunbeiBegin", "phaseJieshuBegin"] },
		frequent: true,
		async content(event, trigger, player) {
			const cards = get.cards(4, true);
			await game.cardsGotoOrdering(cards);
			const result = await player
				.chooseToMove(true)
				.set("list", [["牌堆顶", cards], ["获得"]])
				.set("prompt", "点化：获得一张已记录花色的牌，将其余牌以任意顺序放回牌堆顶")
				.set("filterx", (card, player) => player.getStorage("x_dc_falu").includes(get.suit(card)))
				.set("filterOk", moved => {
					const { filterx: filter, player } = get.event();
					return moved[1].length == 1 || moved[0].every(card => !filter(card, player));
				})
				.set("filterMove", (from, to, moved) => {
					const { filterx: filter, player } = get.event();
					if (moved[0].includes(from.link)) {
						if (typeof to == "number") {
							return to == 0 || (!moved[1].length && filter(from.link, player));
						}
						return moved[0].includes(to.link) || filter(from.link, player);
					}
					if (typeof to == "number") {
						return to == 0;
					}
					return filter(to.link, player);
				})
				.set("processAI", list => {
					const { filterx: filter, player } = get.event();
					const cards = list[0][1].slice(0).filter(card => filter(card, player));
					if (cards?.length) {
						const card = cards.maxBy(card => get.value(card, player));
						return [list[0][1].remove(card), [card]];
					}
					return [list[0][1], []];
				})
				.forResult();
			if (result.bool && result.moved) {
				const top = result.moved[0].reverse(),
					gains = result.moved[1];
				if (top?.length) {
					await game.cardsGotoPile(top, "insert");
				}
				if (gains?.length) {
					await player.gain(gains, "gain2");
				}
			}
		},
	},
};
