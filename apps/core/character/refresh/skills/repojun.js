import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const repojunSkills = {
	repojun: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		direct: true,
		filter(event, player) {
			return event.card.name == "sha" && event.target.hp > 0 && event.target.countCards("he") > 0;
		},
		preHidden: true,
		async content(event, trigger, player) {
			// step 0
			var next = player.choosePlayerCard(trigger.target, "he", [1, Math.min(trigger.target.hp, trigger.target.countCards("he"))], get.prompt("repojun", trigger.target), "allowChooseAll");
			next.set("ai", function (button) {
				if (!_status.event.goon) {
					return 0;
				}
				var val = get.value(button.link);
				if (button.link == _status.event.target.getEquip(2)) {
					return 2 * (val + 3);
				}
				return val;
			});
			next.set("goon", get.attitude(player, trigger.target) <= 0);
			next.set("forceAuto", true);
			next.setHiddenSkill(event.name);
			const result = await next.forResult();
			// step 1
			if (result.bool) {
				const target = trigger.target;
				player.logSkill("repojun", target);
				target.addSkill("repojun2");
				const next = target.addToExpansion("giveAuto", result.cards, target);
				next.gaintag.add("repojun2");
				await next;
			}
		},
		ai: {
			unequip_ai: true,
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (get.attitude(player, arg.target) > 0) {
					return false;
				}
				if (tag == "directHit_ai") {
					return arg.target.hp >= Math.max(1, arg.target.countCards("h") - 1);
				}
				if (arg && arg.name == "sha" && arg.target.getEquip(2)) {
					return true;
				}
				return false;
			},
		},
		group: "repojun3",
	},
	repojun3: {
		audio: "repojun",
		trigger: { source: "damageBegin1" },
		sourceSkill: "repojun",
		filter(event, player) {
			var target = event.player;
			return event.card && event.card.name == "sha" && player.countCards("h") >= target.countCards("h") && player.countCards("e") >= target.countCards("e");
		},
		forced: true,
		locked: false,
		logTarget: "player",
		preHidden: true,
		check(event, player) {
			return get.attitude(player, event.player) < 0;
		},
		async content(event, trigger, player) {
			trigger.num++;
		},
	},
	repojun2: {
		trigger: { global: "phaseEnd" },
		forced: true,
		popup: false,
		charlotte: true,
		sourceSkill: "repojun",
		filter(event, player) {
			return player.getExpansions("repojun2").length > 0;
		},
		async content(event, trigger, player) {
			// step 0
			const cards = player.getExpansions("repojun2");
			if (cards.length) {
				await player.gain(cards, "draw");
			}
			game.log(player, "收回了" + get.cnNumber(cards.length) + "张“破军”牌");
			// step 1
			player.removeSkill("repojun2");
		},
		intro: {
			markcount: "expansion",
			mark(dialog, storage, player) {
				var cards = player.getExpansions("repojun2");
				if (player.isUnderControl(true)) {
					dialog.addAuto(cards);
				} else {
					return "共有" + get.cnNumber(cards.length) + "张牌";
				}
			},
		},
	},
	sishu: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill))
				.set("ai", target => {
					const att = get.attitude(get.player(), target);
					if (target.countMark("sishu2") % 2 == 1) {
						return -att;
					}
					return att;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			target.addSkill("sishu_reverse");
			target.addMark("sishu_reverse", 1, false);
		},
		subSkill: {
			reverse: {
				charlotte: true,
				onremove: true,
				marktext: "思",
				intro: {
					name: "思蜀",
					content: "本局游戏内计算【乐不思蜀】的效果时反转#次",
				},
				trigger: {
					player: "judgeBefore",
				},
				filter(event, player) {
					return event.card?.name == "lebu";
				},
				firstDo: true,
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					trigger.judgeFromSishu = trigger.judge;
					trigger.judge = function (card) {
						const { player, judgeFromSishu } = this;
						let result = judgeFromSishu(card);
						if (player.countMark("sishu_reverse") % 2 == 1) {
							result *= -1;
						}
						return result;
					};
				},
			},
		},
	},
	sishu2: {
		charlotte: true,
		marktext: "思",
		intro: {
			name: "思蜀",
			content: "本局游戏内计算【乐不思蜀】的效果时反转#次",
		},
		mod: {
			judge(player, result) {
				if (_status.event.cardname == "lebu" && player.countMark("sishu2") % 2 == 1) {
					if (result.bool == false) {
						result.bool = true;
					} else {
						result.bool = false;
					}
				}
			},
		},
	},
	olruoyu: {
		skillAnimation: true,
		animationColor: "fire",
		audio: 2,
		juexingji: true,
		zhuSkill: true,
		keepSkill: true,
		derivation: ["rejijiang", "sishu"],
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		filter(event, player) {
			if (!player.hasZhuSkill("olruoyu")) {
				return false;
			}
			return player.isMinHp();
		},
		async content(event, trigger, player) {
			// step 0
			player.awakenSkill(event.name);
			await player.gainMaxHp();
			// step 1
			if (player.hp < 3) {
				await player.recover(3 - player.hp);
			}
			player.addSkills(["sishu", "rejijiang"]);
		},
	},
	olfangquan: {
		audio: 2,
		audioname2: { shen_caopi: "olfangquan_shen_caopi" },
		trigger: { player: "phaseUseBefore" },
		filter(event, player) {
			return player.countCards("h") > 0 && !player.hasSkill("olfangquan3");
		},
		direct: true,
		async content(event, trigger, player) {
			// step 0
			var fang = player.countMark("olfangquan2") == 0 && player.hp >= 2 && player.countCards("h") <= player.hp + 2;
			const result = await player
				.chooseBool(get.prompt2("olfangquan"))
				.set("ai", function () {
					if (!_status.event.fang) {
						return false;
					}
					return game.hasPlayer(function (target) {
						if (target.hasJudge("lebu") || target == player) {
							return false;
						}
						if (get.attitude(player, target) > 4) {
							return get.threaten(target) / Math.sqrt(target.hp + 1) / Math.sqrt(target.countCards("h") + 1) > 0;
						}
						return false;
					});
				})
				.set("fang", fang)
				.forResult();
			// step 1
			if (result.bool) {
				player.logSkill("olfangquan");
				trigger.cancel();
				player.addTempSkill("olfangquan2");
				player.addMark("olfangquan2", 1, false);
			}
		},
	},
	olfangquan2: {
		trigger: { player: "phaseDiscardBegin" },
		forced: true,
		popup: false,
		audio: false,
		onremove: true,
		sourceSkill: "olfangquan",
		async content(event, trigger, player) {
			// step 0
			event.count = player.countMark(event.name);
			player.removeMark(event.name, event.count, false);
			while (event.count > 0) {
				// step 1
				event.count--;
				const result = await player
					.chooseToDiscard("是否弃置一张手牌并令一名其他角色进行一个额外回合？")
					.set("logSkill", "olfangquan")
					.set("ai", card => {
						return 20 - get.value(card);
					})
					.forResult();
				// step 2
				if (result.bool) {
					const result2 = await player
						.chooseTarget(true, "请选择进行额外回合的目标角色", lib.filter.notMe)
						.set("ai", target => {
							if (target.hasJudge("lebu")) {
								return -1;
							}
							if (get.attitude(player, target) > 4) {
								return get.threaten(target) / Math.sqrt(target.hp + 1) / Math.sqrt(target.countCards("h") + 1);
							}
							return -1;
						})
						.forResult();
					// step 3
					if (result2.bool) {
						var target = result2.targets[0];
						player.line(target, "fire");
						target.markSkillCharacter("olfangquan", player, "放权", "进行一个额外回合");
						target.insertPhase();
						target.addSkill("olfangquan3");
					}
				} else {
					break;
				}
			}
		},
	},
	olfangquan3: {
		trigger: { player: ["phaseAfter", "phaseCancelled"] },
		forced: true,
		popup: false,
		audio: false,
		sourceSkill: "olfangquan",
		async content(event, trigger, player) {
			player.unmarkSkill("olfangquan");
			player.removeSkill("olfangquan3");
		},
	},
	olluanji: {
		inherit: "luanji",
		audioname2: { shen_caopi: "olluanji_shen_caopi" },
		audio: 2,
		line: false,
		group: "olluanji_remove",
		check(card) {
			return 7 - get.value(card);
		},
	},
	olluanji_remove: {
		trigger: { player: "useCard2" },
		direct: true,
		sourceSkill: "olluanji",
		filter(event, player) {
			return event.card.name == "wanjian" && event.targets.length > 0;
		},
		line: false,
		async content(event, trigger, player) {
			// step 0
			const result = await player
				.chooseTarget(get.prompt("olluanji"), "为" + get.translation(trigger.card) + "减少一个目标", function (card, player, target) {
					return _status.event.targets.includes(target);
				})
				.set("targets", trigger.targets)
				.set("ai", function (target) {
					var player = _status.event.player;
					return -get.effect(target, _status.event.getTrigger().card, player, player);
				})
				.forResult();
			// step 1
			if (result.bool) {
				player.logSkill("olluanji", result.targets);
				trigger.targets.remove(result.targets[0]);
			}
		},
	},
	olxueyi: {
		audio: 2,
		trigger: { global: "phaseBefore", player: "enterGame" },
		forced: true,
		zhuSkill: true,
		filter(event, player) {
			return (event.name != "phase" || game.phaseNumber == 0) && player.hasZhuSkill("olxueyi");
		},
		async content(event, trigger, player) {
			const num = game.countPlayer(current => current.group == "qun");
			if (num) {
				player.addMark("olxueyi", num * 2);
			}
		},
		marktext: "裔",
		intro: {
			name2: "裔",
			content: "mark",
		},
		mod: {
			maxHandcard(player, num) {
				if (player.hasZhuSkill("olxueyi")) {
					return num + player.countMark("olxueyi");
				}
			},
		},
		group: "olxueyi_draw",
		subSkill: {
			draw: {
				audio: "olxueyi",
				trigger: { player: "phaseUseBegin" },
				prompt2: "弃置一枚「裔」标记，然后摸一张牌",
				check(event, player) {
					return player.getUseValue("wanjian") > 0 || !player.needsToDiscard();
				},
				filter(event, player) {
					return player.hasZhuSkill("olxueyi") && player.hasMark("olxueyi");
				},
				async content(event, trigger, player) {
					player.removeMark("olxueyi", 1);
					await player.draw();
				},
			},
		},
	},
	olhunzi: {
		audio: 2,
		audioname: ["re_sunyi"],
		inherit: "hunzi",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.loseMaxHp();
			//player.recover();
			await player.addSkills(["reyingzi", "gzyinghun"]);
			player.addTempSkill("olhunzi_effect");
		},
		subSkill: {
			effect: {
				trigger: { player: "phaseJieshuBegin" },
				forced: true,
				popup: false,
				charlotte: true,
				async content(event, trigger, player) {
					await player.chooseDrawRecover(2, true);
				},
			},
		},
	},
	olzhiba: {
		audio: 2,
		zhuSkill: true,
		global: "olzhiba2",
	},
};
