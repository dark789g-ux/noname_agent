import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "potzhanlie" | "pothanzhan" | "potzhenfeng">} */
export const groupSkills = {
	//势太史慈 --- by 刘巴
	potzhanlie: {
		audio: 3,
		trigger: { global: "phaseBegin" },
		forced: true,
		locked: false,
		logAudio: () => 2,
		async content(event, trigger, player) {
			const effectMap = new Map([
				["hp", player.getHp()],
				["damagedHp", player.getDamagedHp()],
				["countplayer", game.countPlayer()],
			]);
			const num = effectMap.get(player.storage.potzhanlie) || player.getAttackRange();
			player.addTempSkill("potzhanlie_addMark");
			if (num > 0) {
				player.addMark("potzhanlie_addMark", num, false);
			}
		},
		get limit() {
			return 6;
		},
		group: "potzhanlie_lie",
		subSkill: {
			addMark: {
				charlotte: true,
				onremove: true,
				audio: "potzhanlie3.mp3",
				trigger: { global: ["loseAfter", "loseAsyncAfter", "cardsDiscardAfter"] },
				getIndex(event, player) {
					return Math.min(
						event.getd().filter(i => i.name === "sha").length,
						get.info("potzhanlie").limit - player.countMark("potzhanlie_lie"),
						Math.max(
							player.countMark("potzhanlie_addMark") -
								game
									.getGlobalHistory(
										"everything",
										evt => {
											if (evt === event) {
												return false;
											}
											return ["lose", "loseAsync", "cardsDiscard"].includes(evt.name) && evt.getd().some(i => i.name === "sha");
										},
										event
									)
									.reduce((sum, evt) => sum + evt.getd().filter(i => i.name === "sha").length, 0),
							0
						)
					);
				},
				forced: true,
				async content(event, trigger, player) {
					player.addMark("potzhanlie_lie", 1);
				},
				intro: { content: "本回合前#张【杀】进入弃牌堆后，获得等量“烈”标记" },
			},
			lie: {
				trigger: { player: "phaseUseEnd" },
				filter: (event, player) => player.hasUseTarget(new lib.element.VCard({ name: "sha", isCard: true }), false),
				direct: true,
				async content(event, trigger, player) {
					const str = player.hasMark("potzhanlie_lie") ? "移去所有“烈”，" : "";
					const next = player.chooseUseTarget({
						prompt: get.prompt("potzhanlie"),
						prompt2: `<div class="text center">${str}视为使用一张无次数限制的【杀】</div>`,
						card: get.autoViewAs({ name: "sha", isCard: true }),
						addCount: false,
					});
					next.set("oncard", () => {
						const currentEvent = get.event();
						const currentPlayer = currentEvent.player;
						const num = currentPlayer.countMark("potzhanlie_lie");
						currentPlayer.addTempSkill("potzhanlie_buff");
						currentPlayer.clearMark("potzhanlie_lie");
						currentEvent.set("potzhanlie", Math.floor(num / 2));
					});
					next.set("logSkill", "potzhanlie");
					await next;
				},
				marktext: "烈",
				intro: {
					name: "烈",
					content: "mark",
				},
			},
			buff: {
				charlotte: true,
				trigger: { player: "useCard1" },
				filter: event => event?.potzhanlie,
				forced: true,
				locked: false,
				popup: false,
				async content(event, trigger, player) {
					const num = trigger.potzhanlie,
						str = get.translation(trigger.card);
					const result = await player
						.chooseButton([
							"战烈：是否选择至多" + get.cnNumber(num) + "项执行？",
							[
								[
									["目标+1", "令" + str + "可以额外指定一个目标"],
									["伤害+1", "令" + str + "基础伤害值+1"],
									["弃牌响应", "令" + str + "需额外弃置一张牌方可响应"],
									["摸牌", str + "结算完毕后，你摸三张牌"],
								],
								"textbutton",
							],
						])
						.set("selectButton", [1, num])
						.set("ai", button => {
							const player = get.player(),
								trigger = get.event().getTrigger(),
								choice = button.link;
							switch (choice) {
								case "目标+1":
									return Math.max(
										...game
											.filterPlayer(target => {
												return !trigger.targets?.includes(target) && lib.filter.targetEnabled2(trigger.card, player, target) && lib.filter.targetInRange(trigger.card, player, target);
											})
											.map(target => get.effect(target, trigger.card, player, player))
									);
								case "伤害+1":
									return (trigger.targets || []).reduce((sum, target) => {
										const effect = get.damageEffect(target, player, player);
										return (
											sum +
											effect *
												(target.hasSkillTag("filterDamage", null, {
													player: player,
													card: trigger.card,
												})
													? 1
													: 1 + (trigger.baseDamage || 1) + (trigger.extraDamage || 0))
										);
									}, 0);
								case "弃牌响应":
									return (trigger.targets || []).reduce((sum, target) => {
										const card = get.copy(trigger.card);
										game.setNature(card, "stab");
										return sum + get.effect(target, card, player, player);
									}, 0);
								case "摸牌":
									return get.effect(player, { name: "draw" }, player, player) * 3;
							}
						})
						.forResult();
					if (result.bool) {
						const choices = result.links;
						game.log(player, "选择了", "#g【战烈】", "的", "#y" + choices);
						for (const choice of choices) {
							player.popup(choice);
							switch (choice) {
								case "目标+1":
									player
										.when("useCard2")
										.filter(evt => evt === trigger)
										.step(async (event, trigger, player) => {
											const result = await player
												.chooseTarget("是否为" + get.translation(trigger.card) + "增加一个目标？", (card, player, target) => {
													const evt = get.event().getTrigger();
													return !evt.targets.includes(target) && lib.filter.targetEnabled2(evt.card, player, target) && lib.filter.targetInRange(evt.card, player, target);
												})
												.set("ai", target => {
													const player = get.player(),
														evt = get.event().getTrigger();
													return get.effect(target, evt.card, player);
												})
												.forResult();
											if (result?.bool && result.targets?.length) {
												const [target] = result.targets;
												player.line(target, trigger.card.nature);
												trigger.targets.add(target);
												game.log(target, "成为了", trigger.card, "的额外目标");
											}
										});
									break;
								case "伤害+1":
									trigger.baseDamage++;
									game.log(trigger.card, "造成的伤害", "#y+1");
									break;
								case "弃牌响应":
									player.addTempSkill("potzhanlie_guanshi");
									player.markAuto("potzhanlie_guanshi", [trigger.card]);
									break;
								case "摸牌":
									player
										.when("useCardAfter")
										.filter(evt => evt === trigger)
										.step(async () => await player.draw(3));
									break;
							}
						}
					}
				},
			},
			guanshi: {
				charlotte: true,
				onremove: true,
				audio: "potzhanlie",
				trigger: { player: "useCardToBegin" },
				filter(event, player) {
					if (!event.target?.isIn()) {
						return false;
					}
					const directHit = event.getParent().directHit;
					return directHit !== true && !directHit.includes(event.target) && player.getStorage("potzhanlie_guanshi").includes(event.card);
				},
				forced: true,
				logTarget: "target",
				async content(event, trigger, player) {
					const { target } = trigger;
					const result = await target
						.chooseToDiscard("战烈：弃置一张牌，否则不可响应" + get.translation(trigger.card))
						.set("ai", card => {
							const player = get.player(),
								trigger = get.event().getTrigger();
							if (get.effect(player, trigger.card, trigger.player, player) >= 0) {
								return 0;
							}
							const num = player.countCards("hs", { name: "shan" });
							if (num === 0) {
								return 0;
							}
							if (card.name === "shan" && num <= 1) {
								return 0;
							}
							return 8 - get.value(card);
						})
						.forResult();
					if (!result?.bool) {
						trigger.set("directHit", true);
						game.log(target, "不可响应", trigger.card);
					}
				},
			},
		},
	},
	pothanzhan: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget: lib.filter.notMe,
		async content(event, trigger, player) {
			const target = event.targets[0];
			for (const drawer of [player, target]) {
				const num = (() => {
					return (
						({
							hp: drawer.getHp(),
							damagedHp: drawer.getDamagedHp(),
							countplayer: game.countPlayer(),
						}[player.storage.pothanzhan] ?? drawer.maxHp) - drawer.countCards("h")
					);
				})();
				if (num > 0) {
					await drawer.draw(Math.min(num, 3));
				}
			}
			const juedou = new lib.element.VCard({ name: "juedou", isCard: true });
			if (player.canUse(juedou, target)) {
				await player.useCard(juedou, target, false);
			}
		},
		ai: {
			order(item, player) {
				if ((player.countCards("h", { name: "sha" }) || player.maxHp - player.countCards("h")) > 1) {
					return 10;
				}
				return 1;
			},
			result: {
				target(player, target) {
					return (
						get.effect(target, new lib.element.VCard({ name: "juedou", isCard: true }), player, player) -
						Math.max(
							0,
							Math.min(
								3,
								(() => {
									return (
										({
											hp: target.getHp(),
											damagedHp: target.getDamagedHp(),
											countplayer: game.countPlayer(),
										}[player.storage.pothanzhan] ?? target.maxHp) - target.countCards("h")
									);
								})()
							)
						) *
							get.effect(target, { name: "draw" }, player, player)
					);
				},
			},
		},
	},
	potzhenfeng: {
		limited: true,
		audio: 4,
		enable: "phaseUse",
		filter(event, player) {
			return player.isDamaged() || ["pothanzhan", "potzhanlie"].some(skill => player.hasSkill(skill, null, null, false));
		},
		skillAnimation: true,
		animationColor: "metal",
		logAudio: index => (typeof index === "number" ? "potzhenfeng" + index + ".mp3" : 2),
		chooseButton: {
			dialog(event, player) {
				const dialog = ui.create.dialog("振锋：你可以选择一项", "hidden");
				dialog.add([
					[
						["recover", "回复2点体力"],
						["cover", "修改〖酣战〗和〖战烈〗描述中的“X”值"],
					],
					"textbutton",
				]);
				return dialog;
			},
			filter(button, player) {
				switch (button.link) {
					case "recover":
						return player.isDamaged();
					case "cover":
						return ["pothanzhan", "potzhanlie"].some(skill => player.hasSkill(skill, null, null, false));
				}
			},
			check(button) {
				const player = get.player();
				if (button.link == "recover") {
					return player.getHp() + player.countCards("h", { name: "tao" }) < 2;
				}
				if (button.link == "cover") {
					let numbers = [player.getHp(), player.getDamagedHp(), game.countPlayer()];
					if (numbers.some(c => c > player.getAttackRange())) {
						return Math.max(...numbers) * 2;
					}
				}
				return 0.1;
			},
			backup(links) {
				return {
					item: links[0],
					skillAnimation: true,
					animationColor: "metal",
					log: false,
					async content(event, trigger, player) {
						player.awakenSkill("potzhenfeng");
						if (get.info(event.name).item === "recover") {
							player.logSkill("potzhenfeng", null, null, null, [null]);
							player.changeSkin({ characterName: "pot_taishici" }, "pot_taishici_shadow1");
							await player.recover(2);
						} else {
							let dialog = [],
								skills = ["pothanzhan", "potzhanlie"].filter(skill => player.hasSkill(skill, null, null, false)),
								list = [
									["hp", "当前体力值"],
									["damagedHp", "当前已损失体力值"],
									["countplayer", "场上存活角色数"],
								];
							dialog.push("振锋：修改" + skills.map(skill => "〖" + get.translation(skill) + "〗").join("和") + "描述中的“X”为...");
							for (const skill of skills) {
								dialog.push('<div class="text center">' + get.translation(skill) + "</div>");
								dialog.push([list.map(item => [item[0] + "|" + skill, item[1]]), "tdnodes"]);
							}
							const result = await player
								.chooseButton(dialog, [1, Math.min(2, skills.length)], true)
								.set("filterButton", button => {
									return !ui.selected.buttons.some(but => but.link.split("|")[1] === button.link.split("|")[1]);
								})
								.set("ai", button => {
									const player = get.player();
									switch (button.link.split("|")[0]) {
										case "hp":
											return player.getHp();
										case "damagedHp":
											return player.getDamagedHp();
										case "countplayer":
											return game.countPlayer();
									}
								})
								.forResult();
							if (result?.bool && result.links?.length) {
								player.logSkill("potzhenfeng", null, null, null, [get.rand(3, 4)]);
								let changeList = [];
								for (const link of result.links) {
									const [change, skill] = link.split("|");
									if (skill == "pothanzhan") {
										changeList.push(change);
									}
									player.storage[skill] = change;
									player.popup(skill);
									game.log(player, "修改", "#g【" + get.translation(skill) + "】", "的", "#yX", "为", "#g" + list.find(item => item[0] === change)[1]);
								}
								if (changeList[0]) {
									switch (changeList[0]) {
										case "hp":
											player.changeSkin({ characterName: "pot_taishici" }, "pot_taishici_shadow3");
											break;
										case "damagedHp":
											player.changeSkin({ characterName: "pot_taishici" }, "pot_taishici_shadow2");
											break;
										case "countplayer":
											player.changeSkin({ characterName: "pot_taishici" }, "pot_taishici_shadow4");
									}
								} else {
									player.changeSkin({ characterName: "pot_taishici" }, "pot_taishici_shadow1");
								}
							}
						}
					},
				};
			},
			prompt(links) {
				return `点击“确定”，${links[0] === "recover" ? "回复2点体力" : "修改〖酣战〗和〖战烈〗描述中的“X”值"}`;
			},
		},
		subSkill: {
			backup: {},
		},
		ai: {
			order: 15,
			threaten: 2,
			result: {
				player(player) {
					if ([player.getHp(), player.getDamagedHp(), game.countPlayer()].some(c => c > player.getAttackRange())) {
						return 10;
					}
					return get.recoverEffect(player, player, player);
				},
			},
		},
	},
};
