import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "releiji" | "shensu" | "xinshensu" | "shensu1_xiahouba" | "shensu1" | "shensu2" | "shensu4" | "jushou" | "moon_jushou" | "liegong" | "kuanggu" | "tianxiang" | "tianxiang2">} */
export const groupSkills = {
	releiji: {
		audio: 2,
		audioname: ["boss_qinglong"],
		trigger: { player: ["useCard", "respond"] },
		filter(event, player) {
			return event.card.name == "shan";
		},
		line: "thunder",
		async cost(event, trigger, player) {
			const next = player.chooseTarget(get.prompt2(event.skill), function (card, player, target) {
				return target != player;
			});
			next.ai = function (target) {
				if (target.hasSkill("hongyan")) {
					return 0;
				}
				return get.damageEffect(target, _status.event.player, _status.event.player, "thunder");
			};
			event.result = await next.forResult();
		},
		async content(event, trigger, player) {
			const [target] = event.targets;
			const next = target.judge(function (card) {
				const suit = get.suit(card);
				if (suit == "spade") {
					return -4;
				}
				if (suit == "club") {
					return -2;
				}
				return 0;
			});
			next.judge2 = function (result) {
				return result.bool == false; // ? true : false; 喵？
			};
			const { suit } = await next.forResult();
			if (suit == "club") {
				await player.recover();
				await target.damage("thunder");
			} else if (suit == "spade") {
				await target.damage(2, "thunder");
			}
		},
		ai: {
			useShan: true,
			effect: {
				target_use(card, player, target, current) {
					if (
						get.tag(card, "respondShan") &&
						!player.hasSkillTag(
							"directHit_ai",
							true,
							{
								target: target,
								card: card,
							},
							true
						)
					) {
						let club = 0,
							spade = 0;
						if (
							game.hasPlayer(function (current) {
								return get.attitude(target, current) < 0 && get.damageEffect(current, target, target, "thunder") > 0;
							})
						) {
							club = 2;
							spade = 4;
						}
						if (!target.isHealthy()) {
							club += 2;
						}
						if (!club && !spade) {
							return 1;
						}
						if (card.name === "sha") {
							if (!target.mayHaveShan(player, "use")) {
								return;
							}
						} else if (!target.mayHaveShan(player)) {
							return 1 - 0.1 * Math.min(5, target.countCards("hs"));
						}
						if (!target.hasSkillTag("rejudge")) {
							return [1, (club + spade) / 4];
						}
						let pos = player.hasSkillTag("viewHandcard", null, target, true) ? "hes" : "e",
							better = club > spade ? "club" : "spade",
							max = 0;
						target.hasCard(function (cardx) {
							if (get.suit(cardx) === better) {
								max = 2;
								return true;
							}
							if (spade && get.color(cardx) === "black") {
								max = 1;
							}
						}, pos);
						if (max === 2) {
							return [1, Math.max(club, spade)];
						}
						if (max === 1) {
							return [1, Math.min(club, spade)];
						}
						if (pos === "e") {
							return [1, Math.min((Math.max(1, target.countCards("hs")) * (club + spade)) / 4, Math.max(club, spade))];
						}
						return [1, (club + spade) / 4];
					}
				},
			},
		},
	},
	shensu: {
		audio: "shensu1",
		audioname: ["xiahouba", "re_xiahouyuan", "ol_xiahouyuan"],
		group: ["shensu1", "shensu2"],
		preHidden: ["shensu1", "shensu2"],
	},
	xinshensu: {
		audio: "shensu1",
		audioname: ["xiahouba", "re_xiahouyuan", "ol_xiahouyuan"],
		group: ["xinshensu_1", "xinshensu_2", "shensu4"],
		preHidden: ["xinshensu_1", "xinshensu_2", "shensu4"],
		subSkill: {
			1: {
				audio: "shensu1",
				inherit: "shensu1",
				sourceSkill: "xinshensu",
			},
			2: {
				inherit: "shensu2",
				sourceSkill: "xinshensu",
			},
		},
	},
	shensu1_xiahouba: { audio: 2 },
	shensu1: {
		audio: 2,
		audioname: ["xiahouba", "re_xiahouyuan", "ol_xiahouyuan"],
		trigger: { player: "phaseJudgeBefore" },
		sourceSkill: "shensu",
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "跳过判定阶段和摸牌阶段，视为对一名其他角色使用一张【杀】", function (card, player, target) {
					if (player == target) {
						return false;
					}
					return player.canUse({ name: "sha" }, target, false);
				})
				.set("check", player.countCards("h") > 2)
				.set("ai", function (target) {
					if (!_status.event.check) {
						return 0;
					}
					return get.effect(target, { name: "sha" }, _status.event.player);
				})
				.setHiddenSkill(event.skill)
				.forResult();
		},
		async content(event, trigger, player) {
			trigger.cancel();
			player.skip("phaseDraw");
			await player.useCard({ name: "sha", isCard: true }, event.targets[0], false);
		},
	},
	shensu2: {
		audio: "shensu1",
		audioname: ["xiahouba", "re_xiahouyuan", "ol_xiahouyuan"],
		trigger: { player: "phaseUseBefore" },
		sourceSkill: "shensu",
		filter(event, player) {
			return (
				player.countCards("he", function (card) {
					if (_status.connectMode) {
						return true;
					}
					return get.type(card) == "equip";
				}) > 0
			);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					prompt: get.prompt(event.skill),
					prompt2: "弃置一张装备牌并跳过出牌阶段，视为对一名其他角色使用一张【杀】",
					filterCard(card, player) {
						return get.type(card) == "equip" && lib.filter.cardDiscardable(card, player);
					},
					position: "he",
					filterTarget(card, player, target) {
						if (player == target) {
							return false;
						}
						return player.canUse({ name: "sha" }, target, false);
					},
					ai1(card) {
						if (_status.event.check) {
							return 0;
						}
						return 6 - get.value(card);
					},
					ai2(target) {
						if (_status.event.check) {
							return 0;
						}
						return get.effect(target, { name: "sha" }, _status.event.player);
					},
					check:
						player.countCards("hs", i => {
							return player.hasValueTarget(i, null, true);
						}) >
						player.hp - 1,
				})
				.setHiddenSkill(event.skill)
				.forResult();
		},
		async content(event, trigger, player) {
			trigger.cancel();
			await player.discard(event.cards[0]);
			await player.useCard({ name: "sha", isCard: true }, event.targets[0], false);
		},
	},
	shensu4: {
		audio: "shensu1",
		audioname: ["xiahouba", "re_xiahouyuan", "ol_xiahouyuan"],
		trigger: { player: "phaseDiscardBefore" },
		sourceSkill: "xinshensu",
		async cost(event, trigger, player) {
			const check = player.needsToDiscard() || player.isTurnedOver() || (player.hasSkill("shebian") && player.canMoveCard(true, true));
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "跳过弃牌阶段并将武将牌翻面，视为对一名其他角色使用一张【杀】", function (card, player, target) {
					if (player == target) {
						return false;
					}
					return player.canUse({ name: "sha" }, target, false);
				})
				.set("check", check)
				.set("ai", function (target) {
					if (!_status.event.check) {
						return 0;
					}
					return get.effect(target, { name: "sha" }, _status.event.player, _status.event.player);
				})
				.setHiddenSkill(event.skill)
				.forResult();
		},
		async content(event, trigger, player) {
			trigger.cancel();
			await player.turnOver();
			await player.useCard({ name: "sha", isCard: true }, event.targets[0], false);
		},
	},
	jushou: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		check(event, player) {
			return event.player.hp + player.countCards("h") < 4;
		},
		async content(event, trigger, player) {
			await player.draw(3);
			await player.turnOver();
		},
	},
	moon_jushou: {
		audio: "xinjushou",
		trigger: { player: "phaseJieshuBegin" },
		check(event, player) {
			return event.player.hp + player.countCards("h") < 4;
		},
		async content(event, trigger, player) {
			await player.draw();
			await player.turnOver();
		},
	},
	liegong: {
		audio: 2,
		audioname: ["re_huangzhong"],
		trigger: { player: "useCardToPlayered" },
		check(event, player) {
			return get.attitude(player, event.target) <= 0;
		},
		logTarget: "target",
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			const length = event.target.countCards("h");
			return length >= player.hp || length <= player.getAttackRange();
		},
		preHidden: true,
		async content(event, trigger, player) {
			trigger.getParent().directHit.push(trigger.target);
		},
		locked: false,
		mod: {
			attackRange(player, distance) {
				if (get.zhu(player, "shouyue")) {
					return distance + 1;
				}
			},
		},
		ai: {
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (get.attitude(player, arg.target) > 0 || arg.card.name != "sha") {
					return false;
				}
				const length = arg.target.countCards("h");
				return length >= player.hp || length <= player.getAttackRange();
			},
		},
	},
	kuanggu: {
		audio: 2,
		audioname: ["re_weiyan", "ol_weiyan"],
		trigger: { source: "damageSource" },
		forced: true,
		filter(event, player) {
			return event.checkKuanggu && player.isDamaged();
		},
		async content(event, trigger, player) {
			await player.recover(trigger.num);
		},
	},
	tianxiang: {
		audio: 2,
		audioname: ["daxiaoqiao", "re_xiaoqiao", "ol_xiaoqiao"],
		trigger: { player: "damageBegin3" },
		filter(event, player) {
			return player.countCards("h", { suit: "heart" }) > 0 && event.num > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					filterCard(card, player) {
						return get.suit(card) == "heart" && lib.filter.cardDiscardable(card, player);
					},
					filterTarget(card, player, target) {
						return player != target;
					},
					ai1(card) {
						return 10 - get.value(card);
					},
					ai2(target) {
						const att = get.attitude(_status.event.player, target);
						const trigger = _status.event.getTrigger();
						let da = 0;
						if (_status.event.player.hp == 1) {
							da = 10;
						}
						if (trigger.num > 1) {
							if (target.maxHp > 5 && target.hp > 1) {
								return -att / 10 + da;
							}
							return -att + da;
						}
						const eff = get.damageEffect(target, trigger.source, target, trigger.nature);
						if (att == 0) {
							return 0.1 + da;
						}
						if (eff >= 0 && trigger.num == 1) {
							return att + da;
						}
						if (target.hp == target.maxHp) {
							return -att + da;
						}
						if (target.hp == 1) {
							if (target.maxHp <= 4 && !target.hasSkillTag("maixie")) {
								if (target.maxHp <= 3) {
									return -att + da;
								}
								return -att / 2 + da;
							}
							return da;
						}
						if (target.hp == target.maxHp - 1) {
							if (target.hp > 2 || target.hasSkillTag("maixie")) {
								return att / 5 + da;
							}
							if (att > 0) {
								return 0.02 + da;
							}
							return 0.05 + da;
						}
						return att / 2 + da;
					},
					prompt: get.prompt2(event.skill),
				})
				.forResult();
		},
		async content(event, trigger, player) {
			trigger.player = event.targets[0];
			trigger.player.addSkill("tianxiang2");
			await player.discard(event.cards[0]);
		},
		ai: {
			maixie_defend: true,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return;
					}
					if (get.tag(card, "damage") && target.countCards("h") > 1) {
						return 0.7;
					}
				},
			},
			threaten(player, target) {
				if (target.countCards("h") == 0) {
					return 2;
				}
			},
		},
	},
	tianxiang2: {
		trigger: { player: ["damageAfter", "damageCancelled", "damageZero"] },
		forced: true,
		popup: false,
		audio: false,
		vanish: true,
		charlotte: true,
		sourceSkill: "tianxiang",
		async content(event, trigger, player) {
			player.removeSkill("tianxiang2");
			player.popup("tianxiang");
			if (player.getDamagedHp()) {
				await player.draw(player.getDamagedHp());
			}
		},
	},
};
