import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcliexiang" | "dcrengou">} */
export const groupSkills = {
	//威刘备
	dcliexiang: {
		audio: 2,
		enable: "phaseUse",
		usable(skill, player) {
			return player.hasSkill(skill + "_extra", null, null, false) ? 2 : 1;
		},
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog(`烈骧：你可以摸至多五张牌`, "hidden");
			},
			chooseControl(event, player) {
				const num = 5;
				const choices = [...Array.from(Array(num)).map((v, i) => `${get.cnNumber(i + 1)}张`), "cancel2"];
				return choices;
			},
			check() {
				const num = Math.min(
						5,
						game.countPlayer(() => true, true)
					),
					player = get.player(),
					num2 = player.countCards("h");
				if (
					!player.hasSkill("dcliexiang_extra") &&
					game.hasPlayer(current => {
						return current.countCards("h") > num2 + 1;
					})
				) {
					return `${get.cnNumber(1)}张`;
				}
				return `${get.cnNumber(num)}张`;
			},
			prompt(result, player) {
				const num = result.index + 1;
				let prompt = get.skillInfoTranslation("dcliexiang", player),
					draw = `摸${get.cnNumber(num)}张牌`;
				return `###烈骧###${prompt.replace("出牌阶段限一次，你可以摸至多五张牌", draw)}`;
			},
			backup(result, player) {
				const info = get.copy(lib.skill["dcliexiang_backup"]);
				info.index = result.index;
				return info;
			},
		},
		ai: {
			order(item, player) {
				if (player.hasSkill("dcliexiang_extra")) {
					return 1;
				}
				return 9;
			},
			result: {
				player(player) {
					const num =
						player.countCards("h") +
						Math.min(
							5,
							game.countPlayer(() => true, true)
						);
					return game.countPlayer(current => {
						if (current == player) {
							return false;
						}
						const num2 = current.countCards("h");
						if (num > num2) {
							return true;
						}
						if (get.attitude(player, current) < 0 && num == num2) {
							return true;
						}
						return false;
					});
				},
			},
		},
		subSkill: {
			backup: {
				audio: "dcliexiang",
				manualConfirm: true,
				async content(event, trigger, player) {
					const { index } = get.info(event.name);
					await player.draw(index + 1);
					if (!game.hasPlayer(current => current != player)) {
						return;
					}
					const max = player.countMark("dcliexiang_extra") + 1;
					const result = await player
						.chooseTarget(lib.filter.notMe, [1, max], true)
						.set("prompt", `烈骧：请选择${max > 1 ? "至多" : ""}${get.cnNumber(max)}名其他角色`)
						.set("prompt2", "这些角色按照你选择的顺序依次执行：{你对其造成1点伤害，然后若你的手牌数：1.大于其，本回合你出【杀】次数+1且你可以交给一名其他角色至多X张牌；2.等于其，你获得其一张牌且其下回合使用的前X张牌无效；3.小于其，你失去X点体力，此技能本回合修改为“出牌阶段限两次”且可额外选择至多X名其他角色（X为你选择的摸牌数）。}。")
						.set("multitarget", true)
						.set("targetprompt", target => {
							const num = ui.selected.targets.length;
							return "第" + num + "个结算";
						})
						.set("ai", target => {
							const { player, numx, drawNum } = get.event(),
								num = target.countCards("h");
							if (numx > num) {
								return Math.max(0.1, -get.attitude(player, target));
							}
							if (numx == num) {
								return get.effect(target, { name: "guohe_copy2" }, player, player);
							}
							if (player.hp <= 2 || player.hasSkill("dcliexiang_extra")) {
								return 0;
							}
							if (numx < num) {
								return get.damageEffect(target, player, player);
							}
							return 15;
						})
						.set("drawNum", index + 1)
						.set("numx", player.countCards("h"))
						.forResult();
					if (!result?.bool || !result.targets?.length) {
						return;
					}
					const func = async target => {
						await target.damage();
						const num = player.countCards("h") - target.countCards("h");
						if (num > 0) {
							const skill = "dcliexiang_effect";
							player.addTempSkill(skill);
							player.addMark(skill, 1, false);
							if (player.hasCards("he") && game.hasPlayer(current => current != player)) {
								const result = await player
									.chooseCardTarget({
										prompt: `烈骧：你可以将至多${get.cnNumber(index + 1)}张牌交给其他角色`,
										filterCard: true,
										position: "he",
										selectCard: [1, index + 1],
										filterTarget: lib.filter.notMe,
										ai1(card) {
											return 1 / Math.max(0.1, get.value(card));
										},
										ai2(target) {
											const player = get.player();
											let att = get.attitude(player, target);
											if (target.hasSkillTag("nogain")) {
												att /= 9;
											}
											return att;
										},
									})
									.forResult();
								if (result?.cards?.length && result.targets?.length) {
									const {
										targets: [target],
										cards,
									} = result;
									player.line(target);
									await player.give(cards, target);
								}
							}
						}
						if (num == 0) {
							const numx = target.countGainableCards(player, "he");
							if (numx > 0) {
								await player.gainPlayerCard(target, "he", true);
							}
							target.addTempSkill("dcliexiang_debuff", { player: "phaseAfter" });
							if (index + 1 > target.countMark("dcliexiang_debuff")) {
								target.setMark("dcliexiang_debuff", index + 1, false);
							}
						}
						if (num < 0) {
							await player.loseHp(index + 1);
							if (player.hasSkill("dcliexiang", null, null, false)) {
								player.addTempSkill("dcliexiang_extra");
								player.setMark("dcliexiang_extra", index + 1, false);
							}
						}
					};
					player.line(result.targets);
					await game.doAsyncInOrder(result.targets, func, () => 0);
				},
			},
			debuff: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "下个回合使用的前#张牌无效",
				},
				forced: true,
				popup: false,
				trigger: { player: "useCard" },
				filter(event, player) {
					return _status.currentPhase == player && player.hasMark("dcliexiang_debuff");
				},
				async content(event, trigger, player) {
					player.removeMark(event.name, 1, false);
					if (!player.hasMark(event.name)) {
						player.removeSkill(event.name);
					}
					game.log(trigger.card, "被无效了");
					player.popup("无效");
					trigger.all_excluded = true;
				},
			},
			extra: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "改为出牌阶段限两次，且可额外选择至多#个目标",
				},
			},
			effect: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "出杀次数+#",
				},
				mod: {
					cardUsable(card, player, num) {
						if (get.name(card) == "sha") {
							return num + player.countMark("dcliexiang_effect");
						}
					},
				},
			},
		},
	},
	dcrengou: {
		audio: 2,
		derivation: "dcliexiang",
		global: "dcrengou_global",
		subSkill: {
			global: {
				enable: "phaseUse",
				usable: 1,
				filter(event, player) {
					if (player.group != "shu" || !player.countDiscardableCards(player, "he")) {
						return false;
					}
					return game.hasPlayer(current => current != player && current.hasSkill("dcrengou"));
				},
				filterTarget(card, player, target) {
					return target != player && target.hasSkill("dcrengou");
				},
				selectTarget() {
					const player = get.player(),
						num = game.countPlayer(current => current != player && current.hasSkill("dcrengou"));
					if (num == 1) {
						return -1;
					}
					return 1;
				},
				prompt() {
					const player = get.player(),
						targets = game.filterPlayer(current => current != player && current.hasSkill("dcrengou"));
					return `弃置一张牌并令${get.translation(targets)}${targets.length > 1 ? "中的一人" : ""}回复1点体力，然后其可令你发动一次X为2的${get.poptip("dcliexiang")}`;
				},
				filterCard(card, player) {
					return lib.filter.cardDiscardable(card, player, "dcrengou");
				},
				log: false,
				prepare(cards, player, targets) {
					targets[0].logSkill("dcrengou", player);
				},
				async content(event, trigger, player) {
					const { target } = event;
					await target.recover();
					const result = await target
						.chooseBool(`###仁彀###是否令${get.translation(player)}发动一次至多摸两张牌的${get.poptip("dcliexiang")}？`)
						.set(
							"choice",
							(() => {
								const num =
										player.countCards("h") +
										Math.min(
											2,
											game.countPlayer(() => true, true)
										),
									bool = game.hasPlayer(current => {
										if (current == player) {
											return false;
										}
										const num2 = current.countCards("h");
										if (num2 < num) {
											return true;
										}
										return num2 == num && get.attitude(player, current) >= 0;
									});
								if (get.attitude(target, player) > 0) {
									return bool;
								}
								return player.hp < 2 && !bool;
							})()
						)
						.forResult();
					if (!result?.bool) {
						target.popup("拒绝");
						return;
					}
					target.popup("同意");
					const num = Math.min(
						2,
						game.countPlayer(() => true, true)
					);
					const result2 = await player
						.chooseControl(Array.from(Array(num)).map((v, i) => `${get.cnNumber(i + 1)}张`))
						.set("prompt", `烈骧：摸至多${get.cnNumber(num)}张牌`)
						.set("ai", () => {
							return `${get.cnNumber(
								Math.min(
									2,
									game.countPlayer(() => true, true)
								)
							)}张`;
						})
						.forResult();
					if (!result2?.control) {
						return;
					}
					game.broadcastAll(index => {
						lib.skill.dcliexiang_backup.index = index;
					}, result2.index);
					await player.useSkill("dcliexiang_backup").set("addCount", false);
				},
				ai: {
					order: 8,
					result: {
						target(player, target) {
							return get.recoverEffect(target, target, target);
						},
						player(player, target) {
							let eff = -1;
							if (get.attitude(target, player) > 0) {
								eff += Math.min(
									2,
									game.countPlayer(() => true, true)
								);
							}
							return eff;
						},
					},
				},
			},
		},
	},
};
