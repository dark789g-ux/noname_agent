import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olcaishi" | "olzhongjian" | "olsbliduan" | "olsbdanchi" | "old_olsbdanchi">} */
export const groupSkills = {
	//界辛宪英
	olcaishi: {
		audio: 2,
		forced: true,
		locked: false,
		trigger: {
			player: "useCardAfter",
		},
		filter(event, player) {
			const type = get.type2(event.card);
			return player.getRoundHistory("useCard", evt => get.type2(evt.card) == type).indexOf(event) == 0;
		},
		async content(event, trigger, player) {
			player.addTempSkill(`${event.name}_effect`, "roundStart");
			player.addMark(`${event.name}_effect`, 1, false);
			if (!get.info("clanmuyin").isMax(player) && game.hasPlayer(target => target.isDamaged())) {
				const result = await player
					.chooseTarget({
						prompt: "才识：你可以令一名角色回复一点体力，然后此技能本回合失效",
						filterTarget(card, player, target) {
							return target.isDamaged();
						},
						ai(target) {
							return get.recoverEffect(target, get.player(), get.player());
						},
					})
					.forResult();
				if (result?.bool && result.targets?.length) {
					const {
						targets: [target],
					} = result;
					player.line(target, "green");
					await target.recover();
					player.tempBanSkill(event.name);
				}
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				markimage: "image/card/handcard.png",
				intro: {
					content: "手牌上限+#",
				},
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("olcaishi_effect");
					},
				},
			},
		},
	},
	olzhongjian: {
		audio: 2,
		enable: "phaseUse",
		usable(skill, player) {
			return 1 + player.countMark(skill);
		},
		filterTarget(card, player, target) {
			return player != target && target.countCards("h") > 0 && target.getHp() > 0;
		},
		async content(event, trigger, player) {
			const { target, name } = event;
			const result = await player.choosePlayerCard(target, "h", target.getHp(), true).forResult();
			const { cards: shown } = result;
			await player.showCards(shown, `${get.translation(player)}发动了【${get.translation(event.name)}】`);
			if (!player.countCards("h")) {
				return;
			}
			const result2 = await player
				.chooseCard(`忠鉴：请你展示一张手牌`, "h", true)
				.set("shown", shown)
				.set("ai", card => {
					let val = 0;
					const { shown } = get.event();
					if (shown.some(i => get.color(i) == get.color(card))) {
						val += 1;
					}
					if (shown.some(i => get.name(i) == get.name(card))) {
						val += 2;
					}
					return val;
				})
				.forResult();
			const {
				cards: [card],
			} = result2;
			await player.showCards(card);
			if (shown.some(i => get.color(i) == get.color(card))) {
				const result = await player
					.discardPlayerCard({
						prompt: `忠鉴：弃置${get.translation(target)}一张牌或取消你摸一张牌`,
						target,
						position: "he",
					})
					.forResult();
				if (!result?.bool) {
					await player.draw();
				}
			}
			if (shown.some(i => get.name(i) == get.name(card)) && !player.hasMark(name)) {
				player.addMark(name, 1, false);
				player.when({ global: "phaseChange" }).step(async (event, trigger, player) => {
					player.clearMark(name, false);
				});
			}
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					return -Math.min(target.getHp(), target.countCards("h"));
				},
			},
		},
	},
	//谋程昱
	olsbliduan: {
		audio: 2,
		forced: true,
		locked: false,
		mod: {
			aiOrder(player, card, num) {
				if (player.hasSkill("olsbliduan_trick") && get.type(card) == "trick" && get.info(card).allowMultiple !== false) {
					return num + 5;
				}
				if (player.hasSkill("olsbliduan_sha") && get.name(card) == "sha") {
					return num + 5;
				}
			},
		},
		trigger: {
			player: "useCardAfter",
		},
		filter(event, player) {
			return event.card.name == "sha" || get.type2(event.card) == "trick";
		},
		async content(event, trigger, player) {
			if (trigger.card.name == "sha") {
				player.addSkill("olsbliduan_trick");
				player.addMark("olsbliduan_trick", 1, false);
			}
			if (get.type2(trigger.card) == "trick") {
				player.addSkill("olsbliduan_sha");
				player.addMark("olsbliduan_sha", 1, false);
			}
		},
		subSkill: {
			sha: {
				charlotte: true,
				forced: true,
				popup: false,
				trigger: {
					player: "useCard2",
				},
				filter(event, player) {
					return event.card.name == "sha";
				},
				onremove: true,
				async content(event, trigger, player) {
					const num = player.countMark(event.name);
					player.removeSkill(event.name);
					const { card, targets } = trigger;
					const info = get.info(card);
					if (info.allowMultiple == false) {
						return;
					}
					if (targets?.length && !info.multitarget) {
						if (
							game.hasPlayer(function (target) {
								return !targets.includes(target) && lib.filter.targetEnabled2(card, player, target) && lib.filter.targetInRange(card, player, target);
							})
						) {
							const result = await player
								.chooseTarget(`戾断：可以为${get.translation(card)}额外选择至多${num}个目标`, [1, num], (_, player, target) => {
									const { card, targets } = get.event();
									return !targets.includes(target) && lib.filter.targetEnabled2(card, player, target) && lib.filter.targetInRange(card, player, target);
								})
								.set("card", card)
								.set("targets", targets)
								.set("ai", target => {
									return get.effect(target, get.event().card, get.player(), get.player());
								})
								.forResult();
							if (result?.bool && result.targets?.length) {
								const { targets } = result;
								player.line(targets);
								trigger.targets.addArray(targets);
								game.log(targets, "成为了", trigger.card, "的额外目标");
							}
						}
					}
				},
				mark: true,
				marktext: "杀",
				intro: {
					content: "你使用的下张【杀】目标+#",
				},
			},
			trick: {
				inherit: "olsbliduan_sha",
				filter(event, player) {
					return get.type2(event.card) == "trick";
				},
				marktext: "锦",
				intro: {
					content: "你使用的下张锦囊牌目标+#",
				},
			},
		},
	},
	olsbdanchi: {
		audio: 2,
		usable: 1,
		trigger: {
			global: "damageEnd",
		},
		logTarget: "player",
		check(event, player) {
			return event.source?.isIn() && event.source.isPhaseUsing();
		},
		filter(event, player) {
			return get.distance(player, event.player) <= 1;
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const result = await target
				.chooseButton([`胆持：请选择一种类型`, [["basic", "trick", "equip"].map(i => `caoying_${i}`), "vcard"]], true)
				.set("ai", () => Math.random())
				.forResult();
			if (result.links?.length) {
				const type = result.links[0][2].slice(8);
				game.log(target, "选择了", `#g${get.translation(type)}`);
				target.popup(get.translation(type));
				const { source } = trigger;
				if (source?.isIn()) {
					const last = source.getHistory("useCard").length;
					player
						.when({
							global: ["useCardAfter", "phaseAfter", "phaseBeforeStart"],
						})
						.filter(evt => {
							if (evt.name == "phase") {
								return true;
							}
							return evt.player == source && evt.player.getHistory("useCard").indexOf(evt) == last;
						})
						.step(async (event, trigger, player) => {
							if (trigger.name == "phase") {
								return;
							}
							const typex = get.type2(trigger.card);
							await player.chooseUseTarget({ card: get.autoViewAs({ name: "wuzhong", isCard: true }), forced: true });
							if (typex != type) {
								await player.chooseUseTarget({ card: get.autoViewAs({ name: "sha", isCard: true }), addCount: false });
							}
						});
				}
			}
		},
	},
	old_olsbdanchi: {
		audio: 2,
		trigger: {
			source: "damageSource",
			player: "damageEnd",
		},
		filter(event, player, name) {
			if (!event.card) {
				return false;
			}
			const evt = event.getParent(evtx => evtx.name == "useCard" && evtx.card == event.card, true);
			if (!evt || !evt.targets?.some(target => target.isIn())) {
				return false;
			}
			if (name == "damageSource") {
				return player.getHistory("sourceDamage", evt => !!evt.card).indexOf(event) == 0;
			}
			return player.getHistory("damage", evt => !!evt.card).indexOf(event) == 0;
		},
		check: () => true,
		logTarget(event, player) {
			const evt = event.getParent(evtx => evtx.name == "useCard" && evtx.card == event.card, true);
			return evt.targets?.filter(target => target.isIn()).sortBySeat();
		},
		chooseControl(player, source, eventId) {
			return player
				.chooseControl(["杀", "锦囊牌"])
				.set("prompt", `胆持：猜测${get.translation(source)}本回合下次使用的牌`)
				.set("choice", Math.random() > 0.5 ? 0 : 1)
				.set("id", eventId)
				.set("_global_waiting", true);
		},
		async content(event, trigger, player) {
			const { targets } = event;
			const { source, card } = trigger;
			const map = await game.chooseAnyOL(targets, get.info(event.name).chooseControl, [source]).forResult();
			const list = [];
			for (const target of targets.sortBySeat()) {
				const { index, control } = map.get(target);
				list.push(index);
				target.popup(control);
				game.log(target, "猜测了", "#y" + control);
			}
			const sourcex = player;
			source
				.when({
					global: ["phaseBeforeStart", "phaseAfter", "phaseEnd"],
					player: "useCard",
				})
				.filter(evt => true)
				.step(async (event, trigger, player) => {
					if (trigger.name == "useCard") {
						const { card: cardx } = trigger;
						sourcex.when({ global: "phaseEnd" }).step(async (event, trigger, player) => {
							const action = [
								() => player.draw(2),
								() => {
									const sha = get.autoViewAs({ name: "sha", isCard: true });
									if (player.hasUseTarget(sha, true, false)) {
										return player.chooseUseTarget(sha, true, false);
									}
								},
							];
							if (get.name(cardx) == "sha") {
								if (list.some(i => i == 0)) {
									await action[0]();
								}
								if (list.some(i => i != 0)) {
									await action[1]();
								}
							} else if (get.type2(cardx) == "trick") {
								if (list.some(i => i == 1)) {
									await action[0]();
								}
								if (list.some(i => i != 1)) {
									await action[1]();
								}
							} else {
								await action[1]();
							}
						});
					} else if (event.triggername == "phaseEnd") {
						const sha = get.autoViewAs({ name: "sha", isCard: true });
						if (player.hasUseTarget(sha, true, false)) {
							await player.chooseUseTarget(sha, true, false);
						}
					}
				});
		},
	},
};
