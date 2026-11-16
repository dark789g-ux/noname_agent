import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twchaofeng" | "twchuanshu">} */
export const groupSkills = {
	//童渊
	twchaofeng: {
		audio: 2,
		enable: ["chooseToUse", "chooseToRespond"],
		hiddenCard(player, name) {
			if (!["sha", "shan"].includes(name)) {
				return false;
			}
			return player.hasCard(function (card) {
				const name2 = get.name(card);
				return (name2 == "sha" || name2 == "shan") && name != name2;
			}, "hs");
		},
		filter(event, player) {
			const names = [];
			if (event.filterCard(get.autoViewAs({ name: "sha" }, "unsure"), player, event)) {
				names.push("shan");
			}
			if (event.filterCard(get.autoViewAs({ name: "shan" }, "unsure"), player, event)) {
				names.push("sha");
			}
			return (
				names.length > 0 &&
				player.hasCard(function (card) {
					return names.includes(get.name(card));
				}, "hs")
			);
			//return false;
		},
		group: "twchaofeng_compare",
		chooseButton: {
			dialog(event, player) {
				var list = [];
				if (event.filterCard({ name: "sha" }, player, event)) {
					list.push(["基本", "", "sha"]);
					for (var j of lib.inpile_nature) {
						list.push(["基本", "", "sha", j]);
					}
				}
				if (event.filterCard({ name: "shan" }, player, event)) {
					list.push(["基本", "", "shan"]);
				}
				var dialog = ui.create.dialog("朝凤", [list, "vcard"], "hidden");
				dialog.direct = true;
				return dialog;
			},
			check(button) {
				var player = _status.event.player;
				var card = { name: button.link[2], nature: button.link[3] };
				if (
					_status.event.getParent().type != "phase" ||
					game.hasPlayer(function (current) {
						return player.canUse(card, current) && get.effect(current, card, player, player) > 0;
					})
				) {
					switch (button.link[2]) {
						case "shan":
							return 5;
						case "sha":
							if (button.link[3] == "fire") {
								return 2.95;
							} else if (button.link[3] == "thunder" || button.link[3] == "ice") {
								return 2.92;
							} else {
								return 2.9;
							}
					}
				}
				return 0;
			},
			backup(links, player) {
				return {
					audio: "twchaofeng",
					name: links[0][2],
					filterCard(card, player, target) {
						if (lib.skill.twchaofeng_backup.name == "sha") {
							return get.name(card) == "shan";
						} else {
							return get.name(card) == "sha";
						}
					},
					selectCard: 1,
					check(card, player, target) {
						return 6 - get.value(card);
					},
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						storage: {
							twchaofeng: true,
						},
					},
					position: "hs",
					popname: true,
				};
			},
			prompt(links, player) {
				var view, use;
				if (links[0][2] == "sha") {
					use = "【闪】";
					view = get.translation(links[0][3] || "") + "【" + get.translation(links[0][2]) + "】";
				} else {
					use = "【杀】";
					view = "【闪】";
				}
				return "将一张" + use + "当做" + view + (_status.event.name == "chooseToUse" ? "使用" : "打出");
			},
		},
		ai: {
			skillTagFilter(player, tag) {
				var name;
				switch (tag) {
					case "respondSha":
						name = "shan";
						break;
					case "respondShan":
						name = "sha";
						break;
				}
				if (!player.countCards("hs", name)) {
					return false;
				}
			},
			order(item, player) {
				if (player && _status.event.type == "phase") {
					var max = 0;
					if (player.countCards("hs", "shan") > 0 && lib.inpile_nature.some(i => player.getUseValue({ name: "sha", nature: i }) > 0)) {
						var temp = get.order({ name: "sha" });
						if (temp > max) {
							max = temp;
						}
					}
					if (max > 0) {
						max += 0.3;
					}
					return max;
				}
				return 4;
			},
			result: {
				player: 1,
			},
			respondSha: true,
			respondShan: true,
			fireAttack: true,
		},
		subSkill: {
			compare: {
				audio: "twchaofeng",
				trigger: { player: "useCardAfter" },
				usable: 2,
				filter(event, player) {
					return event.card?.storage?.twchaofeng;
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget(
							get.prompt("twchaofeng"),
							"选择至多三名角色进行拼点，赢的角色视为对所有没赢的角色使用一张无距离和次数限制且不计入次数的火【杀】",
							[1, 3],
							(card, player, target) => {
								return player.canCompare(target);
							}
						)
						.set("ai", function (target) {
							const player = _status.event.player,
								targets = ui.selected.targets.concat([target]),
								hs = get.event().max;
							let card = { name: "sha", nature: "fire", isCard: true },
								cache = ai.guessTargetPoints(target, player, null, "10"),
								max = cache.max,
								tar = target,
								eff = -get.attitude(player, target);
							if (target.hasSkill("twlvren")) {
								max += 2 * (ui.selected.targets.length + 1);
							}
							if (target.hasSkill("twchuanshu_effect")) {
								max += 3;
							}
							max = Math.min(13, max);
							cache.max = max;
							for (const cur of ui.selected.targets) {
								const temp = ai.guessTargetPoints(cur, player);
								if (temp.max > max) {
									max = temp.max;
									tar = cur;
								}
							}
							if (hs > max) {
								return (
									(player.canUse(card, target, false) ? get.effect(target, card, player, player) : 0) +
									eff -
									5 +
									ui.selected.targets.reduce((acc, p) => {
										return (
											acc + (player.canUse(card, p, false) ? get.effect(p, card, player, player) : 0) - get.attitude(player, p)
										);
									}, 0)
								);
							}
							return (
								(tar.canUse(card, player, false) ? get.effect(player, card, tar, player) : 0) +
								eff -
								5 +
								ui.selected.targets.reduce((acc, p) => {
									return acc + (tar.canUse(card, p, false) ? get.effect(p, card, tar, player) : 0) - get.attitude(player, p);
								}, 0)
							);
						})
						.set(
							"max",
							(() => {
								const max = player.getCards("h").reduce((res, card) => {
									const number = get.number(card);
									return Math.max(res, number);
								}, 0);
								if (player.hasSkill("twchuanshu_effect")) {
									return Math.min(13, max + 3);
								}
								return max;
							})()
						)
						.forResult();
				},
				async content(event, trigger, player) {
					const result = await player.chooseToCompare(event.targets).setContent("chooseToCompareMeanwhile").forResult();
					if (result.winner) {
						var targets = [player].addArray(event.targets).sortBySeat(player);
						targets.remove(result.winner);
						const card = { name: "sha", nature: "fire", isCard: true };
						const targetsx = targets.filter(function (target) {
							return result.winner.canUse(card, target, false, false);
						});
						if (targetsx.length) {
							await result.winner.useCard(card, targetsx, "noai").set("addCount", false);
						}
					}
				},
			},
		},
	},
	twchuanshu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget: true,
		/*limited: true,
		skillAnimation: true,
		animationColor: "qun",
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill))
				.set("ai", target => {
					if (!get.event().bool) {
						return 0;
					}
					let val = get.attitude(_status.event.player, target);
					if (target.hasSkill("twchaofeng")) {
						val += ai.guessTargetPoints(target).max;
					}
					return val * get.threaten(target);
				})
				.set(
					"bool",
					(() => {
						const fs =
							game.findPlayer(cur => {
								return get.attitude(player, cur) > 2 && (cur.hasSkill("twchaofwng") || get.threaten(cur) > player.getHp());
							}) || player;
						return (
							game.countPlayer(cur => {
								let eff = 0;
								if (get.attitude(player, cur) < 0) {
									eff = get.effect(cur, { name: "sha", nature: "fire", isCard: true }, player, player);
								}
								if (fs.hasSkill("twchaofeng")) {
									eff *= 2 - 1 / ai.guessTargetPoints(fs, player).max;
								}
								return Math.max(0, eff);
							}) >
							10 * player.getHp()
						);
					})()
				)
				.forResult();
		},*/
		async content(event, trigger, player) {
			const target = event.targets[0];
			target.addMark("twchuanshu_mark", 1, false);
			target.addSkill("twchuanshu_effect");
			target.markAuto("twchuanshu_effect", [player]);
			player.addSkill("twchuanshu_clear");
			player.markAuto("twchuanshu_clear", [target]);
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					let val = 0;
					if (target.hasSkill("twchaofeng")) {
						val += ai.guessTargetPoints(target).max;
					}
					return val * get.threaten(target);
				},
			},
		},
		subSkill: {
			mark: {
				charlotte: true,
			},
			effect: {
				audio: "twchuanshu",
				trigger: {
					player: "compare",
					target: "compare",
				},
				forced: true,
				popup: false,
				charlotte: true,
				mark: true,
				onremove(player, skill) {
					delete player.storage[skill];
					player.clearMark("twchuanshu_mark", false);
				},
				intro: {
					content(storage, player) {
						var shisyou = player.getStorage("twchuanshu_effect").filter(i => i.isIn());
						var str = "<li>拼点牌点数+5；";
						if (player.hasMark("twchuanshu_mark")) {
							str +=
								"<li>使用的下一张【杀】对除" +
								get.translation(shisyou) +
								"外的角色造成伤害时，此伤害+" +
								player.countMark("twchuanshu_mark") +
								"；";
							str += "<li>使用的下一张【杀】造成伤害时，" + get.translation(shisyou) + "摸等同于伤害值+1的牌；";
						}
						str = str.slice(0, -1) + "。";
						return str;
					},
				},
				filter(event, player, name) {
					if (event.player == player && event.iwhile > 0) {
						return false;
					}
					return (player == event.player ? event.num1 : event.num2) < 13;
				},
				async content(event, trigger, player) {
					game.log(player, "的拼点牌点数+5");
					if (player == trigger.player) {
						trigger.num1 = Math.min(13, trigger.num1 + 5);
					} else {
						trigger.num2 = Math.min(13, trigger.num2 + 5);
					}
				},
				group: "twchuanshu_damage",
			},
			damage: {
				charlotte: true,
				trigger: { player: ["useCard"], source: ["damageBegin1", "damageBegin4"] }, //, "useCardAfter"
				filter(event, player, name) {
					if (name == "useCard") {
						return event.card.name == "sha" && player.hasMark("twchuanshu_mark");
					}
					if (name == "damageBegin1") {
						return event.card?.twchuanshu_mark && !player.getStorage("twchuanshu_effect").includes(event.player);
					}
					return (
						event.card?.twchuanshu_mark &&
						player.getStorage("twchuanshu_effect").some(function (target) {
							return target.isIn(); // && target != player
						})
					);
					/*return (
						event.card.twchuanshu_mark &&
						player.hasHistory("sourceDamage", function (evt) {
							return evt.card == event.card;
						}) &&
						player.getStorage("twchuanshu_effect").filter(function (target) {
							return target.isIn() && target != player;
						}).length
					);*/
				},
				forced: true,
				async content(event, trigger, player) {
					const name = event.triggername;
					if (name == "useCard") {
						const num = player.countMark("twchuanshu_mark");
						trigger.card.twchuanshu_mark = num;
						player.removeMark("twchuanshu_mark", num, false);
					} else if (name == "damageBegin1") {
						trigger.num += trigger.card.twchuanshu_mark;
					} else {
						const num1 = trigger.card.twchuanshu_mark;
						/*let num2 = 0;
						player.getHistory("sourceDamage", function (evt) {
							if (evt.card == trigger.card) {
								num2 += evt.num;
							}
						});*/
						const targets = player.getStorage("twchuanshu_effect").filter(function (target) {
							return target.isIn(); // && target != player
						});
						if (!targets.length) {
							return;
						}
						if (targets.length == 1) {
							await targets[0].draw(num1 * (trigger.num + 1));
						} else {
							await game.asyncDraw(targets, num1 * (trigger.num + 1));
						}
					}
				},
			},
			clear: {
				charlotte: true,
				onremove: true,
				trigger: { player: "phaseBegin" },
				filter(event, player) {
					return player.getStorage("twchuanshu_clear").length;
				},
				forced: true,
				silent: true,
				async content(event, trigger, player) {
					const targets = player.getStorage("twchuanshu_clear");
					for (const target of targets) {
						target.unmarkAuto("twchuanshu_effect", [player]);
						if (!target.getStorage("twchuanshu_effect").length) {
							target.removeSkill("twchuanshu_effect");
						}
					}
					player.removeSkill("twchuanshu_clear");
				},
			},
		},
	},
};
