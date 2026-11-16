import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zhengbi" | "fengying" | "qiaojian" | "xicha">} */
export const groupSkills = {
	//崔琰毛玠
	zhengbi: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return game.hasPlayer(target => target != player);
		},
		direct: true,
		async content(event, trigger, player) {
			const { bool, targets } = await player
				.chooseTarget(get.prompt2("zhengbi"), lib.filter.notMe)
				.set("ai", target => {
					const player = get.event().player;
					return -get.attitude(player, target) * target.countCards("he");
				})
				.forResult();
			if (bool) {
				const target = targets[0],
					str = get.translation(target);
				player.logSkill("zhengbi", target);
				let choiceList = ["此阶段结束时，若" + str + "本阶段获得过牌，则你获得其手牌区和装备区各一张牌"];
				if (player.countCards("h", { type: "basic" })) {
					choiceList.push("交给" + str + "一张基本牌，然后其交给你一张非基本牌或两张基本牌");
				}
				const { index } = await player
					.chooseControl()
					.set("choiceList", choiceList)
					.set("ai", () => get.event().controls.length - 1)
					.forResult();
				if (index == 0) {
					player.line(target);
					player
						.when("phaseUseEnd")
						.filter(evt => evt == trigger)
						.step(async (event, trigger, player) => {
							if (target.isIn() && target.getHistory("gain", evt => evt.getParent("phaseUse") == trigger).length) {
								player.line(target);
								let num = (target.countGainableCards(player, "h") > 0) + (target.countGainableCards(player, "e") > 0);
								if (num) {
									await player.gainPlayerCard(target, num, "he", true).set("filterButton", button => {
										return !ui.selected.buttons.some(but => get.position(button.link) == get.position(but.link));
									});
								}
							}
						});
				} else {
					const { bool } = await player
						.chooseToGive(target, { type: "basic" }, true)
						.set("prompt", "征辟：交给" + str + "一张基本牌")
						.forResult();
					if (bool) {
						let choices = [];
						if (target.countCards("he", { type: ["trick", "delay", "equip"] })) {
							choices.push("一张非基本牌");
						}
						if (target.countCards("h", { type: "basic" }) > 1) {
							choices.push("两张基本牌");
						}
						if (choices.length) {
							const { control } = await target
								.chooseControl(choices)
								.set("ai", function (event, player) {
									if (choices.length > 1) {
										if (
											player.countCards("he", { type: ["trick", "delay", "equip"] }, function (card) {
												return get.value(card) < 7;
											})
										) {
											return 0;
										}
										return 1;
									}
									return 0;
								})
								.set("prompt", "征辟：交给" + get.translation(player) + "…</div>")
								.forResult();
							const check = control == "一张非基本牌";
							await target.chooseToGive("he", check ? 1 : 2, { type: check ? ["trick", "delay", "equip"] : "basic" }, player, true).set("prompt", "征辟：交给" + get.translation(player) + control);
						} else if (target.countCards("h")) {
							await target.give(target.getCards("h"), player);
						}
					}
				}
			}
		},
	},
	fengying: {
		limited: true,
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			if (!player.countCards("h")) {
				return true;
			}
			return player.countCards("h") && player.countCards("h") == player.countDiscardableCards(player, "h");
		},
		skillAnimation: true,
		animationColor: "thunder",
		manualConfirm: true,
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			if (player.countCards("h")) {
				await player.modedDiscard(player.getCards("h"));
			}
			const evt = player.insertPhase();
			player
				.when("phaseBegin")
				.filter(evtx => evtx == evt)
				.step(async () => {
					if (player.isMinHp() && player.maxHp > 0 && player.countCards("h") < player.maxHp) {
						await player.drawTo(player.maxHp);
					}
				});
		},
		ai: {
			order: 0.0001,
			result: {
				player(player) {
					return player.isMinHp() ? 1 : 0;
				},
			},
		},
	},
	// 傅干
	qiaojian: {
		enable: "phaseUse",
		locked: false,
		filter(event, player) {
			return game.hasPlayer(current => current !== player && !player.getStorage("qiaojian_used").includes(current));
		},
		selectTarget: 1,
		prompt2: "选择一名其他角色，双方同时弃置任意张牌并触发后续效果",
		filterTarget(card, player, target) {
			if (target === player) {
				return false;
			}
			if (player.getStorage("qiaojian_used").includes(target)) {
				return false;
			}
			return true;
		},
		async content(event, trigger, player) {
			const targets = event.targets;
			player.addTempSkill("qiaojian_used", "phaseChange");
			targets.forEach(target => player.markAuto("qiaojian_used", target));
			const resultMap = await game.chooseAnyOL([...targets, player], get.info(event.name).chooseToDiscard, [player, targets]).forResult();
			const resultp = resultMap.get(player);
			let discardedCards = resultp?.cards?.length ? [...resultp.cards] : [];
			for (const target of targets) {
				const resultt = resultMap.get(target);
				let numt = 0;
				if (resultt?.cards?.length) discardedCards.addArray(resultt.cards);
				resultt?.cards?.forEach(card => (numt += get.number(card)));
				let nump = 0;
				resultp?.cards?.forEach(card => (nump += get.number(card)));
				if (nump > numt) {
					await player.recover();
					const choices = ["其下个回合首次使用【杀】与锦囊牌可各额外结算一次", "其下个回合不可使用伤害牌"];
					const result = await player
						.chooseControl({
							controls: choices,
							prompt: `巧谏：选择一项令${get.translation(target)}执行`,
							forced: true,
							att: get.attitude(player, target),
							ai() {
								return get.event().att > 0 ? "其下个回合首次使用【杀】与锦囊牌可各额外结算一次" : "其下个回合不可使用伤害牌";
							},
						})
						.forResult();
					let skillNext;
					if (result.index === 0) skillNext = "qiaojian_extra";
					if (result.index === 1) skillNext = "qiaojian_nouse";
					target.addSkill("qiaojian_mark");
					target.markAuto("qiaojian_mark", skillNext);
					target
						.when("phaseBegin")
						.assign({ firstDo: true })
						.vars({ skillNext: skillNext })
						.then(async (event2, trigger2, player2) => {
							player2.addTempSkill(skillNext);
							player2.unmarkSkill("qiaojian_mark");
							player2.removeSkill("qiaojian_mark");
						});
				} else {
					if (!discardedCards.length) return;
					game.log(player, "获得了", discardedCards);
					await player.gain(discardedCards, "gain2");
					player.addGaintag(discardedCards, "qiaojian_tag");
				}
			}
		},
		mod: {
			ignoredHandcard(card, player) {
				if (card.hasGaintag("qiaojian_tag")) {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name === "phaseDiscard" && card.hasGaintag("qiaojian_tag")) {
					return false;
				}
			},
		},
		chooseToDiscard(player, source, targetList, eventId) {
			const next = player.chooseToDiscard({
				position: "he",
				selectCard: [1, Infinity],
				prompt: "巧谏：弃置任意张牌，根据弃牌点数和触发后续效果",
				ai(card) {
					// 敌人之间：如果是自己就弃到其手牌-1或2张停下(牌少只弃一张)，否则看心情决定数量
					// 队友之间：一张/不弃牌
					const player = get.player();
					const sourcex = get.event().sourcex;
					const target = get.event().targets[0];
					const att = get.attitude(sourcex, target);
					if (player === sourcex) {
						if (att < 0) {
							let num = 2;
							if (player.countCards("h") < 4) {
								num = 1;
								if (Math.random() < 0.5) num = 0;
							}
							if (ui.selected.cards.length < Math.min(2, target.countCards("h") - 1)) {
								return 6 - get.value(card);
							}
						} else {
							if (ui.selected.cards.length) return 0;
							return 6 - get.value(card);
						}
					} else {
						if (att < 0) {
							if (ui.selected.cards.length <= Math.floor(Math.random() * 4)) {
								return 6 - get.value(card);
							}
						} else {
							return 0;
						}
					}
					return 0;
				},
			});
			next.set("sourcex", source);
			next.set("id", eventId);
			next.set("targets", targetList);
			next.set("_global_waiting", true);
			return next;
		},
		ai: {
			order: 7,
			result: {
				player(player, target) {
					if (player.countCards("h") > 2) {
						if (get.attitude(player, target) < 0) {
							return 65.7 + Math.random();
						} else {
							return 66;
						}
					}
				},
			},
		},
		subSkill: {
			extra: {
				charlotte: true,
				mark: true,
				marktext: "多",
				intro: {
					markcount: () => 0,
					content: "本回合首次使用【杀】与锦囊牌可各额外结算一次",
				},
				trigger: { player: "useCard" },
				prompt2(event, player) {
					return `令${get.translation(event.card)}额外结算一次？`;
				},
				filter(event, player) {
					const card = event.card;
					if (get.type(card) !== "trick" && get.name(card) !== "sha") {
						return false;
					}
					let filter;
					const storage = player.getStorage("qiaojian_used");
					if (get.name(card) !== "sha") {
						if (storage.includes("sha")) return;
						filter = function (card) {
							return get.name(card) === "sha";
						};
					}
					if (get.type(card) !== "trick") {
						if (storage.includes("trick")) return;
						filter = function (card) {
							return get.type(card) === "trick";
						};
					}
					if (!filter) {
						return false;
					}
					if (
						player.hasHistory(
							"useCard",
							evt => {
								return evt !== event && filter(card);
							},
							event
						)
					) {
						return false;
					}
					return true;
				},
				async content(event, trigger, player) {
					player.markAuto("qiaojian_extra", get.type(trigger.card));
					game.log(get.translation(trigger.card), "额外结算一次");
					trigger.effectCount++;
				},
			},
			nouse: {
				charlotte: true,
				mark: true,
				marktext: "禁",
				intro: {
					content: "不可使用伤害牌",
				},
				mod: {
					cardEnabled(card, player) {
						if (get.tag(card, "damage")) {
							return false;
						}
					},
				},
			},
			mark: {
				mark: true,
				marktext: "巧",
				charlotte: true,
				intro: {
					name: "巧谏",
					content(storage, player) {
						if (player.getStorage("qiaojian_mark").includes("qiaojian_extra")) {
							return "下个回合首次使用【杀】与锦囊牌可各额外结算一次";
						}
						if (player.getStorage("qiaojian_mark").includes("qiaojian_nouse")) {
							return "下个回合不可使用伤害牌";
						}
					},
				},
			},
			used: {
				charlotte: true,
				onremove: true,
				mark: true,
				marktext: "谏",
				intro: {
					content: "已对$发动过",
				},
			},
		},
	},
	xicha: {
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return event.source?.hasCards("h");
		},
		getIndex(event, player) {
			return event.num;
		},
		check(event, player) {
			return get.attitude(player, event.source) < 0;
		},
		logTarget: "source",
		async content(event, trigger, player) {
			const target = trigger.source;
			const num = Math.min(target.countCards("h"), 2);
			if (!num) {
				return;
			}
			const result = await player
				.choosePlayerCard({
					prompt: `析察：秘密选择${get.translation(target)}${get.cnNumber(num)}张牌，若其下一张牌为这些牌则失效且你获得之`,
					position: "h",
					forced: true,
					visible: true,
					selectButton: num,
					ai(button) {
						const target = get.event().target;
						const card = button.link;
						const val = target.getUseValue(card);
						if (val > 0) {
							return val;
						}
						return get.value(card);
					},
					target,
				})
				.forResult();
			if (result?.bool) {
				const tag = `${event.name}_${player.playerid}`;
				game.addTempTag(tag, "invisible");
				target.addGaintag(result.links, tag);
				const effect = `${event.name}_effect`;
				player.addTempSkill(effect);
				player.markAuto(effect, [target]);
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				trigger: { global: "useCard" },
				filter(event, player) {
					return player.getStorage("xicha_effect").includes(event.player);
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const target = trigger.player;
					player.unmarkAuto(event.name, [target]);
					if (!player.getStorage(event.name).length) {
						player.removeSkill(event.name);
					}
					const card = trigger.card;
					target.removeGaintag(`xicha_${player.playerid}`);
					if (
						target.hasHistory("lose", evt => {
							const evtx = evt.relatedEvent || evt.getParent();
							return evtx === trigger && Object.values(evt.gaintag_map).flat().includes(`xicha_${player.playerid}`);
						})
					) {
						trigger.targets.length = 0;
						trigger.all_excluded = true;
						game.log(card, "被无效了");
						if (trigger.cards?.someInD()) {
							await player.gain(trigger.cards.filterInD(), "gain2");
						}
					}
				},
			},
		},
	},
};
