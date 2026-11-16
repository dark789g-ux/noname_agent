import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "stdduanbing" | "stdfenxun" | "stdzenhui" | "stdchuyi" | "stdfenyin" | "stdzaoli" | "stdyirang" | "stdshuangdao" | "stdjuece" | "stdmieji">} */
export const groupSkills = {
	//丁奉
	stdduanbing: {
		audio: "duanbing",
		forced: true,
		trigger: { source: "damageBegin1" },
		filter(event, player) {
			if (player.hasHistory("sourceDamage", evt => evt?.card?.name == "sha")) {
				return false;
			}
			return event?.card?.name == "sha";
		},
		logTarget: "player",
		async content(event, trigger, player) {
			trigger.num++;
		},
		group: "stdduanbing_forced",
		subSkill: {
			forced: {
				priority: Infinity,
				mod: {
					attackRange: () => 1,
				},
			},
		},
	},
	stdfenxun: {
		audio: "fenxun",
		enable: "phaseUse",
		usable: 1,
		filterCard(card, player) {
			return get.subtype(card) == "equip2";
		},
		filterTarget: lib.filter.notMe,
		async content(event, trigger, player) {
			player.markAuto("stdfenxun_effect", [event.target]);
			player.addTempSkill("stdfenxun_effect");
		},
		check(card) {
			return 6 - get.value(card);
		},
		ai: {
			order: 4,
			result: {
				player(player, target) {
					if (player.inRange(target)) {
						return 0;
					}
					var hs = player.getCards("h", "shunshou");
					if (hs.length && player.canUse(hs[0], target, false)) {
						return 1;
					}
					var geteff = function (current) {
						return player.canUse("sha", current, false, true) && get.effect(current, { name: "sha" }, player, player) > 0;
					};
					if (player.hasSha() && geteff(target)) {
						var num = game.countPlayer(function (current) {
							return current != player && player.inRange(target) && geteff(current);
						});
						if (num == 0) {
							if (
								game.hasPlayer(function (current) {
									return player.canUse("sha", current) && geteff(current) && current != target;
								})
							) {
								return 1;
							}
						} else if (num == 1) {
							return 1;
						}
					}
					return 0;
				},
			},
		},
		subSkill: {
			effect: {
				mark: "character",
				onremove: true,
				intro: {
					content: "$视为在你攻击范围内",
				},
				mod: {
					inRange(from, to) {
						if (from.getStorage("stdfenxun_effect").includes(to)) {
							return true;
						}
					},
				},
			},
		},
	},
	//孙鲁班
	stdzenhui: {
		audio: "rechanhui",
		trigger: { player: "useCard2" },
		filter(event, player) {
			if (!event.targets?.length) {
				return false;
			}
			const card = event.card;
			if (card.name != "sha" && get.type2(card) != "trick") {
				return false;
			}
			return game.hasPlayer(current => {
				return current != player && !event.targets.includes(current);
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					if (player == target) {
						return false;
					}
					const evt = _status.event.getTrigger();
					return !evt.targets.includes(target);
				})
				.set("ai", target => {
					const trigger = _status.event.getTrigger(),
						player = _status.event.player;
					let eff = 0;
					for (let current of trigger.targets) {
						eff += get.effect(current, trigger.card, target, player);
					}
					return eff > get.event().original;
				})
				.set(
					"original",
					(function () {
						let eff = 0;
						for (let cur of trigger.targets) {
							eff += get.effect(cur, trigger.card, player, player);
						}
						return eff;
					})()
				)
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			trigger.player = target;
			game.log(target, "成为了", trigger.card, "的使用者");
		},
	},
	stdchuyi: {
		audio: "xinzenhui",
		trigger: {
			global: "damageBegin1",
		},
		round: 1,
		filter(event, player) {
			if (!event.source || !event.source.isIn() || event.source == player) {
				return false;
			}
			return player.inRange(event.player);
		},
		check(event, player) {
			return get.attitude(player, event.player) <= 0 && get.damageEffect(event.player, event.source, player, event.nature) > 0;
		},
		async content(event, trigger, player) {
			trigger.num++;
		},
	},
	//留赞
	stdfenyin: {
		audio: "fenyin",
		trigger: { player: "phaseDrawBegin2" },
		filter(event, player) {
			return !event.numFixed;
		},
		async content(event, trigger, player) {
			trigger.num += 2;
			player.addTempSkill("stdfenyin_discard");
		},
		subSkill: {
			discard: {
				mod: {
					aiOrder(player, card, num) {
						if (typeof card == "object" && player == _status.currentPhase) {
							var evt = player.getLastUsed();
							if (
								evt &&
								evt.card &&
								get.color(evt.card) != "none" &&
								get.color(card) != "none" &&
								get.color(evt.card) != get.color(card)
							) {
								return num + 10;
							}
						}
					},
				},
				audio: "stdfenyin",
				trigger: { player: "useCard" },
				charlotte: true,
				forced: true,
				filter(event, player) {
					if (!player.countCards("he")) {
						return false;
					}
					if (_status.currentPhase != player) {
						return false;
					}
					var color2 = get.color(event.card);
					var evt = player.getLastUsed(1);
					if (!evt) {
						return false;
					}
					var color1 = get.color(evt.card);
					return color1 && color2 && color1 != "none" && color2 != "none" && color1 == color2;
				},
				async content(event, trigger, player) {
					await player.chooseToDiscard("he", true);
				},
			},
		},
	},
	//孙翊
	stdzaoli: {
		audio: "zaoli",
		locked: true,
		trigger: {
			player: "phaseZhunbeiBegin",
		},
		filter(event, player) {
			return player.countCards("he");
		},
		async cost(event, trigger, player) {
			let list = [];
			if (player.countCards("h")) {
				list.push("手牌");
			}
			if (player.countCards("e")) {
				list.push("装备区");
			}
			let choice = list[0];
			if (list.length > 1) {
				const { control } = await player
					.chooseControl(list)
					.set("prompt", "躁厉：选择弃置的区域")
					.set("ai", () => ["手牌", "装备区"].randomGet())
					.forResult();
				if (control) {
					choice = control;
				}
			}
			event.result = {
				bool: true,
				cost_data: choice == "手牌" ? "h" : "e",
			};
		},
		async content(event, trigger, player) {
			const pos = event.cost_data;
			let num = player.countCards(pos);
			await player.chooseToDiscard(pos, num, true);
			num += player.getDamagedHp();
			await player.draw(num);
			await player.loseHp();
		},
	},
	//陶谦
	stdyirang: {
		audio: "yirang",
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return player.countCards("h");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					if (target == player) {
						return false;
					}
					return !game.hasPlayer(current => {
						return current != player && current.countCards("h") < target.countCards("h");
					});
				})
				.set("ai", function (target) {
					return get.attitude(_status.event.player, target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const cards = player.getCards("h"),
				target = event.targets[0];
			let types = [];
			for (let i = 0; i < cards.length; i++) {
				types.add(get.type(cards[i], "trick"));
			}
			await player.give(cards, target);
			await player.draw(types.length);
		},
	},
	//纪灵
	stdshuangdao: {
		audio: "shuangren",
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return (
				player.countCards("h") > 0 &&
				game.hasPlayer(function (current) {
					return current != player && player.canCompare(current);
				})
			);
		},
		async cost(event, trigger, player) {
			let goon;
			if (player.needsToDiscard() > 1) {
				goon = player.hasCard(function (card) {
					return card.number > 10 && get.value(card) <= 5;
				});
			} else {
				goon = player.hasCard(function (card) {
					return (card.number >= 9 && get.value(card) <= 5) || get.value(card) <= 3;
				});
			}
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), function (card, player, target) {
					return player.canCompare(target);
				})
				.set("ai", function (target) {
					var player = _status.event.player;
					if (_status.event.goon && get.attitude(player, target) < 0) {
						return get.effect(target, { name: "sha" }, player, player);
					}
					return 0;
				})
				.set("goon", goon)
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			const result = await player.chooseToCompare(target).forResult();
			if (result.bool) {
				if (
					game.hasPlayer(function (current) {
						if (!player.canUse("sha", current, false)) {
							return false;
						}
						return get.distance(target, current) <= 1;
					})
				) {
					const result2 = await player
						.chooseTarget("是否对至多两名与其距离为1的角色各使用一张杀？", [1, 2], function (card, player, target) {
							if (!player.canUse("sha", target, false)) {
								return false;
							}
							return get.distance(get.event().identity, target) <= 1;
						})
						.set("ai", function (target) {
							let player = _status.event.player;
							return get.effect(target, { name: "sha" }, player, player);
						})
						.set("identity", target)
						.forResult();
					if (result2.bool) {
						for (let targetx of result2.targets) {
							await player.useCard({ name: "sha", isCard: true }, targetx, false);
						}
					}
				} else {
					return;
				}
			} else {
				player.addTempSkill("rexianzhen3");
			}
		},
	},
	//李儒
	stdjuece: {
		audio: "rejuece",
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return game.hasPlayer(current => {
				let num = 0;
				current.getHistory("lose", evt => {
					if (evt.cards2?.length > 0) {
						num += evt.cards2.length;
					}
				});
				return num > 1;
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "对一名本回合失去过至少两张牌的角色造成1点伤害", function (card, player, target) {
					return _status.event.targets.includes(target);
				})
				.set(
					"targets",
					game.filterPlayer(current => {
						let num = 0;
						current.getHistory("lose", evt => {
							if (evt.cards2?.length > 0) {
								num += evt.cards2.length;
							}
						});
						return num > 1;
					})
				)
				.set("ai", target => {
					var player = _status.event.player;
					return get.damageEffect(target, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await target.damage();
		},
	},
	stdmieji: {
		audio: "remieji",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h", { type: ["trick", "delay"], color: "black" });
		},
		filterCard(card) {
			return get.color(card) == "black" && get.type(card, "trick") == "trick";
		},
		filterTarget(card, player, target) {
			return target != player;
		},
		discard: false,
		delay: false,
		check(card) {
			return 8 - get.value(card);
		},
		lose: false,
		async content(event, trigger, player) {
			await player.give(event.cards, event.target);
			await player.discardPlayerCard(event.target, "he", [1, 2]);
		},
		ai: {
			order: 9,
			result: {
				target: -1,
			},
		},
	},
};
