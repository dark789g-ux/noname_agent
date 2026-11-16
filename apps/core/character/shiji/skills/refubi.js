import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "refubi" | "rezuici" | "rezuicix" | "reshengxi" | "fyjianyu" | "spwanwei" | "spyuejian">} */
export const groupSkills = {
	//始计篇·智
	refubi: {
		audio: "fubi",
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		direct: true,
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		content() {
			"step 0";
			player.chooseTarget(get.prompt2("refubi"), lib.filter.notMe).set("ai", function (target) {
				return 1 + get.attitude(_status.event.player, target);
			});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("refubi", target);
				target.addMark("refubi", 1);
			}
		},
		intro: {
			content(info, player) {
				var str = "已获得“辅弼”标记";
				if (player.storage.refubi_effect0) {
					str += "；本回合使用【杀】的次数上限+";
					str += player.storage.refubi_effect0;
				}
				if (player.storage.refubi_effect1) {
					str += "；本回合的手牌上限+";
					str += player.storage.refubi_effect1 * 3;
				}
				return str;
			},
		},
		marktext: "弼",
		group: "refubi_buff",
		subSkill: {
			buff: {
				trigger: { global: "phaseZhunbeiBegin" },
				direct: true,
				filter(event, player) {
					return event.player != player && event.player.hasMark("refubi");
				},
				content() {
					"step 0";
					var str = get.translation(trigger.player);
					player
						.chooseControl("cancel2")
						.set("choiceList", ["令" + str + "本回合使用【杀】的次数上限+1", "令" + str + "本回合的手牌上限+3"])
						.set("ai", function () {
							var player = _status.event.player,
								target = _status.event.getTrigger().player;
							if (get.attitude(player, target) <= 0) {
								return "cancel2";
							}
							if (
								!target.hasJudge("lebu") &&
								target.countCards("h", function (card) {
									return get.name(card, target) == "sha" && target.hasValueTarget(card);
								}) > target.getCardUsable("sha")
							) {
								return 0;
							}
							return 1;
						});
					"step 1";
					if (result.control != "cancel2") {
						var target = trigger.player;
						player.logSkill("refubi", target);
						var str = "refubi_effect" + result.index;
						target.addTempSkill(str);
						target.addMark(str, 1, false);
						game.log(target, ["本回合使用【杀】的次数上限+1", "本回合的手牌上限+3"][result.index]);
					}
				},
			},
			effect0: {
				onremove: true,
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("refubi_effect0");
						}
					},
				},
			},
			effect1: {
				onremove: true,
				mod: {
					maxHandcard(player, num) {
						return num + 3 * player.countMark("refubi_effect1");
					},
				},
			},
		},
	},
	rezuici: {
		audio: "zuici",
		enable: "chooseToUse",
		filter(event, player) {
			if (event.type == "phase" || (event.type == "dying" && player == event.dying)) {
				return player.isDamaged() && player.countCards("e") > 0;
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("###罪辞###选择废除一个有牌的装备栏，然后回复2点体力，并可移动“辅弼”标记。");
			},
			chooseControl(event, player) {
				var list = [];
				for (var i = 1; i < 6; i++) {
					if (player.getEquips(i).length > 0) {
						list.push("equip" + i);
					}
				}
				list.push("cancel2");
				return list;
			},
			check(event, player) {
				if (player.hp > 1 && player.getDamagedHp() < 2) {
					return "cancel2";
				}
				var cards = player.getCards("e").sort(function (a, b) {
					return get.value(a) - get.value(b);
				});
				var sub = get.subtype(cards[0], false);
				if (player.hp < 1) {
					return sub;
				}
				var val = get.value(cards[0]);
				if (val < 0) {
					return sub;
				}
				return val < 4 ? sub : "cancel2";
			},
			backup(result) {
				var next = get.copy(lib.skill.rezuicix);
				next.position = result.control;
				return next;
			},
		},
		ai: {
			order: 2.7,
			result: {
				player: 1,
			},
			save: true,
			skillTagFilter(player, tag, arg) {
				return player == arg;
			},
		},
	},
	rezuicix: {
		audio: "zuici",
		sourceSkill: "rezuici",
		content() {
			"step 0";
			player.disableEquip(lib.skill.rezuici_backup.position);
			player.recover(2);
			"step 1";
			var b1 = false,
				b2 = false;
			for (var i of game.players) {
				if (i.hasMark("refubi")) {
					b1 = true;
				} else if (i != player) {
					b2 = true;
				}
				if (b1 && b2) {
					break;
				}
			}
			if (b1 && b2) {
				player
					.chooseTarget("是否转移“辅弼”标记？", function (card, player, target) {
						return target != player && !target.hasMark("refubi");
					})
					.set("ai", function (target) {
						var player = _status.event.player;
						var att = get.attitude(player, target);
						return Math.min(att, att - _status.event.preatt);
					})
					.set(
						"preatt",
						get.attitude(
							player,
							game.findPlayer(function (current) {
								return current.hasMark("refubi");
							})
						)
					);
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				var target = result.targets[0];
				player.line(target, "group");
				game.countPlayer(function (current) {
					var num = current.countMark("refubi");
					if (num) {
						current.removeMark("refubi", 1, false);
					}
				});
				target.addMark("refubi", 1);
			}
		},
		ai: {
			result: {
				player: 1,
			},
		},
	},
	reshengxi: {
		audio: "shengxi",
		audioname: ["feiyi"],
		trigger: { player: "phaseJieshuBegin" },
		frequent: true,
		preHidden: true,
		filter(event, player) {
			return !player.getHistory("sourceDamage").length;
		},
		content() {
			player.draw(2);
		},
	},
	fyjianyu: {
		initSkill(skill) {
			if (!lib.skill[skill]) {
				lib.skill[skill] = {
					marktext: "喻",
					intro: {
						markcount: () => 1,
						content: "指定另一名有“喻”的角色为目标时，其摸一张牌",
					},
				};
				lib.translate[skill] = "谏喻";
				lib.translate[skill + "_bg"] = "喻";
			}
		},
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return (
				game.countPlayer(function (current) {
					return !current.hasMark("fyjianyu_" + player.playerid);
				}) > 1
			);
		},
		round: 1,
		filterTarget(card, player, target) {
			return !target.hasMark("fyjianyu_" + player.playerid);
		},
		selectTarget: 2,
		content() {
			var skill = "fyjianyu_" + player.playerid;
			game.broadcastAll(lib.skill.fyjianyu.initSkill, skill);
			player.addTempSkill("fyjianyu_draw", { player: "phaseBegin" });
			target.addMark(skill, 1);
		},
		ai: {
			order: 0.1,
			result: {
				target(player, target) {
					if (!ui.selected.targets.length) {
						return target == player ? 1 : 0;
					}
					if (get.attitude(player, target) < 0) {
						return (
							-1.6 *
							(1 +
								target.countCards("h", function (card) {
									return target.hasValueTarget(card) && get.effect(player, card, target, target) > 0;
								}) *
									Math.sqrt(target.countCards("h")))
						);
					}
					return (
						0.3 *
						(1 +
							target.countCards("h", function (card) {
								return target.hasValueTarget(card) && get.effect(player, card, target, target) > 0;
							}) *
								Math.sqrt(target.countCards("h")))
					);
				},
			},
		},
		subSkill: {
			draw: {
				audio: "fyjianyu",
				charlotte: true,
				trigger: { global: "useCardToPlayer" },
				filter(event, player) {
					if (!event.player.isPhaseUsing()) {
						return false;
					}
					return event.player != event.target && event.player.hasMark("fyjianyu_" + player.playerid) && event.target.hasMark("fyjianyu_" + player.playerid) && event.target.isIn();
				},
				forced: true,
				logTarget: "target",
				content() {
					trigger.target.draw();
				},
				onremove(player) {
					game.countPlayer(function (current) {
						var num = current.countMark("fyjianyu_" + player.playerid);
						if (num) {
							current.removeMark("fyjianyu_" + player.playerid);
						}
					});
				},
			},
		},
	},
	spwanwei: {
		audio: 2,
		enable: "chooseToUse",
		round: 1,
		filter(event, player) {
			if (player.hp < 1) {
				return false;
			}
			if (event.type == "dying") {
				return event.dying != player;
			}
			if (event.type != "phase") {
				return false;
			}
			return game.hasPlayer(current => {
				return current != player && current.isDamaged();
			});
		},
		filterTarget(card, player, target) {
			if (_status.event.type == "dying") {
				return target == _status.event.dying;
			}
			return player != target && target.isDamaged();
		},
		selectTarget() {
			if (_status.event.type == "dying") {
				return -1;
			}
			return 1;
		},
		prompt(event, player) {
			const num = player.getHp();
			if (event.type == "dying") {
				const target = event.dying;
				return `令${get.translation(target)}回复${Math.max(num + 1, 1 - target.hp)}点体力，然后你失去${num}点体力`;
			} else {
				return `令一名其他角色回复${num + 1}点体力（至少回复至1），然后你失去${num}点体力`;
			}
		},
		manualConfirm: true,
		async content(event, trigger, player) {
			const target = event.targets[0];
			const num = player.getHp();
			await target.recover(Math.max(num + 1, 1 - target.hp));
			await player.loseHp(num);
		},
		ai: {
			save: true,
			skillTagFilter(player, tag, target) {
				return player != target;
			},
			expose: 0.5,
			order: 6,
			result: {
				target(player, target) {
					if (get.attitude(player, target) < 4) {
						return 0;
					}
					if ((!player.hasSkill("spyuejian") || player.countCards("he") < 2) && !player.hasCards("hs", card => player.canSaveCard(card, player))) {
						return 0;
					}
					if (_status.event.type != "dying") {
						const num = player.getHp();
						if (target.getDamagedHp() < 2) {
							return 0;
						}
						return Math.max(num + 1, 1 - target.hp);
					} else {
						return 1;
					}
				},
			},
		},
	},
	spyuejian: {
		mod: {
			maxHandcardBase(player) {
				return player.maxHp;
			},
		},
		locked: false,
		audio: 2,
		trigger: { player: "dying" },
		filter(event, player) {
			return player.countCards("he") > 1;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard("he", 2, get.prompt(event.skill), "弃置两张牌，然后回复1点体力", "chooseonly")
				.set("ai", card => {
					return 1 / Math.max(0.1, get.value(card));
				})
				.forResult();
		},
		async content(event, trigger, player) {
			await player.discard(event.cards);
			await player.recover();
		},
	},
};
