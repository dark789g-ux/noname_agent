import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olsbwance" | "olsbchenzhi" | "olsbluanchao">} */
export const groupSkills = {
	//OL谋贾诩
	olsbwance: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			if (!game.hasPlayer(target => target.countCards("h"))) {
				return false;
			}
			return lib.inpile.some(name => {
				const info = get.info({ name: name });
				return info && info.type === "trick" && !info.notarget && (info.toself || info.singleCard || !info.selectTarget || info.selectTarget === 1);
			});
		},
		filterTarget(card, player, target) {
			return target.countCards("h");
		},
		usable: 1,
		async content(event, trigger, player) {
			const names = lib.inpile.filter(name => {
					const info = get.info({ name: name });
					return info && info.type === "trick" && !info.notarget && (info.toself || info.singleCard || !info.selectTarget || info.selectTarget === 1);
				}),
				target = event.target;
			const name =
				names.length > 1
					? ((
							await player
								.chooseButton([get.translation(event.name) + "：请选择一个单目标普通锦囊牌牌名", [names, "vcard"]], true)
								.set("ai", button => {
									const player = get.player();
									const target = get.event().getParent().target;
									const effectCard = cardx => {
										const card = get.autoViewAs({ name: button.link[2] }, [cardx]);
										let targets = game.filterPlayer(current => target.canUse(card, current));
										if (!targets.length) {
											return 0;
										}
										targets.sort((a, b) => get.effect(b, card, target, target) - get.effect(a, card, target, target));
										let sum = get.effect(target, { name: "guohe_copy", position: "h" }, player, player);
										const effect = get.effect(targets[0], card, target, player);
										if (effect < 0) {
											let targets2 = game.filterPlayer(current => lib.filter.targetEnabled2(card, target, current) && lib.filter.targetInRange(card, target, current));
											if (targets2.length) {
												targets2.sort((a, b) => get.effect(b, card, target, player) - get.effect(a, card, target, player));
												const effect2 = get.effect(targets2[0], card, target, player);
												if (effect2 > 0) {
													sum += get.effect(player, { name: "guohe_copy2" }, player, player);
													sum += effect2;
												}
											} else {
												sum += effect;
											}
										} else {
											sum += effect;
										}
										return sum;
									};
									let cards = target.getCards("h");
									return cards
										.sort((a, b) => effectCard(b) - effectCard(a))
										.slice(0, Math.min(3, game.roundNumber))
										.reduce((num, card) => num + effectCard(card), 0);
								})
								.forResult()
						).links ?? [])[0][2]
					: names[0];
			if (name) {
				player.popup(name);
				game.log(player, "声明了", "#y" + get.translation(name));
				let sum = Math.min(3, game.roundNumber);
				player.addTempSkill("olsbwance_effect");
				while (sum > 0 && target.hasCard(card => target.hasUseTarget(get.autoViewAs({ name: name }, [card])), "h")) {
					sum--;
					game.broadcastAll(viewAs => (lib.skill.olsbwance_backup.viewAs = viewAs), { name: name });
					const next = target.chooseToUse();
					next.set("openskilldialog", get.translation(event.name) + "：将一张手牌当作【" + get.translation(name) + "】使用");
					next.set("forced", true);
					next.set("norestore", true);
					next.set("addCount", false);
					next.set("_backupevent", "olsbwance_backup");
					next.set("custom", {
						add: {},
						replace: { window() {} },
					});
					next.backup("olsbwance_backup");
					await next;
				}
			}
		},
		ai: {
			order: 10,
			result: {
				player(player, target) {
					const names = lib.inpile.filter(name => {
						const info = get.info({ name: name });
						return info && info.type === "trick" && !info.notarget && (info.toself || info.singleCard || !info.selectTarget || info.selectTarget === 1);
					});
					return Math.max(
						...names.map(name => {
							const effectCard = cardx => {
								const card = get.autoViewAs({ name: name }, [cardx]);
								let targets = game.filterPlayer(current => target.canUse(card, current));
								if (!targets.length) {
									return 0;
								}
								targets.sort((a, b) => get.effect(b, card, target, target) - get.effect(a, card, target, target));
								let sum = get.effect(target, { name: "guohe_copy", position: "h" }, player, player);
								const effect = get.effect(targets[0], card, target, player);
								if (effect < 0) {
									let targets2 = game.filterPlayer(current => lib.filter.targetEnabled2(card, target, current) && lib.filter.targetInRange(card, target, current));
									if (targets2.length) {
										targets2.sort((a, b) => get.effect(b, card, target, player) - get.effect(a, card, target, player));
										const effect2 = get.effect(targets2[0], card, target, player);
										if (effect2 > 0) {
											sum += get.effect(player, { name: "guohe_copy2" }, player, player);
											sum += effect2;
										}
									} else {
										sum += effect;
									}
								} else {
									sum += effect;
								}
								return sum;
							};
							let cards = target.getCards("h");
							return cards
								.sort((a, b) => effectCard(b) - effectCard(a))
								.slice(0, Math.min(3, game.roundNumber))
								.reduce((num, card) => num + effectCard(card), 0);
						})
					);
				},
			},
		},
		subSkill: {
			backup: {
				filterCard(card, player) {
					return get.itemtype(card) === "card";
				},
				position: "h",
				filterTarget: lib.filter.filterTarget,
				check: card => 8 - get.value(card),
				log: false,
			},
			effect: {
				charlotte: true,
				audio: "olsbwance",
				trigger: { global: "useCardToPlayer" },
				filter(event, player) {
					if (
						!player.hasCard(card => {
							if (get.position(card) === "h" && _status.connectMode) {
								return true;
							}
							return lib.filter.cardDiscardable(card, player);
						}, "he")
					) {
						return false;
					}
					return event.isFirstTarget && event.getParent(3).name === "olsbwance" && event.getParent(3).player === player;
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseCardTarget({
							prompt: get.prompt(event.skill),
							prompt2: '<div class="text center">弃置一张牌并重新为' + get.translation(trigger.card) + "指定目标（原目标为" + get.translation(trigger.targets) + "）</div>",
							filterCard: lib.filter.cardDiscardable,
							position: "he",
							filterTarget(card, player, target) {
								const evt = get.event().getTrigger();
								if (evt.targets.length === 1 && evt.targets[0] === target) {
									return false;
								}
								return lib.filter.targetEnabled2(evt.card, evt.player, target) && lib.filter.targetInRange(evt.card, evt.player, target);
							},
							selectTarget: trigger.targets.length,
							filterOk() {
								const evt = get.event().getTrigger();
								return ui.selected.targets.some(target => !evt.targets.includes(target));
							},
							ai1(card) {
								return 7.5 - get.value(card);
							},
							ai2(target) {
								const player = get.player(),
									evt = get.event().getTrigger();
								if (evt.targets.every(aim => get.effect(aim, evt.card, evt.player, player) > 0)) {
									return 0;
								}
								return get.effect(target, evt.card, evt.player, player);
							},
						})
						.forResult();
				},
				async content(event, trigger, player) {
					await player.discard(event.cards);
					const targets = event.targets.sortBySeat();
					trigger.targets = targets;
					trigger.getParent().targets = targets;
					trigger.getParent().triggeredTargets1 = targets;
					game.log(targets, "成为了", trigger.card, "的新目标");
				},
			},
		},
	},
	olsbchenzhi: {
		audio: 2,
		trigger: { player: "damageBegin4" },
		filter(event, player) {
			return player.getRoundHistory("damage").length >= Math.min(3, game.roundNumber) && player.hasDiscardableCards(player, "he");
		},
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			await player.chooseToDiscard({ position: "he", forced: true });
			trigger.cancel();
		},
		ai: {
			nothunder: true,
			nofire: true,
			nodamage: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (target.getRoundHistory("damage").length >= Math.min(3, game.roundNumber)) {
							return "zeroplayertarget";
						}
					}
				},
			},
		},
		group: "olsbchenzhi_effect",
		subSkill: {
			effect: {
				audio: "olsbchenzhi",
				trigger: { global: "roundEnd" },
				filter(event, player) {
					if (player.getRoundHistory("useSkill", evt => evt.skill === "olsbchenzhi").length > 0) {
						return false;
					}
					return game.hasPlayer(target => {
						return target.getSkills(null, false, false).some(skill => {
							const info = get.info(skill);
							if (!info || info.charlotte) {
								return false;
							}
							return info.limited && target.awakenedSkills.includes(skill);
						});
					});
				},
				firstDo: true,
				skillAnimation: true,
				animationColor: "thunder",
				async cost(event, trigger, player) {
					const func = (event, player) => {
						game.countPlayer(target => {
							const skills = target.getSkills(null, false, false).filter(skill => {
								const info = get.info(skill);
								if (!info || info.charlotte) {
									return false;
								}
								return info.limited && target.awakenedSkills.includes(skill);
							});
							if (skills.length) {
								target.prompt(skills.map(skill => get.translation(skill)).join("<br>"));
							}
						});
					};
					if (event.player == game.me) {
						func(event, player);
					} else if (event.isOnline()) {
						player.send(func, event, player);
					}
					event.result = await player
						.chooseTarget(
							(card, player, target) => {
								return target.getSkills(null, false, false).some(skill => {
									const info = get.info(skill);
									if (!info || info.charlotte) {
										return false;
									}
									return info.limited && target.awakenedSkills.includes(skill);
								});
							},
							get.prompt(event.skill),
							"复原一名角色的一个限定技"
						)
						.set("ai", target => {
							const player = get.player();
							if (player.hasUnknown()) {
								return 0;
							}
							return (
								Math.sign(get.attitude(player, target)) *
								Math.max(
									target
										.getSkills(null, false, false)
										.filter(skill => {
											const info = get.info(skill);
											if (!info || info.charlotte) {
												return false;
											}
											return info.limited && target.awakenedSkills.includes(skill);
										})
										.map(skill => {
											_status.event.skillRankPlayer = target;
											const num = get.skillRank(skill);
											delete _status.event.skillRankPlayer;
											return num;
										})
								)
							);
						})
						.forResult();
				},
				async content(event, trigger, player) {
					player.tempBanSkill(event.name, "forever", false);
					const target = event.targets[0];
					const skills = target.getSkills(null, false, false).filter(skill => {
						const info = get.info(skill);
						if (!info || info.charlotte) {
							return false;
						}
						return info.limited && target.awakenedSkills.includes(skill);
					});
					const skill =
						skills.length > 1
							? (
									await player
										.chooseControl(skills)
										.set(
											"choiceList",
											skills.map(i => {
												return '<div class="skill">【' + get.translation(lib.translate[i + "_ab"] || get.translation(i).slice(0, 2)) + "】</div><div>" + get.skillInfoTranslation(i, target, false) + "</div>";
											})
										)
										.set("displayIndex", false)
										.set("ai", () => {
											let { player, target, controls } = get.event();
											return controls.sort((a, b) => {
												_status.event.skillRankPlayer = target;
												const limit = get.skillRank(b) - get.skillRank(a);
												delete _status.event.skillRankPlayer;
												return limit * Math.sign(get.attitude(player, target));
											})[0];
										})
										.set("prompt", get.translation(event.name) + "：请选择你要获得的技能")
										.set("target", target)
										.forResult()
								).control
							: skills[0];
					if (skill) {
						player.line(target);
						game.log(player, "选择了技能", "#g【" + get.translation(skill) + "】");
						target.popup(skill);
						target.restoreSkill(skill);
					}
				},
			},
		},
	},
	olsbluanchao: {
		limited: true,
		audio: 2,
		trigger: { global: "roundStart" },
		check(event, player) {
			if (player.hasUnknown()) {
				return false;
			}
			return game.countPlayer(target => Math.sign(get.attitude(player, target))) > 0;
		},
		skillAnimation: true,
		animationColor: "thunder",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const targets = game.filterPlayer().sortBySeat();
			player.line(targets);
			for (const target of targets) {
				const { control: choice } = await target
					.chooseControl("sha", "shan")
					.set("ai", () => {
						const { player, controls } = get.event();
						const choices = controls.filter(choice => get.cardPile2({ name: choice }));
						if (choices.length === 1) {
							return choices[0];
						}
						return player.hasValueTarget("sha") ? "sha" : "shan";
					})
					.set("prompt", "选择从牌堆中获得一张【杀】或【闪】。若选择获得【杀】，则本轮首次造成的伤害+1")
					.forResult();
				const card = get.cardPile2({ name: choice });
				if (card) {
					await target.gain(card, "gain2");
				}
				if (choice === "sha") {
					target.addTempSkill("olsbluanchao_effect", "roundStart");
					target.addMark("olsbluanchao_effect", 1, false);
				}
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				intro: { content: "本轮首次造成的伤害+#" },
				trigger: { source: "damageBegin1" },
				forced: true,
				logTarget: "player",
				content() {
					const num = player.countMark(event.name);
					player.removeSkill(event.name);
					trigger.num += num;
				},
			},
		},
	},
};
