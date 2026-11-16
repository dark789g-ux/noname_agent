import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twxiongzheng" | "twluannian" | "twmutao" | "twyimou">} */
export const groupSkills = {
	//马腾
	twxiongzheng: {
		audio: 2,
		onremove: true,
		trigger: { global: "roundStart" },
		filter(event, player) {
			return game.hasPlayer(target => !player.getStorage("twxiongzheng").includes(target));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "选择一名未选择过的角色，称为“雄争”角色", (card, player, target) => {
					return !player.getStorage("twxiongzheng").includes(target);
				})
				.set("ai", target => {
					var player = _status.event.player,
						att = get.attitude(player, target);
					if (game.roundNumber <= 1 && player.hasUnknown()) {
						return 0;
					}
					return -att;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			var target = event.targets[0];
			player.markAuto("twxiongzheng", [target]);
			player.storage.twxiongzheng_target = target;
			player.addTempSkill("twxiongzheng_mark", "roundStart");
			target.addTempSkill("twxiongzheng_threaten", "roundStart");
			await game.delayx();
		},
		subSkill: {
			mark: {
				charlotte: true,
				onremove(player, skill) {
					delete player.storage[skill];
					delete player.storage.twxiongzheng_target;
				},
				intro: { content: "$参与了〖雄争〗的争斗" },
				trigger: { global: "damage" },
				filter(event, player) {
					return event.player == player.storage.twxiongzheng_target && get.itemtype(event.source) == "player";
				},
				direct: true,
				firstDo: true,
				content() {
					player.markAuto("twxiongzheng_mark", [trigger.source]);
				},
				group: "twxiongzheng_effect",
			},
			threaten: {
				charlotte: true,
				mark: true,
				intro: { content: "本轮〖雄争〗目标" },
				ai: { threaten: 10 },
			},
			effect: {
				charlotte: true,
				audio: "twxiongzheng",
				trigger: { global: "roundEnd" },
				filter(event, player) {
					const sha = new lib.element.VCard({ name: "sha", isCard: true });
					return game.hasPlayer(target => player.getStorage("twxiongzheng_mark").includes(target) || player.canUse(sha, target, false));
				},
				async cost(event, trigger, player) {
					const target = player.storage.twxiongzheng_target;
					if (!target) {
						return;
					}
					const sha = new lib.element.VCard({ name: "sha", isCard: true });
					const list = game.filterPlayer(target => player.getStorage("twxiongzheng_mark").includes(target));
					const list2 = game.filterPlayer(target => !list.includes(target) && player.canUse(sha, target, false));
					let choiceList = [
						["sha", `视为对任意名本轮未对${get.translation(target)}造成过伤害的角色依次使用一张【杀】`],
						["draw", `令任意名本轮对${get.translation(target)}造成过伤害的角色摸两张牌`],
					];
					if (list2.length) {
						choiceList[0][1] += `（${get.translation(list2)}）`;
					}
					if (list.length) {
						choiceList[1][1] += `（${get.translation(list)}）`;
					}
					const result = await player
						.chooseButtonTarget({
							createDialog: ["雄争：你可以选择一项", [choiceList, "textbutton"]],
							list2,
							list,
							filterButton(button) {
								const link = button.link;
								const { list, list2 } = get.event();
								if (link == "sha") {
									return list2.length > 0;
								}
								return list.length > 0;
							},
							filterTarget(card, player, target) {
								if (!ui.selected.buttons.length) {
									return false;
								}
								const link = ui.selected.buttons[0].link;
								const { list, list2 } = get.event();
								if (link == "sha") {
									return list2.includes(target);
								}
								return list.includes(target);
							},
							selectTarget: [1, Infinity],
							complexSelect: true,
							ai1(button) {
								const { player, list, list2 } = get.event();
								const link = button.link;
								const eff1 = list2.reduce((acc, target) => {
										const eff = get.effect(target, { name: "sha" }, player, player);
										if (eff > 0) {
											return acc + eff;
										}
										return acc;
									}, 0),
									eff2 = list.reduce((acc, target) => {
										const eff = get.effect(target, { name: "draw" }, player, player);
										if (eff > 0) {
											return acc + eff;
										}
										return acc;
									}, 0);
								if (eff2 > eff1 && link == "draw") {
									return 2;
								}
								if (eff1 > 0 && link == "sha") {
									return 1;
								}
								return 0;
							},
							ai2(target) {
								const link = ui.selected.buttons[0]?.link,
									player = get.player(),
									att = get.attitude(player, target);
								if (!link) {
									return 0;
								}
								return get.effect(target, { name: link }, player, player);
							},
						})
						.forResult();
					event.result = {
						bool: result.bool,
						targets: result.targets,
						cost_data: result.links,
					};
				},
				async content(event, trigger, player) {
					const goon = event.cost_data[0] === "sha";
					const targets = event.targets.sortBySeat();
					player.line(targets);
					if (goon) {
						const sha = new lib.element.VCard({ name: "sha", isCard: true });
						for (const target of targets) {
							if (!target.isIn() || !player.canUse(sha, target, false)) {
								continue;
							}
							await player.useCard(sha, target, false);
						}
					} else {
						await game.asyncDraw(targets, 2);
						await game.delayx();
					}
				},
			},
		},
	},
	twluannian: {
		audio: 2,
		global: "twluannian_global",
		zhuSkill: true,
		subSkill: {
			global: {
				audio: "twluannian",
				enable: "phaseUse",
				usable: 1,
				forceaudio: true,
				onChooseToUse(event) {
					if (!game.online) {
						var num = 1;
						game.countPlayer2(current => {
							var history = current.actionHistory;
							for (var i = history.length - 1; i >= 0; i--) {
								for (var evt of history[i].useSkill) {
									if (evt.skill == "twluannian_global") {
										num++;
									}
								}
								if (history[i].isRound) {
									break;
								}
							}
						});
						event.set("twluannian_num", num);
					}
				},
				filter(event, player) {
					if (!event.twluannian_num) {
						return false;
					}
					return (
						player.group == "qun" &&
						player.countCards("he") >= event.twluannian_num &&
						game.hasPlayer(function (current) {
							var target = current.storage.twxiongzheng_target;
							return target && target.isIn() && current != player && current.hasZhuSkill("twluannian", player);
						})
					);
				},
				filterCard: true,
				position: "he",
				prompt() {
					var player = _status.event.player;
					var num = _status.event.twluannian_num;
					var list = game
						.filterPlayer(function (current) {
							return current.hasZhuSkill("twluannian", player);
						})
						.map(i => i.storage.twxiongzheng_target)
						.sortBySeat();
					return "弃置" + get.cnNumber(num) + "张牌，对" + get.translation(list) + (list.length > 1 ? "中的一人" : "") + "造成1点伤害";
				},
				selectCard() {
					return _status.event.twluannian_num;
				},
				complexSelect: true,
				complexCard: true,
				filterTarget(card, player, target) {
					return game
						.filterPlayer(function (current) {
							return current.hasZhuSkill("twluannian", player);
						})
						.map(i => i.storage.twxiongzheng_target)
						.includes(target);
				},
				selectTarget() {
					return game
						.filterPlayer(function (current) {
							return current.hasZhuSkill("twluannian", _status.event.player);
						})
						.map(i => i.storage.twxiongzheng_target)
						.filter(i => i && i.isIn()).length > 1
						? 1
						: -1;
				},
				check(card) {
					return 6 - get.value(card);
				},
				content() {
					target.damage();
				},
				ai: {
					order: 7,
					result: {
						target(player, target) {
							return get.damageEffect(target, player, target);
						},
					},
					expose: 0.25,
				},
			},
		},
		ai: {
			combo: "twxiongzheng",
		},
	},
	//鲍信
	twmutao: {
		audio: 2,
		enable: "phaseUse",
		filterTarget(card, player, target) {
			return target.countCards("h") && target !== player;
		},
		usable: 1,
		async content(event, trigger, player) {
			let source = event.target;
			let cards = source.getCards("h", { name: "sha" });
			if (!cards.length) {
				game.log("但", source, "没有", "#y杀", "！");
				return;
			}
			let togive = source.getNext();
			let gained;
			while (true) {
				let card = source.getCards("h", { name: "sha" }).randomGet();
				if (togive == gained) {
					break;
				}
				if (togive.isIn()) {
					await source.give(card, togive);
					gained = togive;
				}
				let num = togive == source ? 1 : 0;
				if (source.countCards("h", { name: "sha" }) > num) {
					togive = togive.getNext();
				} else {
					break;
				}
			}
			source.line(togive);
			let num = togive.countCards("h", { name: "sha" });
			if (num) {
				await togive.damage(Math.min(2, num), source);
			}
		},
		ai: {
			order: 10,
			result: {
				player(player, target) {
					var numx = target.countCards("h", { name: "sha" }),
						targetx = target,
						map = {};
					for (var i = 0; i < numx; i++) {
						targetx = targetx.getNext();
						map[targetx.playerid] ??= 0;
						map[targetx.playerid]++;
					}
					var att = get.damageEffect(targetx, player, player);
					return att * numx * Math.min(2, targetx.countCards("h", { name: "sha" }) + map[targetx.playerid]);
				},
			},
		},
	},
	twyimou: {
		audio: 2,
		trigger: { global: "damageEnd" },
		filter(event, player) {
			return event.player.isIn() && event.player !== player && get.distance(event.player, player) <= 1;
		},
		logTarget: "player",
		check(event, player) {
			return get.attitude(player, event.player) > 0;
		},
		async content(event, trigger, player) {
			const target = trigger.player,
				name = get.translation(target);
			if (trigger.player != player) {
				player.addExpose(0.3);
			}
			let choiceList = [
				`令${name}获得牌堆里的一张【杀】`,
				`令${name}将一张手牌交给另一名角色，然后${name}摸两张牌`,
				`背水！${target != player ? "将所有手牌交给" + name + "，然后" : ""}依次执行以上所有选项`,
			];
			let list = ["选项一"];
			if (target.countCards("h") && game.hasPlayer(t => t !== target)) {
				list.push("选项二");
			} else {
				choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
			}
			if (player.countCards("h") && player !== target) {
				list.push("背水！");
			} else {
				choiceList[2] = '<span style="opacity:0.5">' + choiceList[2] + "</span>";
			}
			const { control } = await player
				.chooseControl(list)
				.set("prompt", "毅谋：请选择一项")
				.set("choiceList", choiceList)
				.set("ai", function () {
					var evt = _status.event.getTrigger(),
						list = _status.event.list;
					var player = _status.event.player;
					var target = evt.player;
					if ((target.hp >= target.countCards("h") + 2 || target == player) && list.includes("背水！")) {
						return "背水！";
					}
					if (target.countCards("h") && list.includes("选项二")) {
						return "选项二";
					}
					return "选项一";
				})
				.set("list", list)
				.forResult();
			if (control != "选项二") {
				let card = get.cardPile2(function (card) {
					return card.name == "sha";
				});
				if (card) {
					await target.gain(card, "gain2");
				} else {
					game.log("但牌堆里已经没有", "#y杀", "了！");
				}
			}
			if (control != "选项一") {
				if (target.countCards("h") && game.hasPlayer(t => t !== target)) {
					const result = await target
						.chooseCardTarget({
							prompt: "将一张手牌交给另一名其他角色并摸两张牌",
							filterCard: true,
							forced: true,
							filterTarget: lib.filter.notMe,
							ai1(card) {
								return 1 / Math.max(0.1, get.value(card));
							},
							ai2(target) {
								var player = _status.event.player,
									att = get.attitude(player, target);
								if (target.hasSkillTag("nogain")) {
									att /= 9;
								}
								return 4 + att;
							},
						})
						.forResult();
					if (result?.bool && result?.cards?.length && result?.targets?.length) {
						const targetx = result.targets[0];
						target.line(targetx);
						await target.give(result.cards, targetx);
						await target.draw(2);
					}
				}
			}
			if (control == "背水！" && player != target && player.countCards("h")) {
				await player.give(player.getCards("h"), target);
			}
		},
		ai: {
			threaten: 2.5,
		},
	},
};
