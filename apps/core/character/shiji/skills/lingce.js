import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "lingce" | "dinghan" | "dulie" | "tspowei" | "shenzhu">} */
export const groupSkills = {
	lingce: {
		audio: 2,
		init: player => {
			game.addGlobalSkill("lingce_global");
		},
		trigger: { global: "useCard" },
		forced: true,
		filter(event, player) {
			if (!event.card.isCard || !event.cards || event.cards.length !== 1) {
				return false;
			}
			return event.card.name == "qizhengxiangsheng" || get.zhinangs().includes(event.card.name) || player.getStorage("dinghan").includes(event.card.name);
		},
		async content(event, trigger, player) {
			await player.draw();
		},
		subSkill: {
			global: {
				ai: {
					effect: {
						player_use(card, player, target) {
							if (typeof card !== "object") {
								return;
							}
							let num = 0,
								nohave = true;
							game.countPlayer(i => {
								if (i.hasSkill("lingce", null, null, false)) {
									nohave = false;
									if (
										i.isIn() &&
										lib.skill.lingce.filter(
											{
												card: card,
												cards: card.cards ? card.cards : [card],
											},
											i
										)
									) {
										num += get.sgnAttitude(player, i);
									}
								}
							}, true);
							if (nohave) {
								game.removeGlobalSkill("lingce_global");
							} else {
								return [1, 0.8 * num];
							}
						},
					},
				},
			},
		},
	},
	dinghan: {
		audio: 2,
		trigger: {
			target: "useCardToTarget",
			player: "addJudgeBefore",
		},
		forced: true,
		locked: false,
		filter(event, player) {
			if (event.name == "useCardToTarget" && get.type(event.card, null, false) != "trick") {
				return false;
			}
			return !player.getStorage("dinghan").includes(event.card.name);
		},
		async content(event, trigger, player) {
			player.markAuto("dinghan", [trigger.card.name]);
			if (trigger.name == "addJudge") {
				trigger.cancel();
				if (trigger.card?.cards?.length) {
					const map = new Map(),
						targets = [];
					for (const card of trigger.card.cards) {
						const owner = get.owner(card);
						if (owner) {
							targets.add(owner);
							map.set(owner, (map.get(owner) ?? []).concat([card]));
						}
					}
					if (targets.length) {
						await game
							.loseAsync({
								map: map,
								targets: targets,
								cards: trigger.card.cards,
							})
							.setContent(async (event, trigger, player) => {
								const { map, targets, cards } = event;
								for (const target of targets) {
									const lose = map.get(target);
									const next = target.lose(lose, ui.discardPile);
									next.getlx = false;
									await next;
								}
								game.log(cards, "进入了弃牌堆");
							});
					}
				}
			} else {
				trigger.targets.remove(player);
				trigger.getParent().triggeredTargets2.remove(player);
				trigger.untrigger();
			}
		},
		onremove: true,
		intro: { content: "已记录牌名：$" },
		group: "dinghan_add",
		subSkill: {
			add: {
				trigger: { player: "phaseBegin" },
				direct: true,
				async content(event, trigger, player) {
					let dialog = [get.prompt("dinghan")];
					let list1 = player.getStorage("dinghan");
					let list2 = lib.inpile.filter(function (i) {
						return get.type2(i, false) == "trick" && !list1.includes(i);
					});
					if (list1.length) {
						dialog.push('<div class="text center">已记录</div>');
						dialog.push([list1, "vcard"]);
					}
					if (list2.length) {
						dialog.push('<div class="text center">未记录</div>');
						dialog.push([list2, "vcard"]);
					}
					let result = await player
						.chooseButton(dialog)
						.set("ai", function (button) {
							var player = _status.event.player,
								name = button.link[2];
							if (player.getStorage("dinghan").includes(name)) {
								return -get.effect(player, { name: name }, player, player);
							} else {
								return get.effect(player, { name: name }, player, player) * (1 + player.countCards("hs", name));
							}
						})
						.forResult();
					if (result.bool) {
						player.logSkill("dinghan");
						let name = result.links[0][2];
						if (player.getStorage("dinghan").includes(name)) {
							player.unmarkAuto("dinghan", [name]);
							game.log(player, "从定汉记录中移除了", "#y" + get.translation(name));
						} else {
							player.markAuto("dinghan", [name]);
							game.log(player, "向定汉记录中添加了", "#y" + get.translation(name));
						}
						await game.delayx();
					}
				},
			},
		},
	},
	dulie: {
		audio: 2,
		trigger: { target: "useCardToTarget" },
		forced: true,
		logTarget: "player",
		filter(event, player) {
			return event.card.name == "sha" && event.player.hp > player.hp;
		},
		async content(event, trigger, player) {
			const next = player.judge(result => (get.suit(result) === "heart" ? 2 : -1));
			next.set("judge2", result => result.bool);

			const result = await next.forResult();
			if (result.bool) {
				trigger.targets.remove(player);
				trigger.getParent().triggeredTargets2.remove(player);
				trigger.untrigger();
			}
		},
		ai: {
			effect: {
				target_use(card, player, target, current, isLink) {
					if (card.name == "sha" && !isLink && player.hp > target.hp) {
						return 0.5;
					}
				},
			},
		},
		marktext: "围",
		intro: {
			name: "破围(围)",
			name2: "围",
			content: "mark",
		},
	},
	tspowei: {
		audio: 3,
		dutySkill: true,
		derivation: "shenzhu",
		group: ["tspowei_init", "tspowei_move", "tspowei_achieve", "tspowei_fail", "tspowei_use", "tspowei_remove"],
		subSkill: {
			remove: {
				audio: "tspowei3.mp3",
				trigger: { global: "damageEnd" },
				filter(event, player) {
					return event.player && event.player.isIn() && event.player.hasMark("dulie");
				},
				forced: true,
				logTarget: "player",
				async content(event, trigger, player) {
					trigger.player.removeMark("dulie", trigger.player.countMark("dulie"));
				},
			},
			use: {
				audio: "tspowei3.mp3",
				trigger: { global: "phaseBegin" },
				direct: true,
				filter(event, player) {
					return event.player != player && event.player.hasMark("dulie") && (player.countCards("h") > 0 || (player.hp >= event.player.hp && event.player.countCards("h") > 0));
				},
				async content(event, trigger, player) {
					let list = [],
						target = trigger.player,
						choiceList = ["弃置一张牌并对其造成1点伤害", "获得其一张手牌"];
					event.target = target;
					if (
						player.hasCard(function (card) {
							return lib.filter.cardDiscardable(card, player, "tspowei_use");
						}, "h")
					) {
						list.push("选项一");
					} else {
						choiceList[0] = '<span style="opacity:0.5">' + choiceList[0] + "</span>";
					}
					if (player.hp >= target.hp && target.countCards("h") > 0) {
						list.push("选项二");
					} else {
						choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
					}
					let result = await player
						.chooseControl(list, "cancel2")
						.set("prompt", get.prompt("tspowei", target))
						.set("choiceList", choiceList)
						.set("ai", function () {
							var evt = _status.event.getParent();
							if (
								evt.player.hasCard(function (card) {
									return lib.filter.cardDiscardable(card, evt.player, "tspowei_use") && get.value(card, evt.player) < 7;
								}, "h") &&
								get.damageEffect(evt.target, evt.player, evt.player) > 0
							) {
								return "选项一";
							}
							if (evt.player.hp >= evt.target.hp && evt.target.countCards("h") > 0 && get.attitude(evt.player, evt.target) <= 0 && !evt.target.hasSkillTag("noh")) {
								return "选项二";
							}
							return "cancel2";
						})
						.forResult();
					if (result.control != "cancel2") {
						if (result.control == "选项二") {
							player.logSkill("tspowei_use", target);
							await player.gainPlayerCard(target, "h", true);
						} else if (result.control == "选项一") {
							await player.chooseToDiscard("h", true).set("logSkill", ["tspowei_use", target]);
							if (get.mode() != "identity" || player.identity != "nei") {
								player.addExpose(0.2);
							}
							await target.damage();
						}
						player.addTempSkill("tspowei_inRange");
					} else {
						return;
					}
				},
				ai: { expose: 0.2 },
			},
			inRange: {
				charlotte: true,
				mod: {
					inRangeOf(from, to) {
						if (from == _status.currentPhase) {
							return true;
						}
					},
				},
			},
			init: {
				audio: "tspowei3.mp3",
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				forced: true,
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				logTarget(event, player) {
					return game.filterPlayer(current => current != player && !current.hasMark("dulie"));
				},
				async content(event, trigger, player) {
					const list = game.filterPlayer(current => current != player && !current.hasMark("dulie")).sortBySeat();
					for (const current of list) {
						current.addMark("dulie", 1, false);
					}
				},
			},
			move: {
				audio: "tspowei3.mp3",
				trigger: { player: "phaseBegin" },
				forced: true,
				filter(event, player) {
					return game.hasPlayer(current => current != player && current.hasMark("dulie"));
				},
				async content(event, trigger, player) {
					const list = game.filterPlayer(current => current != player && current.hasMark("dulie")).sortBySeat();
					const map = {};
					for (const current of list) {
						const num = current.countMark("dulie");
						current.removeMark("dulie", num);
						map[current.playerid] = num;
					}
					for (const current of list) {
						let next = current.next;
						if (next == player) {
							next = next.next;
						}
						next.addMark("dulie", map[current.playerid]);
					}
				},
			},
			achieve: {
				audio: "tspowei1.mp3",
				trigger: { player: "phaseBegin" },
				forced: true,
				skillAnimation: true,
				animationColor: "metal",
				filter(event, player) {
					return !game.hasPlayer(function (current) {
						return current.hasMark("dulie");
					});
				},
				async content(event, trigger, player) {
					game.log(player, "成功完成使命");
					player.awakenSkill("tspowei");
					player.addSkills("shenzhu");
				},
			},
			fail: {
				audio: "tspowei2.mp3",
				trigger: { player: "dying" },
				forced: true,
				async content(event, trigger, player) {
					game.log(player, "使命失败");
					player.awakenSkill("tspowei");
					if (player.hp < 1) {
						await player.recover(1 - player.hp);
					}
					const num = player.countCards("e");
					if (num > 0) {
						await player.chooseToDiscard("e", true, num);
					}
				},
			},
		},
	},
	shenzhu: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		forced: true,
		filter(event, player) {
			return event.card.name == "sha" && event.card.isCard && event.cards.length == 1;
		},
		async content(event, trigger, player) {
			const result = await player
				.chooseControl()
				.set("choiceList", ["摸一张牌，且本回合使用【杀】的次数上限+1", "摸三张牌，且本回合不能再使用【杀】"])
				.set("ai", () => (_status.event.player.hasSha() ? 0 : 1))
				.forResult();
			if (result.index == 0) {
				await player.draw();
				player.addTempSkill("shenzhu_more");
				player.addMark("shenzhu_more", 1, false);
			} else {
				await player.draw(3);
				player.addTempSkill("shenzhu_less");
			}
		},
		subSkill: {
			more: {
				charlotte: true,
				onremove: true,
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("shenzhu_more");
						}
					},
				},
			},
			less: {
				charlotte: true,
				mod: {
					cardEnabled(card) {
						if (card.name == "sha") {
							return false;
						}
					},
				},
			},
		},
	},
};
