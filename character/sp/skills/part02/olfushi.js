import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olfushi" | "oldongdao">} */
export const groupSkills = {
	//吕伯奢
	olfushi: {
		audio: 2,
		trigger: { global: "useCardAfter" },
		filter(event, player) {
			return event.player.isIn() && event.card.name == "sha" && event.cards && event.cards.filterInD().length && get.distance(player, event.player) <= 1;
		},
		forced: true,
		locked: false,
		logTarget: "player",
		content() {
			player.addToExpansion(trigger.cards.filterInD(), "gain2").gaintag.add("olfushi");
		},
		marktext: "豕",
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		group: "olfushi_wusheng",
		subSkill: {
			wusheng: {
				enable: "chooseToUse",
				filter(event, player) {
					return player.getExpansions("olfushi").length && event.filterCard({ name: "sha", isCard: true }, player, event);
				},
				chooseButton: {
					dialog(event, player) {
						return ui.create.dialog('###缚豕###<div class="text center">将任意“缚豕”牌置入弃牌堆并摸等量的牌，视为使用一张【杀】并执行等量项</div>', player.getExpansions("olfushi"), [["额外目标", "伤害-1", "伤害+1"], "tdnodes"], "hidden");
					},
					filter(button) {
						const cards = ui.selected.buttons.filter(button => typeof button.link == "object");
						if (cards.length >= 3 && typeof button.link == "string") {
							return false;
						}
						return true;
					},
					select: [2, Infinity],
					filterOk: () => {
						if (!ui.selected.buttons.length) {
							return false;
						}
						const controls = ui.selected.buttons.filter(button => typeof button.link == "string");
						const cards = ui.selected.buttons.filter(button => typeof button.link == "object");
						if (cards.length >= 3) {
							const dialog = get.event().dialog;
							if (dialog && dialog.buttons) {
								dialog.buttons.forEach(button => {
									if (typeof button.link != "string") {
										return;
									}
									button.classList.remove("selectable");
									button.classList.remove("selected");
									ui.selected.buttons.remove(button);
								});
							}
							return true;
						}
						return cards.length == controls.length;
					},
					check(button) {
						const player = get.player();
						const card = new lib.element.VCard({ name: "sha", isCard: true });
						const targets = game.filterPlayer(target => {
							return player.canUse(card, target);
						});
						const num0 = targets.filter(target => get.effect(target, card, player, player) > 0).length;
						if (num0 <= 0) {
							return 0;
						}
						const num1 = Math.max(0, num0 - 1);
						const num2 = targets.length - num1;
						const num3 = player.getExpansions("olfushi").length;
						let list;
						if ((num1 > 0 && num2 > 0) || (num1 == 0 && num2 == 0)) {
							switch (num3) {
								case 1:
									list = [["额外目标", "伤害+1"].randomGet()];
									break;
								case 2:
									list = [["额外目标", "伤害+1"].randomGet(), "伤害-1"];
									break;
								default:
									list = ["额外目标", "伤害-1", "伤害+1"];
									break;
							}
						} else if (num2 == 0) {
							switch (num3) {
								case 1:
									list = ["伤害+1"];
									break;
								case 2:
									list = ["额外目标", "伤害+1"];
									break;
								default:
									list = ["额外目标", "伤害-1", "伤害+1"];
									break;
							}
						} else if (num1 == 0) {
							switch (num3) {
								case 1:
									list = ["伤害+1"];
									break;
								default:
									list = ["伤害-1", "伤害+1"];
									break;
							}
						}
						if (typeof button.link == "string") {
							if (list.includes(button.link)) {
								return 114514;
							}
							return -1;
						} else {
							const cards = ui.selected.buttons.filter(button => typeof button.link == "object");
							if ((list.length == 3 && (player.getHp() <= 2 || cards.length < num3 - 1)) || cards.length < list.length) {
								return 1 / (get.value(button.link) || 0.5);
							}
							return -1;
						}
					},
					backup(links, player) {
						var cards = links.filter(button => typeof button == "object");
						var controls = links.filter(button => typeof button == "string");
						if (!controls.length) {
							controls = ["额外目标", "伤害-1", "伤害+1"];
						}
						return {
							audio: "olfushi",
							selectCard: -1,
							position: "x",
							cards: cards,
							controls: controls,
							filterCard(card) {
								return lib.skill.olfushi_wusheng_backup.cards.includes(card);
							},
							viewAs: {
								name: "sha",
								isCard: true,
							},
							log: false,
							precontent() {
								var cards = lib.skill.olfushi_wusheng_backup.cards.slice();
								var controls = lib.skill.olfushi_wusheng_backup.controls.slice();
								player.logSkill("olfushi");
								event.result.card = new lib.element.VCard(lib.skill.olfushi_wusheng_backup.viewAs);
								event.result.cards = [];
								player.loseToDiscardpile(cards);
								player.draw(cards.length);
								event.result.card.storage.olfushi_buff = controls;
								player.addTempSkill("olfushi_buff");
							},
						};
					},
					prompt(links, player) {
						let controls = links.filter(button => typeof button == "string");
						if (!controls.length) {
							controls = ["额外目标", "伤害-1", "伤害+1"];
						}
						return `请选择【杀】的目标（${controls.join("、")}）`;
					},
				},
				ai: {
					order(item, player) {
						return get.order({ name: "sha" }) + 0.1;
					},
					result: { player: 1 },
					respondSha: true,
					skillTagFilter(player, tag, arg) {
						if (arg == "respond") {
							return false;
						}
						if (!player.getExpansions("olfushi").length) {
							return false;
						}
					},
				},
			},
			buff: {
				charlotte: true,
				trigger: { player: ["useCard2", "useCardToPlayered"] },
				filter(event, player, name) {
					if (!event.card.storage || !event.card.storage.olfushi_buff) {
						return false;
					}
					if (name == "useCard2") {
						return true;
					}
					return event.getParent().triggeredTargets3.length == event.targets.length && event.card.storage.olfushi_buff.length > 1 && event.card.storage.olfushi_buff.includes("伤害-1") && !event.targets.some(target => !event.targets.includes(target.getPrevious()) && !event.targets.includes(target.getNext()));
				},
				forced: true,
				popup: false,
				content() {
					"step 0";
					if (event.triggername == "useCardToPlayered") {
						if (trigger.getParent().addCount !== false) {
							trigger.getParent().addCount = false;
							if (player.stat[player.stat.length - 1].card.sha > 0) {
								player.stat[player.stat.length - 1].card.sha--;
							}
						}
						game.log(trigger.card, "不计入次数");
						event.finish();
						return;
					}
					var list = trigger.card.storage.olfushi_buff;
					event.list = list;
					var canBeAddedTargets = game.filterPlayer(target => {
						return !trigger.targets.includes(target) && player.canUse(trigger.card, target);
					});
					if (!list.includes("额外目标") || !canBeAddedTargets.length) {
						event._result = { bool: false };
					} else if (canBeAddedTargets.length == 1) {
						event._result = { bool: true, targets: canBeAddedTargets };
					} else {
						player
							.chooseTarget(
								"请选择" + get.translation(trigger.card) + "的额外目标",
								function (card, player, target) {
									var trigger = _status.event.getTrigger();
									return !trigger.targets.includes(target) && player.canUse(trigger.card, target);
								},
								true
							)
							.set("ai", function (target) {
								var player = _status.event.player;
								return get.attitude(player, target);
							});
					}
					"step 1";
					if (result.bool) {
						var targets = result.targets.sortBySeat();
						player.line(targets);
						trigger.targets.addArray(targets);
						game.log(targets, "成为了", trigger.card, "的额外目标");
					}
					"step 2";
					if (!event.list.includes("伤害-1")) {
						event._result = { bool: false };
					} else if (trigger.targets.length == 1) {
						event._result = { bool: true, targets: trigger.targets.slice() };
					} else {
						player
							.chooseTarget(
								"请选择" + get.translation(trigger.card) + "伤害-1的目标",
								function (card, player, target) {
									var trigger = _status.event.getTrigger();
									return trigger.targets.includes(target);
								},
								true
							)
							.set("animate", false)
							.set("ai", function (target) {
								var player = _status.event.player;
								return get.attitude(player, target);
							});
					}
					"step 3";
					if (result.bool) {
						var target = result.targets[0];
						//player.line(target);
						//game.log(trigger.card, "对", target, "的伤害-1");
						player.addTempSkill("olfushi_buff2");
						player.initStorage("olfushi_buff2", []);
						player.getStorage("olfushi_buff2").push([target, trigger.card]);
					}
					"step 4";
					if (!event.list.includes("伤害+1")) {
						event.finish();
					} else if (trigger.targets.length == 1) {
						event._result = { bool: true, targets: trigger.targets.slice() };
					} else {
						player
							.chooseTarget(
								"请选择" + get.translation(trigger.card) + "伤害+1的目标",
								function (card, player, target) {
									var trigger = _status.event.getTrigger();
									return trigger.targets.includes(target);
								},
								true
							)
							.set("animate", false)
							.set("ai", function (target) {
								var player = _status.event.player;
								return get.damageEffect(target, player, player);
							});
					}
					"step 5";
					if (result.bool) {
						var target = result.targets[0];
						//player.line(target);
						//game.log(trigger.card, "对", target, "的伤害+1");
						player.addTempSkill("olfushi_buff3");
						player.initStorage("olfushi_buff3", []);
						player.getStorage("olfushi_buff3").push([target, trigger.card]);
					}
				},
			},
			buff2: {
				charlotte: true,
				onremove: true,
				trigger: { source: "damageBegin2" },
				filter(event, player) {
					return event.card && player.getStorage("olfushi_buff2").some(info => info[0] == event.player && info[1] == event.card);
				},
				forced: true,
				popup: false,
				content() {
					trigger.num--;
				},
				ai: {
					effect: {
						target(card, player, target) {
							if (player.hasSkillTag("jueqing", false, target)) {
								return;
							}
							if (!card || !player.getStorage("olfushi_buff2").includes(card)) {
								return;
							}
							var num = get.tag(card, "damage");
							if (num) {
								if (num > 1) {
									return 0.5;
								}
								return 0;
							}
						},
					},
				},
			},
			buff3: {
				charlotte: true,
				onremove: true,
				trigger: { source: "damageBegin1" },
				filter(event, player) {
					return event.card && player.getStorage("olfushi_buff3").some(info => info[0] == event.player && info[1] == event.card);
				},
				forced: true,
				popup: false,
				content() {
					trigger.num++;
				},
			},
			wusheng_backup: {},
		},
	},
	oldongdao: {
		mode: ["doudizhu"],
		zhuanhuanji: true,
		mark: true,
		marktext: "☯",
		intro: {
			content(storage) {
				if (storage) {
					return "农民的回合结束时，其可以进行一个额外回合";
				}
				return "农民的回合结束时，你可以令地主进行一个额外回合";
			},
		},
		audio: 2,
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			return event.player.identity == "fan";
		},
		direct: true,
		content() {
			"step 0";
			var target = player.storage.oldongdao ? trigger.player : game.zhu;
			event.target = target;
			var target2 = player.storage.oldongdao ? trigger.player : player;
			event.target2 = target2;
			target2.chooseBool(get.prompt("oldongdao"), "令" + get.translation(target) + "进行一个额外回合").set("ai", () => {
				var event = _status.event.getParent();
				return get.attitude(event.target2, event.target) > 0;
			});
			"step 1";
			if (result.bool) {
				player.logSkill("oldongdao");
				event.target2.line(target);
				player.changeZhuanhuanji("oldongdao");
				target.insertPhase();
			}
		},
	},
};
