import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twanguo" | "twhuantu" | "twbihuo">} */
export const groupSkills = {
	//TW朱治
	twanguo: {
		audio: "sbanguo",
		trigger: { global: "phaseBefore", player: "enterGame" },
		group: ["twanguo_move", "twanguo_draw", "twanguo_dying"],
		logAudio: () => 2,
		filter(event, player) {
			return game.hasPlayer(current => current != player) && (event.name != "phase" || game.phaseNumber == 0);
		},
		async cost(event, trigger, player) {
			event.result = await player.chooseTarget("安国：令一名其他角色获得“安国”标记", lib.filter.notMe, true).forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			target.markAuto(event.name + "_effect", ["draw", "handcard", "dying"]);
			target.addMark(event.name + "_mark", 1);
			target.addAdditionalSkill(event.name + "_" + player.playerid, event.name + "_mark");
		},
		subSkill: {
			mark: {
				onremove: ["twanguo_mark", "twanguo_effect"],
				marktext: "安",
				charlotte: true,
				intro: {
					name: "安国",
					name2: "安国",
					content(storage, player, skill) {
						let str = "目前拥有的效果：";
						const effect = player.getStorage("twanguo_effect");
						if (!effect?.length) {
							str += "<br>无";
						} else {
							effect.forEach(name => {
								switch (name) {
									case "draw":
										str += "<br><li>摸牌阶段额外摸一张牌";
										break;
									case "handcard":
										str += "<br><li>手牌上限等于其体力上限";
										break;
									case "dying":
										str += "<br><li>脱离濒死状态后，摸一张牌";
										break;
								}
							});
						}
						return str;
					},
				},
				forced: true,
				trigger: { player: ["phaseDrawBegin1", "dyingAfter"] },
				filter(event, player) {
					const storage = player.getStorage("twanguo_effect");
					if (event.name == "phaseDraw") {
						return !event.numFixed && storage.includes("draw");
					}
					return storage.includes("dying");
				},
				async content(event, trigger, player) {
					if (trigger.name == "phaseDraw") {
						trigger.num++;
					} else {
						await player.draw();
					}
				},
				mod: {
					maxHandcardBase(player, num) {
						if (player.getStorage("twanguo_effect").includes("handcard")) {
							return player.maxHp;
						}
						return num;
					},
				},
			},
			move: {
				audio: ["sbanguo1.mp3", "sbanguo2.mp3"],
				trigger: { player: "phaseUseBegin" },
				filter(event, player) {
					return (
						game.hasPlayer(current => current.hasSkill("twanguo_mark")) &&
						game.hasPlayer(current => !current.hasMark("twanguo_mark") && current != player)
					);
				},
				async cost(event, trigger, player) {
					const targets = game.filterPlayer(current => current.hasSkill("twanguo_mark"));
					const prompt2 =
						targets.length == 1
							? "将" + get.translation(targets[0]) + "的“安国”交给一名其他角色"
							: "选择一名有“安国”的角色，将该标记交给一名未拥有“安国”的其他角色";
					const result = await player
						.chooseTarget(get.prompt("twanguo"), prompt2, targets.length == 1 ? 1 : 2, (card, player, target) => {
							if (ui.selected.targets.length == 0 && _status.event.targets.length > 1) {
								return target.hasSkill("twanguo_mark");
							}
							return !target.hasMark("twanguo_mark") && target != player;
						})
						.set("ai", target => {
							var player = _status.event.player;
							if (ui.selected.targets.length == 0 && _status.event.targets.length > 1) {
								return -get.attitude(player, target);
							}
							return get.attitude(player, _status.event.targets[0]) < get.attitude(player, target);
						})
						.set("targets", targets)
						.set("animate", false)
						.forResult();
					event.result = {
						bool: result?.bool,
						cost_data: result?.targets,
					};
				},
				async content(event, trigger, player) {
					const targets = event.cost_data;
					let target1, target2;
					if (targets.length == 1) {
						target1 = game.filterPlayer(current => current.hasSkill("twanguo_mark"))[0];
						target2 = targets[0];
					} else {
						target1 = targets[0];
						target2 = targets[1];
					}
					player.line2([target1, target2], "green");
					const map = target1.additionalSkills;
					for (const key in map) {
						if (key.indexOf("twanguo_") != 0) {
							continue;
						}
						const id = parseInt(key.slice(8));
						target2.markAuto("twanguo_effect", target1.getStorage("twanguo_effect"));
						target1.removeAdditionalSkill("twanguo_" + id);
						target2.addMark("twanguo_mark", 1);
						target2.addAdditionalSkill("twanguo_" + id, "twanguo_mark");
					}
				},
			},
			draw: {
				audio: ["sbanguo1.mp3", "sbanguo2.mp3"],
				enable: "phaseUse",
				usable: 1,
				prompt: "摸等同于一名拥有“安国”标记的角色已损失体力值张牌，并交给其等量的牌",
				filter(event, player) {
					return game.hasPlayer(target => target.hasMark("twanguo_mark") && target.isDamaged());
				},
				filterTarget(card, player, target) {
					return target.hasMark("twanguo_mark") && target.isDamaged();
				},
				async content(event, trigger, player) {
					const { target } = event,
						num = target.getDamagedHp();
					await player.draw(num);
					await player.chooseToGive(target, num, "he", true);
				},
				ai: {
					order: 7,
					result: {
						target: 1,
					},
				},
			},
			dying: {
				audio: "sbanguo3.mp3",
				trigger: { global: "dying" },
				filter(event, player) {
					const skill = "twanguo_effect";
					if (event.player == player) {
						return game.hasPlayer(target => target.getStorage(skill).length > 0);
					}
					if (event.player.hasMark("twanguo_mark")) {
						return event.player.getStorage(skill).length > 0;
					}
					return false;
				},
				logTarget: "player",
				async cost(event, trigger, player) {
					const createDialog = [
							`###${get.prompt(event.skill, trigger.player)}###移去一个效果令其将体力回复至1点`,
							[
								[
									["draw", "摸牌阶段额外摸一张牌"],
									["handcard", "手牌上限等于其体力上限"],
									["dying", "脱离濒死状态后，摸一张牌"],
								],
								"textbutton",
							],
						],
						target = trigger.player;
					if (trigger.player == player) {
						const result = await player
							.chooseButtonTarget({
								createDialog: createDialog,
								filterButton(button) {
									return game.hasPlayer(target => target.getStorage("twanguo_effect").includes(button.link));
								},
								complexTarget: true,
								filterTarget(card, player, target) {
									const link = ui.selected.buttons?.[0]?.link;
									if (link) {
										return target.getStorage("twanguo_effect").includes(link);
									}
									return false;
								},
								ai1(button) {
									switch (button.link) {
										case "draw":
											return 4;
										case "handcard":
											return 3;
										case "dying":
											return 5;
									}
								},
								ai2(target) {
									const player = get.player(),
										att = get.attitude(player, target),
										link = ui.selected.buttons?.[0]?.link;
									if (!link) {
										return 0;
									}
									if (att < 0) {
										return -att + 2;
									}
									if (
										player.countCards("h", function (card) {
											const mod2 = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
											if (mod2 != "unchanged") {
												return mod2;
											}
											const mod = game.checkMod(card, player, player, "unchanged", "cardSavable", player);
											if (mod != "unchanged") {
												return mod;
											}
											let savable = get.info(card).savable;
											if (typeof savable == "function") {
												savable = savable(card, player, player);
											}
											return savable;
										}) >=
										1 - player.hp
									) {
										return 0;
									}
									return 1;
								},
							})
							.forResult();
						event.result = {
							bool: result?.bool,
							cost_data: {
								link: result?.links?.[0],
								remover: result?.targets?.[0],
							},
						};
					} else {
						const result = await player
							.chooseButton(createDialog)
							.set("filterButton", button => {
								return get.event().targetx.getStorage("twanguo_effect").includes(button.link);
							})
							.set("targetx", target)
							.set("ai", button => {
								const player = get.player(),
									target = get.event().targetx,
									att = get.attitude(player, target);
								if (
									att <= 0 ||
									player.countCards("h", function (card) {
										const mod2 = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
										if (mod2 != "unchanged") {
											return mod2;
										}
										const mod = game.checkMod(card, player, target, "unchanged", "cardSavable", player);
										if (mod != "unchanged") {
											return mod;
										}
										let savable = get.info(card).savable;
										if (typeof savable == "function") {
											savable = savable(card, player, target);
										}
										return savable;
									}) >=
										1 - target.hp
								) {
									return 0;
								}
								switch (button.link) {
									case "draw":
										return 4;
									case "handcard":
										return 3;
									case "dying":
										return 5;
								}
							})
							.forResult();
						event.result = {
							bool: result?.bool,
							cost_data: {
								link: result?.links?.[0],
							},
						};
					}
				},
				async content(event, trigger, player) {
					const link = event.cost_data.link;
					let remover;
					if (event.cost_data.remover) {
						remover = event.cost_data.remover;
					} else {
						remover = trigger.player;
					}
					player.line(remover);
					remover.unmarkAuto("twanguo_effect", link);
					await trigger.player.recoverTo(1);
				},
			},
		},
	},
	//TW阎圃
	twhuantu: {
		audio: "huantu",
		trigger: { global: "phaseDrawBefore" },
		round: 1,
		filter(event, player) {
			return player.countCards("he") > 0 && event.player != player;
		},
		checkx(event, player) {
			const target = event.player;
			return (
				get.attitude(player, target) > 0 &&
				(target.hasSkill("pingkou") ||
					target.skipList.includes("phaseUse") ||
					(target.isDamaged() && target.hp <= 2) ||
					target.needsToDiscard())
			);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard(get.prompt(event.skill, trigger.player), "交给其一张牌并令其暂时跳过摸牌阶段", "he")
				.set("ai", function (card) {
					if (!_status.event.checkx) {
						return 0;
					}
					return 1 + Math.random();
				})
				.set("checkx", lib.skill.huantu.checkx(trigger, player))
				.forResult();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const target = event.targets[0],
				{ cards } = event;
			await player.give(cards, target);
			trigger.cancel();
			player.addTempSkill(event.name + "_effect");
		},
		subSkill: {
			effect: {
				audio: "huantu",
				trigger: { global: "phaseJieshuBegin" },
				forced: true,
				charlotte: true,
				logTarget: "player",
				filter(event, player) {
					return event.player.isIn();
				},
				async content(event, trigger, player) {
					const target = trigger.player,
						str = get.translation(target),
						list = ["令" + str + "回复1点体力并摸两张牌", "摸三张牌，然后交给" + str + "两张手牌"];
					const result = await player
						.chooseControl()
						.set("choiceList", list)
						.set("choice", target.isDamaged() ? 0 : 1)
						.forResult();
					const funcs = [
						async function () {
							await target.recover();
							await target.draw(2);
						},
						async function () {
							await player.draw(3);
							if (player.countCards("h") && target.isIn()) {
								await player.chooseToGive(target, "h", 2, true);
							}
						},
					];
					await funcs[result?.index]?.();
					if (!target.hasHistory("sourceDamage", evt => evt.num) && player.inRange(target)) {
						const index = 1 - result.index;
						const result2 = await player
							.chooseBool("缓图：是否执行另一项？", list[index])
							.set("choice", get.attitude(player, target) > 0)
							.forResult();
						if (!result2.bool) {
							return;
						}
						await funcs[index]?.();
					}
				},
			},
		},
	},
	twbihuo: {
		audio: "bihuo",
		trigger: { global: "dyingAfter" },
		logTarget: "player",
		limited: true,
		skillAnimation: true,
		animationColor: "gray",
		filter(event, player) {
			return event.player.isIn();
		},
		check(event, player) {
			return get.attitude(player, event.player) > 0;
		},
		async content(event, trigger, player) {
			const target = trigger.player,
				skill = event.name + "_effect",
				num = Math.max(3, game.countPlayer());
			player.awakenSkill(event.name);
			await target.draw(num);
			target.addTempSkill(skill, "roundStart");
			target.addMark(skill, num, false);
		},
		subSkill: {
			effect: {
				onremove: true,
				charlotte: true,
				mod: {
					globalTo(from, to, distance) {
						return distance + to.countMark("twbihuo_effect");
					},
				},
				intro: { content: "其他角色至你的距离+#" },
			},
		},
	},
};
