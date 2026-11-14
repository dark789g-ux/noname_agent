import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const reguhuoSkills = {
	reguhuo: {
		audio: 2,
		derivation: "rechanyuan",
		enable: ["chooseToUse", "chooseToRespond"],
		hiddenCard(player, name) {
			return lib.inpile.includes(name) && player.countCards("h") > 0 && !player.hasSkill("reguhuo_used");
		},
		filter(event, player) {
			if (!player.countCards("hs") || player.hasSkill("reguhuo_used")) {
				return false;
			}
			for (var i of lib.inpile) {
				var type = get.type(i);
				if ((type == "basic" || type == "trick") && event.filterCard(get.autoViewAs({ name: i }, "unsure"), player, event)) {
					return true;
				}
				if (i == "sha") {
					for (var j of lib.inpile_nature) {
						if (event.filterCard(get.autoViewAs({ name: i, nature: j }, "unsure"), player, event)) {
							return true;
						}
					}
				}
			}
			return false;
		},
		chooseButton: {
			dialog() {
				var list = [];
				for (var i of lib.inpile) {
					var type = get.type(i);
					if (type == "basic" || type == "trick") {
						list.push([type, "", i]);
					}
					if (i == "sha") {
						for (var j of lib.inpile_nature) {
							list.push(["基本", "", "sha", j]);
						}
					}
				}
				return ui.create.dialog("蛊惑", [list, "vcard"]);
			},
			filter(button, player) {
				var evt = _status.event.getParent();
				return evt.filterCard(get.autoViewAs({ name: button.link[2], nature: button.link[3] }, "unsure"), player, evt);
			},
			check(button) {
				var player = _status.event.player;
				var rand = _status.event.getParent().getRand("reguhuo");
				var hasEnemy = game.hasPlayer(function (current) {
					return current != player && !current.hasSkill("rechanyuan") && (get.realAttitude || get.attitude)(current, player) < 0;
				});
				var card = { name: button.link[2], nature: button.link[3] };
				var val = _status.event.getParent().type == "phase" ? player.getUseValue(card) : 1;
				if (val <= 0) {
					return 0;
				}
				if (hasEnemy && rand > 0.3) {
					if (
						!player.countCards("h", function (cardx) {
							if (card.name == cardx.name) {
								if (card.name != "sha") {
									return true;
								}
								return get.is.sameNature(card, cardx);
							}
							return false;
						})
					) {
						return 0;
					}
					return 3 * val;
				}
				return val;
			},
			backup(links, player) {
				return {
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						suit: "none",
						number: null,
					},
					filterCard(card, player, target) {
						var result = true;
						var suit = card.suit,
							number = card.number;
						card.suit = "none";
						card.number = null;
						var mod = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
						if (mod != "unchanged") {
							result = mod;
						}
						card.suit = suit;
						card.number = number;
						return result;
					},
					position: "hs",
					ignoreMod: true,
					ai1(card) {
						var player = _status.event.player;
						var hasEnemy = game.hasPlayer(function (current) {
							return current != player && !current.hasSkill("rechanyuan") && (get.realAttitude || get.attitude)(current, player) < 0;
						});
						var rand = _status.event.getRand("reguhuo");
						var cardx = lib.skill.reguhuo_backup.viewAs;
						if (hasEnemy && rand > 0.3) {
							if (card.name == cardx.name && (card.name != "sha" || get.is.sameNature(card, cardx))) {
								return 10;
							}
							return 0;
						}
						return 6 - get.value(card);
					},
					async precontent(event, trigger, player) {
						const { result } = event;
						player.logSkill("reguhuo");
						player.addTempSkill("reguhuo_guess");
						const card = result.cards[0];
						result.card.suit = get.suit(card);
						result.card.number = get.number(card);
					},
				};
			},
			prompt(links) {
				return "将一张手牌当做" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用";
			},
		},
		ai: {
			fireAttack: true,
			respondShan: true,
			respondSha: true,
			skillTagFilter(player) {
				if (!player.countCards("hs") || player.hasSkill("reguhuo_used")) {
					return false;
				}
			},
			order: 10,
			result: {
				player: 1,
			},
			threaten: 1.3,
		},
		subSkill: {
			backup: {},
			used: { charlotte: true },
			guess: {
				trigger: {
					player: ["useCardBefore", "respondBefore"],
				},
				forced: true,
				silent: true,
				popup: false,
				charlotte: true,
				firstDo: true,
				sourceSkill: "reguhuo",
				filter(event, player) {
					return event.skill && event.skill.indexOf("reguhuo_") == 0;
				},
				async content(event, trigger, player) {
					// step 0
					player.addTempSkill("reguhuo_used");
					event.fake = false;
					const card = trigger.cards[0];
					if (card.name != trigger.card.name || (card.name == "sha" && !get.is.sameNature(trigger.card, card))) {
						event.fake = true;
					}
					player.line(trigger.targets, get.nature(trigger.card));
					event.cardTranslate = get.translation(trigger.card.name);
					trigger.card.number = get.number(card);
					trigger.card.suit = get.suit(card);
					trigger.skill = "reguhuo_backup";
					if (trigger.card.name == "sha" && get.natureList(trigger.card).length) {
						event.cardTranslate = get.translation(trigger.card.nature) + event.cardTranslate;
					}
					player.popup(event.cardTranslate, trigger.name == "useCard" ? "metal" : "wood");
					event.prompt = "是否质疑" + get.translation(player) + "声明的" + event.cardTranslate + "？";
					game.log(player, "声明了", "#y" + event.cardTranslate);
					event.targets = game
						.filterPlayer(function (current) {
							return current != player && !current.hasSkill("rechanyuan");
						})
						.sortBySeat();
					event.targets2 = event.targets.slice(0);
					player.lose(card, ui.ordering).relatedEvent = trigger;
					if (!event.targets.length) {
						event.betrays = [];
						// Skip to step 3
						for (const i of event.targets2) {
							i.popup("不质疑", "wood");
							game.log(i, "#g不质疑");
						}
						game.delay();
						player.showCards(trigger.cards);
						return;
					}
					event.betrays = [];

					// step 1
					let list = event.targets.map(function (target) {
						return [target, [event.prompt, [["reguhuo_ally", "reguhuo_betray"], "vcard"]], true];
					});
					const result = await player
						.chooseButtonOL(list)
						.set("switchToAuto", function () {
							_status.event.result = "ai";
						})
						.set("processAI", function () {
							let choice = Math.random() > 0.5 ? "reguhuo_ally" : "reguhuo_betray";
							const playerx = _status.event.player;
							const evt = _status.event.getParent("reguhuo_guess");
							if (playerx.hp <= 1 || (evt && (get.realAttitude || get.attitude)(playerx, evt.player) >= 0)) {
								choice = "reguhuo_ally";
							}
							return {
								bool: true,
								links: [["", "", choice]],
							};
						})
						.forResult();

					// step 2
					for (const i in result) {
						if (result[i].links[0][2] == "reguhuo_betray") {
							const current = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
							event.betrays.push(current);
							current.addExpose(0.2);
						}
					}

					// step 3
					for (const i of event.targets2) {
						const b = event.betrays.includes(i);
						i.popup(b ? "质疑" : "不质疑", b ? "fire" : "wood");
						game.log(i, b ? "#y质疑" : "#g不质疑");
					}
					game.delay();

					// step 4
					player.showCards(trigger.cards);
					if (event.betrays.length) {
						event.betrays.sortBySeat();
						if (event.fake) {
							game.asyncDraw(event.betrays);
							trigger.cancel();
							trigger.getParent().goto(0);
							game.log(player, "声明的", "#y" + event.cardTranslate, "作废了");
						} else {
							const next = game.createEvent("reguhuo_final", false);
							event.next.remove(next);
							trigger.after.push(next);
							next.targets = event.betrays;
							next.setContent(lib.skill.reguhuo_guess.contentx);
						}
					}

					// step 5
					game.delayx();
				},
				async contentx(event, trigger, player) {
					// process a copy of targets to mimic original step-goto loop
					const targets = (event.targets || []).slice(0);
					let result;
					while (targets.length) {
						const target = targets.shift();
						event.target = target;

						// step 0 -> await the choice
						result = await target
							.chooseToDiscard("弃置一张牌或失去1点体力")
							.set("ai", card => 9 - get.value(card))
							.forResult();

						// step 1
						if (!result.bool) {
							await target.loseHp();
						}

						// step 2
						await target.addSkills("rechanyuan");
					}
				},
			},
		},
	},
	rechanyuan: {
		init(player, skill) {
			if (player.hp <= 1) {
				player.logSkill(skill);
			}
			player.addSkillBlocker(skill);
		},
		onremove(player, skill) {
			player.removeSkillBlocker(skill);
		},
		skillBlocker(skill, player) {
			return skill != "chanyuan" && skill != "rechanyuan" && !lib.skill[skill].charlotte && !lib.skill[skill].persevereSkill && player.hp <= 1;
		},
		mark: true,
		intro: {
			content(storage, player, skill) {
				var str = "<li>锁定技，你不能于〖蛊惑〗的结算流程中进行质疑。当你的体力值不大于1时，你的其他技能失效。";
				var list = player.getSkills(null, false, false).filter(function (i) {
					return lib.skill.rechanyuan.skillBlocker(i, player);
				});
				if (list.length) {
					str += "<br><li>失效技能：" + get.translation(list);
				}
				return str;
			},
		},
		audio: 2,
		trigger: { player: "changeHp" },
		filter(event, player) {
			if (event.changedHp == 0) {
				return false;
			}
			return get.sgn(player.hp - 1.5) != get.sgn(player.hp - 1.5 - event.changedHp);
		},
		forced: true,
		async content(event, trigger, player) {},
	},
	botu: {
		audio: 2,
		trigger: { player: "phaseAfter" },
		frequent: true,
		filter(event, player) {
			var history = player.getHistory("useCard", function (evt) {
				return evt.isPhaseUsing();
			});
			var suits = [];
			for (var i = 0; i < history.length; i++) {
				var suit = get.suit(history[i].card);
				if (suit) {
					suits.add(suit);
				}
			}
			return suits.length == 4;
		},
		async content(event, trigger, player) {
			player.insertPhase();
		},
	},
	xinleiji: {
		group: "xinleiji_misa",
		audio: 2,
		derivation: "xinleiji_faq",
		audioname: ["boss_qinglong"],
		trigger: { player: ["useCard", "respond"] },
		filter(event, player) {
			return event.card.name == "shan" || (event.name == "useCard" && event.card.name == "shandian");
		},
		judgeCheck(card, bool) {
			var suit = get.suit(card);
			if (suit == "spade") {
				if (bool && get.number(card) > 1 && get.number(card) < 10) {
					return 5;
				}
				return 4;
			}
			if (suit == "club") {
				return 2;
			}
			return 0;
		},
		async content(event, trigger, player) {
			const judgeEvent = player.judge(lib.skill.xinleiji.judgeCheck);
			judgeEvent.judge2 = result => !!result.bool;
			await judgeEvent;
		},
		ai: {
			useShan: true,
			effect: {
				target_use(card, player, target, current) {
					let name;
					if (typeof card == "object") {
						if (card.viewAs) {
							name = card.viewAs;
						} else {
							name = get.name(card);
						}
					}
					if (
						name == "shandian" ||
						(get.tag(card, "respondShan") &&
							!player.hasSkillTag(
								"directHit_ai",
								true,
								{
									target: target,
									card: card,
								},
								true
							))
					) {
						let club = 0,
							spade = 0;
						if (
							game.hasPlayer(function (current) {
								return get.attitude(target, current) < 0 && get.damageEffect(current, target, target, "thunder") > 0;
							})
						) {
							club = 2;
							spade = 4;
						}
						if (!target.isHealthy()) {
							club += 2;
						}
						if (!club && !spade) {
							return 1;
						}
						if (name === "sha") {
							if (!target.mayHaveShan(player, "use")) {
								return;
							}
						} else if (!target.mayHaveShan(player)) {
							return 1 - 0.1 * Math.min(5, target.countCards("hs"));
						}
						if (!target.hasSkillTag("rejudge")) {
							return [1, (club + spade) / 4];
						}
						let pos = player == target || player.hasSkillTag("viewHandcard", null, target, true) ? "hes" : "e",
							better = club > spade ? "club" : "spade",
							max = 0;
						target.hasCard(function (cardx) {
							if (get.suit(cardx) == better) {
								max = 2;
								return true;
							}
							if (spade && get.color(cardx) == "black") {
								max = 1;
							}
						}, pos);
						if (max == 2) {
							return [1, Math.max(club, spade)];
						}
						if (max == 1) {
							return [1, Math.min(club, spade)];
						}
						if (pos == "e") {
							return [1, Math.min((Math.max(1, target.countCards("hs")) * (club + spade)) / 4, Math.max(club, spade))];
						}
						return [1, (club + spade) / 4];
					}
				},
				target(card, player, target) {
					let name;
					if (typeof card == "object") {
						if (card.viewAs) {
							name = card.viewAs;
						} else {
							name = get.name(card);
						}
					}
					if (name == "lebu" || name == "bingliang") {
						return [target.hasSkillTag("rejudge") ? 0.4 : 1, 2, target.hasSkillTag("rejudge") ? 0.4 : 1, 0];
					}
				},
			},
		},
	},
};
