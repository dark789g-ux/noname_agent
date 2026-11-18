import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clandingan" | "clanfuning" | "clanheta" | "clanyingxiang">} */
export const groupSkills = {
	//族荀彧
	clandingan: {
		audio: 2,
		trigger: { global: "useCardAfter" },
		filter(event, player) {
			return game.getGlobalHistory("useCard", evt => evt.card.name == event.card.name).indexOf(event) == 1 && game.hasPlayer(target => !event.targets.includes(target) && !player.getStorage("clandingan_used").includes(target)) && !game.getGlobalHistory("everything", evt => evt.name == "dying").length;
		},
		forced: true,
		async content(event, trigger, player) {
			const skill = `${event.name}_used`;
			const pre_targets = game.filterPlayer(target => {
				return !trigger.targets.includes(target) && !player.getStorage(skill).includes(target);
			});
			let result =
				pre_targets.length > 1
					? await player
							.chooseTarget(
								`定安：与一名不为此牌目标的角色各摸一张牌`,
								(card, player, target) => {
									return get.event().targetx.includes(target);
								},
								true
							)
							.set("targetx", pre_targets)
							.set("prompt2", "然后你令一名手牌最多的其他角色执行一项：1.受到你造成的1点伤害；2.弃置手牌中最多的同名牌。")
							.set("ai", target => {
								const { player, targetx } = get.event(),
									getD = current => get.effect(current, { name: "draw" }, player, player);
								const eff = getD(target);
								if (eff > 0) {
									return 2;
								}
								if (ui.selected.targets.every(current => getD(current) > 0 && current.countCards("h") < target.countCards("h"))) {
									return -eff;
								}
								return 0;
							})
							.forResult()
					: {
							bool: true,
							targets: pre_targets,
						};
			if (!result?.bool || !result.targets?.length) {
				return;
			}
			player.addTempSkill(skill);
			player.markAuto(skill, result.targets);
			const targets = [player, ...result.targets.sortBySeat()];
			await game.asyncDraw(targets);
			const currents = game.filterPlayer(target => target != player && target.isMaxHandcard(false, current => current != player));
			if (!currents?.length) {
				return;
			}
			result =
				currents.length == 1
					? { bool: true, targets: currents }
					: await player
							.chooseTarget("定安：选择一名手牌最多的其他角色", true, (card, player, target) => {
								return get.event().targetsx?.includes(target);
							})
							.set("targetsx", currents)
							.set("ai", target => {
								const player = get.player();
								const att = get.attitude(player, target);
								if (att > 0) {
									return 0;
								}
								if (target.countCards("h") > 2) {
									return get.sgnAttitude(player, target) * Math.sqrt(target.countCards("h"));
								}
								return get.damageEffect(target, player, player);
							})
							.forResult();
			if (!result?.bool || !result.targets?.length) {
				return;
			}
			const target = result.targets[0];
			result = await player
				.chooseButton(
					[
						`定安：选择一项令${get.translation(target)}执行`,
						[
							[
								["damage", "受到你造成的1点伤害"],
								["discard", "随机弃置手牌中最多的同名牌"],
							],
							"textbutton",
						],
					],
					true
				)
				.set("target", target)
				.set("ai", button => {
					const { player, target } = get.event();
					if (button.link == "damage") {
						return get.damageEffect(target, player, player);
					}
					return get.sgnAttitude(player, target) * Math.sqrt(target.countCards("h"));
				})
				.forResult();
			if (result?.bool && result.links?.length) {
				player.line(target);
				if (result.links[0] == "damage") {
					await target.damage(player);
				} else {
					const cards = target.getCards("h"),
						names = cards.map(card => get.name(card)),
						maxName = names.toUniqued().maxBy(name => get.numOf(names, name));
					const num = get.numOf(names, maxName);
					const name = names
						.toUniqued()
						.filter(name => get.numOf(names, name) == num)
						.randomGet();
					if (name) {
						const discards = cards.filter(card => get.name(card) == name);
						if (discards?.length) {
							await target.modedDiscard(discards);
						}
					}
				}
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	clanfuning: {
		audio: 2,
		trigger: { player: "changeHpAfter" },
		filter(event, player) {
			if (event.changedHp == 0) {
				return false;
			}
			const evts = game.getRoundHistory("changeHp", evt => evt.player == player && evt.changedHp != 0);
			if (evts.indexOf(event) !== 0) {
				return false;
			}
			if (!game.hasPlayer(current => current != player)) {
				return false;
			}
			const num = Math.max(1, player.getDamagedHp());
			return player.countCards("he") >= num;
		},
		async cost(event, trigger, player) {
			const num = Math.max(1, player.getDamagedHp()),
				count = game.countPlayer2(current => current.hasHistory("damage"), true);
			event.result = await player
				.chooseCardTarget({
					prompt: get.prompt2(event.skill),
					filterCard: true,
					position: "he",
					selectCard: [num, Infinity],
					filterTarget: lib.filter.notMe,
					complexCard: true,
					count: count,
					ai1(card) {
						const color = get.color(card),
							{ player, count } = get.event();
						if (!player.isDamaged() || ui.selected.cards.every(cardx => get.color(cardx) == color)) {
							const num = ui.selected.cards.length,
								num2 = player.countCards("h", cardx => !ui.selected.cards.includes(cardx));
							if (count <= num && num2 > player.maxHp) {
								return 15 - get.value(card);
							}
							return 10 - get.value(card);
						}
						return 3 - get.value(card);
					},
					ai2(target) {
						const player = get.player();
						return get.attitude(player, target);
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				cards,
				targets: [target],
			} = event;
			const bool1 = cards.map(card => get.color(card)).toUniqued().length == 1,
				bool2 = cards.length > game.countPlayer2(current => current.hasHistory("damage"), true);
			await player.give(cards, target);
			if (bool1) {
				await player.recover();
			}
			if (bool2) {
				const num = player.countCards("h") - player.maxHp;
				if (num > 0) {
					const count = Math.min(num, player.countDiscardableCards(player, "h"));
					if (count > 0) {
						await player.chooseToDiscard("h", count, true, "allowChooseAll");
					}
				} else if (num < 0) {
					await player.draw(-num);
				}
			}
		},
	},
	//族韩馥
	clanheta: {
		audio: 2,
		trigger: {
			player: "phaseUseBegin",
		},
		filter(event, player) {
			return !player.isLinked();
		},
		async content(event, trigger, player) {
			await player.link(true);
			player.addTempSkill("clanheta_effect");
		},
		subSkill: {
			effect: {
				trigger: {
					player: "useCard1",
				},
				filter(event, player) {
					if (!player.isLinked() || ["equip", "delay"].includes(get.type(event.card))) {
						return false;
					}
					if (get.info(event.card)?.multitarget) {
						return false;
					}
					const targets = player
						.getHistory(
							"useCard",
							evt => {
								return evt?.targets?.length && evt != event;
							},
							event
						)
						.map(evt => evt.targets ?? [])
						.flat()
						.toUniqued();
					return targets.some(target => {
						if (event.targets?.includes(target)) {
							return true;
						}
						return lib.filter.targetEnabled2(event.card, player, target);
					});
				},
				charlotte: true,
				async cost(event, trigger, player) {
					const targets = player
						.getHistory(
							"useCard",
							evt => {
								return evt?.targets?.length && evt != trigger;
							},
							trigger
						)
						.map(evt => evt.targets ?? [])
						.flat()
						.toUniqued();
					event.result = await player
						.chooseTarget(
							(card, player, target) => {
								const { targetx, targety, cardx } = get.event();
								if (!targetx.includes(target)) {
									return false;
								}
								if (ui.selected.targets?.length) {
									const first = ui.selected.targets[0];
									if (targety.includes(first) !== targety.includes(target)) {
										return false;
									}
								}
								return targety.includes(target) || lib.filter.targetEnabled2(cardx, player, target);
							},
							[1, Infinity]
						)
						.set("targetx", targets)
						.set("targety", trigger.targets)
						.set("cardx", trigger.card)
						.set("complexTarget", true)
						.set("targetprompt", target => {
							const { targety } = get.event();
							return targety.includes(target) ? "取消目标" : "成为目标";
						})
						.set("prompt", get.translation(event.skill))
						.set("prompt2", "为此牌增加或减少任意个目标")
						.set("ai", target => {
							const { targety, cardx, player } = get.event(),
								eff = get.effect(target, cardx, player, player);
							if (targety.includes(target)) {
								return -eff * get.attitude(player, target);
							}
							return eff * get.attitude(player, target);
						})
						.forResult();
				},
				async content(event, trigger, player) {
					await player.link(false);
					const bool = trigger.targets.containsSome(...event.targets);
					trigger.targets[bool ? "removeArray" : "addArray"](event.targets);
					await game.delay();
				},
			},
		},
	},
	clanyingxiang: {
		audio: 3,
		trigger: {
			player: "phaseUseEnd",
		},
		filter(event, player) {
			return game.hasPlayer(current => player.canCompare(current));
		},
		async cost(event, trigger, player) {
			const list = get.inpileVCardList(info => {
				if (info[0] == "basic" && !info[3]) {
					return true;
				}
				if (info[0] != "trick") {
					return false;
				}
				const infox = lib.card[info[2]];
				if (infox.notarget || (info.selectTarget && infox.selectTarget != 1)) {
					return false;
				}
				return infox.type == "trick";
			});
			if (!list.length) {
				return;
			}
			const result = await player
				.chooseButtonTarget({
					createDialog: [get.prompt2(event.skill), [list, "vcard"]],
					filterTarget(card, player, target) {
						return player.canCompare(target);
					},
					ai1(button) {
						const card = player.getCards("h").maxBy(
							card => {
								return get.number(card);
							},
							card => card.name == button.link[2]
						);
						if (card) {
							return get.number(card);
						}
						return 0;
					},
					ai2(target) {
						return -get.attitude(get.player(), target);
					},
				})
				.forResult();
			if (result.bool) {
				event.result = {
					bool: true,
					targets: result.targets,
					cost_data: result.links[0][2],
				};
			}
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
				cost_data: name,
			} = event;
			game.log(player, "声明的牌名为", `#y${get.translation(name)}`);
			player.chat(get.translation(name));
			const result = await player.chooseToCompare(target).forResult();
			if (!result.tie) {
				const winner = result.bool ? player : target,
					card = new lib.element.VCard({ name: name, isCard: true });
				if (winner.hasUseTarget(card)) {
					await winner.chooseUseTarget(card, true);
				}
			}
			const cards = [result.player, result.target];
			if (cards.some(card => card.name == name)) {
				if (player.hasSkill("clanxumin", null, null, false) && !player.hasSkill("clanxumin")) {
					player.restoreSkill("clanxumin");
					game.log(player, "重置了", "【恤民】");
				}
			} else {
				if (cards.someInD("od")) {
					await player.gain(cards.filterInD("od"), "gain2");
				}
				const skills = player.getSkills(null, false, false).filter(skill => {
					let info = get.info(skill);
					if (!info || info.charlotte || get.skillInfoTranslation(skill, player).length == 0) {
						return false;
					}
					return true;
				});
				const result2 =
					skills.length > 1
						? await player
								.chooseButton(["迎乡：失去一个技能", [skills, "skill"]], true)
								.set("ai", button => {
									const { link } = button;
									const info = get.info(link);
									if (info?.ai?.neg || info?.ai?.halfneg) {
										return 3;
									}
									return ["clanyingxiang", "clanxumin"].indexOf(link) + 1;
								})
								.forResult()
						: {
								bool: true,
								links: skills,
							};
				if (result2?.bool && result2?.links?.length) {
					await player.removeSkills(result2.links);
				}
			}
		},
	},
};
