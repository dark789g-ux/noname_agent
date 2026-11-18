import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "tingwei">} */
export const groupSkills = {
	tingwei: {
		audio: 4,
		trigger: { player: "useCardToPlayered" },
		filter(event) {
			return event.isFirstTarget && event.card?.name === "sha";
		},
		logAudio(event) {
			if (typeof event == "number") {
				return `tingwei${event}.mp3`;
			}
			return 2;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2(event.skill),
					filterTarget(_card, _player, target) {
						const event = get.event();
						return event.targets.includes(target);
					},
					ai(target) {
						const player = get.player();
						const trigger = get.event().getTrigger();

						// 判断态度，友方则不选，虽然给牌或加伤或许有奇效，但让AI实现还是太难了
						const att = get.attitude(player, target);
						if (att >= 0) {
							return -1;
						}

						let score = 0;

						// 此【杀】本身对目标的收益，尤其用于判断伤害+1是否有价值
						const nature = get.nature(trigger.card);
						const damage = get.damageEffect(target, player, player, nature);
						if (damage > 0) {
							score += damage * 1.8;
							if (target.hp <= 2) {
								score += 2;
							}
						}

						// 非锁定技失效：技能越多越值得
						const skills = target.getSkills(null, false, false).filter(skill => {
							const info = get.info(skill);
							return info && !info.locked && !info.charlotte;
						});
						score += skills.length * 1.2;

						// 交装备：有装备牌时才有压力
						const equips1 = target.getGainableCards(player, "e");
						const equips2 = target.getGainableCards(player, "h", card => card.isKnownBy(player) && get.type(card) === "equip");
						const equips = equips1.concat(equips2);
						if (equips.length) {
							const values = equips.reduce((sum, card) => sum + get.value(card, target), 0) / equips.length;
							score += Math.min(3, values);
						}

						// 随机弃牌：牌越少越疼，牌越关键越疼
						const cards = target.countDiscardableCards(target, "he");
						if (cards) {
							score += Math.min(3, 1 + 4 / cards);
						}

						// 不选则连环：未横置、且可能吃属性伤害时更值钱
						if (!target.isLinked()) {
							score += 0.8;
							if (game.hasPlayer(current => current !== target && current.isLinked())) {
								score += 0.8;
							}
							if (nature) {
								score += 0.6;
							}
						}

						// 敌意修正：越是敌人越优先
						score *= Math.max(1, -att / 3);

						return score;
					},
				})
				.set("targets", trigger.targets)
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			player.addMark("tingwei", 4);

			const target = event.targets[0];

			const result = await target
				.chooseButton({
					createDialog: [
						"霆威：请选择任意项，若点击“取消”，则你横置",
						[
							[
								["fengyin", "非锁定技失效至下个回合结束"],
								["equip", `交给${get.translation(player)}一张装备牌`],
								["damage", `${get.translation(trigger.card)}对你造成伤害+1`],
								["discard", "随机弃一张牌"],
							],
							"textbutton",
						],
					],
					filterButton(button, player) {
						const source = get.event().source;
						const link = button.link;
						const selected = ui.selected.buttons.map(button => button.link);

						switch (link) {
							case "fengyin":
								return !player.hasSkill("tingwei_fengyin");
							case "equip": {
								const hasEquip = player.hasGainableCards(source, "he", { type: "equip" });
								if (!hasEquip) {
									return false;
								}
								if (!selected.includes("discard")) {
									return true;
								}
								return player.hasGainableCards(source, "he", card => get.type(card) === "equip" && player.hasDiscardableCards(player, "he", cardx => cardx !== card));
							}
							case "discard": {
								const hasCard = player.hasDiscardableCards(player, "he");
								if (!hasCard) {
									return false;
								}
								if (!selected.includes("equip")) {
									return true;
								}
								return player.hasGainableCards(source, "he", card => get.type(card) === "equip" && player.hasDiscardableCards(player, "he", cardx => cardx !== card));
							}
							default:
								return true;
						}
					},
					selectButton: [1, 4],
					processAI() {
						const event = get.event();
						const target = event.player;
						const player = event.source;

						const parent = event.getParent();
						if (parent == null) {
							return {
								bool: false,
							};
						}
						const trigger = parent.getTrigger();

						const resultLinks = [];
						const removeMarkValue = getTingValue(player, target);

						// 计算四个选项的代价
						const costs = Array(4).fill(0);

						// 选项1：非锁定技失效
						if (target.hasSkill("tingwei_fengyin")) {
							// 已失效则无法选择此项，代价设为正无穷表示无法选择
							costs[0] = Infinity;
						} else {
							const skills = target.getSkills(null, false, false).filter(skill => {
								const info = get.info(skill);
								return info && !info.locked && !info.charlotte;
							});
							costs[0] = skills.length * 1.2;
							if (skills.length >= 2) {
								costs[0] += 1;
							}
						}

						// 选项2：交给你一张装备牌
						const equips = target.getGainableCards(player, "he", { type: "equip" });
						if (equips.length) {
							costs[1] = Math.min(4, equips.reduce((sum, card) => sum + get.value(card, target), 0) / equips.length);
						} else {
							// 没有装备无法选择，同样代价最大化
							costs[1] = Infinity;
						}

						// 选项3：此杀伤害+1
						const card = trigger.card;
						const damageEff = get.damageEffect(target, player, target, get.nature(card));
						if (damageEff < 0) {
							costs[2] = -damageEff * 1.8;
							if (target.hp <= 2) {
								costs[2] += 3;
							}
							if (target.hp <= 1) {
								costs[2] += 5;
							}
						} else {
							// 如果目标不怕伤害，甚至受益，这项成本很低，应该不需要代价最大化
							costs[2] = -damageEff;
						}

						// 选项4：随机弃一张牌
						const cards = target.getDiscardableCards(target, "he");
						if (cards.length) {
							const values = cards.reduce((sum, card) => sum + get.value(card, target), 0) / cards.length;
							costs[3] = Math.min(4, 1 + 4 / values);
							if (cards.length <= 2) {
								costs[3] += 1;
							}
						} else {
							costs[3] = Infinity;
						}

						// 将代价小于收益的项添加到结果中
						const links = ["fengyin", "equip", "damage", "discard"];
						for (const [i, cost] of costs.entries()) {
							if (removeMarkValue > cost) {
								resultLinks.push(links[i]);
							}
						}

						// 检查第二项和第四项的冲突可能
						if (resultLinks.includes("equip") && resultLinks.includes("discard")) {
							if (!equips.some(card => cards.some(cardx => cardx !== card))) {
								// 只关注是否为友方，是则给装备，否则弃置牌
								// 特殊情况太杂不好思考，等后来人补充
								const att = get.attitude(target, player);
								if (att > 0) {
									resultLinks.remove("discard");
								} else {
									resultLinks.remove("equip");
								}
							}
						}

						// 如果不选任何项，会进入连环状态；如果连环很亏，可以选择代价最低的一项来避免
						if (!resultLinks.length && !target.isLinked()) {
							let linkCost = 1;

							if (game.hasPlayer(current => current !== target && get.attitude(target, current) > 0 && current.isLinked())) {
								linkCost += 1;
							}
							if (get.nature(trigger.card)) {
								linkCost += 1;
							}
							if (get.damageEffect(target, player, target, "fire") < 0) {
								linkCost += 0.8;
							}
							if (get.damageEffect(target, player, target, "thunder") < 0) {
								linkCost += 0.8;
							}

							const minCost = Math.min(...costs);
							const index = costs.indexOf(minCost);

							if (linkCost > minCost) {
								resultLinks.push(links[index]);
							}
						}

						if (resultLinks.length) {
							return {
								bool: true,
								links: resultLinks,
							};
						} else {
							return {
								bool: false,
							};
						}

						/**
						 * 计算移除【霆】的收益
						 *
						 * @param {Player} player - 发动【霆威】的角色
						 * @param {Player} target - 目前正在选择的角色
						 * @returns {number}
						 */
						function getTingValue(player, target) {
							// 如果实际上没有技能【寂灭】，【霆】就毫无用处，移除收益为0
							if (!player.hasSkill("jimie")) {
								return 0;
							}

							// 如果【寂灭】已经发动过且没有【驭雳】，【霆】也毫无用处，移除收益为0
							if (player.awakenedSkills.includes("jimie") && !player.hasSkill("yuli")) {
								return 0;
							}

							// 移除敌人的“霆”才有价值；如果是友方，几乎不想移除
							if (get.attitude(target, player) > 0) {
								return -1;
							}

							const mark = player.countMark("tingwei");

							let value = 1;
							// 能立刻开限定技，1枚霆价值极高
							if (mark >= 8) {
								value += 7;
							}
							// 下一次触发就够，1枚霆价值也很高，但由于可以留到下一轮选择，价值依次递减
							else if (mark == 7) {
								value += 4;
							} else if (mark == 6) {
								value += 2.5;
							} else if (mark == 5) {
								value += 1.5;
							}

							// 当前回合时，很容易触发，威胁提升
							if (_status.currentPhase == player) {
								value += 2;
							}

							value += Math.min(5, getTingThreat(player, target));

							return value;
						}

						/**
						 * 计算【霆】伤害造成的威胁
						 *
						 * @param {Player} player - 发动【霆威】的角色
						 * @param {Player} target - 目前正在选择的角色
						 * @returns {number}
						 */
						function getTingThreat(player, target) {
							let threat = 0;
							for (const current of game.filterPlayer(current => current === target || get.attitude(target, current) > 0)) {
								const damage = get.damageEffect(current, player, target);
								if (damage < 0) {
									threat = Math.max(threat, -damage * Math.max(1, current.maxHp / 2));
								}
							}
							return threat;
						}
					},
				})
				.set("source", player)
				.forResult();

			if (!result?.bool || !result.links?.length) {
				player.logSkill("tingwei", null, null, null, [get.rand(3, 4)]);
				await target.link(true);
				return;
			}

			const links = ["fengyin", "equip", "damage", "discard"];
			player.removeMark("tingwei", result.links.length);
			for (const link of links) {
				if (!result.links.includes(link)) {
					continue;
				}

				switch (link) {
					case "fengyin":
						target.addTempSkill("tingwei_fengyin", { player: "phaseEnd" });
						break;
					case "equip": {
						await target
							.chooseToGive({
								prompt: `请选择要交给${get.translation(player)}的装备牌`,
								target: player,
								filterCard(card) {
									const event = get.event();
									const target = get.player();
									if (get.type(card) !== "equip") {
										return false;
									}
									if (!event.discarding) {
										return true;
									}
									return target.hasDiscardableCards(target, "he", cardx => cardx !== card);
								},
								position: "he",
								forced: true,
							})
							.set("discarding", result.links.includes("discard"));
						break;
					}
					case "damage": {
						const id = target.playerid;
						if (id == null) {
							break;
						}

						const map = trigger.getParent()?.customArgs;
						if (map == null) {
							break;
						}
						if (!map[id]) {
							map[id] = {};
						}
						if (typeof map[id].extraDamage != "number") {
							map[id].extraDamage = 0;
						}
						map[id].extraDamage++;
						break;
					}
					case "discard": {
						await target.randomDiscard("he");
						break;
					}
				}
			}

			return;
		},
		mark: true,
		marktext: "霆",
		intro: {
			name: "霆",
			content: "当前拥有#个“霆”标记",
		},
		subSkill: {
			fengyin: {
				inherit: "fengyin",
			},
		},
	},
};
