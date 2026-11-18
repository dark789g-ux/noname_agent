import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olsbxiaoshi" | "olsbyanliang" | "olsbhulie" | "olsbyipo" | "olchengxiang" | "olrenxin" | "oljianmie">} */
export const groupSkills = {
	olsbxiaoshi: {
		audio: 2,
		trigger: { player: "useCard2" },
		filter(event, player) {
			if (!player.isPhaseUsing() || player.getStorage("olsbxiaoshi_used").includes(event.getParent("phaseUse"))) {
				return false;
			}
			if (!["trick", "basic"].includes(get.type(event.card))) {
				return false;
			}
			return game.hasPlayer(current => !event.targets.includes(current) && lib.filter.targetEnabled2(event.card, player, current));
		},
		async cost(event, trigger, player) {
			const num = player.storage.olsbjinming_used ? parseInt(player.storage.olsbjinming_used.slice(0, 1)) : 0;
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), function (card, player, target) {
					const trigger = get.event().getTrigger();
					if (trigger.targets.includes(target)) {
						return false;
					}
					return lib.filter.targetEnabled2(trigger.card, get.player(), target);
				})
				.set("num", num)
				.set("ai", target => {
					const trigger = get.event().getTrigger();
					const eff1 = get.effect(target, trigger.card, trigger.player, get.player());
					const eff2 = get.effect(target, { name: "draw" }, get.player(), get.player());
					return eff1 + eff2 * get.event().num;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			player.addTempSkill("olsbxiaoshi_used");
			player.markAuto("olsbxiaoshi_used", [trigger.getParent("phaseUse")]);
			player.addTempSkill("olsbxiaoshi_effect");
			player.markAuto("olsbxiaoshi_effect", [trigger]);
			trigger.targets.addArray(event.targets);
			game.log(event.targets, "成为了", trigger.card, "的额外目标");
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
			effect: {
				charlotte: true,
				onremove: true,
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					return player.getStorage("olsbxiaoshi_effect").includes(event) && !player.hasHistory("sourceDamage", evt => evt.card === event.card);
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const num = player.storage.olsbjinming_used ? parseInt(player.storage.olsbjinming_used.slice(0, 1)) : 0;
					const result = !num
						? { bool: false }
						: await player
								.chooseTarget(
									get.translation("olsbxiaoshi") + "：请选择一项",
									(card, player, target) => {
										const trigger = get.event().getTrigger();
										return trigger.targets?.includes(target);
									},
									"令其中一个目标摸" + get.cnNumber(num) + "张牌，或失去1点体力"
								)
								.set("ai", target => {
									const { finalTarget } = get.event();
									return finalTarget == target;
								})
								.set(
									"finalTarget",
									(function () {
										const [finalTarget, drawEff] = trigger.targets.reduce(([targetx, effx = 0], target) => {
											if (!targetx?.isIn()) {
												return [target, 0];
											}
											const eff = get.effect(target, { name: "draw" }, player, player);
											return eff > effx ? [target, eff] : [targetx, effx];
										}, []);
										if (drawEff <= 0) {
											const losehpEff = get.effect(player, { name: "losehp" }, player, player);
											if (losehpEff >= 0) {
												return 0;
											}
											return drawEff * num - losehpEff > 0 ? finalTarget : 0;
										}
										return finalTarget;
									})()
								)
								.set("num", num)
								.forResult();
					if (result?.targets?.length) {
						await result.targets[0].draw(parseInt(player.storage.olsbjinming_used.slice(0, 1)));
					} else {
						await player.loseHp();
					}
				},
			},
		},
		derivation: ["olsbjinming"],
	},
	olsbyanliang: {
		audio: 2,
		zhuSkill: true,
		global: "olsbyanliang_give",
		subSkill: {
			used: {
				charlotte: true,
			},
			give: {
				audio: "olsbyanliang",
				enable: "phaseUse",
				discard: false,
				lose: false,
				delay: false,
				line: true,
				prepare(cards, player, targets) {
					targets[0].logSkill("olsbyanliang");
				},
				prompt() {
					let player = _status.event.player;
					let list = game.filterPlayer(target => {
						return target != player && target.hasZhuSkill("olsbyanliang", player) && !target.hasSkill("olsbyanliang_used");
					});
					let str = "将一张装备牌交给" + get.translation(list);
					if (list.length > 1) {
						str += "中的一人";
					}
					str += "，然后视为使用一张【酒】";
					return str;
				},
				filter(event, player) {
					if (player.group != "qun") {
						return false;
					}
					if (
						!game.hasPlayer(target => {
							return target != player && target.hasZhuSkill("olsbyanliang", player) && !target.hasSkill("olsbyanliang_used");
						})
					) {
						return false;
					}
					if (!player.canUse({ name: "jiu", isCard: true }, player, true, true)) {
						return false;
					}
					return player.hasCard(card => {
						return lib.skill.olsbyanliang_give.filterCard(card, player);
					}, "he");
				},
				filterCard(card, player) {
					return get.type(card) == "equip";
				},
				position: "he",
				log: false,
				visible: true,
				filterTarget(card, player, target) {
					return target != player && target.hasZhuSkill("olsbyanliang", player) && !target.hasSkill("olsbyanliang_used");
				},
				async content(event, trigger, player) {
					player.give(event.cards, event.target);
					await player.useCard({ name: "jiu", isCard: true }, player);
					event.target.addTempSkill("olsbyanliang_used", "phaseUseEnd");
				},
				ai: {
					expose: 0.3,
					order() {
						return get.order({ name: "jiu" }) + 0.2;
					},
					result: {
						target: 5,
					},
				},
			},
		},
	},
	//谋孙坚
	olsbhulie: {
		audio: 3,
		trigger: {
			player: "useCardToPlayered",
		},
		filter(event, player) {
			if (event.targets.length != 1 || !["sha", "juedou"].includes(event.card.name)) {
				return false;
			}
			return !player.getStorage("olsbhulie_used").includes(event.card.name);
		},
		check(event, player) {
			return get.attitude(player, event.targets[0]) <= 0;
		},
		logTarget: event => event.targets[0],
		async content(event, trigger, player) {
			const evt = trigger.getParent();
			if (typeof evt.baseDamage != "number") {
				evt.baseDamage = 1;
			}
			evt.baseDamage++;
			player.addTempSkill("olsbhulie_used");
			player.markAuto("olsbhulie_used", trigger.card.name);
			const target = trigger.targets[0],
				sha = get.autoViewAs({ name: "sha", isCard: true });
			player
				.when("useCardAfter")
				.filter(
					evt =>
						evt == trigger.getParent() &&
						target.canUse(sha, player, false) &&
						target.isIn() &&
						!game.hasPlayer2(current => {
							return current.hasHistory("damage", evtx => evtx.card === evt.card);
						})
				)
				.step(async (event, trigger, player) => {
					const { bool } = await player
						.chooseBool("虎烈", `是否令${get.translation(target)}视为对你使用一张杀？`)
						.set("choice", get.effect(player, sha, target, player) > 0)
						.forResult();
					if (bool) {
						await target.useCard(sha, player, false);
					}
				});
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	olsbyipo: {
		audio: 3,
		trigger: { player: "changeHpAfter" },
		filter(event, player) {
			const hp = player.getHp();
			if (hp <= 0 || event.changedHp == 0) {
				return false;
			}
			return !player
				.getAllHistory("custom", evt => evt.olsbyipo_num)
				.map(evt => evt.olsbyipo_num)
				.includes(hp);
		},
		async cost(event, trigger, player) {
			player.getHistory("custom").push({
				olsbyipo_num: player.getHp(),
			});
			event.result = await player
				.chooseTarget(get.prompt2(event.name.slice(0, -5)))
				.set("ai", target => {
					const player = get.player();
					if (player.getDamagedHp() == 1 && target.countCards("he") == 0) {
						return 0;
					}
					if (get.attitude(player, target) > 0) {
						return 10 + get.attitude(player, target);
					}
					if (player.getDamagedHp() == 1) {
						return -1;
					}
					return 1;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const num = Math.max(player.getDamagedHp(), 1);
			const [target] = event.targets;
			let directcontrol = num == 1;
			if (!directcontrol) {
				const str1 = "摸" + get.cnNumber(num, true) + "弃一";
				const str2 = "摸一弃" + get.cnNumber(num, true);
				directcontrol =
					str1 ==
					(
						await player
							.chooseControl(str1, str2, function (event, player) {
								return _status.event.choice;
							})
							.set("choice", get.attitude(player, target) > 0 ? str1 : str2)
							.set("prompt", "毅魄：请选择一项")
							.forResult()
					).control;
			}
			if (directcontrol) {
				await target.draw(num);
				await target.chooseToDiscard(true, "he");
			} else {
				await target.draw();
				await target.chooseToDiscard(num, true, "he", "allowChooseAll");
			}
		},
	},
	//OL界曹冲
	olchengxiang: {
		audioname: ["strong_caochong"],
		inherit: "chengxiang",
		getIndex(event, player) {
			return event.num;
		},
		getNum(player, num) {
			const mark = player.countMark("olchengxiang");
			player.clearMark("olchengxiang", false);
			return num + mark;
		},
		async callback(event, trigger, player) {
			if (
				event.cards2?.length &&
				event.cards2
					.map(card => {
						return get.number(card);
					})
					.reduce((sum, num) => {
						return (sum += num);
					}, 0) == 13
			) {
				player.addMark(event.name, 1, false);
			}
		},
		intro: { content: "下次发动【称象】多亮出$张牌" },
	},
	olrenxin: {
		audio: 2,
		trigger: {
			global: "dying",
		},
		filter(event, player) {
			return event.player != player && player.countCards("he", { type: "equip" }) > 0;
		},
		logTarget: "player",
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard(get.prompt(event.name.slice(0, -5), trigger.player), `弃置一张装备牌并将武将牌翻面，然后${get.translation(trigger.player)}回复至1点体力`, { type: "equip" }, "he")
				.set("ai", card => {
					const player = get.player();
					if (get.attitude(player, get.event().getTrigger().player) > 3) {
						return 11 - get.value(card);
					}
					return -1;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			await player.turnOver();
			await trigger.player.recoverTo(1);
		},
		ai: {
			expose: 0.5,
		},
	},
	//OL张春华
	oljianmie: {
		audio: 2,
		enable: "phaseUse",
		filterTarget: lib.filter.notMe,
		usable: 1,
		async content(event, trigger, player) {
			const target = event.target,
				targets = [player, target];
			const map = await game.chooseAnyOL(targets, get.info(event.name).chooseControl, [targets]).forResult();
			const getColor = result => {
					return result.control == "none2" ? "none" : result.control;
				},
				cards_player = player.getDiscardableCards(player, "h", card => get.color(card) == getColor(map.get(player))),
				cards_target = target.getDiscardableCards(target, "h", card => get.color(card) == getColor(map.get(target)));
			if (cards_player.length && cards_target.length) {
				await game
					.loseAsync({
						lose_list: [
							[player, cards_player],
							[target, cards_target],
						],
					})
					.setContent("discardMultiple");
			} else if (cards_player.length) {
				await player.discard(cards_player);
			} else if (cards_target.length) {
				await target.discard(cards_target);
			}
			if (cards_player.length != cards_target.length) {
				const user = cards_player.length > cards_target.length ? player : target;
				const aim = user == player ? target : player;
				const juedou = new lib.element.VCard({ name: "juedou", isCard: true });
				if (user.canUse(juedou, aim, false)) {
					await user.useCard(juedou, aim, false);
				}
			}
		},
		ai: {
			order: 1,
			result: {
				player(player, target) {
					let num = (player.hasSkill("shangshi") ? Math.max(0, player.getDamagedHp() - player.countCards("h") / 2) : 0) - player.countDiscardableCards(player, "h") / 2;
					return get.effect(player, { name: "juedou" }, target, player) + get.effect(player, { name: "draw" }, player, player) * num;
				},
				target(player, target) {
					return get.effect(target, { name: "juedou" }, player, target) - (get.effect(target, { name: "draw" }, target, target) * target.countDiscardableCards(target, "h")) / 2;
				},
			},
		},
		chooseControl(player, targets, eventId) {
			let colors = ["red", "black"];
			if (player.getDiscardableCards(player, "h").some(card => get.color(card) == "none")) {
				colors.push("none2");
			}
			const str = get.translation(targets[0] == player ? targets[1] : targets[0]);
			return player
				.chooseControl(colors)
				.set("prompt", "翦灭：请选择一个颜色")
				.set("prompt2", "弃置选择颜色的手牌，然后若你/" + str + "弃置的牌更多，则你/" + str + "视为对" + str + "/你使用【决斗】")
				.set("ai", () => {
					const player = get.event().player;
					let controls = get.event().controls.slice();
					return controls.sort((a, b) => {
						return (
							player
								.getDiscardableCards(player, "h")
								.filter(card => {
									return get.color(card) == (a == "none2" ? "none" : a);
								})
								.reduce((sum, card) => sum + get.value(card, player), 0) -
							player
								.getDiscardableCards(player, "h")
								.filter(card => {
									return get.color(card) == (b == "none2" ? "none" : b);
								})
								.reduce((sum, card) => sum + get.value(card, player), 0)
						);
					})[0];
				})
				.set("id", eventId)
				.set("_global_waiting", true);
		},
	},
};
