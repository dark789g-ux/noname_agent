import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcmoyu" | "oldmoyu" | "dcjizhong" | "dcrihui" | "dcguangshi">} */
export const groupSkills = {
	//裴元绍
	dcmoyu: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(current => lib.skill.dcmoyu.filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			return player != target && !player.getStorage("dcmoyu_clear").includes(target) && target.countGainableCards(player, "hej");
		},
		async content(event, trigger, player) {
			const target = event.target;
			player.addTempSkill("dcmoyu_clear", "phaseUseAfter");
			player.markAuto("dcmoyu_clear", [target]);
			await player.gainPlayerCard(target, "hej", true, 1 + player.hasSkill("dcmoyu_add"));
			player.removeSkill("dcmoyu_add");
			const num = player.getStorage("dcmoyu_clear").length;
			const result = await target
				.chooseToUse(
					function (card, player, event) {
						if (get.name(card) != "sha") {
							return false;
						}
						return lib.filter.filterCard.apply(this, arguments);
					},
					"是否对" + get.translation(player) + "使用一张无距离限制的【杀】？"
				)
				.set("targetRequired", true)
				.set("complexTarget", true)
				.set("complexSelect", true)
				.set("filterTarget", function (card, player, target) {
					if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
						return false;
					}
					return lib.filter.targetEnabled.apply(this, arguments);
				})
				.set("sourcex", player)
				.forResult();
			if (result.bool) {
				if (
					player.hasHistory("damage", evt => {
						return evt.card && evt.card.name == "sha" && evt.getParent(4) == event;
					})
				) {
					player.tempBanSkill("dcmoyu");
					player.addTempSkill("dcmoyu_ban");
				} else {
					player.addTempSkill("dcmoyu_add", "phaseChange");
				}
			}
		},
		global: "dcmoyu_ai",
		subSkill: {
			clear: {
				charlotte: true,
				onremove: true,
			},
			ban: {
				charlotte: true,
				mark: true,
				marktext: '<span style="text-decoration: line-through;">欲</span>',
				intro: { content: "偷马贼被反打了！" },
			},
			add: {
				charlotte: true,
				mark: true,
				marktext: "欲",
				intro: { content: "欲望加速，下次抢两张！" },
			},
			ai: {
				ai: {
					effect: {
						target(card, player, target, current) {
							if (get.type(card) == "delay" && current < 0) {
								var currentx = _status.currentPhase;
								if (!currentx || !currentx.isIn()) {
									return;
								}
								var list = game.filterPlayer(current => {
									if (current == target) {
										return true;
									}
									if (!current.hasSkill("dcmoyu")) {
										return false;
									}
									if (current.hasJudge("lebu")) {
										return false;
									}
									return get.attitude(current, target) > 0;
								});
								list.sortBySeat(currentx);
								if (list.indexOf(target) != 0) {
									return "zerotarget";
								}
							}
						},
					},
				},
			},
		},
		ai: {
			order: 9,
			threaten: 2.4,
			result: {
				target(player, target) {
					var num = get.sgn(get.attitude(player, target));
					var eff = get.effect(target, { name: "shunshou" }, player, player) * num;
					if (eff * num > 0) {
						return eff / 10;
					}
					if (
						player.hasShan() &&
						!target.hasSkillTag(
							"directHit_ai",
							true,
							{
								target: player,
								card: { name: "sha" },
							},
							true
						)
					) {
						return eff;
					}
					if (
						target.hasSha() &&
						player.hp +
							player.countCards("hs", function (card) {
								var mod2 = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
								if (mod2 != "unchanged") {
									return mod2;
								}
								var mod = game.checkMod(card, player, player, "unchanged", "cardSavable", player);
								if (mod != "unchanged") {
									return mod;
								}
								var savable = get.info(card).savable;
								if (typeof savable == "function") {
									savable = savable(card, player, player);
								}
								return savable;
							}) <=
							1
					) {
						return 0;
					}
					return eff;
				},
			},
		},
	},
	oldmoyu: {
		audio: "dcmoyu",
		init: () => {
			game.addGlobalSkill("oldmoyu_ai");
		},
		onremove: () => {
			if (!game.hasPlayer(i => i.hasSkill("oldmoyu", null, null, false), true)) {
				game.removeGlobalSkill("oldmoyu_ai");
			}
		},
		enable: "phaseUse",
		filter(event, player) {
			return !player.hasSkill("oldmoyu_ban") && game.hasPlayer(current => lib.skill.oldmoyu.filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			return player != target && !player.getStorage("oldmoyu_clear").includes(target) && target.countGainableCards(player, "hej");
		},
		async content(event, trigger, player) {
			let result;
			const { target } = event;

			// step 0
			player.addTempSkill("oldmoyu_clear");
			player.markAuto("oldmoyu_clear", [target]);
			result = await player.gainPlayerCard(target, "hej", true).forResult();
			// step 1
			const num = player.getStorage("oldmoyu_clear").length;
			result = await target
				.chooseToUse(
					function (card, player, event) {
						if (get.name(card) != "sha") {
							return false;
						}
						return lib.filter.filterCard.apply(this, arguments);
					},
					"是否对" + get.translation(player) + "使用一张无距离限制的【杀】（伤害基数为" + num + "）？"
				)
				.set("targetRequired", true)
				.set("complexTarget", true)
				.set("complexSelect", true)
				.set("filterTarget", function (card, player, target) {
					if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
						return false;
					}
					return lib.filter.targetEnabled.apply(this, arguments);
				})
				.set("sourcex", player)
				.set("num", num)
				.set("oncard", card => {
					_status.event.baseDamage = _status.event.getParent().num;
				})
				.forResult();
			// step 2
			if (result.bool) {
				if (
					player.hasHistory("damage", evt => {
						return evt.card && evt.card.name == "sha" && evt.getParent(4) == event;
					})
				) {
					player.addTempSkill("oldmoyu_ban");
				}
			}
		},
		subSkill: {
			clear: {
				charlotte: true,
				onremove: true,
			},
			ban: {
				charlotte: true,
				mark: true,
				marktext: "欲",
				intro: { content: "偷马贼被反打了！" },
			},
			ai: {
				trigger: { player: "dieAfter" },
				filter: () => {
					return !game.hasPlayer(i => i.hasSkill("oldmoyu", null, null, false), true);
				},
				silent: true,
				forceDie: true,
				content: () => {
					game.removeGlobalSkill("oldmoyu_ai");
				},
				ai: {
					effect: {
						target(card, player, target, current) {
							if (get.type(card) == "delay" && current < 0) {
								var currentx = _status.currentPhase;
								if (!currentx || !currentx.isIn()) {
									return;
								}
								var list = game.filterPlayer(current => {
									if (current == target) {
										return true;
									}
									if (!current.hasSkill("oldmoyu")) {
										return false;
									}
									if (current.hasJudge("lebu")) {
										return false;
									}
									return get.attitude(current, target) > 0;
								});
								list.sortBySeat(currentx);
								if (list.indexOf(target) != 0) {
									return "zerotarget";
								}
							}
						},
					},
				},
			},
		},
		ai: {
			order: 9,
			threaten: 2.4,
			result: {
				target(player, target) {
					var num = get.sgn(get.attitude(player, target));
					var eff = get.effect(target, { name: "shunshou" }, player, player) * num;
					if (eff * num > 0) {
						return eff / 10;
					}
					if (
						player.hasShan() &&
						!target.hasSkillTag(
							"directHit_ai",
							true,
							{
								target: player,
								card: { name: "sha" },
							},
							true
						)
					) {
						return eff;
					}
					if (
						target.hasSha() &&
						player.hp +
							player.countCards("hs", function (card) {
								var mod2 = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
								if (mod2 != "unchanged") {
									return mod2;
								}
								var mod = game.checkMod(card, player, player, "unchanged", "cardSavable", player);
								if (mod != "unchanged") {
									return mod;
								}
								var savable = get.info(card).savable;
								if (typeof savable == "function") {
									savable = savable(card, player, player);
								}
								return savable;
							}) <=
							player.getStorage("oldmoyu_clear").length + 1
					) {
						return 0;
					}
					return eff;
				},
			},
		},
	},
	//张楚
	dcjizhong: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget: lib.filter.notMe,
		selectTarget: 1,
		async content(event, trigger, player) {
			const target = event.target;
			await target.draw(2);
			if (!target.hasMark("dcjizhong")) {
				const result = await target
					.chooseBool(`集众：令${get.translation(player)}获得你三张牌，或点击“取消”获得“信众”标记`)
					.set("ai", () => false)
					.forResult();
				if (!result.bool) {
					target.addMark("dcjizhong", 1);
					return;
				}
			}
			let num = Math.min(target.countCards("he"), 3);
			if (num > 0) {
				await player.gainPlayerCard(target, "he", num, true);
			}
		},
		marktext: "信",
		intro: {
			name: "信众",
			name2: "信众",
			markcount: () => 0,
			content: "已成为信徒",
		},
		ai: {
			order: 9.5,
			result: {
				target(player, target) {
					var num = target.countCards("h");
					if (num <= 1) {
						return -num;
					}
					if (get.attitude(player, target) > 0 && !target.hasMark("dcjizhong")) {
						return 1;
					}
					return -1 / (num / 2 + 1);
				},
			},
		},
	},
	dcrihui: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		usable: 1,
		filter(event, player) {
			if (!event.targets || event.targets.length != 1 || event.targets[0] == player) {
				return false;
			}
			const card = event.card;
			const target = event.targets[0];
			const marked = target.hasMark("dcjizhong");
			return (get.type(card) == "trick" || (get.color(card) == "black" && get.type(card) == "basic")) && ((marked && target.countGainableCards(player, "hej")) || (!marked && game.hasPlayer(current => current.hasMark("dcjizhong"))));
		},
		logTarget: event => event.targets[0],
		prompt2(event, player) {
			const target = event.targets[0];
			if (target.hasMark("dcjizhong")) {
				return "获得该角色区域内的一张牌";
			} else {
				const targets = game.filterPlayer(current => current.hasMark("dcjizhong"));
				const card = { name: event.card.name, nature: event.card.nature, isCard: true };
				return `令所有有“信众”的角色（${get.translation(targets)}）依次视为对其使用一张${get.translation(card)}`;
			}
		},
		check(event, player) {
			const target = event.targets[0];
			if (target.hasMark("dcjizhong")) {
				return get.effect(target, { name: "shunshou_copy" }, player, player) > 0;
			} else {
				const card = { name: event.card.name, nature: event.card.nature, isCard: true };
				let eff = 0;
				game.countPlayer(current => {
					if (!current.hasMark("dcjizhong") || !current.canUse(card, player, false)) {
						return;
					}
					eff += get.effect(target, card, current, player);
				});
				return eff > 0;
			}
		},
		async content(event, trigger, player) {
			const target = trigger.targets[0];
			if (target.hasMark("dcjizhong")) {
				await player.gainPlayerCard(target, "hej", true);
			} else {
				const card = { name: trigger.card.name, nature: trigger.card.nature, isCard: true };
				const targets = game.filterPlayer(current => current.hasMark("dcjizhong")).sortBySeat(_status.currentPhase);
				for (const current of targets) {
					if (target.isIn() && current.isIn() && current.canUse(card, target, false)) {
						await current.useCard(card, target, false);
					}
				}
			}
		},
		ai: { combo: "dcjizhong" },
	},
	dcguangshi: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return !game.hasPlayer(current => current != player && !current.hasMark("dcjizhong"));
		},
		forced: true,
		async content(event, trigger, player) {
			await player.draw(game.filterPlayer().reduce((sum, current) => sum + current.countMark("dcjizhong"), 0));
			await player.loseHp();
		},
		ai: {
			combo: "dcjizhong",
			halfneg: true,
		},
	},
};
