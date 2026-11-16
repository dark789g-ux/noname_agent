import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcquanshi" | "dcczchouxi" | "dcsbjutu" | "dcsbrenshan" | "dcsbyizhi">} */
export const groupSkills = {
	//陈祗
	dcquanshi: {
		audio: 2,
		mark: true,
		zhuanhuanji: true,
		marktext: "☯",
		usable: 1,
		intro: {
			content(storage) {
				return "每回合限一次，你使用牌时可令此牌不可响应，" + (!storage ? "摸此牌名字数张牌，若此牌造成伤害" : "弃此牌名字数张牌，若此牌未造成伤害") + "此技能视为未发动过。";
			},
		},
		trigger: {
			player: "useCard",
		},
		check(event, player) {
			const storage = player.storage.dcquanshi;
			if (!storage) {
				return player.isPhaseUsing() ? get.tag(event.card, "damage") && get.type(event.card) != "delay" : true;
			}
			return get.cardNameLength(event.card) < 3 && player.isPhaseUsing() && player.hasCard(card => get.tag(card, "damage") && get.type(card) != "delay" && player.hasUseTarget(card, true, true), "hs");
		},
		async content(event, trigger, player) {
			const storage = player.storage[event.name];
			const { card } = trigger;
			player.changeZhuanhuanji(event.name);
			trigger.directHit.addArray(game.players);
			game.log(card, "不可被响应");
			const num = get.cardNameLength(card);
			if (!storage) {
				await player.draw(num);
			} else {
				await player.chooseToDiscard("he", num, true);
			}
			player
				.when("useCardAfter")
				.filter(evt => evt.card == card)
				.step(async (event, trigger, player) => {
					const bool = player.hasHistory("sourceDamage", evt => evt.card == card);
					if ((!storage && bool) || (storage && !bool)) {
						player.refreshSkill("dcquanshi");
					}
				});
		},
	},
	dcczchouxi: {
		getList(player, event) {
			const num = player.countRoundHistory("useSkill", evt => get.sourceSkillFor(evt.skill) == "dcczchouxi") + 1;
			const vcards = get.inpileVCardList(info => {
				if (!get.is.damageCard({ name: info[2], nature: info[3] })) {
					return false;
				}
				if (typeof get.cardNameLength({ name: info[2] }) != "number" || get.cardNameLength({ name: info[2] }) > num) {
					return false;
				}
				if (!event) {
					return player.hasUseTarget({ name: info[2], nature: info[3], storage: { dcczchouxi: true } });
				}
				return event.filterCard(get.autoViewAs({ name: info[2], nature: info[3], storage: { dcczchouxi: true } }, "unsure"), player, event);
			});
			return vcards;
		},
		audio: 2,
		limited: true,
		skillAnimation: true,
		animationColor: "orange",
		enable: "phaseUse",
		onChooseToUse(event) {
			if (game.online || event.dcczchouxi) {
				return;
			}
			const player = event.player;
			const list = get.info("dcczchouxi").getList(player, event);
			event.set("dcczchouxi", list);
		},
		filter(event, player) {
			return event.dcczchouxi?.length > 0;
		},
		chooseButton: {
			dialog(event, player) {
				const list = event.dcczchouxi;
				const dialog = ui.create.dialog("仇隙", [list, "vcard"], "hidden");
				dialog.direct = true;
				return dialog;
			},
			check(button) {
				const player = get.player(),
					card = get.autoViewAs({ name: button.link[2], nature: button.link[3], storage: { dcchouxi: true } });
				return player.getUseValue(card);
			},
			backup(links, player) {
				return {
					audio: "dcczchouxi",
					popname: true,
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						isCard: true,
						storage: { dcczchouxi: true },
					},
					filterCard: () => false,
					selectCard: -1,
					async precontent(event, trigger, player) {
						player.awakenSkill("dcczchouxi");
						player.addSkill("dcczchouxi_refresh");
						player.addTempSkill("dcczchouxi_effect");
						event.getParent().addCount = false;
					},
				};
			},
			prompt(links, player) {
				return `视为使用${get.translation(links[0][3] || "")}【${get.translation(links[0][2])}】`;
			},
		},
		locked: false,
		mod: {
			cardUsable(card, player) {
				if (card?.storage?.dcczchouxi) {
					return Infinity;
				}
			},
		},
		ai: {
			order: 7,
			result: { player: 1 },
		},
		group: "dcczchouxi_damage",
		subSkill: {
			backup: {},
			damage: {
				audio: "dcczchouxi",
				trigger: { player: "damageEnd" },
				filter(event, player) {
					const list = get.info("dcczchouxi").getList(player);
					return list.length > 0;
				},
				async cost(event, trigger, player) {
					const list = get.info("dcczchouxi").getList(player);
					const result = await player
						.chooseButton([`###${get.prompt(event.skill)}###你可以视为使用其中一张牌`, [list, "vcard"]])
						.set("ai", button => {
							const player = get.player();
							return player.getUseValue({
								name: button.link[2],
								nature: button.link[3],
							});
						})
						.forResult();
					event.result = {
						bool: result?.bool,
						cost_data: result?.links,
					};
				},
				async content(event, trigger, player) {
					player.awakenSkill("dcczchouxi");
					player.addSkill("dcczchouxi_refresh");
					player.addTempSkill("dcczchouxi_effect");
					const card = get.autoViewAs({ name: event.cost_data[0][2], nature: event.cost_data[0][3], isCard: true, storage: { dcczchouxi: true } });
					await player.chooseUseTarget(card, true, false).set("prompt", `选择${get.translation(card)}的目标`);
				},
			},
			refresh: {
				charlotte: true,
				audio: "dcczchouxi",
				trigger: {
					player: "loseAfter",
					global: "loseAsyncAfter",
				},
				filter(event, player) {
					const cards = event.getl?.(player)?.hs;
					return event.type == "discard" && event.getlx !== false && cards?.length >= player.countCards("h");
				},
				forced: true,
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					player.refreshSkill("dcczchouxi");
				},
			},
			effect: {
				charlotte: true,
				audio: "dcczchouxi",
				trigger: { player: "useCard2" },
				filter(event, player) {
					if (!event.card?.storage?.dcczchouxi) {
						return false;
					}
					return game.hasPlayer(current => {
						if (!current.hasRoundHistory("sourceDamage", evt => evt.player == player, 0)) {
							return false;
						}
						return !event.targets.includes(current) && lib.filter.targetEnabled2(event.card, player, current);
					});
				},
				async cost(event, trigger, player) {
					const targets = game.filterPlayer(current => {
						if (!current.hasRoundHistory("sourceDamage", evt => evt.player == player, 0)) {
							return false;
						}
						return !trigger.targets.includes(current) && lib.filter.targetEnabled2(trigger.card, player, current);
					});
					event.result = await player
						.chooseTarget(get.prompt(event.skill), `额外指定任意个本轮对你造成过伤害的角色为${get.translation(trigger.card)}的目标`, (card, player, target) => {
							return get.event().targets.includes(target);
						})
						.set("ai", target => {
							const player = get.player();
							const trigger = get.event().getTrigger();
							return get.effect(target, trigger.card, player, player);
						})
						.set("targets", targets)
						.forResult();
				},
				async content(event, trigger, player) {
					if (!event.isMine() && !event.isOnline()) {
						await game.delayx();
					}
					trigger.targets.addArray(event.targets);
					game.log(event.targets, "成为了", trigger.card, "的目标");
				},
			},
		},
	},
	//谋刘璋
	dcsbjutu: {
		audio: 2,
		trigger: {
			player: "damageBegin4",
			global: "phaseEnd",
		},
		filter(event, player) {
			if (event.name == "phase") {
				return !player.hasHistory("damage") && player.countCards("h") <= player.getHp();
			}
			return player.countCards("h") > player.getHp() && player.countDiscardableCards(player, "he", { color: "red" });
		},
		async cost(event, trigger, player) {
			if (trigger.name == "phase") {
				event.result = await player.chooseBool(get.prompt(event.skill), `摸两张牌`).set("choice", true).forResult();
			} else {
				event.result = await player
					.chooseToDiscard(get.prompt(event.skill), "弃置一张红色牌防止该伤害", { color: "red" }, "chooseonly")
					.set("ai", card => {
						const { player, source, nature } = get.event().getTrigger();
						if (get.damageEffect(player, source, player, nature) < 0) {
							return 7 - get.value(card);
						}
						return 0;
					})
					.forResult();
			}
		},
		async content(event, trigger, player) {
			if (trigger.name == "phase") {
				await player.draw(2);
			} else {
				const { cards } = event;
				await player.modedDiscard(cards);
				trigger.cancel();
			}
		},
	},
	dcsbrenshan: {
		audio: 2,
		usable(skill, player) {
			return player.getHp();
		},
		trigger: {
			player: "gainAfter",
			global: "loseAsyncAfter",
		},
		filter(event, player) {
			return event.getParent(2).name != "dcsbrenshan" && event.getg?.(player)?.length;
		},
		check(event, player) {
			return game.hasPlayer(target => target != player && target.countCards("h") <= player.countCards("h") + 1 && get.attitude(player, target) > 0);
		},
		async content(event, trigger, player) {
			await player.draw();
			const targets = game.filterPlayer(target => target != player && target.countCards("h") <= player.countCards("h"));
			if (player.countCards("he") > 0 && targets.length > 0) {
				const result = await player
					.chooseCardTarget({
						prompt: "仁善：将一张牌交给一名手牌数不大于你的其他角色",
						filterCard: true,
						forced: true,
						position: "he",
						filterTarget(card, player, target) {
							return get.event().targets.includes(target);
						},
						targets: targets,
						ai1(card) {
							return 1 / Math.max(0.1, get.value(card));
						},
						ai2(target) {
							const player = get.player();
							let att = get.attitude(player, target);
							if (target.hasSkillTag("nogain")) {
								att /= 9;
							}
							return 4 + att;
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
		},
	},
	dcsbyizhi: {
		audio: 2,
		zhuSkill: true,
		enable: "phaseUse",
		usable: 1,
		viewAs: {
			name: "wugu",
			isCard: true,
		},
		viewAsFilter(player) {
			return game.hasPlayer(target => target.group == "qun");
		},
		filterTarget(card, player, target) {
			return target.group == "qun";
		},
		filterCard: () => false,
		selectCard: 0,
	},
};
