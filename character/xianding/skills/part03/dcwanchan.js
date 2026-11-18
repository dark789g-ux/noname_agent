import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcwanchan" | "dcjiangzhi" | "dcyuxi" | "dcporong" | "dcyitong" | "dcpeiniang">} */
export const groupSkills = {
	//莫琼树
	dcwanchan: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget: true,
		async content(event, trigger, player) {
			const { target } = event,
				num = Math.min(get.distance(player, target), 3);
			if (num > 0) {
				await target.draw(num);
			}
			target
				.when({ player: "useCard" })
				.filter(
					evt =>
						evt.getParent(2) == event &&
						game.hasPlayer(current => {
							if (evt.targets.includes(current) || !lib.filter.targetEnabled2(evt.card, evt.player, current)) {
								return false;
							}
							return evt.targets.some(target => [target.getPrevious(), target.getNext()].includes(current));
						})
				)
				.step(async (event, trigger, player) => {
					const targets = game.filterPlayer(current => {
						if (trigger.targets.includes(current) || !lib.filter.targetEnabled2(trigger.card, trigger.player, current)) {
							return false;
						}
						return trigger.targets.some(target => [target.getPrevious(), target.getNext()].includes(current));
					});
					if (targets.length) {
						trigger.player.line(targets, "green");
						trigger.targets.addArray(targets);
						game.log(targets, "也成为了", trigger.card, "的目标");
					}
				});
			await target
				.chooseToUse(function (card, player, event) {
					if (!["basic", "trick"].includes(get.type(card))) {
						return false;
					}
					return lib.filter.filterCard.apply(this, arguments);
				}, "宛蝉：是否使用一张基本牌或普通锦囊牌？")
				.set("targetRequired", true)
				.set("complexSelect", true)
				.set("filterTarget", function (card, player, target) {
					return lib.filter.targetEnabled.apply(this, arguments);
				})
				.set("addCount", false);
		},
		ai: {
			order(item, player) {
				if (game.hasPlayer(current => get.distance(player, current) && get.attitude(player, current) > 0) || player.hasCard(card => ["basic", "trick"].includes(get.type(card)) && player.hasValueTarget(card, false, false), "hs")) {
					return 10;
				}
				return 0.001;
			},
			result: {
				target(player, target) {
					const num = Math.min(get.distance(player, target), 3);
					let eff = get.effect(target, { name: "draw" }, player, player) * num;
					if (player == target && target.hasCard(card => ["basic", "trick"].includes(get.type(card)) && player.hasValueTarget(card, false, false), "hs")) {
						return 1;
					}
					return Math.max(0, eff) * Math.sqrt(target.countCards("h") + 1);
				},
			},
		},
	},
	dcjiangzhi: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		filter(event, player) {
			const { card, targets } = event;
			if (!["basic", "trick"].includes(get.type(card))) {
				return false;
			}
			return targets?.length > 1;
		},
		frequent: true,
		async content(event, trigger, player) {
			const judgeEvent = player.judge(card => {
				if (["red", "black"].includes(get.color(card))) {
					return 1.5;
				}
				return -1.5;
			});
			judgeEvent.judge2 = result => result.bool;
			const { color, judge } = await judgeEvent.forResult();
			if (judge < 0) {
				return;
			}
			const targetsx = game.filterPlayer(current => current != player && current.countDiscardableCards(player, "he"));
			if (color == "red") {
				await player.draw(3);
			} else if (color == "black" && targetsx.length) {
				const result = await player
					.chooseTarget(`选择一名角色弃置其至多两张牌`, (card, player, target) => {
						return get.event().targetsx.includes(target);
					})
					.set("ai", target => {
						const player = get.player();
						return get.effect(target, { name: "guohe_copy2" }, player, player);
					})
					.set("targetsx", targetsx)
					.forResult();
				if (result?.targets?.length) {
					await player.discardPlayerCard(result.targets[0], "he", true, [1, 2]);
				}
			}
		},
	},
	//威张辽
	dcyuxi: {
		audio: 2,
		trigger: {
			source: "damageBegin3",
			player: "damageBegin4",
		},
		frequent: true,
		async content(event, trigger, player) {
			player.addSkill(event.name + "_effect");
			await player.draw({ gaintag: [event.name] });
		},
		subSkill: {
			effect: {
				inherit: "nocount",
				filter(event, player) {
					return (
						event.addCount !== false &&
						player.hasHistory("lose", evt => {
							return (evt.relatedEvent || evt.getParent()) == event && evt.hs.length && Object.values(evt.gaintag_map).flat().includes("dcyuxi");
						})
					);
				},
				mod: {
					cardUsable(card) {
						if (get.number(card) === "unsure" || card.cards?.some(card => card.hasGaintag("dcyuxi"))) {
							return Infinity;
						}
					},
				},
			},
		},
	},
	dcporong: {
		audio: 2,
		comboSkill: true,
		mod: {
			aiOrder(player, card, num) {
				if (typeof card == "object") {
					const evt = lib.skill.dcjianying.getLastUsed(player);
					if (evt?.card && get.is.damageCard(evt.card) && !evt.dcporong && get.name(card, player) == "sha") {
						return num + 10;
					}
				}
			},
		},
		trigger: { player: "useCard" },
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			const evt = lib.skill.dcjianying.getLastUsed(player, event);
			if (!evt || !evt.card || evt.dcporong) {
				return false;
			}
			return get.is.damageCard(evt.card);
		},
		locked: false,
		logTarget(event, player) {
			return event.targets.sortBySeat();
		},
		check(event, player) {
			if (event.targets.reduce((sum, target) => sum + get.effect(target, event.card, player, player), 0) > 0) {
				return true;
			}
			const targets = event.targets.map(target => [target, target.getNext(), target.getPrevious()].filter(current => current != player && current.countGainableCards(player, "h"))).flat();
			return targets.reduce((sum, target) => sum + get.effect(target, { name: "shunshou_copy2" }, player, player), 0) > 0;
		},
		async content(event, trigger, player) {
			const { targets, name } = event;
			trigger.set(name, true);
			//game.log(trigger.card, "不可被响应");
			//trigger.directHit.addArray(game.filterPlayer());
			for (const target of targets) {
				const targetsx = [target, target.getNext(), target.getPrevious()].filter(current => current != player && current.countGainableCards(player, "h")).sortBySeat();
				if (targetsx.length) {
					await player.gainMultiple(targetsx);
				}
			}
			trigger.effectCount++;
		},
		init(player, skill) {
			player.addSkill(skill + "_mark");
		},
		onremove(player, skill) {
			player.removeSkill(skill + "_mark");
		},
		ai: {
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (!arg?.card || get.name(arg.card) !== "sha") {
					return;
				}
				const evt = lib.skill.dcjianying.getLastUsed(player);
				return evt?.card && get.is.damageCard(evt.card) && !evt.dcporong;
			},
		},
		subSkill: {
			mark: {
				init(player, skill) {
					const evt = lib.skill.dcjianying.getLastUsed(player);
					if (evt?.card && get.is.damageCard(evt.card) && !evt.dcporong) {
						player.addTip(skill, "破戎 可连击");
					}
				},
				onremove(player, skill) {
					player.removeTip(skill);
				},
				charlotte: true,
				trigger: { player: ["useCard1", "useCardAfter"] },
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					if (event.triggername == "useCard1") {
						if (get.is.damageCard(trigger.card)) {
							player.addTip(event.name, "破戎 可连击");
						} else {
							player.removeTip(event.name);
						}
					} else if (trigger.dcporong) {
						player.removeTip(event.name);
					}
				},
			},
		},
	},
	//庞凤衣
	dcyitong: {
		audio: 2,
		trigger: {
			global: ["phaseBefore", "cardsDiscardAfter"],
			player: "enterGame",
		},
		filter(event, player, name) {
			const suits = player.getStorage("dcyitong");
			if (name === "phaseBefore" || name === "enterGame") {
				return suits.length < 4 && (event.name !== "phase" || game.phaseNumber === 0);
			}
			return suits.some(suit => {
				if (!event.getd?.().some(card => get.suit(card, false) === suit)) {
					return false;
				}
				return (
					game
						.getGlobalHistory("cardMove", evt => {
							if (evt.name !== "cardsDiscard") {
								return false;
							}
							const evtx = evt.getParent();
							if (evtx.name !== "orderingDiscard") {
								return false;
							}
							const evt2 = evtx.relatedEvent || evtx.getParent();
							if (evt2.name != "useCard") {
								return false;
							}
							return evt.getd?.()?.some(card => get.suit(card, false) === suit);
						})
						.indexOf(event) === 0
				);
			});
		},
		forced: true,
		async content(event, trigger, player) {
			const name = event.triggername,
				storage = player.getStorage("dcyitong"),
				suits = lib.suit
					.filter(suit => {
						if (name === "phaseBefore" || name === "enterGame") {
							return !storage.includes(suit);
						}
						if (!storage.includes(suit) || !trigger.getd?.().some(card => get.suit(card, false) === suit)) {
							return false;
						}
						return (
							game
								.getGlobalHistory("everything", evt => {
									if (evt.name !== "cardsDiscard") {
										return false;
									}
									const evtx = evt.getParent();
									if (evtx.name !== "orderingDiscard") {
										return false;
									}
									const evt2 = evtx.relatedEvent || evtx.getParent();
									if (evt2.name != "useCard") {
										return false;
									}
									return evt.getd?.()?.some(card => get.suit(card, false) === suit);
								})
								.indexOf(trigger) === 0
						);
					})
					.reverse();
			if (name === "phaseBefore" || name === "enterGame") {
				const result =
					suits.length > 1
						? await player
								.chooseControl(suits)
								.set("ai", () => {
									return get.event().controls.randomGet();
								})
								.set("prompt", "异瞳：请记录一个花色")
								.forResult()
						: { control: suits[0] };
				const suit = result.control;
				if (suit) {
					player.markAuto("dcyitong", [suit]);
					player.addTip("dcyitong", get.translation("dcyitong") + player.getStorage("dcyitong").reduce((str, suit) => str + get.translation(suit), ""));
				}
			} else {
				let gains = [];
				for (const suitx of suits) {
					for (const suit of lib.suit.slice().reverse()) {
						if (suitx === suit) {
							continue;
						}
						const card = get.cardPile(card => get.suit(card) === suit && !gains.includes(card));
						if (card) {
							gains.push(card);
						}
					}
				}
				if (gains.length) {
					await player.gain(gains, "gain2");
				}
			}
		},
		onremove(player, skill) {
			delete player.storage[skill];
			player.removeTip(skill);
		},
		intro: { content: "已记录$花色" },
	},
	dcpeiniang: {
		audio: 2,
		mod: {
			cardUsable(card) {
				if (card?.storage?.dcpeiniang) {
					return Infinity;
				}
			},
		},
		locked: false,
		enable: "chooseToUse",
		filterCard(card, player) {
			return player.getStorage("dcyitong").includes(get.suit(card));
		},
		viewAs: {
			name: "jiu",
			storage: { dcpeiniang: true },
		},
		prompt() {
			const player = get.player();
			return "将" + player.getStorage("dcyitong").reduce((str, suit) => str + get.translation(suit), "") + "牌当作【酒】使用";
		},
		check(card, player) {
			return 0 + lib.skill.oljiuchi?.check?.(card, player);
		},
		precontent() {
			event.getParent().addCount = false;
		},
		position: "hes",
		group: ["dcpeiniang_dying"],
		subSkill: {
			dying: {
				trigger: {
					global: "dying",
				},
				filter(event, player) {
					return event.player != player;
				},
				direct: true,
				async content(event, trigger, player) {
					await player.chooseToUse({
						prompt: `醅酿：是否对${get.translation(trigger.player)}使用一张酒？`,
						prompt2: `当前体力：${trigger.player.hp}`,
						filterCard(card, player) {
							return get.name(card) == "jiu";
						},
						filterTarget(card, player, target) {
							if (target != _status.event.dying) {
								return false;
							}
							if (!card) {
								return false;
							}
							const info = get.info(card);
							if (!info.singleCard || ui.selected.targets.length == 0) {
								let mod = game.checkMod(card, player, target, "unchanged", "playerEnabled", player);
								if (mod == false) {
									return false;
								}
								mod = game.checkMod(card, player, target, "unchanged", "targetEnabled", target);
								if (mod !== "unchanged") {
									return mod ?? false;
								}
							}
							return true;
						},
						ai1(card) {
							if (typeof card == "string") {
								const info = get.info(card);
								if (info.ai && info.ai.order) {
									if (typeof info.ai.order == "number") {
										return info.ai.order;
									} else if (typeof info.ai.order == "function") {
										return info.ai.order();
									}
								}
							}
							return 1;
						},
						ai2(target) {
							const effect_use = get.effect_use(target);
							if (effect_use <= 0) {
								return effect_use;
							}
							return get.effect(target);
						},
						dying: trigger.player,
					});
				},
			},
		},
		ai: {
			combo: "dcyitong",
		},
	},
};
