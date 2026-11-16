import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twyuanhu" | "twjuezhu" | "twfengpo" | "twmouzhu">} */
export const groupSkills = {
	twyuanhu: {
		audio: "yuanhu",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.hasCard({ type: "equip" }, "eh");
		},
		filterCard: { type: "equip" },
		filterTarget(card, player, target) {
			var card = ui.selected.cards[0];
			return target.canEquip(card);
		},
		discard: false,
		lose: false,
		prepare: "give",
		position: "he",
		check(card) {
			if (get.position(card) == "h") {
				return 9 - get.value(card);
			}
			return 7 - get.value(card);
		},
		logAudio(event, player) {
			const num = Math.min(get.equipNum(event.cards[0]), 3);
			return "yuanhu" + num + ".mp3";
		},
		async content(event, trigger, player) {
			const {
				target,
				cards: [card],
			} = event;
			await target.equip(card);
			switch (get.subtype(card)) {
				case "equip1":
					if (
						game.hasPlayer(function (current) {
							return current != target && get.distance(target, current) == 1 && current.countCards("hej") > 0;
						})
					) {
						const result = await player
							.chooseTarget(
								true,
								"弃置一名距离" + get.translation(target) + "为1的角色区域内的一张牌",
								function (card, player, target) {
									var current = _status.event.current;
									return current != target && get.distance(current, target) == 1 && current.countCards("hej") > 0;
								}
							)
							.set("current", target)
							.set("ai", function (target) {
								var player = _status.event.player;
								return get.effect(target, { name: "guohe_copy" }, player, player);
							})
							.forResult();
						if (result?.bool) {
							const targetx = result.targets[0];
							player.line(targetx);
							await player.discardPlayerCard(targetx, true, "hej");
						}
					}
					break;
				case "equip2":
					await target.draw();
					break;
				case "equip3":
				case "equip4":
				case "equip5":
				case "equip6":
					await target.recover();
					break;
			}
			if (target.hp <= player.hp || target.countCards("h") <= player.countCards("h")) {
				await player.draw();
				player.addTempSkill("twyuanhu_end");
			}
		},
		ai: {
			order: 10,
			result: {
				player(player, target) {
					if (get.attitude(player, target) == 0) {
						return 0;
					}
					if (!ui.selected.cards.length) {
						return;
					}
					var eff = get.effect(target, ui.selected.cards[0], player, player),
						sub = get.subtype(ui.selected.cards[0], false);
					if (target == player) {
						eff += 4;
					} else {
						var hp = player.hp,
							hs = player.countCards("h", card => card != ui.selected.cards[0]);
						var tp = target.hp,
							ts = target.countCards("h");
						if (sub == "equip2") {
							ts++;
						}
						if (tp < target.maxHp && (sub == "equip3" || sub == "equip4" || sub == "equip5" || sub == "equip6")) {
							tp++;
						}
						if (tp <= hp || ts <= hs) {
							eff += 2;
						}
					}
					if (sub == "equip1") {
						var list = game
							.filterPlayer(function (current) {
								return current != target && get.distance(target, current) == 1 && current.countCards("hej") < 0;
							})
							.map(function (i) {
								return get.effect(i, { name: "guohe_copy" }, player, player);
							})
							.sort((a, b) => b - a);
						if (list.length) {
							eff += list[0];
						}
					}
					return eff;
				},
				target(player, target) {
					if (!ui.selected.cards.length) {
						return 0;
					}
					var sub = get.subtype(ui.selected.cards[0], false);
					var eff = get.effect(target, ui.selected.cards[0], player, target);
					if (sub == "equip2") {
						eff += get.effect(target, { name: "draw" }, target, target);
					}
					if (target.isDamaged() && (sub == "equip3" || sub == "equip4" || sub == "equip5" || sub == "equip6")) {
						eff += get.recoverEffect(target, player, player);
					}
					return eff;
				},
			},
		},
		subSkill: {
			end: {
				trigger: { player: "phaseJieshuBegin" },
				charlotte: true,
				filter(event, player) {
					return player.hasSkill("twyuanhu") && player.hasCard({ type: "equip" }, "eh");
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseCardTarget({
							prompt: get.prompt("twyuanhu"),
							prompt2:
								"将一张装备牌置入一名角色的装备区内。若此牌为：武器牌，你弃置与其距离为1的另一名角色区域的一张牌；防具牌，其摸一张牌；坐骑牌，其回复1点体力；宝物牌，你选择基本牌或普通锦囊牌从牌堆中获得一张，其获得另一类型的一张牌。然后若其体力值或手牌数不大于你，则你可摸一张牌。",
							filterCard: lib.skill.twyuanhu.filterCard,
							filterTarget: lib.skill.twyuanhu.filterTarget,
							position: "he",
							ai1: lib.skill.twyuanhu.check,
							ai2(target) {
								var player = _status.event.player;
								return get.effect(target, "twyuanhu", player, player);
							},
						})
						.forResult();
					event.result.skill_popup = false;
				},
				async content(event, trigger, player) {
					const { cards, targets } = event;
					const result = {
						cards: cards,
						targets: targets,
						skill: "twyuanhu",
					};
					await player.useResult(result, event);
				},
			},
		},
	},
	twjuezhu: {
		audio: 2,
		limited: true,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.hasEnabledSlot(3) || player.hasEnabledSlot(4);
		},
		skillAnimation: true,
		animationColor: "water",
		async cost(event, trigger, player) {
			let list = [3, 4].filter(num => player.hasEmptySlot(num)).map(num => `equip${num}`);
			if (list.length > 1) {
				const prompt = `###${get.prompt(event.skill)}###废除一个装备栏并选择一名角色，令其获得〖飞影〗并废除判定区`;
				const { bool, targets, links } = await player
					.chooseButtonTarget({
						createDialog: [prompt, [list.map(i => [i, get.translation(i)]), "tdnodes"]],
						filterTarget(card, player, target) {
							return !target.hasSkill("feiying");
						},
						ai1(button) {
							return Math.random();
						},
						ai2(target) {
							if (player.hasUnknown()) {
								return 0;
							}
							return get.attitude(player, target);
						},
					})
					.forResult();
				if (bool) {
					event.result = {
						bool: true,
						targets: targets,
						cost_data: links[0],
					};
				}
			} else {
				const prompt = `###${get.prompt(event.skill)}###废除${get.translation(list[0])}栏并选择一名角色，令其获得〖飞影〗并废除判定区`;
				event.result = await player
					.chooseTarget(prompt, [1, 2], function (card, player, target) {
						return !ui.selected.targets.length && !target.hasSkill("feiying");
					})
					.set("multitarget", true)
					.set("promptbar", "none")
					.set("ai", function (target) {
						if (player.hasUnknown()) {
							return 0;
						}
						return get.attitude(player, target);
					})
					.forResult();
				event.result.cost_data = list[0];
			}
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
				cost_data: equip,
			} = event;
			player.awakenSkill(event.name);
			await player.disableEquip(equip);
			await target.disableJudge();
			player.addSkill(`${event.name}_restore`);
			player.markAuto(`${event.name}_restore`, [[target, equip]]);
			target.addSkills("feiying");
		},
		subSkill: {
			restore: {
				audio: "twjuezhu",
				trigger: { global: "die" },
				forced: true,
				charlotte: true,
				filter(event, player) {
					for (let i of player.getStorage("twjuezhu_restore")) {
						if (i[0] == event.player && player.hasDisabledSlot(i[1])) {
							return true;
						}
					}
					return false;
				},
				async content(event, trigger, player) {
					let list = [];
					for (let i of player.getStorage("twjuezhu_restore")) {
						if (i[0] == trigger.player && player.hasDisabledSlot(i[1])) {
							list.push(i[1]);
						}
					}
					await player.enableEquip(list);
				},
			},
		},
		derivation: "feiying",
	},
	twfengpo: {
		audio: "fengpo",
		trigger: { player: "useCardToPlayered" },
		logTarget: "target",
		filter(event, player) {
			return (event.card.name == "sha" || event.card.name == "juedou") && event.targets.length == 1 && event.target.countCards("h") > 0;
		},
		onremove: true,
		content() {
			"step 0";
			event.target = trigger.target;
			player.viewHandcards(trigger.target);
			"step 1";
			var num = target.countCards("h", player.storage.twfengpo ? { color: "red" } : { suit: "diamond" });
			if (!num) {
				event.finish();
				return;
			}
			event.num = num;
			player.chooseControl().set("choiceList", ["摸" + num + "张牌", "令" + get.translation(trigger.card) + "的伤害值基数+" + num]);
			"step 2";
			if (result.index == 0) {
				player.draw(num);
			} else {
				trigger.getParent().baseDamage += num;
			}
		},
		group: "twfengpo_kill",
		subSkill: {
			kill: {
				audio: "fengpo",
				trigger: { source: "die" },
				forced: true,
				filter: (event, player) => !player.storage.twfengpo,
				skillAnimation: true,
				animationColor: "fire",
				content() {
					player.storage.twfengpo = true;
					player.popup("凤魄");
					game.log(player, "恢复了技能", "#g【凤魄】");
				},
			},
		},
	},
	twmouzhu: {
		audio: "mouzhu",
		enable: "phaseUse",
		usable: 1,
		filterTarget: lib.filter.notMe,
		async contentBefore(event, trigger, player) {
			const target = event.targets[0],
				evt = event.getParent();
			evt._target = target;
			evt.given_map = new Map();
			const list = game.filterPlayer(function (current) {
				return current != player && current != target && current.hp <= player.hp;
			});
			if (!list.length) {
				await player.loseHp();
				evt.finish();
			} else {
				evt.targets = list.sortBySeat();
				player.line(list);
			}
		},
		async content(event, trigger, player) {
			const target = event.target;
			if (!player.isIn() || !target.countGainableCards(player, "h")) {
				return;
			}
			const result = await target
				.chooseToGive(player, "h")
				.set("ai", card => {
					const { player, target } = get.event();
					const att = get.attitude(player, target);
					if (att > 0) {
						return 7 - get.value(card);
					}
					return 0;
				})
				.forResult();
			if (!result?.bool || !result.cards?.length) {
				game.log(target, "拒绝给牌");
			} else {
				target.addExpose(0.1);
				event.getParent().given_map ??= new Map();
				event.getParent().given_map.set(target, result.cards);
			}
		},
		async contentAfter(event, trigger, player) {
			event.getParent().given_map ??= new Map();
			let num = Array.from(event.getParent().given_map.values()).flat().length;
			if (!num) {
				await player.loseHp();
				await game.doAsyncInOrder(event.targets, async target => {
					await target.loseHp();
				});
			} else {
				const target = event.getParent()._target;
				let list = ["sha", "juedou"].filter(name => player.canUse(get.autoViewAs({ name }, []), target, false)),
					result;
				if (!list.length) {
					return;
				} else if (list.length == 1) {
					result = { control: list[0] };
				} else {
					result = await target
						.chooseControl(list)
						.set("prompt", "谋诛：视为被" + get.translation(player) + "使用一张…")
						.set("prompt2", "（伤害值基数：" + num + "）")
						.set("ai", function (event, target) {
							const player = event.player;
							if (target.hasShan() || get.effect(target, { name: "sha" }, player, target) > 0) {
								return "sha";
							}
							if (get.effect(target, { name: "juedou" }, player, target) > 0) {
								return "juedou";
							}
							return "sha";
						})
						.forResult();
				}
				if (result?.control && lib.card[result.control]) {
					await player
						.useCard(
							{
								name: result.control,
								isCard: true,
							},
							false,
							target
						)
						.set("baseDamage", num);
				}
			}
		},
		ai: {
			order: 9,
			result: {
				target(player, target) {
					if (get.attitude(player, target) >= 0) {
						return 0;
					}
					var list = game.filterPlayer(function (current) {
						return current != player && current != target && current.hp <= player.hp;
					});
					if (!list.length) {
						return 0;
					}
					return (
						-Math.min(-get.effect(target, { name: "sha" }, player, target), -get.effect(target, { name: "juedou" }, player, target)) *
						list.reduce(function (num, current) {
							return num + (2 + get.sgn(get.attitude(current, player)));
						}, 0)
					);
				},
			},
		},
	},
};
