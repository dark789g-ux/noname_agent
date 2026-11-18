import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "mbganggeng" | "mbsijian" | "mbrunwei">} */
export const groupSkills = {
	//手杀田丰
	mbganggeng: {
		audio: 4,
		logAudio: index => (typeof index === "number" ? "mbganggeng" + index + ".mp3" : 2),
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h") > 1;
		},
		filterCard: true,
		selectCard: [2, Infinity],
		filterTarget: lib.filter.notMe,
		lose: false,
		discard: false,
		delay: false,
		check(card) {
			if (get.player().countCards("h") < 3) {
				8 - get.value(card);
			}
			return 7 - get.value(card);
		},
		allowChooseAll: true,
		async content(event, trigger, player) {
			const cards = event.cards,
				target = event.targets[0];
			await player.give(cards, target);
			player.addTempSkill(event.name + "_effect");
			player.markAuto(event.name + "_effect", [target]);
		},
		subSkill: {
			effect: {
				intro: {
					content: "players",
				},
				onremove: true,
				charlotte: true,
				forced: true,
				popup: false,
				trigger: { player: "phaseEnd" },
				filter(event, player) {
					return lib.skill.mbganggeng_effect.logTarget(event, player).length;
				},
				logTarget(event, player) {
					return player
						.getStorage("mbganggeng_effect")
						.filter(target => target.isIn())
						.sortBySeat();
				},
				async content(event, trigger, player) {
					const targets = lib.skill[event.name].logTarget(trigger, player);
					for (const target of targets) {
						player.logSkill("mbganggeng", [target], null, null, [target.isMaxHandcard() ? 3 : 4]);
						if (target.isMaxHandcard()) {
							await player.draw();
						} else {
							await player.discardPlayerCard(target, "hej", true);
						}
					}
				},
			},
		},
		ai: {
			order: 5,
			result: {
				target(player, target) {
					return 1;
				},
			},
		},
	},
	mbsijian: {
		audio: 2,
		trigger: {
			player: ["loseAfter", "dying"],
			global: ["loseAsyncAfter", "equipAfter", "addJudgeAfter", "gainAfter", "addToExpansionAfter"],
		},
		usable: 2,
		filter(event, player) {
			if (event.name == "dying") {
				return true;
			}
			return event.getl(player)?.hs?.length && !player.countCards("h");
		},
		async cost(event, trigger, player) {
			const count = player.getAllHistory("useSkill", evt => evt.skill == event.skill && evt.event.mbsijian_both).length;
			const result = await player
				.chooseButton([
					get.prompt(event.skill),
					[
						[
							["discard", `令一名其他角色使用下一张牌后需弃置一张牌`],
							["draw", `令当前回合角色摸两张牌`],
							["both", `背水！执行以上所有选项，然后失去${count}点体力`],
						],
						"textbutton",
					],
				])
				.set("filterButton", button => {
					const bool1 = game.hasPlayer(target => target != get.player()),
						bool2 = _status.currentPhase?.isIn();
					if (button.link == "discard") {
						return bool1;
					}
					if (button.link == "draw") {
						return bool2;
					}
					if (button.link == "both") {
						return (bool1 || bool2) && !_status.dying.length;
					}
				})
				.set("ai", button => {
					if (button.link == "discard") {
						return 1;
					}
					const target = _status.currentPhase;
					if (target?.isIn() && get.attitude(get.player(), target) > 0) {
						if (button.link == "both") {
							return get.event().count > 1 ? 0 : 3;
						}
						return 2;
					}
					return 0;
				})
				.set("count", count)
				.forResult();
			if (result?.links) {
				event.result = {
					bool: true,
					cost_data: result.links[0],
				};
			}
		},
		async content(event, trigger, player) {
			const link = event.cost_data;
			if (link != "draw" && game.hasPlayer(target => target != player)) {
				const result = await player
					.chooseTarget(`死谏：令一名其他角色使用下一张牌后需弃置一张牌`, true, lib.filter.notMe)
					.set("ai", target => {
						const has = target.hasSkill("mbsijian_handcard") ? 0 : 2;
						return -get.attitude(get.player(), target) * target.countCards("he") + has;
					})
					.forResult();
				if (result?.targets) {
					const target = result.targets[0];
					player.line(target);
					target.addSkill(event.name + "_discard");
				}
			}
			if (link != "discard" && _status.currentPhase?.isIn()) {
				await _status.currentPhase.draw(2);
			}
			if (link == "both") {
				const num = player.getAllHistory("useSkill", evt => evt.skill == event.name && evt.event.mbsijian_both).length;
				await player.loseHp(num);
				event.getParent().set("mbsijian_both", true);
			}
		},
		subSkill: {
			discard: {
				trigger: { player: "useCardAfter" },
				forced: true,
				charlotte: true,
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					if (player.countDiscardableCards(player, "he")) {
						await player.chooseToDiscard({
							position: "he",
							forced: true,
						});
					}
				},
				intro: {
					content: "下次使用牌后弃置一张牌",
				},
				mark: true,
			},
		},
	},
	//手杀陆郁生
	mbrunwei: {
		audio: 4,
		logAudio: index => (typeof index === "number" ? "mbrunwei" + index + ".mp3" : 2),
		enable: "phaseUse",
		usable: 1,
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog(get.prompt2("mbrunwei"));
			},
			chooseControl(event, player) {
				return [1, 2, 3, 4, 5, "cancel2"];
			},
			check() {
				return 4;
			},
			backup(result, player) {
				return {
					num: result.control,
					log: false,
					delay: false,
					async content(event, trigger, player) {
						const num = lib.skill.mbrunwei_backup.num,
							skill = "mbrunwei";
						const cards = get.cards(num, true);
						player.logSkill("mbrunwei", null, null, null, [get.rand(1, 2)]);
						await player.showCards(cards, `${get.translation(player)}发动了【${get.translation(skill)}】`);
						const used = player.hasSkill(skill + "_twice");
						if (
							used &&
							!game.hasPlayer(target => {
								return !target.hasHistory("gain", evt => evt.cards?.length);
							})
						) {
							return;
						}
						const list = get.addNewRowList(cards, "color");
						const result = await player
							.chooseButtonTarget({
								createDialog: [
									[
										[[`润微：选择一名角色令其获得其中一种颜色的牌`], "addNewRow"],
										[
											dialog => {
												dialog.forcebutton = false;
												dialog._scrollset = false;
												dialog.css({
													top: "20%",
												});
											},
											"handle",
										],
										list.map(item => [Array.isArray(item) ? item : [item], "addNewRow"]),
									],
								],
								forced: true,
								used: used,
								targetsx: game.filterPlayer(target => !target.hasHistory("gain", evt => evt.cards?.length)),
								filterButton(button) {
									return button.links.length;
								},
								filterTarget(card, player, target) {
									if (get.event().used) {
										return get.event().targetsx?.includes(target);
									}
									return true;
								},
								ai1(button) {
									return button.links.length;
								},
								ai2(target) {
									const player = get.player();
									if (!get.event().used && player == target) {
										return 114514;
									}
									return get.attitude(player, target);
								},
							})
							.forResult();
						if (result?.links?.length && result?.targets.length) {
							const target = result.targets[0],
								gain = cards.filter(card => get.color(card, false) == result.links[0]);
							player.line(target);
							if (!player.hasSkill(skill + "_twice")) {
								player.addTempSkill(skill + "_twice", "phaseChange");
								player.addMark(skill + "_twice", gain.length, false);
								player.addTip(skill + "_twice", `润微  ${gain.length}`);
							}
							let gaintag = [];
							if (player == target) {
								gaintag = ["mbrunwei"];
								player
									.when({ player: "phaseUseEnd" })
									.filter(evt => event.getParent("phaseUse") == evt)
									.step(async () => {
										const cards = player.getCards("h", card => card.hasGaintag("mbrunwei"));
										if (cards.length) {
											player.logSkill("mbrunwei", null, null, null, [4]);
											await player.modedDiscard(cards, player);
										}
									});
							}
							const next = target.gain(gain, "gain2");
							next.gaintag.addArray(gaintag);
							await next;
						}
					},
				};
			},
		},
		ai: {
			order: 10,
			result: {
				player(player) {
					const used = player.hasSkill("mbrunwei_twice");
					if (!used) {
						return 1;
					} else if (
						game.hasPlayer(target => {
							return !target.hasHistory("gain", evt => evt.cards.length) && get.attitude(player, target) > 0;
						})
					) {
						return 1;
					}
					return 0;
				},
			},
		},
		subSkill: {
			twice: {
				onremove(player, skill) {
					delete player.storage[skill];
					player.removeTip(skill);
				},
				intro: {
					markcount: "mark",
					content: "再失去#张牌重置技能",
				},
				trigger: {
					player: "loseAfter",
					global: ["loseAsyncAfter", "equipAfter", "gainAfter", "addToExpansionAfter", "addJudgeAfter"],
				},
				filter(event, player) {
					if (!event.getl?.(player)?.cards2?.length || !player.hasMark("mbrunwei_twice")) {
						return false;
					}
					const cards = event.getl(player).cards2;
					return event.getParent()?.name != "useCard" || cards.some(card => get.type(card) != "equip");
				},
				silent: true,
				async content(event, trigger, player) {
					const num = trigger.getl(player)?.cards2?.length;
					if (num >= player.countMark(event.name)) {
						player.logSkill("mbrunwei", null, null, null, [3]);

						const info = get.info(event.name);
						if (typeof info.onremove === "function") {
							info.onremove(player, event.name);
						}
						player.unmarkSkill(event.name);
						delete player.getStat().skill.mbrunwei;
						game.log(player, "重置了", `#g【${get.translation(event.name)}】`);
					} else {
						player.removeMark(event.name, num, false);
						player.addTip(event.name, `润微  ${player.countMark(event.name)}`);
					}
				},
			},
		},
	},
};
