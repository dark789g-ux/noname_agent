import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcfuli" | "dcdehua" | "dcshoucheng">} */
export const groupSkills = {
	//刘理
	dcfuli: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.countDiscardableCards(player, "h");
		},
		usable: 1,
		async content(event, trigger, player) {
			await player.showHandcards(get.translation(player) + "发动了【抚黎】");
			const getNum = type => {
				let num = ["basic", "trick", "equip"].indexOf(type);
				if (num === -1) {
					num = 3;
				}
				return num;
			};
			const types = player
				.getDiscardableCards(player, "h")
				.reduce((list, card) => {
					return list.add(get.type2(card));
				}, [])
				.sort((a, b) => getNum(a) - getNum(b));
			if (types.length) {
				const { control } = await player
					.chooseControl(types)
					.set("ai", () => {
						const player = get.event().player,
							types = get.event().controls.slice();
						const getNum = type => {
							const cards = player.getDiscardableCards(player, "h").filter(card => get.type2(card) == type);
							const countCards = (target, player, cards) => {
								return target.countCards("h") - (target == player ? cards.length : 0);
							};
							const max = game
								.findPlayer(target => {
									return !game.hasPlayer(target2 => {
										return countCards(target2, player, cards) > countCards(target, player, cards);
									});
								})
								.countCards("h");
							return (
								Math.min(
									max,
									cards.reduce((sum, card) => sum + get.cardNameLength(card), 0)
								) / cards.length
							);
						};
						return types.sort((a, b) => {
							return getNum(b) - getNum(a);
						})[0];
					})
					.set("prompt", "弃置一种类别的所有手牌，然后摸这些牌的名字字数之和的牌")
					.forResult();
				if (control) {
					const cards = player.getDiscardableCards(player, "h").filter(card => get.type2(card) == control);
					await player.discard(cards);
					const max = game.findPlayer(target => target.isMaxHandcard()).countCards("h");
					const num = Math.min(
						max,
						cards.reduce((sum, card) => sum + get.cardNameLength(card), 0)
					);
					if (num) {
						await player.draw(num);
					}
					const goon = cards.some(card => get.is.damageCard(card));
					const { bool, targets } = await player
						.chooseTarget("抚黎：是否令一名角色的攻击范围" + (goon ? "减至0" : "-1") + "直到你的下个回合开始？", (card, player, target) => {
							return !get.event().goon || target.getAttackRange() > 0;
						})
						.set("ai", target => {
							const player = get.event().player,
								num = target.getAttackRange();
							if (get.attitude(player, target) > 0) {
								return -1;
							}
							if (get.event().goon) {
								return num;
							}
							if (num < 1) {
								return 1 / (1 - num);
							}
							return 5 / num;
						})
						.set("goon", goon)
						.forResult();
					if (bool) {
						const target = targets[0];
						player.line(target);
						target.addSkill("dcfuli_range");
						target.addMark("dcfuli_range", goon ? target.getAttackRange() : 1, false);
						player.when(["phaseBegin", "dieBegin"]).step(async () => {
							target.removeMark("dcfuli_range", target.countMark("dcfuli_range"), false);
							if (!target.hasMark("dcfuli_range")) {
								target.removeSkill("dcfuli_range");
							}
						});
					}
				}
			}
		},
		ai: {
			order: 1,
			result: {
				player(player) {
					const types = player.getDiscardableCards(player, "h").reduce((list, card) => {
						return list.add(get.type2(card));
					}, []);
					if (
						!types.some(type => {
							const cards = player.getDiscardableCards(player, "h").filter(card => get.type2(card) == type);
							const countCards = (target, player, cards) => {
								return target.countCards("h") - (target == player ? cards.length : 0);
							};
							return !game
								.filterPlayer(target => {
									return !game.hasPlayer(target2 => {
										return countCards(target2, player, cards) > countCards(target, player, cards);
									});
								})
								.includes(player);
						})
					) {
						return 0;
					}
					return 1;
				},
			},
		},
		subSkill: {
			range: {
				charlotte: true,
				onremove: true,
				mod: {
					attackRange(player, num) {
						return num - player.countMark("dcfuli_range");
					},
				},
				marktext: " - ",
				intro: { content: "攻击范围-#" },
			},
		},
	},
	dcdehua: {
		audio: 2,
		trigger: { global: "roundStart" },
		forced: true,
		async content(event, trigger, player) {
			const list = lib.inpile.filter(name => {
				if (get.type(name) === "delay" || player.getStorage("dcdehua").includes(name)) {
					return false;
				}
				const card = new lib.element.VCard({ name: name, isCard: true });
				return get.tag(card, "damage") && player.hasUseTarget(card);
			});
			if (list.length) {
				const { bool, links } = await player
					.chooseButton(['###德化###<div class="text center">视为使用一张未以此法选择过且可以使用的伤害类卡牌</div>', [list, "vcard"]], true)
					.set("ai", button => {
						const name = button.link[2],
							player = get.player();
						let value = player.getUseValue({ name, isCard: true }, null, true);
						if (player.countCards("h", card => get.name(card) === name && player.hasUseTarget(card))) {
							value /= 3;
						}
						if (name === "sha") {
							value /= 2;
						}
						return value;
					})
					.forResult();
				if (bool) {
					const name = links[0][2],
						card = new lib.element.VCard({ name: name, isCard: true });
					await player.chooseUseTarget(card, true);
					player.markAuto("dcdehua", [name]);
				}
			}
			if (
				!lib.inpile.some(name => {
					if (get.type(name) === "delay") {
						return false;
					}
					const card = new lib.element.VCard({ name: name });
					return get.tag(card, "damage") && !player.getStorage("dcdehua").includes(name);
				})
			) {
				await player.removeSkills("dcdehua");
				player.addSkill("dcdehua_hand");
			}
		},
		mod: {
			maxHandcard(player, num) {
				return num + player.getStorage("dcdehua").length;
			},
			cardEnabled(card, player) {
				if (player.getStorage("dcdehua").includes(card.name) && (get.position(card) == "h" || (card.cards && card.cards.some(i => get.position(i) == "h")))) {
					return false;
				}
			},
			cardSavable(card, player) {
				if (player.getStorage("dcdehua").includes(card.name) && (get.position(card) == "h" || (card.cards && card.cards.some(i => get.position(i) == "h")))) {
					return false;
				}
			},
			aiValue(player, card) {
				if (player.getStorage("dcdehua").includes(get.name(card))) {
					return 0;
				}
			},
			aiUseful() {
				return lib.skill.dcdehua.mod.aiValue.apply(this, arguments);
			},
		},
		intro: {
			content(storage) {
				return "<li>手牌上限+" + storage.length + "<br><li>不能使用手牌中的" + get.translation(storage);
			},
		},
		subSkill: {
			hand: {
				charlotte: true,
				mark: true,
				intro: { content: "伤害牌不计入手牌上限" },
				mod: {
					ignoredHandcard(card) {
						if (get.is.damageCard(card)) {
							return true;
						}
					},
					cardDiscardable(card, _, name) {
						if (name == "phaseDiscard" && get.is.damageCard(card)) {
							return false;
						}
					},
				},
			},
		},
	},
	//蒋琬费祎
	dcshoucheng: {
		audio: "shoucheng",
		global: "dcshoucheng_ai",
		trigger: {
			global: ["equipAfter", "addJudgeAfter", "loseAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		filter(event, player) {
			const target = _status.currentPhase;
			return game.hasPlayer(current => {
				if (target && current == target) {
					return false;
				}
				let evt = event.getl(current);
				return evt && evt.hs && evt.hs.length && current.countCards("h") == 0;
			});
		},
		async cost(event, trigger, player) {
			const targetx = _status.currentPhase;
			const targets = game
				.filterPlayer(current => {
					if ((targetx && current == targetx) || !current.isIn()) {
						return false;
					}
					let evt = trigger.getl(current);
					return evt && evt.hs && evt.hs.length && current.countCards("h") == 0;
				})
				.sortBySeat(targetx || player);
			event.result = await player
				.chooseTarget("是否对" + (targets.length > 1 ? "其中一名角色" : get.translation(targets[0])) + "发动【守成】？", "令其摸两张牌", (card, player, target) => {
					return get.event().targets.includes(target);
				})
				.set("targets", targets)
				.set("ai", target => get.attitude(get.event().player, target))
				.forResult();
		},
		usable: 1,
		async content(event, trigger, player) {
			const target = event.targets[0];
			if (get.mode() != "identity" || player.identity != "nei") {
				player.addExpose(0.2);
			}
			target.draw(2);
		},
		subSkill: {
			ai: {
				ai: {
					noh: true,
					skillTagFilter(player, tag, arg) {
						if (player === _status.currentPhase || player.countCards("h") != 1) {
							return false;
						}
						return game.hasPlayer(current => {
							return current.hasSkill("dcshoucheng") && get.attitude(current, player) > 0;
						});
					},
				},
			},
		},
	},
};
