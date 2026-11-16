import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xunde" | "chenjie" | "twduwang">} */
export const groupSkills = {
	//司马孚
	xunde: {
		audio: 2,
		trigger: { global: "damageEnd" },
		filter(event, player) {
			return event.player.isIn() && get.distance(player, event.player) <= 1;
		},
		logTarget: "player",
		check(event, player) {
			return get.attitude(player, event.player) > 0 && (!event.source || get.attitude(player, event.source) < 0);
		},
		content() {
			"step 0";
			player.judge().set("callback", function () {
				if (event.judgeResult.number > 5) {
					var player = event.getParent(2)._trigger.player;
					if (get.position(card, true) == "o") {
						player.gain(card, "gain2");
					}
				}
			});
			"step 1";
			if (result.number < 7) {
				var source = trigger.source;
				if (source && source.isIn() && source.countCards("h") > 0) {
					player.line(source);
					source.chooseToDiscard("h", true);
				}
			}
		},
	},
	chenjie: {
		audio: 2,
		trigger: { global: "judge" },
		filter(event, player) {
			var suit = get.suit(event.player.judging[0], event.player);
			return (
				player.countCards("hes", function (card) {
					if (_status.connectMode && get.position(card) != "e") {
						return true;
					}
					return get.suit(card) == suit;
				}) > 0
			);
		},
		popup: false,
		preHidden: true,
		async cost(event, trigger, player) {
			const suit = get.suit(trigger.player.judging[0], trigger.player);
			event.result = await player
				.chooseCard(
					`${get.translation(trigger.player)}的${trigger.judgestr || ""}判定为${get.translation(trigger.player.judging[0])}，${get.prompt(event.skill)}`,
					"hes",
					card => {
						const { player, suit } = get.event();
						if (get.suit(card) != suit) {
							return false;
						}
						const mod2 = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
						if (mod2 != "unchanged") {
							return mod2;
						}
						const mod = game.checkMod(card, player, "unchanged", "cardRespondable", player);
						if (mod != "unchanged") {
							return mod;
						}
						return true;
					}
				)
				.set("ai", card => {
					const trigger = get.event().getTrigger();
					const { player, judging } = get.event();
					const result = trigger.judge(card) - trigger.judge(judging);
					const attitude = get.attitude(player, trigger.player);
					if (attitude == 0 || result == 0) {
						return 0.1;
					}
					if (attitude > 0) {
						return result + 0.01;
					} else {
						return 0.01 - result;
					}
				})
				.set("judging", trigger.player.judging[0])
				.set("suit", suit)
				.setHiddenSkill(event.skill)
				.forResult();
		},
		async content(event, trigger, player) {
			const next = player.respond(event.cards, event.name, "highlight", "noOrdering");
			await next;
			const { cards } = next;
			if (cards?.length) {
				if (trigger.player.judging[0].clone) {
					trigger.player.judging[0].clone.classList.remove("thrownhighlight");
					game.broadcast(function (card) {
						if (card.clone) {
							card.clone.classList.remove("thrownhighlight");
						}
					}, trigger.player.judging[0]);
					game.addVideo("deletenode", player, get.cardsInfo([trigger.player.judging[0].clone]));
				}
				await game.cardsDiscard(trigger.player.judging[0]);
				trigger.player.judging[0] = cards[0];
				trigger.orderingCards.addArray(cards);
				game.log(trigger.player, "的判定牌改为", cards);
				await player.draw(2);
			}
		},
		ai: {
			rejudge: true,
			tag: { rejudge: 0.1 },
		},
	},
	//颜良文丑，但是颜良+文丑
	twduwang: {
		audio: 2,
		dutySkill: true,
		derivation: ["twxiayong", "twylyanshix"],
		global: "twduwang_global",
		group: ["twduwang_effect", "twduwang_achieve", "twduwang_fail"],
		onremove: ["twduwang", "twduwang_fail"],
		subSkill: {
			effect: {
				audio: "twduwang1.mp3",
				trigger: { player: "phaseUseBegin" },
				filter(event, player) {
					return game.hasPlayer(target => {
						return (
							target != player &&
							target.hasCard(card => {
								if (get.position(card) == "h") {
									return true;
								}
								return target.canUse(get.autoViewAs({ name: "juedou" }, [card]), player, false);
							}, "he")
						);
					});
				},
				async cost(event, trigger, player) {
					let result = await player
						.chooseTarget([1, 3], (_, player, target) => {
							return (
								target != player &&
								target.hasCard(card => {
									if (get.position(card) == "h") {
										return true;
									}
									return target.canUse(get.autoViewAs({ name: "juedou" }, [card]), player, false);
								}, "he")
							);
						})
						.set("prompt", get.prompt(event.skill))
						.set("ai", target => {
							const player = get.event().player;
							const num = game.countPlayer(current => {
								return (
									current != player &&
									current.hasCard(card => {
										if (get.position(card) == "h") {
											return true;
										}
										return current.canUse(get.autoViewAs({ name: "juedou" }, [card]), player, false);
									}, "he") &&
									get.effect(current, { name: "guohe_copy2" }, current, player) +
										get.effect(player, { name: "juedou" }, current, player) >
										0
								);
							});
							return (
								(Math.min(num, 3) + 1) * get.effect(player, { name: "draw" }, player, player) +
								get.effect(target, { name: "guohe_copy2" }, target, player) +
								get.effect(player, { name: "juedou" }, target, player)
							);
						})
						.set("prompt2", "选择至多三名其他角色并摸选择角色数+1的牌，然后这些角色须将一张牌当作【决斗】对你使用")
						.forResult();
					if (result.bool) {
						result.targets.sortBySeat();
					}
					event.result = result;
				},
				async content(event, trigger, player) {
					const targets = event.targets;
					await player.draw(targets.length + 1);
					await game.delayx();
					for (const target of targets) {
						if (
							!target.hasCard(card => {
								return target.canUse(get.autoViewAs({ name: "juedou" }, [card]), player, false);
							}, "he")
						) {
							continue;
						}
						await target
							.chooseToUse()
							.set("forced", true)
							.set("openskilldialog", "独往：将一张牌当作【决斗】对" + get.translation(player) + "使用")
							.set("norestore", true)
							.set("_backupevent", "twduwang_backup")
							.set("targetRequired", true)
							.set("complexTarget", true)
							.set("complexSelect", true)
							.set("custom", {
								add: {},
								replace: { window() {} },
							})
							.backup("twduwang_backup")
							.set("filterTarget", function (card, player, target) {
								if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
									return false;
								}
								return lib.filter.targetEnabled.apply(this, arguments);
							})
							.set("sourcex", player)
							.set("addCount", false);
						await game.delayx();
					}
				},
			},
			backup: {
				viewAs: { name: "juedou" },
				position: "he",
				filterCard(card, player) {
					const cardx = get.autoViewAs({ name: "juedou" }, [card]);
					return lib.filter.targetEnabledx(cardx, player, get.event().sourcex);
				},
				check(card) {
					if (get.name(card) == "sha") {
						return 5 - get.value(card);
					}
					return 8 - get.value(card);
				},
				log: false,
			},
			achieve: {
				audio: "twduwang2.mp3",
				trigger: { player: "phaseZhunbeiBegin" },
				filter(event, player) {
					if (player.storage.twduwang_fail) {
						return false;
					}
					const history = player.actionHistory;
					if (history.length < 2) {
						return false;
					}
					for (let i = history.length - 2; i >= 0; i--) {
						if (history[i].isMe && !history[i].isSkipped) {
							let num = history[i].useCard.filter(evt => {
									return evt.card.name == "juedou";
								}).length,
								targets = game.players.slice().concat(game.dead.slice());
							for (const target of targets) {
								const historyx = target.actionHistory[target.actionHistory.length - (player.actionHistory.length - i)];
								if (!historyx) {
									continue;
								}
								num += historyx.useCard.filter(evt => {
									return evt.card.name == "juedou" && evt.targets && evt.targets.includes(player);
								}).length;
							}
							return num >= (targets.length < 4 ? 3 : 4);
						}
					}
					return false;
				},
				forced: true,
				skillAnimation: true,
				animationColor: "metal",
				async content(event, trigger, player) {
					player.awakenSkill("twduwang");
					game.log(player, "完成使命");
					if (player.awakenedSkills.includes("twduwang")) {
						player.restoreSkill("twduwang");
						game.log(player, "重置了技能", "#g【独往】");
					}
					if (!player.storage.twduwang_fail) {
						player.storage.twduwang_fail = true;
						game.log(player, "修改了技能", "#g【独往】");
					}
					let result,
						bool1 = player.hasSkill("twxiayong", null, false, false),
						bool2 = !player.awakenedSkills.includes("twylyanshi") && player.storage.twduwang_ylyanshi;
					if (bool1 && bool2) {
						result = { index: 2 };
					} else if (bool1) {
						result = { index: 1 };
					} else if (bool2) {
						result = { index: 0 };
					} else {
						result = await player
							.chooseControl()
							.set("choiceList", ["获得〖狭勇〗", "重置〖延势〗并为其添加历战效果"])
							.set("prompt", "独往：请选择一项")
							.set("ai", () => {
								const player = get.event().player,
									num = game.countPlayer(current => {
										return (
											current != player &&
											current.hasCard(card => {
												if (get.position(card) == "h") {
													return true;
												}
												return current.canUse(get.autoViewAs({ name: "juedou" }, [card]), player, false);
											}, "he") &&
											get.effect(current, { name: "guohe_copy2" }, current, player) / 2.5 +
												get.effect(player, { name: "juedou" }, current, player) >
												0
										);
									});
								return num >= 2 ? 0 : 1;
							})
							.forResult();
					}
					if (result.index == 0) {
						await player.addSkills("twxiayong");
					}
					if (result.index == 1) {
						player.popup("twylyanshi");
						if (player.awakenedSkills.includes("twylyanshi")) {
							player.restoreSkill("twylyanshi");
							game.log(player, "重置了技能", "#g【延势】");
						}
						if (!player.storage.twduwang_ylyanshi) {
							player.storage.twduwang_ylyanshi = true;
							game.log(player, "修改了技能", "#g【延势】");
						}
					}
				},
			},
			fail: {
				audio: "twduwang3.mp3",
				trigger: { player: "die" },
				forceDie: true,
				filter(event, player) {
					return !player.storage.twduwang_fail;
				},
				forced: true,
				content() {
					player.awakenSkill("twduwang");
					game.log(player, "使命失败");
				},
			},
			global: {
				mod: {
					cardSavable(card, player, target) {
						if (card.name == "tao" && target != player && target.hasSkill("twduwang") && !target.storage.twduwang_fail) {
							return false;
						}
					},
				},
				audio: "twduwang3.mp3",
				trigger: { player: "dying" },
				filter(event, player) {
					return player.hasSkill("twduwang") && !player.storage.twduwang_fail;
				},
				forced: true,
				content() {},
			},
		},
	},
};
