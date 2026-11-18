import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olbenxi" | "olbingyi" | "xinzhaofu" | "xinkuangbi">} */
export const groupSkills = {
	//OL51
	olbenxi: {
		audio: "benxi",
		trigger: { player: "useCard2" },
		filter(trigger, player) {
			return _status.currentPhase === player && trigger.targets?.length === 1 && (trigger.card.name === "sha" || get.type(trigger.card) === "trick") && !game.hasPlayer(current => get.distance(player, current) > 1);
		},
		filterx(event, player) {
			const info = get.info(event.card);
			if (!event.targets?.length || info.multitarget || info.allowMultiple === false) {
				return false;
			}
			return game.hasPlayer(current => {
				return lib.filter.targetEnabled2(event.card, player, current) && !event.targets.includes(current);
			});
		},
		forced: true,
		async content(event, trigger, player) {
			const str = get.translation(trigger.card);
			const list = ["为" + str + "多选择一个目标", "　令" + str + "无视防具牌　", "　令" + str + "不可被抵消　", "令" + str + "造成伤害后摸牌"].map((item, i) => [i, item]);
			const next = player.chooseButton({
				createDialog: ["奔袭：请选择一至两项", [list.slice(0, 2), "tdnodes"], [list.slice(2, 4), "tdnodes"]],
				filterButton(button) {
					return button.link !== 0 || get.event().bool1;
				},
				selectButton: [1, 2],
				forced: true,
				ai(button) {
					const player = get.player();
					const event = get.event().getTrigger();
					switch (button.link) {
						case 0: {
							if (
								game.hasPlayer(current => {
									return lib.filter.targetEnabled2(event.card, player, current) && !event.targets.includes(current) && get.effect(current, event.card, player, player) > 0;
								})
							) {
								return 1.6 + Math.random();
							}
							return 0;
						}
						case 1: {
							if (
								event.targets.filter(current => {
									const eff1 = get.effect(current, event.card, player, player);
									player._olbenxi_ai = true;
									const eff2 = get.effect(current, event.card, player, player);
									delete player._olbenxi_ai;
									return eff1 > eff2;
								}).length
							) {
								return 1.9 + Math.random();
							}
							return Math.random();
						}
						case 2: {
							let num = 1.3;
							if (
								event.card.name === "sha" &&
								event.targets.filter(current => {
									if (current.mayHaveShan(player, "use") && get.attitude(player, current) <= 0) {
										if (current.hasSkillTag("useShan", null, "use")) {
											num = 1.9;
										}
										return true;
									}
									return false;
								}).length
							) {
								return num + Math.random();
							}
							return 0.5 + Math.random();
						}
						case 3: {
							return (get.tag(event.card, "damage") || 0) + Math.random();
						}
					}
				},
			});
			next.set("bool1", get.info("olbenxi").filterx(trigger, player));

			const { bool, links } = await next.forResult();
			if (!bool || !links?.length) {
				return;
			}
			for (const num of links.sort((a, b) => a - b)) {
				switch (num) {
					case 0: {
						const result2 = await player
							.chooseTarget("请选择" + get.translation(trigger.card) + "的额外目标", true, (card, player, target) => {
								const event = get.event().getTrigger();
								if (event.targets.includes(target)) {
									return false;
								}
								return lib.filter.targetEnabled2(event.card, player, target) && lib.filter.targetInRange(event.card, player, target);
							})
							.set("ai", target => {
								const player = get.player();
								const event = get.event().getTrigger();
								return get.effect(target, event.card, player, player);
							})
							.forResult();
						if (result2?.targets?.length) {
							player.line(result2.targets);
							trigger.targets.addArray(result2.targets);
							game.log(result2.targets, "成为了", trigger.card, "的额外目标");
						}
						break;
					}
					case 2:
						trigger.nowuxie = true;
						trigger.customArgs.default.directHit2 = true;
					// [falls through]
					default:
						player.addTempSkill("olbenxi_effect");
						player.storage.olbenxi_effect[num - 1].add(trigger.card);
						break;
				}
			}
		},
		ai: {
			unequip_ai: true,
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (_status.currentPhase !== player || game.hasPlayer(current => get.distance(player, current) > 1)) {
					return false;
				}
				if (tag === "directHit_ai") {
					return arg.card.name === "sha";
				}
				if (!arg || !arg.card || (arg.card.name != "sha" && arg.card.name !== "chuqibuyi")) {
					return false;
				}
				var card = arg.target.getEquip(2);
				if (card && card.name.indexOf("bagua") != -1) {
					return true;
				}
				if (player._olbenxi_ai) {
					return false;
				}
			},
		},
		group: "olbenxi_summer",
		subSkill: {
			effect: {
				charlotte: true,
				init(player, skill) {
					if (!player.storage[skill]) {
						player.storage[skill] = [[], [], []];
					}
				},
				audio: "benxi",
				trigger: { global: "damageSource" },
				filter(event, player) {
					return event.card && player.storage.olbenxi_effect[2].includes(event.card);
				},
				forced: true,
				async content(event, trigger, player) {
					await player.draw();
				},
				ai: {
					unequip: true,
					unequip_ai: true,
					skillTagFilter(player, tag, arg) {
						return player.storage.olbenxi_effect[0].includes(arg?.card);
					},
				},
				mod: {
					wuxieRespondable(card, player) {
						if (player.storage.olbenxi_effect[1].includes(card)) {
							return false;
						}
					},
				},
			},
			summer: {
				//audio: "benxi",
				trigger: { player: "useCard" },
				filter(event, player) {
					return player === _status.currentPhase;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					player.addTempSkill("olbenxi_dist");
					player.addMark("olbenxi_dist", 1, false);
				},
			},
			dist: {
				charlotte: true,
				onremove: true,
				mod: {
					globalFrom(from, to, distance) {
						return distance - from.countMark("olbenxi_dist");
					},
				},
				intro: { content: "距离与其他角色的距离-#" },
			},
		},
	},
	//顾雍
	olbingyi: {
		audio: "bingyi",
		trigger: {
			player: "loseAfter",
			global: "loseAsyncAfter",
		},
		filter(event, player) {
			return event.type == "discard" && event.getl(player).cards2.length > 0 && player.hasCards("h") && !player.hasSkill("olbingyi_blocker", null, null, false);
		},
		prompt2(event, player) {
			let str = "展示所有手牌，然后";
			const hs = player.getCards("h");
			const colors = hs.map(card => get.color(card)).toUniqued();
			if (colors.length != 1) {
				return str + "无事发生";
			}
			str += "令至多" + get.cnNumber(hs.length) + "名其他角色和自己各摸一张牌";
			return str;
		},
		check(event, player) {
			const colors = player
				.getCards("h")
				.map(card => get.color(card))
				.toUniqued();
			return colors.length == 1;
		},
		async content(event, trigger, player) {
			player.addTempSkill("olbingyi_blocker", ["phaseZhunbeiAfter", "phaseJudgeAfter", "phaseDrawAfter", "phaseUseAfter", "phaseDiscardAfter", "phaseJieshuAfter"]);

			const cards = player.getCards("h");
			await player.showCards(cards, `${get.translation(player)}发动了【秉壹】`);

			const colors = cards.map(card => get.color(card)).toUniqued();
			if (colors.length != 1) {
				return;
			}

			const num = cards.length;
			const result = !game.hasPlayer(current => current !== player)
				? { bool: false }
				: await player
						.chooseTarget({
							prompt: `秉壹：令至多${get.cnNumber(num)}名其他角色也各摸一张牌`,
							filterTarget(card, player, target) {
								return player !== target;
							},
							selectTarget: [1, num],
							ai(target) {
								const player = get.player();
								let att = get.attitude(player, target) / Math.sqrt(1 + target.countCards("h"));
								if (target.hasSkillTag("nogain")) {
									att /= 10;
								}
								return att;
							},
						})
						.forResult();

			if (!result?.bool || !result.targets?.length) {
				await player.draw();
				return;
			}

			const targets = result.targets;
			player.line(targets, "green");
			targets.push(player);
			await game.asyncDraw(targets.sortBySeat());
			await game.delayx();
		},
		subSkill: {
			blocker: {
				charlotte: true,
			},
		},
	},
	//孙体
	xinzhaofu: {
		audio: "zhaofu",
		audioname: ["ol_sunxiu"],
		enable: "phaseUse",
		usable: 1,
		limited: true,
		skillAnimation: true,
		animationColor: "wood",
		selectTarget: [1, 2],
		filterTarget: lib.filter.notMe,
		zhuSkill: true,
		async contentBefore(event, trigger, player) {
			player.awakenSkill(event.skill);
		},
		async content(event, trigger, player) {
			const { target } = event;
			target.addSkill("xinzhaofu_effect");
			target.markAuto("xinzhaofu_effect", [player]);
		},
		ai: {
			order: 9,
			result: {
				target(player, target) {
					var targets = game.filterPlayer(function (current) {
						return current.group == "wu" && get.attitude(player, current) > 0;
					});
					if (targets.length) {
						for (var targetx of targets) {
							if (!targetx.inRange(target)) {
								return -1;
							}
						}
						return -0.5;
					}
					return 0;
				},
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				mark: true,
				intro: { content: "已视为在其他吴势力角色的攻击范围内" },
				mod: {
					inRangeOf(from, to) {
						if (from.group != "wu") {
							return;
						}
						var list = to.getStorage("xinzhaofu_effect");
						for (var i of list) {
							if (i != from) {
								return true;
							}
						}
					},
				},
			},
		},
	},
	xinkuangbi: {
		audio: "kuangbi",
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target != player && target.countCards("he") > 0;
		},
		async content(event, trigger, player) {
			const { target } = event;
			const result = await target
				.chooseCard({
					prompt: `匡弼：交给${get.translation(player)}一至三张牌`,
					selectCard: [1, 3],
					position: "he",
					forced: true,
					ai(card) {
						const event = get.event();
						const player = get.player();
						if (get.attitude(player, event.getParent()?.player) > 0) {
							return 7 - get.value(card);
						}
						return -get.value(card);
					},
				})
				.forResult();

			if (result.bool && result.cards?.length) {
				const next = target.give(result.cards, player, false);
				next.gaintag.add("xinkuangbi_keep");
				player.addTempSkill("xinkuangbi_keep");
				target.addSkill("xinkuangbi_draw");
				target.addMark("xinkuangbi_draw", result.cards.length, false);
				await next;
			}
		},
		ai: {
			order: 1,
			result: {
				target(player, target) {
					if (get.attitude(player, target) > 0) {
						return Math.sqrt(target.countCards("he"));
					}
					return 0;
				},
				player: 1,
			},
		},
		subSkill: {
			keep: {
				mod: {
					ignoredHandcard(card, player) {
						if (card.hasGaintag("xinkuangbi_keep")) {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name == "phaseDiscard" && card.hasGaintag("xinkuangbi_keep")) {
							return false;
						}
					},
				},
				charlotte: true,
				onremove(player) {
					player.removeGaintag("xinkuangbi_keep");
				},
			},
			draw: {
				trigger: { player: "phaseBegin" },
				forced: true,
				charlotte: true,
				onremove: true,
				intro: {
					content: "下回合开始时摸#张牌",
				},
				async content(event, trigger, player) {
					await player.draw(player.countMark("xinkuangbi_draw"));
					player.removeSkill("xinkuangbi_draw");
				},
			},
		},
	},
};
