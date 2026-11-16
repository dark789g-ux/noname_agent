import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcxiongwei" | "dcsbqiaodui" | "dcsbtuicheng" | "dcsbjuce" | "dcsbkangming">} */
export const groupSkills = {
	dcxiongwei: {
		audio: 2,
		trigger: { global: ["chooseToCompareAfter", "compareMultipleAfter"] },
		filter(event, player) {
			if (event.preserve || event.result?.cancelled) {
				return false;
			} else if (event.name == "chooseToCompare" && event.compareMultiple) {
				return false;
			}
			const list = get.info("dcxiongwei").getList(event, player);
			const targets = list.map(info => info[0]),
				cards = list.flatMap(([target, card]) => {
					if (target.group != "wei" || target == player) {
						return [];
					}
					return get.position(card) == "d" ? [card] : [];
				});
			if (!targets.some(current => current == player)) {
				return false;
			} else if (!targets.some(current => current != player && current.group == "wei")) {
				return false;
			}
			return cards.length;
		},
		locked: false,
		forced: true,
		async content(event, trigger, player) {
			const list = get.info(event.name).getList(trigger, player),
				targets = list.flatMap(([target]) => {
					if (target == player || target.group != "wei") {
						return [];
					}
					return target.isIn() && !target.hasMark("dcjunhe_effect") ? [target] : [];
				}),
				cards = list.flatMap(([target, card]) => {
					if (target == player || target.group != "wei") {
						return [];
					}
					return get.position(card) == "d" ? [card] : [];
				});
			await player.gain(cards, "gain2");
			if (!player.hasMark("dcjunhe_effect") || !targets.length) {
				return;
			}
			let target;
			if (targets.length == 1) {
				target = targets[0];
			} else {
				const result = await player
					.chooseTarget("###雄威###你可将“军令”次数交给其中一名魏势力角色")
					.set("filterTarget", (_, __, target) => get.event().targetx.includes(target))
					.set("targetx", targets)
					.set("ai", target => {
						const player = get.player();
						let att = get.attitude(player, target);
						if (target.hasSkill("gangzhi")) {
							return 0;
						} else if (target.hasSkillTag("jueqing")) {
							att = att / 2;
						}
						return att;
					})
					.forResult();
				if (result?.bool && result?.targets?.length) {
					target = result.targets[0];
				}
			}
			if (!target) {
				return;
			}
			const result = await player
				.chooseNumbers("雄威", [
					{
						prompt: `请选择你要交给${get.translation(target)}的“军合”次数`,
						min: 1,
						max: player.countMark("dcjunhe_effect"),
					},
				])
				.set("processAI", () => [1])
				.forResult();
			if (result?.bool && result?.numbers) {
				const number = result.numbers[0];
				player.line(target);
				game.log(player, "将", number, "次“军合”效果交给了", target);
				player.removeMark("dcjunhe_effect", number, false);
				target.addMark("dcjunhe_effect", number, false);
				target.setStorage("dcjunhe_shown", player.getStorage("dcjunhe_shown"));
				target.addSkill("dcjunhe_effect");
			}
		},
		getList(event, player) {
			let list = [];
			if (event.targets?.length) {
				list.push([event.player, event.result.player]);
				if (event.compareMeanwhile || event.player == player) {
					for (const i in event.targets) {
						list.push([event.targets[i], event.result.targets[i]]);
					}
				} else if (event.targets.includes(player)) {
					let index = event.targets.findIndex(target => target == player);
					list.push([player, event.result.targets[index]]);
				}
			} else {
				list = [
					[event.player, event.card1],
					[event.target, event.card2],
				];
			}
			return list;
		},
	},
	dcsbqiaodui: {
		audio: 2,
		trigger: {
			player: "useCardToPlayered",
			target: "useCardToTargeted",
		},
		usable: 1,
		filter(event, player) {
			if (!player.countCards("eh")) {
				return false;
			}
			return event.player != event.target;
		},
		async cost(event, trigger, player) {
			const prompt2 = `你可将至多两张牌交给一名其他角色，并令${get.translation(trigger.card)}${trigger.player == player ? "额外结算一次" : "无效"}`;
			event.result = await player
				.chooseCardTarget({
					prompt: get.prompt(event.skill),
					prompt2: prompt2,
					filterCard: true,
					selectCard: [1, 2],
					position: "he",
					filterTarget: lib.filter.notMe,
					ai1(card) {
						if (get.event().val) {
							return 1 / Math.max(0.1, get.value(card));
						}
						return 0;
					},
					val: get.effect(trigger.target, trigger.card, trigger.player, player) > 0 === (trigger.player == player),
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
		},
		async content(event, trigger, player) {
			const {
				cards,
				targets: [target],
			} = event;
			await player.give(cards, target);
			if (trigger.player === player) {
				trigger.getParent().effectCount++;
				game.log(trigger.card, "额外结算一次");
			} else {
				trigger.getParent().all_excluded = true;
				game.log(trigger.card, "无效了");
			}
		},
	},
	dcsbtuicheng: {
		audio: 2,
		trigger: {
			global: ["gainAfter", "loseAsyncAfter"],
		},
		forced: true,
		filter(event, player, name, target) {
			return event.getl(player).cards2?.containsSome(...event.getg(target));
		},
		getIndex(event, player) {
			if (!event.getg || !event.getl || !event.getl(player)?.cards2?.length) {
				return [];
			}
			return game
				.filterPlayer(current => {
					if (current == player) {
						return false;
					}
					return event.getg(current)?.length;
				})
				.sortBySeat();
		},
		logTarget: (event, player, name, target) => target,
		async content(event, trigger, player) {
			const [target] = event.targets;
			const num = trigger.getg(target).filter(card => trigger.getl(player).cards2?.includes(card)).length;
			const result = await target
				.chooseToGive(
					player,
					`推诚：交给${get.translation(player)}${get.cnNumber(num)}张牌（不得是本回合其交给你过的牌），否则其摸等量牌`,
					num,
					card => {
						return !get.event().cardfilter.includes(card);
					},
					"he"
				)
				.set("give", true)
				.set(
					"cardfilter",
					target
						.getHistory("gain", evt => {
							return evt.getl?.(player)?.cards2?.length;
						})
						.map(evt => evt.getl?.(player)?.cards2)
						.flat()
				)
				.forResult();
			if (!result?.bool) {
				await player.draw(num);
			}
		},
	},
	dcsbjuce: {
		audio: 2,
		trigger: {
			player: "useCardToPlayer",
		},
		filter(event, player) {
			if (!event.isFirstTarget || !["basic", "trick"].includes(get.type(event.card)) || _status.currentPhase !== player) {
				return false;
			}
			if (
				player
					.getHistory("useCard", evt => {
						if (!evt?.targets?.length) {
							return false;
						}
						return ["basic", "trick"].includes(get.type(evt.card));
					})
					.indexOf(event.getParent()) != 0
			) {
				return false;
			}
			return game.hasPlayer(current => lib.filter.targetEnabled2(event.card, player, current) && !event.targets.includes(current));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), `是否为${get.translation(trigger.card)}额外指定一名目标？该角色下回合使用基本或普通锦囊牌须额外指定你为目标`, (card, player, target) => {
					const trigger = get.event().getTrigger();
					if (trigger.targets.includes(target)) {
						return false;
					}
					return lib.filter.targetEnabled2(trigger.card, player, target);
				})
				.set("ai", target => {
					const card = get.event().card;
					const player = get.player();
					return get.effect(target, card, player, player);
				})
				.set("targets", trigger.targets)
				.set("card", trigger.card)
				.forResult();
		},
		async content(event, trigger, player) {
			const [target] = event.targets;
			game.log(target, "成为了", trigger.card, "的额外目标");
			trigger.getParent().targets.push(target);
			target.markAuto(event.name + "_effect", [player]);
			target.addTempSkill(event.name + "_effect", { player: "phaseEnd" });
		},
		subSkill: {
			effect: {
				mark: true,
				onremove: true,
				marktext: "举",
				intro: {
					content: "下回合使用的首张基本牌或普通锦囊牌额外指定$为目标",
				},
				trigger: {
					player: "useCard",
				},
				charlotte: true,
				forced: true,
				filter(event, player) {
					if (!["basic", "trick"].includes(get.type(event.card)) || _status.currentPhase !== player) {
						return false;
					}
					return get.info("dcsbjuce_effect")?.logTarget(event, player)?.length;
				},
				logTarget(event, player) {
					return player.getStorage("dcsbjuce_effect").filter(target => {
						return target?.isIn();
					});
				},
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					const targets = event.targets.filter(target => {
						if (!target?.isIn() || trigger.targets.includes(target)) {
							return false;
						}
						return lib.filter.targetEnabled2(trigger.card, player, target);
					});
					trigger.targets.addArray(targets);
					game.log(targets, "成为了", trigger.card, "的额外目标");
				},
			},
		},
	},
	dcsbkangming: {
		audio: 2,
		trigger: {
			global: "useCardAfter",
		},
		filter(event, player) {
			return event.targets?.includes(player);
		},
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			await player.draw();
			const triggerName = player == _status.currentPhase ? "回合结束" : "下个回合开始",
				prompt = `展示一张【杀】或普通锦囊牌，视为对${get.translation(trigger.player)}使用之，或点取消摸三张牌且本技能失效直到你的${triggerName}`;
			const shown = game
				.getGlobalHistory("everything", evt => {
					return evt.name == "showCards" && evt.cards?.length > 0;
				})
				.map(evt => evt.cards)
				.flat();
			const viewAs = card => get.autoViewAs({ name: get.name(card), nature: get.nature(card), suit: get.suit(card), number: get.number(card), isCard: true });
			const canUse = player.getCards("h", card => {
				if (shown.includes(card) || (get.name(card) != "sha" && get.type(card) != "trick")) {
					return false;
				}
				const vcard = viewAs(card);
				return player.canUse(vcard, trigger.player, false);
			});
			const result =
				canUse.length > 0
					? await player
							.chooseCard(get.translation(event.name), prompt, "h", card => {
								return get.event().canUse.includes(card);
							})
							.set("canUse", canUse)
							.set("target", trigger.player)
							.set("ai", card => {
								const vcard = new lib.element.VCard({ name: card.name, nature: card.nature, isCard: true }),
									{ player, target } = get.event();
								return get.effect(target, vcard, player, player);
							})
							.forResult()
					: {
							bool: false,
						};
			if (result?.bool && result.cards?.length) {
				const cards = result.cards;
				await player.showCards(cards, `${get.translation(player)}发动了【抗明】`);
				const vcard = viewAs(cards[0]);
				if (player.canUse(vcard, trigger.player, false)) {
					await player.useCard(vcard, trigger.player, false);
				}
			} else {
				await player.draw(3);
				const expire = player == _status.currentPhase ? "phaseEnd" : "phaseBegin";
				player.tempBanSkill("dcsbkangming", { player: expire });
			}
		},
	},
};
