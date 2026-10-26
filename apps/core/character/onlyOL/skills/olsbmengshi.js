import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olsbmengshi" | "olzenhui" | "oljiaojin">} */
export const groupSkills = {
	olsbmengshi: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		skillAnimation: true,
		limited: true,
		animationColor: "wood",
		filter(event, player) {
			return (
				game
					.filterPlayer(target => target !== player)
					.map(current => {
						return current.getHp();
					})
					.toUniqued().length >= 2
			);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					if (target == player) {
						return false;
					}
					return ui.selected.targets.every(current => current.getHp() != target.getHp());
				})
				.set("selectTarget", 2)
				.set("multitarget", true)
				.set("ai", target => {
					const player = get.player();
					const trigger = _status.event.getTrigger();
					const getCache = (trigger, player) => {
						let cache = trigger.getTempCache("olsbmengshi", player.playerid);
						if (Array.isArray(cache)) {
							return cache;
						}
						// 角色体力值
						const hp = player.getHp();
						// 可以自救的牌数
						const save = player.countCards("hs", card => player.canSaveCard(card, player));
						// 获取所有其他角色
						const others = game.filterPlayer(current => current !== player);
						const list = [];
						for (let i = 0; i < others.length; i++) {
							for (let j = i + 1; j < others.length; j++) {
								const target1 = others[i];
								const target2 = others[j];
								// 相同体力值，pass
								if (target1.getHp() == target2.getHp()) {
									continue;
								}
								// 体力值的差值
								const diff = target1.getHp() - target2.getHp();
								// 差值的绝对值
								const num = Math.abs(diff);
								// 自救不回来，pass
								if (num >= save + hp) {
									continue;
								}
								// 按体力值排序组合，体力值低的在前
								const targets = diff > 0 ? [target2, target1] : [target1, target2];
								// 对低体力值角色的态度值
								const att1 = get.attitude(player, targets[0]);
								// 对高体力值角色的态度值
								const att2 = get.attitude(player, targets[1]);
								// 类别
								let type = "";
								// 敌敌
								if (att1 < 0 && att2 < 0) {
									type = "敌敌";
								}
								// 敌友，必须是低血队友换高血敌人
								else if (att1 > 0 && att2 < 0) {
									type = "敌友";
								}
								// 敌中，必须是低血中立换高血敌人
								else if (att1 == 0 && att2 < 0) {
									type = "敌中";
								}
								// 友友
								else if (att1 > 0 && att2 > 0) {
									type = "友友";
								}
								// 友中，必须是低血队友换高血中立
								else if (att1 == 0 && att2 > 0) {
									type = "友中";
								}
								// 中中
								else if (att1 == 0 && att2 == 0) {
									type = "中中";
								}
								// 其他的情况不管
								if (!type) {
									continue;
								}
								list.push({
									targets,
									type,
									diff: num,
								});
							}
						}
						const scoredList = list.map((item, index, array) => {
							const { targets, type, diff } = item;
							let score = 0;
							switch (type) {
								case "敌敌":
									if (["友", "中"].every(str => !array.some(item => item.type.startsWith(str)))) {
										if (diff <= 2) {
											score = 2 + Math.random() - diff;
										} else {
											score = 0;
										}
									}
									break;
								case "敌友":
									score = (diff + 1) * 20 + get.recoverEffect(targets[0], player, player) + get.effect(targets[1], { name: "losehp" }, player, player);
									break;
								case "敌中":
									score = diff * 20 + get.recoverEffect(targets[0], player, player) + get.effect(targets[1], { name: "losehp" }, player, player);
									break;
								case "友友":
									if (!array.some(item => item.type.startsWith("敌"))) {
										if (diff <= 2) {
											score = 3 + Math.random() - diff + Math.max(0, get.effect(targets[1], { name: "losehp" }, targets[1], targets[1])) / 2;
										} else {
											score = 0;
										}
									}
									break;
								case "友中":
									if (!array.some(item => item.type.startsWith("敌"))) {
										if (diff <= 2) {
											score = 4 + Math.random() - diff;
										} else {
											score = 0;
										}
									}
									break;
								case "中中":
									if (["敌", "友"].every(str => !array.some(item => item.type.startsWith(str)))) {
										if (diff <= 2) {
											score = 2 + Math.random() - diff;
										} else {
											score = 0;
										}
									}
									break;
							}
							return { ...item, score };
						});
						scoredList.sort((a, b) => b.score - a.score);
						trigger.putTempCache("olsbmengshi", player.playerid, scoredList);
						return scoredList;
					};
					const cache = getCache(trigger, player);
					if (!cache?.length || !cache[0].targets.includes(target)) {
						return 0;
					}
					return 1;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const [target1, target2] = event.targets.sortBySeat();
			if ([target1, target2].some(target => !target.isIn())) {
				player.chat("怎么肘了");
				return;
			}
			const num = Math.abs(target1.getHp() - target2.getHp());
			if (num) {
				await player.loseHp(num);
				const num1 = target1.getHp();
				const num2 = target2.getHp();
				if (num1 > num2) {
					await target1.loseHp(Math.abs(num1 - num2));
					await target2.recoverTo(num1);
				} else if (num2 > num1) {
					await target1.recoverTo(num2);
					await target2.loseHp(Math.abs(num1 - num2));
				}
			}
			player.addTempSkill("olsbmengshi_effect", { player: "dieAfter" });
			player.markAuto("olsbmengshi_effect", event.targets);
		},
		subSkill: {
			effect: {
				audio: "olsbmengshi",
				trigger: { global: ["dieAfter", "phaseEnd"] },
				charlotte: true,
				popup: false,
				forced: true,
				filter(event, player) {
					const storage = player.getStorage("olsbmengshi_effect");
					if (event.name == "die") {
						return storage.includes(event.player);
					}
					return storage.length;
				},
				async content(event, trigger, player) {
					if (trigger.name == "die") {
						player.removeSkill(event.name);
					} else {
						await player.draw();
						await player.recover();
					}
				},
				onremove: true,
				intro: { content: "每个回合结束时，摸一张牌并回复1点体力，直到$中的一名角色死亡" },
			},
		},
	},
	//界大虎
	olzenhui: {
		audio: 2,
		trigger: { player: "useCardToPlayer" },
		filter(event, player) {
			if (!event.targets.length || !event.isFirstTarget) {
				return false;
			}
			const card = event.card,
				info = get.info(card);
			if ((card.name != "sha" && info.type != "trick") || info.singleCard) {
				return false;
			}
			if (!player.isPhaseUsing() || player.getStorage("olzenhui_used")?.length > 1) {
				return false;
			}
			return game.hasPlayer(function (current) {
				return current != player && !event.targets.includes(current) && lib.filter.targetEnabled2(card, player, current) && lib.filter.targetInRange(card, player, current);
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), function (card, player, target) {
					if (player == target) {
						return false;
					}
					const evt = _status.event.getTrigger();
					return !evt.targets.includes(target) && lib.filter.targetEnabled2(evt.card, player, target) && lib.filter.targetInRange(evt.card, player, target);
				})
				.set("ai", function (target) {
					const trigger = _status.event.getTrigger(),
						player = _status.event.player;
					return Math.max(target.countGainableCards(player, "he") ? get.effect(target, { name: "shunshou_copy2" }, player, player) : 0, get.effect(target, trigger.card, player, player));
				})
				.forResult();
		},
		async content(event, trigger, player) {
			player.addTempSkill("olzenhui_used", "phaseUseAfter");
			const target = event.targets[0];
			const result = player.getStorage("olzenhui_used").length
				? {
						bool: true,
						index: 1 - player.getStorage("olzenhui_used")[0],
					}
				: target.countGainableCards(player, "he")
					? await target
							.chooseControl()
							.set("choiceList", [`交给${get.translation(player)}一张牌，然后代替其成为${get.translation(trigger.card)}的使用者`, `成为${get.translation(trigger.card)}的额外目标`])
							.set("ai", function () {
								const trigger = _status.event.getTrigger(),
									{ player, source } = get.event();
								if (!player.countGainableCards(source, "he")) {
									return 0;
								}
								const eff = get.effect(player, trigger.card, source, source);
								if (get.attitude(player, source) > 0 && eff < 0) {
									return 0;
								}
								return get.effect(player, { name: "shunshou_copy2" }, source, source) > eff ? 1 : 0;
							})
							.set("source", player)
							.forResult()
					: {
							bool: true,
							index: 1,
						};
			player.markAuto("olzenhui_used", [result.index]);
			const evt = trigger.getParent();
			if (result.index == 0) {
				trigger.untrigger();
				if (evt.addCount !== false) {
					evt.addCount = false;
					const stat = evt.player.getStat().card,
						name = trigger.card.name;
					if (typeof stat[name] === "number") {
						stat[name]--;
					}
				}
				evt.player = target;
				game.log(target, "成为了", trigger.card, "的使用者");
				await target.chooseToGive(player, "he", true);
			} else {
				game.log(target, "成为了", trigger.card, "的额外目标");
				evt.targets.push(target);
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	oljiaojin: {
		audio: 2,
		trigger: { player: "damageBegin4" },
		filter(event, player) {
			return player.countCards("he", card => (!get.is.damageCard(card) && get.type2(card) == "trick") || get.type(card) == "equip") > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard({
					position: "he",
					prompt: get.prompt2(event.skill),
					filterCard(card, player) {
						return (!get.is.damageCard(card) && get.type2(card) == "trick") || get.type(card) == "equip";
					},
					ai(card) {
						let player = _status.event.player;
						if (player.hp == 1 || _status.event.getTrigger().num > 1) {
							return 9 - get.value(card);
						}
						if (player.hp == 2) {
							return 8 - get.value(card);
						}
						return 7 - get.value(card);
					},
					chooseonly: true,
				})
				.forResult();
		},
		async content(event, trigger, player) {
			await player.modedDiscard({ cards: event.cards });
			await game.delay(0.5);
			trigger.cancel();
			if (trigger.cards?.someInD("od")) {
				await player.gain({ cards: trigger.cards.filterInD("od"), animate: "gain2" });
			}
		},
	},
};
