import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbshibian" | "dcsbbibu" | "dcsbzhenjian" | "dcsbxixing">} */
export const groupSkills = {
	//谋吴懿
	dcsbshibian: {
		audio: 2,
		trigger: {
			global: "roundStart",
		},
		filter(event, player) {
			return game.hasPlayer(current => current != player);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), lib.filter.notMe)
				.set("ai", target => {
					const player = get.player();
					const targets = game.filterPlayer(current => {
						if (player.inRange(current) || get.attitude(player, current) > 0) {
							return false;
						}
						return target.inRange(current);
					});
					return targets.length + 1;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const skill = `${event.name}_effect`;
			player.addTempSkill(skill, { global: "roundStart" });
			player.markAuto(skill, event.targets);
			player.addTip(
				skill,
				`识变 ${player
					.getStorage(skill)
					.map(i => get.translation(i))
					.join(" ")}`
			);
		},
		subSkill: {
			effect: {
				audio: "dcsbshibian",
				charlotte: true,
				onremove(player, skill) {
					player.removeTip(skill);
					player.setStorage(skill, null, true);
				},
				intro: {
					content: "本轮在$攻击范围内的角色视为在你攻击范围内",
				},
				trigger: {
					player: "useCard",
				},
				filter(event, player) {
					if (event.card.name != "sha" && get.type(event.card) != "trick") {
						return false;
					}
					const list = player.getStorage("dcsbshibian_effect");
					if (!list.length) {
						return false;
					}
					return game.hasPlayer(current => {
						if (event.targets?.includes(current)) {
							return false;
						}
						if (!lib.filter.targetEnabled2(event.card, event.player, current)) {
							return false;
						}
						return list.some(target => target.inRange(current));
					});
				},
				async cost(event, trigger, player) {
					const list = player.getStorage(event.skill);
					const targets = game.filterPlayer(current => {
						if (trigger.targets?.includes(current)) {
							return false;
						}
						if (!lib.filter.targetEnabled2(trigger.card, trigger.player, current)) {
							return false;
						}
						return list.some(target => target.inRange(current));
					});
					event.result = await player
						.chooseTarget(get.prompt(event.skill), `令一名在本轮〖识变〗目标攻击范围内的角色成为${get.translation(trigger.card)}的额外目标`, (card, player, target) => {
							return get.event().targetx.includes(target);
						})
						.set("targetx", targets)
						.set("ai", target => {
							const player = get.player(),
								trigger = get.event().getTrigger();
							return get.effect(target, trigger.card, trigger.player, player);
						})
						.forResult();
				},
				locked: false,
				async content(event, trigger, player) {
					const { targets } = event;
					game.log(targets, "成为", trigger.card, "的额外目标");
					trigger.targets.addArray(targets);
				},
				mod: {
					inRange(from, to) {
						const list = from.getStorage("dcsbshibian_effect");
						if (!list.length) {
							return;
						}
						if (
							list.some(current => {
								if (current._isInShibian) {
									return false;
								}
								current._isInShibian = true;
								const bool = current.inRange(to);
								delete current._isInShibian;
								return bool;
							})
						) {
							return true;
						}
					},
				},
			},
		},
	},
	dcsbbibu: {
		audio: 2,
		trigger: {
			global: ["useCardToTarget", "useCardAfter"],
		},
		filter(event, player) {
			if (event.card.name != "sha" && get.type(event.card) != "trick") {
				return false;
			}
			const target = event.name == "useCard" ? event.player : event.target;
			if (target != player.getNext() && target != player.getPrevious()) {
				return false;
			}
			if (event.name == "useCard") {
				return target.getHistory("useCard", evt => evt.card.name == "sha" || get.type(evt.card) == "trick").indexOf(event) == 0;
			}
			if (event.targets?.length != 1) {
				return false;
			}
			const evts = game.getGlobalHistory("useCard", evt => (evt.card.name == "sha" || get.type(evt.card) == "trick") && (evt.targets?.includes(target) || evt.dcsbbibu == target) && evt.player != player);
			return evts.indexOf(event.getParent()) == 0;
		},
		logTarget(event, player) {
			return event.name == "useCard" ? event.player : event.target;
		},
		prompt2(event, player) {
			if (event.name == "useCard") {
				return `摸一张牌，然后可以视为使用${get.translation(event.card)}`;
			}
			return `摸一张牌并令${get.translation(event.card)}的目标改为自己`;
		},
		check(event, player) {
			const { card, player: source, target } = event;
			if (event.name == "useCard") {
				if (card.name == "wuxie") {
					return get.effect(player, { name: "draw" }, player, player) > 0;
				}
				return player.getUseValue(get.autoViewAs({ name: card.name, nature: card.nature, isCard: true })) > 0;
			}
			//嘻嘻，我一定要活下去口牙
			return get.effect(target, card, source, player) < get.effect(player, card, source, player);
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			await player.draw();
			if (trigger.name == "useCard") {
				const card = get.autoViewAs({ name: trigger.card.name, nature: trigger.card.nature, isCard: true });
				await player.chooseUseTarget(card, false);
				return;
			}
			game.log(trigger.card, "的目标改为", player);
			trigger.targets.remove(target);
			trigger.getParent().triggeredTargets2.remove(target);
			trigger.getParent()[event.name] = target;
			trigger.untrigger();
			trigger.targets.push(player);
		},
	},
	//谋法正
	dcsbzhenjian: {
		audio: 2,
		trigger: { global: "roundStart" },
		filter(event, player) {
			return game.hasPlayer(current => current != player);
		},
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			const list = get.inpileVCardList(info => {
				return info[0] == "trick";
			});
			if (!list.length || !game.hasPlayer(current => current != player)) {
				return;
			}
			const result = await player
				.chooseButtonTarget({
					createDialog: [`###缜鉴###<div class='text center'>请选择一名其他角色和一个普通锦囊牌的牌名</div>`, [list, "vcard"]],
					filterTarget: lib.filter.notMe,
					forced: true,
					ai1(button) {
						return button.link[2] == "wanjian" ? 2 : Math.random();
					},
					ai2(target) {
						const player = get.player();
						return Math.max(0.1, get.attitude(player, target));
					},
				})
				.forResult();
			if (result?.bool) {
				const {
					targets: [target],
					links: [link],
				} = result;
				const skill = "dcsbzhenjian";
				player.addTip(skill, `缜鉴 ${get.translation(target)}`);
				player.setStorage(skill, [target, link[2]], true);
				player
					.when({ global: "roundStart" })
					.filter(evt => evt != trigger)
					.step(async (event, trigger, player) => {
						player.setStorage(skill, null, true);
						player.removeTip(skill);
					});
			}
		},
		onremove(player, skill) {
			player.setStorage(skill, null, true);
			player.removeTip(skill);
		},
		marktext: "鉴",
		intro: {
			name: "缜鉴",
			mark(dialog, storage, player) {
				const list = player.getStorage("dcsbzhenjian");
				if (!list.length) {
					return "无信息";
				}
				if (player == game.me || player.isUnderControl()) {
					dialog.addSmall([[list[1]], "vcard"]);
					dialog.addText(`本轮${get.translation(list[0])}使用普通锦囊牌时，若不为${get.translation(list[1])}，你可为此牌增加或减少一个目标（目标数至少为1），否则你摸一张牌且【缜鉴】本回合失效`, false);
				} else {
					return `${get.translation(player)}本轮缜鉴了${get.translation(list[0])}`;
				}
			},
		},
		group: "dcsbzhenjian_sheyan",
		subSkill: {
			sheyan: {
				audio: "dcsbzhenjian",
				trigger: { global: "useCard" },
				filter(event, player) {
					const list = player.getStorage("dcsbzhenjian");
					if (!list.length || event.player != list[0] || get.type(event.card) != "trick") {
						return false;
					}
					if (event.card.name == list[1]) {
						return true;
					}
					if (!event.targets?.length) {
						return false;
					}
					return game.hasPlayer(current => {
						if (event.targets?.includes(current)) {
							return event.targets.length > 1;
						}
						return lib.filter.targetEnabled2(event.card, event.player, current);
					});
				},
				async cost(event, trigger, player) {
					const list = player.getStorage("dcsbzhenjian");
					if (trigger.card.name == list[1]) {
						event.result = { bool: true };
					} else {
						const targets = game.filterPlayer(current => {
							if (trigger.targets?.includes(current)) {
								if (trigger.targets.length > 1) {
									return true;
								}
							} else if (lib.filter.targetEnabled2(trigger.card, trigger.player, current)) {
								return true;
							}
							return false;
						});
						const next = player
							.chooseTarget(get.prompt(event.skill), `为${get.translation(trigger.card)}增加或减少一个目标（至少为1）`, (card, player, target) => {
								return get.event().targetx.includes(target);
							})
							.set("targetx", targets)
							.set("ai", target => {
								const player = get.player(),
									trigger = get.event().getTrigger(),
									eff = get.effect(target, trigger.card, trigger.player, player);
								if (trigger.targets.includes(target)) {
									return -eff;
								}
								return eff;
							});
						next.set(
							"targetprompt2",
							next.targetprompt2.concat([
								target => {
									if (!target.isIn() || !get.event().filterTarget(null, get.player(), target)) {
										return false;
									}
									const trigger = get.event().getTrigger();
									if (trigger.targets?.includes(target)) {
										return "减少目标";
									}
									return "增加目标";
								},
							])
						);
						event.result = await next.forResult();
					}
				},
				async content(event, trigger, player) {
					if (!event.targets?.length) {
						await player.draw();
						player.tempBanSkill("dcsbzhenjian");
					} else {
						const {
							targets: [target],
						} = event;
						const bool = trigger.targets.includes(target);
						trigger.targets[bool ? "remove" : "add"](target);
					}
				},
			},
		},
	},
	dcsbxixing: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(current => current != player && current.countCards("h") > 0);
		},
		filterTarget(card, player, target) {
			return player != target && target.countCards("h") > 0;
		},
		async content(event, trigger, player) {
			const { target, name } = event;
			if (!target.countCards("h")) {
				return;
			}
			const bool = target.countGainableCards(player, "h");
			if (bool) {
				await player.gainPlayerCard(target, "h", true, "visible");
			} else {
				await player.viewHandcards(target);
			}
			player.setStorage("dcsbxixing_record", target);
			player.addTempSkill("dcsbxixing_record", { global: "phaseAnyAfter" });
		},
		subSkill: {
			record: {
				trigger: {
					player: "useCard1",
				},
				init(player, skill) {
					const target = player.getStorage(skill);
					if (get.itemtype(target) == "player") {
						player.addTip(skill, `悉性 ${get.translation(target)}`);
					}
				},
				charlotte: true,
				onremove(player, skill) {
					player.removeTip(skill);
					player.setStorage(skill, null);
				},
				direct: true,
				async content(event, trigger, player) {
					const target = player.getStorage(event.name),
						name = "dcsbxixing";
					player
						.when("useCardAfter")
						.filter(evt => evt == trigger)
						.step(async (event, trigger, player) => {
							if (get.itemtype(target) != "player") {
								return;
							}
							if (target.hasHistory("damage", evt => evt.card == trigger.card)) {
								if (player.getStat("skill")[name]) {
									delete player.getStat("skill")[name];
									game.log(player, "重置了", "#g【悉性】");
								}
							}
						});
					player.removeSkill(event.name);
				},
				mod: {
					aiOrder(player, card, num) {
						const target = player.getStorage("dcsbxixing_record");
						if (!target?.isIn()) {
							return num;
						}
						if (get.tag(card, "damage") && !player.hasSkillTag("jueqing", false, target)) {
							return num * 10;
						}
					},
				},
				ai: {
					effect: {
						player(card, player, target) {
							if (target != player.getStorage("dcsbxixing_record")) {
								return;
							}
							if (!get.tag(card, "damage")) {
								return;
							}
							if (player.hasSkillTag("jueqing", false, target)) {
								return;
							}
							return [1, 2499];
						},
					},
				},
			},
		},
		ai: {
			order: 9,
			result: {
				target: -2,
			},
		},
	},
};
