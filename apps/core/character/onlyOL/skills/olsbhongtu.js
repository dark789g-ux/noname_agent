import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olsbhongtu" | "olsbqiwu" | "olxuanhuo" | "olenyuan" | "olenyuan1">} */
export const groupSkills = {
	//谋庞统
	olsbhongtu: {
		audio: 6,
		trigger: {
			global: "phaseAnyEnd",
		},
		filter(event, player) {
			let count = 0;
			player.checkHistory("gain", evt => {
				if (evt.getParent(event.name) !== event) {
					return;
				}
				count += evt.cards.length;
			});
			return count >= 2;
		},
		derivation: ["nzry_feijun", "qianxi"],
		check(event, player) {
			if (
				game.hasPlayer(current => {
					return current !== player && get.attitude(player, current) > 0;
				})
			) {
				return true;
			}
			const eff = get.damageEffect(player, player, player, "fire");
			if (
				game.hasPlayer(current => {
					return (
						get.damageEffect(current, player, player, "fire") > eff &&
						player.countCards("h", card => {
							return !current.hasUseTarget(card);
						}) >=
							2 + (player.getHp() > 1)
					);
				})
			) {
				return true;
			}
			return false;
		},
		async content(event, trigger, player) {
			await player.draw(3);
			if (player.countCards("h") < 3 || !game.hasPlayer(current => player != current)) {
				return;
			}
			let result = await player
				.chooseCardTarget({
					prompt: "鸿图：请展示三张手牌并选择一名角色",
					prompt2: "你选择的角色须选择是否使用其中的一张牌，并令你随机弃置其中的另一张牌",
					position: "h",
					filterCard: true,
					selectCard: 3,
					filterTarget: lib.filter.notMe,
					forced: true,
					hasFriend: game.hasPlayer(current => {
						return current !== player && get.attitude(player, current) > 0;
					}),
					ai1(card) {
						const player = get.player(),
							val = player.getUseValue(card);
						if (get.event().hasFriend) {
							if (
								ui.selected.cards.some(cardx => {
									return player.getUseValue(cardx) > 5;
								})
							) {
								return -val - get.value(card);
							}
							return val - 5;
						}
						if (
							game.hasPlayer(current => {
								return get.attitude(get.player(), current) < 0 && !current.hasUseTarget(card);
							})
						) {
							return 100 - val;
						}
						return -val;
					},
					ai2(target) {
						const att = get.attitude(get.player(), target);
						if (!ui.selected.cards.length) {
							return 0;
						}
						if (ui.selected.cards.every(card => !target.hasUseTarget(card))) {
							return 10 * (get.damageEffect(target, player, player, "fire") - get.damageEffect(player, player, player, "fire"));
						}
						return Math.max(...ui.selected.cards.map(card => target.getUseValue(card) * att));
					},
				})
				.forResult();
			if (!result?.cards?.length || !result.targets?.length) {
				return;
			}
			const {
				targets: [target],
				cards,
			} = result;
			player.line(target, "green");
			await player.showCards(cards, `${get.translation(player)}对${get.translation(target)}发动了【鸿图】`);
			const numbers = cards.map(card => get.number(card, player)).toUniqued();
			const min = Math.min(...numbers);
			const max = Math.max(...numbers);
			result = await target
				.chooseButton([
					`鸿图：是否使用${get.translation(player)}展示的其中一张牌？`,
					[
						cards.map(card => [
							card,
							(() => {
								const num = get.number(card, player);
								if (
									cards.every(cardx => {
										return cardx === card || get.number(cardx) < num;
									})
								) {
									return get.translation("nzry_feijun");
								} else if (
									cards.every(cardx => {
										return cardx === card || get.number(cardx) > num;
									})
								) {
									return "手牌上限";
								} else if (num != min && num != max) {
									return get.translation("qianxi");
								} else {
									return "";
								}
							})(),
						]),
						(item, type, position, noclick, node) => {
							node = ui.create.buttonPresets.card(item[0], type, position, noclick);
							game.createButtonCardsetion(item[1], node);
							return node;
						},
					],
				])
				.set("filterButton", button => {
					const player = get.player(),
						card = button.link;
					const cardx = get.autoViewAs(
						{
							name: get.name(card),
							nature: get.nature(card),
						},
						[card]
					);
					return player.hasUseTarget(cardx, null, false);
				})
				.set("ai", button => {
					return get.player().getUseValue(button.link);
				})
				.forResult();
			if (!result?.links?.length) {
				for (const current of [target, player]) {
					if (!current.isIn()) {
						continue;
					}
					player.line(current, "fire");
					await current.damage("fire");
				}
			} else {
				const {
					links: [card],
				} = result;
				cards.remove(card);
				const cardx = get.autoViewAs(
					{
						name: get.name(card),
						nature: get.nature(card),
					},
					[card]
				);
				const next = target.chooseUseTarget(cardx, [card], true, false);
				if (card.name === cardx.name && get.is.sameNature(card, cardx, true)) {
					next.set("viewAs", false);
				}
				await next;
				const restCards = cards.filter(card => {
					return get.owner(card) === player && get.position(card) === "h" && lib.filter.cardDiscardable(card, player, "olsbhongtu");
				});
				if (restCards.length) {
					await player.discard(restCards.randomGet());
				}
				const num = get.number(card, player);
				let skill = null;
				if (
					cards.every(cardx => {
						if (cardx === card) {
							return true;
						}
						return get.number(cardx) < num;
					})
				) {
					skill = "nzry_feijun";
				} else if (
					cards.every(cardx => {
						if (cardx === card) {
							return true;
						}
						return get.number(cardx) > num;
					})
				) {
					target.addSkill("olsbhongtu_limit");
					if (!target.storage.olsbhongtu_limit) {
						target.storage.olsbhongtu_limit = [0, 0];
					}
					target.storage.olsbhongtu_limit[0] += 2;
					target.markSkill("olsbhongtu_limit");
				} else if (num != min && num != max) {
					skill = "qianxi";
				}
				if (skill) {
					let skillName = `olsbhongtu_${player.playerid}`;
					await target.addAdditionalSkills(skillName, [skill], true);
					delete target.storage.olsbhongtu_phased;
					target.when({ player: "phaseBegin" }).step(async () => {
						target.storage.olsbhongtu_phased = true;
					});
					target
						.when({ player: "phaseEnd" }, false)
						.filter(() => {
							return target.storage.olsbhongtu_phased;
						})
						.assign({
							firstDo: true,
							priority: Infinity,
						})
						.step(async () => {
							delete target.storage.olsbhongtu_phased;
							target.removeAdditionalSkills(skillName);
						})
						.finish();
				}
			}
		},
		subSkill: {
			limit: {
				markimage: "image/card/handcard.png",
				intro: {
					content(storage, player) {
						return "手牌上限+" + storage[0];
					},
				},
				charlotte: true,
				mod: {
					maxHandcard(player, num) {
						return num + player.storage.olsbhongtu_limit[0];
					},
				},
				trigger: { player: "phaseEnd" },
				silent: true,
				lastDo: true,
				async content(event, trigger, player) {
					const skillName = event.name;
					player.storage[skillName] = [player.storage[skillName][1], 0];
					if (!player.storage[skillName][0]) {
						player.removeSkill(skillName);
					}
				},
			},
		},
	},
	olsbqiwu: {
		audio: 6,
		trigger: { player: "damageBegin4" },
		filter(event, player) {
			if (!event.source) {
				return false;
			}
			if (event.source !== player && !event.source.inRangeOf(player)) {
				return false;
			}
			return (
				game
					.getGlobalHistory(
						"everything",
						evt => {
							return evt.name == "damage" && evt.player == player;
						},
						event
					)
					.indexOf(event) === 0
			);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard(get.prompt(event.skill), `你可以弃置一张红色牌，防止${get.translation(trigger.source)}对你造成的${trigger.num}点伤害。`, "chooseonly", { color: "red" }, "he")
				.set("ai", card => {
					if (get.event().goon) {
						return 6 - get.value(card);
					}
					return 0;
				})
				.set("goon", get.damageEffect(player, trigger.source, player) < 0)
				.forResult();
		},
		async content(event, trigger, player) {
			await player.discard(event.cards);
			trigger.cancel();
		},
	},
	//法正
	olxuanhuo: {
		audio: 2,
		trigger: { player: "phaseDrawEnd" },
		filter(event, player) {
			return player.countCards("he") > 1 && game.hasPlayer(target => target != player);
		},
		async cost(event, trigger, player) {
			const ai2 = function (target) {
				const player = _status.event.player;
				if (
					!game.hasPlayer(current => {
						return current != player && current != target;
					})
				) {
					return get.effect(target, new lib.element.VCard({ name: "shunshou_copy2" }), player, player);
				}
				if (get.attitude(player, target) <= 0) {
					return 0;
				}
				let num = target.getUseValue(new lib.element.VCard({ name: "sha", isCard: true }), false);
				if (target.hasSkillTag("nogain")) {
					num /= 4;
				}
				return num;
			};
			event.result = await player
				.chooseCardTarget({
					prompt: get.prompt2(event.skill),
					filterCard: true,
					selectCard: 2,
					position: "he",
					filterTarget: lib.filter.notMe,
					goon: game.hasPlayer(function (current) {
						return current != player && ai2(player, current) > 0;
					}),
					ai1(card) {
						if (!_status.event.goon && game.countPlayer(target => target != _status.event.player) > 1) {
							return 0;
						}
						return 7 - get.value(card);
					},
					ai2: ai2,
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await player.give(event.cards, target);
			if (
				game.hasPlayer(function (current) {
					return current != player && current != target;
				})
			) {
				const result2 = await player
					.chooseTarget(
						function (card, player, target) {
							return target != player && target != _status.event.target;
						},
						"请选择" + get.translation(target) + "使用【杀】的目标",
						true
					)
					.set("target", target)
					.set("ai", function (target) {
						const evt = _status.event,
							card = new lib.element.VCard({ name: "sha", isCard: true });
						if (!evt.target.canUse(card, target, false)) {
							return 0;
						}
						return get.effect(target, card, evt.target, evt.player);
					})
					.set("target", target)
					.forResult();
				if (result2.bool) {
					const target2 = result2.targets[0];
					player.line(target2);
					const result = await target
						.chooseToUse(
							function (card, player, event) {
								if (get.name(card) != "sha") {
									return false;
								}
								return lib.filter.filterCard.apply(this, arguments);
							},
							"眩惑：对" + get.translation(target2) + "使用一张【杀】，或令" + get.translation(player) + "观看并获得你的两张牌"
						)
						.set("filterTarget", function (card, player, target) {
							if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
								return false;
							}
							return lib.filter.targetEnabled.apply(this, arguments);
						})
						.set("targetRequired", true)
						.set("complexTarget", true)
						.set("complexSelect", true)
						.set("sourcex", target2)
						.forResult();
					if (result.bool) {
						return;
					}
				}
			}
			await player.gainPlayerCard(target, 2, "he", true, "visible");
		},
		ai: { expose: 0.15 },
	},
	olenyuan: {
		audio: 2,
		group: ["olenyuan1", "olenyuan2"],
	},
	olenyuan1: {
		inherit: "xinenyuan1",
		sourceSkill: "olenyuan",
	},
};
