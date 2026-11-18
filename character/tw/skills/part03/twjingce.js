import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twjingce" | "yuzhang" | "twlihuo" | "twlihuo2" | "twlihuo3" | "twchunlao">} */
export const groupSkills = {
	//Powered by @污言噫对
	twjingce: {
		marktext: "策",
		intro: {
			name: "策",
			content: "mark",
		},
		audio: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			var evt = event.getParent("phaseUse");
			if (!evt || evt.player != player) {
				return false;
			}
			var history = player.getHistory("useCard", function (evtx) {
				return evtx.getParent("phaseUse") == evt;
			});
			return history && history.indexOf(event) == player.hp - 1;
		},
		frequent: true,
		content() {
			"step 0";
			player.draw(2);
			"step 1";
			if (
				player.getHistory("sourceDamage").length ||
				player.getHistory("gain", function (evt) {
					return evt.getParent("phaseUse") == trigger.getParent("phaseUse") && evt.getParent().name == "draw";
				}).length > 1
			) {
				player.addMark("twjingce", 1);
			}
		},
	},
	yuzhang: {
		audio: 2,
		trigger: {
			player: "damageEnd",
		},
		filter(event, player) {
			return event.source && player.hasMark("twjingce");
		},
		direct: true,
		content() {
			"step 0";
			var choiceList = ["令" + get.translation(trigger.source) + "本回合不能再使用或打出牌"];
			if (trigger.source.countCards("he")) {
				choiceList.push("令" + get.translation(trigger.source) + "弃置两张牌");
			}
			player
				.chooseControl("cancel2")
				.set("prompt2", get.prompt2("yuzhang"))
				.set("choiceList", choiceList)
				.set("ai", function () {
					var player = _status.event.player,
						source = _status.event.source;
					if (get.attitude(player, source) >= 0) {
						return "cancel2";
					}
					if (source.hasSkillTag("noh") || source.hasSkillTag("noe") || source.countCards("h") >= 4) {
						return 0;
					}
					if (source.hp > 1 && source.countCards("he") > 1) {
						return 1;
					}
					return [0, 1].randomGet();
				})
				.set("source", trigger.source);
			"step 1";
			if (result.control != "cancel2") {
				player.logSkill("yuzhang", trigger.source);
				player.removeMark("twjingce", 1);
				if (result.index == 0) {
					trigger.source.addTempSkill("yuzhang_dontuse");
				} else {
					trigger.source.chooseToDiscard("he", 2, true);
				}
			}
		},
		group: "yuzhang_skip",
		subSkill: {
			skip: {
				audio: "yuzhang",
				trigger: {
					player: [
						"phaseZhunbeiBefore",
						"phaseJudgeBefore",
						"phaseDrawBefore",
						"phaseUseBefore",
						"phaseDiscardBefore",
						"phaseJieshuBefore",
					],
				},
				filter(event, player) {
					return player.hasMark("twjingce");
				},
				prompt2(event, player) {
					var str = "弃置一枚“策”并跳过";
					var list = lib.skill.yuzhang.subSkill.skip.trigger.player.slice();
					list = list.map(i => i.slice(0, -6));
					str += ["准备", "判定", "摸牌", "出牌", "弃牌", "结束"][list.indexOf(event.name)];
					str += "阶段";
					return str;
				},
				check(event, player) {
					if (event.name == "phaseDiscard") {
						return player.needsToDiscard();
					}
					if (event.name == "phaseJudge") {
						return player.countCards("j");
					}
					return false;
				},
				content() {
					player.removeMark("twjingce", 1);
					trigger.cancel();
				},
			},
			dontuse: {
				charlotte: true,
				mark: true,
				mod: {
					cardEnabled(card) {
						return false;
					},
					cardRespondable(card) {
						return false;
					},
					cardSavable(card) {
						return false;
					},
				},
				intro: {
					content: "不能使用或打出牌",
				},
			},
		},
		ai: {
			combo: "twjingce",
		},
	},
	twlihuo: {
		trigger: { player: "useCard1" },
		filter(event, player) {
			if (event.card.name == "sha" && !game.hasNature(event.card)) {
				return true;
			}
			return false;
		},
		audio: "lihuo",
		prompt2(event) {
			return "将" + get.translation(event.card) + "改为火属性";
		},
		audioname: ["re_chengpu"],
		check(event, player) {
			return game.hasPlayer(function (current) {
				return (
					!event.targets.includes(current) &&
					player.canUse(event.card, current) &&
					get.effect(current, { name: "sha", nature: "fire", cards: event.cards.slice(0) }, player, player) > 0
				);
			});
		},
		content() {
			game.setNature(trigger.card, "fire");
			trigger.card.twlihuo_buffed = true;
		},
		group: ["twlihuo2", "twlihuo3"],
		ai: {
			fireAttack: true,
		},
	},
	twlihuo2: {
		trigger: { player: "useCard2" },
		sourceSkill: "twlihuo",
		filter(event, player) {
			if (event.card.name != "sha" || !game.hasNature(event.card, "fire")) {
				return false;
			}
			return game.hasPlayer(function (current) {
				return !event.targets.includes(current) && player.canUse(event.card, current);
			});
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt("twlihuo"), "为" + get.translation(trigger.card) + "增加一个目标", function (card, player, target) {
					return !_status.event.sourcex.includes(target) && player.canUse(_status.event.card, target);
				})
				.set("sourcex", trigger.targets)
				.set("card", trigger.card)
				.set("ai", function (target) {
					var player = _status.event.player;
					return get.effect(target, _status.event.card, player, player);
				});
			"step 1";
			if (result.bool) {
				if (!event.isMine() && !_status.connectMode) {
					game.delayx();
				}
				event.target = result.targets[0];
			} else {
				event.finish();
			}
			"step 2";
			player.logSkill("twlihuo", event.target);
			trigger.targets.push(event.target);
		},
	},
	twlihuo3: {
		trigger: { player: "useCardAfter" },
		sourceSkill: "twlihuo",
		filter(event, player) {
			return (
				event.card.twlihuo_buffed &&
				player.getHistory("sourceDamage", function (evt) {
					return evt.card == event.card && evt._dyinged;
				}).length > 0
			);
		},
		forced: true,
		audio: "lihuo",
		audioname: ["re_chengpu"],
		content() {
			player.loseHp();
		},
	},
	twchunlao: {
		audio: "chunlao",
		trigger: { player: "phaseZhunbeiBegin" },
		direct: true,
		filter(event, player) {
			return (
				game.hasPlayer(function (current) {
					return current.countCards("hej") > 0;
				}) &&
				!game.hasPlayer(function (current) {
					return current.getExpansions("twchunlao").length > 0;
				})
			);
		},
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt("twchunlao"), "将一名角色区域内的一张牌作为“醇”置于其武将牌上", function (card, player, target) {
					return target.countCards("hej") > 0;
				})
				.set("ai", function (target) {
					return get.attitude(_status.event.player, target) * (player == target ? 1 : 2);
				});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("twchunlao", target);
				player.choosePlayerCard(target, "hej", true);
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				target.addToExpansion(result.cards, target, "give").gaintag.add("twchunlao");
			}
		},
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		group: ["twchunlao_sha", "twchunlao_dying"],
		subSkill: {
			sha: {
				trigger: { global: "useCard" },
				direct: true,
				filter(event, player) {
					return event.card.name == "sha" && event.player.countCards("he") > 0 && event.player.getExpansions("twchunlao").length > 0;
				},
				content() {
					"step 0";
					event.target = trigger.player;
					event.target
						.chooseCard(
							"he",
							"醇醪：是否交给" + get.translation(player) + "一张牌，令" + get.translation(trigger.card) + "的伤害值基数+1？"
						)
						.set("ai", function (card) {
							if (!_status.event.goon) {
								return 3.5 - get.value(card);
							}
							return 7 - get.value(card);
						})
						.set(
							"goon",
							(function () {
								if (get.attitude(target, player) < 0) {
									return false;
								}
								for (var target of trigger.targets) {
									if (
										!target.mayHaveShan(player, "use") ||
										trigger.player.hasSkillTag(
											"directHit_ai",
											true,
											{
												target: target,
												card: trigger.card,
											},
											true
										)
									) {
										if (
											get.attitude(player, target) < 0 &&
											!trigger.player.hasSkillTag("jueqing", false, target) &&
											!target.hasSkillTag("filterDamage", null, {
												player: trigger.player,
												card: trigger.card,
											})
										) {
											return true;
										}
									}
								}
								return false;
							})()
						);
					if (!event.target.isUnderControl(true) && !event.target.isOnline()) {
						game.delayx();
					}
					"step 1";
					if (result.bool) {
						target.logSkill("twchunlao", player);
						if (!target.hasSkill("twchunlao")) {
							game.trySkillAudio("twchunlao", player);
						}
						if (player != target) {
							target.give(result.cards, player, "giveAuto");
						}
						trigger.baseDamage++;
					}
				},
			},
			dying: {
				audio: "chunlao",
				trigger: { global: "dying" },
				logTarget: "player",
				filter(event, player) {
					return event.player.getExpansions("twchunlao").length > 0;
				},
				prompt2: (event, player) => "移去" + get.translation(event.player) + "武将牌上的“醇”并摸一张牌，然后令其回复1点体力",
				check(event, player) {
					return get.attitude(player, event.player) > 0;
				},
				content() {
					var target = trigger.player,
						cards = target.getExpansions("twchunlao");
					if (cards.length) {
						target.loseToDiscardpile(cards);
					}
					player.draw();
					target.recover();
				},
			},
		},
	},
};
