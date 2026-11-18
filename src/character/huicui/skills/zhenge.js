import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zhenge" | "xinghan" | "refenglve" | "anyong" | "zhuning" | "fengxiang">} */
export const groupSkills = {
	//万年公主
	zhenge: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		direct: true,
		async content(event, trigger, player) {
			const targetResult = await player
				.chooseTarget(get.prompt("zhenge"), "令一名角色的攻击范围+1")
				.set("ai", function (target) {
					var player = _status.event.player,
						att = get.attitude(player, target);
					if (att > 0) {
						if (!target.hasMark("zhenge_effect")) {
							att *= 1.5;
						}
						if (
							!game.hasPlayer(function (current) {
								return get.distance(target, current, "attack") > 2;
							})
						) {
							const usf = Math.max(
								...game.filterPlayer().map(current => {
									if (target.canUse("sha", current, false)) {
										return get.effect(current, { name: "sha" }, target, player);
									}
									return 0;
								})
							);
							return att + usf;
						}
						return att;
					}
					return 0;
				})
				.forResult();
			if (!targetResult.bool) return;
			const target = targetResult.targets[0];
			player.logSkill("zhenge", target);
			target.addSkill("zhenge_effect");
			if (target.countMark("zhenge_effect") < 5) {
				target.addMark("zhenge_effect", 1, false);
			}
			if (
				!game.hasPlayer(current => {
					return current != target && !target.inRange(current);
				})
			) {
				const shaTargetResult = await player
					.chooseTarget("是否令" + get.translation(target) + "视为对另一名角色使用【杀】？", function (card, player, target) {
						return _status.event.source.canUse("sha", target);
					})
					.set("source", target)
					.set("ai", function (target) {
						var evt = _status.event;
						return get.effect(target, { name: "sha" }, evt.source, evt.player);
					})
					.forResult();
				if (shaTargetResult.bool) {
					await target.useCard({ name: "sha", isCard: true }, shaTargetResult.targets[0], false);
				}
				await game.delayx();
				return;
			}
			await game.delayx();
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				mod: {
					attackRange(player, num) {
						return num + player.countMark("zhenge_effect");
					},
				},
				intro: { content: "攻击范围+#" },
			},
		},
	},
	xinghan: {
		audio: 2,
		init(player) {
			player.addSkill("xinghan_count");
		},
		onremove(player) {
			player.removeSkill("xinghan_count");
		},
		trigger: { global: "damageSource" },
		forced: true,
		filter(event, player) {
			return event.card && event.card == player.storage.xinghan_temp && event.source && event.source.hasMark("zhenge_effect");
		},
		logTarget: "source",
		async content(event, trigger, player) {
			player.draw(player.isMaxHandcard(true) ? 1 : Math.min(5, trigger.source.getAttackRange()));
		},
		subSkill: {
			count: {
				trigger: { global: "useCard1" },
				forced: true,
				charlotte: true,
				popup: false,
				firstDo: true,
				filter(event, player) {
					return (
						event.card.name == "sha" &&
						!game.hasPlayer2(function (current) {
							return current.hasHistory("useCard", function (evt) {
								return evt != event && evt.card.name == "sha";
							});
						})
					);
				},
				async content(event, trigger, player) {
					player.addTempSkill("xinghan_temp");
					player.storage.xinghan_temp = trigger.card;
				},
			},
			temp: { onremove: true },
		},
		ai: { combo: "zhenge" },
	},
	//荀谌
	refenglve: {
		audio: 2,
		enable: "phaseUse",
		usable(skill, player) {
			return 1 + player.countMark("refenglve_add");
		},
		filter(event, player) {
			return (
				player.countCards("h") > 0 &&
				!player.hasSkillTag("noCompareSource") &&
				game.hasPlayer(function (current) {
					return current != player && current.countCards("h") > 0 && !current.hasSkillTag("noCompareTarget");
				})
			);
		},
		filterTarget(card, player, target) {
			return target != player && target.countCards("h") > 0 && !target.hasSkillTag("noCompareTarget");
		},
		async content(event, trigger, player) {
			const { target } = event;
			let result;

			// step 0
			result = await player.chooseToCompare(target).forResult();
			// step 1
			if (result.bool) {
				if (!target.countCards("hej")) {
					return;
				} else {
					await player.gainPlayerCard(target, true, "hej", 2, "获得" + get.translation(target) + "区域里的两张牌");
				}
			} else if (result.tie) {
				player.addTempSkill(event.name + "_add", "phaseUseAfter");
				player.addMark(event.name + "_add", 1, false);
				if (get.position(result.player, true) == "d") {
					await player.gain(result.player, "gain2");
				}
			} else {
				if (get.position(result.player, true) == "d") {
					await target.gain(result.player, "gain2");
				}
			}
		},
		ai: {
			order: 8,
			result: {
				target(player, target) {
					if (
						!player.hasCard(function (card) {
							if (get.position(card) != "h") {
								return false;
							}
							var val = get.value(card);
							if (val < 0) {
								return true;
							}
							if (val <= 5) {
								return card.number >= 11;
							}
							if (val <= 6) {
								return card.number >= 13;
							}
							return false;
						})
					) {
						return 0;
					}
					return -Math.sqrt(1 + target.countCards("he")) / (1 + target.countCards("j"));
				},
			},
		},
		subSkill: {
			add: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	anyong: {
		audio: 2,
		trigger: { global: "damageSource" },
		direct: true,
		filter(event, player) {
			return (
				event.source &&
				event.source == _status.currentPhase &&
				event.num == 1 &&
				// event.player != event.source &&
				event.player.isIn() &&
				player.countCards("he") > 0 &&
				event.source
					.getHistory("sourceDamage", function (evt) {
						return evt.player != event.source;
					})
					.indexOf(event) == 0
			);
		},
		async content(event, trigger, player) {
			const result = await player
				.chooseToDiscard("he", get.prompt("anyong", trigger.player), "弃置一张牌并对其造成1点伤害")
				.set("goon", get.damageEffect(trigger.player, player, player) > 0)
				.set("ai", function (card) {
					if (_status.event.goon) {
						return 7 - get.value(card);
					}
					return 0;
				})
				.set("logSkill", ["anyong", trigger.player])
				.forResult();
			if (result.bool) {
				await trigger.player.damage();
			}
		},
	},
	//刘永
	zhuning: {
		audio: 2,
		enable: "phaseUse",
		usable(skill, player) {
			return 1 + (player.hasSkill(skill + "_rewrite", null, null, false) ? 1 : 0);
		},
		filter(event, player) {
			return player.countCards("he") && game.hasPlayer(current => player != current);
		},
		filterCard: true,
		position: "he",
		filterTarget: lib.filter.notMe,
		selectCard: [1, Infinity],
		delay: false,
		lose: false,
		discard: false,
		allowChooseAll: true,
		check(card) {
			if (ui.selected.cards.length && ui.selected.cards[0].name == "du") {
				return 0;
			}
			if (!ui.selected.cards.length && card.name == "du") {
				return 20;
			}
			var player = get.owner(card);
			if (ui.selected.cards.length >= Math.max(1, player.countCards("h") - player.hp)) {
				return 0;
			}
			return 10 - get.value(card);
		},
		async content(event, trigger, player) {
			const { cards, target } = event;
			const next = player.give(cards, target);
			next.gaintag.add("fengxiang_tag");
			await next;
			const list = get.inpileVCardList(info => {
				const card = { name: info[2], nature: info[3], isCard: true };
				if (!["basic", "trick"].includes(get.type(info[2])) || !get.tag(card, "damage")) {
					return false;
				}
				return player.hasUseTarget(card);
			});
			if (!list.length) {
				return;
			}
			const result = await player
				.chooseButton(["是否视为使用一张伤害牌？", [list, "vcard"]])
				.set("ai", button => {
					return get.player().getUseValue({ name: button.link[2], nature: button.link[3] });
				})
				.forResult();
			if (!result?.links?.length) {
				return;
			}
			await player.chooseUseTarget({ name: result.links[0][2], nature: result.links[0][3], isCard: true }, true, false);
			if (
				!player.hasHistory("sourceDamage", evt => {
					if (!evt.card) {
						return false;
					}
					const evtx = evt.getParent("useCard");
					return evtx.card == evt.card && evtx.getParent(2) == event;
				})
			) {
				player.addTempSkill(event.name + "_rewrite", "phaseUseEnd");
			}
		},
		subSkill: { rewrite: { charlotte: true } },
		ai: {
			fireAttack: true,
			order: 4,
			result: {
				target(player, target) {
					if (target.hasSkillTag("nogain")) {
						return 0;
					}
					if (ui.selected.cards.length && ui.selected.cards[0].name == "du") {
						if (target.hasSkillTag("nodu")) {
							return 0;
						}
						return -10;
					}
					if (target.hasJudge("lebu")) {
						return 0;
					}
					var nh = target.countCards("h");
					var np = player.countCards("h");
					if (player.hp == player.maxHp || player.countCards("h") <= 1) {
						if (nh >= np - 1 && np <= player.hp && !target.hasSkill("haoshi")) {
							return 0;
						}
					}
					return Math.max(1, 5 - nh);
				},
			},
		},
	},
	fengxiang: {
		getMax(event) {
			var max = 0,
				max2 = null,
				players = game.filterPlayer();
			for (var current of players) {
				var num = 0,
					cards = current.getCards("h", function (card) {
						return card.hasGaintag("fengxiang_tag");
					});
				if (event) {
					if (event.name == "gain" && event.gaintag.includes("fengxiang_tag")) {
						cards.removeArray(event.cards);
					}
					var evt = event.getl(current);
					if (evt && evt.gaintag_map) {
						for (var i in evt.gaintag_map) {
							if (evt.gaintag_map[i].includes("fengxiang_tag")) {
								num++;
							}
						}
					}
				}
				num += cards.length;
				if (num > max) {
					max = num;
					max2 = current;
				} else if (num == max) {
					max2 = null;
				}
			}
			return max2;
		},
		audio: 2,
		init(player) {
			game.addGlobalSkill("fengxiang_use");
		},
		onremove(player) {
			if (!game.hasPlayer(current => current.hasSkill("fengxiang", null, null, false), true)) {
				game.removeGlobalSkill("fengxiang_use");
			}
		},
		trigger: { player: "damageEnd" },
		forced: true,
		filter(event, player) {
			var target = lib.skill.fengxiang.getMax();
			return !target || target.isDamaged();
		},
		logTarget(event, player) {
			return lib.skill.fengxiang.getMax() || player;
		},
		async content(event, trigger, player) {
			var target = lib.skill.fengxiang.getMax();
			if (target) {
				target.recover();
			} else {
				player.draw();
			}
		},
		group: "fengxiang_draw",
		subSkill: {
			draw: {
				audio: "fengxiang",
				trigger: {
					global: ["equipAfter", "addJudgeAfter", "loseAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				forced: true,
				filter(event, player) {
					if (event.name == "lose" && event.getlx === false) {
						return false;
					}
					return lib.skill.fengxiang.getMax() != lib.skill.fengxiang.getMax(event);
				},
				async content(event, trigger, player) {
					if (trigger.delay === false) {
						game.delayx();
					}
					player.draw();
				},
			},
			use: {
				mod: {
					aiOrder(player, card, num) {
						if (
							num > 0 &&
							get.itemtype(card) === "card" &&
							card.hasGaintag("fengxiang_tag") &&
							game.hasPlayer(current => {
								return current.hasSkill("fengxiang") && get.attitude(player, current) > 0;
							})
						) {
							return num + 10;
						}
					},
				},
				trigger: { player: "dieAfter" },
				filter(event, player) {
					return !game.hasPlayer(current => current.hasSkill("fengxiang", null, null, false), true);
				},
				silent: true,
				forceDie: true,
				charlotte: true,
				async content(event, trigger, player) {
					game.removeGlobalSkill("fengxiang_use");
				},
			},
		},
	},
};
