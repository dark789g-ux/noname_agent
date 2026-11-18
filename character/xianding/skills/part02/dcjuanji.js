import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcjuanji" | "dcrenshuang" | "old_dcjuanji" | "old_dcrenshuang">} */
export const groupSkills = {
	//任婉
	dcjuanji: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.getStorage("dcjuanji_used").length < 3 && event.juanji_record > 0;
		},
		onChooseToUse(event) {
			if (!game.online && !event.juanji_record) {
				const num = event.player.getStat("skill")["dcjuanji_backup"] ?? 0;
				event.set("juanji_record", num + 1);
			}
		},
		chooseButton: {
			dialog(event, player) {
				const dialog = ui.create.dialog("狷急"),
					num = event.juanji_record;
				const list = [
					["damage", `令你与一名其他角色各回复${num}点体力，然后对你与其各造成${num}点伤害`],
					["discard", `弃置至多${num}名其他角色各一张牌，然后你翻面`],
					["draw", `摸${num}张牌，然后你弃置等量张牌`],
				];
				dialog.add([list, "textbutton"]);
				dialog.direct = true;
				return dialog;
			},
			filter(button, player) {
				if (player.getStorage("dcjuanji_used").includes(button.link)) {
					return false;
				}
				return (
					button.link == "draw" ||
					game.hasPlayer(current => {
						if (current == player) {
							return false;
						}
						return button.link == "damage" || current.countCards("he");
					})
				);
			},
			check(button) {
				const player = get.player(),
					num = get.event().getParent().juanji_record;
				switch (button.link) {
					case "damage": {
						let eff = current => {
							const recover = Math.min(current.getDamagedHp(), num);
							return recover * get.recoverEffect(current, player, player) + num * get.damageEffect(current, player, player);
						};
						const target = game.filterPlayer().maxBy(
							current => eff(current),
							current => current != player
						);
						if (player.hasSkill("dcrenshuang")) {
							let num2 = player.getHp(true) + Math.min(player.getDamagedHp(), num) - num;
							if (num2 == 1) {
								return 114514;
							} else if (num2 < 1 && player.countCards("hs", card => get.tag(card, "save")) > -num2) {
								return 0.3;
							}
						}
						if (!target) {
							return 0;
						}
						return eff(player) + eff(target);
					}
					case "discard": {
						let eff = current => get.effect(current, { name: "guohe_copy2" }, player, player);
						let discard = game.filterPlayer(current => current != player && eff(current) > 0).sort((a, b) => eff(a) - eff(b));
						let discard2 = discard.slice(0, Math.min(game.countPlayer(), num, discard.length)).reduce((sum, current) => sum + eff(current), 0);
						return discard2;
					}
					default: {
						return num * 0.4;
					}
				}
			},
			backup(links, player) {
				return {
					audio: "dcjuanji",
					numx: get.event().juanji_record,
					choice: links[0],
					damageCheck: (function () {
						if (player.hasSkill("dcrenshuang")) {
							const num = get.event().juanji_record;
							let num2 = player.getHp(true) + Math.min(player.getDamagedHp(), num) - num;
							if (num2 == 1 || (num2 < 1 && player.countCards("hs", card => get.tag(card, "save")) > -num2)) {
								return true;
							}
						}
						return false;
					})(),
					filterTarget(card, player, target) {
						if (target == player) {
							return false;
						}
						const { choice } = get.info("dcjuanji_backup");
						switch (choice) {
							case "damage": {
								return true;
							}
							case "discard": {
								return target.countCards("he");
							}
							default: {
								return false;
							}
						}
					},
					selectTarget() {
						const { choice, numx } = get.info("dcjuanji_backup");
						switch (choice) {
							case "damage": {
								return 1;
							}
							case "discard": {
								return [1, numx];
							}
							default: {
								return -1;
							}
						}
					},
					multiline: true,
					multitarget: true,
					async content(event, trigger, player) {
						const { choice, numx } = get.info(event.name);
						player.addTempSkill("dcjuanji_used", "phaseChange");
						player.markAuto("dcjuanji_used", choice);
						switch (choice) {
							case "damage": {
								for (const method of ["recover", "damage"]) {
									for (const current of [player, ...event.targets]) {
										if (current.isIn()) {
											await current[method](numx);
										}
									}
								}
								break;
							}
							case "discard": {
								for (const target of event.targets) {
									await player.discardPlayerCard(target, "he", true);
								}
								await player.turnOver();
								break;
							}
							default: {
								await player.draw(numx);
								await player.chooseToDiscard("he", numx, true);
								break;
							}
						}
					},
					ai1() {
						return 1;
					},
					ai2(target) {
						const { choice, numx, damageCheck } = get.info("dcjuanji_backup"),
							player = get.player();
						switch (choice) {
							case "damage": {
								let eff = current => {
									const recover = Math.min(current.getDamagedHp(), numx);
									return recover * get.recoverEffect(current, player, player) + numx * get.damageEffect(current, player, player);
								};
								if (damageCheck) {
									return eff(target);
								}
								return eff(player) + eff(target);
							}
							case "discard": {
								return get.effect(target, { name: "guohe_copy2" }, player, player);
							}
							default: {
								return 1;
							}
						}
					},
				};
			},
			prompt(links, player) {
				const { choice, numx: num } = get.info("dcjuanji_backup");
				switch (choice) {
					case "damage": {
						return `令你与一名其他角色各回复${num}点体力，然后对你与其各造成${num}点伤害`;
					}
					case "discard": {
						return `弃置至多${num}名其他角色各一张牌，然后你翻面`;
					}
					default: {
						return `摸${num}张牌，然后你弃置等量张牌`;
					}
				}
			},
		},
		ai: {
			order: 7,
			result: {
				player: 1,
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
			backup: {},
		},
	},
	dcrenshuang: {
		trigger: {
			player: ["changeHpAfter"],
		},
		audio: 2,
		forced: true,
		filter(event, player) {
			return player.hp == 1 && event.changedHp != 0;
		},
		async content(event, trigger, player) {
			await player.link(false);
			await player.turnOver(false);
			const cards = get.inpileVCardList(info => {
				return info[0] == "trick" && player.hasUseTarget(info[2]) && !player.getStorage("dcrenshuang_used").includes(info[2]);
			});
			if (!cards?.length) {
				return;
			}
			const result = await player
				.chooseButton(["纫霜：选择要视为使用的牌", [cards, "vcard"]], true)
				.set("ai", button => {
					return get.player().getUseValue(button.link[2]);
				})
				.forResult();
			if (result?.bool) {
				player.addTempSkill("dcrenshuang_used", "roundStart");
				player.markAuto("dcrenshuang_used", result.links[0][2]);
				const card = new lib.element.VCard({ name: result.links[0][2], isCard: true });
				if (player.hasUseTarget(card)) {
					await player.chooseUseTarget(card, true);
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
	old_dcjuanji: {
		trigger: {
			player: ["phaseUseBegin", "phaseDrawBegin", "phaseDiscardBegin"],
		},
		filter(event, player) {
			if (event.name == "phaseUse") {
				const card = new lib.element.VCard({ name: "sha", isCard: true });
				return player.hasUseTarget(card, false);
			}
			if (event.name == "phaseDiscard") {
				return player.countCards("h") != player.getHandcardLimit();
			}
			return true;
		},
		audio: 2,
		async cost(event, trigger, player) {
			const name = trigger.name.slice(5);
			event.result =
				name == "Draw"
					? await player.chooseBool(get.prompt(event.skill)).set("prompt2", "摸体力上限张牌").forResult()
					: name == "Use"
						? await player
								.chooseTarget(get.prompt(event.skill))
								.set("prompt2", "失去1点体力并视为对一名角色使用一张【杀】")
								.set("filterTarget", (event, player, target) => {
									const card = new lib.element.VCard({ name: "sha", isCard: true });
									return player.canUse(card, target, false);
								})
								.set("ai", target => {
									const card = new lib.element.VCard({ name: "sha", isCard: true }),
										player = get.player(),
										eff1 = get.effect(target, card, player, player),
										eff2 = get.effect(player, { name: "losehp" }, player, player);
									return Math.max(0, eff1 - eff2);
								})
								.forResult()
						: await player
								.chooseCardTarget({
									filterCard(card, player) {
										const num = get.event().numx;
										return num > 0 && lib.filter.cardDiscardable(card, player, "dcjuanji");
									},
									prompt: get.prompt(event.skill),
									prompt2: "将手牌调整至手牌上限，然后弃置一名角色区域里至多两张牌",
									numx: player.countCards("h") - player.getHandcardLimit(),
									selectCard() {
										const num = get.event().numx;
										if (num > 0) {
											return num;
										}
										return -1;
									},
									filterTarget(card, player, target) {
										return player == target || target.countCards("hej");
									},
									ai1(card) {
										return 10 - get.value(card);
									},
									ai2(target) {
										const player = get.player();
										return get.effect(target, { name: "guohe" }, player, player);
									},
								})
								.forResult();
		},
		async content(event, trigger, player) {
			const name = trigger.name.slice(5);
			if (name == "Draw") {
				await player.draw(player.maxHp);
			} else if (name == "Use") {
				const {
					targets: [target],
				} = event;
				const card = new lib.element.VCard({ name: "sha", isCard: true });
				await player.loseHp();
				await player.useCard(card, target, false);
			} else {
				const {
					cards,
					targets: [target],
				} = event;
				if (cards?.length) {
					await player.discard(cards);
				} else {
					await player.drawTo(player.getHandcardLimit());
				}
				if (target.countCards("hej")) {
					await player.discardPlayerCard(target, "hej", [1, 2], true);
				}
			}
		},
	},
	old_dcrenshuang: {
		trigger: {
			player: ["dying", "dyingAfter"],
		},
		audio: 2,
		filter(event, player, name) {
			if (name == "dyingAfter") {
				return player.isIn();
			}
			return game.getRoundHistory("everything", evt => evt.name == "dying" && evt.player == player).indexOf(event) == 0;
		},
		forced: true,
		async content(event, trigger, player) {
			if (event.triggername == "dying") {
				await player.recoverTo(1);
				if (player.getAllHistory("custom", evt => evt.dcrenshuang).length < 3) {
					player.getHistory("custom").push({
						dcrenshuang: true,
					});
					await player.gainMaxHp();
				}
			} else {
				await player.link(false);
				await player.turnOver(false);
				const cards = get.inpileVCardList(info => info[0] == "trick" && player.hasUseTarget(info[2]));
				if (!cards?.length) {
					return;
				}
				const result = await player
					.chooseButton(["纫霜：选择要视为使用的牌", [cards, "vcard"]], true)
					.set("ai", button => {
						return get.player().getUseValue(button.link[2]);
					})
					.forResult();
				if (result?.bool) {
					const card = new lib.element.VCard({ name: result.links[0][2], isCard: true });
					if (player.hasUseTarget(card)) {
						await player.chooseUseTarget(card, true);
					}
				}
			}
		},
	},
};
