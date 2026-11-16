import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dchuangnu" | "dcxiankuang">} */
export const groupSkills = {
	//张星彩
	dchuangnu: {
		audio: 2,
		audioname: ["v_zhangxingcai_shadow"],
		enable: "phaseUse",
		group: ["dchuangnu_damage"],
		choiceMap: {
			async discard(player, num) {
				const result = await player
					.chooseTarget({
						prompt: `煌怒：选择一名角色令其随机弃置一张你指定类型的牌`,
						filterTarget(card, player, target) {
							return target.countDiscardableCards(target, "he") > 0;
						},
						ai(target) {
							return get.effect(target, { name: "guohe_copy2", position: "h" }, get.player(), get.player());
						},
						forced: true,
					})
					.forResult();
				const { targets } = result;
				if (targets?.length) {
					const [target] = targets;
					player.line(target, "yellow");
					const result = await player
						.chooseControl({
							controls: ["basic", "trick", "equip"],
							prompt: `煌怒：令${get.translation(player)}随机弃置一种类型的一张牌`,
							ai: () => "basic",
						})
						.forResult();
					const { control } = result;
					if (control) {
						const discard = target.getDiscardableCards(target, "he", card => get.type2(card) == control);
						if (!discard) {
							target.chat("无牌可弃");
						} else {
							await target.discard({ cards: discard.randomGets(1) });
						}
					}
				}
			},
			async sha(player, num) {
				await player.chooseUseTarget({
					card: get.autoViewAs({ name: "sha", isCard: true }),
					//nodistance: true,
					addCount: false,
					forced: true,
				});
			},
			async exclude(player, num) {
				const result = await player
					.chooseTarget({
						prompt: `煌怒：令一名角色本回合下次使用牌无效`,
						ai(target) {
							return -get.attitude(get.player(), target) * target.countCards("h");
						},
						forced: true,
					})
					.forResult();
				const { targets } = result;
				if (targets?.length) {
					const [target] = targets;
					player.line(target, "yellow");
					target.addTempSkill("dchuangnu_exclude");
				}
			},
		},
		chooseButton: {
			dialog(event, player) {
				const num = player.getHistory("useSkill", evt => get.sourceSkillFor(evt.skill) == "dchuangnu").length + 1;
				const dialog = ui.create.dialog(`###煌怒###请选择一项`, [
					[
						["discard", `选择一名角色令其随机弃置一张你指定类型的牌`],
						["sha", "视为使用一张【杀】"], //无距离限制的
						["exclude", "令一名角色本回合下次使用牌无效"],
					],
					"textbutton",
				]);
				return dialog;
			},
			filter(button) {
				const player = get.player();
				if (button.link == "discard") {
					return game.hasPlayer(target => target.countDiscardableCards(target, "he") > 0);
				}
				if (button.link == "sha") {
					return player.hasUseTarget(get.autoViewAs({ name: "sha", isCard: true }), void 0, false);
				}
				return true;
			},
			check(button) {
				const player = get.player();
				if (button.link == "discard") {
					return Math.max(...game.filterPlayer(target => target.countDiscardableCards(target, "he") > 0).map(target => get.effect(target, { name: "guohe_copy2", position: "h" }, player, player)));
				}
				if (button.link == "sha") {
					return player.getUseValue(get.autoViewAs({ name: "sha", isCard: true }), false, false);
				}
				return 3;
			},
			backup(links, player) {
				return {
					audio: "dchuangnu",
					choice: links[0],
					async content(event, trigger, player) {
						const storage = player.getStorage("v_zhangxingcai_changeSkin", false);
						if (storage) {
							player.changeSkin("dchuangnu", "v_zhangxingcai");
							player.setStorage("v_zhangxingcai_changeSkin", !storage);
						}
						const num = player.getHistory("useSkill", evt => get.sourceSkillFor(evt.skill) == "dchuangnu").length;
						const { choice } = get.info(event.name);
						const map = get.info("dchuangnu").choiceMap;
						await map[choice](player, num);
						const list = [];
						for (let i = 1; i < 6; i++) {
							list.push(...Array.from({ length: player.countDisabledSlot(i) }).fill("equip" + i));
						}
						const slots = list.randomGets(num);
						await player.enableEquip({ slots });
						if (slots.length < num) {
							player.tempBanSkill("dchuangnu");
						}
					},
				};
			},
		},
		ai: {
			order: 8,
			result: {
				player: 1,
			},
		},
		subSkill: {
			backup: {},
			damage: {
				audio: "dchuangnu",
				trigger: {
					player: "damageEnd",
				},
				async cost(event, trigger, player) {
					const num = player.getHistory("useSkill", evt => get.sourceSkillFor(evt.skill) == "dchuangnu").length + 1;
					const result = await player
						.chooseButton({
							createDialog: [
								`###${get.prompt(event.skill)}###${get.skillInfoTranslation("dchuangnu", player, false)}`,
								[
									[
										["discard", `选择一名角色令其随机弃置一张你指定类型的牌`],
										["sha", "视为使用一张【杀】"], //无距离限制的
										["exclude", "令一名角色本回合下次使用牌无效"],
									],
									"textbutton",
								],
							],
							filterButton(button) {
								const player = get.player();
								if (button.link == "discard") {
									return game.hasPlayer(target => target.countDiscardableCards(target, "he") > 0);
								}
								if (button.link == "sha") {
									return player.hasUseTarget(get.autoViewAs({ name: "sha", isCard: true }), void 0, false);
								}
								return true;
							},
							ai(button) {
								const player = get.player();
								if (button.link == "discard") {
									return Math.max(...game.filterPlayer(target => target.countDiscardableCards(target, "he") > 0).map(target => get.effect(target, { name: "guohe_copy2", position: "h" }, player, player)));
								}
								if (button.link == "sha") {
									return player.getUseValue(get.autoViewAs({ name: "sha", isCard: true }), void 0, false);
								}
								return 3;
							},
						})
						.forResult();
					if (result.bool && result.links?.length) {
						event.result = {
							bool: true,
							cost_data: result.links[0],
						};
					}
				},
				async content(event, trigger, player) {
					const storage = player.getStorage("v_zhangxingcai_changeSkin", false);
					if (storage) {
						player.changeSkin("dchuangnu", "v_zhangxingcai");
						player.setStorage("v_zhangxingcai_changeSkin", !storage);
					}
					const num = player.getHistory("useSkill", evt => get.sourceSkillFor(evt.skill) == "dchuangnu").length;
					const { cost_data: choice } = event;
					const map = get.info("dchuangnu").choiceMap;
					await map[choice](player, num);
					const list = [];
					for (let i = 1; i < 6; i++) {
						list.push(...Array.from({ length: player.countDisabledSlot(i) }).fill("equip" + i));
					}
					const slots = list.randomGets(num);
					await player.enableEquip({ slots });
					if (slots.length < num) {
						player.tempBanSkill("dchuangnu");
					}
				},
			},
			exclude: {
				charlotte: true,
				silent: true,
				mark: true,
				intro: {
					content: "本回合下次使用的牌无效",
				},
				trigger: {
					player: "useCard",
				},
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					trigger.all_excluded = true;
					game.log(trigger.card, "被无效");
				},
			},
		},
	},
	dcxiankuang: {
		audio: 2,
		audioname: ["v_zhangxingcai_shadow"],
		trigger: {
			global: ["loseAfter", "loseAsyncAfter", "cardsDiscardAfter"],
		},
		getIndex(event, player) {
			if (event.name == "cardsDiscard" && event.getParent()?.relatedEvent?.name == "useCard") {
				return [];
			}
			return game
				.filterPlayer(target => {
					return event.getd(target, "cards2")?.some(card => get.type(card) == "basic");
				})
				.sortBySeat();
		},
		filter(event, player, name, target) {
			return target?.isIn() && player.countEnabledSlot() > 0;
		},
		logTarget(event, player, name, target) {
			return target;
		},
		check(event, player, name, target) {
			if (!player.hasSkill("dchuangnu")) {
				return false;
			}
			return true;
		},
		async content(event, trigger, player) {
			const storage = player.getStorage("v_zhangxingcai_changeSkin", false);
			if (!storage) {
				player.changeSkin(event.name, "v_zhangxingcai_shadow");
				player.setStorage("v_zhangxingcai_changeSkin", !storage);
			}
			const {
				targets: [target],
			} = event;
			await player.chooseToDisable();
			const cards = trigger.getd(target, "cards2").filter(card => get.type(card) == "basic");
			const num = player.countDisabledSlot();
			const result = await player
				.chooseControl({
					choiceList: [`获得${get.translation(cards)}`, `令${get.translation(target)}摸${num}张牌`],
					choice: (() => {
						const att = get.attitude(player, target);
						if (att <= 0) {
							return 0;
						}
						return cards.length > num ? 0 : 1;
					})(),
				})
				.forResult();
			const { index } = result;
			if (index == 0) {
				await player.gain({ cards, animate: "gain2" });
			} else {
				await target.draw({ num });
			}
			if (
				game
					.getGlobalHistory("everything", evt => {
						if (evt.name != "gain") {
							return false;
						}
						return evt.getParent().name == event.name || (evt.getParent().name == "draw" && evt.getParent(2).name == event.name);
					})
					.reduce((list, evt) => [...list, ...evt.cards], []).length > 1
			) {
				player.tempBanSkill(event.name);
			}
		},
		/*subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "已发动过：$",
				},
			},
		},*/
	},
};
