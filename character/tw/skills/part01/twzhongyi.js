import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twzhongyi" | "twchue" | "twdanlie" | "twhuzhong" | "twfenwang">} */
export const groupSkills = {
	//侠关羽
	twzhongyi: {
		mod: {
			targetInRange(card) {
				if (card.name == "sha") {
					return true;
				}
			},
		},
		audio: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			return player.getHistory("sourceDamage", evt => evt.card && evt.card == event.card).length;
		},
		forced: true,
		async content(event, trigger, player) {
			//const num=player.getHistory('sourceDamage',evt=>evt.card&&evt.card==trigger.card).reduce((sum,evt)=>sum+evt.num,0);
			const num = game.countPlayer2(target => {
				return target.hasHistory("damage", evt => {
					return evt.card && evt.card == trigger.card;
				});
			});
			const num2 = 1 + player.getAllHistory("custom", evt => evt.twzhongyi).length;
			let choice = ["摸牌"],
				choiceList = ["摸" + get.cnNumber(num) + "张牌"];
			if (player.isDamaged()) {
				choice.addArray(["回血", "背水！"]);
				choiceList.addArray(["回复" + num + "点体力", "失去" + num2 + "点体力，依次执行以上所有项"]);
			}
			const { control } = await player
				.chooseControl(choice)
				.set("prompt", "忠义：请选择一项")
				.set("choiceList", choiceList)
				.set("ai", () => {
					const player = get.event().player;
					const num = get.event().num,
						num2 = get.event().num2;
					if (player.isHealthy()) {
						return "摸牌";
					}
					return player.hp + player.countCards("hs", card => player.canSaveCard(card, player)) - num2 > 0 && num > num2 ? "背水！" : "回血";
				})
				.set("num", num)
				.set("num2", num2)
				.forResult();
			if (control != "cancel2") {
				if (control != "回血") {
					await player.draw(num);
				}
				if (control != "摸牌") {
					await player.recover(num);
				}
				if (control == "背水！") {
					await player.loseHp(num2);
					player.getHistory("custom").push({ twzhongyi: true });
				}
			}
		},
	},
	twchue: {
		audio: 2,
		trigger: { player: "useCardToPlayer" },
		filter(event, player) {
			return (
				event.card.name == "sha" &&
				event.isFirstTarget &&
				event.targets.length == 1 &&
				game.hasPlayer(target => !event.targets.includes(target) && player.canUse(event.card, target))
			);
		},
		prompt2: "失去1点体力，额外指定至多等同于你体力值的目标",
		check(event, player) {
			return player.hp + player.countCards("hs", card => player.canSaveCard(card, player)) - 1 > 0;
		},
		async content(event, trigger, player) {
			await player.loseHp();
			const targetx = trigger.targets.slice(),
				num = player.getHp();
			if (!num) {
				return;
			}
			const { bool, targets } = await player
				.chooseTarget("额外指定至多" + get.cnNumber(num) + "名目标", [1, num], (card, player, target) => {
					const trigger = _status.event.getTrigger();
					return !trigger.targets.includes(target) && player.canUse(trigger.card, target);
				})
				.set("ai", target => {
					const player = get.event().player,
						trigger = _status.event.getTrigger();
					return get.effect(target, trigger.card, player, player);
				})
				.forResult();
			if (!bool) {
				return;
			}
			player.line(targets);
			trigger.targets.addArray(targets);
		},
		group: ["twchue_gain", "twchue_effect"],
		marktext: "勇",
		intro: {
			name: "勇",
			content: "mark",
		},
		subSkill: {
			gain: {
				audio: "twchue",
				trigger: { player: ["damageEnd", "loseHpEnd"] },
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					await player.draw();
					player.addMark("twchue", 1);
				},
			},
			effect: {
				audio: "twchue",
				trigger: { global: "phaseEnd" },
				filter(event, player) {
					const card = new lib.element.VCard({ name: "sha", isCard: true });
					return (
						player.hasUseTarget(card) &&
						/*player.getHistory('useSkill',evt=>{
						return evt.skill=='twchue_gain';
					}).length&&player.getHp()&&*/ player.countMark("twchue") >= player.getHp()
					);
				},
				check(event, player) {
					return player.hasValueTarget(new lib.element.VCard({ name: "sha", isCard: true }));
				},
				prompt2(event, player) {
					const num = player.getHp();
					return "失去" + num + "个“勇”标记，视为使用一张造成的伤害+1且可以额外指定" + num + "个目标的【杀】";
				},
				async content(event, trigger, player) {
					const num = player.getHp();
					player.removeMark("twchue", num);
					const card = new lib.element.VCard({ name: "sha", isCard: true });
					player
						.when("useCard2", false)
						.filter(evt => evt.getParent(2) == event)
						.assign({
							firstDo: true,
						})
						.step(async (event, trigger, player) => {
							trigger.baseDamage++;
							if (
								!game.hasPlayer(target => {
									return !trigger.targets.includes(target) && player.canUse(trigger.card, target);
								})
							) {
								return;
							}
							const result = await player
								.chooseTarget("额外指定至多" + get.cnNumber(num) + "名目标", [1, num], (card, player, target) => {
									const trigger = _status.event.getTrigger();
									return !trigger.targets.includes(target) && player.canUse(trigger.card, target);
								})
								.set("ai", target => {
									const player = get.event().player,
										trigger = _status.event.getTrigger();
									return get.effect(target, trigger.card, player, player);
								})
								.forResult();
							if (result.bool) {
								const targets = result.targets;
								player.line(targets);
								trigger.targets.addArray(targets);
							}
						})
						.finish();
					player.chooseUseTarget("视为使用造成的伤害+1且可以额外指定" + num + "个目标的【杀】", card, false, true);
				},
			},
		},
	},
	//夏侯惇
	twdanlie: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(target => player.canCompare(target));
		},
		filterTarget(card, player, target) {
			return player.canCompare(target);
		},
		usable: 1,
		selectTarget: [1, 3],
		multitarget: true,
		multiline: true,
		group: "twdanlie_add",
		content() {
			"step 0";
			player.chooseToCompare(targets).setContent("chooseToCompareMeanwhile");
			"step 1";
			if (result.winner && result.winner == player) {
				player.line(targets);
				targets.forEach(target => target.damage());
			} else {
				player.loseHp();
			}
		},
		ai: {
			order: 10,
			result: {
				target(player, target) {
					var att = get.attitude(player, target);
					if (att >= 0) {
						return 0;
					}
					if (player.getHp() > 2) {
						return -get.damageEffect(target, player, player) - 10 / target.countCards("h");
					}
					var hs = player.getCards("h").sort((a, b) => b.number - a.number);
					var ts = target.getCards("h").sort((a, b) => b.number - a.number);
					if (!hs.length || !ts.length) {
						return 0;
					}
					if (Math.min(13, hs[0].number + player.getDamagedHp()) > ts[0].number) {
						return -get.damageEffect(target, player, player);
					}
					return 0;
				},
			},
		},
		subSkill: {
			add: {
				audio: "twdanlie",
				trigger: { player: "compare", target: "compare" },
				filter(event, player) {
					if (!player.isDamaged()) {
						return false;
					}
					if (player != event.target && event.iwhile) {
						return false;
					}
					return true;
				},
				forced: true,
				locked: false,
				content() {
					var num = player.getDamagedHp();
					if (player == trigger.player) {
						trigger.num1 += num;
						if (trigger.num1 > 13) {
							trigger.num1 = 13;
						}
					} else {
						trigger.num2 += num;
						if (trigger.num2 > 13) {
							trigger.num2 = 13;
						}
					}
					game.log(player, "的拼点牌点数+", num);
				},
			},
		},
	},
	//张葳
	twhuzhong: {
		audio: 2,
		trigger: { player: "useCardToPlayer" },
		filter(event, player) {
			return (
				event.card.name == "sha" &&
				!game.hasNature(event.card, "linked") &&
				event.targets.length == 1 &&
				player.isPhaseUsing() &&
				(game.hasPlayer(target => !event.targets.includes(target) && player.canUse(event.card, target)) || event.target.countCards("h") > 0)
			);
		},
		direct: true,
		content() {
			"step 0";
			var target = trigger.target;
			event.target = target;
			var list = ["cancel2"];
			var choiceList = [
				"令此【杀】可以额外指定一个目标",
				"弃置" + get.translation(target) + "一张手牌，若此【杀】造成伤害，则你本阶段可以额外使用一张【杀】",
			];
			if (target.countCards("h")) {
				list.unshift("其弃置");
			} else {
				choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
			}
			if (game.hasPlayer(targetx => !trigger.targets.includes(targetx) && player.canUse(trigger.card, targetx))) {
				list.unshift("多指");
			} else {
				choiceList[0] = '<span style="opacity:0.5">' + choiceList[0] + "</span>";
			}
			player
				.chooseControl(list)
				.set("choiceList", choiceList)
				.set("ai", () => {
					var controls = _status.event.controls;
					var trigger = _status.event.getTrigger();
					var player = trigger.player;
					var target = trigger.target;
					if (controls.includes("其弃置") && _status.event.goon) {
						return "其弃置";
					}
					if (controls.includes("多指")) {
						if (
							game.hasPlayer(
								targetx =>
									!trigger.targets.includes(targetx) &&
									player.canUse(trigger.card, targetx) &&
									get.effect(targetx, trigger.card, player, player) > 0
							)
						) {
							return "你弃置";
						}
					}
					return "cancel2";
				})
				.set(
					"goon",
					(function () {
						var d1 = false;
						if (
							!target.mayHaveShan(player, "use") ||
							player.hasSkillTag(
								"directHit_ai",
								true,
								{
									target: target,
									card: trigger.card,
								},
								true
							)
						) {
							if (get.attitude(player, target) < 0 && !player.hasSkillTag("jueqing", false, target)) {
								return true;
							}
						}
						if (d1) {
							return get.damageEffect(player, player, player) > 0;
						}
						return false;
					})()
				)
				.set("prompt", "护众：是否摸一张牌并执行其中一项？");
			"step 1";
			if (result.control != "cancel2") {
				player.logSkill("twhuzhong", target);
				player.draw();
				if (result.control == "其弃置") {
					player.discardPlayerCard(target, "h", true);
					player
						.when("useCardAfter")
						.filter(evt => evt == trigger.getParent())
						.step(async (event, trigger, player) => {
							if (player.getHistory("sourceDamage", evt => evt.card == trigger.card).length) {
								player.addTempSkill("twhuzhong_sha", "phaseUseAfter");
								player.addMark("twhuzhong_sha", 1, false);
							}
						});
					event.finish();
				}
			} else {
				event.finish();
			}
			"step 2";
			player
				.chooseTarget("请选择" + get.translation(trigger.card) + "的额外目标", function (card, player, target) {
					var trigger = _status.event.getTrigger();
					return !trigger.targets.includes(target) && player.canUse(trigger.card, target);
				})
				.set("ai", function (target) {
					var player = _status.event.player;
					var trigger = _status.event.getTrigger();
					return get.effect(target, trigger.card, player, player);
				});
			"step 3";
			if (result.bool) {
				player.line(result.targets);
				trigger.getParent().targets.addArray(result.targets);
				game.log(result.targets, "成为了", trigger.card, "的额外目标");
			}
		},
		subSkill: {
			sha: {
				charlotte: true,
				onremove: true,
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("twhuzhong_sha");
						}
					},
				},
			},
		},
	},
	twfenwang: {
		audio: 2,
		trigger: { source: "damageBegin2", player: "damageBegin4" },
		filter(event, player, name) {
			if (name == "damageBegin2") {
				if (event.hasNature() || event.player == player) {
					return false;
				}
				return player.countCards("h") >= event.player.countCards("h");
			}
			return event.hasNature();
		},
		forced: true,
		logAudio(event, player, name) {
			return name == "damageBegin2" ? "twfenwang2.mp3" : "twfenwang1.mp3";
		},
		content() {
			"step 0";
			if (event.triggername == "damageBegin2") {
				player.line(trigger.player);
				trigger.num++;
				event.finish();
			} else {
				player.chooseToDiscard("h", "弃置一张手牌，或令此伤害+1").set("ai", function (card) {
					return 8 - get.value(card);
				});
			}
			"step 1";
			if (!result.bool) {
				trigger.num++;
			}
		},
	},
};
