import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "potfuan" | "potyinxian" | "potnigu" | "potlulian">} */
export const groupSkills = {
	//势张任
	potfuan: {
		audio: 2,
		onremove(player, skill) {
			delete player.storage[skill];
			player.removeTip(skill);
		},
		trigger: {
			player: "phaseJieshuBegin",
		},
		check: (event, player) => player.hasSkill("potyinxian"),
		filter(event, player) {
			return player.getAttackRange() > 0;
		},
		prompt2: `结束阶段，你可以将你基础的攻击范围调整至0，并失去因${get.poptip("potyinxian")}增加的攻击范围，若如此做，你摸因此减少的攻击范围张牌（至多摸5张），然后选择一个手牌中的花色并记录（每轮每个花色限一次）。`,
		async content(event, trigger, player) {
			const prevRange = player.getAttackRange();
			player.addSkill(event.name + "_range");
			player.clearMark("potyinxian_range", false);
			const currRange = player.getAttackRange();
			const num = Math.min(prevRange - currRange, 5);
			if (num > 0) {
				await player.draw(num);
			}
			const used = player.getStorage(event.name + "_used");
			const storage = player.getStorage(event.name);
			const suits = player
				.getCards("h")
				.map(card => get.suit(card))
				.unique()
				.filter(i => !storage.includes(i) && !used.includes(i));
			if (suits.length) {
				const result = await player
					.chooseControl({
						prompt: "伏暗：请选择要记录的花色",
						controls: suits,
						choice: get.rand(0, suits.length - 1),
					})
					.forResult();
				if (result.control) {
					const suit = result.control;
					player.addTempSkill(event.name + "_used", "roundStart");
					player.markAuto(event.name + "_used", suit);
					player.markAuto(event.name, suit);
					player.addTip(
						event.name,
						`${get.translation(event.name)} ${player
							.getStorage(event.name)
							.map(i => get.translation(i))
							.join("")}`
					);
				}
			}
		},
		intro: {
			content: "已记录花色：$",
		},
		group: "potfuan_sha",
		subSkill: {
			sha: {
				trigger: {
					global: "phaseEnd",
				},
				filter(event, player) {
					if (_status.currentPhase == player) {
						return false;
					}
					const storage = player.getStorage("potfuan");
					return get.discarded().some(i => storage.includes(get.suit(i))) && player.hasUseTarget(get.autoViewAs({ name: "sha", isCard: true }), false, false);
				},
				async cost(event, trigger, player) {
					const storage = player.getStorage("potfuan");
					const suits = get
						.discarded()
						.map(card => get.suit(card))
						.unique()
						.filter(i => storage.includes(i));
					event.result = await player
						.chooseTarget({
							prompt: get.prompt(event.skill),
							prompt2: `移除${get.translation(suits)}，然后对一名角色视为使用一张无距离限制的【杀】。若如此做，当此牌造成伤害结算完毕后，你可以选择一项：1.再发动一次〖伏暗②〗，以此法发动后不能再次选择；2.令其技能失效直至其下个回合结束。`,
							filterTarget(card, player, target) {
								return player.canUse(card, target, false, false);
							},
							ai(target) {
								return get.effect(target, get.card(), get.player(), get.player());
							},
						})
						.set("_get_card", get.autoViewAs({ name: "sha", isCard: true }))
						.forResult();
				},
				async content(event, trigger, player) {
					const {
						targets: [target],
					} = event;
					const name = "potfuan";
					const storage = player.getStorage(name);
					const suits = get
						.discarded()
						.map(card => get.suit(card))
						.unique()
						.filter(i => storage.includes(i));
					player.unmarkAuto(name, suits);
					if (!storage.length) {
						player.removeTip(name);
					} else {
						player.addTip(
							name,
							`${get.translation(name)} ${player
								.getStorage(name)
								.map(i => get.translation(i))
								.join("")}`
						);
					}
					const card = get.autoViewAs({ name: "sha", isCard: true });
					const next = player.useCard({
						card,
						targets: [target],
						addCount: false,
					});
					await next;
					if (game.hasPlayer2(target => target.hasHistory("damage", evt => evt.card == next.card), true)) {
						let result;
						if (player.storage.potfuan_only) {
							result = { index: 1 };
						} else {
							result = await player
								.chooseControl({
									choiceList: [`再发动一次〖伏暗②〗，以此法发动后不能再次选择`, `令${get.translation(target)}技能失效直至其下个回合结束`],
									choice: 0,
								})
								.forResult();
						}
						if (typeof result.index == "number") {
							if (result.index == 0) {
								player.setStorage("potfuan_only", true);
								player.logSkill(event.name, target);
								await player.useCard({
									card,
									targets: [target],
									addCount: false,
								});
							} else {
								target.addTempSkill("baiban", { player: "phaseAfter" });
							}
						}
					}
				},
			},
			used: {
				charlotte: true,
				onremove: true,
			},
			range: {
				charlotte: true,
				mod: {
					attackRangeBase(player, num) {
						return 0;
					},
				},
			},
		},
	},
	potyinxian: {
		audio: 2,
		trigger: {
			player: ["useCard", "useCardAfter"],
		},
		filter(event, player, name) {
			if (name == "useCard") {
				return (
					event.card.name == "sha" &&
					event.targets?.some(target => {
						const distance = get.distance(player, target);
						return player.inRange(target) && !game.hasPlayer(current => current != target && player.inRange(current) && get.distance(player, current) > distance);
					})
				);
			}
			return _status.currentPhase != player;
		},
		forced: true,
		async content(event, trigger, player) {
			if (event.triggername == "useCard") {
				trigger.baseDamage++;
				game.log(trigger.card, "的基础伤害+1");
			} else {
				player.addSkill(event.name + "_range");
				player.addMark(event.name + "_range", 1, false);
			}
		},
		subSkill: {
			range: {
				charlotte: true,
				onremove: true,
				markimage: "image/card/attackRange.png",
				intro: {
					content: "攻击范围+#",
				},
				mod: {
					attackRange(player, num) {
						return num + player.countMark("potyinxian_range");
					},
				},
			},
		},
	},
	//势孙綝
	potnigu: {
		audio: 4,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.hasDiscardableCards(player, "he");
		},
		complexCard: true,
		filterCard(card, player) {
			if (ui.selected.cards?.some(cardx => get.suit(cardx) == get.suit(card))) {
				return false;
			}
			return lib.filter.cardDiscardable(card, player);
		},
		position: "he",
		check(card) {
			return 6 - get.value(card);
		},
		selectCard: [1, Infinity],
		async content(event, trigger, player) {
			const targets = game.filterPlayer(target => player.inRange(target));
			player.line(targets);
			const resultMap = await game.chooseAnyOL(targets, get.info(event.name).chooseToGive, [player]).forResult();
			let count = 0;
			for (const target of targets.sortBySeat()) {
				const result = resultMap.get(target);
				if (result?.bool) {
					await target.give(result.cards, player);
				} else {
					count++;
				}
			}
			if (count > 0) {
				player.addMark(event.name + "_damage", count, false);
				player.addTempSkill(event.name + "_damage");
			}
		},
		/**
		 *
		 * @param {Player} player
		 * @param {Player} source
		 * @param {string} eventId
		 * @returns {GameEvent}
		 */
		chooseToGive(player, source, eventId) {
			const next = player.chooseCard({
				prompt: `逆固：是否交给${get.translation(source)}一张牌`,
				position: "he",
				ai(card) {
					const { sourcex, player } = get.event();
					return get.attitude(player, sourcex) > 0 ? sourcex.getUseValue(card) : 6 - get.value(card);
				},
			});
			next.set("sourcex", source);
			next.set("id", eventId);
			next.set("_global_waiting", true);
			return next;
		},
		subSkill: {
			damage: {
				audio: "potnigu",
				onremove: true,
				charlotte: true,
				forced: true,
				trigger: {
					source: "damageBegin1",
				},
				filter(event, player) {
					return player.hasMark("potnigu_damage");
				},
				logTarget: "player",
				async content(event, trigger, player) {
					player.removeMark(event.name, 1, false);
					trigger.num++;
					if (!player.hasMark(event.name)) {
						player.removeSkill(event.name);
					}
				},
				intro: {
					content: "本回合下#次伤害+1",
				},
			},
		},
		ai: {
			order: 7,
			result: {
				player: 1,
			},
		},
	},
	potlulian: {
		audio: 4,
		trigger: {
			player: "useCardAfter",
		},
		forced: true,
		filter(event, player) {
			const type = get.type2(event.card);
			return (
				player.hasHistory("lose", evt => (evt.relatedEvent || evt.getParent()) == event && evt.hs?.length) &&
				!player.hasCards("h", card => get.type2(card) == type) &&
				event.targets?.some(target => {
					return target.getHp() <= player.getHp() || target.countCards("e") <= player.countCards("e");
				})
			);
		},
		async content(event, trigger, player) {
			const { targets } = trigger;
			let bool1 = false,
				bool2 = false;
			for (const target of targets) {
				if (!bool1 && target.getHp() <= player.getHp()) {
					bool1 = true;
				}
				if (!bool2 && target.countCards("e") <= player.countCards("e")) {
					bool2 = true;
				}
			}
			if (bool1) {
				await game.doAsyncInOrder(targets, async target => target.link(true));
			}
			if (bool2) {
				await player.draw();
			}
			if (bool1 && bool2) {
				const selectableTargets = game.filterPlayer(target => !target.isMinHp());
				if (selectableTargets.length) {
					let result;
					if (selectableTargets.length == 1) {
						result = { targets: selectableTargets };
					} else {
						result = await player
							.chooseTarget({
								prompt: "戮连：对一名体力值不为最小的角色造成1点火焰伤害",
								forced: true,
								filterTarget(card, player, target) {
									return get.event().targets.includes(target);
								},
								ai(target) {
									return get.damageEffect(target, get.player(), get.player(), "fire");
								},
							})
							.set("targets", selectableTargets)
							.forResult();
					}
					if (result?.targets?.length) {
						const {
							targets: [target],
						} = result;
						player.line(target, "fire");
						await target.damage({ num: 1, nature: "fire" });
					}
				}
			}
		},
	},
};
